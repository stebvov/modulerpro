-- Воронка «Партнерство» і розподіл заявок із сайту за воронками:
-- 1) форма сама каже воронку (поле блоку «Воронка CRM» → p.pipeline); 2) інакше — за сторінкою й текстом «Що плануєте».
-- Ключі етапів партнерства свідомо не «договір/виробництво/готово/здано» — на них висять автозадачі потоку будинків (chain_on_deal).

insert into public.pipelines (slug, name, sort_order, default_request_type)
select 'partners', 'Партнерство', 10, 'individual'
where not exists (select 1 from public.pipelines where slug = 'partners');

insert into public.pipeline_stages (pipeline_id, key, label, sort_order)
select p.id, s.key, s.label, s.sort
from public.pipelines p,
     (values ('партнер_новий', 'Нова заявка', 1), ('партнер_знайомство', 'Знайомство', 2), ('партнер_умови', 'Умови співпраці', 3),
             ('партнер_договір', 'Договір', 4), ('партнер_працюємо', 'Працюємо', 5)) as s(key, label, sort)
where p.slug = 'partners'
  and not exists (select 1 from public.pipeline_stages x where x.pipeline_id = p.id);

create or replace function public.site_submit_lead(p jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  v_name text := left(btrim(coalesce(p->>'name','')), 120);
  v_phone text := left(btrim(coalesce(p->>'phone','')), 40);
  v_digits text := regexp_replace(coalesce(p->>'phone',''), '\D', '', 'g');
  v_meta jsonb := case when jsonb_typeof(p->'meta') = 'object' and octet_length((p->'meta')::text) < 30000 then p->'meta' end;
  v_goal text := coalesce(p->>'goal', '');
  v_page text := coalesce(p->>'page', '');
  v_slug text;
  v_notes text;
  v_id uuid;
  v_pipe uuid;
  v_stage uuid;
begin
  if coalesce(p->>'company','') <> '' then return jsonb_build_object('ok', true); end if; -- пастка для ботів
  if v_name = '' or length(v_digits) < 9 then
    return jsonb_build_object('ok', false, 'error', 'Вкажіть імʼя й телефон');
  end if;
  -- та сама людина двічі за 10 хв — не дублюємо
  select id into v_id from public.leads
   where source = 'сайт' and regexp_replace(coalesce(phone,''), '\D', '', 'g') = v_digits and created_at > now() - interval '10 minutes'
   limit 1;
  if v_id is not null then return jsonb_build_object('ok', true, 'id', v_id); end if;
  if (select count(*) from public.leads where source = 'сайт' and created_at > now() - interval '1 minute') > 20 then
    return jsonb_build_object('ok', false, 'error', 'Забагато заявок, спробуйте за хвилину');
  end if;
  -- гео та IP — лише від сервера сайту; напряму з браузера їх можна підробити
  if v_meta is not null then
    if coalesce(auth.role(), '') = 'service_role' then
      v_meta := v_meta || jsonb_build_object('trusted', true);
    else
      v_meta := (v_meta - 'geo' - 'ip') || jsonb_build_object('trusted', false);
    end if;
  end if;
  v_notes := concat_ws(E'\n',
    nullif('Що планує: ' || nullif(left(v_goal, 200), ''), 'Що планує: '),
    nullif('Площа: ' || nullif(left(p->>'area', 60), ''), 'Площа: '),
    nullif('Модель: ' || nullif(left(p->>'model', 120), ''), 'Модель: '),
    nullif('Розрахунок: ' || nullif(left(p->>'calc', 300), ''), 'Розрахунок: '),
    nullif('Коментар: ' || nullif(left(p->>'message', 2000), ''), 'Коментар: '),
    nullif('Звʼязок: ' || nullif(left(p->>'contact_via', 40), ''), 'Звʼязок: '),
    nullif('Сторінка: ' || nullif(left(v_page, 300), ''), 'Сторінка: '),
    nullif('UTM: ' || nullif(left(p->>'utm', 300), ''), 'UTM: '),
    nullif('Звідки: ' || nullif(left(v_meta->>'summary', 400), ''), 'Звідки: '));
  insert into public.leads (source, name, phone, contact, region, budget_range, status, notes, site_meta)
  values ('сайт', v_name, v_phone, nullif(left(p->>'contact_via', 40), ''),
          coalesce(nullif(left(p->>'region', 120), ''), nullif(concat_ws(', ', v_meta->'geo'->>'city', v_meta->'geo'->>'country'), '')),
          nullif(left(p->>'budget', 60), ''), 'новий', nullif(v_notes, ''), v_meta)
  returning id into v_id;
  -- угода в першому етапі воронки
  begin
    v_slug := case
      when p->>'pipeline' in ('houses', 'partners', 'uk-owners') then p->>'pipeline'
      when v_page ~* 'partnerstvo'
        or v_goal ~* '(партнер|дистриб|дилер|постачальник|виробник|бригад|прораб|підряд|власник ділянки|керуюча компанія|керівник сервісу|інвестор або фонд|співпрац|ваканс)' then 'partners'
      when v_goal ~* '(сервіс|управлін)' then 'uk-owners'
      else 'houses' end;
    select pl.id, (select s.id from public.pipeline_stages s where s.pipeline_id = pl.id order by s.sort_order limit 1)
      into v_pipe, v_stage from public.pipelines pl where pl.slug = v_slug;
    if v_pipe is null or v_stage is null then -- воронку перейменували чи прибрали — у «Продаж будинків»
      select pl.id, (select s.id from public.pipeline_stages s where s.pipeline_id = pl.id order by s.sort_order limit 1)
        into v_pipe, v_stage from public.pipelines pl where pl.slug = 'houses';
    end if;
    if v_pipe is not null and v_stage is not null then
      insert into public.deals (lead_id, pipeline_id, stage_id, quantity, is_custom)
      values (v_id, v_pipe, v_stage, 1, false);
    end if;
  exception when others then raise warning 'site_submit_lead deal: %', sqlerrm;
  end;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke all on function public.site_submit_lead(jsonb) from public;
grant execute on function public.site_submit_lead(jsonb) to anon, authenticated, service_role;

-- Заявка з сайту: деталі про клієнта (країна/місто, пристрій, джерело, переглянуті сторінки) → leads.site_meta,
-- короткий рядок «Звідки: …» у нотатках (його ж бачить Telegram-сповіщення) і угода у воронці, щоб лід одразу був у CRM.
-- Гео й IP приймаються лише від сервера сайту (ключ service_role, /api/site/lead); з браузера — позначка trusted=false.

alter table public.leads add column if not exists site_meta jsonb;
comment on column public.leads.site_meta is 'Заявка з сайту: geo, device, source, visit, flags, summary (див. src/lib/site/leadMeta.js)';

create or replace function public.site_submit_lead(p jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  v_name text := left(btrim(coalesce(p->>'name','')), 120);
  v_phone text := left(btrim(coalesce(p->>'phone','')), 40);
  v_digits text := regexp_replace(coalesce(p->>'phone',''), '\D', '', 'g');
  v_meta jsonb := case when jsonb_typeof(p->'meta') = 'object' and octet_length((p->'meta')::text) < 30000 then p->'meta' end;
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
    nullif('Що планує: ' || nullif(left(p->>'goal', 200), ''), 'Що планує: '),
    nullif('Площа: ' || nullif(left(p->>'area', 60), ''), 'Площа: '),
    nullif('Модель: ' || nullif(left(p->>'model', 120), ''), 'Модель: '),
    nullif('Розрахунок: ' || nullif(left(p->>'calc', 300), ''), 'Розрахунок: '),
    nullif('Коментар: ' || nullif(left(p->>'message', 2000), ''), 'Коментар: '),
    nullif('Звʼязок: ' || nullif(left(p->>'contact_via', 40), ''), 'Звʼязок: '),
    nullif('Сторінка: ' || nullif(left(p->>'page', 300), ''), 'Сторінка: '),
    nullif('UTM: ' || nullif(left(p->>'utm', 300), ''), 'UTM: '),
    nullif('Звідки: ' || nullif(left(v_meta->>'summary', 400), ''), 'Звідки: '));
  insert into public.leads (source, name, phone, contact, region, budget_range, status, notes, site_meta)
  values ('сайт', v_name, v_phone, nullif(left(p->>'contact_via', 40), ''),
          coalesce(nullif(left(p->>'region', 120), ''), nullif(concat_ws(', ', v_meta->'geo'->>'city', v_meta->'geo'->>'country'), '')),
          nullif(left(p->>'budget', 60), ''), 'новий', nullif(v_notes, ''), v_meta)
  returning id into v_id;
  -- угода в першому етапі воронки: сервіс/управління → «УК: власники», решта → «Продаж будинків»
  begin
    select pl.id, (select s.id from public.pipeline_stages s where s.pipeline_id = pl.id order by s.sort_order limit 1)
      into v_pipe, v_stage
      from public.pipelines pl
     where pl.slug = case when coalesce(p->>'goal','') ~* '(сервіс|управлін)' then 'uk-owners' else 'houses' end;
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

-- воронка: джерело й коротко «звідки» на картці угоди (нові колонки — в кінці, решта без змін)
create or replace view public.v_deals_kanban with (security_invoker = true) as
 SELECT d.id AS deal_id,
    d.pipeline_id,
    pl.name AS pipeline_name,
    pl.slug AS pipeline_slug,
    d.stage_id,
    ps.key AS stage_key,
    ps.label AS stage_label,
    ps.sort_order AS stage_sort_order,
    d.quantity,
    d.is_custom,
    d.custom_area_m2,
    d.custom_notes,
    d.production_price,
    d.estimated_price,
    (COALESCE(d.production_price, d.estimated_price, (0)::numeric) * (d.quantity)::numeric) AS total_price,
    d.production_cost_snapshot,
    d.next_action_at,
    d.next_action_note,
    d.created_at,
    d.updated_at,
    l.id AS lead_id,
    l.name AS lead_name,
    l.phone AS lead_phone,
    l.contact AS lead_contact,
    l.region AS lead_region,
    l.category_id AS desired_category_id,
    pc.name AS desired_category_name,
    pt.name AS template_name,
    pt.area_m2,
    pt.base_cost_per_m2,
    tm.name AS owner_name,
    COALESCE(sum(ds.price), (0)::numeric) AS services_price_total,
    count(DISTINCT da.id) AS attachments_count,
    la.last_activity_at,
    la.last_activity_type,
    (EXTRACT(day FROM (now() - COALESCE(la.last_activity_at, d.created_at))))::integer AS days_without_attention,
    d.template_lines,
    l.source::text AS lead_source,
    l.site_meta->'geo'->>'cc' AS lead_cc,
    l.site_meta->'geo'->>'city' AS lead_city,
    l.site_meta->'device'->>'type' AS lead_device,
    l.site_meta->'source'->>'now' AS lead_channel
   FROM deals d
     JOIN leads l ON l.id = d.lead_id
     JOIN pipelines pl ON pl.id = d.pipeline_id
     JOIN pipeline_stages ps ON ps.id = d.stage_id
     LEFT JOIN product_categories pc ON pc.id = l.category_id
     LEFT JOIN product_templates pt ON pt.id = d.template_id
     LEFT JOIN team_members tm ON tm.id = d.owner_id
     LEFT JOIN deal_services ds ON ds.deal_id = d.id
     LEFT JOIN deal_attachments da ON da.deal_id = d.id
     LEFT JOIN LATERAL ( SELECT max(act.created_at) AS last_activity_at,
            (array_agg(act.type ORDER BY act.created_at DESC))[1] AS last_activity_type
           FROM deal_activities act
          WHERE act.deal_id = d.id) la ON true
  GROUP BY d.id, pl.name, pl.slug, ps.key, ps.label, ps.sort_order, l.id, l.name, l.phone, l.contact, l.region, l.category_id, pc.name, pt.name, pt.area_m2, pt.base_cost_per_m2, tm.name, la.last_activity_at, la.last_activity_type;

-- 📖 База знань онлайн. Записи приходять із локального «університету знань» (нотатки, висновки, огляди тем)
-- через edge-функцію kb-sync; поверх них — шар перевірки засновником: затверджено / з джерел, не перевірено / потребує уточнення.
-- Синхронізація ніколи не чіпає статус, коментар і «для кого»; якщо текст затвердженого запису змінився — ставить позначку stale.
-- Зараз базу бачить лише засновник; у режимі «команда» учасники бачать тільки затверджені записи з audience = 'team'.

create table if not exists public.kb_items (
  id text primary key,                       -- n-…, c-0001, syn-…
  kind text not null check (kind in ('note', 'claim', 'synthesis')),
  title text not null,
  body text not null default '',
  topics text[] not null default '{}',       -- теми з таксономії бази
  confidence text check (confidence in ('H', 'M', 'L')),
  sources jsonb not null default '[]',       -- [{id, title, type, date}]
  links jsonb not null default '[]',         -- [{id, rel, dir}] — пов'язані записи
  extra jsonb not null default '{}',
  src_created date,
  content_hash text not null default '',
  synced_at timestamptz not null default now(),
  removed boolean not null default false,    -- запис зник із локальної бази
  -- шар перевірки (міняє лише засновник)
  status text not null default 'unverified' check (status in ('approved', 'unverified', 'needs_check')),
  audience text not null default 'owner' check (audience in ('owner', 'team')),
  review_note text,
  reviewed_at timestamptz,
  reviewed_by text,
  stale boolean not null default false       -- текст змінився після затвердження
);
create index if not exists kb_items_status_idx on public.kb_items (status) where not removed;

create table if not exists public.kb_settings (
  id boolean primary key default true check (id),
  team_mode boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.kb_settings (id) values (true) on conflict do nothing;

create or replace function public.kb_team_mode() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select s.team_mode from public.kb_settings s), false);
$$;

-- позначка «хто й коли перевірив»; зміна статусу знімає «змінено після перевірки»
create or replace function public.kb_review_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'authenticated'
     and (new.status is distinct from old.status or new.review_note is distinct from old.review_note or new.audience is distinct from old.audience or new.stale is distinct from old.stale) then
    new.reviewed_at := now();
    new.reviewed_by := coalesce(auth.jwt() ->> 'email', new.reviewed_by);
    if new.status is distinct from old.status then new.stale := false; end if;
  end if;
  return new;
end $$;
drop trigger if exists kb_items_review_stamp on public.kb_items;
create trigger kb_items_review_stamp before update on public.kb_items for each row execute function public.kb_review_stamp();

alter table public.kb_items enable row level security;
alter table public.kb_settings enable row level security;

drop policy if exists kb_items_read on public.kb_items;
create policy kb_items_read on public.kb_items for select to authenticated using (
  (select public.pult_is_owner())
  or ((select public.kb_team_mode()) and (select public.is_team_member()) and status = 'approved' and audience = 'team' and not removed)
);
drop policy if exists kb_items_review on public.kb_items;
create policy kb_items_review on public.kb_items for update to authenticated
  using ((select public.pult_is_owner())) with check ((select public.pult_is_owner()));

drop policy if exists kb_settings_read on public.kb_settings;
create policy kb_settings_read on public.kb_settings for select to authenticated
  using ((select public.is_team_member()) or (select public.pult_is_owner()));
drop policy if exists kb_settings_write on public.kb_settings;
create policy kb_settings_write on public.kb_settings for update to authenticated
  using ((select public.pult_is_owner())) with check ((select public.pult_is_owner()));

revoke all on public.kb_items, public.kb_settings from anon, authenticated;
grant select on public.kb_items, public.kb_settings to authenticated;
grant update (status, audience, review_note, stale) on public.kb_items to authenticated;
grant update (team_mode, updated_at, updated_by) on public.kb_settings to authenticated;

-- питання до засновника й «додати в базу» — тепер і з порталу (раніше лише через Telegram)
alter table public.kb_survey add column if not exists resolution text;   -- чим закінчилось: закрите / частково / відкрите
drop policy if exists kb_survey_owner on public.kb_survey;
create policy kb_survey_owner on public.kb_survey for all to authenticated
  using ((select public.pult_is_owner())) with check ((select public.pult_is_owner()));
grant select on public.kb_survey to authenticated;
grant update (answer, status, answered_at) on public.kb_survey to authenticated;

drop policy if exists kb_inbox_owner on public.kb_inbox;
create policy kb_inbox_owner on public.kb_inbox for all to authenticated
  using ((select public.pult_is_owner())) with check ((select public.pult_is_owner()));
grant select on public.kb_inbox to authenticated;
grant insert (said) on public.kb_inbox to authenticated;

-- пошук по назві й тексту: усі слова запиту мають зустрітись; права — того, хто шукає (RLS)
create or replace function public.kb_search(p_q text) returns table (id text, in_title boolean)
language sql stable security invoker set search_path = '' as $$
  with w as (
    select '%' || replace(replace(replace(x, '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
    from unnest(regexp_split_to_array(lower(btrim(coalesce(p_q, ''))), '\s+')) x where length(x) > 1
  )
  select i.id, bool_and(lower(i.title) like w.pat)
  from public.kb_items i cross join w
  where not i.removed
  group by i.id
  having bool_and(lower(i.title || ' ' || i.body) like w.pat);
$$;
revoke all on function public.kb_search(text) from public, anon;
grant execute on function public.kb_search(text) to authenticated;

-- завантаження з локальної бази (кличе лише edge-функція kb-sync із ключем service_role)
create or replace function public.kb_import(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_new int; v_upd int; v_stale int;
begin
  with src as (
    select x ->> 'id' as id, x ->> 'kind' as kind, x ->> 'title' as title, coalesce(x ->> 'body', '') as body,
           array(select jsonb_array_elements_text(coalesce(x -> 'topics', '[]'))) as topics,
           nullif(x ->> 'confidence', '') as confidence,
           coalesce(x -> 'sources', '[]') as sources, coalesce(x -> 'links', '[]') as links, coalesce(x -> 'extra', '{}') as extra,
           nullif(x ->> 'created', '')::date as src_created, coalesce(x ->> 'hash', '') as hash,
           coalesce(nullif(x ->> 'init_status', ''), 'unverified') as init_status,
           coalesce(nullif(x ->> 'init_audience', ''), 'owner') as init_audience,
           nullif(x ->> 'init_note', '') as init_note
    from jsonb_array_elements(p_items) x
  ), up as (
    insert into public.kb_items as k (id, kind, title, body, topics, confidence, sources, links, extra, src_created, content_hash, status, audience, review_note)
    select id, kind, title, body, topics, confidence, sources, links, extra, src_created, hash, init_status, init_audience, init_note from src
    on conflict (id) do update set
      kind = excluded.kind, title = excluded.title, body = excluded.body, topics = excluded.topics, confidence = excluded.confidence,
      sources = excluded.sources, links = excluded.links, extra = excluded.extra, src_created = excluded.src_created,
      stale = k.stale or (k.status = 'approved' and k.content_hash <> '' and k.content_hash <> excluded.content_hash),
      content_hash = excluded.content_hash, synced_at = now(), removed = false
    returning (xmax = 0) as inserted, stale
  )
  select count(*) filter (where inserted), count(*) filter (where not inserted), count(*) filter (where stale) into v_new, v_upd, v_stale from up;
  return jsonb_build_object('new', v_new, 'updated', v_upd, 'stale', v_stale);
end $$;

-- після повного завантаження: записи, яких уже немає локально, ховаємо (не видаляємо — зберігається історія перевірки)
create or replace function public.kb_prune(p_ids text[]) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.kb_items set removed = true where not removed and not (id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

-- рішення засновника, отримані поза порталом (відповіді в Telegram-опитуванні): [{id, status, note, audience}]
create or replace function public.kb_review_apply(p_rows jsonb, p_by text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.kb_items k set
    status = coalesce(nullif(x ->> 'status', ''), k.status),
    review_note = coalesce(nullif(x ->> 'note', ''), k.review_note),
    audience = coalesce(nullif(x ->> 'audience', ''), k.audience),
    reviewed_at = now(), reviewed_by = p_by, stale = false
  from jsonb_array_elements(p_rows) x
  where k.id = x ->> 'id';
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.kb_import(jsonb), public.kb_prune(text[]), public.kb_review_apply(jsonb, text), public.kb_review_stamp() from public, anon, authenticated;
grant execute on function public.kb_import(jsonb), public.kb_prune(text[]), public.kb_review_apply(jsonb, text) to service_role;

-- навчальні курси «лише для своїх посад» (собівартість, керівник, засновник): бачать ті, чия посада є в role_keys, і ті, хто веде навчання
alter table public.hr_courses add column if not exists restricted boolean not null default false;

create or replace function public.hr_course_open(p_course uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select not c.restricted or exists (
      select 1 from public.task_members m
      where m.active and lower(m.email) = lower(auth.jwt() ->> 'email') and (m.is_owner or m.hr_role = any (c.role_keys)))
    from public.hr_courses c where c.id = p_course), false);
$$;
revoke all on function public.hr_course_open(uuid) from public, anon;
grant execute on function public.hr_course_open(uuid) to authenticated;

drop policy if exists hr_courses_read on public.hr_courses;
create policy hr_courses_read on public.hr_courses for select to authenticated using (
  (select public.hr_can()) or ((select public.is_team_member()) and (not restricted or public.hr_course_open(id))));
drop policy if exists hr_lessons_read on public.hr_lessons;
create policy hr_lessons_read on public.hr_lessons for select to authenticated using (
  (select public.hr_can()) or ((select public.is_team_member()) and public.hr_course_open(course_id)));
drop policy if exists hr_tests_read on public.hr_tests;
create policy hr_tests_read on public.hr_tests for select to authenticated using (
  (select public.hr_can()) or ((select public.is_team_member()) and (course_id is null or public.hr_course_open(course_id))));

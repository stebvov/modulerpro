-- 🤖 Асистент — операційний ШІ-директор (03.10.2026).
-- Реєстр контролю coo_issues наповнює coo_scan() без ШІ: прострочене, без руху, без відповідального, угоди без уваги.
-- Розмову (coo_messages), памʼять (coo_memory) і налаштування (coo_settings) бачить лише засновник; пише edge-функція coo (service_role).

create table if not exists public.coo_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.coo_settings (key, value) values
  ('brief', '{"enabled": true}'),
  ('team_pings', '{"enabled": false, "max_per_day": 3}'),
  ('model', '"claude-opus-5-5"')
on conflict (key) do nothing;

create table if not exists public.coo_messages (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.task_members(id) on delete cascade,
  channel text not null default 'app' check (channel in ('app', 'tg')),
  role text not null check (role in ('user', 'assistant')),
  kind text not null default 'chat' check (kind in ('chat', 'brief', 'alert')),
  body text not null,
  actions jsonb,          -- що асистент зробив у системі, відповідаючи
  cost_usd numeric,
  created_at timestamptz not null default now()
);
create index if not exists coo_messages_member on public.coo_messages (member_id, created_at desc);

create table if not exists public.coo_memory (
  id bigint generated always as identity primary key,
  body text not null,
  created_by uuid references public.task_members(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.coo_issues (
  id bigint generated always as identity primary key,
  kind text not null,       -- task_overdue | task_stale | task_no_due | task_no_owner | project_no_owner | project_idle | deal_stuck | request_overdue | prod_late | member_no_tg | question
  severity smallint not null default 2,   -- 1 горить · 2 увага · 3 до відома
  ref text not null,        -- task:<id> | project:<назва> | deal:<id> | request:<id> | slot:<id> | member:<id> | q:<uuid>
  task_num integer,
  project text,
  member_id uuid references public.task_members(id) on delete set null,   -- хто відповідає
  title text not null,
  detail text,
  status text not null default 'open' check (status in ('open', 'asked', 'answered', 'resolved', 'dismissed')),
  question text,
  answer text,
  asked_at timestamptz,
  answered_at timestamptz,
  resolved_at timestamptz,
  escalated_at timestamptz,
  tg_message_id bigint,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
-- одна жива позиція на обʼєкт; «знято» (dismissed) мовчить, доки причина не зникне
create unique index if not exists coo_issues_live on public.coo_issues (kind, ref) where status <> 'resolved';
create index if not exists coo_issues_status on public.coo_issues (status, severity);

alter table public.coo_settings enable row level security;
alter table public.coo_messages enable row level security;
alter table public.coo_memory enable row level security;
alter table public.coo_issues enable row level security;

drop policy if exists coo_settings_owner on public.coo_settings;
create policy coo_settings_owner on public.coo_settings for all using ((select public.pult_is_owner())) with check ((select public.pult_is_owner()));
drop policy if exists coo_memory_owner on public.coo_memory;
create policy coo_memory_owner on public.coo_memory for all using ((select public.pult_is_owner())) with check ((select public.pult_is_owner()));
drop policy if exists coo_issues_owner on public.coo_issues;
create policy coo_issues_owner on public.coo_issues for all using ((select public.pult_is_owner())) with check ((select public.pult_is_owner()));
drop policy if exists coo_messages_read on public.coo_messages;
create policy coo_messages_read on public.coo_messages for select using ((select public.pult_is_owner()) and member_id = (select public.pult_me()));
drop policy if exists coo_messages_delete on public.coo_messages;
create policy coo_messages_delete on public.coo_messages for delete using ((select public.pult_is_owner()) and member_id = (select public.pult_me()));

revoke all on public.coo_settings, public.coo_messages, public.coo_memory, public.coo_issues from anon;

-- Що зараз не так: один рядок на обʼєкт і причину.
create or replace function public.coo_detect()
returns table (kind text, severity smallint, ref text, task_num integer, project text, member_id uuid, title text, detail text)
language sql stable security definer set search_path to ''
as $$
  with d as (select public.pult_today() as today),
  ot as (
    select t.id, t.num, t.title, t.project, t.owner_id, t.status, t.due, t.recur, coalesce(m.is_ai, false) as owner_ai,
           greatest(t.updated_at, coalesce((select max(u.created_at) from public.task_updates u where u.task_id = t.id), t.updated_at)) as last_at
    from public.tasks t left join public.task_members m on m.id = t.owner_id
    where t.status <> 'done'
  )
  select 'task_overdue', (case when d.today - t.due >= 3 then 1 else 2 end)::smallint, 'task:' || t.id, t.num, t.project, t.owner_id,
         '#' || t.num || ' ' || t.title,
         'прострочено ' || (d.today - t.due) || ' дн (термін ' || to_char(t.due, 'DD.MM') || ')' || case when t.recur <> 'none' then ' — регулярна, немає звіту' else '' end
    from ot t, d where not t.owner_ai and t.due < d.today
  union all
  select 'task_stale', 2::smallint, 'task:' || t.id, t.num, t.project, t.owner_id, '#' || t.num || ' ' || t.title,
         (case t.status when 'waiting' then 'чекаємо, без руху ' else 'в роботі, без оновлень ' end) || (d.today - (t.last_at at time zone 'Europe/Kyiv')::date) || ' дн'
    from ot t, d
   where not t.owner_ai and t.recur = 'none' and (t.due is null or t.due >= d.today)
     and ((t.status = 'doing' and t.last_at < now() - interval '7 days') or (t.status = 'waiting' and t.last_at < now() - interval '10 days'))
  union all
  select 'task_no_due', 3::smallint, 'task:' || t.id, t.num, t.project, t.owner_id, '#' || t.num || ' ' || t.title, 'немає терміну'
    from ot t where not t.owner_ai and t.due is null and t.recur = 'none' and t.owner_id is not null
  union all
  select 'task_no_owner', 2::smallint, 'task:' || t.id, t.num, t.project, null::uuid, '#' || t.num || ' ' || t.title, 'немає виконавця'
    from ot t where t.owner_id is null
  union all
  select 'project_no_owner', 3::smallint, 'project:' || p.name, null::integer, p.name, null::uuid, 'Проєкт «' || p.name || '»', 'немає відповідального'
    from public.task_projects p where p.status = 'active' and p.owner_id is null
  union all
  select 'project_idle', 3::smallint, 'project:' || p.name, null::integer, p.name, p.owner_id, 'Проєкт «' || p.name || '»',
         case when x.open_n = 0 then 'активний, але відкритих задач немає' else 'без руху ' || (d.today - (x.last_at at time zone 'Europe/Kyiv')::date) || ' дн' end
    from public.task_projects p cross join d
    cross join lateral (
      select count(*) filter (where t.status <> 'done') as open_n,
             greatest(max(t.updated_at), (select max(u.created_at) from public.task_updates u join public.tasks t2 on t2.id = u.task_id where t2.project = p.name),
                      (select max(n.created_at) from public.project_notes n where n.project = p.name), p.created_at) as last_at
      from public.tasks t where t.project = p.name
    ) x
   where p.status = 'active' and coalesce(p.stage, '') not in ('ops', 'run') and (x.open_n = 0 or x.last_at < now() - interval '14 days')
  union all
  select 'deal_stuck',
         (case when k.days_without_attention > 45 then 3 when k.stage_sort_order = f.first_sort then 1 else 2 end)::smallint,
         'deal:' || k.deal_id, null::integer, null::text,
         (select m.id from public.task_members m where m.active and m.name = k.owner_name limit 1),
         'Угода: ' || coalesce(k.lead_name, '—') || ' · ' || k.stage_label,
         k.pipeline_name || ': без уваги ' || k.days_without_attention || ' дн'
           || case when k.next_action_at < now() then ', наступний крок прострочено (' || to_char(k.next_action_at at time zone 'Europe/Kyiv', 'DD.MM') || ')' else '' end
           || case when k.owner_name is null then ', немає менеджера' else '' end
    from public.v_deals_kanban k
    cross join lateral (select min(s.sort_order) as first_sort from public.pipeline_stages s where s.pipeline_id = k.pipeline_id) f
   where k.stage_key not in ('здано', 'партнер_працюємо', 'в_управлінні')
     and (k.next_action_at < now() or k.days_without_attention >= case when k.stage_sort_order = f.first_sort then 2 else 7 end)
  union all
  select 'request_overdue', 2::smallint, 'request:' || r.id, null::integer, o.project, r.assignee_id,
         'Заявка УК: ' || r.title, 'термін ' || to_char(r.due, 'DD.MM') || ' минув' || coalesce(' · ' || o.name, '')
    from public.service_requests r left join public.managed_objects o on o.id = r.object_id, d
   where r.done_at is null and r.due < d.today
  union all
  select 'prod_late', 1::smallint, 'slot:' || s.id, null::integer, null::text, null::uuid,
         'Виробництво: ' || coalesce(public.chain_deal_label(s.deal_id), 'слот'), 'дедлайн ' || to_char(s.deadline, 'DD.MM') || ' минув, статус «' || s.status::text || '»'
    from public.production_slots s, d
   where s.status::text in ('заброньований', 'в роботі') and s.deadline < d.today
  union all
  select 'member_no_tg', 3::smallint, 'member:' || m.id, null::integer, null::text, m.id, m.name || ' — не підключений до бота',
         'відкритих задач: ' || x.n || ' — нагадувань і питань не отримує'
    from public.task_members m
    cross join lateral (select count(*) as n from public.tasks t where t.owner_id = m.id and t.status <> 'done') x
   where m.active and not coalesce(m.is_ai, false) and m.tg_user_id is null and x.n > 0;
$$;

-- Обхід: нове — додати, наявне — освіжити, зникле — закрити. Питання вручну (kind = question) не чіпає.
create or replace function public.coo_scan()
returns jsonb
language plpgsql security definer set search_path to ''
as $$
declare n_new int; n_res int; n_back int;
begin
  with cur as materialized (select * from public.coo_detect()),
  upd as (
    update public.coo_issues i
       set last_seen = now(), severity = c.severity, title = c.title, detail = c.detail, member_id = c.member_id, project = c.project, task_num = c.task_num
      from cur c where i.kind = c.kind and i.ref = c.ref and i.status <> 'resolved'
    returning i.id),
  ins as (
    insert into public.coo_issues (kind, severity, ref, task_num, project, member_id, title, detail)
    select c.kind, c.severity, c.ref, c.task_num, c.project, c.member_id, c.title, c.detail from cur c
     where not exists (select 1 from public.coo_issues i where i.kind = c.kind and i.ref = c.ref and i.status <> 'resolved')
    returning id),
  res as (
    update public.coo_issues i set status = 'resolved', resolved_at = now()
     where i.status <> 'resolved' and i.kind <> 'question'
       and not exists (select 1 from cur c where c.kind = i.kind and c.ref = i.ref)
    returning i.id)
  select (select count(*) from ins), (select count(*) from res) into n_new, n_res;

  -- відповіли, а причина лишилась 3 дні — знову відкрите; питання вручну з відповіддю закриваємо через 14 днів
  update public.coo_issues set status = 'open' where status = 'answered' and kind <> 'question' and answered_at < now() - interval '3 days';
  get diagnostics n_back = row_count;
  update public.coo_issues set status = 'resolved', resolved_at = now() where kind = 'question' and status = 'answered' and answered_at < now() - interval '14 days';

  return jsonb_build_object('new', n_new, 'resolved', n_res, 'reopened', n_back,
    'live', (select count(*) from public.coo_issues where status in ('open', 'asked', 'answered')));
end $$;

-- Картина компанії одним обʼєктом: для ШІ й для екрана «Асистент».
create or replace function public.coo_snapshot()
returns jsonb
language sql stable security definer set search_path to ''
as $$
  with d as (select public.pult_today() as today),
  ot as (
    select t.*, greatest(t.updated_at, coalesce((select max(u.created_at) from public.task_updates u where u.task_id = t.id), t.updated_at)) as last_at
    from public.tasks t where t.status <> 'done'
  ),
  mem as (select m.id, m.name, m.role, m.is_owner, coalesce(m.is_ai, false) as is_ai, m.tg_user_id is not null as tg, m.sort from public.task_members m where m.active)
  select jsonb_build_object(
    'today', (select today from d),
    'counts', jsonb_build_object(
      'open', (select count(*) from ot),
      'overdue', (select count(*) from ot, d where ot.due < d.today),
      'due_today', (select count(*) from ot, d where ot.due = d.today),
      'no_due', (select count(*) from ot where due is null and recur = 'none'),
      'stale', (select count(*) from ot where recur = 'none' and status in ('doing', 'waiting') and last_at < now() - interval '7 days'),
      'done_7d', (select count(*) from public.tasks where status = 'done' and done_at > now() - interval '7 days'),
      'created_7d', (select count(*) from public.tasks where created_at > now() - interval '7 days'),
      'issues', (select count(*) from public.coo_issues where status in ('open', 'asked', 'answered')),
      'hot', (select count(*) from public.coo_issues where status in ('open', 'asked', 'answered') and severity = 1),
      'asked', (select count(*) from public.coo_issues where status = 'asked'),
      'answered', (select count(*) from public.coo_issues where status = 'answered'),
      'no_tg', (select count(*) from mem where not is_ai and not tg)
    ),
    'people', (select coalesce(jsonb_agg(to_jsonb(x) order by x.overdue desc, x.open desc, x.name), '[]'::jsonb) from (
      select m.name, m.role, m.tg, m.is_owner as owner,
             (select count(*) from ot where ot.owner_id = m.id) as open,
             (select count(*) from ot, d where ot.owner_id = m.id and ot.due < d.today) as overdue,
             (select count(*) from ot where ot.owner_id = m.id and ot.recur = 'none' and ot.status in ('doing', 'waiting') and ot.last_at < now() - interval '7 days') as stale,
             (select count(*) from public.tasks t where t.owner_id = m.id and t.status = 'done' and t.done_at > now() - interval '7 days') as done_7d,
             (select count(*) from ot where ot.controller_id = m.id and ot.owner_id is distinct from m.id) as controls
        from mem m where not m.is_ai) x),
    'projects', (select coalesce(jsonb_agg(to_jsonb(x) order by x.sort), '[]'::jsonb) from (
      select p.name, p.kind, p.status, p.direction as dir, p.stage, p.sort, (select m.name from mem m where m.id = p.owner_id) as owner,
             (select count(*) from ot where ot.project = p.name) as open,
             (select count(*) from ot, d where ot.project = p.name and ot.due < d.today) as overdue,
             (select count(*) from public.tasks t where t.project = p.name and t.status = 'done' and t.done_at > now() - interval '7 days') as done_7d,
             (select max(t.updated_at)::date from public.tasks t where t.project = p.name) as last_at,
             (select c.title from public.tg_chats c where c.project = p.name and c.active limit 1) as chat
        from public.task_projects p where p.status <> 'done') x),
    'directions', (select coalesce(jsonb_agg(jsonb_build_object('key', b.key, 'name', b.name, 'head', (select m.name from mem m where m.id = b.head_id)) order by b.sort), '[]'::jsonb) from public.biz_directions b),
    'tasks', (select coalesce(jsonb_agg(to_jsonb(x) order by x.due nulls last, x.n), '[]'::jsonb) from (
      select t.num as n, t.title as t, (select m.name from mem m where m.id = t.owner_id) as who,
             (select m.name from mem m where m.id = t.controller_id) as ctl, t.project as p, t.status as s, t.due,
             case when t.due < d.today then d.today - t.due end as late,
             (d.today - (t.last_at at time zone 'Europe/Kyiv')::date) as idle,
             nullif(t.recur, 'none') as recur,
             coalesce(nullif(t.next_step, ''), (select c.title from public.task_checks c where c.task_id = t.id and not c.done order by c.sort limit 1)) as next
        from ot t, d order by t.due nulls last, t.num limit 150) x),
    'done_2d', (select coalesce(jsonb_agg(jsonb_build_object('n', t.num, 't', t.title, 'who', (select m.name from mem m where m.id = t.owner_id), 'p', t.project) order by t.done_at desc), '[]'::jsonb)
                  from public.tasks t where t.status = 'done' and t.done_at > now() - interval '2 days'),
    'deals', (select coalesce(jsonb_agg(to_jsonb(x) order by x.pipeline, x.sort), '[]'::jsonb) from (
      select k.pipeline_name as pipeline, k.stage_label as stage, min(k.stage_sort_order) as sort, count(*) as n, sum(k.total_price) as sum,
             jsonb_agg(jsonb_build_object('client', k.lead_name, 'idle', k.days_without_attention, 'manager', k.owner_name, 'next', k.next_action_note,
                                          'next_at', (k.next_action_at at time zone 'Europe/Kyiv')::date, 'price', nullif(k.total_price, 0)) order by k.days_without_attention desc) as list
        from public.v_deals_kanban k group by k.pipeline_name, k.stage_label) x),
    'production', (select coalesce(jsonb_agg(jsonb_build_object('what', public.chain_deal_label(s.deal_id), 'status', s.status::text, 'start', s.start_date, 'deadline', s.deadline,
                     'stages_done', (select count(*) from public.production_stages g where g.slot_id = s.id and g.completed_at is not null),
                     'stages', (select count(*) from public.production_stages g where g.slot_id = s.id)) order by s.deadline), '[]'::jsonb)
                    from public.production_slots s where s.status::text <> 'вільний'),
    'requests', (select coalesce(jsonb_agg(jsonb_build_object('title', r.title, 'object', (select o.name from public.managed_objects o where o.id = r.object_id), 'status', r.status, 'due', r.due,
                   'who', (select m.name from mem m where m.id = r.assignee_id)) order by r.due nulls last), '[]'::jsonb)
                  from public.service_requests r where r.done_at is null),
    'events_3d', (select coalesce(jsonb_agg(jsonb_build_object('at', to_char(e."at" at time zone 'Europe/Kyiv', 'DD.MM HH24:MI'), 'kind', e.kind, 'title', e.title, 'project', e.project,
                    'amount', e.amount, 'cur', e.currency) order by e."at" desc), '[]'::jsonb)
                   from (select * from public.biz_events b where b."at" > now() - interval '3 days' order by b."at" desc limit 40) e),
    'questions', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'title', i.title, 'who', (select m.name from mem m where m.id = i.member_id), 'status', i.status,
                    'question', i.question, 'answer', i.answer, 'asked', to_char(i.asked_at at time zone 'Europe/Kyiv', 'DD.MM HH24:MI'),
                    'answered', to_char(i.answered_at at time zone 'Europe/Kyiv', 'DD.MM HH24:MI'), 'silent', i.escalated_at is not null) order by i.asked_at desc), '[]'::jsonb)
                   from public.coo_issues i where i.status in ('asked', 'answered')),
    'issues_by_kind', (select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb) from (select kind, count(*) as n from public.coo_issues where status in ('open', 'asked', 'answered') group by kind) k)
  );
$$;

-- Екран «Асистент»: та сама картина, лише засновнику.
create or replace function public.coo_overview()
returns jsonb
language plpgsql stable security definer set search_path to ''
as $$
begin
  if not public.pult_is_owner() then raise exception 'forbidden'; end if;
  return public.coo_snapshot();
end $$;

revoke all on function public.coo_detect() from public, anon, authenticated;
revoke all on function public.coo_scan() from public, anon, authenticated;
revoke all on function public.coo_snapshot() from public, anon, authenticated;
revoke all on function public.coo_overview() from public, anon;
grant execute on function public.coo_detect(), public.coo_scan(), public.coo_snapshot() to service_role;
grant execute on function public.coo_overview() to authenticated;

-- Розклад: зведення засновнику о 08:30 за Києвом (пн–сб), обхід щогодини з 9 до 19.
select cron.schedule('coo-brief', '30 5,6 * * 1-6', $cron$
  select net.http_get('https://uaufrrpfvixhprqhqjzo.supabase.co/functions/v1/coo?action=brief&key=' || (select value from public.app_secrets where key='cron_secret'), timeout_milliseconds := 150000)
  where extract(hour from now() at time zone 'Europe/Kyiv') = 8;
$cron$);
select cron.schedule('coo-sweep', '15 * * * *', $cron$
  select net.http_get('https://uaufrrpfvixhprqhqjzo.supabase.co/functions/v1/coo?action=sweep&key=' || (select value from public.app_secrets where key='cron_secret'), timeout_milliseconds := 60000)
  where extract(hour from now() at time zone 'Europe/Kyiv') between 9 and 19;
$cron$);

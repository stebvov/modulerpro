-- Бот бази знань у Telegram (edge-функція kb-bot): відповідає на питання із записів kb_items.
-- Засновник отримує відповіді з усієї бази (зі статусами записів); команда — лише із затверджених записів «для команди»
-- і лише коли базу відкрито (kb_settings.team_mode). Усі таблиці й функції тут — службові: доступ лише в service_role,
-- журнал бачить засновник.

create table if not exists public.kb_bot_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  tg_user_id bigint,
  member_id uuid,
  member_name text,
  is_owner boolean not null default false,
  question text not null,
  answer text,
  used_ids text[] not null default '{}',
  gap text,                 -- чого в базі не знайшлось (підказка, що дописати)
  feedback smallint,        -- 1 корисно, 0 не те
  cost_usd numeric,
  error text
);
create index if not exists kb_bot_log_at_idx on public.kb_bot_log (at desc);
alter table public.kb_bot_log enable row level security;
create policy kb_bot_log_owner on public.kb_bot_log for select to authenticated using ((select public.pult_is_owner()));
revoke all on public.kb_bot_log from anon, authenticated;
grant select on public.kb_bot_log to authenticated;

-- стан бота (яке питання опитування зараз поставлене тощо)
create table if not exists public.kb_bot_state (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.kb_bot_state enable row level security;
revoke all on public.kb_bot_state from anon, authenticated;

-- пошук записів за основами слів: збіг у назві важить утричі більше, ніж у тексті
create or replace function public.kb_bot_search(p_terms text[], p_all boolean, p_limit int default 14)
returns table (id text, kind text, title text, body text, status text, score int)
language sql stable security definer set search_path = '' as $$
  with t as (
    select '%' || replace(replace(replace(lower(x), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
    from unnest(p_terms) x where length(x) >= 3
  ), s as (
    select i.id, i.kind, i.title, i.body, i.status,
           (select coalesce(sum((lower(i.title) like t.pat)::int * 3 + (lower(i.body) like t.pat)::int), 0) from t)::int as score
    from public.kb_items i
    where not i.removed and (p_all or (i.status = 'approved' and i.audience = 'team'))
  )
  select s.id, s.kind, s.title, s.body, s.status, s.score
  from s where s.score > 0
  order by s.score desc, (s.status = 'approved') desc, (s.kind <> 'note') desc, s.id
  limit greatest(1, least(coalesce(p_limit, 14), 30));
$$;
revoke all on function public.kb_bot_search(text[], boolean, int) from public, anon, authenticated;
grant execute on function public.kb_bot_search(text[], boolean, int) to service_role;

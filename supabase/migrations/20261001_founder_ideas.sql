-- 💡 Ідеї та роздуми засновника: гіпотези про розвиток (сира → обдумуємо → перевіряємо → рішення).
-- Бачить і редагує лише засновник (pult_is_owner). Розбір і звʼязки зі знаннями — у базі знань (university/ideas), kb_id — номер картки там.

create table if not exists public.founder_ideas (
  id uuid primary key default gen_random_uuid(),
  num serial unique,                         -- i-0001, i-0002…
  title text not null default '',            -- теза одним реченням
  said text,                                 -- думка як сказано
  note text,                                 -- розбір: суть, що дає, ризики
  type text check (type in ('business-model', 'product', 'go-to-market', 'operations', 'platform')),
  directions text[] not null default '{}',   -- factory, towns, income-property, service, cross
  horizon text check (horizon in ('now', 'year', 'later')),
  status text not null default 'raw' check (status in ('raw', 'thinking', 'testing', 'do', 'later', 'no')),
  next_check text,                           -- найдешевша перша перевірка
  kb_id text,                                -- картка в базі знань, напр. i-0001
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.founder_ideas enable row level security;
drop policy if exists founder_ideas_owner on public.founder_ideas;
create policy founder_ideas_owner on public.founder_ideas for all to authenticated
  using (public.pult_is_owner()) with check (public.pult_is_owner());
revoke all on public.founder_ideas from anon;

create or replace function public.founder_ideas_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists founder_ideas_touch on public.founder_ideas;
create trigger founder_ideas_touch before update on public.founder_ideas for each row execute function public.founder_ideas_touch();

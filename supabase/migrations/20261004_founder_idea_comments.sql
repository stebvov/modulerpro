-- 💬 Коментарі до ідей засновника (як у задачах): текст + файли в pult-files/ideas/<idea_id>/…
create table if not exists public.founder_idea_comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.founder_ideas(id) on delete cascade,
  author_id uuid default auth.uid(),
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists founder_idea_comments_idea on public.founder_idea_comments(idea_id, created_at);
alter table public.founder_idea_comments enable row level security;
create policy founder_idea_comments_owner on public.founder_idea_comments for all to authenticated
  using (public.pult_is_owner()) with check (public.pult_is_owner());
revoke all on public.founder_idea_comments from anon;
grant select, insert, update, delete on public.founder_idea_comments to authenticated;
-- файли ідей бачить лише засновник
alter policy pult_files_select on storage.objects
  using (bucket_id = 'pult-files' and (select public.is_team_member()) and (name not like 'ideas/%' or (select public.pult_is_owner())));

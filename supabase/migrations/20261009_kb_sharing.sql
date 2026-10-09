-- 📖 База знань: доступ до окремого запису «як у Google Диску».
-- Було: запис або лише для засновника, або для всієї команди (після затвердження й у режимі «команда»).
-- Стало: засновник може ще й поділитися записом із конкретними людьми та/або посадами. Ті, з ким поділились,
-- бачать запис одразу — навіть якщо базу ще не відкрито всій команді і запис не затверджено (статус їм показано).
-- audience лишається як був (owner / team); «поділитися» — окремі списки поверх нього.

alter table public.kb_items
  add column if not exists share_members uuid[] not null default '{}',   -- task_members.id
  add column if not exists share_roles text[] not null default '{}';     -- hr_roles.key — посади

-- хто я в команді й на якій посаді (для політики читання — рахується один раз на запит)
create or replace function public.kb_me() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.id from public.task_members m where m.active and lower(m.email) = lower(auth.jwt() ->> 'email') limit 1;
$$;
create or replace function public.kb_my_role() returns text
language sql stable security definer set search_path = '' as $$
  select m.hr_role from public.task_members m where m.active and lower(m.email) = lower(auth.jwt() ->> 'email') limit 1;
$$;
revoke all on function public.kb_me(), public.kb_my_role() from public, anon;
grant execute on function public.kb_me(), public.kb_my_role() to authenticated;

alter policy kb_items_read on public.kb_items using (
  (select public.pult_is_owner())
  or ((select public.kb_team_mode()) and (select public.is_team_member()) and status = 'approved' and audience = 'team' and not removed)
  or (not removed and ((select public.kb_me()) = any (share_members) or (select public.kb_my_role()) = any (share_roles)))
);
grant update (share_members, share_roles) on public.kb_items to authenticated;   -- міняє лише засновник (політика kb_items_review)

-- чи показувати людині розділ «База знань»: засновнику завжди; команді — коли базу відкрито або з нею чимось поділились
create or replace function public.kb_visible() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select public.pult_is_owner())
      or ((select public.is_team_member()) and (
            (select public.kb_team_mode())
            or exists (select 1 from public.kb_items i
                       where not i.removed and ((select public.kb_me()) = any (i.share_members) or (select public.kb_my_role()) = any (i.share_roles)))));
$$;
revoke all on function public.kb_visible() from public, anon;
grant execute on function public.kb_visible() to authenticated;

-- бот бази знань: працівникові — затверджені записи «для команди» (коли базу відкрито) плюс затверджені записи,
-- якими з ним поділились особисто чи за посадою
create or replace function public.kb_bot_search2(p_terms text[], p_all boolean, p_limit int default 14, p_member uuid default null)
returns table (id text, kind text, title text, body text, status text, score int)
language sql stable security definer set search_path = '' as $$
  with me as (
    select (select m.hr_role from public.task_members m where m.id = p_member and m.active) as role
  ), t as (
    select '%' || replace(replace(replace(lower(x), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
    from unnest(p_terms) x where length(x) >= 3
  ), s as (
    select i.id, i.kind, i.title, i.body, i.status,
           (select coalesce(sum((lower(i.title) like t.pat)::int * 3 + (lower(i.body) like t.pat)::int), 0) from t)::int as score
    from public.kb_items i, me
    where not i.removed and (p_all or (i.status = 'approved' and (
            (i.audience = 'team' and public.kb_team_mode())
            or p_member = any (i.share_members) or me.role = any (i.share_roles))))
  )
  select s.id, s.kind, s.title, s.body, s.status, s.score
  from s where s.score > 0
  order by s.score desc, (s.status = 'approved') desc, (s.kind <> 'note') desc, s.id
  limit greatest(1, least(coalesce(p_limit, 14), 30));
$$;

-- чи є працівникові що читати через бота
create or replace function public.kb_bot_open(p_member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.kb_team_mode() or exists (
    select 1 from public.kb_items i
    where not i.removed and i.status = 'approved'
      and (p_member = any (i.share_members)
           or (select m.hr_role from public.task_members m where m.id = p_member and m.active) = any (i.share_roles)));
$$;
revoke all on function public.kb_bot_search2(text[], boolean, int, uuid), public.kb_bot_open(uuid) from public, anon, authenticated;
grant execute on function public.kb_bot_search2(text[], boolean, int, uuid), public.kb_bot_open(uuid) to service_role;

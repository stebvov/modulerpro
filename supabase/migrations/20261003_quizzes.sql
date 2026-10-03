-- Квізи (аналог AdsQuiz): конструктор у системі (Контент і маркетинг → 🧩 Квізи), публічна сторінка /q/<slug>,
-- заявки → leads/deals через site_submit_lead (воронка, Telegram, захист від дублів) + аналітика кроків.
-- Застосовано через Supabase MCP (міграція quizzes_module, 2026-10-03).
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  title text not null default 'Новий квіз',
  published boolean not null default false,
  pipeline text not null default 'houses',
  start jsonb not null default '{}'::jsonb,     -- стартовий екран: enabled, title, text, button, image, bonus
  questions jsonb not null default '[]'::jsonb, -- [{id,type,title,hint,required,multi,options:[{id,label,image,goto}],min,max,step,unit,goto}]
  contact jsonb not null default '{}'::jsonb,   -- форма контактів: title, text, button, ask_via
  thanks jsonb not null default '{}'::jsonb,    -- екран «дякуємо»: title, text, redirect
  design jsonb not null default '{}'::jsonb,    -- accent, image (фото збоку)
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_quizzes_updated_at before update on public.quizzes for each row execute function public.set_updated_at();

create table if not exists public.quiz_events (
  id bigint generated always as identity primary key,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  sid text not null,
  kind text not null check (kind in ('view','start','step','lead')),
  step int not null default -1,
  created_at timestamptz not null default now()
);
create unique index if not exists quiz_events_once on public.quiz_events (quiz_id, sid, kind, step);
create index if not exists quiz_events_quiz_time on public.quiz_events (quiz_id, created_at);

create table if not exists public.quiz_responses (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  sid text,
  answers jsonb not null default '[]'::jsonb,
  contact jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists quiz_responses_quiz on public.quiz_responses (quiz_id, created_at desc);
create index if not exists quiz_responses_lead on public.quiz_responses (lead_id);

alter table public.quizzes enable row level security;
alter table public.quiz_events enable row level security;
alter table public.quiz_responses enable row level security;

create policy quizzes_read_anon on public.quizzes for select to anon using (published);
create policy quizzes_read_auth on public.quizzes for select to authenticated using (published or (select public.mod_can()));
create policy quizzes_write on public.quizzes for all to authenticated using ((select public.mod_can())) with check ((select public.mod_can()));
create policy quiz_events_read on public.quiz_events for select to authenticated using ((select public.mod_can()));
create policy quiz_events_delete on public.quiz_events for delete to authenticated using ((select public.mod_can()));
create policy quiz_responses_read on public.quiz_responses for select to authenticated using ((select public.mod_can()));
create policy quiz_responses_delete on public.quiz_responses for delete to authenticated using ((select public.mod_can()));

-- подія відвідувача (перегляд, старт, крок): одна на сесію й крок
create or replace function public.quiz_track(p_slug text, p_sid text, p_kind text, p_step int default -1) returns void
language plpgsql security definer set search_path to '' as $$
declare v_quiz uuid;
begin
  if p_kind not in ('view','start','step') or coalesce(length(p_sid),0) not between 8 and 64 then return; end if;
  select id into v_quiz from public.quizzes where slug = p_slug and published;
  if v_quiz is null then return; end if;
  insert into public.quiz_events (quiz_id, sid, kind, step) values (v_quiz, p_sid, p_kind, greatest(-1, least(coalesce(p_step,-1), 200)))
  on conflict do nothing;
end $$;
revoke all on function public.quiz_track(text,text,text,int) from public;
grant execute on function public.quiz_track(text,text,text,int) to anon, authenticated, service_role;

-- заявка з квізу: відповіді → лід і угода (та сама логіка, що для форми сайту) + запис відповідей
create or replace function public.quiz_submit(p jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  q public.quizzes;
  v_answers jsonb := case when jsonb_typeof(p->'answers') = 'array' then p->'answers' else '[]'::jsonb end;
  v_text text;
  v_res jsonb;
  v_sid text := left(coalesce(p->>'sid',''), 64);
begin
  select * into q from public.quizzes where slug = p->>'slug' and published;
  if q.id is null then return jsonb_build_object('ok', false, 'error', 'Квіз не знайдено'); end if;
  if octet_length(v_answers::text) > 20000 then return jsonb_build_object('ok', false, 'error', 'Забагато даних'); end if;
  select string_agg('• ' || left(coalesce(a->>'q',''), 200) || ': ' || left(coalesce(a->>'a',''), 500), E'\n')
    into v_text from jsonb_array_elements(v_answers) a;
  v_res := public.site_submit_lead(jsonb_strip_nulls(jsonb_build_object(
    'name', p->>'name', 'phone', p->>'phone', 'company', p->>'company', 'contact_via', p->>'contact_via',
    'goal', 'Квіз: ' || q.title, 'message', v_text, 'pipeline', q.pipeline,
    'page', '/q/' || q.slug, 'utm', p->>'utm', 'meta', p->'meta')));
  if coalesce((v_res->>'ok')::boolean, false) and v_res ? 'id' then
    insert into public.quiz_responses (quiz_id, lead_id, sid, answers, contact)
    values (q.id, (v_res->>'id')::uuid, nullif(v_sid,''), v_answers,
            jsonb_strip_nulls(jsonb_build_object('name', left(p->>'name',120), 'phone', left(p->>'phone',40), 'via', left(p->>'contact_via',40))));
    if v_sid <> '' then
      insert into public.quiz_events (quiz_id, sid, kind, step) values (q.id, v_sid, 'lead', -1) on conflict do nothing;
    end if;
  end if;
  return v_res;
end $$;
revoke all on function public.quiz_submit(jsonb) from public;
grant execute on function public.quiz_submit(jsonb) to anon, authenticated, service_role;

-- воронка квізу за період
create or replace function public.quiz_funnel(p_quiz uuid, p_from timestamptz default now() - interval '30 days')
returns table (kind text, step int, sessions bigint)
language sql stable security invoker set search_path to '' as $$
  select e.kind, e.step, count(distinct e.sid) from public.quiz_events e
   where e.quiz_id = p_quiz and e.created_at >= p_from group by e.kind, e.step;
$$;
-- зведення по всіх квізах за період
create or replace function public.quiz_summary(p_from timestamptz default now() - interval '30 days')
returns table (quiz_id uuid, views bigint, starts bigint, leads bigint)
language sql stable security invoker set search_path to '' as $$
  select e.quiz_id,
         count(distinct e.sid) filter (where e.kind = 'view'),
         count(distinct e.sid) filter (where e.kind = 'start'),
         count(distinct e.sid) filter (where e.kind = 'lead')
    from public.quiz_events e where e.created_at >= p_from group by e.quiz_id;
$$;
grant execute on function public.quiz_funnel(uuid, timestamptz) to authenticated;
grant execute on function public.quiz_summary(timestamptz) to authenticated;

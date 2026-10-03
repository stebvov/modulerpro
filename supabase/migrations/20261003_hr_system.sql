-- Люди: найм і розвиток. Профілі посад → вакансії → кандидати (воронка, оцінки, тести за посиланням)
-- → адаптація 90 днів → навчання й тести → постійна оцінка якості роботи з підказками.
-- Доступ: керувати наймом і оцінками — засновник, керівники пульту, позначені hr_admin (Катя), адмін Moduler Pro.
-- Кожен учасник команди бачить своє: навчання, тести, план адаптації, свої оцінки й показники.

alter table public.task_members add column if not exists hr_admin boolean not null default false;
alter table public.task_members add column if not exists hr_role text; -- ключ посади з hr_roles (менеджер продажу, керуючий УК…)
update public.task_members set hr_admin = true where lower(email) = 'ksymonchuk@gmail.com';

create or replace function public.hr_can() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.task_members m
                  where m.active and (m.is_owner or m.can_manage or m.hr_admin) and lower(m.email) = lower(auth.jwt() ->> 'email'))
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

-- працівник редагує свій рядок у команді (ім'я, фото), але не може сам собі видати кадровий доступ чи змінити посаду
create or replace function public.pult_guard_member() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner_call boolean := exists (select 1 from public.task_members m where m.active and m.is_owner and lower(m.email) = lower(auth.jwt() ->> 'email'));
begin
  if coalesce(auth.role(),'') = 'authenticated' then
    if not public.pult_can_manage() then
      new.can_manage := old.can_manage;
      new.is_owner := old.is_owner;
      new.email := old.email;
      new.active := old.active;
      new.unit_id := old.unit_id;
      new.hr_admin := old.hr_admin;
      if not public.hr_can() then new.hr_role := old.hr_role; end if;
    end if;
    if not owner_call then
      new.fin_all := old.fin_all;
    end if;
  end if;
  return new;
end $$;

-- призначити людині посаду (профіль посади визначає її навчання, показники й чек-листи)
create or replace function public.hr_set_role(p_member uuid, p_role text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.hr_can() then return jsonb_build_object('ok', false, 'error', 'Немає доступу'); end if;
  update public.task_members set hr_role = nullif(p_role, '') where id = p_member;
  return jsonb_build_object('ok', found);
end $$;

-- ── Профілі посад (scorecard) ───────────────────────────────────────────────
create table if not exists public.hr_roles (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  direction text,
  mission text,
  outcomes jsonb not null default '[]',      -- ["результат за рік", …]
  competencies jsonb not null default '[]',  -- [{key, name, weight, desc, good, bad}]
  kpis jsonb not null default '[]',          -- [{key, name, target, unit, better: more|less, metric, note}]
  must_have jsonb not null default '[]',
  red_flags jsonb not null default '[]',
  screening jsonb not null default '[]',     -- [{q, good, knockout}]
  interview jsonb not null default '[]',     -- [{comp, q, probe, good, bad}]
  case_task text,
  qa_checklist jsonb not null default '[]',  -- [{text, weight}] — чек-лист якості роботи (дзвінок, огляд будинку…)
  onboarding jsonb not null default '[]',    -- [{id, day, title, kind: learn|task|meet|check, who: self|mentor|head, ref, note}]
  job_ad text,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Вакансії й кандидати ────────────────────────────────────────────────────
create table if not exists public.hr_vacancies (
  id uuid primary key default gen_random_uuid(),
  role_id uuid references public.hr_roles(id) on delete set null,
  title text not null,
  status text not null default 'draft' check (status in ('draft','open','paused','closed')),
  headcount int not null default 1,
  city text,
  format text,
  conditions text,       -- зарплата, графік, умови — заповнює власник
  description text,      -- текст оголошення (на сайт і job-сайти)
  on_site boolean not null default false,
  owner_id uuid references public.task_members(id) on delete set null, -- хто наймає
  opened_at date,
  deadline date,
  closed_at date,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_candidates (
  id uuid primary key default gen_random_uuid(),
  vacancy_id uuid references public.hr_vacancies(id) on delete set null,
  role_id uuid references public.hr_roles(id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  city text,
  source text,           -- сайт, work.ua, robota.ua, OLX, рекомендація, Telegram, LinkedIn…
  source_note text,
  cv_url text,
  about text,
  stage text not null default 'new' check (stage in ('new','screen','test','interview','task','reference','offer','hired','reserve','rejected')),
  stage_at timestamptz not null default now(),
  reject_reason text,
  score_test numeric,
  score_interview numeric,
  owner_id uuid references public.task_members(id) on delete set null,
  next_at timestamptz,
  next_note text,
  notes text,
  meta jsonb,
  member_id uuid references public.task_members(id) on delete set null, -- після виходу на роботу
  created_at timestamptz not null default now()
);
create index if not exists hr_candidates_vacancy on public.hr_candidates(vacancy_id);
create index if not exists hr_candidates_stage on public.hr_candidates(stage);

-- оцінки: кандидата (дзвінок, співбесіда, завдання, рекомендації) і працівника (випробувальний, огляд, чек-лист якості, 1:1)
create table if not exists public.hr_evals (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.hr_candidates(id) on delete cascade,
  member_id uuid references public.task_members(id) on delete cascade,
  kind text not null check (kind in ('screen','interview','task','reference','probation','review','qa','one_on_one')),
  title text,
  evaluator text,
  scores jsonb not null default '{}',
  total numeric,
  verdict text,
  strengths text,
  growth text,
  plan text,
  kpis jsonb,
  period text,
  created_at timestamptz not null default now(),
  check (candidate_id is not null or member_id is not null)
);
create index if not exists hr_evals_candidate on public.hr_evals(candidate_id);
create index if not exists hr_evals_member on public.hr_evals(member_id);

-- ── Навчання й тести ────────────────────────────────────────────────────────
create table if not exists public.hr_courses (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  title text not null,
  descr text,
  icon text,
  role_keys text[] not null default '{}', -- для кого; порожньо — для всіх
  level text not null default 'base' check (level in ('start','base','pro')),
  required boolean not null default false,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.hr_courses(id) on delete cascade,
  title text not null,
  body text,
  video_url text,
  minutes int,
  sort int not null default 0
);
create index if not exists hr_lessons_course on public.hr_lessons(course_id);

create table if not exists public.hr_tests (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  title text not null,
  descr text,
  kind text not null default 'course' check (kind in ('candidate','course','cert')),
  role_keys text[] not null default '{}',
  course_id uuid references public.hr_courses(id) on delete set null,
  pass_pct int not null default 80,
  minutes int,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.hr_tests(id) on delete cascade,
  kind text not null default 'single' check (kind in ('single','multi','open')),
  text text not null,
  options jsonb not null default '[]',
  correct jsonb not null default '[]',  -- номери правильних варіантів (з 0)
  explain text,                          -- пояснення; для відкритих — ознаки хорошої відповіді
  comp text,                             -- компетенція з профілю посади
  points numeric not null default 1,
  sort int not null default 0
);
create index if not exists hr_questions_test on public.hr_questions(test_id);

create table if not exists public.hr_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.hr_tests(id) on delete cascade,
  member_id uuid references public.task_members(id) on delete cascade,
  candidate_id uuid references public.hr_candidates(id) on delete cascade,
  token text unique not null default replace(gen_random_uuid()::text, '-', ''),
  status text not null default 'sent' check (status in ('sent','started','done','checked')),
  answers jsonb not null default '{}',
  auto_points numeric,
  open_points jsonb not null default '{}',
  max_points numeric,
  score_pct numeric,
  passed boolean,
  late boolean not null default false,
  sent_by text,
  checked_by text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  checked_at timestamptz
);
create index if not exists hr_attempts_member on public.hr_attempts(member_id);
create index if not exists hr_attempts_candidate on public.hr_attempts(candidate_id);

create table if not exists public.hr_progress (
  member_id uuid not null references public.task_members(id) on delete cascade,
  lesson_id uuid not null references public.hr_lessons(id) on delete cascade,
  done_at timestamptz not null default now(),
  primary key (member_id, lesson_id)
);

-- ── Адаптація ───────────────────────────────────────────────────────────────
create table if not exists public.hr_onboarding (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.task_members(id) on delete cascade,
  candidate_id uuid references public.hr_candidates(id) on delete set null,
  role_id uuid references public.hr_roles(id) on delete set null,
  person text,                -- ім'я, поки людину не додано в команду
  start_date date not null default current_date,
  mentor_id uuid references public.task_members(id) on delete set null,
  status text not null default 'active' check (status in ('active','passed','extended','failed')),
  steps jsonb not null default '[]', -- [{id, day, title, kind, who, ref, note, done_at, comment}]
  result text,
  created_at timestamptz not null default now()
);

-- ── Права ───────────────────────────────────────────────────────────────────
alter table public.hr_roles enable row level security;
alter table public.hr_vacancies enable row level security;
alter table public.hr_candidates enable row level security;
alter table public.hr_evals enable row level security;
alter table public.hr_courses enable row level security;
alter table public.hr_lessons enable row level security;
alter table public.hr_tests enable row level security;
alter table public.hr_questions enable row level security;
alter table public.hr_attempts enable row level security;
alter table public.hr_progress enable row level security;
alter table public.hr_onboarding enable row level security;

-- профілі посад, курси, уроки, список тестів — бачить уся команда; змінює HR
create policy hr_roles_read on public.hr_roles for select to authenticated using ((select public.is_team_member()) or (select public.hr_can()));
create policy hr_roles_write on public.hr_roles for all to authenticated using ((select public.hr_can())) with check ((select public.hr_can()));
create policy hr_courses_read on public.hr_courses for select to authenticated using ((select public.is_team_member()) or (select public.hr_can()));
create policy hr_courses_write on public.hr_courses for all to authenticated using ((select public.hr_can())) with check ((select public.hr_can()));
create policy hr_lessons_read on public.hr_lessons for select to authenticated using ((select public.is_team_member()) or (select public.hr_can()));
create policy hr_lessons_write on public.hr_lessons for all to authenticated using ((select public.hr_can())) with check ((select public.hr_can()));
create policy hr_tests_read on public.hr_tests for select to authenticated using ((select public.is_team_member()) or (select public.hr_can()));
create policy hr_tests_write on public.hr_tests for all to authenticated using ((select public.hr_can())) with check ((select public.hr_can()));
-- питання з правильними відповідями — лише HR; працівник і кандидат отримують їх без відповідей через hr_test_open
create policy hr_questions_all on public.hr_questions for all to authenticated using ((select public.hr_can())) with check ((select public.hr_can()));

-- найм — лише HR; відкриті вакансії «на сайті» читає будь-хто (сторінка «Кар'єра»)
create policy hr_vacancies_all on public.hr_vacancies for all to authenticated using ((select public.hr_can())) with check ((select public.hr_can()));
create policy hr_vacancies_public on public.hr_vacancies for select to anon, authenticated using (status = 'open' and on_site);
create policy hr_candidates_all on public.hr_candidates for all to authenticated using ((select public.hr_can())) with check ((select public.hr_can()));

-- оцінки: HR — усі; працівник бачить свої (огляди, випробувальний, чек-листи, 1:1)
create policy hr_evals_all on public.hr_evals for all to authenticated using ((select public.hr_can())) with check ((select public.hr_can()));
create policy hr_evals_own on public.hr_evals for select to authenticated using (member_id is not null and member_id = (select public.current_member_id()));

-- спроби тестів: HR — усі (перевірка відкритих відповідей); працівник бачить свої; створюються через функції
create policy hr_attempts_hr on public.hr_attempts for all to authenticated using ((select public.hr_can())) with check ((select public.hr_can()));
create policy hr_attempts_own on public.hr_attempts for select to authenticated using (member_id is not null and member_id = (select public.current_member_id()));

create policy hr_progress_own on public.hr_progress for all to authenticated
  using (member_id = (select public.current_member_id()) or (select public.hr_can()))
  with check (member_id = (select public.current_member_id()) or (select public.hr_can()));

create policy hr_onboarding_hr on public.hr_onboarding for all to authenticated using ((select public.hr_can())) with check ((select public.hr_can()));
create policy hr_onboarding_own on public.hr_onboarding for select to authenticated using (member_id is not null and member_id = (select public.current_member_id()));

revoke all on public.hr_roles, public.hr_candidates, public.hr_evals, public.hr_courses, public.hr_lessons, public.hr_tests,
  public.hr_questions, public.hr_attempts, public.hr_progress, public.hr_onboarding from anon;
revoke insert, update, delete on public.hr_vacancies from anon;

-- ── Сповіщення HR у Telegram (засновник + позначені hr_admin) ────────────────
create or replace function public.hr_notify(p_text text) returns void
language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  for m in select id from public.task_members where active and (is_owner or hr_admin) and tg_user_id is not null loop
    begin perform public.pult_tg(m.id, p_text); exception when others then raise warning 'hr_notify: %', sqlerrm; end;
  end loop;
end $$;

-- ── Відгук із сайту (сторінка «Кар'єра») ─────────────────────────────────────
create or replace function public.hr_apply(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := left(btrim(coalesce(p->>'name','')), 120);
  v_phone text := left(btrim(coalesce(p->>'phone','')), 40);
  v_digits text := regexp_replace(coalesce(p->>'phone',''), '\D', '', 'g');
  v_vac public.hr_vacancies;
  v_id uuid;
begin
  if coalesce(p->>'company','') <> '' then return jsonb_build_object('ok', true); end if; -- пастка для ботів
  if v_name = '' or length(v_digits) < 9 then return jsonb_build_object('ok', false, 'error', 'Вкажіть імʼя й телефон'); end if;
  if coalesce(p->>'vacancy','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_vac from public.hr_vacancies where id = (p->>'vacancy')::uuid and status = 'open' and on_site;
  end if;
  select id into v_id from public.hr_candidates
   where regexp_replace(coalesce(phone,''), '\D', '', 'g') = v_digits and created_at > now() - interval '10 minutes' limit 1;
  if v_id is not null then return jsonb_build_object('ok', true); end if;
  if (select count(*) from public.hr_candidates where source = 'сайт' and created_at > now() - interval '1 minute') > 10 then
    return jsonb_build_object('ok', false, 'error', 'Забагато відгуків, спробуйте за хвилину');
  end if;
  insert into public.hr_candidates (vacancy_id, role_id, full_name, phone, email, city, about, cv_url, source, source_note, meta)
  values (v_vac.id, v_vac.role_id, v_name, v_phone, nullif(left(btrim(coalesce(p->>'email','')), 120), ''),
          nullif(left(btrim(coalesce(p->>'city','')), 80), ''), nullif(left(btrim(coalesce(p->>'about','')), 3000), ''),
          nullif(left(btrim(coalesce(p->>'cv','')), 500), ''), 'сайт', nullif(left(coalesce(p->>'utm',''), 300), ''),
          jsonb_build_object('page', left(coalesce(p->>'page',''), 200), 'at', now()))
  returning id into v_id;
  perform public.hr_notify('🧑‍💼 Відгук на вакансію' || coalesce(': ' || v_vac.title, ' (без вакансії — кадровий резерв)') || E'\n\n'
    || '👤 ' || v_name || E'\n📞 ' || v_phone
    || coalesce(E'\n🏙 ' || nullif(btrim(p->>'city'), ''), '')
    || coalesce(E'\n\n' || left(nullif(btrim(p->>'about'), ''), 800), '')
    || E'\n\nВідкрити: https://app.moduler.pro/?s=hr-hiring');
  return jsonb_build_object('ok', true);
end $$;

-- ── Тести: відкрити за посиланням (кандидат) або почати (працівник) ───────────
create or replace function public.hr_test_open(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.hr_attempts; t public.hr_tests; v_who text; q jsonb;
begin
  select * into a from public.hr_attempts where token = p_token;
  if not found then return jsonb_build_object('ok', false, 'error', 'Посилання на тест недійсне або застаріло'); end if;
  select * into t from public.hr_tests where id = a.test_id;
  select coalesce(split_part(c.full_name, ' ', 1), '') into v_who from public.hr_candidates c where c.id = a.candidate_id;
  if v_who is null or v_who = '' then select split_part(m.name, ' ', 1) into v_who from public.task_members m where m.id = a.member_id; end if;
  if a.status in ('done','checked') then
    return jsonb_build_object('ok', true, 'done', true, 'title', t.title, 'who', v_who);
  end if;
  if a.started_at is null then
    update public.hr_attempts set started_at = now(), status = 'started' where id = a.id returning * into a;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'kind', x.kind, 'text', x.text, 'options', x.options, 'points', x.points) order by x.sort, x.id), '[]')
    into q from public.hr_questions x where x.test_id = t.id;
  return jsonb_build_object('ok', true, 'done', false, 'title', t.title, 'descr', t.descr, 'minutes', t.minutes,
    'started_at', a.started_at, 'now', now(), 'who', v_who, 'member', a.member_id is not null, 'questions', q, 'answers', a.answers);
end $$;

create or replace function public.hr_test_begin(p_test uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := public.current_member_id(); v_tok text;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'Тест доступний учасникам команди'); end if;
  if not exists (select 1 from public.hr_tests where id = p_test and active) then return jsonb_build_object('ok', false, 'error', 'Тест не знайдено'); end if;
  select token into v_tok from public.hr_attempts where test_id = p_test and member_id = v_me and status in ('sent','started') order by created_at desc limit 1;
  if v_tok is null then
    insert into public.hr_attempts (test_id, member_id, sent_by) values (p_test, v_me, 'сам') returning token into v_tok;
  end if;
  return jsonb_build_object('ok', true, 'token', v_tok);
end $$;

-- зберегти відповіді й порахувати бали; відкриті питання чекають перевірки HR
create or replace function public.hr_test_submit(p_token text, p_answers jsonb, p_final boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.hr_attempts; t public.hr_tests; x record;
  v_auto numeric := 0; v_max numeric := 0; v_auto_max numeric := 0; v_open boolean := false;
  v_given jsonb; v_ok boolean; v_review jsonb := '[]'; v_pct numeric; v_who text;
begin
  select * into a from public.hr_attempts where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Посилання на тест недійсне'); end if;
  if a.status in ('done','checked') then return jsonb_build_object('ok', true, 'done', true); end if;
  if jsonb_typeof(p_answers) <> 'object' or octet_length(p_answers::text) > 60000 then return jsonb_build_object('ok', false, 'error', 'Некоректні відповіді'); end if;
  if not p_final then -- проміжне збереження: людина не втратить відповіді, якщо закриє вкладку
    update public.hr_attempts set answers = p_answers where id = a.id;
    return jsonb_build_object('ok', true, 'saved', true);
  end if;
  select * into t from public.hr_tests where id = a.test_id;
  for x in select * from public.hr_questions where test_id = a.test_id order by sort, id loop
    v_max := v_max + x.points;
    v_given := p_answers -> x.id::text;
    if x.kind = 'open' then
      v_open := true;
      v_review := v_review || jsonb_build_object('id', x.id, 'open', true, 'explain', x.explain);
    else
      v_auto_max := v_auto_max + x.points;
      v_ok := jsonb_typeof(v_given) = 'array'
        and (select coalesce(array_agg(e::int order by e::int), '{}') from jsonb_array_elements_text(v_given) e)
          = (select coalesce(array_agg(e::int order by e::int), '{}') from jsonb_array_elements_text(x.correct) e);
      if v_ok then v_auto := v_auto + x.points; end if;
      v_review := v_review || jsonb_build_object('id', x.id, 'ok', v_ok, 'correct', x.correct, 'explain', x.explain);
    end if;
  end loop;
  v_pct := case when v_open then (case when v_auto_max > 0 then round(v_auto / v_auto_max * 100) end) else (case when v_max > 0 then round(v_auto / v_max * 100) end) end;
  update public.hr_attempts set answers = p_answers, auto_points = v_auto, max_points = v_max, score_pct = v_pct,
    status = case when v_open then 'done' else 'checked' end,
    passed = case when v_open then null else coalesce(v_pct, 0) >= t.pass_pct end,
    finished_at = now(), checked_at = case when v_open then null else now() end,
    late = t.minutes is not null and a.started_at is not null and now() > a.started_at + make_interval(mins => t.minutes + 2)
  where id = a.id;
  if a.candidate_id is not null then
    update public.hr_candidates set score_test = v_pct where id = a.candidate_id;
    select full_name into v_who from public.hr_candidates where id = a.candidate_id;
    perform public.hr_notify('📝 Кандидат пройшов тест «' || t.title || '»' || E'\n\n👤 ' || coalesce(v_who, '—')
      || E'\nАвтоматична частина: ' || coalesce(v_pct::text || '%', '—')
      || case when v_open then E'\nЄ відкриті питання — перевірте відповіді.' else '' end
      || E'\n\nВідкрити: https://app.moduler.pro/?s=hr-hiring');
    return jsonb_build_object('ok', true, 'done', true);
  end if;
  -- працівнику — одразу розбір: де помилився і чому
  return jsonb_build_object('ok', true, 'done', true, 'pct', v_pct, 'open', v_open,
    'passed', case when v_open then null else coalesce(v_pct, 0) >= t.pass_pct end, 'pass_pct', t.pass_pct, 'review', v_review);
end $$;

-- відмітити крок адаптації (сам працівник або HR)
create or replace function public.hr_step_toggle(p_plan uuid, p_step text, p_done boolean, p_comment text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.hr_onboarding;
begin
  select * into o from public.hr_onboarding where id = p_plan for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'План не знайдено'); end if;
  if not (public.hr_can() or (o.member_id is not null and o.member_id = public.current_member_id())) then
    return jsonb_build_object('ok', false, 'error', 'Немає доступу');
  end if;
  update public.hr_onboarding set steps = (
    select coalesce(jsonb_agg(case when s->>'id' = p_step
      then s || jsonb_build_object('done_at', case when p_done then to_jsonb(now()) else 'null'::jsonb end)
             || case when p_comment is not null then jsonb_build_object('comment', p_comment) else '{}'::jsonb end
      else s end order by n), '[]')
    from jsonb_array_elements(o.steps) with ordinality as e(s, n))
  where id = p_plan;
  return jsonb_build_object('ok', true);
end $$;

-- ── Показники роботи з даних системи (угоди, задачі, сервіс, навчання) ────────
create or replace function public.hr_metrics(p_member uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  m public.task_members; v_tm uuid; v_to timestamptz := (p_to + 1)::timestamptz; v_from timestamptz := p_from::timestamptz;
  won text[] := array['договір','закупівля','виробництво','готово','здано','партнер_договір','партнер_працюємо','договір_ук','в_управлінні'];
  final text[] := array['здано','партнер_працюємо','в_управлінні'];
  r jsonb := '{}';
begin
  if not (public.hr_can() or p_member = public.current_member_id()) then return jsonb_build_object('ok', false, 'error', 'Немає доступу'); end if;
  select * into m from public.task_members where id = p_member;
  if not found then return jsonb_build_object('ok', false, 'error', 'Людину не знайдено'); end if;
  select id into v_tm from public.team_members where from_team and name = m.name limit 1;

  -- продажі: угоди, де людина відповідальна
  with d as (select d.*, s.key as sk from public.deals d left join public.pipeline_stages s on s.id = d.stage_id where v_tm is not null and d.owner_id = v_tm),
  first_touch as (
    select d.id, d.created_at, (select min(a.created_at) from public.deal_activities a where a.deal_id = d.id) as first_at
    from d where d.created_at >= v_from and d.created_at < v_to)
  select r || jsonb_build_object(
    'deals_open', (select count(*) from d where coalesce(sk, '') <> all(final)),
    'deals_new', (select count(*) from d where created_at >= v_from and created_at < v_to),
    'deals_won', (select count(*) from d where sk = any(won) and updated_at >= v_from and updated_at < v_to),
    'deals_no_next', (select count(*) from d where coalesce(sk, '') <> all(final) and next_action_at is null),
    'deals_overdue', (select count(*) from d where coalesce(sk, '') <> all(final) and next_action_at < now()),
    'deals_stale', (select count(*) from d where coalesce(sk, '') <> all(final) and updated_at < now() - interval '14 days'),
    'activities', (select count(*) from public.deal_activities a join d on d.id = a.deal_id where a.created_at >= v_from and a.created_at < v_to),
    'first_touch_hours', (select round(avg(extract(epoch from first_at - created_at) / 3600)::numeric, 1) from first_touch where first_at is not null),
    'untouched', (select count(*) from first_touch where first_at is null)
  ) into r;

  -- задачі пульту
  select r || jsonb_build_object(
    'tasks_done', count(*) filter (where t.done_at >= v_from and t.done_at < v_to),
    'tasks_done_late', count(*) filter (where t.done_at >= v_from and t.done_at < v_to and t.due is not null and t.done_at::date > t.due),
    'tasks_overdue', count(*) filter (where t.status <> 'done' and t.due < current_date),
    'tasks_open', count(*) filter (where t.status <> 'done'))
  into r from public.tasks t where t.owner_id = p_member;

  -- сервіс: заявки по об'єктах в управлінні
  select r || jsonb_build_object(
    'req_done', count(*) filter (where q.done_at >= v_from and q.done_at < v_to),
    'req_overdue', count(*) filter (where q.done_at is null and q.due < current_date),
    'req_open', count(*) filter (where q.done_at is null),
    'req_hours', round((avg(extract(epoch from q.done_at - q.created_at) / 3600) filter (where q.done_at >= v_from and q.done_at < v_to))::numeric, 1))
  into r from public.service_requests q where q.assignee_id = p_member;

  -- навчання: обов'язкові курси посади, уроки, тести
  select r || jsonb_build_object(
    'lessons_total', (select count(*) from public.hr_lessons l join public.hr_courses c on c.id = l.course_id
                       where c.active and c.required and (cardinality(c.role_keys) = 0 or m.hr_role = any(c.role_keys))),
    'lessons_done', (select count(*) from public.hr_progress p join public.hr_lessons l on l.id = p.lesson_id join public.hr_courses c on c.id = l.course_id
                       where p.member_id = p_member and c.active and c.required and (cardinality(c.role_keys) = 0 or m.hr_role = any(c.role_keys))),
    'tests_passed', (select count(distinct test_id) from public.hr_attempts where member_id = p_member and passed),
    'test_avg', (select round(avg(score_pct)) from public.hr_attempts where member_id = p_member and status = 'checked' and finished_at >= v_from and finished_at < v_to))
  into r;

  return jsonb_build_object('ok', true, 'member', p_member, 'role', m.hr_role, 'from', p_from, 'to', p_to, 'values', r);
end $$;

revoke all on function public.hr_can(), public.hr_notify(text), public.hr_test_begin(uuid), public.hr_step_toggle(uuid, text, boolean, text),
  public.hr_metrics(uuid, date, date), public.hr_set_role(uuid, text) from public, anon;
grant execute on function public.hr_can(), public.hr_test_begin(uuid), public.hr_step_toggle(uuid, text, boolean, text),
  public.hr_metrics(uuid, date, date), public.hr_set_role(uuid, text) to authenticated;
revoke all on function public.hr_notify(text) from authenticated;
grant execute on function public.hr_apply(jsonb), public.hr_test_open(text), public.hr_test_submit(text, jsonb, boolean) to anon, authenticated;

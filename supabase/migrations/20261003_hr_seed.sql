-- Кадровий модуль: службові функції поверх 20261003_hr_system.sql.
-- Стартовий вміст (5 посад, 6 курсів із 31 уроком, 11 тестів зі 113 питаннями) залито в базу викликами
--   select public.hr_seed('{"roles":[…],"courses":[…],"tests":[…]}'::jsonb);
-- далі він редагується в системі («Люди: найм і розвиток»), тож джерело правди — база.

-- вступ до тесту: назва, час, кількість питань — без запуску відліку (відлік стартує в hr_test_open після «Почати»)
create or replace function public.hr_test_peek(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare a public.hr_attempts; t public.hr_tests; v_who text;
begin
  select * into a from public.hr_attempts where token = p_token;
  if not found then return jsonb_build_object('ok', false, 'error', 'Посилання на тест недійсне або застаріло'); end if;
  select * into t from public.hr_tests where id = a.test_id;
  select split_part(c.full_name, ' ', 1) into v_who from public.hr_candidates c where c.id = a.candidate_id;
  if v_who is null or v_who = '' then select split_part(m.name, ' ', 1) into v_who from public.task_members m where m.id = a.member_id; end if;
  return jsonb_build_object('ok', true, 'title', t.title, 'descr', t.descr, 'minutes', t.minutes,
    'count', (select count(*) from public.hr_questions x where x.test_id = t.id),
    'who', v_who, 'member', a.member_id is not null,
    'started', a.started_at is not null, 'done', a.status in ('done','checked'));
end $$;
revoke all on function public.hr_test_peek(text) from public;
grant execute on function public.hr_test_peek(text) to anon, authenticated;

-- Завантаження вмісту: посади й курси оновлюються за ключем; уроки й питання додаються лише якщо їх ще немає
-- (щоб повторний виклик не стер прогрес людей і правки, зроблені в системі).
create or replace function public.hr_seed(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare x jsonb; y jsonb; v_id uuid; i int; n_roles int := 0; n_courses int := 0; n_lessons int := 0; n_tests int := 0; n_q int := 0;
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and not public.hr_can() then raise exception 'Немає доступу'; end if;
  for x in select * from jsonb_array_elements(coalesce(p->'roles', '[]')) loop
    insert into public.hr_roles (key, name, direction, mission, outcomes, competencies, kpis, must_have, red_flags, screening, interview, case_task, qa_checklist, onboarding, job_ad, sort)
    values (x->>'key', x->>'name', x->>'direction', x->>'mission', coalesce(x->'outcomes','[]'), coalesce(x->'competencies','[]'), coalesce(x->'kpis','[]'),
            coalesce(x->'must_have','[]'), coalesce(x->'red_flags','[]'), coalesce(x->'screening','[]'), coalesce(x->'interview','[]'), x->>'case_task',
            coalesce(x->'qa_checklist','[]'), coalesce(x->'onboarding','[]'), x->>'job_ad', coalesce((x->>'sort')::int, 0))
    on conflict (key) do update set name = excluded.name, direction = excluded.direction, mission = excluded.mission, outcomes = excluded.outcomes,
      competencies = excluded.competencies, kpis = excluded.kpis, must_have = excluded.must_have, red_flags = excluded.red_flags, screening = excluded.screening,
      interview = excluded.interview, case_task = excluded.case_task, qa_checklist = excluded.qa_checklist, onboarding = excluded.onboarding,
      job_ad = excluded.job_ad, sort = excluded.sort, updated_at = now();
    n_roles := n_roles + 1;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p->'courses', '[]')) loop
    insert into public.hr_courses (key, title, descr, icon, role_keys, level, required, sort)
    values (x->>'key', x->>'title', x->>'descr', x->>'icon', array(select jsonb_array_elements_text(coalesce(x->'role_keys','[]'))),
            coalesce(x->>'level','base'), coalesce((x->>'required')::boolean, false), coalesce((x->>'sort')::int, 0))
    on conflict (key) do update set title = excluded.title, descr = excluded.descr, icon = excluded.icon, role_keys = excluded.role_keys,
      level = excluded.level, required = excluded.required, sort = excluded.sort
    returning id into v_id;
    n_courses := n_courses + 1;
    if not exists (select 1 from public.hr_lessons where course_id = v_id) then
      i := 0;
      for y in select * from jsonb_array_elements(coalesce(x->'lessons', '[]')) loop
        insert into public.hr_lessons (course_id, title, body, video_url, minutes, sort)
        values (v_id, y->>'title', y->>'body', y->>'video_url', (y->>'minutes')::int, i);
        i := i + 1; n_lessons := n_lessons + 1;
      end loop;
    end if;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p->'tests', '[]')) loop
    insert into public.hr_tests (key, title, descr, kind, role_keys, course_id, pass_pct, minutes, sort)
    values (x->>'key', x->>'title', x->>'descr', coalesce(x->>'kind','course'), array(select jsonb_array_elements_text(coalesce(x->'role_keys','[]'))),
            (select id from public.hr_courses where key = x->>'course'), coalesce((x->>'pass_pct')::int, 80), (x->>'minutes')::int, coalesce((x->>'sort')::int, 0))
    on conflict (key) do update set title = excluded.title, descr = excluded.descr, kind = excluded.kind, role_keys = excluded.role_keys,
      course_id = excluded.course_id, pass_pct = excluded.pass_pct, minutes = excluded.minutes, sort = excluded.sort
    returning id into v_id;
    n_tests := n_tests + 1;
    if not exists (select 1 from public.hr_questions where test_id = v_id) then
      i := 0;
      for y in select * from jsonb_array_elements(coalesce(x->'questions', '[]')) loop
        insert into public.hr_questions (test_id, kind, text, options, correct, explain, comp, points, sort)
        values (v_id, coalesce(y->>'kind','single'), y->>'text', coalesce(y->'options','[]'), coalesce(y->'correct','[]'), y->>'explain', y->>'comp',
                coalesce((y->>'points')::numeric, 1), i);
        i := i + 1; n_q := n_q + 1;
      end loop;
    end if;
  end loop;
  return jsonb_build_object('roles', n_roles, 'courses', n_courses, 'lessons', n_lessons, 'tests', n_tests, 'questions', n_q);
end $$;
revoke all on function public.hr_seed(jsonb) from public, anon;
grant execute on function public.hr_seed(jsonb) to authenticated;

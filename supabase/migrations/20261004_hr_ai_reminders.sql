-- Кадри: 1) оцінка відкритих відповідей тестів ШІ (edge-функція hr-ai), 2) щоденні нагадування в Telegram
-- про прострочені кроки адаптації та кандидатів, що «зависли».

-- що сказав ШІ про спробу: { grades: { <питання>: { points, why } }, summary, model, at } або { error, at }
alter table public.hr_attempts add column if not exists ai jsonb;

-- після здачі тесту з відкритими питаннями — попросити hr-ai оцінити їх (у фоні, без очікування)
create or replace function public.hr_ai_kick(p_attempt uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  select value into k from public.app_secrets where key = 'cron_secret';
  if k is null then return; end if;
  perform net.http_get(url := 'https://uaufrrpfvixhprqhqjzo.supabase.co/functions/v1/hr-ai?action=grade&attempt=' || p_attempt || '&key=' || k);
exception when others then raise warning 'hr_ai_kick: %', sqlerrm;
end $$;
revoke all on function public.hr_ai_kick(uuid) from public, anon, authenticated;

-- зберегти відповіді й порахувати бали; відкриті питання одразу йдуть на оцінку ШІ (людина може її змінити)
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
  if not p_final then
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
  if v_open then perform public.hr_ai_kick(a.id); end if;
  if a.candidate_id is not null then
    update public.hr_candidates set score_test = v_pct where id = a.candidate_id;
    select full_name into v_who from public.hr_candidates where id = a.candidate_id;
    perform public.hr_notify('📝 Кандидат пройшов тест «' || t.title || '»' || E'\n\n👤 ' || coalesce(v_who, '—')
      || E'\nПитання з варіантами: ' || coalesce(v_pct::text || '%', '—')
      || case when v_open then E'\nВідкриті відповіді оцінює ШІ — підсумок прийде окремим повідомленням. Якщо не прийде — перевірте відповіді самі.' else '' end
      || E'\n\nВідкрити: https://app.moduler.pro/?s=hr-hiring');
    return jsonb_build_object('ok', true, 'done', true);
  end if;
  return jsonb_build_object('ok', true, 'done', true, 'pct', v_pct, 'open', v_open,
    'passed', case when v_open then null else coalesce(v_pct, 0) >= t.pass_pct end, 'pass_pct', t.pass_pct, 'review', v_review);
end $$;

-- перші n рядків списку + «і ще k»
create or replace function public.hr_lines(a text[], n int) returns text
language sql immutable set search_path = '' as $$
  select case when a is null or cardinality(a) = 0 then null
    else array_to_string(a[1:n], E'\n') || case when cardinality(a) > n then E'\n… і ще ' || (cardinality(a) - n) else '' end end;
$$;

-- Щоденні нагадування (будні, 09:00 за Києвом):
--   новачку — прострочені кроки плану адаптації й те, що за планом сьогодні;
--   наставнику — прострочене в підопічних і контрольні точки, яким настав час;
--   тим, хто веде найм (засновник, hr_admin), — кандидати без відповіді й без руху, тести без перевірки, наступні кроки на сьогодні, плани без наставника.
-- p_dry — нічого не надсилати, лише повернути тексти; p_force — надіслати зараз, не чекаючи 9-ї години.
create or replace function public.hr_remind(p_dry boolean default false, p_force boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Europe/Kyiv')::date;
  v_hour int := extract(hour from (now() at time zone 'Europe/Kyiv'));
  self_msg jsonb := '{}';
  mentor_msg jsonb := '{}';
  hr_onb text := '';
  hr_txt text := '';
  o record; m record; v_day int; v_name text; v_base text; v_detail text; v_flags text;
  a_over text[]; a_today text[]; a_check text[]; a text[]; t text; sent jsonb := '[]';
begin
  if not p_dry and not p_force and v_hour <> 9 then
    return jsonb_build_object('skipped', true, 'kyiv_hour', v_hour);
  end if;

  -- 1. адаптація
  for o in
    select p.id, p.member_id, p.mentor_id, p.person, p.start_date, p.steps,
           mm.name as mname, mt.tg_user_id as ttg, r.name as rname
    from public.hr_onboarding p
    left join public.task_members mm on mm.id = p.member_id and mm.active
    left join public.task_members mt on mt.id = p.mentor_id and mt.active
    left join public.hr_roles r on r.id = p.role_id
    where p.status in ('active', 'extended') and p.start_date <= v_today
    order by p.start_date
  loop
    v_day := v_today - o.start_date + 1;
    v_name := coalesce(o.mname, o.person, 'новачок');
    select array_agg('• ' || (x->>'title') || ' (день ' || (x->>'day') || ')' order by (x->>'day')::int) filter (where (x->>'day')::int < v_day and coalesce(x->>'kind', '') <> 'check'),
           array_agg('• ' || (x->>'title') order by (x->>'day')::int) filter (where (x->>'day')::int = v_day),
           array_agg('• ' || (x->>'title') || ' (день ' || (x->>'day') || ')' order by (x->>'day')::int) filter (where (x->>'day')::int <= v_day and x->>'kind' = 'check')
      into a_over, a_today, a_check
      from jsonb_array_elements(o.steps) x
     where x->>'done_at' is null and (x->>'day') ~ '^[0-9]+$';

    if o.member_id is not null and (a_over is not null or a_today is not null) then
      self_msg := self_msg || jsonb_build_object(o.member_id::text,
        '🧭 Ваш план адаптації — день ' || v_day
        || coalesce(E'\n\nПрострочено:\n' || public.hr_lines(a_over, 6), '')
        || coalesce(E'\n\nСьогодні за планом:\n' || public.hr_lines(a_today, 6), '')
        || E'\n\nВідмітити зроблене: https://app.moduler.pro/?s=hr-me');
    end if;

    v_base := '👤 ' || v_name || coalesce(' — ' || o.rname, '') || ', день ' || v_day;
    v_detail := coalesce(E'\nПрострочено кроків: ' || cardinality(a_over) || E'\n' || public.hr_lines(a_over, 4), '')
             || coalesce(E'\nЧас контрольної точки:\n' || public.hr_lines(a_check, 3), '');
    v_flags := concat_ws('; ',
      case when o.member_id is null then 'людину не прив’язано до команди — вона не бачить своїх кроків' end,
      case when o.mentor_id is null then 'немає наставника' when o.ttg is null then 'наставник не підключений до бота' end);
    if v_detail <> '' and o.mentor_id is not null and o.ttg is not null then
      mentor_msg := mentor_msg || jsonb_build_object(o.mentor_id::text, coalesce(mentor_msg->>(o.mentor_id::text) || E'\n\n', '') || v_base || v_detail);
    end if;
    if v_flags <> '' or (v_detail <> '' and (o.mentor_id is null or o.ttg is null)) then
      hr_onb := hr_onb || v_base || case when o.mentor_id is null or o.ttg is null then v_detail else '' end
             || case when v_flags <> '' then E'\n⚠ ' || v_flags else '' end || E'\n\n';
    end if;
  end loop;

  -- 2. кандидати
  select array_agg('• ' || c.full_name || coalesce(' — ' || v.title, '') || ' (' || (v_today - (c.stage_at at time zone 'Europe/Kyiv')::date) || ' дн.)' order by c.stage_at)
    into a from public.hr_candidates c left join public.hr_vacancies v on v.id = c.vacancy_id
   where c.stage = 'new' and c.stage_at < now() - interval '2 days';
  if a is not null then hr_txt := hr_txt || '📥 Нові відгуки без відповіді понад 2 дні (' || cardinality(a) || E'):\n' || public.hr_lines(a, 8) || E'\n\n'; end if;

  select array_agg('• ' || c.full_name || ' — «' || case c.stage when 'screen' then 'Скринінг' when 'test' then 'Тест' when 'interview' then 'Співбесіда'
           when 'task' then 'Завдання' when 'reference' then 'Рекомендації' else 'Пропозиція' end || '», ' || (v_today - (c.stage_at at time zone 'Europe/Kyiv')::date) || ' дн.' order by c.stage_at)
    into a from public.hr_candidates c
   where c.stage in ('screen', 'test', 'interview', 'task', 'reference', 'offer') and c.stage_at < now() - interval '5 days';
  if a is not null then hr_txt := hr_txt || '⏳ Без руху понад 5 днів (' || cardinality(a) || E'):\n' || public.hr_lines(a, 8) || E'\n\n'; end if;

  select array_agg('• ' || c.full_name || ' — «' || t2.title || '»' order by ta.finished_at)
    into a from public.hr_attempts ta join public.hr_candidates c on c.id = ta.candidate_id join public.hr_tests t2 on t2.id = ta.test_id
   where ta.status = 'done' and ta.finished_at < now() - interval '1 hour';
  if a is not null then hr_txt := hr_txt || '📝 Тести чекають вашої перевірки (' || cardinality(a) || E'):\n' || public.hr_lines(a, 8) || E'\n\n'; end if;

  select array_agg('• ' || c.full_name || ' — надіслано ' || to_char(ta.created_at at time zone 'Europe/Kyiv', 'DD.MM') order by ta.created_at)
    into a from public.hr_attempts ta join public.hr_candidates c on c.id = ta.candidate_id
   where ta.status = 'sent' and ta.created_at < now() - interval '3 days' and c.stage not in ('hired', 'rejected', 'reserve');
  if a is not null then hr_txt := hr_txt || '✉️ Кандидати не відкрили тест понад 3 дні (' || cardinality(a) || E'):\n' || public.hr_lines(a, 8) || E'\n\n'; end if;

  select array_agg('• ' || c.full_name || coalesce(' — ' || nullif(c.next_note, ''), '') || case when (c.next_at at time zone 'Europe/Kyiv')::date < v_today then ' (було на ' || to_char(c.next_at at time zone 'Europe/Kyiv', 'DD.MM') || ')' else '' end order by c.next_at)
    into a from public.hr_candidates c
   where c.next_at is not null and (c.next_at at time zone 'Europe/Kyiv')::date <= v_today and c.stage not in ('hired', 'rejected', 'reserve');
  if a is not null then hr_txt := hr_txt || '📌 Наступні кроки з кандидатами на сьогодні (' || cardinality(a) || E'):\n' || public.hr_lines(a, 8) || E'\n\n'; end if;

  if hr_txt <> '' then hr_txt := hr_txt || E'Кандидати: https://app.moduler.pro/?s=hr-hiring\n\n'; end if;
  if hr_onb <> '' then hr_txt := hr_txt || E'🧭 Адаптація:\n\n' || hr_onb || E'Плани: https://app.moduler.pro/?s=hr-onboarding'; end if;
  if hr_txt <> '' then hr_txt := E'🎓 Найм і адаптація — що потребує уваги сьогодні\n\n' || btrim(hr_txt, E'\n'); end if;

  -- 3. розсилка: одній людині — одне повідомлення
  for m in select id, name, (is_owner or hr_admin) as is_hr from public.task_members where active and tg_user_id is not null order by sort loop
    t := concat_ws(E'\n\n— — —\n\n',
      self_msg->>(m.id::text),
      case when mentor_msg ? (m.id::text) then E'🧭 Адаптація ваших підопічних\n\n' || (mentor_msg->>(m.id::text)) || E'\n\nПлани: https://app.moduler.pro/?s=hr-onboarding' end,
      case when m.is_hr and hr_txt <> '' then hr_txt end);
    if coalesce(t, '') <> '' then
      t := left(t, 3900);
      if not p_dry then perform public.pult_tg(m.id, t); end if;
      sent := sent || jsonb_build_object('to', m.name, 'text', t);
    end if;
  end loop;
  return jsonb_build_object('dry', p_dry, 'sent', jsonb_array_length(sent), 'messages', sent);
end $$;
revoke all on function public.hr_remind(boolean, boolean) from public, anon, authenticated;
revoke all on function public.hr_lines(text[], int) from public, anon;

-- розклад: будні, 06:10 і 07:10 UTC — функція сама пропускає запуск, якщо в Києві не 9-та година (літній / зимовий час)
select cron.schedule('hr-remind', '10 6,7 * * 1-5', $c$select public.hr_remind()$c$);
-- раз на годину: дооцінити тести, які ШІ не встиг або не зміг оцінити одразу
select cron.schedule('hr-ai-sweep', '20 * * * *', $c$select net.http_get('https://uaufrrpfvixhprqhqjzo.supabase.co/functions/v1/hr-ai?action=sweep&key=' || (select value from public.app_secrets where key = 'cron_secret'))$c$);

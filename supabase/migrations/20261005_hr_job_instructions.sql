-- Кадри: посадові інструкції. Інструкція посади лежить у профілі (hr_roles.instruction), особисті доповнення
-- для конкретної людини — в hr_member_instr. Раз на місяць edge-функція hr-ai (action=instr) дивиться, що людина
-- справді робила, і які правила затверджено в базі знань, та пропонує, що дописати (hr_instr_updates).
-- Пропозицію приймає чи відхиляє той, хто веде найм: сама собою інструкція не змінюється.

-- { reports_to, leads, substitute, duties: [{ area, text, rhythm, added }], rights: [text], responsibility: [text],
--   interactions: [{ who, what }], rev_at }
alter table public.hr_roles add column if not exists instruction jsonb not null default '{}'::jsonb;

create table if not exists public.hr_member_instr (
  member_id uuid primary key references public.task_members(id) on delete cascade,
  scope text,                                  -- особиста зона: об'єкт, майданчик, регіон
  duties jsonb not null default '[]'::jsonb,   -- понад інструкцію посади: [{ area, text, rhythm, added }]
  reviewed_period text,                        -- за який місяць ШІ вже переглянув роботу (РРРР-ММ)
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.hr_member_instr enable row level security;

create table if not exists public.hr_instr_updates (
  id uuid primary key default gen_random_uuid(),
  role_key text not null,
  member_id uuid references public.task_members(id) on delete cascade,   -- з чиєї роботи взято пропозицію
  scope text not null default 'role' check (scope in ('role', 'person')), -- дописати в посаду чи особисто людині
  area text,
  text text not null,
  rhythm text,
  reason text,
  period text,
  source text not null default 'ai',
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected')),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text
);
create index if not exists hr_instr_updates_status_idx on public.hr_instr_updates (status, role_key);
alter table public.hr_instr_updates enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'hr_member_instr' and policyname = 'hr_member_instr_read') then
    create policy hr_member_instr_read on public.hr_member_instr for select to authenticated
      using ((select public.hr_can()) or exists (select 1 from public.task_members m
                                                  where m.id = member_id and m.active and lower(m.email) = lower(auth.jwt() ->> 'email')));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'hr_member_instr' and policyname = 'hr_member_instr_write') then
    create policy hr_member_instr_write on public.hr_member_instr for all to authenticated
      using ((select public.hr_can())) with check ((select public.hr_can()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'hr_instr_updates' and policyname = 'hr_instr_updates_hr') then
    create policy hr_instr_updates_hr on public.hr_instr_updates for all to authenticated
      using ((select public.hr_can())) with check ((select public.hr_can()));
  end if;
end $$;

-- завантаження інструкцій з ноутбука (kb-sync → hr_instr). Уже заповнену інструкцію не перезаписує без force:
-- після завантаження її правлять на порталі.
create or replace function public.hr_instr_seed(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare x jsonb; n int := 0; skipped int := 0; missing text[] := '{}';
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and not public.hr_can() then raise exception 'Немає доступу'; end if;
  for x in select * from jsonb_array_elements(coalesce(p->'roles', '[]')) loop
    if not exists (select 1 from public.hr_roles where key = x->>'key') then
      missing := missing || (x->>'key');
    elsif coalesce((p->>'force')::boolean, false) or exists (select 1 from public.hr_roles where key = x->>'key' and instruction = '{}'::jsonb) then
      update public.hr_roles set instruction = x->'instruction', updated_at = now() where key = x->>'key';
      n := n + 1;
    else
      skipped := skipped + 1;
    end if;
  end loop;
  return jsonb_build_object('set', n, 'kept', skipped, 'missing', to_jsonb(missing));
end $$;
revoke all on function public.hr_instr_seed(jsonb) from public, anon;

-- рішення щодо пропозиції: прийняти (дописати в посаду чи особисто людині) або відхилити
create or replace function public.hr_instr_decide(p_id uuid, p_ok boolean, p_scope text default null, p_text text default null,
                                                  p_area text default null, p_rhythm text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u public.hr_instr_updates; v_scope text; v_duty jsonb; v_who text;
begin
  if not public.hr_can() then return jsonb_build_object('ok', false, 'error', 'Немає доступу'); end if;
  select * into u from public.hr_instr_updates where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Пропозицію не знайдено'); end if;
  if u.status <> 'proposed' then return jsonb_build_object('ok', false, 'error', 'Рішення вже ухвалено'); end if;
  select name into v_who from public.task_members where active and lower(email) = lower(auth.jwt() ->> 'email') limit 1;
  if p_ok then
    v_scope := coalesce(nullif(p_scope, ''), u.scope);
    if v_scope = 'person' and u.member_id is null then v_scope := 'role'; end if;
    v_duty := jsonb_build_object('area', coalesce(nullif(btrim(p_area), ''), u.area, 'Інше'), 'text', coalesce(nullif(btrim(p_text), ''), u.text),
                                 'rhythm', coalesce(nullif(p_rhythm, ''), u.rhythm), 'added', to_char(now() at time zone 'Europe/Kyiv', 'YYYY-MM-DD'));
    if v_scope = 'person' then
      insert into public.hr_member_instr (member_id, duties) values (u.member_id, jsonb_build_array(v_duty))
      on conflict (member_id) do update set duties = public.hr_member_instr.duties || v_duty, updated_at = now();
    else
      update public.hr_roles
         set instruction = jsonb_set(jsonb_set(instruction, '{duties}', coalesce(instruction->'duties', '[]'::jsonb) || v_duty),
                                     '{rev_at}', to_jsonb(to_char(now() at time zone 'Europe/Kyiv', 'YYYY-MM-DD'))),
             updated_at = now()
       where key = u.role_key;
    end if;
    update public.hr_instr_updates set status = 'accepted', scope = v_scope, text = v_duty->>'text', area = v_duty->>'area', rhythm = v_duty->>'rhythm',
           decided_at = now(), decided_by = coalesce(v_who, 'HR') where id = p_id;
  else
    update public.hr_instr_updates set status = 'rejected', decided_at = now(), decided_by = coalesce(v_who, 'HR') where id = p_id;
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.hr_instr_decide(uuid, boolean, text, text, text, text) from public, anon;

-- перші п'ять днів місяця, щогодини в робочий час: hr-ai бере по кілька людей за раз, доки не перегляне всіх
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'hr-instr') then
    perform cron.schedule('hr-instr', '40 6-15 1-5 * *',
      $c$select net.http_get('https://uaufrrpfvixhprqhqjzo.supabase.co/functions/v1/hr-ai?action=instr&key=' || (select value from public.app_secrets where key = 'cron_secret'))$c$);
  end if;
end $$;

-- Ринкові розцінки на роботи (rabotniki.ua): мін / середня / макс за кожен вид робіт — по Україні й по містах,
-- і кошторис робіт на будинок: скільки це коштує на ринку, за нашими ставками, акордом і на зарплаті.
-- Обхід: tools/work-rates, сервер — /api/work-rates/run, раз на тиждень (pg_cron work-rates-weekly).

create table if not exists public.work_categories (
  slug text primary key,                 -- категорія на rabotniki.ua
  name text not null,
  stage text not null,                   -- наш етап: Каркас і теплий контур, Інженерія …
  sort integer not null default 0,
  enabled boolean not null default true
);

create table if not exists public.work_cities (
  slug text primary key,                 -- '' — вся Україна
  name text not null,
  sort integer not null default 0,
  enabled boolean not null default true,
  checked_at timestamptz                 -- коли востаннє обходили (черга обходу — найстаріші першими)
);

create table if not exists public.work_rates (
  id uuid primary key default gen_random_uuid(),
  category text not null references public.work_categories(slug) on update cascade,
  work text not null,                    -- вид робіт на сайті
  name text not null,
  unit text,
  city text not null default '',
  offers integer,
  price_min numeric,
  price_max numeric,
  price_avg numeric,
  prev_avg numeric,
  url text,
  updated_at timestamptz not null default now(),
  changed_at timestamptz not null default now(),
  unique (category, work, city)
);
create index if not exists work_rates_city_idx on public.work_rates (city);

create table if not exists public.work_estimates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null default '',
  paid_lump numeric,                     -- скільки фактично платимо за будинок акордом
  staff_count numeric,                   -- варіант «на зарплаті»: людей,
  staff_salary numeric,                  -- зарплата на руки за місяць,
  houses_per_month numeric,              -- будинків за місяць,
  payroll_tax_pct numeric not null default 22, -- нарахування на зарплату, %
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.work_estimate_lines (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.work_estimates(id) on delete cascade,
  category text,                         -- привʼязка до ринкової роботи; порожньо — своя робота без ринкової ціни
  work text,
  name text not null,
  unit text,
  qty numeric not null default 0,
  our_rate numeric,                      -- наша ставка за одиницю
  sort integer not null default 0
);

alter table public.work_categories enable row level security;
alter table public.work_cities enable row level security;
alter table public.work_rates enable row level security;
alter table public.work_estimates enable row level security;
alter table public.work_estimate_lines enable row level security;

create policy work_categories_select on public.work_categories for select to authenticated using (true);
create policy work_categories_write on public.work_categories for all to authenticated
  using ((select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role]))
  with check ((select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role]));
create policy work_cities_select on public.work_cities for select to authenticated using (true);
create policy work_cities_write on public.work_cities for all to authenticated
  using ((select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role]))
  with check ((select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role]));
create policy work_rates_select on public.work_rates for select to authenticated using (true);
-- кошториси містять наші ставки й зарплати — партнерам не показуємо
create policy work_estimates_all on public.work_estimates for all to authenticated
  using ((select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role, 'accountant'::user_role]))
  with check ((select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role, 'accountant'::user_role]));
create policy work_estimate_lines_all on public.work_estimate_lines for all to authenticated
  using ((select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role, 'accountant'::user_role]))
  with check ((select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role, 'accountant'::user_role]));

-- rpc для обходу (той самий токен, що й у парсера цін)
create or replace function public.work_rates_config(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
begin
  perform price_parser_check(p_token);
  return jsonb_build_object(
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'name', name) order by sort), '[]'::jsonb) from work_categories where enabled),
    'cities', (select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'checked_at', checked_at) order by checked_at nulls first, sort), '[]'::jsonb) from work_cities where enabled)
  );
end $$;

-- p: { city, complete, rows: [{ category, work, name, unit, offers, min, max, avg, url }] }
create or replace function public.work_rates_ingest(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare n integer := 0; v_city text := coalesce(p->>'city', ''); v_now timestamptz := clock_timestamp();
begin
  perform price_parser_check(p_token);
  with src as (
    select distinct on (r->>'category', r->>'work')
           r->>'category' as category, r->>'work' as work, left(r->>'name', 300) as name, r->>'unit' as unit,
           (r->>'offers')::integer as offers, (r->>'min')::numeric as price_min, (r->>'max')::numeric as price_max,
           (r->>'avg')::numeric as price_avg, r->>'url' as url
    from jsonb_array_elements(coalesce(p->'rows', '[]'::jsonb)) r
    where exists (select 1 from work_categories c where c.slug = r->>'category')
  ), up as (
    insert into work_rates as w (category, work, name, unit, city, offers, price_min, price_max, price_avg, url, updated_at, changed_at)
    select category, work, name, unit, v_city, offers, price_min, price_max, price_avg, url, v_now, v_now from src
    on conflict (category, work, city) do update
      set name = excluded.name, unit = excluded.unit, offers = excluded.offers, url = excluded.url,
          prev_avg = case when w.price_avg is distinct from excluded.price_avg then w.price_avg else w.prev_avg end,
          changed_at = case when w.price_avg is distinct from excluded.price_avg then v_now else w.changed_at end,
          price_min = excluded.price_min, price_max = excluded.price_max, price_avg = excluded.price_avg, updated_at = v_now
    returning 1
  )
  select count(*) into n from up;
  if coalesce((p->>'complete')::boolean, false) then
    update work_cities set checked_at = v_now where slug = v_city;
  end if;
  return jsonb_build_object('rows', n);
end $$;

grant execute on function public.work_rates_config(text) to anon, authenticated, service_role;
grant execute on function public.work_rates_ingest(text, jsonb) to anon, authenticated, service_role;

-- категорії робіт, що стосуються модульного будинку, за етапами
insert into public.work_categories (slug, name, stage, sort) values
  ('stroitelstvo-karkasnogo-doma', 'Будівництво каркасного будинку', 'Будинок під ключ (для порівняння)', 10),
  ('stolyarnye-plotnitskie-raboty', 'Столярні та теслярські роботи', 'Каркас і теплий контур', 20),
  ('metallokonstruktsii', 'Металоконструкції', 'Каркас і теплий контур', 21),
  ('svarochnye-raboty', 'Зварювальні роботи', 'Каркас і теплий контур', 22),
  ('teploizolyatsiya', 'Теплоізоляція', 'Каркас і теплий контур', 23),
  ('gidroizolyatsiya', 'Гідроізоляція', 'Каркас і теплий контур', 24),
  ('krovelnye-raboty', 'Покрівельні роботи', 'Каркас і теплий контур', 25),
  ('okna-osteklenie', 'Вікна та скління', 'Каркас і теплий контур', 26),
  ('dveri', 'Двері', 'Каркас і теплий контур', 27),
  ('fasadnye-raboty', 'Фасадні роботи', 'Оздоблення', 30),
  ('montazh-vagonki', 'Монтаж вагонки', 'Оздоблення', 31),
  ('montazh-gipsokartona', 'Монтаж гіпсокартону', 'Оздоблення', 32),
  ('stenovye-paneli', 'Стінові панелі', 'Оздоблення', 33),
  ('malyarnye-raboty', 'Малярні роботи', 'Оздоблення', 34),
  ('plitochnye-raboty', 'Плиточні роботи', 'Оздоблення', 35),
  ('chernovye-raboty-po-polu', 'Чорнові роботи по підлозі', 'Оздоблення', 36),
  ('napolnye-pokrytiya', 'Покриття для підлоги', 'Оздоблення', 37),
  ('potolki', 'Стеля', 'Оздоблення', 38),
  ('lestnitsy', 'Сходи', 'Оздоблення', 39),
  ('elektromontazhnye-raboty', 'Електромонтажні роботи', 'Інженерія', 40),
  ('santehnicheskie-raboty', 'Сантехнічні роботи', 'Інженерія', 41),
  ('sistemy-otopleniya', 'Системи опалення', 'Інженерія', 42),
  ('teplyy-pol', 'Тепла підлога', 'Інженерія', 43),
  ('sistemy-ventilyatsii', 'Системи вентиляції', 'Інженерія', 44),
  ('klimaticheskoe-oborudovanie', 'Кліматичне обладнання', 'Інженерія', 45),
  ('vodosnabzhenie-ochistka-vody', 'Водопостачання та очищення води', 'Інженерія', 46),
  ('sborka-mebeli', 'Збірка меблів', 'Меблі й наповнення', 50),
  ('ustanovka-bytovoy-tehniki', 'Установка побутової техніки', 'Меблі й наповнення', 51),
  ('zemlyanye-raboty', 'Земляні роботи', 'На ділянці: фундамент і монтаж', 60),
  ('fundament', 'Фундамент', 'На ділянці: фундамент і монтаж', 61),
  ('burovye-raboty-pod-svai-kommunikatsii', 'Бурові роботи під палі та комунікації', 'На ділянці: фундамент і монтаж', 62),
  ('betonnye-raboty', 'Бетонні роботи', 'На ділянці: фундамент і монтаж', 63),
  ('gruzoperevozki', 'Вантажоперевезення', 'На ділянці: фундамент і монтаж', 64),
  ('uslugi-gruzchikov', 'Послуги вантажників', 'На ділянці: фундамент і монтаж', 65),
  ('arenda-stroitelnoy-tehniki', 'Оренда будівельної техніки', 'На ділянці: фундамент і монтаж', 66),
  ('uslugi-raznorabochih', 'Послуги різноробочих', 'На ділянці: фундамент і монтаж', 67),
  ('septiki-vygrebnye-yamy', 'Септики і вигрібні ями', 'На ділянці: комунікації', 70),
  ('burenie-skvazhin-dlya-vody', 'Буріння свердловин для води', 'На ділянці: комунікації', 71),
  ('drenazhnye-raboty', 'Дренажні роботи', 'На ділянці: комунікації', 72),
  ('ulichnoe-osveschenie', 'Вуличне освітлення', 'На ділянці: комунікації', 73),
  ('markizy-navesy', 'Маркізи і навіси', 'На ділянці: благоустрій', 80),
  ('trotuarnaya-plitka', 'Тротуарна плитка', 'На ділянці: благоустрій', 81),
  ('ozelenenie-blagoustroystvo', 'Озеленення та благоустрій', 'На ділянці: благоустрій', 82)
on conflict (slug) do nothing;

insert into public.work_cities (slug, name, sort) values
  ('', 'Вся Україна', 0), ('kiev', 'Київ', 1), ('lvov', 'Львів', 2), ('odessa', 'Одеса', 3), ('dnepr', 'Дніпро', 4), ('harkov', 'Харків', 5),
  ('zaporozhe', 'Запоріжжя', 6), ('vinnitsa', 'Вінниця', 7), ('ivanofrankovsk', 'Івано-Франківськ', 8), ('uzhgorod', 'Ужгород', 9),
  ('chernovtsy', 'Чернівці', 10), ('ternopol', 'Тернопіль', 11), ('lutsk', 'Луцьк', 12), ('rovno', 'Рівне', 13), ('hmelnitskiy', 'Хмельницький', 14),
  ('zhitomir', 'Житомир', 15), ('cherkassy', 'Черкаси', 16), ('poltava', 'Полтава', 17), ('chernigov', 'Чернігів', 18), ('sumy', 'Суми', 19),
  ('kropivnitskiy', 'Кропивницький', 20), ('nikolaev', 'Миколаїв', 21), ('herson', 'Херсон', 22)
on conflict (slug) do nothing;

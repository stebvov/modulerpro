-- Парсер цін будматеріалів: раз на день обходить сайти магазинів і пише знайдені пропозиції
-- в market_offers, а найкращу ціну магазину — у supplier_prices (source = 'parsing').
-- Скрипт: tools/price-parser. Доступ скрипта — лише через rpc із токеном (app_secrets.price_parser_token).

-- 1. Постачальник = магазин із сайтом
alter table public.suppliers
  add column if not exists website text,
  add column if not exists parser_key text,
  add column if not exists parser_enabled boolean not null default true,
  add column if not exists parsed_at timestamptz,
  add column if not exists parse_status text;
create unique index if not exists suppliers_parser_key_key on public.suppliers (parser_key) where parser_key is not null;

-- 2. Матеріал: правило відстеження (null — парсер його не шукає)
alter table public.materials
  add column if not exists parse_rule jsonb,
  add column if not exists spec text;

-- 3. Джерела: сторінки категорій на сайтах, згруповані за видом товару
create table if not exists public.price_sources (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  grp text not null,
  url text not null,
  max_pages integer not null default 15,
  active boolean not null default true,
  note text,
  last_items integer,
  last_ok_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (supplier_id, grp, url)
);

-- 4. Пропозиції магазинів (конкретні товари), привʼязані до матеріалу
create table if not exists public.market_offers (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  url text not null,
  ext_id text,
  title text not null,
  brand text,
  attrs jsonb not null default '{}'::jsonb,
  price numeric not null check (price >= 0),      -- як продають
  sale_unit text,                                  -- шт / рулон / уп / м³ / м² / м.п.
  unit_price numeric,                              -- за одиницю матеріалу (materials.unit)
  unit_prices jsonb not null default '{}'::jsonb,  -- {"м³":…, "м²":…, "м.п.":…, "шт":…}
  in_stock boolean,
  active boolean not null default true,            -- бачили в останньому обході
  excluded boolean not null default false,         -- вручну прибрано з розрахунку
  prev_price numeric,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  price_changed_at timestamptz not null default now(),
  unique (supplier_id, material_id, url)
);
create index if not exists market_offers_material_idx on public.market_offers (material_id);

create table if not exists public.market_offer_history (
  id bigint generated always as identity primary key,
  offer_id uuid not null references public.market_offers(id) on delete cascade,
  price numeric not null,
  unit_price numeric,
  in_stock boolean,
  seen_at timestamptz not null default now()
);
create index if not exists market_offer_history_offer_idx on public.market_offer_history (offer_id, seen_at desc);

create table if not exists public.price_parser_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  trigger text,
  stats jsonb not null default '{}'::jsonb
);

-- історія пропозиції — лише коли змінилась ціна чи наявність
create or replace function public.trg_market_offer_history() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'INSERT'
     or new.price is distinct from old.price
     or new.unit_price is distinct from old.unit_price
     or new.in_stock is distinct from old.in_stock then
    insert into market_offer_history (offer_id, price, unit_price, in_stock) values (new.id, new.price, new.unit_price, new.in_stock);
  end if;
  return new;
end $$;
drop trigger if exists market_offer_history_log on public.market_offers;
create trigger market_offer_history_log after insert or update on public.market_offers
  for each row execute function public.trg_market_offer_history();

-- щоденне підтвердження тієї самої ціни парсером не засмічує історію цін постачальника
create or replace function public.trg_log_price_history() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'UPDATE' and new.source = 'parsing'
     and new.price is not distinct from old.price and new.currency is not distinct from old.currency then
    return new;
  end if;
  insert into supplier_price_history (supplier_id, material_id, price, currency, updated_by, source, changed_at)
  values (new.supplier_id, new.material_id, new.price, new.currency, new.updated_by, new.source, now());
  return new;
end $$;

-- 5. Доступ
alter table public.price_sources enable row level security;
alter table public.market_offers enable row level security;
alter table public.market_offer_history enable row level security;
alter table public.price_parser_runs enable row level security;

drop policy if exists price_sources_select on public.price_sources;
create policy price_sources_select on public.price_sources for select to authenticated using (true);
drop policy if exists price_sources_write on public.price_sources;
create policy price_sources_write on public.price_sources for all to authenticated
  using ((select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role]))
  with check ((select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role]));

drop policy if exists market_offers_select on public.market_offers;
create policy market_offers_select on public.market_offers for select to authenticated using (true);
drop policy if exists market_offers_update on public.market_offers;
create policy market_offers_update on public.market_offers for update to authenticated
  using ((select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role]))
  with check ((select current_user_role()) = any (array['admin'::user_role, 'manager'::user_role]));

drop policy if exists market_offer_history_select on public.market_offer_history;
create policy market_offer_history_select on public.market_offer_history for select to authenticated using (true);
drop policy if exists price_parser_runs_select on public.price_parser_runs;
create policy price_parser_runs_select on public.price_parser_runs for select to authenticated using (true);

-- 6. Найкраща ціна магазину → supplier_prices
create or replace function public.price_parser_sync_prices(p_supplier uuid, p_materials uuid[] default null) returns integer
language plpgsql security definer set search_path to 'public' as $$
declare n integer := 0; r record;
begin
  for r in
    with pool as (
      select o.material_id, o.unit_price, o.url, o.title, coalesce(m.parse_rule->>'agg', 'min') as agg
      from market_offers o join materials m on m.id = o.material_id
      where o.supplier_id = p_supplier and o.active and not o.excluded
        and o.unit_price is not null and o.unit_price > 0 and o.in_stock is distinct from false
        and (p_materials is null or o.material_id = any (p_materials))
    ), agg as (
      select material_id, max(agg) as agg, min(unit_price) as p_min,
             percentile_cont(0.5) within group (order by unit_price) as p_med, count(*) as cnt
      from pool group by material_id
    )
    select a.material_id, a.cnt,
           round((case when a.agg = 'median' then a.p_med else a.p_min end)::numeric, 2) as price,
           (select p.url from pool p where p.material_id = a.material_id
             order by abs(p.unit_price - (case when a.agg = 'median' then a.p_med else a.p_min end)) limit 1) as url,
           (select p.title from pool p where p.material_id = a.material_id
             order by abs(p.unit_price - (case when a.agg = 'median' then a.p_med else a.p_min end)) limit 1) as title
    from agg a
  loop
    insert into supplier_prices (supplier_id, material_id, price, currency, updated_at, source, updated_by, note)
    values (p_supplier, r.material_id, r.price, 'UAH', now(), 'parsing', 'Парсер цін',
            left(r.title, 140) || ' · ' || r.url || case when r.cnt > 1 then ' · варіантів: ' || r.cnt else '' end)
    on conflict (supplier_id, material_id) do update
      set price = excluded.price, currency = 'UAH', updated_at = now(), source = 'parsing',
          updated_by = 'Парсер цін', note = excluded.note;
    n := n + 1;
  end loop;

  insert into supplier_category_links (supplier_id, category_id)
  select distinct p_supplier, m.category_id
  from market_offers o join materials m on m.id = o.material_id
  where o.supplier_id = p_supplier and o.active
    and not exists (select 1 from supplier_category_links l where l.supplier_id = p_supplier and l.category_id = m.category_id);
  return n;
end $$;

-- після ручного «прибрати / повернути» пропозицію — одразу перерахувати ціну магазину
create or replace function public.trg_market_offer_excluded() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.excluded is distinct from old.excluded then
    if not exists (select 1 from market_offers o where o.supplier_id = new.supplier_id and o.material_id = new.material_id
                   and o.active and not o.excluded and o.unit_price > 0 and o.in_stock is distinct from false) then
      delete from supplier_prices where supplier_id = new.supplier_id and material_id = new.material_id and source = 'parsing';
    else
      perform price_parser_sync_prices(new.supplier_id, array[new.material_id]);
    end if;
  end if;
  return null;
end $$;
drop trigger if exists market_offer_excluded on public.market_offers;
create trigger market_offer_excluded after update of excluded on public.market_offers
  for each row execute function public.trg_market_offer_excluded();

-- 7. RPC для скрипта (anon-ключ + токен)
create or replace function public.price_parser_check(p_token text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if p_token is null or length(p_token) < 20
     or p_token is distinct from (select value from app_secrets where key = 'price_parser_token') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

create or replace function public.price_parser_config(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
begin
  perform price_parser_check(p_token);
  return jsonb_build_object(
    'suppliers', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'site', parser_key, 'website', website)), '[]'::jsonb)
                  from suppliers where parser_key is not null and parser_enabled),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('id', ps.id, 'site', s.parser_key, 'grp', ps.grp, 'url', ps.url, 'max_pages', ps.max_pages)), '[]'::jsonb)
                from price_sources ps join suppliers s on s.id = ps.supplier_id
                where ps.active and s.parser_key is not null and s.parser_enabled),
    'materials', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'unit', unit, 'rule', parse_rule)), '[]'::jsonb)
                  from materials where parse_rule is not null),
    'known', (select coalesce(jsonb_agg(jsonb_build_object('site', s.parser_key, 'url', o.url, 'title', o.title, 'attrs', o.attrs)), '[]'::jsonb)
              from market_offers o join suppliers s on s.id = o.supplier_id where o.attrs ? 'page')
  );
end $$;

create or replace function public.price_parser_run_start(p_token text, p_trigger text) returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare v uuid;
begin
  perform price_parser_check(p_token);
  insert into price_parser_runs (trigger) values (left(coalesce(p_trigger, 'manual'), 40)) returning id into v;
  return v;
end $$;

-- p: { run_id, site, ok, error, sources:[{id, items, pages, error}], complete:[material_id], offers:[…] }
create or replace function public.price_parser_ingest(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_supplier uuid; v_now timestamptz := clock_timestamp();
  n_offers integer := 0; n_gone integer := 0; n_prices integer := 0;
  v_complete uuid[]; v_seen uuid[];
begin
  perform price_parser_check(p_token);
  select id into v_supplier from suppliers where parser_key = p->>'site';
  if v_supplier is null then raise exception 'unknown site %', p->>'site'; end if;

  with src as (
    select distinct on ((o->>'material_id')::uuid, o->>'url')
           (o->>'material_id')::uuid as material_id, o->>'url' as url, o->>'ext_id' as ext_id,
           left(o->>'title', 400) as title, o->>'brand' as brand, coalesce(o->'attrs', '{}'::jsonb) as attrs,
           (o->>'price')::numeric as price, o->>'sale_unit' as sale_unit, (o->>'unit_price')::numeric as unit_price,
           coalesce(o->'unit_prices', '{}'::jsonb) as unit_prices, (o->>'in_stock')::boolean as in_stock
    from jsonb_array_elements(coalesce(p->'offers', '[]'::jsonb)) o
    where exists (select 1 from materials m where m.id = (o->>'material_id')::uuid)
      and (o->>'price')::numeric >= 0 and coalesce(o->>'url', '') <> ''
  ), up as (
    insert into market_offers as mo (supplier_id, material_id, url, ext_id, title, brand, attrs, price, sale_unit, unit_price, unit_prices, in_stock,
                                     active, first_seen_at, last_seen_at, price_changed_at)
    select v_supplier, material_id, url, ext_id, title, brand, attrs, price, sale_unit, unit_price, unit_prices, in_stock, true, v_now, v_now, v_now
    from src
    on conflict (supplier_id, material_id, url) do update
      set ext_id = excluded.ext_id, title = excluded.title, brand = excluded.brand, attrs = excluded.attrs,
          prev_price = case when mo.price is distinct from excluded.price then mo.price else mo.prev_price end,
          price_changed_at = case when mo.price is distinct from excluded.price then v_now else mo.price_changed_at end,
          price = excluded.price, sale_unit = excluded.sale_unit, unit_price = excluded.unit_price,
          unit_prices = excluded.unit_prices, in_stock = excluded.in_stock, active = true, last_seen_at = v_now
    returning material_id
  )
  select count(*), array_agg(distinct material_id) into n_offers, v_seen from up;

  -- матеріали, чиї джерела обійдено без помилок: чого не побачили — того вже немає
  select array_agg(x::uuid) into v_complete from jsonb_array_elements_text(coalesce(p->'complete', '[]'::jsonb)) x;
  if v_complete is not null then
    update market_offers set active = false
    where supplier_id = v_supplier and active and material_id = any (v_complete) and last_seen_at < v_now;
    get diagnostics n_gone = row_count;
  end if;

  n_prices := price_parser_sync_prices(v_supplier, coalesce(v_seen, '{}'::uuid[]) || coalesce(v_complete, '{}'::uuid[]));

  update price_sources ps
     set last_items = (x->>'items')::integer,
         last_error = nullif(x->>'error', ''),
         last_ok_at = case when nullif(x->>'error', '') is null then v_now else ps.last_ok_at end
  from jsonb_array_elements(coalesce(p->'sources', '[]'::jsonb)) x
  where ps.id = (x->>'id')::uuid and ps.supplier_id = v_supplier;

  update suppliers set parsed_at = v_now,
         parse_status = case when coalesce((p->>'ok')::boolean, false) then 'ok' else left(coalesce(p->>'error', 'помилка'), 300) end
  where id = v_supplier;

  update price_parser_runs
     set finished_at = v_now,
         stats = stats || jsonb_build_object(p->>'site', jsonb_build_object(
           'ok', coalesce((p->>'ok')::boolean, false), 'error', p->>'error', 'offers', n_offers, 'gone', n_gone,
           'prices', n_prices, 'pages', p->'pages', 'items', p->'items'))
  where id = nullif(p->>'run_id', '')::uuid;

  return jsonb_build_object('offers', n_offers, 'gone', n_gone, 'prices', n_prices);
end $$;

revoke all on function public.price_parser_check(text) from public, anon, authenticated;
revoke all on function public.price_parser_sync_prices(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.trg_market_offer_history() from public, anon, authenticated;
revoke all on function public.trg_market_offer_excluded() from public, anon, authenticated;
revoke all on function public.price_parser_config(text) from public;
revoke all on function public.price_parser_run_start(text, text) from public;
revoke all on function public.price_parser_ingest(text, jsonb) from public;
grant execute on function public.price_parser_config(text) to anon, authenticated, service_role;
grant execute on function public.price_parser_run_start(text, text) to anon, authenticated, service_role;
grant execute on function public.price_parser_ingest(text, jsonb) to anon, authenticated, service_role;

-- Ціни з браузера: магазини, чиї сайти не пускають програми (Leroy Merlin, Angio). Людина відкриває сторінку
-- категорії у своєму браузері й надсилає її кнопкою «Ціни в Модулер» (/capture → /api/price-parser/page).

-- Сторінки, на яких парсер не розпізнав жодного товару, — зразки, щоб написати адаптер сайту
create table if not exists public.price_page_samples (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  url text not null,
  html text not null,
  created_at timestamptz not null default now()
);
alter table public.price_page_samples enable row level security; -- без політик: лише службовий доступ

create or replace function public.price_parser_sample(p_token text, p_site text, p_url text, p_html text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_supplier uuid;
begin
  perform price_parser_check(p_token);
  select id into v_supplier from suppliers where parser_key = p_site;
  if v_supplier is null then return; end if;
  -- не більше 20 зразків на магазин: старі прибираємо вручну, коли адаптер написано
  insert into price_page_samples (supplier_id, url, html)
  select v_supplier, left(p_url, 1000), left(p_html, 1500000)
  where (select count(*) from price_page_samples where supplier_id = v_supplier) < 20;
end $$;

-- конфігурація: + stores (усі магазини з сайтом, зокрема вимкнені) і джерела вимкнених магазинів — сторінки, які відкриває людина
create or replace function public.price_parser_config(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
begin
  perform price_parser_check(p_token);
  return jsonb_build_object(
    'suppliers', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'site', parser_key, 'website', website, 'local', parser_local)), '[]'::jsonb)
                  from suppliers where parser_key is not null and parser_enabled),
    'stores', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'site', parser_key, 'website', website, 'enabled', parser_enabled)), '[]'::jsonb)
               from suppliers where parser_key is not null),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('id', ps.id, 'site', s.parser_key, 'grp', ps.grp, 'url', ps.url, 'max_pages', ps.max_pages)), '[]'::jsonb)
                from price_sources ps join suppliers s on s.id = ps.supplier_id
                where ps.active and s.parser_key is not null),
    'materials', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'unit', unit, 'rule', parse_rule)), '[]'::jsonb)
                  from materials where parse_rule is not null),
    'known', (select coalesce(jsonb_agg(jsonb_build_object('site', s.parser_key, 'url', o.url, 'title', o.title, 'attrs', o.attrs)), '[]'::jsonb)
              from market_offers o join suppliers s on s.id = o.supplier_id where o.attrs ? 'page')
  );
end $$;

-- запис: + stale_days — пропозиції, яких не бачили стільки днів, перестають бути актуальними (для сторінок із браузера,
-- де невідомо, чи категорію надіслано повністю)
create or replace function public.price_parser_ingest(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_supplier uuid; v_now timestamptz := clock_timestamp();
  n_offers integer := 0; n_gone integer := 0; n_stale integer := 0; n_prices integer := 0;
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

  select array_agg(x::uuid) into v_complete from jsonb_array_elements_text(coalesce(p->'complete', '[]'::jsonb)) x;
  if v_complete is not null then
    update market_offers set active = false
    where supplier_id = v_supplier and active and material_id = any (v_complete) and last_seen_at < v_now;
    get diagnostics n_gone = row_count;
  end if;

  if (p->>'stale_days') is not null then
    with gone as (
      update market_offers set active = false
      where supplier_id = v_supplier and active and last_seen_at < v_now - make_interval(days => (p->>'stale_days')::integer)
      returning material_id
    )
    select count(*), coalesce(v_seen, '{}'::uuid[]) || coalesce(array_agg(distinct material_id), '{}'::uuid[]) into n_stale, v_seen from gone;
    n_gone := n_gone + n_stale;
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

grant execute on function public.price_parser_sample(text, text, text, text) to anon, authenticated, service_role;

-- сторінки категорій, які варто надсилати (адреси — з відкритих карт сайтів)
insert into public.price_sources (supplier_id, grp, url, max_pages)
select s.id, v.grp, v.url, 1
from (values
  ('leroymerlin', 'lumber', 'https://www.leroymerlin.ua/f/doshky'),
  ('leroymerlin', 'lumber', 'https://www.leroymerlin.ua/f/brus-ta-reiky'),
  ('leroymerlin', 'wool', 'https://www.leroymerlin.ua/f/bazaltova-vata'),
  ('leroymerlin', 'membrane', 'https://www.leroymerlin.ua/f/superdyfuziina-membrana'),
  ('leroymerlin', 'membrane', 'https://www.leroymerlin.ua/f/paroizoliatsiini-plivky'),
  ('leroymerlin', 'tape', 'https://www.leroymerlin.ua/f/aliuminiieva-strichka'),
  ('leroymerlin', 'tape', 'https://www.leroymerlin.ua/f/pokrivelni-strichky'),
  ('leroymerlin', 'osb', 'https://www.leroymerlin.ua/f/osb-plyty'),
  ('leroymerlin', 'plywood', 'https://www.leroymerlin.ua/f/fanera'),
  ('leroymerlin', 'drywall', 'https://www.leroymerlin.ua/f/gipsokarton'),
  ('leroymerlin', 'cladding', 'https://www.leroymerlin.ua/f/dereviana-vagonka'),
  ('leroymerlin', 'staples', 'https://www.leroymerlin.ua/f/skoby-ta-gvizdky-dlia-pnevmoinstrumentu'),
  ('leroymerlin', 'nails', 'https://www.leroymerlin.ua/f/tsviakhy'),
  ('leroymerlin', 'screws', 'https://www.leroymerlin.ua/f/shurupy'),
  ('leroymerlin', 'gloves', 'https://www.leroymerlin.ua/f/rukavychky'),
  ('leroymerlin', 'brush', 'https://www.leroymerlin.ua/f/penzli-maliarni'),
  ('leroymerlin', 'pencil', 'https://www.leroymerlin.ua/f/rozmitochni-instrumenty-olivtsi-markery-kreida'),
  ('leroymerlin', 'mesh', 'https://www.leroymerlin.ua/f/sitka-metaleva'),
  ('angio', 'lumber', 'https://angio.com.ua/ua/ishop/doska_obreznaya/'),
  ('angio', 'lumber', 'https://angio.com.ua/ua/ishop/brus/'),
  ('angio', 'wool', 'https://angio.com.ua/ua/ishop/bazaltovaya_vata/'),
  ('angio', 'membrane', 'https://angio.com.ua/ua/ishop/izoliacionnye_plenki/'),
  ('angio', 'tape', 'https://angio.com.ua/ua/ishop/lenty-germetiki/'),
  ('angio', 'osb', 'https://angio.com.ua/ua/ishop/osb/'),
  ('angio', 'plywood', 'https://angio.com.ua/ua/ishop/fanera/'),
  ('angio', 'drywall', 'https://angio.com.ua/ua/ishop/gipsokarton/'),
  ('angio', 'cladding', 'https://angio.com.ua/ua/ishop/vagonka/'),
  ('angio', 'geotextile', 'https://angio.com.ua/ua/ishop/geotekstil/'),
  ('angio', 'nails', 'https://angio.com.ua/ua/ishop/gvozdi/'),
  ('angio', 'screws', 'https://angio.com.ua/ua/ishop/shurupy/'),
  ('angio', 'gloves', 'https://angio.com.ua/ua/ishop/perchatki/'),
  ('angio', 'brush', 'https://angio.com.ua/ua/ishop/malyarnyy_instrument/kisti/'),
  ('angio', 'brush', 'https://angio.com.ua/ua/ishop/malyarnyy_instrument/maklovicy/'),
  ('angio', 'mesh', 'https://angio.com.ua/ua/ishop/metallicheskaya_setka/')
) as v(site, grp, url)
join public.suppliers s on s.parser_key = v.site
on conflict (supplier_id, grp, url) do nothing;

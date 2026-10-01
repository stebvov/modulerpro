-- Магазини, чиї сайти не пускають запити із серверів (ОЛДІ): сервер їх не обходить,
-- ціни оновлюються лише запуском з комп'ютера в Україні (node tools/price-parser/run.mjs --site=oldi).
alter table public.suppliers add column if not exists parser_local boolean not null default false;
update public.suppliers set parser_local = true where parser_key = 'oldi';

create or replace function public.price_parser_config(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
begin
  perform price_parser_check(p_token);
  return jsonb_build_object(
    'suppliers', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'site', parser_key, 'website', website, 'local', parser_local)), '[]'::jsonb)
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

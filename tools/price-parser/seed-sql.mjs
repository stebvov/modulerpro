// Перше наповнення бази з seed.mjs:  node tools/price-parser/seed-sql.mjs > supabase/migrations/<дата>_price_parser_seed.sql
// Повторний запуск безпечний: нічого не дублює, наявним матеріалам лише оновлює правило й опис.

import { SITES } from "./sites.mjs";
import { CATEGORIES, UNITS, MATERIALS, SOURCES, maxPages } from "./seed.mjs";

const q = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const out = [];

out.push("-- Парсер цін: магазини, категорії, матеріали з правилами, джерела. Згенеровано tools/price-parser/seed-sql.mjs");

out.push("\n-- одиниці виміру");
out.push(
  `insert into public.material_units (name, sort_order)\nselect v.name, (select coalesce(max(sort_order), 0) from public.material_units) + v.n\nfrom (values ${UNITS.map((u, i) => `(${q(u)}, ${i + 1})`).join(", ")}) as v(name, n)\nwhere not exists (select 1 from public.material_units u where u.name = v.name);`
);

out.push("\n-- категорії матеріалів");
out.push(
  `insert into public.material_categories (name, icon, sort_order)\nselect v.name, v.icon, (select coalesce(max(sort_order), 0) from public.material_categories where parent_id is null) + v.n\nfrom (values ${CATEGORIES.map((c, i) => `(${q(c.name)}, ${q(c.icon)}, ${i + 1})`).join(", ")}) as v(name, icon, n)\nwhere not exists (select 1 from public.material_categories c where c.name = v.name);`
);

out.push("\n-- магазини");
const stores = [
  ...Object.entries(SITES).map(([key, s]) => ({ key, name: s.name, website: s.website, enabled: true, status: null })),
  // обидва сайти не пускають програми; захист не обходимо — ціни вручну або з прайсу від магазину
  { key: "leroymerlin", name: "Leroy Merlin", website: "https://www.leroymerlin.ua/", enabled: false, status: "Сайт захищено від автоматичного збору даних (DataDome): справжньому браузеру показує капчу після кількох сторінок. Ціни — вручну або з прайсу від магазину." },
  { key: "angio", name: "Angio", website: "https://angio.com.ua/", enabled: false, status: "Сайт не пускає програми (перевірка Cloudflare «чи ви людина»). Ціни — вручну або з прайсу від магазину." },
];
out.push(
  `insert into public.suppliers (name, region, website, parser_key, parser_enabled, parse_status, notes)\nselect v.name, 'Київ', v.website, v.key, v.enabled, v.status, 'Інтернет-магазин будматеріалів. Ціни оновлює парсер раз на день.'\nfrom (values\n${stores.map((s) => `  (${q(s.name)}, ${q(s.website)}, ${q(s.key)}, ${s.enabled}, ${q(s.status)})`).join(",\n")}\n) as v(name, website, key, enabled, status)\nwhere not exists (select 1 from public.suppliers s where s.parser_key = v.key);`
);
out.push(
  `insert into public.supplier_contacts (supplier_id, type, value, label, sort_order)\nselect s.id, 'website', s.website, 'Сайт', 0 from public.suppliers s\nwhere s.parser_key is not null and s.website is not null\n  and not exists (select 1 from public.supplier_contacts c where c.supplier_id = s.id);`
);

out.push("\n-- матеріали з правилами відстеження");
const rows = MATERIALS.map((m) => `  (${q(m.name)}, ${q(m.category)}, ${q(m.unit)}, ${q(m.spec)}, ${m.rule ? `${q(JSON.stringify(m.rule))}::jsonb` : "null::jsonb"})`);
out.push(
  `with v(name, category, unit, spec, rule) as (values\n${rows.join(",\n")}\n), upd as (\n  update public.materials m set parse_rule = v.rule, spec = v.spec\n  from v where m.name = v.name\n  returning m.name\n)\ninsert into public.materials (name, category_id, unit, spec, parse_rule)\nselect v.name, (select c.id from public.material_categories c where c.name = v.category order by c.parent_id nulls first limit 1), v.unit, v.spec, v.rule\nfrom v where v.name not in (select name from upd);`
);

out.push("\n-- джерела: сторінки категорій");
const src = Object.entries(SOURCES).flatMap(([site, groups]) =>
  Object.entries(groups).flatMap(([grp, urls]) => urls.map((url) => `  (${q(site)}, ${q(grp)}, ${q(url)}, ${maxPages(site, grp, url)})`))
);
out.push(
  `insert into public.price_sources (supplier_id, grp, url, max_pages)\nselect s.id, v.grp, v.url, v.max_pages\nfrom (values\n${src.join(",\n")}\n) as v(site, grp, url, max_pages)\njoin public.suppliers s on s.parser_key = v.site\non conflict (supplier_id, grp, url) do nothing;`
);

console.log(out.join("\n"));

-- Модель у каталозі: розміри кожного модуля і тераси.
-- modules  — [{ "w": 3, "l": 6.5 }, …] ширина × довжина, м (за замовчуванням усі однакові; кожен можна змінити);
-- terraces — [{ "name": "Тераса", "area": 15 }, …] площа, м².
-- area_m2 лишається площею будинку (без терас); module_count = кількість модулів.
alter table public.product_templates
  add column if not exists modules jsonb not null default '[]'::jsonb,
  add column if not exists terraces jsonb not null default '[]'::jsonb;

alter table public.product_templates
  add constraint product_templates_modules_is_array check (jsonb_typeof(modules) = 'array'),
  add constraint product_templates_terraces_is_array check (jsonb_typeof(terraces) = 'array');

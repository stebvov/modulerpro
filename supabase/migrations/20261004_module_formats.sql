-- 📐 Формати модулів (довідник) і формат у моделі; застосовано через MCP 04.10.2026
create table if not exists public.module_formats (
  id uuid primary key default gen_random_uuid(), name text not null, w numeric, l numeric,
  sort_order integer not null default 0, created_at timestamptz not null default now());
alter table public.module_formats enable row level security;
-- читати — усі, змінювати — admin/manager
alter table public.product_templates add column if not exists module_format_id uuid references public.module_formats(id) on delete set null;

-- Сайт moduler.pro: сторінки з блоків (конструктор), моделі, кейси, налаштування, фото, заявки.
-- Застосовано в проєкті uaufrrpfvixhprqhqjzo 29.09.2026 (міграції site_cms + site_cms_anon_read).

create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null default '',
  nav_label text,
  in_nav boolean not null default false,
  sort integer not null default 0,
  seo_title text,
  seo_description text,
  og_image text,
  blocks jsonb not null default '[]'::jsonb,   -- опубліковане
  draft jsonb,                                  -- чернетка з конструктора (null = як опубліковане)
  published boolean not null default false,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create table if not exists public.site_models (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  tagline text,
  size_group smallint not null default 1 check (size_group between 1 and 4), -- 1: до 30, 2: 30–50, 3: 50–100, 4: 100+
  area_m2 numeric,
  modules numeric,
  bedrooms integer,
  dimensions text,
  price_shell numeric,      -- Конструктив
  price_prefinish numeric,  -- Під оздоблення
  price_ready numeric,      -- Готове житло
  currency text not null default 'USD',
  description text,
  features jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  plan_image text,
  template_id uuid references public.product_templates(id) on delete set null,
  published boolean not null default false,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_cases (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  kind text not null default 'private', -- private | business | social | town
  location text,
  format text,
  year text,
  task text,
  solution text,
  quote text,
  quote_author text,
  photos jsonb not null default '[]'::jsonb,
  featured boolean not null default true,
  published boolean not null default true,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.site_touch() returns trigger language plpgsql set search_path to '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger site_pages_touch before update on public.site_pages for each row execute function public.site_touch();
create trigger site_models_touch before update on public.site_models for each row execute function public.site_touch();
create trigger site_cases_touch before update on public.site_cases for each row execute function public.site_touch();
create trigger site_settings_touch before update on public.site_settings for each row execute function public.site_touch();

alter table public.site_pages enable row level security;
alter table public.site_models enable row level security;
alter table public.site_cases enable row level security;
alter table public.site_settings enable row level security;

-- відвідувачі сайту бачать лише опубліковане; команда (mod_can) — усе й редагує
create policy site_pages_read_anon on public.site_pages for select to anon using (published);
create policy site_pages_read_auth on public.site_pages for select to authenticated using (published or (select public.mod_can()));
create policy site_pages_write on public.site_pages for all to authenticated using ((select public.mod_can())) with check ((select public.mod_can()));
create policy site_models_read_anon on public.site_models for select to anon using (published);
create policy site_models_read_auth on public.site_models for select to authenticated using (published or (select public.mod_can()));
create policy site_models_write on public.site_models for all to authenticated using ((select public.mod_can())) with check ((select public.mod_can()));
create policy site_cases_read_anon on public.site_cases for select to anon using (published);
create policy site_cases_read_auth on public.site_cases for select to authenticated using (published or (select public.mod_can()));
create policy site_cases_write on public.site_cases for all to authenticated using ((select public.mod_can())) with check ((select public.mod_can()));
create policy site_settings_read on public.site_settings for select using (true);
create policy site_settings_write on public.site_settings for all to authenticated using ((select public.mod_can())) with check ((select public.mod_can()));

grant select on public.site_pages, public.site_models, public.site_cases, public.site_settings to anon;
grant select, insert, update, delete on public.site_pages, public.site_models, public.site_cases, public.site_settings to authenticated;

-- фото сайту: публічний бакет, завантажує команда
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site', 'site', true, 10485760, array['image/webp','image/jpeg','image/png','image/svg+xml','image/avif'])
on conflict (id) do nothing;
create policy site_files_insert on storage.objects for insert to authenticated with check (bucket_id = 'site' and (select public.mod_can()));
create policy site_files_update on storage.objects for update to authenticated using (bucket_id = 'site' and (select public.mod_can()));
create policy site_files_delete on storage.objects for delete to authenticated using (bucket_id = 'site' and (select public.mod_can()));

-- заявка з сайту → leads (джерело «сайт») → chain_on_lead (подія, Telegram)
create or replace function public.site_submit_lead(p jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare
  v_name text := left(btrim(coalesce(p->>'name','')), 120);
  v_phone text := left(btrim(coalesce(p->>'phone','')), 40);
  v_digits text := regexp_replace(coalesce(p->>'phone',''), '\D', '', 'g');
  v_notes text;
  v_id uuid;
begin
  if coalesce(p->>'company','') <> '' then return jsonb_build_object('ok', true); end if; -- пастка для ботів
  if v_name = '' or length(v_digits) < 9 then
    return jsonb_build_object('ok', false, 'error', 'Вкажіть імʼя й телефон');
  end if;
  -- та сама людина двічі за 10 хв — не дублюємо
  select id into v_id from public.leads
   where source = 'сайт' and regexp_replace(coalesce(phone,''), '\D', '', 'g') = v_digits and created_at > now() - interval '10 minutes'
   limit 1;
  if v_id is not null then return jsonb_build_object('ok', true, 'id', v_id); end if;
  if (select count(*) from public.leads where source = 'сайт' and created_at > now() - interval '1 minute') > 20 then
    return jsonb_build_object('ok', false, 'error', 'Забагато заявок, спробуйте за хвилину');
  end if;
  v_notes := concat_ws(E'\n',
    nullif('Що планує: ' || nullif(left(p->>'goal', 200), ''), 'Що планує: '),
    nullif('Площа: ' || nullif(left(p->>'area', 60), ''), 'Площа: '),
    nullif('Модель: ' || nullif(left(p->>'model', 120), ''), 'Модель: '),
    nullif('Розрахунок: ' || nullif(left(p->>'calc', 300), ''), 'Розрахунок: '),
    nullif('Коментар: ' || nullif(left(p->>'message', 2000), ''), 'Коментар: '),
    nullif('Звʼязок: ' || nullif(left(p->>'contact_via', 40), ''), 'Звʼязок: '),
    nullif('Сторінка: ' || nullif(left(p->>'page', 300), ''), 'Сторінка: '),
    nullif('UTM: ' || nullif(left(p->>'utm', 300), ''), 'UTM: '));
  insert into public.leads (source, name, phone, contact, region, budget_range, status, notes)
  values ('сайт', v_name, v_phone, nullif(left(p->>'contact_via', 40), ''), nullif(left(p->>'region', 120), ''),
          nullif(left(p->>'budget', 60), ''), 'новий', nullif(v_notes, ''))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke all on function public.site_submit_lead(jsonb) from public;
grant execute on function public.site_submit_lead(jsonb) to anon, authenticated;
revoke all on function public.site_touch() from public, anon, authenticated;

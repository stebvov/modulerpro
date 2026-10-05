-- Переклади сайту: «український текст → текст іншою мовою». Ключ — сам український текст (його md5),
-- тож переклад автоматично підхоплюється всюди, де цей текст зустрічається (сторінки, моделі, кейси, меню).
create table if not exists public.site_i18n (
  lang text not null,
  src text not null,
  src_hash text generated always as (md5(src)) stored,
  text text not null default '',
  auto boolean not null default false,          -- перекладено автоматично (ще не вичитано людиною)
  updated_at timestamptz not null default now(),
  primary key (lang, src_hash)
);

alter table public.site_i18n enable row level security;

-- переклади опублікованого сайту читають усі (це текст сайту), змінюють — ті, хто веде сайт
drop policy if exists site_i18n_read on public.site_i18n;
drop policy if exists site_i18n_write on public.site_i18n;
create policy site_i18n_read on public.site_i18n for select using (true);
create policy site_i18n_write on public.site_i18n for all to authenticated using ((select mod_can())) with check ((select mod_can()));

revoke all on public.site_i18n from anon;
grant select on public.site_i18n to anon;

-- Самі переклади (англійська, 1284 рядки) завантажено в базу 05.10.2026; далі вони ведуться
-- в розділі «Сайт → Переклад (EN)» і функцією supabase/functions/site-translate.

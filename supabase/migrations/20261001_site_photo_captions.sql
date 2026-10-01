-- Підписи до фото в галереях сайту: { "<адреса фото>": "підпис" } — ключ за адресою, тож порядок фото можна міняти.
alter table public.site_cases add column if not exists photo_captions jsonb not null default '{}'::jsonb;
alter table public.site_models add column if not exists photo_captions jsonb not null default '{}'::jsonb;

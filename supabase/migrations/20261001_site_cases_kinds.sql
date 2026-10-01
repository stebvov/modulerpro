-- Кейс може мати кілька типів (напр. «Соціальні» + «Містечка»). kind лишається — перший тип, для сумісності.
alter table public.site_cases add column if not exists kinds text[] not null default '{}';
update public.site_cases set kinds = array[kind] where coalesce(array_length(kinds, 1), 0) = 0 and kind is not null;

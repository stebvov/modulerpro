-- 📡 Радар Telegram: слухає публічні групи й знаходить повідомлення, де шукають або обговорюють модульні будинки.
-- Менеджер отримує сповіщення з посиланням на повідомлення й сам відповідає людині — особисто, від імені компанії.
-- Радар нікому не пише. Зберігає: посилання на повідомлення (група + номер), імʼя й нікнейм автора (рішення засновника
-- 10.10.2026), оцінку й короткий зміст запиту від ШІ. Тексту повідомлень не зберігає.
-- Читає групи окремий Telegram-акаунт компанії — сервер /api/tg-radar/* на Vercel; розклад — pg_cron (tg-radar).
-- Ключі цього акаунта (api_id, api_hash, сесія) лежать в app_secrets (tgr_*) і в браузер не потрапляють.

alter type public.lead_source add value if not exists 'telegram';

create table if not exists public.tgr_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,              -- розклад працює
  keywords text[] not null default '{}',               -- рядок = слово чи початок слова; кілька слів у рядку — мають бути всі
  stop_words text[] not null default '{}',             -- є таке слово → повідомлення пропускаємо без ШІ
  brief text not null default '',                      -- що шукаємо (пояснення для ШІ)
  min_score int not null default 6 check (min_score between 1 and 10),   -- від якої оцінки слати сповіщення
  notify_owner boolean not null default true,
  tg_chats text not null default '',                   -- групи для сповіщень (ID або @назва через кому), як у квізах
  model text not null default 'claude-opus-5-5',
  daily_usd numeric not null default 1 check (daily_usd >= 0),           -- денна стеля витрат на ШІ
  -- стан підключення Telegram-акаунта компанії (пише лише сервер)
  acc_state text not null default 'none' check (acc_state in ('none', 'code_sent', 'password', 'ok', 'error')),
  acc_label text,
  acc_error text,
  acc_checked_at timestamptz,
  busy_until timestamptz,                              -- замок: з акаунтом одночасно працює лише один запит
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into public.tgr_settings (id, keywords, stop_words, brief) values (true,
  array['модульн', 'каркасн', 'барнхаус', 'barnhouse', 'швидкозбірн', 'быстровозвод', 'тайні хаус', 'tiny house',
        'дачн будин', 'дачн дом', 'будин під ключ', 'дом под ключ', 'будиноч', 'домик', 'глемпінг', 'глэмпинг',
        'a-frame', 'а-фрейм', 'сіп панел', 'сип панел', 'мобільн будин', 'мобильн дом', 'збірн будин', 'сборн дом'],
  array['казино', 'ставки на спорт', 'заробіток в інтернеті', 'заработок в интернете'],
  'Модулер (moduler.pro) — український виробник модульних будинків: виготовлення на заводі, доставка й монтаж під ключ, готові моделі від 15 до 100+ м² та індивідуальні проєкти; будинки для бізнесу (глемпінги, бази відпочинку, готелі), сауни, котеджні містечка.'
  || E'\n\n' || 'Шукаємо повідомлення, де хочуть купити чи замовити будинок або вибирають: модульний, каркасний, швидкозбірний будинок, дачу, будинок для здачі в оренду, глемпінг. Питають поради, ціну, виробника, строки, порівнюють технології.'
  || E'\n\n' || 'Не цікаві: реклама інших виробників і продавців, вакансії та пошук роботи, продаж уживаного, ремонт квартир, новини.')
on conflict (id) do nothing;

-- публічні групи, які слухаємо
create table if not exists public.tgr_groups (
  id bigint generated always as identity primary key,
  username text not null unique check (username ~ '^[a-z0-9_]{4,40}$'),   -- публічна назва групи без @, малими літерами
  title text,
  about text,
  members int,
  kind text not null default 'group' check (kind in ('group', 'channel')),
  tg_id text,                                          -- службові дані Telegram про групу — щоб не шукати її щоразу
  access_hash text,
  active boolean not null default true,
  last_msg_id bigint,
  last_checked_at timestamptz,
  last_error text,
  seen int not null default 0,                         -- скільки повідомлень переглянуто
  hits int not null default 0,                         -- скільки знахідок
  note text,
  added_by text,
  added_at timestamptz not null default now()
);

-- знахідки: посилання на повідомлення, автор, оцінка й зміст від ШІ
create table if not exists public.tgr_hits (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.tgr_groups (id) on delete cascade,
  msg_id bigint not null,                              -- номер повідомлення в групі → https://t.me/<група>/<номер>
  msg_at timestamptz,
  author_name text,
  author_username text,
  matched text[] not null default '{}',                -- які ключові слова спрацювали
  score int not null,                                  -- 0–10: наскільки це наш запит
  intent text,                                         -- buy / choose / price / discuss / offer / other
  summary text,                                        -- про що запит, своїми словами
  reply_draft text,                                    -- чернетка відповіді для менеджера
  status text not null default 'new' check (status in ('new', 'work', 'replied', 'lead', 'skip')),
  note text,
  lead_id uuid,
  taken_by text,
  updated_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (group_id, msg_id)
);
create index if not exists tgr_hits_list_idx on public.tgr_hits (status, created_at desc);

create table if not exists public.tgr_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  trigger text,                                        -- cron / crm
  groups int not null default 0,
  messages int not null default 0,
  candidates int not null default 0,
  hits int not null default 0,
  cost_usd numeric not null default 0,
  error text
);

-- хто працює з радаром: адмін і менеджер CRM, засновник і керівники; налаштування й акаунт — адмін і засновник
create or replace function public.tgr_can() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role in ('admin', 'manager') and not coalesce(p.is_blocked, false) from public.profiles p where p.id = auth.uid()), false)
      or exists (select 1 from public.task_members m where m.active and (m.is_owner or m.can_manage) and lower(m.email) = lower(auth.jwt() ->> 'email'));
$$;
create or replace function public.tgr_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role = 'admin' and not coalesce(p.is_blocked, false) from public.profiles p where p.id = auth.uid()), false)
      or exists (select 1 from public.task_members m where m.active and m.is_owner and lower(m.email) = lower(auth.jwt() ->> 'email'));
$$;
revoke all on function public.tgr_can(), public.tgr_admin() from public, anon;
grant execute on function public.tgr_can(), public.tgr_admin() to authenticated;

alter table public.tgr_settings enable row level security;
alter table public.tgr_groups enable row level security;
alter table public.tgr_hits enable row level security;
alter table public.tgr_runs enable row level security;

create policy tgr_settings_read on public.tgr_settings for select to authenticated using ((select public.tgr_can()));
create policy tgr_settings_write on public.tgr_settings for update to authenticated
  using ((select public.tgr_admin())) with check ((select public.tgr_admin()));
create policy tgr_groups_read on public.tgr_groups for select to authenticated using ((select public.tgr_can()));
create policy tgr_groups_add on public.tgr_groups for insert to authenticated with check ((select public.tgr_can()));
create policy tgr_groups_edit on public.tgr_groups for update to authenticated
  using ((select public.tgr_can())) with check ((select public.tgr_can()));
create policy tgr_groups_del on public.tgr_groups for delete to authenticated using ((select public.tgr_admin()));
create policy tgr_hits_read on public.tgr_hits for select to authenticated using ((select public.tgr_can()));
create policy tgr_hits_edit on public.tgr_hits for update to authenticated
  using ((select public.tgr_can())) with check ((select public.tgr_can()));
create policy tgr_runs_read on public.tgr_runs for select to authenticated using ((select public.tgr_can()));

revoke all on public.tgr_settings, public.tgr_groups, public.tgr_hits, public.tgr_runs from anon, authenticated;
grant select on public.tgr_settings, public.tgr_groups, public.tgr_hits, public.tgr_runs to authenticated;
grant update (enabled, keywords, stop_words, brief, min_score, notify_owner, tg_chats, daily_usd, updated_at, updated_by) on public.tgr_settings to authenticated;
grant insert (username, title, about, members, kind, note, added_by) on public.tgr_groups to authenticated;
grant update (active, note) on public.tgr_groups to authenticated;
grant delete on public.tgr_groups to authenticated;
grant update (status, note, taken_by, updated_at) on public.tgr_hits to authenticated;

-- сповіщення про знахідку: засновнику особисто та/або в робочі групи (бот «Іван»); кличе лише сервер
create or replace function public.tgr_html(t text) returns text
language sql immutable set search_path = '' as $$
  select replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
$$;

create or replace function public.tgr_notify(p_hit bigint) returns int
language plpgsql security definer set search_path = '' as $$
declare
  h record; s record; tok text; body text; chat text; sent int := 0; label text;
begin
  select t.*, g.username as g_user, coalesce(g.title, '@' || g.username) as g_title
    into h from public.tgr_hits t join public.tgr_groups g on g.id = t.group_id where t.id = p_hit;
  if not found or h.notified_at is not null then return 0; end if;
  select * into s from public.tgr_settings;
  select value into tok from public.app_secrets where key = 'tg_bot_token';
  if tok is null then return 0; end if;
  label := case h.intent when 'buy' then 'хоче купити' when 'choose' then 'вибирає' when 'price' then 'питає ціну'
                         when 'discuss' then 'обговорює' else 'згадка' end;
  body := '📡 <b>Радар · ' || h.score || '/10</b> · ' || label || E'\n'
       || 'Група: <b>' || public.tgr_html(h.g_title) || '</b>'
       || coalesce(E'\nАвтор: ' || nullif(btrim(public.tgr_html(h.author_name) || coalesce(' @' || nullif(h.author_username, ''), '')), ''), '')
       || coalesce(E'\n\n💡 ' || nullif(public.tgr_html(h.summary), ''), '')
       || E'\n\n<a href="https://t.me/' || h.g_user || '/' || h.msg_id || '">Відкрити повідомлення</a>'
       || ' · <a href="https://app.moduler.pro/?s=tg-radar&hit=' || h.id || '">У системі</a>';
  for chat in
    select m.tg_user_id::text from public.task_members m where s.notify_owner and m.active and m.is_owner and m.tg_user_id is not null
    union
    select btrim(x) from regexp_split_to_table(coalesce(s.tg_chats, ''), '[,;\s]+') x where btrim(x) <> ''
  loop
    perform net.http_post(url := 'https://api.telegram.org/bot' || tok || '/sendMessage',
      body := jsonb_build_object('chat_id', case when chat ~ '^-?\d+$' then to_jsonb(chat::bigint) else to_jsonb(chat) end,
                                 'text', body, 'parse_mode', 'HTML', 'disable_web_page_preview', true),
      headers := '{"Content-Type":"application/json"}'::jsonb);
    sent := sent + 1;
  end loop;
  update public.tgr_hits set notified_at = now() where id = p_hit;
  return sent;
exception when others then raise warning 'tgr_notify: %', sqlerrm; return sent;
end $$;
revoke all on function public.tgr_html(text), public.tgr_notify(bigint) from public, anon, authenticated;
grant execute on function public.tgr_notify(bigint) to service_role;

-- знахідка → лід у CRM (джерело «telegram») + угода в першому етапі воронки «Продаж будинків»
create or replace function public.tgr_make_lead(p_hit bigint, p_name text default null, p_contact text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare h record; v_id uuid; v_pipe uuid; v_stage uuid; v_who text := auth.jwt() ->> 'email';
begin
  if not public.tgr_can() then raise exception 'Немає доступу' using errcode = '42501'; end if;
  select t.*, g.username as g_user, coalesce(g.title, '@' || g.username) as g_title
    into h from public.tgr_hits t join public.tgr_groups g on g.id = t.group_id where t.id = p_hit for update of t;
  if not found then raise exception 'Знахідку не знайдено'; end if;
  if h.lead_id is not null then return h.lead_id; end if;
  execute $q$insert into public.leads (source, name, contact, status, notes)
             values ('telegram', $1, $2, 'новий', $3) returning id$q$
    using left(coalesce(nullif(btrim(p_name), ''), nullif(btrim(h.author_name), ''), '@' || nullif(h.author_username, ''), 'Telegram'), 120),
          left(coalesce(nullif(btrim(p_contact), ''), 'Telegram @' || nullif(h.author_username, ''), 'Telegram'), 120),
          concat_ws(E'\n',
            'Звідки: Telegram-чат «' || h.g_title || '» (радар), оцінка ' || h.score || '/10',
            nullif('Запит: ' || coalesce(h.summary, ''), 'Запит: '),
            'Повідомлення: https://t.me/' || h.g_user || '/' || h.msg_id)
    into v_id;
  begin
    select pl.id, (select st.id from public.pipeline_stages st where st.pipeline_id = pl.id order by st.sort_order limit 1)
      into v_pipe, v_stage from public.pipelines pl where pl.slug = 'houses';
    if v_pipe is not null and v_stage is not null then
      insert into public.deals (lead_id, pipeline_id, stage_id, quantity, is_custom) values (v_id, v_pipe, v_stage, 1, false);
    end if;
  exception when others then raise warning 'tgr_make_lead deal: %', sqlerrm;
  end;
  update public.tgr_hits set status = 'lead', lead_id = v_id, taken_by = coalesce(taken_by, v_who), updated_at = now() where id = p_hit;
  return v_id;
end $$;
revoke all on function public.tgr_make_lead(bigint, text, text) from public, anon;
grant execute on function public.tgr_make_lead(bigint, text, text) to authenticated;

-- замок на акаунт (два одночасні підключення однією сесією Telegram може її вбити) і лічильники групи — кличе сервер
create or replace function public.tgr_lock(p_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if coalesce(p_seconds, 0) <= 0 then
    update public.tgr_settings set busy_until = null where id;
    return true;
  end if;
  update public.tgr_settings set busy_until = now() + make_interval(secs => p_seconds)
  where id and (busy_until is null or busy_until < now());
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function public.tgr_group_tick(p_group bigint, p_last bigint, p_seen int, p_hits int, p_error text) returns void
language sql security definer set search_path = '' as $$
  update public.tgr_groups set
    last_msg_id = coalesce(p_last, last_msg_id), last_checked_at = now(), last_error = p_error,
    seen = seen + coalesce(p_seen, 0), hits = hits + coalesce(p_hits, 0)
  where id = p_group;
$$;
revoke all on function public.tgr_lock(int), public.tgr_group_tick(bigint, bigint, int, int, text) from public, anon, authenticated;
grant execute on function public.tgr_lock(int), public.tgr_group_tick(bigint, bigint, int, int, text) to service_role;

-- токен розкладу (ним pg_cron підписує запит до /api/tg-radar/run)
insert into public.app_secrets (key, value)
select 'tgr_token', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
where not exists (select 1 from public.app_secrets where key = 'tgr_token');

-- розклад: кожні 10 хвилин; запит іде лише коли радар увімкнено й акаунт підключено
select cron.schedule('tg-radar', '*/10 * * * *', $cron$
  select net.http_get(
    url := 'https://app.moduler.pro/api/tg-radar/run',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select value from public.app_secrets where key = 'tgr_token')),
    timeout_milliseconds := 120000)
  where (select enabled and acc_state = 'ok' from public.tgr_settings);
$cron$);

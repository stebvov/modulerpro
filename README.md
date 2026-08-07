# Moduler Pro

Next.js застосунок для управління виробництвом модульних будинків: каталог
шаблонів, BOM/статті витрат, матеріали, постачальники, категорії та ціни за
товаром/постачальником. Backend — Supabase (проєкт `modulerpro-v2`,
ref `uaufrrpfvixhprqhqjzo`), з автентифікацією та рольовим доступом (RLS).

## Стек

- Next.js 16 (App Router), React 19
- Supabase (Postgres + Auth + Storage), `@supabase/ssr`
- Чистий CSS (без UI-фреймворку), проксі (`src/proxy.js`) для захисту роутів

## Ролі та доступ

Кожен користувач має рядок у `public.profiles` з роллю:

| Роль | Читання | Запис |
| --- | --- | --- |
| `admin` (адмін) | все | все, включно з ролями користувачів |
| `manager` (менеджер) | все | каталог шаблонів, BOM, статті витрат, файли, матеріали, постачальники, категорії |
| `accountant` (бухгалтер) | все | ціни постачальників (`supplier_prices`), курси валют (`exchange_rates`) |

Все це реалізовано через RLS-політики в Supabase (не в застосунку) — прямий
запит до API без відповідної ролі буде відхилений базою даних.

**Перший зареєстрований користувач автоматично стає адміном.** Усі наступні
реєстрації отримують роль «Менеджер»; адмін змінює ролі на вкладці
«Користувачі» в застосунку.

## Локальний запуск

```bash
npm install
cp .env.example .env.local   # вкажи URL і publishable key свого Supabase-проєкту
npm run dev
```

Відкрий [http://localhost:3000](http://localhost:3000). Перший запуск
відкриє форму входу — натисни «Зареєструватися», щоб створити першого
користувача (адміна).

### Змінні середовища

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable/anon key>
```

Обидва значення публічні (анонімний/publishable ключ), безпечні для
клієнтського коду — увесь захист даних забезпечує RLS на стороні бази.

## Структура

```
src/
  app/            # маршрути App Router (/, /login)
  components/      # AppShell, екрани-вкладки, модалки
  context/         # AuthContext (сесія/роль), DataContext (дані з Supabase)
  lib/             # supabase-клієнти, форматування, допоміжні функції
  proxy.js         # захист роутів (редірект на /login без сесії)
```

Дані для всіх вкладок завантажуються один раз у `DataContext` і
перезавантажуються (`reload()`) після кожної мутації — так само, як у
прототипі, з яким звірялась логіка застосунку.

## База даних / Supabase

Міграції застосовано напряму через Supabase MCP (roles/profiles, RLS-політики
під ролі, storage-політики для бакета `template-files`, security-хардентінг
тригер-функцій і в’юх). Список змін:

1. `roles_and_profiles` — enum `user_role`, таблиця `profiles`, тригер
   автопровізіонування при реєстрації, функція `current_user_role()`.
2. `harden_trigger_functions_security_definer` — тригери перерахунку
   собівартості та історії цін переведені на `SECURITY DEFINER`, щоб
   спрацьовувати незалежно від того, чия роль ініціювала зміну.
3. `role_based_rls_policies` — видалення policy `demo open *`, додавання
   рольових policy на читання (усі автентифіковані) та запис (за доменом).
4. `storage_policies_template_files` — публічне читання файлів шаблонів,
   запис/видалення лише для admin/manager.
5. `security_hardening_views_and_function_grants` — `security_invoker` для
   обчислюваних в’юх, звуження `EXECUTE` на внутрішніх тригер-функціях.

Щоб змінити схему далі — використовуй Supabase MCP (`apply_migration`) або
Supabase Dashboard; проєкт не використовує CLI-міграції у цьому репозиторії.

## Деплой

### Vercel (рекомендовано)

Next.js визначається автоматично — конфігурація не потрібна.

1. Імпортуй репозиторій на [vercel.com/new](https://vercel.com/new).
2. Додай змінні середовища `NEXT_PUBLIC_SUPABASE_URL` і
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` у Project Settings → Environment Variables.
3. Deploy.

### Netlify

У репозиторії є `netlify.toml` з плагіном `@netlify/plugin-nextjs`.

1. New site from Git → обери репозиторій (build command і publish дір вже
   прописані в `netlify.toml`).
2. Додай ті самі змінні середовища в Site settings → Environment variables.
3. Deploy.

### GitHub Actions

`.github/workflows/build.yml` лише перевіряє лінт і збірку на push/PR — це
CI-перевірка, не деплой (деплой веде Vercel/Netlify через власну git-інтеграцію).
Щоб CI мав доступ до Supabase-змінних, додай ті самі два секрети в
Settings → Secrets and variables → Actions.

-- 2026-10-03: воронка «Ліди 2026» (slug leads-2026) — типова для нових квізів; роль «Таргетолог» (квізи + CRM цієї воронки з редагуванням).
alter table public.quizzes alter column pipeline set default 'leads-2026';

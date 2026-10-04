-- 📣 Маркетинг: кампанії ↔ ліди ↔ витрати (застосовано через MCP 04.10.2026; тут — копія для історії)
-- campaigns: quiz_id, utm_campaign, fb_campaign_id, leads_manual, spend_manual, source_kind
-- leads.campaign_id (тригери: з квізу — lead_campaign_from_quiz на quiz_responses; з utm_campaign — lead_campaign_from_utm)
-- transactions.campaign_id, transactions.allocations [{project, pct}]
-- transaction_categories: «Маркетинг» (opex) → Реклама — бюджет / Таргетолог / підрядник / Сервіси: квізи, CRM, боти / Контент і зйомка / Маркетинг — інше
-- marketing_stats(p_from, p_to) — security definer, лише агрегати; доступ: admin/manager/accountant або роль із вкладкою marketing/quizzes
-- campaigns_partner_insert / campaigns_partner_update — роль із доступом (вкладка marketing або quizzes) веде кампанії
alter table public.campaigns
  add column if not exists quiz_id uuid references public.quizzes(id) on delete set null,
  add column if not exists utm_campaign text,
  add column if not exists fb_campaign_id text,
  add column if not exists leads_manual integer not null default 0,
  add column if not exists spend_manual numeric not null default 0,
  add column if not exists source_kind text;
alter table public.leads add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;
alter table public.transactions
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null,
  add column if not exists allocations jsonb;

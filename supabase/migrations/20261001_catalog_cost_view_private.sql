-- Собівартість і ціна моделей — лише для команди: представлення читає таблиці з правами того, хто питає (RLS), а не власника.
alter view public.template_cost_calculated set (security_invoker = true);
revoke all on public.template_cost_calculated from anon;

-- Дані оренди (бронювання, гості, витрати, журнал) — лише для тих, хто увійшов у систему.
-- Представлення читають і пишуть таблиці схеми rental з правами власника, тож анонімний доступ до них = відкриті дані.
revoke all on public.rental_audit_log, public.rental_bookings, public.rental_expenses, public.rental_guests,
  public.rental_houses, public.rental_monthly, public.rental_promos, public.rental_rate_periods from anon;

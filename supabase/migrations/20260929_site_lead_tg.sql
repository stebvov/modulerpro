-- Заявка з сайту → миттєво в Telegram власнику (дубль до CRM «Продажі → Ліди»).
-- Раніше сайт-ліди потрапляли в Telegram лише в щоденному дайджесті о 17:00 (pult_events_digest).

create or replace function public.site_lead_tg(l public.leads) returns void
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select id into owner from public.task_members where is_owner and active order by sort nulls last limit 1;
  if owner is null then return; end if;
  perform public.pult_tg(owner,
    '📥 Заявка з сайту' || E'\n\n'
    || '👤 ' || coalesce(nullif(btrim(l.name), ''), '—') || E'\n'
    || '📞 ' || coalesce(nullif(btrim(l.phone), ''), '—')
    || coalesce(E'\n\n' || left(l.notes, 3000), '')
    || E'\n\nВідкрити в CRM: https://app.moduler.pro/?s=crm');
exception when others then raise warning 'site_lead_tg: %', sqlerrm;
end $$;

create or replace function public.site_lead_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.source::text = 'сайт' then perform public.site_lead_tg(new); end if;
  return new;
exception when others then raise warning 'site_lead_notify: %', sqlerrm; return new;
end $$;

drop trigger if exists site_lead_tg on public.leads;
create trigger site_lead_tg after insert on public.leads for each row execute function public.site_lead_notify();

revoke all on function public.site_lead_tg(public.leads) from public, anon, authenticated;
revoke all on function public.site_lead_notify() from public, anon, authenticated;

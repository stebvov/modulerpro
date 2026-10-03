// 🛒 Товари каталогу: ціна джерела (сайт продавця) → наша ціна для клієнта (своя або з націнкою %).
// Усі суми зберігаються у своїй валюті; для показу переводимо через гривню (exchange_rates.rate_to_uah).

export const CURS = [["UAH", "грн"], ["USD", "$"], ["EUR", "€"]];

export function rateOf(code, rates) {
  if (!code || code === "UAH") return 1;
  return Number(rates.find((r) => r.code === code)?.rate_to_uah) || 1;
}
export const toUah = (amount, cur, rates) => (amount == null || amount === "" ? null : Number(amount) * rateOf(cur, rates));

// валюта сторінки товару → наш код (UAH, USD, EUR)
export function normCur(c) {
  const s = String(c || "").toUpperCase();
  if (/USD|\$/.test(s)) return "USD";
  if (/EUR|€/.test(s)) return "EUR";
  return "UAH";
}

// ціни товару в гривні: джерело, клієнт, маржа
export function productPrices(p, rates) {
  const source = toUah(p.source_price, p.source_currency, rates);
  const client = p.price_mode === "fixed"
    ? toUah(p.client_price, p.client_currency, rates)
    : source == null ? null : source * (1 + (Number(p.markup_percent) || 0) / 100);
  const margin = client != null && source != null ? client - source : null;
  const pct = margin != null && source ? (margin / source) * 100 : null;
  return { source, client, margin, pct };
}

export const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

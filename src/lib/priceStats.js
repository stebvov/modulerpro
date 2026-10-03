// Зведення цін: мінімальна / середня / максимальна по матеріалу і порівняння ціни одного постачальника з рештою.
// Спільне для «Цін постачальників» (за товаром, за постачальником) і картки цін матеріалу.
import { fmtCurrency } from "@/lib/format";
import { fmtPrice } from "@/lib/market";

// посилання на товар: парсер і ручне внесення пишуть його в примітку до ціни
export const priceLink = (p) => /https?:\/\/[^\s]+/.exec(p?.note || "")?.[0] || null;
// примітка без посилання — що саме за товар
export const priceTitle = (p) => (p?.note || "").replace(/https?:\/\/[^\s]+/g, "").replace(/[\s·—-]+$/, "").trim();

export function priceStats(prices) {
  if (!prices.length) return { n: 0, min: null, max: null, avg: null, cheapest: null, fresh: null };
  const values = prices.map((p) => Number(p.price));
  const min = Math.min(...values);
  return {
    n: prices.length,
    min,
    max: Math.max(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    cheapest: prices.find((p) => Number(p.price) === min),
    fresh: prices.map((p) => p.updated_at).sort().pop(),
  };
}

// На скільки ціна відрізняється від бази: { abs, pct } (плюс — дорожче); null, якщо порівнювати нема з чим
export function diff(value, base) {
  if (value == null || base == null || !(base > 0)) return null;
  const abs = value - base;
  return { abs, pct: (abs / base) * 100 };
}

// Ціна постачальника проти решти постачальників того самого матеріалу: до найнижчої та до середньої серед інших
export function compare(price, prices) {
  if (!price) return { min: null, avg: null };
  const others = prices.filter((p) => p.supplier_id !== price.supplier_id).map((p) => Number(p.price));
  if (!others.length) return { min: null, avg: null };
  const value = Number(price.price);
  return { min: diff(value, Math.min(...others)), avg: diff(value, others.reduce((a, b) => a + b, 0) / others.length) };
}

export const diffGroup = (d) => (!d ? "" : Math.abs(d.pct) < 0.05 ? "однаково" : d.abs > 0 ? "дорожче" : "дешевше");

// сума для щільних списків: у гривні копійки лише для дрібних сум (до 100 грн — ціни за штуку), решта — цілими;
// в іншій валюті — як усюди в системі. Точна ціна — у картці матеріалу.
export const money = (v, currency, exchangeRates, showDecimals) =>
  v == null ? "—" : currency === "UAH" ? fmtPrice(v, Math.abs(v) >= 100 ? 0 : 2) : fmtCurrency(v, currency, exchangeRates, showDecimals);

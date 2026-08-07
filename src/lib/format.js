export const statusLabels = { active: "Активний", draft: "Чернетка", archived: "Архів" };
export const currencySymbols = { UAH: "грн", USD: "$", EUR: "€" };

export function daysAgo(ts) {
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}

export function isStale(ts) {
  return daysAgo(ts) > 30;
}

// Renders plain text with any http(s)/www links turned into clickable <a> tags.
export function linkify(text) {
  if (!text) return null;
  const parts = text.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part) || /^www\./.test(part)) {
      const href = part.startsWith("http") ? part : "https://" + part;
      return (
        <a key={i} href={href} target="_blank" rel="noreferrer">
          {part}
        </a>
      );
    }
    return part ? <span key={i}>{part}</span> : null;
  });
}

export function convert(amountUah, currency, exchangeRates) {
  if (amountUah == null) return null;
  const rate = (exchangeRates.find((r) => r.code === currency) || { rate_to_uah: 1 }).rate_to_uah;
  return Number(amountUah) / Number(rate);
}

export function fmtCurrency(amountUah, currency, exchangeRates) {
  const v = convert(amountUah, currency, exchangeRates);
  if (v == null) return "—";
  return (
    Number(v).toLocaleString("uk-UA", { maximumFractionDigits: currency === "UAH" ? 0 : 2 }) +
    " " +
    currencySymbols[currency]
  );
}

export function templateTotalUah(t) {
  if (t.base_cost_per_m2 == null) return null;
  return Number(t.base_cost_per_m2) * Number(t.area_m2);
}

export function detectContactType(value) {
  const v = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "email";
  if (/^@[\w]+$/.test(v) || /t\.me\//.test(v) || /telegram/i.test(v)) return "telegram";
  if (/google\.com\/maps|maps\.app\.goo\.gl/.test(v)) return "maps";
  if (/^https?:\/\//.test(v) || /^www\./.test(v)) return "website";
  if (/^[+\d][\d\s\-()]{6,}$/.test(v)) return "phone";
  return "other";
}

export const contactTypeLabels = {
  phone: "Тел",
  telegram: "TG",
  email: "Email",
  website: "Сайт",
  maps: "Карта",
  address: "Адреса",
  other: "Інше",
};

export function contactHref(type, value) {
  if (type === "phone") return "tel:" + value.replace(/[^\d+]/g, "");
  if (type === "email") return "mailto:" + value;
  if (type === "telegram")
    return value.startsWith("@") ? "https://t.me/" + value.slice(1) : value.startsWith("http") ? value : "https://" + value;
  if (type === "website" || type === "maps") return value.startsWith("http") ? value : "https://" + value;
  return null;
}

export const roleLabels = { admin: "Адмін", manager: "Менеджер", accountant: "Бухгалтер" };

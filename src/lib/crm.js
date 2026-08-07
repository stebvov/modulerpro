export const CONTACT_TYPES = ["телефон", "email", "telegram", "viber", "whatsapp", "інше"];
export const ACTIVITY_TYPES = [
  { key: "дзвінок", icon: "📞" },
  { key: "telegram", icon: "✈️" },
  { key: "email", icon: "✉️" },
  { key: "зустріч", icon: "🤝" },
  { key: "інше", icon: "•" },
];
export const SERVICE_TYPES = ["монтаж", "доставка", "фундамент", "під_ключ"];
export const LEAD_SOURCES = ["сайт", "реклама", "рекомендація", "вхідний_дзвінок"];
export const LEAD_STATUSES = ["новий", "кваліфікований", "відхилений"];

// service_rate_cards has no rows for "під_ключ" and no is_average rows yet,
// so the "середнє" (ballpark) calc method still falls back to these fixed
// estimates client-side, same as the prototype.
export const AVERAGE_ESTIMATE = { монтаж: 18000, доставка: 5000, фундамент: 45000, під_ключ: 60000 };

export function findRateCard(rateCards, serviceType, variant) {
  return rateCards.find((r) => r.service_type === serviceType && r.variant === (variant || null));
}

export function foundationVariants(rateCards) {
  return [...new Set(rateCards.filter((r) => r.service_type === "фундамент").map((r) => r.variant))].filter(Boolean);
}

export function avgCostPerM2(templates) {
  const priced = templates.filter((t) => t.base_cost_per_m2 != null);
  if (!priced.length) return 0;
  return Math.round(priced.reduce((s, t) => s + Number(t.base_cost_per_m2), 0) / priced.length);
}

const COLD = [47, 93, 138];
const HOT = [193, 101, 47];
export function stageColor(index, total) {
  const t = total > 1 ? index / (total - 1) : 0;
  const rgb = COLD.map((c, i) => Math.round(c + (HOT[i] - c) * t));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function curr(n) {
  return Math.round(Number(n) || 0).toLocaleString("uk-UA");
}

export function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";
}

export function fmtDateTime(iso) {
  return iso
    ? new Date(iso).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
}

export function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function slugify(s) {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zа-яїієґ0-9_]/gi, "") || Math.random().toString(36).slice(2, 7)
  );
}

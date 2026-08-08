export const GOAL_NET_PROFIT_USD = 1_000_000;

export const TRANSACTION_TYPES = [
  "дохід-виробництво",
  "дохід-послуга",
  "витрата-матеріали",
  "витрата-зп",
  "витрата-послуга",
  "витрата-офіс",
];

export function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export function marginProduction(row) {
  return Number(row.revenue_production || 0) - Number(row.cost_materials || 0) - Number(row.cost_labor || 0);
}

export function marginServices(row) {
  return Number(row.revenue_services || 0) - Number(row.cost_services || 0);
}

export function marginPct(margin, revenue) {
  const r = Number(revenue || 0);
  return r > 0 ? (margin / r) * 100 : 0;
}

export function fmtMonthLong(dateStr) {
  return new Date(dateStr).toLocaleDateString("uk-UA", { month: "long", year: "numeric" });
}

export function fmtMonthShort(dateStr) {
  return new Date(dateStr).toLocaleDateString("uk-UA", { month: "short", year: "2-digit" });
}

export function fmtUsd(n) {
  const v = Number(n || 0);
  return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

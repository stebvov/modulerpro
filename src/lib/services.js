export const SERVICE_TYPE_LABELS = {
  доставка: "Доставка",
  фундамент: "Фундамент",
  монтаж: "Монтаж",
  під_ключ: "Під ключ",
};

export const SERVICE_TYPE_ICONS = {
  доставка: "🚚",
  фундамент: "🧱",
  монтаж: "🔧",
  під_ключ: "🔑",
};

export const EXECUTOR_TYPES = ["партнер", "власна_бригада"];

export const EXECUTION_STATUSES = ["заплановано", "в_процесі", "завершено"];

export const statusStyles = {
  заплановано: { bg: "var(--border)", text: "var(--text-secondary)" },
  в_процесі: { bg: "var(--amber-bg)", text: "var(--amber)" },
  завершено: { bg: "var(--success-bg)", text: "var(--success)" },
};

export const EXPENSE_FIELDS = [
  { key: "відрядження", label: "Відрядження" },
  { key: "проживання", label: "Проживання" },
  { key: "доп_матеріали", label: "Доп. матеріали" },
  { key: "оплата_виконавцю", label: "Оплата виконавцю" },
];

export function actualTotal(execution) {
  const t = execution.trip_expenses || {};
  return EXPENSE_FIELDS.reduce((sum, f) => sum + (Number(t[f.key]) || 0), 0);
}

export function curr(n) {
  if (n === null || n === undefined) return "—";
  return Math.round(Number(n)).toLocaleString("uk-UA") + " грн";
}

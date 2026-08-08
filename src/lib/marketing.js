export const ASSET_TYPE_LABELS = {
  фото: "Фото",
  відео: "Відео",
  "текст-пост": "Текст-пост",
  рекламний_креатив: "Рекламний креатив",
};

export const ASSET_TYPE_ICONS = {
  фото: "◈",
  відео: "▶",
  "текст-пост": "✎",
  рекламний_креатив: "▲",
};

export const ASSET_STATUSES = ["чернетка", "на_затвердження", "опубліковано"];

export const assetStatusStyles = {
  чернетка: { bg: "var(--border)", text: "var(--text-secondary)" },
  на_затвердження: { bg: "var(--amber-bg)", text: "var(--amber)" },
  опубліковано: { bg: "var(--success-bg)", text: "var(--success)" },
};

export const CHANNELS = ["instagram", "facebook", "сайт", "google_ads"];

export const CHANNEL_LABELS = {
  instagram: "instagram",
  facebook: "facebook",
  сайт: "сайт",
  google_ads: "google ads",
};

// Reuses the app's existing semantic colors instead of inventing a new
// per-channel palette — each channel just borrows one of the four tokens
// already used everywhere else (accent/success/amber/text-secondary).
export const CHANNEL_COLORS = {
  instagram: "var(--accent)",
  facebook: "var(--success)",
  сайт: "var(--amber)",
  google_ads: "var(--text-secondary)",
};

export const CAMPAIGN_STATUSES = ["активна", "пауза", "завершена"];

export const campaignStatusStyles = {
  активна: { bg: "var(--success-bg)", text: "var(--success)" },
  пауза: { bg: "var(--border)", text: "var(--text-secondary)" },
  завершена: { bg: "var(--accent-bg)", text: "var(--accent)" },
};

export const MONTHS = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

export function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

// Monday-first 6-week (42 cell) grid covering the given month, including
// the leading/trailing days from adjacent months needed to fill full weeks.
export function monthGridCells(monthStart) {
  const y = monthStart.getFullYear();
  const m = monthStart.getMonth();
  const first = new Date(y, m, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrev = new Date(y, m, 0).getDate();

  const cells = [];
  for (let i = startOffset; i > 0; i--) {
    cells.push({ outside: true, date: new Date(y, m - 1, daysInPrev - i + 1) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ outside: false, date: new Date(y, m, d) });
  }
  while (cells.length % 7 !== 0) {
    const idx = cells.length - startOffset - daysInMonth + 1;
    cells.push({ outside: true, date: new Date(y, m + 1, idx) });
  }
  return cells;
}

export function toDateKey(d) {
  return d.toISOString().slice(0, 10);
}

export function curr(n) {
  if (n === null || n === undefined) return "—";
  return Math.round(Number(n)).toLocaleString("uk-UA") + " грн";
}

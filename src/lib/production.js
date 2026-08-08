export const SLOT_STATUSES = ["вільний", "заброньований", "в роботі", "готово"];
export const STAGE_NAMES = ["каркас", "стіни", "дах", "оздоблення", "готово до самовивозу"];

// Reuses the same badge-style tokens as the rest of the app (.tag/.badge:
// light tint background + saturated text) instead of inventing new colors.
export const statusStyles = {
  вільний: { bg: "var(--border)", text: "var(--text-secondary)" },
  заброньований: { bg: "var(--accent-bg)", text: "var(--accent)" },
  "в роботі": { bg: "var(--amber-bg)", text: "var(--amber)" },
  готово: { bg: "var(--success-bg)", text: "var(--success)" },
};

const DAY = 86400000;

export function startOfWeek(d) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

export function addDays(d, n) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

export function addWeeks(d, n) {
  return addDays(d, n * 7);
}

export function toDateInputValue(d) {
  return new Date(d).toISOString().slice(0, 10);
}

export function fmtWeekLabel(weekStart) {
  const end = addDays(weekStart, 6);
  const fmt = (x) => x.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" });
  return `${fmt(weekStart)}–${fmt(end)}`;
}

// Percentage offset/width of a [start,end] date range within a [windowStart,windowEnd] window,
// clamped to the window — used to position Gantt bars.
export function rangeToPercent(start, end, windowStart, windowEnd) {
  const total = (windowEnd - windowStart) / DAY;
  const s = Math.max(windowStart, new Date(start).getTime());
  const e = Math.min(windowEnd, new Date(end).getTime() + DAY);
  if (e <= windowStart || s >= windowEnd || total <= 0) return null;
  const left = ((s - windowStart) / DAY / total) * 100;
  const width = Math.max(((e - s) / DAY / total) * 100, 1);
  return { left, width };
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart).getTime() <= new Date(bEnd).getTime() && new Date(aEnd).getTime() >= new Date(bStart).getTime();
}

// Utilization % for a site over the next 4 weeks: count of non-"вільний" slots
// overlapping the window vs. the site's monthly unit capacity (~4 weeks).
export function siteUtilization(site, slots) {
  if (!site.capacity_units_per_month) return null;
  const windowStart = new Date();
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = addWeeks(windowStart, 4);
  const active = slots.filter(
    (s) => s.site_id === site.id && s.status !== "вільний" && overlaps(s.start_date, s.deadline, windowStart, windowEnd)
  );
  return Math.round((active.length / site.capacity_units_per_month) * 100);
}

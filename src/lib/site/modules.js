// Модулі моделі: module_dims = [{ w, l }] у метрах (ширина × довжина кожного модуля).
// За шириною модуля й кількістю модулів фільтрується каталог на сайті й список моделей у конструкторі.
// Файл без залежностей: ним користуються сайт, конструктор і службові скрипти.

// типові ширини модулів — у такому порядку стоять у фільтрі; інші ширини з даних додаються самі
export const MODULE_WIDTHS = [2.5, 3, 3.2, 3.4, 3.6, 4];

const n = (v) => {
  const x = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) && x > 0 ? Math.round(x * 100) / 100 : null;
};

export const moduleDims = (m) => (Array.isArray(m?.module_dims) ? m.module_dims : []).map((d) => ({ w: n(d?.w), l: n(d?.l) })).filter((d) => d.w);
// ширини модулів моделі без повторів: дім із модулів 4 × 6,8 і 3,4 × 6 знайдеться і за «4», і за «3,4»
export const moduleWidths = (m) => [...new Set(moduleDims(m).map((d) => d.w))].sort((a, b) => a - b);
export const moduleCount = (m) => {
  const c = Number(m?.modules);
  return Number.isFinite(c) && c > 0 ? c : moduleDims(m).length || null;
};

// «3 × 6,5 м» або «3 × 6,5 м, 3 × 3,25 м» — однакові модулі не повторюємо
export function moduleDimsText(m, fmt = (v) => String(v).replace(".", ","), unit = "м") {
  const seen = [];
  for (const d of moduleDims(m)) {
    const s = d.l ? `${fmt(d.w)} × ${fmt(d.l)} ${unit}` : `${fmt(d.w)} ${unit}`;
    if (!seen.includes(s)) seen.push(s);
  }
  return seen.join(", ");
}

// варіанти для фільтра з наявних моделей: ширини (спершу типові) і кількості модулів
export function moduleFilterOptions(list) {
  const ws = new Set(), cs = new Set();
  for (const m of list || []) {
    moduleWidths(m).forEach((w) => ws.add(w));
    const c = moduleCount(m);
    if (c) cs.add(c);
  }
  const widths = [...MODULE_WIDTHS.filter((w) => ws.has(w)), ...[...ws].filter((w) => !MODULE_WIDTHS.includes(w)).sort((a, b) => a - b)];
  return { widths, counts: [...cs].sort((a, b) => a - b) };
}

export const matchesModules = (m, width, count) => (!width || moduleWidths(m).includes(Number(width))) && (!count || moduleCount(m) === Number(count));

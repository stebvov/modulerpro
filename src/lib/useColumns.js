"use client";

// Стовпчики таблиці як в Excel: клік по назві — сортування А→Я / Я→А, стрілка поруч — список значень із галочками (можна кілька).
// cols: { ключ: { value: (рядок) => текст | число | масив текстів, sort?: (рядок) => текст | число, text?: (значення) => підпис у списку } }
// Показ — компонент ColHead: <ColHead t={t} k="name">Назва</ColHead>.
import { useCallback, useMemo, useState } from "react";

const EMPTY = "";
const norm = (v) => (v == null ? EMPTY : v);
const asList = (v) => (Array.isArray(v) ? (v.length ? v.map(norm) : [EMPTY]) : [norm(v)]);

export function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "uk", { numeric: true, sensitivity: "base" });
}

export function useColumns(rows, cols) {
  const [sort, setSort] = useState(null); // { key, dir: 1 (А→Я) | -1 (Я→А) }
  const [filters, setFilters] = useState({}); // { ключ: [вибрані значення] }; порожньо — без фільтра

  // чи проходить рядок усі фільтри (skipKey — крім цього стовпчика: так список значень залежить від інших фільтрів)
  const passes = useCallback((row, skipKey) => {
    for (const k in filters) {
      const sel = filters[k];
      if (!sel?.length || k === skipKey || !cols[k]) continue;
      if (!asList(cols[k].value(row)).some((v) => sel.includes(v))) return false;
    }
    return true;
  }, [filters, cols]);

  // сортування окремо від фільтра — щоб групові таблиці (ціни за товаром / постачальником) могли сортувати свої рядки
  const sortRows = useCallback((list) => {
    const c = sort && cols[sort.key];
    if (!c) return list;
    const val = (r) => { const v = c.sort ? c.sort(r) : c.value(r); return Array.isArray(v) ? v.join(", ") : norm(v); };
    return list.map((r, i) => [val(r), i, r]).sort((x, y) => {
      const ex = x[0] === EMPTY, ey = y[0] === EMPTY; // порожні — завжди в кінці
      if (ex || ey) return ex === ey ? x[1] - y[1] : ex ? 1 : -1;
      return compareValues(x[0], y[0]) * sort.dir || x[1] - y[1];
    }).map((x) => x[2]);
  }, [sort, cols]);

  const view = useMemo(() => sortRows(rows.filter((r) => passes(r))), [rows, passes, sortRows]);

  const optionsOf = useCallback((key) => {
    const c = cols[key];
    if (!c) return [];
    const count = new Map();
    for (const r of rows) {
      if (!passes(r, key)) continue;
      for (const v of asList(c.value(r))) count.set(v, (count.get(v) || 0) + 1);
    }
    // вибране значення, якого вже немає серед рядків, лишається у списку — щоб його можна було зняти
    for (const v of filters[key] || []) if (!count.has(v)) count.set(v, 0);
    return [...count]
      .map(([value, n]) => ({ value, n, label: value === EMPTY ? "(порожньо)" : c.text ? c.text(value) : String(value) }))
      .sort((a, b) => (a.value === EMPTY) - (b.value === EMPTY) || compareValues(a.value, b.value));
  }, [rows, cols, filters, passes]);

  const head = useCallback((key) => ({
    dir: sort?.key === key ? sort.dir : 0,
    // назва: А→Я, ще раз — Я→А, третій раз — як було
    toggleSort: () => setSort((s) => (s?.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null)),
    setSort: (dir) => setSort(dir ? { key, dir } : null),
    selected: filters[key] || [],
    setSelected: (list) => setFilters((f) => ({ ...f, [key]: list })),
    options: () => optionsOf(key),
  }), [sort, filters, optionsOf]);

  const active = Object.values(filters).filter((v) => v?.length).length;
  const reset = useCallback(() => { setFilters({}); setSort(null); }, []);

  return { rows: view, head, active, sorted: !!sort, reset, passes, sortRows, selected: (key) => filters[key] || [] };
}

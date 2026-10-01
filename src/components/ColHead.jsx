"use client";

// Заголовок стовпчика: клік по назві — сортування (А→Я, ще раз Я→А, третій раз — як було),
// стрілка ▾ поруч — список значень із галочками (одне або кілька) і пошуком. Стан — у useColumns (lib/useColumns.js).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDropdownPosition } from "@/lib/useFloatingDropdown";

export default function ColHead({ t, k, children, num, noFilter, noSort, extra, style }) {
  const h = t.head(k);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const btn = useRef(null);
  const pop = useRef(null);
  const pos = useDropdownPosition(open, btn);

  useEffect(() => {
    if (!open) return;
    function outside(e) {
      if (btn.current?.contains(e.target) || pop.current?.contains(e.target)) return;
      setOpen(false); setQ("");
    }
    function esc(e) { if (e.key === "Escape") { setOpen(false); setQ(""); } }
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", esc); };
  }, [open]);

  const sel = h.selected;
  const opts = open ? h.options() : [];
  const s = q.trim().toLowerCase();
  const list = s ? opts.filter((o) => o.label.toLowerCase().includes(s)) : opts;
  const toggle = (v) => h.setSelected(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]);
  // список не має вилазити за правий край екрана
  const left = pos ? Math.max(8, Math.min(pos.left, (typeof window !== "undefined" ? window.innerWidth : 1200) - 268)) : 0;

  return (
    <th className={`col-th${num ? " num" : ""}`} style={style} aria-sort={h.dir === 1 ? "ascending" : h.dir === -1 ? "descending" : undefined}>
      <span className="col-head">
        {noSort ? <span>{children}</span> : (
          <button type="button" className={`col-sort${h.dir ? " on" : ""}`} onClick={h.toggleSort} title="Сортувати: клік — А→Я, ще раз — Я→А, третій раз — як було">
            {children}<span className="col-arrow" aria-hidden="true">{h.dir === 1 ? "▲" : h.dir === -1 ? "▼" : ""}</span>
          </button>
        )}
        {!noFilter && (
          <button ref={btn} type="button" className={`col-filter${sel.length ? " on" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}
            aria-label="Фільтр стовпчика" title={sel.length ? `Фільтр увімкнено: вибрано ${sel.length}` : "Фільтр: вибрати значення"}>
            ▾{sel.length > 0 && <span className="col-n">{sel.length}</span>}
          </button>
        )}
        {extra}
      </span>
      {open && pos && createPortal(
        <div ref={pop} className="ms-filter-list col-pop" style={{ position: "fixed", top: pos.top, left, zIndex: 1000 }}>
          <input type="text" className="ms-filter-search" placeholder="🔍 Пошук у списку…" value={q} autoFocus onChange={(e) => setQ(e.target.value)} aria-label="Пошук у списку значень" />
          {!noSort && (
            <>
              <div className={`ms-filter-item${h.dir === 1 ? " col-on" : ""}`} onMouseDown={(e) => { e.preventDefault(); h.setSort(h.dir === 1 ? 0 : 1); }}>▲ Сортувати від А до Я</div>
              <div className={`ms-filter-item col-sep${h.dir === -1 ? " col-on" : ""}`} onMouseDown={(e) => { e.preventDefault(); h.setSort(h.dir === -1 ? 0 : -1); }}>▼ Сортувати від Я до А</div>
            </>
          )}
          {sel.length > 0 && (
            <div className="ms-filter-item ms-filter-clear" onMouseDown={(e) => { e.preventDefault(); h.setSelected([]); }}>✕ Показати всі (зняти фільтр)</div>
          )}
          {s && list.length > 1 && (
            <div className="ms-filter-item ms-filter-clear" onMouseDown={(e) => { e.preventDefault(); h.setSelected([...new Set([...sel, ...list.map((o) => o.value)])]); }}>☑ Вибрати всі знайдені ({list.length})</div>
          )}
          {list.map((o) => (
            <label className="ms-filter-item" key={`${typeof o.value}-${o.value}`}>
              <input type="checkbox" checked={sel.includes(o.value)} onChange={() => toggle(o.value)} />
              <span className="col-lbl">{o.label}</span><span className="col-cnt">{o.n}</span>
            </label>
          ))}
          {!list.length && <div className="ms-filter-empty">Нічого не знайдено</div>}
        </div>,
        document.body
      )}
    </th>
  );
}

// «Скинути фільтри й сортування» — кнопка для панелі над таблицею (видно лише коли щось увімкнено)
export function ColReset({ t }) {
  if (!t.active && !t.sorted) return null;
  return (
    <button type="button" className="btn small" onClick={t.reset} title="Зняти всі фільтри стовпчиків і сортування">
      ✕ Скинути {t.active ? `фільтри (${t.active})` : "сортування"}
    </button>
  );
}

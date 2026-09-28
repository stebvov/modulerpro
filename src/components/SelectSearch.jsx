"use client";

// Випадний список довідника, де першим рядком — поле пошуку.
// options: [{ value, label, depth?, hint? }] — depth дає відступ для вкладених категорій.
// allowCreate: якщо ввели те, чого немає, — «+ Додати «…»» (onCreate(text) повертає нове value).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDropdownPosition } from "@/lib/useFloatingDropdown";

export default function SelectSearch({ value, options, onChange, placeholder = "— обрати —", emptyLabel, width, onCreate, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const btn = useRef(null);
  const pop = useRef(null);
  const input = useRef(null);
  const pos = useDropdownPosition(open, btn);
  const cur = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => input.current?.focus(), 0);
    function outside(e) { if (!btn.current?.contains(e.target) && !pop.current?.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", outside);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", outside); };
  }, [open]);

  const s = q.trim().toLowerCase();
  const list = [
    ...(emptyLabel != null ? [{ value: "", label: emptyLabel }] : []),
    ...options.filter((o) => !s || o.label.toLowerCase().includes(s) || (o.hint || "").toLowerCase().includes(s)),
  ];
  const canCreate = onCreate && s && !options.some((o) => o.label.toLowerCase() === s);

  async function pick(v) {
    onChange(v);
    setOpen(false); setQ(""); setHi(0);
    btn.current?.focus();
  }
  async function create() {
    const v = await onCreate(q.trim());
    if (v != null) pick(v);
  }
  function key(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (list[hi]) pick(list[hi].value); else if (canCreate) create(); }
    else if (e.key === "Escape") { setOpen(false); btn.current?.focus(); }
  }

  return (
    <>
      <button type="button" ref={btn} className="ss-btn" style={{ width }} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}>
        <span className={cur ? "" : "ss-ph"}>{cur ? cur.label : placeholder}</span>
        <span aria-hidden="true" className="ss-caret">▾</span>
      </button>
      {open && pos && createPortal(
        <div ref={pop} className="ss-pop" style={{ top: pos.top, left: pos.left, minWidth: Math.max(pos.width, 220) }} role="listbox">
          <input ref={input} className="ss-q" value={q} onChange={(e) => { setQ(e.target.value); setHi(0); }} onKeyDown={key} placeholder="🔍 Пошук…" aria-label="Пошук у списку" />
          <div className="ss-list">
            {list.map((o, i) => (
              <button type="button" key={o.value || "∅"} role="option" aria-selected={o.value === value}
                className={`ss-opt${i === hi ? " hi" : ""}${o.value === value ? " on" : ""}`} style={{ paddingLeft: 10 + (o.depth || 0) * 14 }}
                onMouseEnter={() => setHi(i)} onClick={() => pick(o.value)}>
                {o.label}{o.hint && <span className="ss-hint">{o.hint}</span>}
              </button>
            ))}
            {!list.length && !canCreate && <div className="ss-empty">Нічого не знайдено</div>}
            {canCreate && <button type="button" className="ss-opt ss-create" onClick={create}>+ Додати «{q.trim()}»</button>}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

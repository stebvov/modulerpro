"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDropdownPosition } from "@/lib/useFloatingDropdown";

export default function MultiSelectFilter({ options, selected, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const popupRef = useRef(null);
  const pos = useDropdownPosition(open, wrapRef);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (wrapRef.current?.contains(e.target)) return;
      if (popupRef.current?.contains(e.target)) return;
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div className="ms-filter" ref={wrapRef}>
      <button type="button" className={`ms-filter-btn${selected.length ? " active" : ""}`} onClick={() => setOpen((o) => !o)}>
        {label}{selected.length ? ` (${selected.length})` : ""} ▾
      </button>
      {open && pos && createPortal(
        <div ref={popupRef} className="ms-filter-list" style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 1000 }}>
          {options.length > 5 && (
            <input
              type="text"
              className="ms-filter-search"
              placeholder="Пошук..."
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          {selected.length > 0 && (
            <div className="ms-filter-item ms-filter-clear" onMouseDown={(e) => { e.preventDefault(); onChange([]); }}>
              ✕ Скинути
            </div>
          )}
          {filtered.map((o) => (
            <label className="ms-filter-item" key={o.id}>
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} />
              {o.icon ? `${o.icon} ` : ""}{o.label}
            </label>
          ))}
          {!filtered.length && <div className="ms-filter-empty">Нічого не знайдено</div>}
        </div>,
        document.body
      )}
    </div>
  );
}

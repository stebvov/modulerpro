"use client";

import { useState } from "react";

export default function MultiSelectFilter({ options, selected, onChange, label }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div
      className="ms-filter"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) { setOpen(false); setQuery(""); }
      }}
    >
      <button type="button" className={`ms-filter-btn${selected.length ? " active" : ""}`} onClick={() => setOpen((o) => !o)}>
        {label}{selected.length ? ` (${selected.length})` : ""} ▾
      </button>
      {open && (
        <div className="ms-filter-list">
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
              {o.label}
            </label>
          ))}
          {!filtered.length && <div className="ms-filter-empty">Нічого не знайдено</div>}
        </div>
      )}
    </div>
  );
}

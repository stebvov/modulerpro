"use client";

import { useState } from "react";

export default function MultiSelectFilter({ options, selected, onChange, label }) {
  const [open, setOpen] = useState(false);

  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div
      className="ms-filter"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button type="button" className={`ms-filter-btn${selected.length ? " active" : ""}`} onClick={() => setOpen((o) => !o)}>
        {label}{selected.length ? ` (${selected.length})` : ""} ▾
      </button>
      {open && (
        <div className="ms-filter-list">
          {selected.length > 0 && (
            <div className="ms-filter-item ms-filter-clear" onMouseDown={(e) => { e.preventDefault(); onChange([]); }}>
              ✕ Скинути
            </div>
          )}
          {options.map((o) => (
            <label className="ms-filter-item" key={o.id}>
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} />
              {o.label}
            </label>
          ))}
          {!options.length && <div className="ms-filter-empty">Немає варіантів</div>}
        </div>
      )}
    </div>
  );
}

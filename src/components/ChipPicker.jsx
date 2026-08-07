"use client";

import { useState } from "react";

// Shows selected items as removable chips; typing in the input shows a
// dropdown of the remaining (unselected) options to add.
export default function ChipPicker({ options, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedOptions = selected.map((id) => options.find((o) => o.id === id)).filter(Boolean);
  const available = options.filter((o) => !selected.includes(o.id));
  const filtered = query.trim()
    ? available.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : available;

  function add(id) {
    onChange([...selected, id]);
    setQuery("");
  }
  function remove(id) {
    onChange(selected.filter((x) => x !== id));
  }

  return (
    <div
      className="chip-picker"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) { setOpen(false); setQuery(""); }
      }}
    >
      <div className="chip-list">
        {selectedOptions.map((o) => (
          <span className="chip" key={o.id}>
            {o.label}
            <span className="chip-x" onClick={() => remove(o.id)}>×</span>
          </span>
        ))}
        <input
          type="text"
          className="chip-input"
          placeholder={selectedOptions.length ? "+ додати..." : placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        />
      </div>
      {open && (
        <div className="combobox-list">
          {filtered.map((o) => (
            <div key={o.id} className="combobox-item" onMouseDown={(e) => { e.preventDefault(); add(o.id); }}>
              {o.label}
            </div>
          ))}
          {!filtered.length && <div className="combobox-empty">{available.length ? "Нічого не знайдено" : "Все вже обрано"}</div>}
        </div>
      )}
    </div>
  );
}

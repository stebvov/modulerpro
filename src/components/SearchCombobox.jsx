"use client";

import { useEffect, useRef, useState } from "react";

export default function SearchCombobox({
  value,
  options,
  onChange,
  onCreate,
  placeholder,
  disabled,
  createLabel = (text) => `+ Створити «${text}»`,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const blurTimer = useRef(null);

  const selected = options.find((o) => o.id === value) || null;

  useEffect(() => {
    // Syncing the display text to the externally-controlled selected value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setQuery(selected ? selected.label : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selected?.label, open]);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const exactMatch = options.some((o) => o.label.toLowerCase() === q);
  const showCreate = !!onCreate && q && !exactMatch;

  function selectOption(opt) {
    setQuery(opt.label);
    setOpen(false);
    onChange(opt.id);
  }

  async function handleCreate() {
    if (!onCreate || busy) return;
    setBusy(true);
    try {
      const newId = await onCreate(query.trim());
      if (newId) {
        setOpen(false);
        onChange(newId);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="combobox" onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
         onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); }}>
      <input
        type="text"
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onFocus={(e) => { setOpen(true); e.target.select(); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
      />
      {open && !disabled && (
        <div className="combobox-list">
          {!q && value && (
            <div className="combobox-item combobox-clear" onMouseDown={(e) => { e.preventDefault(); setQuery(""); setOpen(false); onChange(""); }}>
              ✕ Скинути вибір
            </div>
          )}
          {filtered.map((o) => (
            <div
              key={o.id}
              className={`combobox-item${o.id === value ? " active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); selectOption(o); }}
            >
              {o.label}
            </div>
          ))}
          {!filtered.length && !showCreate && <div className="combobox-empty">Нічого не знайдено</div>}
          {showCreate && (
            <div className="combobox-item combobox-create" onMouseDown={(e) => { e.preventDefault(); handleCreate(); }}>
              {busy ? "Створення..." : createLabel(query.trim())}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDropdownPosition } from "@/lib/useFloatingDropdown";

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
  const [highlight, setHighlight] = useState(-1);
  const blurTimer = useRef(null);
  const wrapRef = useRef(null);
  const pos = useDropdownPosition(open && !disabled, wrapRef);

  const selected = options.find((o) => o.id === value) || null;

  useEffect(() => {
    // Syncing the display text to the externally-controlled selected value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setQuery(selected ? selected.label : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selected?.label, open]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlight(-1);
  }, [query, open]);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const exactMatch = options.some((o) => o.label.toLowerCase() === q);
  const showClear = !q && !!value;
  const showCreate = !!onCreate && q && !exactMatch;

  // Flat list of navigable rows, in the same order they're rendered.
  const rows = [
    ...(showClear ? [{ type: "clear" }] : []),
    ...filtered.map((o) => ({ type: "option", option: o })),
    ...(showCreate ? [{ type: "create" }] : []),
  ];

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

  function activateRow(row) {
    if (!row) return;
    if (row.type === "clear") { setQuery(""); setOpen(false); onChange(""); }
    else if (row.type === "option") selectOption(row.option);
    else if (row.type === "create") handleCreate();
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === "ArrowDown") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (highlight >= 0 && rows[highlight]) {
        e.preventDefault();
        activateRow(rows[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const clearIdx = showClear ? 0 : -1;
  const optionIdxOffset = showClear ? 1 : 0;
  const createIdx = showCreate ? rows.length - 1 : -1;

  return (
    <div className="combobox" ref={wrapRef} onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
         onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); }}>
      <input
        type="text"
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onFocus={(e) => { setOpen(true); e.target.select(); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={handleKeyDown}
      />
      {open && !disabled && pos && createPortal(
        <div className="combobox-list" style={{ position: "fixed", top: pos.top, left: pos.left, right: "auto", width: pos.width, zIndex: 1000 }}>
          {showClear && (
            <div
              className={`combobox-item combobox-clear${clearIdx === highlight ? " highlighted" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); setQuery(""); setOpen(false); onChange(""); }}
              onMouseEnter={() => setHighlight(clearIdx)}
            >
              ✕ Скинути вибір
            </div>
          )}
          {filtered.map((o, i) => {
            const idx = optionIdxOffset + i;
            return (
              <div
                key={o.id}
                className={`combobox-item${o.id === value ? " active" : ""}${idx === highlight ? " highlighted" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); selectOption(o); }}
                onMouseEnter={() => setHighlight(idx)}
              >
                {o.label}
              </div>
            );
          })}
          {!filtered.length && !showCreate && <div className="combobox-empty">Нічого не знайдено</div>}
          {showCreate && (
            <div
              className={`combobox-item combobox-create${createIdx === highlight ? " highlighted" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); handleCreate(); }}
              onMouseEnter={() => setHighlight(createIdx)}
            >
              {busy ? "Створення..." : createLabel(query.trim())}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { CURRENCIES } from "@/lib/format";

export default function CurrencyMenu({ currency, onChange }) {
  const [open, setOpen] = useState(false);
  const current = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  return (
    <div
      className="currency-menu"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button type="button" className="currency-menu-btn" onClick={() => setOpen((o) => !o)} title={current.name}>
        <span>{current.flag}</span>
        <span>{current.code}</span>
      </button>
      {open && (
        <div className="currency-menu-list">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              type="button"
              className={`currency-menu-item${c.code === currency ? " active" : ""}`}
              onClick={() => { onChange(c.code); setOpen(false); }}
            >
              <span>{c.flag}</span>
              <span className="currency-menu-name">{c.name}</span>
              <span className="currency-menu-code">{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

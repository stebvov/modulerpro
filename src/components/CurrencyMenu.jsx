"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { CURRENCIES } from "@/lib/format";

function fmtRate(rate) {
  return Number(rate).toLocaleString("uk-UA", { maximumFractionDigits: 2 });
}

function fmtUpdated(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function CurrencyMenu({ currency, onChange }) {
  const { exchangeRates, showDecimals, setShowDecimals } = useAppData();
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
          {CURRENCIES.map((c) => {
            const rate = exchangeRates.find((r) => r.code === c.code);
            return (
              <button
                key={c.code}
                type="button"
                className={`currency-menu-item${c.code === currency ? " active" : ""}`}
                onClick={() => { onChange(c.code); setOpen(false); }}
              >
                <span>{c.flag}</span>
                <span className="currency-menu-item-main">
                  <span className="currency-menu-item-top">
                    <span className="currency-menu-name">{c.name}</span>
                    <span className="currency-menu-code">{c.code}</span>
                  </span>
                  {c.code !== "UAH" && rate && (
                    <span className="currency-menu-rate">
                      1 {c.code} = {fmtRate(rate.rate_to_uah)} ₴
                      <span className="currency-menu-source"> · {rate.source || "джерело не вказано"}, {fmtUpdated(rate.updated_at)}</span>
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          <label className="currency-menu-toggle">
            <input type="checkbox" checked={showDecimals} onChange={(e) => setShowDecimals(e.target.checked)} />
            Показувати копійки/центи
          </label>
        </div>
      )}
    </div>
  );
}

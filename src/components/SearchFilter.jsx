"use client";

// Пошук з вбудованою квадратною кнопкою фільтрів у кінці поля (як у KeyCRM).
// Панель фільтрів (children) розкривається під полем; лічильник — скільки фільтрів увімкнено.
import { useState } from "react";
import { FilterIcon, SearchIcon } from "@/components/Icon";

export default function SearchFilter({ value, onChange, placeholder = "Пошук…", active = 0, children, defaultOpen = false, onReset }) {
  const [open, setOpen] = useState(defaultOpen);
  const hasFilters = !!children;
  return (
    <div style={{ display: "contents" }}>
      <div className="sf">
        <SearchIcon className="sf-ico" />
        <input className={hasFilters ? "" : "nofilter"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label="Пошук" />
        {hasFilters && (
          <button type="button" className={`sf-btn${open || active ? " on" : ""}`} onClick={() => setOpen((o) => !o)} title={open ? "Сховати фільтри" : "Фільтри"} aria-expanded={open}>
            <FilterIcon />
            {active > 0 && <span className="sf-n">{active}</span>}
          </button>
        )}
      </div>
      {hasFilters && open && (
        <div className="sf-panel" style={{ flexBasis: "100%" }}>
          {children}
          {active > 0 && onReset && <button type="button" className="btn small" onClick={onReset}>Скинути</button>}
        </div>
      )}
    </div>
  );
}

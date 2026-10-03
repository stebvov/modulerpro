"use client";
// ▲▼ — змінити порядок у списку (працює лише у вкладці «Усі» без пошуку, щоб порядок був однозначний).
export default function OrderButtons({ onMove, first, last, disabled, hint = "Порядок змінюється у «Усі» без пошуку й фільтрів" }) {
  return (
    <span className="ord-btns" onClick={(e) => e.stopPropagation()}>
      <button type="button" disabled={disabled || first} onClick={() => onMove(-1)} title={disabled ? hint : "Вище"} aria-label="Вище">▲</button>
      <button type="button" disabled={disabled || last} onClick={() => onMove(1)} title={disabled ? hint : "Нижче"} aria-label="Нижче">▼</button>
    </span>
  );
}

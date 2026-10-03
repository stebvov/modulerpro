"use client";

// Іконка «і» з підказкою: навів (або торкнувся) — спливає опис, за потреби з фото.
// Підказка малюється поверх сторінки, тож її не обрізає таблиця з прокруткою.
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function InfoTip({ text, image, label = "Опис" }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  if (!text && !image) return null;

  function show() {
    const r = ref.current.getBoundingClientRect();
    const width = Math.min(380, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    // під іконкою, а якщо внизу мало місця — над нею
    const below = window.innerHeight - r.bottom > 240 || r.top < 240;
    setPos(below ? { left, width, top: r.bottom + 6 } : { left, width, bottom: window.innerHeight - r.top + 6 });
  }
  const hide = () => setPos(null);

  return (
    <>
      <button ref={ref} type="button" className="info-tip" aria-label={label}
        onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} onClick={(e) => { e.stopPropagation(); show(); }}>i</button>
      {pos && createPortal(
        <div className="info-pop" role="tooltip" style={{ position: "fixed", ...pos }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {image && <img src={image} alt="" />}
          {text}
        </div>,
        document.body
      )}
    </>
  );
}

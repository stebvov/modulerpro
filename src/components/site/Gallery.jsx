"use client";
// Сітка фото + перегляд на весь екран: стрілки, свайп, Esc.
import { useCallback, useEffect, useRef, useState } from "react";
import { imgProps, imgSmall } from "@/lib/site/format";

export default function Gallery({ images, title = "", layout = "grid" }) {
  const [open, setOpen] = useState(-1);
  const touch = useRef(null);
  const n = images.length;
  const go = useCallback((d) => setOpen((i) => (i + d + n) % n), [n]);

  useEffect(() => {
    if (open < 0) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(-1);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, go]);

  if (!n) return null;
  return (
    <>
      <div className={`s-gal s-gal--${layout} s-gal--n${Math.min(n, 9)}`}>
        {images.map((u, i) => (
          <button key={u + i} type="button" className="s-gal__item" onClick={() => setOpen(i)} aria-label={`Фото ${i + 1}`}>
            <img alt={title ? `${title}, фото ${i + 1}` : ""} loading="lazy" src={i === 0 && n === 5 ? u : imgSmall(u)} />
          </button>
        ))}
      </div>
      {open >= 0 && (
        <div className="s-lb" role="dialog" aria-modal="true" onClick={() => setOpen(-1)}
          onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { const d = e.changedTouches[0].clientX - (touch.current ?? 0); if (Math.abs(d) > 50) go(d < 0 ? 1 : -1); }}>
          <img className="s-lb__img" alt="" {...imgProps(images[open])} onClick={(e) => e.stopPropagation()} />
          <div className="s-lb__bar">{title && <span>{title}</span>}<span>{open + 1} / {n}</span></div>
          {n > 1 && <button type="button" className="s-lb__nav s-lb__prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Попереднє">‹</button>}
          {n > 1 && <button type="button" className="s-lb__nav s-lb__next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Наступне">›</button>}
          <button type="button" className="s-lb__close" onClick={() => setOpen(-1)} aria-label="Закрити">×</button>
        </div>
      )}
    </>
  );
}

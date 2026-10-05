"use client";
// Сітка фото + перегляд на весь екран: стрілки, свайп, Esc, ескізи всіх фото знизу, підпис до кожного фото.
import { useCallback, useEffect, useRef, useState } from "react";
import { imgProps, imgSmall, plain } from "@/lib/site/format";
import { useT } from "./I18n";

export default function Gallery({ images, title = "", layout = "grid", captions }) {
  const [open, setOpen] = useState(-1);
  const { t, tf } = useT();
  const touch = useRef(null);
  const thumbs = useRef(null);
  const n = images.length;
  const go = useCallback((d) => setOpen((i) => (i + d + n) % n), [n]);
  const name = plain(title);
  const cap = (u) => (captions && typeof captions[u] === "string" ? captions[u].trim() : "");

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

  // відкрите фото завжди видно серед ескізів
  useEffect(() => {
    if (open < 0) return;
    thumbs.current?.children[open]?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [open]);

  if (!n) return null;
  const bigFirst = n % 2 === 1 || (n % 3 !== 0 && n !== 4); // перше фото займає більше місця (див. site.css)
  return (
    <>
      <div className={`s-gal s-gal--${layout} s-gal--n${Math.min(n, 9)} s-gal--r${n % 3}${n % 2 ? " s-gal--odd" : ""}`}>
        {images.map((u, i) => (
          <button key={u + i} type="button" className="s-gal__item" onClick={() => setOpen(i)} aria-label={cap(u) || tf("Фото {n}", { n: i + 1 })}>
            <img alt={cap(u) || (name ? tf("{name}, фото {n}", { name, n: i + 1 }) : "")} loading="lazy" src={i === 0 && bigFirst ? u : imgSmall(u)} />
          </button>
        ))}
      </div>
      {open >= 0 && (
        <div className="s-lb" role="dialog" aria-modal="true" aria-label={name || t("Фото")} onClick={() => setOpen(-1)}>
          <div className="s-lb__stage"
            onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => { const d = e.changedTouches[0].clientX - (touch.current ?? 0); if (Math.abs(d) > 50) go(d < 0 ? 1 : -1); }}>
            <img className="s-lb__img" alt={cap(images[open])} {...imgProps(images[open])} onClick={(e) => e.stopPropagation()} />
            {n > 1 && <button type="button" className="s-lb__nav s-lb__prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label={t("Попереднє")}>‹</button>}
            {n > 1 && <button type="button" className="s-lb__nav s-lb__next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label={t("Наступне")}>›</button>}
          </div>
          <div className="s-lb__bar" onClick={(e) => e.stopPropagation()}>
            {cap(images[open]) && <p className="s-lb__cap">{cap(images[open])}</p>}
            <div className="s-lb__meta">{name && <span>{name}</span>}<span>{open + 1} / {n}</span></div>
          </div>
          {n > 1 && (
            <div className="s-lb__thumbs" ref={thumbs} onClick={(e) => e.stopPropagation()}>
              {images.map((u, i) => (
                <button key={u + i} type="button" className={`s-lb__thumb${i === open ? " on" : ""}`} onClick={() => setOpen(i)} aria-label={tf("Фото {n}", { n: i + 1 })} aria-current={i === open ? "true" : undefined}>
                  <img alt="" loading="lazy" src={imgSmall(u)} />
                </button>
              ))}
            </div>
          )}
          <button type="button" className="s-lb__close" onClick={() => setOpen(-1)} aria-label={t("Закрити")}>×</button>
        </div>
      )}
    </>
  );
}

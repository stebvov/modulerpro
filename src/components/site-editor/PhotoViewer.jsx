"use client";
// Перегляд фото в конструкторі сайту: велике фото, ескізи всіх фото знизу, підпис до кожного фото, обрізання.
// Кнопки «×» і стрілки — такі самі, як у перегляді фото на сайті (Gallery.jsx).
import { useCallback, useEffect, useRef, useState } from "react";
import { imgSmall, isHiddenStr, unhideStr } from "@/lib/site/format";
import { uploadSiteImage } from "@/lib/site/upload";
import "./editor.css";

const RATIOS = [["", "Вільно"], ["3:2", "3 : 2"], ["4:3", "4 : 3"], ["16:9", "16 : 9"], ["1:1", "1 : 1"], ["3:4", "3 : 4"]];
const MIN = 0.06; // найменша сторона рамки — частка від сторони фото
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// найбільша версія фото, яка є: 1920 — у завантажених через конструктор
const bigUrl = (u) => (/supabase\.co|\/atmosfera\//.test(u) ? u.replace(/-1280\.webp$/, "-1920.webp") : u);

// рамка за замовчуванням: 90% фото, по центру; rf — потрібне співвідношення ширини до висоти в частках фото
function fitBox(rf) {
  if (!rf) return { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
  let w = 0.9, h = w / rf;
  if (h > 0.9) { h = 0.9; w = h * rf; }
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

// вирізаємо рамку з найбільшої версії фото й завантажуємо як нове фото (ті самі три розміри, що й звичайне)
async function cropAndUpload(url, c) {
  let blob = null;
  for (const src of [...new Set([bigUrl(url), url])]) {
    const r = await fetch(src).catch(() => null);
    if (r?.ok) { blob = await r.blob(); break; }
  }
  if (!blob) throw new Error("Не вдалося відкрити фото для обрізання");
  const bmp = await createImageBitmap(blob);
  const sw = Math.max(1, Math.round(c.w * bmp.width)), sh = Math.max(1, Math.round(c.h * bmp.height));
  const cv = document.createElement("canvas");
  cv.width = sw; cv.height = sh;
  cv.getContext("2d").drawImage(bmp, Math.round(c.x * bmp.width), Math.round(c.y * bmp.height), sw, sh, 0, 0, sw, sh);
  bmp.close?.();
  const png = await new Promise((ok, bad) => cv.toBlob((b) => (b ? ok(b) : bad(new Error("Не вдалося обрізати фото"))), "image/png"));
  return uploadSiteImage(new File([png], "crop.png", { type: "image/png" }));
}

// list — адреси фото (приховані — з префіксом «~~»); captions — { адреса: підпис } або нічого, якщо підписів у цьому полі немає
export default function PhotoViewer({ list, index, onIndex, onClose, captions, onCaption, onCropped }) {
  const n = list.length;
  const url = unhideStr(list[index]);
  const off = isHiddenStr(list[index]);
  const [crop, setCrop] = useState(null); // { x, y, w, h } у частках фото; null — звичайний перегляд
  const [ratio, setRatio] = useState("");
  const [area, setArea] = useState(null); // де на екрані лежить фото — рамка обрізання малюється поверх нього
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const img = useRef(null);
  const stage = useRef(null);
  const drag = useRef(null);
  const thumbs = useRef(null);
  const go = useCallback((d) => onIndex((index + d + n) % n), [index, n, onIndex]);

  const measure = useCallback(() => {
    const i = img.current, s = stage.current;
    if (!i || !s || !i.naturalWidth) return;
    const a = i.getBoundingClientRect(), b = s.getBoundingClientRect();
    setArea({ left: a.left - b.left, top: a.top - b.top, width: a.width, height: a.height });
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { if (crop) { if (!busy) setCrop(null); } else onClose(); return; }
      if (crop || /^(TEXTAREA|INPUT)$/.test(e.target?.tagName || "")) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [crop, busy, go, onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", measure);
    return () => { document.body.style.overflow = ""; window.removeEventListener("resize", measure); };
  }, [measure]);

  useEffect(() => {
    thumbs.current?.children[index]?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [index]);

  // фото змінює розмір (сховались ескізи, повернули телефон) — рамка обрізання має лишатися точно на ньому
  useEffect(() => {
    if (!img.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(img.current);
    return () => ro.disconnect();
  }, [measure, url]);

  // співвідношення сторін у частках фото: 3:2 на фото 16:9 — це не 1,5, а 1,5 ÷ (16/9)
  const fracRatio = (r) => {
    if (!r || !img.current?.naturalWidth) return null;
    const [a, b] = r.split(":").map(Number);
    return a / b / (img.current.naturalWidth / img.current.naturalHeight);
  };
  function startCrop() { setErr(""); measure(); setCrop(fitBox(fracRatio(ratio))); }
  function pickRatio(r) { setRatio(r); setCrop(fitBox(fracRatio(r))); }

  function begin(e, mode) {
    if (busy) return;
    e.preventDefault(); e.stopPropagation();
    const r = e.currentTarget.closest(".pv__area").getBoundingClientRect();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, box: crop, r, rf: fracRatio(ratio) };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onMove(e) {
    const d = drag.current;
    if (!d) return;
    const { box, r, rf } = d;
    if (d.mode === "move") {
      setCrop({ ...box, x: clamp(box.x + (e.clientX - d.sx) / r.width, 0, 1 - box.w), y: clamp(box.y + (e.clientY - d.sy) / r.height, 0, 1 - box.h) });
      return;
    }
    // тягнемо кут: протилежний кут стоїть на місці
    const dx = d.mode.includes("e") ? 1 : -1, dy = d.mode.includes("s") ? 1 : -1;
    const ax = dx > 0 ? box.x : box.x + box.w, ay = dy > 0 ? box.y : box.y + box.h;
    const px = clamp((e.clientX - r.left) / r.width, 0, 1), py = clamp((e.clientY - r.top) / r.height, 0, 1);
    const maxW = dx > 0 ? 1 - ax : ax, maxH = dy > 0 ? 1 - ay : ay;
    let w = clamp((px - ax) * dx, MIN, maxW), h = clamp((py - ay) * dy, MIN, maxH);
    if (rf) {
      h = w / rf;
      if (h > maxH) { h = maxH; w = h * rf; }
    }
    setCrop({ x: dx > 0 ? ax : ax - w, y: dy > 0 ? ay : ay - h, w, h });
  }
  const end = () => { drag.current = null; };

  async function saveCrop() {
    if (!crop || busy) return;
    setBusy(true); setErr("");
    try {
      const cut = await cropAndUpload(url, crop);
      setCrop(null);
      onCropped(index, cut);
    } catch (x) { setErr(x.message || "Не вдалося обрізати фото"); }
    setBusy(false);
  }

  if (!n || url == null) return null;
  const pct = (v) => `${v * 100}%`;
  return (
    <div className="pv" role="dialog" aria-modal="true" aria-label="Перегляд фото">
      <div className="pv__top">
        <span className="pv__count">{index + 1} / {n}{off ? " · приховано з сайту" : ""}</span>
        {crop ? (
          <>
            <div className="pv__ratios">
              {RATIOS.map(([k, l]) => <button key={k} type="button" className={`pv__btn${ratio === k ? " on" : ""}`} onClick={() => pickRatio(k)} disabled={busy}>{l}</button>)}
            </div>
            <button type="button" className="pv__btn pv__btn--main" onClick={saveCrop} disabled={busy}>{busy ? "Обрізаю й зберігаю…" : "Зберегти обрізане"}</button>
            <button type="button" className="pv__btn" onClick={() => setCrop(null)} disabled={busy}>Скасувати</button>
          </>
        ) : (
          onCropped && <button type="button" className="pv__btn" onClick={startCrop}>✂ Обрізати</button>
        )}
      </div>
      <button type="button" className="pv__close" onClick={onClose} aria-label="Закрити">×</button>

      <div className="pv__stage" ref={stage} onPointerMove={onMove} onPointerUp={end} onPointerCancel={end}>
        <img ref={img} className="pv__img" src={url} alt="" draggable={false} onLoad={measure} />
        {crop && area && (
          <div className="pv__area" style={{ left: area.left, top: area.top, width: area.width, height: area.height }}>
            <div className="pv__crop" style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }} onPointerDown={(e) => begin(e, "move")}>
              {["nw", "ne", "sw", "se"].map((k) => <span key={k} className={`pv__h pv__h--${k}`} onPointerDown={(e) => begin(e, k)} />)}
            </div>
          </div>
        )}
        {!crop && n > 1 && <button type="button" className="pv__nav pv__prev" onClick={() => go(-1)} aria-label="Попереднє">‹</button>}
        {!crop && n > 1 && <button type="button" className="pv__nav pv__next" onClick={() => go(1)} aria-label="Наступне">›</button>}
      </div>

      {err && <div className="pv__err">{err}</div>}
      {crop && <div className="pv__hint">Потягніть рамку або її кути. Оригінал не зникне: він лишиться поруч як приховане фото.</div>}
      {!crop && captions && (
        <div className="pv__cap">
          <textarea rows={2} placeholder="Підпис до цього фото — його побачать на сайті, коли відкриють фото" value={captions[url] || ""} onChange={(e) => onCaption(url, e.target.value)} />
        </div>
      )}
      {!crop && n > 1 && (
        <div className="pv__thumbs" ref={thumbs}>
          {list.map((u, i) => (
            <button key={u + i} type="button" className={`pv__thumb${i === index ? " on" : ""}${isHiddenStr(u) ? " off" : ""}`} onClick={() => onIndex(i)} aria-label={`Фото ${i + 1}`}>
              <img src={imgSmall(unhideStr(u))} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

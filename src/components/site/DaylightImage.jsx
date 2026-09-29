"use client";
// Фото, що живе порою доби: показує кадр за годиною відвідувача (ранок / день / вечір / ніч),
// при першій появі один раз «прокручує» добу, вночі — зорі й тепле світло. Можна перемкнути вручну.
import { useEffect, useMemo, useRef, useState } from "react";
import { imgProps } from "@/lib/site/format";

const PHASES = [
  ["morning", "🌅", "Ранок"],
  ["day", "☀️", "День"],
  ["evening", "🌇", "Вечір"],
  ["night", "🌙", "Ніч"],
];

function phaseByHour(h) {
  if (h >= 5 && h < 10) return "morning";
  if (h >= 10 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

// зорі з фіксованими координатами — однакові на сервері й у браузері
const STARS = Array.from({ length: 28 }, (_, i) => ({ x: (i * 37) % 100, y: (i * 53) % 38, d: (i % 7) * 0.6, s: 1 + (i % 3) }));

export default function DaylightImage({ images, alt = "" }) {
  const src = useMemo(() => ({
    morning: images.morning || images.day,
    day: images.day,
    evening: images.evening || images.day,
    night: images.night || images.evening || images.day,
  }), [images]);
  const unique = [...new Set(Object.values(src).filter(Boolean))];
  const [phase, setPhase] = useState("day");
  const [now, setNow] = useState("day");
  const [touched, setTouched] = useState(false);
  const box = useRef(null);

  // година відвідувача відома лише в браузері — на сервері малюємо «день»
  useEffect(() => {
    const p = phaseByHour(new Date().getHours());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(p); setPhase(p);
  }, []);

  // один раз показати добу, коли блок з'являється на екрані
  useEffect(() => {
    if (touched || !box.current || !("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timers = [];
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const seq = ["morning", "day", "evening", "night", phaseByHour(new Date().getHours())];
      seq.forEach((p, i) => timers.push(setTimeout(() => setPhase(p), 900 + i * 2600)));
    }, { threshold: 0.5 });
    io.observe(box.current);
    return () => { io.disconnect(); timers.forEach(clearTimeout); };
  }, [touched]);

  return (
    <div className={`s-tod s-tod--${phase}`} ref={box}>
      {unique.map((u) => (
        <img key={u} className={`s-tod__img${src[phase] === u ? " on" : ""}`} alt={alt} loading="lazy" {...imgProps(u, "(max-width: 900px) 100vw, 50vw")} />
      ))}
      <div className="s-tod__tint" />
      <div className="s-tod__sun" />
      <div className="s-tod__stars" aria-hidden>
        {STARS.map((s, i) => <i key={i} style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s`, width: s.s, height: s.s }} />)}
      </div>
      <div className="s-tod__bar" role="tablist" aria-label="Пора доби">
        {PHASES.map(([k, icon, label]) => (
          <button key={k} type="button" role="tab" aria-selected={phase === k} className={phase === k ? "on" : ""}
            onClick={() => { setTouched(true); setPhase(k); }} title={k === now ? `${label} — як зараз у вас` : label}>
            <span aria-hidden>{icon}</span><span className="s-tod__lbl">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";
// Відео вантажиться лише після кліку — сторінка лишається легкою.
import { useState } from "react";

export default function YouTube({ id, caption }) {
  const [on, setOn] = useState(false);
  return (
    <div className="s-yt">
      {on ? (
        <iframe src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0&playsinline=1`} title={caption || "Відео Moduler"} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      ) : (
        <button type="button" className="s-yt__btn" onClick={() => setOn(true)} aria-label="Дивитися відео">
          <img alt="" loading="lazy" src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} />
          <span className="s-yt__play" aria-hidden>▶</span>
          {caption && <span className="s-yt__cap">{caption}</span>}
        </button>
      )}
    </div>
  );
}

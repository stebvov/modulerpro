"use client";

import { useEffect, useRef } from "react";

export default function FileLightbox({ photos, index, onClose, onNavigate }) {
  const touchStartX = useRef(null);
  const open = index != null && !!photos[index];

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onNavigate((index - 1 + photos.length) % photos.length);
      else if (e.key === "ArrowRight") onNavigate((index + 1) % photos.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, photos.length, onClose, onNavigate]);

  if (!open) return null;
  const photo = photos[index];

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e) {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx > 0) onNavigate((index - 1 + photos.length) % photos.length);
      else onNavigate((index + 1) % photos.length);
    }
    touchStartX.current = null;
  }

  return (
    <div className="lightbox-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Закрити">×</button>
      {photos.length > 1 && (
        <button
          type="button"
          className="lightbox-nav lightbox-prev"
          onClick={() => onNavigate((index - 1 + photos.length) % photos.length)}
          aria-label="Попереднє фото"
        >
          ‹
        </button>
      )}
      <div className="lightbox-content" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <img src={photo.url} alt={photo.name || ""} />
        {photos.length > 1 && <div className="lightbox-counter">{index + 1} / {photos.length}</div>}
      </div>
      {photos.length > 1 && (
        <button
          type="button"
          className="lightbox-nav lightbox-next"
          onClick={() => onNavigate((index + 1) % photos.length)}
          aria-label="Наступне фото"
        >
          ›
        </button>
      )}
    </div>
  );
}

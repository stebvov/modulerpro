"use client";

// Пульт (статичний застосунок public/pult) всередині оболонки Moduler Pro.
// Один iframe живе весь сеанс: розділи перемикаються без перезавантаження, стан пульту зберігається.
// Пульт у режимі embed ховає свою шапку й вкладки — навігація лише в меню оболонки.
import { useEffect, useRef, useState } from "react";

export default function PultFrame({ section, visible, initialHash, onSection }) {
  const ref = useRef(null);
  const [src] = useState(() => `/pult?embed=1&tab=${encodeURIComponent(section || "my")}${initialHash || ""}`);

  // оболонка → пульт: відкрити розділ
  useEffect(() => {
    if (!section) return;
    const w = ref.current?.contentWindow;
    try {
      const b = w?.document?.querySelector(`.seg [data-tab="${section}"]`);
      if (b && b.getAttribute("aria-pressed") !== "true") b.click();
    } catch {
      /* пульт ще вантажиться — розділ візьметься з ?tab= */
    }
  }, [section]);

  // пульт → оболонка: людина перейшла в інший розділ усередині пульту (напр., відкрила проєкт)
  useEffect(() => {
    function onMsg(e) {
      if (e.origin !== window.location.origin || e.data?.type !== "pult-tab") return;
      onSection?.(e.data.tab);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onSection]);

  return (
    <iframe
      ref={ref}
      src={src}
      title="Пульт Модулер"
      style={{ display: visible ? "block" : "none", width: "100%", height: "calc(100vh - 86px)", border: 0, background: "transparent" }}
    />
  );
}

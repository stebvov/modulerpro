"use client";

// Пульт (статичний застосунок public/pult) всередині оболонки.
// Один iframe живе весь сеанс: розділи перемикаються без перезавантаження, стан пульту зберігається.
// Пульт у режимі embed ховає свою шапку, вкладки, валюту й профіль — усе це в оболонці.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

const PultFrame = forwardRef(function PultFrame({ section, visible, initialHash, currency, onSection }, outer) {
  const ref = useRef(null);
  const [src] = useState(() => `/pult?embed=1&tab=${encodeURIComponent(section || "my")}${initialHash || ""}`);
  const [height, setHeight] = useState(600);

  const post = useCallback((msg) => {
    try { ref.current?.contentWindow?.postMessage(msg, window.location.origin); } catch { /* ще вантажиться */ }
  }, []);
  useImperativeHandle(outer, () => ({ openProfile: () => post({ type: "open-profile" }), newTask: () => post({ type: "new-task" }) }), [post]);

  // висота рамки = до низу вікна: прокрутка одна (всередині пульту), фіксовані вікна пульту видно
  useEffect(() => {
    function fit() {
      const top = ref.current?.getBoundingClientRect().top ?? 120;
      setHeight(Math.max(420, Math.floor(window.innerHeight - top - 12)));
    }
    fit();
    const t = setTimeout(fit, 50); // після того як зʼявився/зник рядок підрозділів
    window.addEventListener("resize", fit);
    return () => { clearTimeout(t); window.removeEventListener("resize", fit); };
  }, [visible, section]);

  // оболонка → пульт: розділ
  useEffect(() => {
    if (!section) return;
    try {
      const b = ref.current?.contentWindow?.document?.querySelector(`.seg [data-tab="${section}"]`);
      if (b && b.getAttribute("aria-pressed") !== "true") b.click();
    } catch { /* пульт ще вантажиться — розділ візьметься з ?tab= */ }
  }, [section]);

  // оболонка → пульт: валюта (одна на всю систему)
  useEffect(() => { post({ type: "currency", currency }); }, [currency, post]);

  // пульт → оболонка
  useEffect(() => {
    function onMsg(e) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "pult-tab") onSection?.(e.data.tab);
      if (e.data?.type === "pult-ready") post({ type: "currency", currency });
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onSection, post, currency]);

  return (
    <iframe
      ref={ref}
      src={src}
      title="Пульт Модулер"
      style={{ display: visible ? "block" : "none", width: "100%", height, border: 0, background: "transparent" }}
    />
  );
});

export default PultFrame;

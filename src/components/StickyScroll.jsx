"use client";

// Широка таблиця: перший стовпець стоїть на місці, а смуга горизонтальної прокрутки «прилипає» до низу екрана —
// до неї не треба докручувати сторінку. Власну смугу таблиці ховаємо, щоб не було двох.
import { useEffect, useRef, useState } from "react";

export default function StickyScroll({ children }) {
  const box = useRef(null);
  const bar = useRef(null);
  const [width, setWidth] = useState(0);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      setWidth(el.scrollWidth);
      setOver(el.scrollWidth > el.clientWidth + 1);
      // ширина видимої частини — для вкладених блоків, які мають лишатися на екрані (розгорнутий рядок)
      el.style.setProperty("--view-w", `${el.clientWidth}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  const sync = (from, to) => { if (from.current && to.current && to.current.scrollLeft !== from.current.scrollLeft) to.current.scrollLeft = from.current.scrollLeft; };

  return (
    <>
      <div ref={box} className="table-scroll sticky-x" onScroll={() => sync(box, bar)}>{children}</div>
      {over && (
        <div ref={bar} className="sticky-xbar" onScroll={() => sync(bar, box)} aria-hidden="true">
          <div style={{ width }} />
        </div>
      )}
    </>
  );
}

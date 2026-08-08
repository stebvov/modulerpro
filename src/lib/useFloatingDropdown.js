"use client";

import { useLayoutEffect, useState } from "react";

// Computes viewport-fixed coordinates for a dropdown popup anchored to
// `anchorRef`, so it can be rendered via a portal (escaping any ancestor's
// overflow:hidden/auto clipping — e.g. a horizontally-scrollable table).
export function useDropdownPosition(open, anchorRef) {
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return;
    }
    function update() {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef]);

  return pos;
}

"use client";

// Вибір кількох карток: натиснути й притримати (або Ctrl/⌘ + клік) — вмикається вибір; далі тап додає/прибирає.
// Внизу — панель «Вибрано N · Перемістити в папку · Скасувати».
import { useRef, useState } from "react";
import { FolderSelect } from "./FolderTree";

const HOLD_MS = 450;

export function useMultiSelect() {
  const [sel, setSel] = useState(() => new Set());
  const timer = useRef(null);
  const start = useRef(null);
  const fired = useRef(false);
  const selecting = sel.size > 0;

  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clear = () => setSel(new Set());

  // атрибути для картки; onOpen — що робити звичайним кліком (відкрити картку)
  function bind(id, onOpen, enabled = true) {
    if (!enabled) return { onClick: onOpen };
    return {
      onPointerDown: (e) => {
        if (e.button && e.button !== 0) return;
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        clearTimeout(timer.current);
        timer.current = setTimeout(() => { fired.current = true; toggle(id); try { navigator.vibrate?.(20); } catch { /* */ } }, HOLD_MS);
      },
      onPointerMove: (e) => {
        if (!start.current) return;
        if (Math.abs(e.clientX - start.current.x) > 8 || Math.abs(e.clientY - start.current.y) > 8) clearTimeout(timer.current);
      },
      onPointerUp: () => clearTimeout(timer.current),
      onPointerLeave: () => clearTimeout(timer.current),
      onPointerCancel: () => clearTimeout(timer.current),
      onContextMenu: (e) => { if (fired.current || selecting) e.preventDefault(); },
      onClick: (e) => {
        if (fired.current) { fired.current = false; e.preventDefault(); return; }
        if (selecting || e.ctrlKey || e.metaKey) { e.preventDefault(); toggle(id); return; }
        onOpen?.(e);
      },
      "data-picked": sel.has(id) ? "1" : undefined,
    };
  }

  return { sel, selecting, toggle, clear, bind, setSel };
}

// панель дій для вибраних
export function BulkBar({ ms, scope, allIds, onMove }) {
  const [folder, setFolder] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!ms.selecting) return null;
  async function move() {
    setBusy(true);
    await onMove([...ms.sel], folder || null);
    setBusy(false);
    ms.clear();
  }
  return (
    <div className="bulk-bar" role="toolbar" aria-label="Дії з вибраними">
      <b>Вибрано: {ms.sel.size}</b>
      {allIds && <button type="button" className="btn small" onClick={() => ms.setSel(new Set(allIds))}>Усі видимі</button>}
      <span className="bulk-bar__move">
        <span className="note" style={{ margin: 0 }}>у папку</span>
        <FolderSelect scope={scope} value={folder} onChange={setFolder} width={200} />
        <button type="button" className="btn small primary" disabled={busy} onClick={move}>{busy ? "Переміщую…" : "Перемістити"}</button>
      </span>
      <button type="button" className="btn small" onClick={ms.clear}>Скасувати</button>
    </div>
  );
}

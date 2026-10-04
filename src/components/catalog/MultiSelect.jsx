"use client";

// Вибір кількох карток: натиснути й притримати (або Ctrl/⌘ + клік) — вмикається вибір; далі тап додає/прибирає.
// Внизу — панель «Вибрано N · Перемістити в папку · Скасувати».
import { useRef, useState } from "react";
import { useFolders } from "./FolderTree";
import { treeOptions } from "@/lib/tree";

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
// Панель над вибраними: список папок відкривається вгору й гортається — на телефоні все видно
export function BulkBar({ ms, scope, allIds, onMove }) {
  const folders = useFolders(scope);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  if (!ms.selecting) return null;
  async function move(folderId) {
    setBusy(true);
    await onMove([...ms.sel], folderId || null);
    setBusy(false);
    setOpen(false); setQ("");
    ms.clear();
  }
  const s = q.trim().toLowerCase();
  const opts = treeOptions(folders).filter((o) => !s || o.label.toLowerCase().includes(s));
  return (
    <div className="bulk-bar" role="toolbar" aria-label="Дії з вибраними">
      {open && (
        <div className="bulk-pick">
          {folders.length > 6 && <input className="bulk-pick__q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Пошук папки…" />}
          <div className="bulk-pick__list">
            {!s && <button type="button" className="bulk-pick__item" disabled={busy} onClick={() => move(null)}>· Без папки</button>}
            {opts.map((o) => (
              <button key={o.value} type="button" className="bulk-pick__item" style={{ paddingLeft: 12 + o.depth * 16 }} disabled={busy} onClick={() => move(o.value)}>📁 {o.label}</button>
            ))}
            {!folders.length && <div className="note" style={{ padding: 8 }}>Папок ще немає — створіть їх кнопкою «+ Папка».</div>}
          </div>
        </div>
      )}
      <b>Вибрано: {ms.sel.size}</b>
      {allIds && <button type="button" className="btn small" onClick={() => ms.setSel(new Set(allIds))}>Усі видимі</button>}
      <button type="button" className={`btn small${open ? "" : " primary"}`} disabled={busy} onClick={() => setOpen((v) => !v)}>{busy ? "Переміщую…" : open ? "Закрити список" : "📁 У папку…"}</button>
      <button type="button" className="btn small" onClick={() => { setOpen(false); ms.clear(); }}>Скасувати</button>
    </div>
  );
}

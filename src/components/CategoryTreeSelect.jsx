"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDropdownPosition } from "@/lib/useFloatingDropdown";

// Single-select category picker showing the nested tree (indented,
// collapsible parents) instead of a flat <select>. Selecting a parent is
// meant to be interpreted by the caller as "this category and everything
// under it" (see getCategoryAndDescendantIds).
export default function CategoryTreeSelect({ value, categories, onChange, placeholder = "Всі категорії" }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const wrapRef = useRef(null);
  const popupRef = useRef(null);
  const pos = useDropdownPosition(open, wrapRef);

  const selected = categories.find((c) => c.id === value) || null;

  // The popup defaults to the anchor button's width, which is fine on
  // desktop but too narrow on mobile for long category names + icons —
  // widen it (clamped to the viewport) and re-clamp the left offset so it
  // stays on-screen.
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const popupWidth = pos ? Math.min(Math.max(pos.width, 280), Math.max(vw - 16, 200)) : 0;
  const popupLeft = pos ? Math.max(8, Math.min(pos.left, vw - popupWidth - 8)) : 0;

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (wrapRef.current?.contains(e.target)) return;
      if (popupRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  function toggleExpand(id, e) {
    e.preventDefault();
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function select(id) {
    onChange(id);
    setOpen(false);
  }

  function renderNode(cat, depth) {
    const children = categories.filter((c) => c.parent_id === cat.id);
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(cat.id);
    return (
      <div key={cat.id}>
        <div
          className={`combobox-item tree-cat-select-item${cat.id === value ? " active" : ""}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onMouseDown={(e) => { e.preventDefault(); select(cat.id); }}
        >
          {hasChildren ? (
            <span className="tree-toggle" onMouseDown={(e) => toggleExpand(cat.id, e)}>{isExpanded ? "▾" : "▸"}</span>
          ) : (
            <span className="tree-toggle">·</span>
          )}
          {cat.icon ? `${cat.icon} ` : ""}{cat.name}
        </div>
        {hasChildren && isExpanded && children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  return (
    <div className="ms-filter" ref={wrapRef}>
      <button type="button" className={`ms-filter-btn${value ? " active" : ""}`} onClick={() => setOpen((o) => !o)}>
        {selected ? `${selected.icon ? selected.icon + " " : ""}${selected.name}` : placeholder} ▾
      </button>
      {open && pos && createPortal(
        <div ref={popupRef} className="combobox-list tree-combobox-list" style={{ position: "fixed", top: pos.top, left: popupLeft, right: "auto", width: popupWidth, zIndex: 1000 }}>
          <div className="combobox-item combobox-clear" onMouseDown={(e) => { e.preventDefault(); select(""); }}>
            {placeholder}
          </div>
          {categories.filter((c) => !c.parent_id).map((c) => renderNode(c, 0))}
        </div>,
        document.body
      )}
    </div>
  );
}

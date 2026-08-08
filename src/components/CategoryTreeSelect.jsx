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
          {cat.name}
        </div>
        {hasChildren && isExpanded && children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  return (
    <div className="ms-filter" ref={wrapRef}>
      <button type="button" className={`ms-filter-btn${value ? " active" : ""}`} onClick={() => setOpen((o) => !o)}>
        {selected ? selected.name : placeholder} ▾
      </button>
      {open && pos && createPortal(
        <div ref={popupRef} className="combobox-list tree-combobox-list" style={{ position: "fixed", top: pos.top, left: pos.left, right: "auto", width: pos.width, zIndex: 1000 }}>
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

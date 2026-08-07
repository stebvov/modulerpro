"use client";

import { useEffect, useRef, useState } from "react";

// Single combobox for picking a material: search flattens to matching
// materials, otherwise the dropdown shows materials grouped under
// collapsible category headers (tree), so there's exactly one field
// instead of a separate "category filter" + "material" pair.
export default function MaterialTreeCombobox({ value, materials, materialCategories, onChange, onCreate, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const blurTimer = useRef(null);

  const selectedMaterial = materials.find((m) => m.id === value) || null;
  const displayValue = open ? query : selectedMaterial ? `${selectedMaterial.name} (${selectedMaterial.unit})` : "";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlight(-1);
  }, [query, open]);

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectMaterial(m) {
    setQuery("");
    setOpen(false);
    onChange(m.id);
  }

  async function handleCreate() {
    if (!onCreate || busy) return;
    setBusy(true);
    try {
      const newId = await onCreate(query.trim());
      if (newId) {
        setOpen(false);
        setQuery("");
        onChange(newId);
      }
    } finally {
      setBusy(false);
    }
  }

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const matches = searching
    ? materials.filter((m) => m.name.toLowerCase().includes(q))
    : [];
  const exactMatch = materials.some((m) => m.name.toLowerCase() === q);
  const showCreate = searching && !!onCreate && q && !exactMatch;

  // Keyboard navigation only applies while searching (flat results) — the
  // tree-browsing mode isn't linear enough to step through with arrow keys.
  const navRows = searching ? [...matches.map((m) => ({ type: "material", material: m })), ...(showCreate ? [{ type: "create" }] : [])] : [];

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === "ArrowDown") setOpen(true);
      return;
    }
    if (!navRows.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, navRows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (highlight >= 0 && navRows[highlight]) {
        e.preventDefault();
        const row = navRows[highlight];
        if (row.type === "material") selectMaterial(row.material);
        else handleCreate();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function renderCategoryNode(cat, depth) {
    const children = materialCategories.filter((c) => c.parent_id === cat.id);
    const ownMaterials = materials.filter((m) => m.category_id === cat.id);
    const isExpanded = expanded.has(cat.id);
    const hasContent = children.length > 0 || ownMaterials.length > 0;
    return (
      <div key={cat.id}>
        <div
          className="tree-cat-row"
          style={{ paddingLeft: 8 + depth * 14 }}
          onMouseDown={(e) => { e.preventDefault(); if (hasContent) toggleExpand(cat.id); }}
        >
          <span className="tree-toggle">{hasContent ? (isExpanded ? "▾" : "▸") : "·"}</span>
          {cat.name}
        </div>
        {isExpanded && (
          <>
            {ownMaterials.map((m) => (
              <div
                key={m.id}
                className={`combobox-item${m.id === value ? " active" : ""}`}
                style={{ paddingLeft: 22 + depth * 14 }}
                onMouseDown={(e) => { e.preventDefault(); selectMaterial(m); }}
              >
                {m.icon ? `${m.icon} ` : ""}{m.name} <span className="tree-unit">({m.unit})</span>
              </div>
            ))}
            {children.map((c) => renderCategoryNode(c, depth + 1))}
          </>
        )}
      </div>
    );
  }

  const uncategorized = materials.filter((m) => !m.category_id);

  return (
    <div
      className="combobox"
      onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
      onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); }}
    >
      <input
        type="text"
        placeholder={placeholder}
        value={displayValue}
        onFocus={(e) => { setOpen(true); setQuery(""); e.target.select(); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <div className="combobox-list tree-combobox-list">
          {searching ? (
            <>
              {matches.map((m, idx) => {
                const cat = materialCategories.find((c) => c.id === m.category_id);
                return (
                  <div
                    key={m.id}
                    className={`combobox-item${m.id === value ? " active" : ""}${idx === highlight ? " highlighted" : ""}`}
                    onMouseDown={(e) => { e.preventDefault(); selectMaterial(m); }}
                    onMouseEnter={() => setHighlight(idx)}
                  >
                    {m.icon ? `${m.icon} ` : ""}{m.name} <span className="tree-unit">({m.unit}{cat ? `, ${cat.name}` : ""})</span>
                  </div>
                );
              })}
              {!matches.length && <div className="combobox-empty">Нічого не знайдено</div>}
              {showCreate && (
                <div
                  className={`combobox-item combobox-create${matches.length === highlight ? " highlighted" : ""}`}
                  onMouseDown={(e) => { e.preventDefault(); handleCreate(); }}
                  onMouseEnter={() => setHighlight(matches.length)}
                >
                  {busy ? "Створення..." : `+ Створити «${query.trim()}»`}
                </div>
              )}
            </>
          ) : (
            <>
              {materialCategories.filter((c) => !c.parent_id).map((c) => renderCategoryNode(c, 0))}
              {uncategorized.length > 0 && (
                <div>
                  <div
                    className="tree-cat-row"
                    onMouseDown={(e) => { e.preventDefault(); toggleExpand("__none"); }}
                  >
                    <span className="tree-toggle">{expanded.has("__none") ? "▾" : "▸"}</span>
                    Без категорії
                  </div>
                  {expanded.has("__none") && uncategorized.map((m) => (
                    <div
                      key={m.id}
                      className={`combobox-item${m.id === value ? " active" : ""}`}
                      style={{ paddingLeft: 22 }}
                      onMouseDown={(e) => { e.preventDefault(); selectMaterial(m); }}
                    >
                      {m.icon ? `${m.icon} ` : ""}{m.name} <span className="tree-unit">({m.unit})</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

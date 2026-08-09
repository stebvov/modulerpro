"use client";

import { useRef, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { guessMaterialIcon } from "@/lib/materialIcon";

export default function MaterialCategoriesPanel({ onBack }) {
  const { supabase, materialCategories, reload } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [newMaterialCat, setNewMaterialCat] = useState("");
  const [newMaterialCatIcon, setNewMaterialCatIcon] = useState("");
  const [newMaterialCatParent, setNewMaterialCatParent] = useState("");
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const newIconTouched = useRef(false);

  function handleNewNameChange(value) {
    setNewMaterialCat(value);
    if (!newIconTouched.current) setNewMaterialCatIcon(guessMaterialIcon(value));
  }
  function handleNewIconChange(value) {
    newIconTouched.current = true;
    setNewMaterialCatIcon(value);
  }

  function toggleCollapsed(id) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function renameMaterialCategory(cat, value) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === cat.name) return;
    await supabase.from("material_categories").update({ name: trimmed }).eq("id", cat.id);
    await reload(true);
  }
  async function updateMaterialCategoryIcon(cat, value) {
    const trimmed = value.trim();
    if (trimmed === (cat.icon || "")) return;
    await supabase.from("material_categories").update({ icon: trimmed || null }).eq("id", cat.id);
    await reload(true);
  }
  async function reparentMaterialCategory(cat, parentId) {
    await supabase.from("material_categories").update({ parent_id: parentId || null }).eq("id", cat.id);
    await reload(true);
  }
  async function deleteMaterialCategory(cat) {
    if (!confirm("Видалити категорію? Неможливо, якщо нею користуються матеріали чи постачальники, або є дочірні категорії.")) return;
    const { error: e } = await supabase.from("material_categories").delete().eq("id", cat.id);
    if (e) setError("Не вдалося видалити: категорія використовується.");
    else { setError(""); await reload(true); }
  }
  async function addMaterialCategory() {
    if (!newMaterialCat.trim()) return;
    const siblings = materialCategories.filter((c) => (c.parent_id || null) === (newMaterialCatParent || null));
    const nextSortOrder = siblings.length ? Math.max(...siblings.map((c) => c.sort_order ?? 0)) + 1 : 1;
    await supabase.from("material_categories").insert([
      { name: newMaterialCat.trim(), icon: newMaterialCatIcon.trim() || null, parent_id: newMaterialCatParent || null, sort_order: nextSortOrder },
    ]);
    setNewMaterialCat("");
    setNewMaterialCatIcon("");
    setNewMaterialCatParent("");
    newIconTouched.current = false;
    await reload(true);
  }
  async function moveMaterialCategory(cat, dir) {
    const siblings = materialCategories.filter((c) => (c.parent_id || null) === (cat.parent_id || null));
    const idx = siblings.findIndex((c) => c.id === cat.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const a = siblings[idx];
    const b = siblings[swapIdx];
    await Promise.all([
      supabase.from("material_categories").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("material_categories").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    await reload(true);
  }

  function renderMaterialNode(c, depth) {
    const children = materialCategories.filter((ch) => ch.parent_id === c.id);
    const hasChildren = children.length > 0;
    const isCollapsed = collapsed.has(c.id);
    return (
      <div key={c.id}>
        <div className={`cat-item${depth ? " child" : ""}`}>
          {hasChildren ? (
            <span className="cat-toggle" onClick={() => toggleCollapsed(c.id)}>{isCollapsed ? "▸" : "▾"}</span>
          ) : (
            <span className="cat-toggle" />
          )}
          {canWriteCatalog && (
            <div className="cat-reorder">
              <button type="button" onClick={() => moveMaterialCategory(c, -1)} title="Вище">▲</button>
              <button type="button" onClick={() => moveMaterialCategory(c, 1)} title="Нижче">▼</button>
            </div>
          )}
          <input
            type="text"
            className="icon-input"
            style={{ width: 36, flexShrink: 0 }}
            defaultValue={c.icon || ""}
            disabled={!canWriteCatalog}
            placeholder="🔧"
            title="Іконка"
            onBlur={(e) => updateMaterialCategoryIcon(c, e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
          />
          <input
            type="text"
            className="rename-input"
            defaultValue={c.name}
            disabled={!canWriteCatalog}
            onBlur={(e) => renameMaterialCategory(c, e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
          />
          {canWriteCatalog && (
            <select
              className="cat-parent-select"
              value={c.parent_id || ""}
              onChange={(e) => reparentMaterialCategory(c, e.target.value)}
            >
              <option value="">— без батьківської —</option>
              {materialCategories.filter((o) => o.id !== c.id).map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          {canWriteCatalog && (
            <span className="icon-x" onClick={() => deleteMaterialCategory(c)}>×</span>
          )}
        </div>
        {hasChildren && !isCollapsed && children.map((ch) => renderMaterialNode(ch, depth + 1))}
      </div>
    );
  }

  return (
    <div>
      <div className="cat-panel-header">
        {onBack && <button className="btn small" onClick={onBack}>← Назад</button>}
        <h3>Категорії матеріалів / постачальників</h3>
      </div>
      <p className="note" style={{ marginTop: -4 }}>Порядок тут визначає порядок у фільтрах і сортування матеріалів за категорією.</p>
      {error && <div className="auth-error">{error}</div>}
      {materialCategories.filter((c) => !c.parent_id).map((c) => renderMaterialNode(c, 0))}
      {!materialCategories.length && <div className="empty">Немає категорій</div>}
      {canWriteCatalog && (
        <div className="cat-add">
          <input
            type="text"
            className="icon-input"
            style={{ width: 36, flexShrink: 0 }}
            placeholder="🔧"
            title="Іконка"
            value={newMaterialCatIcon}
            onChange={(e) => handleNewIconChange(e.target.value)}
          />
          <input
            type="text"
            placeholder="Нова категорія"
            value={newMaterialCat}
            onChange={(e) => handleNewNameChange(e.target.value)}
          />
          <select value={newMaterialCatParent} onChange={(e) => setNewMaterialCatParent(e.target.value)}>
            <option value="">без батьківської</option>
            {materialCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="btn small" onClick={addMaterialCategory}>Додати</button>
        </div>
      )}
    </div>
  );
}

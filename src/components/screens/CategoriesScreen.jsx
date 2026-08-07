"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";

export default function CategoriesScreen() {
  const { supabase, productCategories, materialCategories, reload } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [newProductCat, setNewProductCat] = useState("");
  const [newMaterialCat, setNewMaterialCat] = useState("");
  const [newMaterialCatParent, setNewMaterialCatParent] = useState("");
  const [error, setError] = useState("");
  const [collapsed, setCollapsed] = useState(() => new Set());

  function toggleCollapsed(id) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function renameProductCategory(cat, value) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === cat.name) return;
    await supabase.from("product_categories").update({ name: trimmed }).eq("id", cat.id);
    await reload(true);
  }
  async function deleteProductCategory(cat) {
    if (!confirm("Видалити категорію? Неможливо, якщо нею користуються шаблони.")) return;
    const { error: e } = await supabase.from("product_categories").delete().eq("id", cat.id);
    if (e) setError("Не вдалося видалити: категорія використовується.");
    else { setError(""); await reload(true); }
  }
  async function addProductCategory() {
    if (!newProductCat.trim()) return;
    const nextSortOrder = productCategories.length ? Math.max(...productCategories.map((c) => c.sort_order ?? 0)) + 1 : 1;
    await supabase.from("product_categories").insert([{ name: newProductCat.trim(), sort_order: nextSortOrder }]);
    setNewProductCat("");
    await reload(true);
  }
  async function moveProductCategory(cat, dir) {
    const idx = productCategories.findIndex((c) => c.id === cat.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= productCategories.length) return;
    const a = productCategories[idx];
    const b = productCategories[swapIdx];
    await Promise.all([
      supabase.from("product_categories").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("product_categories").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    await reload(true);
  }

  async function renameMaterialCategory(cat, value) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === cat.name) return;
    await supabase.from("material_categories").update({ name: trimmed }).eq("id", cat.id);
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
    await supabase.from("material_categories").insert([{ name: newMaterialCat.trim(), parent_id: newMaterialCatParent || null, sort_order: nextSortOrder }]);
    setNewMaterialCat("");
    setNewMaterialCatParent("");
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
            className="rename-input"
            defaultValue={c.name}
            disabled={!canWriteCatalog}
            onBlur={(e) => renameMaterialCategory(c, e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
          />
          {canWriteCatalog && (
            <select
              style={{ fontSize: 12, width: 150 }}
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
      {error && <div className="auth-error">{error}</div>}
      <div className="cat-columns">
        <div className="cat-col">
          <h3>Категорії товарів (шаблонів)</h3>
          {productCategories.map((c) => (
            <div className="cat-item" key={c.id}>
              {canWriteCatalog && (
                <div className="cat-reorder">
                  <button type="button" onClick={() => moveProductCategory(c, -1)} title="Вище">▲</button>
                  <button type="button" onClick={() => moveProductCategory(c, 1)} title="Нижче">▼</button>
                </div>
              )}
              <input
                type="text"
                className="rename-input"
                defaultValue={c.name}
                disabled={!canWriteCatalog}
                onBlur={(e) => renameProductCategory(c, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
              />
              {canWriteCatalog && (
                <span className="icon-x" onClick={() => deleteProductCategory(c)}>×</span>
              )}
            </div>
          ))}
          {!productCategories.length && <div className="empty">Немає категорій</div>}
          {canWriteCatalog && (
            <div className="cat-add">
              <input
                type="text"
                placeholder="Нова категорія товару"
                value={newProductCat}
                onChange={(e) => setNewProductCat(e.target.value)}
              />
              <button className="btn small" onClick={addProductCategory}>Додати</button>
            </div>
          )}
        </div>

        <div className="cat-col">
          <h3>Категорії матеріалів / постачальників</h3>
          <p className="note" style={{ marginTop: -4 }}>Порядок тут визначає порядок у фільтрах і сортування матеріалів за категорією.</p>
          {materialCategories.filter((c) => !c.parent_id).map((c) => renderMaterialNode(c, 0))}
          {!materialCategories.length && <div className="empty">Немає категорій</div>}
          {canWriteCatalog && (
            <div className="cat-add">
              <input
                type="text"
                placeholder="Нова категорія"
                value={newMaterialCat}
                onChange={(e) => setNewMaterialCat(e.target.value)}
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
      </div>
    </div>
  );
}

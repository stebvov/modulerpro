"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";

export default function ProductCategoriesPanel() {
  const { supabase, productCategories, reload } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [newProductCat, setNewProductCat] = useState("");
  const [error, setError] = useState("");

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

  return (
    <div>
      <h3>Категорії товарів (шаблонів)</h3>
      {error && <div className="auth-error">{error}</div>}
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
  );
}

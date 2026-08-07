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
    await supabase.from("product_categories").insert([{ name: newProductCat.trim() }]);
    setNewProductCat("");
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
    await supabase.from("material_categories").insert([{ name: newMaterialCat.trim(), parent_id: newMaterialCatParent || null }]);
    setNewMaterialCat("");
    setNewMaterialCatParent("");
    await reload(true);
  }

  function renderMaterialNode(c, depth) {
    return (
      <div key={c.id}>
        <div className={`cat-item${depth ? " child" : ""}`}>
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
        {materialCategories.filter((ch) => ch.parent_id === c.id).map((ch) => renderMaterialNode(ch, depth + 1))}
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

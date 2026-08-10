"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";

export default function ServiceCategoriesPanel({ onBack }) {
  const { supabase, serviceCategories, services, reload } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [error, setError] = useState("");

  function usageCount(id) {
    return services.filter((s) => s.category_id === id).length;
  }

  async function renameCategory(cat, value) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === cat.name) return;
    await supabase.from("service_categories").update({ name: trimmed }).eq("id", cat.id);
    await reload(true);
  }
  async function updateCategoryIcon(cat, value) {
    const trimmed = value.trim();
    if (trimmed === (cat.icon || "")) return;
    await supabase.from("service_categories").update({ icon: trimmed || null }).eq("id", cat.id);
    await reload(true);
  }
  async function deleteCategory(cat) {
    if (usageCount(cat.id) > 0) { setError("Не можна видалити категорію, яка використовується послугами."); return; }
    if (!confirm(`Видалити категорію «${cat.name}»?`)) return;
    setError("");
    const { error: e } = await supabase.from("service_categories").delete().eq("id", cat.id);
    if (e) { setError(e.message); return; }
    await reload(true);
  }
  async function addCategory() {
    if (!newName.trim()) return;
    const maxOrder = serviceCategories.length ? Math.max(...serviceCategories.map((c) => c.sort_order ?? 0)) : 0;
    await supabase.from("service_categories").insert([{ name: newName.trim(), icon: newIcon.trim() || null, sort_order: maxOrder + 1 }]);
    setNewName("");
    setNewIcon("");
    await reload(true);
  }
  async function moveCategory(cat, dir) {
    const idx = serviceCategories.findIndex((c) => c.id === cat.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= serviceCategories.length) return;
    const a = serviceCategories[idx];
    const b = serviceCategories[swapIdx];
    await Promise.all([
      supabase.from("service_categories").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("service_categories").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    await reload(true);
  }

  return (
    <div>
      <div className="cat-panel-header">
        {onBack && <button className="btn small" onClick={onBack}>← Назад</button>}
        <h3>Категорії послуг</h3>
      </div>
      {error && <div className="auth-error">{error}</div>}
      {serviceCategories.map((c, i, arr) => (
        <div key={c.id} className="cat-item">
          {canWriteCatalog && (
            <div className="cat-reorder">
              <button type="button" disabled={i === 0} onClick={() => moveCategory(c, -1)} title="Вище">▲</button>
              <button type="button" disabled={i === arr.length - 1} onClick={() => moveCategory(c, 1)} title="Нижче">▼</button>
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
            onBlur={(e) => updateCategoryIcon(c, e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
          />
          <input
            type="text"
            className="rename-input"
            defaultValue={c.name}
            disabled={!canWriteCatalog}
            onBlur={(e) => renameCategory(c, e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
          />
          <span className="note" style={{ minWidth: 60 }}>{usageCount(c.id)} посл.</span>
          {canWriteCatalog && (
            <span className="icon-x" onClick={() => deleteCategory(c)}>×</span>
          )}
        </div>
      ))}
      {!serviceCategories.length && <div className="empty">Немає категорій</div>}
      {canWriteCatalog && (
        <div className="cat-add">
          <input
            type="text"
            className="icon-input"
            style={{ width: 36, flexShrink: 0 }}
            placeholder="🔧"
            title="Іконка"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
          />
          <input
            type="text"
            placeholder="Нова категорія послуг"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn small" onClick={addCategory}>Додати</button>
        </div>
      )}
    </div>
  );
}

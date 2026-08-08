"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";

export default function UnitsPanel() {
  const { supabase, materials, materialUnits, reload } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [newUnit, setNewUnit] = useState("");
  const [error, setError] = useState("");

  function usageCount(name) {
    return materials.filter((m) => m.unit === name).length;
  }

  async function renameUnit(unit, value) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === unit.name) return;
    setError("");
    try {
      const { error: e } = await supabase.from("material_units").update({ name: trimmed }).eq("id", unit.id);
      if (e) throw e;
      await supabase.from("materials").update({ unit: trimmed }).eq("unit", unit.name);
      await supabase.from("template_bom_items").update({ unit: trimmed }).eq("unit", unit.name);
      await reload(true);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  async function deleteUnit(unit) {
    if (usageCount(unit.name) > 0) { setError("Не можна видалити одиницю, яка використовується матеріалами."); return; }
    if (!confirm(`Видалити одиницю «${unit.name}»?`)) return;
    setError("");
    const { error: e } = await supabase.from("material_units").delete().eq("id", unit.id);
    if (e) { setError(e.message); return; }
    await reload(true);
  }

  async function addUnit() {
    if (!newUnit.trim()) return;
    const maxOrder = materialUnits.length ? Math.max(...materialUnits.map((u) => u.sort_order)) : 0;
    const { error: e } = await supabase.from("material_units").insert([{ name: newUnit.trim(), sort_order: maxOrder + 1 }]);
    if (e) { setError(e.message); return; }
    setNewUnit("");
    await reload(true);
  }

  async function moveUnit(unit, dir) {
    const idx = materialUnits.findIndex((u) => u.id === unit.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= materialUnits.length) return;
    const a = materialUnits[idx];
    const b = materialUnits[swapIdx];
    await Promise.all([
      supabase.from("material_units").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("material_units").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    await reload(true);
  }

  return (
    <div>
      <h3>Одиниці виміру</h3>
      <p className="note" style={{ marginTop: -4 }}>
        Порядок тут визначає порядок у списку вибору одиниці. Перейменування застосується одразу до всіх матеріалів з цією одиницею.
      </p>
      {error && <div className="auth-error">{error}</div>}
      {materialUnits.map((u, i, arr) => (
        <div key={u.id} className="cat-item">
          {canWriteCatalog && (
            <div className="cat-reorder">
              <button type="button" disabled={i === 0} onClick={() => moveUnit(u, -1)} title="Вище">▲</button>
              <button type="button" disabled={i === arr.length - 1} onClick={() => moveUnit(u, 1)} title="Нижче">▼</button>
            </div>
          )}
          <input
            type="text"
            className="rename-input"
            defaultValue={u.name}
            disabled={!canWriteCatalog}
            onBlur={(e) => renameUnit(u, e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
          />
          <span className="note" style={{ minWidth: 70, marginTop: 0 }}>{usageCount(u.name)} матер.</span>
          {canWriteCatalog && (
            <span className="icon-x" onClick={() => deleteUnit(u)}>×</span>
          )}
        </div>
      ))}
      {!materialUnits.length && <div className="empty">Немає жодної одиниці</div>}
      {canWriteCatalog && (
        <div className="cat-add">
          <input
            type="text"
            placeholder="Нова одиниця (напр. компл)"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
          />
          <button className="btn small" onClick={addUnit}>Додати</button>
        </div>
      )}
    </div>
  );
}

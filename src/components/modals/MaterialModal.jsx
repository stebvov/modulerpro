"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";

export default function MaterialModal({ open, material, defaultCategoryId, onClose, onSaved }) {
  const { supabase, materialCategories, reload } = useAppData();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Resetting the form when the modal opens for a different record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setName(material ? material.name : "");
    setCategoryId(material ? material.category_id : defaultCategoryId || (materialCategories[0]?.id ?? ""));
    setUnit(material ? material.unit : "");
  }, [open, material, defaultCategoryId, materialCategories]);

  if (!open) return null;

  async function handleSave() {
    if (!name.trim() || !unit.trim()) {
      setError("Заповни назву й одиницю виміру.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { name: name.trim(), category_id: categoryId || null, unit: unit.trim() };
      if (material) {
        const { error: e } = await supabase.from("materials").update(payload).eq("id", material.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("materials").insert([payload]);
        if (e) throw e;
      }
      await reload();
      onSaved?.();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{material ? "Редагувати матеріал" : "Новий матеріал"}</h2>
        {error && <div className="auth-error">{error}</div>}
        <div className="form-row">
          <label>Назва</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Дошка 150х40" />
        </div>
        <div className="form-row">
          <label>Категорія</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {materialCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Одиниця виміру</label>
          <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="м³, м², шт, компл" />
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={saving}>Скасувати</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? "Збереження..." : "Зберегти"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { guessMaterialIcon } from "@/lib/materialIcon";
import SearchCombobox from "@/components/SearchCombobox";

export default function MaterialModal({ open, material, defaultCategoryId, onClose, onSaved }) {
  const { supabase, materialCategories, materialUnits, reload } = useAppData();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState("");
  const [icon, setIcon] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const iconTouched = useRef(false);

  const unitOptions = materialUnits.map((u) => ({ id: u.name, label: u.name }));

  async function createUnit(text) {
    const maxOrder = materialUnits.length ? Math.max(...materialUnits.map((u) => u.sort_order)) : 0;
    const { error: e } = await supabase.from("material_units").insert([{ name: text, sort_order: maxOrder + 1 }]);
    if (e) { setError(e.message); return null; }
    await reload(true);
    return text;
  }

  useEffect(() => {
    if (!open) return;
    // Resetting the form when the modal opens for a different record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setName(material ? material.name : "");
    setCategoryId(material ? material.category_id : defaultCategoryId || (materialCategories[0]?.id ?? ""));
    setUnit(material ? material.unit : "");
    setIcon(material ? material.icon || "" : "");
    iconTouched.current = !!(material && material.icon);
  }, [open, material, defaultCategoryId, materialCategories]);

  if (!open) return null;

  function handleNameChange(value) {
    setName(value);
    if (!iconTouched.current) setIcon(guessMaterialIcon(value));
  }
  function handleIconChange(value) {
    iconTouched.current = true;
    setIcon(value);
  }

  async function handleSave() {
    if (!name.trim() || !unit.trim()) {
      setError("Заповни назву й одиницю виміру.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { name: name.trim(), category_id: categoryId || null, unit: unit.trim(), icon: icon || null };
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
          <label>Категорія</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {materialCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Назва</label>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span className="mini-label">іконка</span>
              <input
                type="text"
                className="icon-input"
                style={{ width: 44, flexShrink: 0 }}
                value={icon}
                onChange={(e) => handleIconChange(e.target.value)}
                placeholder="🔧"
                title="Іконка (підбирається автоматично, можна змінити)"
              />
            </div>
            <input
              type="text"
              style={{ flex: "1 1 auto", width: "auto", minWidth: 0 }}
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="напр. Дошка 150х40"
            />
          </div>
        </div>
        <div className="form-row">
          <label>Одиниця виміру</label>
          <SearchCombobox
            value={unit}
            options={unitOptions}
            onChange={setUnit}
            onCreate={createUnit}
            placeholder="м³, м², шт, компл..."
          />
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

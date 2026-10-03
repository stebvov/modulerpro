"use client";
import DeleteButton from "@/components/DeleteButton";

import { useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { FolderSelect, NO_FOLDER } from "@/components/catalog/FolderTree";

export default function ServiceModal({ open, service, onClose, onSaved, defaultFolder }) {
  const { supabase, serviceCategories, services, reload } = useAppData();
  const [folderId, setFolderId] = useState(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState("послуга");
  const [basePrice, setBasePrice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setName(service?.name || "");
    setIcon(service?.icon || "");
    setCategoryId(service?.category_id || serviceCategories[0]?.id || "");
    setUnit(service?.unit || "послуга");
    setBasePrice(service?.base_price ?? "");
    setFolderId(service ? service.folder_id || null : defaultFolder && defaultFolder !== NO_FOLDER ? defaultFolder : null);
  }, [open, service, serviceCategories, defaultFolder]);

  if (!open) return null;

  async function handleSave() {
    if (!name.trim()) { setError("Вкажи назву послуги."); return; }
    if (!categoryId) { setError("Обери тип послуги."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        icon: icon.trim() || null,
        category_id: categoryId,
        unit: unit.trim() || "послуга",
        base_price: basePrice === "" ? null : Number(basePrice),
        folder_id: folderId || null,
      };
      const { error: e } = service
        ? await supabase.from("services").update(payload).eq("id", service.id)
        : await supabase.from("services").insert([{ ...payload, sort_order: services.length ? Math.max(...services.map((x) => x.sort_order ?? 0)) + 1 : 0 }]);
      if (e) throw e;
      await reload(true);
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
        <h2>{service ? "Редагувати послугу" : "Нова послуга"}</h2>
        {error && <div className="auth-error">{error}</div>}

        <div className="form-row">
          <label>Назва *</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input style={{ width: 44, flexShrink: 0, textAlign: "center" }} value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🔧" title="Іконка" />
            <input style={{ flex: 1 }} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <label>Папка</label>
          <FolderSelect scope="services" value={folderId} onChange={setFolderId} />
        </div>
        <div className="form-row">
          <label>Тип послуги * (для виконання: доставка, монтаж…)</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— обери тип —</option>
            {serviceCategories.map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Одиниця</label>
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="послуга, м², шт..." />
        </div>
        <div className="form-row">
          <label>Базова ціна, грн</label>
          <input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="орієнтовна ціна за одиницю" />
        </div>

        <div className="modal-actions">
          {service?.id && (
            <DeleteButton table="services" id={service.id} what="послугу"
              onDone={async () => { await reload(); onSaved?.(); onClose(); }} onError={setError} />
          )}
          <button className="btn" onClick={onClose} disabled={saving}>Скасувати</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? "Збереження..." : "Зберегти"}
          </button>
        </div>
      </div>
    </div>
  );
}

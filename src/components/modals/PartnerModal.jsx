"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useServicesData } from "@/context/ServicesDataContext";
import { SERVICE_TYPE_LABELS } from "@/lib/services";

export default function PartnerModal({ open, partner, onClose, onSaved }) {
  const { supabase, reload } = useServicesData();
  const { canWriteCatalog } = useAuth();
  const [name, setName] = useState("");
  const [serviceType, setServiceType] = useState("доставка");
  const [region, setRegion] = useState("");
  const [phone, setPhone] = useState("");
  const [reliability, setReliability] = useState(3);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Resetting the form when the modal opens for a different record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setName(partner?.name || "");
    setServiceType(partner?.service_type || "доставка");
    setRegion(partner?.region || "");
    setPhone(partner?.contact?.phone || "");
    setReliability(partner?.reliability_score || 3);
    setActive(partner ? partner.active : true);
    setNotes(partner?.notes || "");
  }, [open, partner]);

  if (!open) return null;

  async function handleSave() {
    if (!name.trim()) { setError("Вкажи назву партнера."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        service_type: serviceType,
        region: region.trim() || null,
        contact: { phone: phone.trim() || null },
        reliability_score: reliability || null,
        active,
        notes: notes.trim() || null,
      };
      if (partner) {
        const { error: e } = await supabase.from("service_partners").update(payload).eq("id", partner.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("service_partners").insert([payload]);
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
        <h2>{partner ? "Редагувати партнера" : "Новий партнер"}</h2>
        {error && <div className="auth-error">{error}</div>}

        <div className="form-row">
          <label>Назва</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Нова Пошта Вантаж" disabled={!canWriteCatalog} />
        </div>
        <div className="form-row">
          <label>Тип послуги</label>
          <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} disabled={!canWriteCatalog}>
            {Object.entries(SERVICE_TYPE_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Регіон</label>
          <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="напр. Київська область" disabled={!canWriteCatalog} />
        </div>
        <div className="form-row">
          <label>Телефон / контакт</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+380..." disabled={!canWriteCatalog} />
        </div>
        <div className="form-row">
          <label>Надійність</label>
          <div className="star-picker">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={i <= reliability ? "filled" : ""} onClick={() => canWriteCatalog && setReliability(i)}>★</span>
            ))}
          </div>
        </div>
        <div className="form-row">
          <label style={{ display: "flex", alignItems: "center", gap: 6, flexDirection: "row" }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={!canWriteCatalog} style={{ width: "auto" }} />
            Активний
          </label>
        </div>
        <div className="form-row">
          <label>Примітка</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canWriteCatalog} />
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={saving}>Скасувати</button>
          {canWriteCatalog && (
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              {saving ? "Збереження..." : "Зберегти"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

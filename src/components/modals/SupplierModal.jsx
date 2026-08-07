"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { detectContactType, contactTypeLabels } from "@/lib/format";
import ChipPicker from "@/components/ChipPicker";

function emptyContact(label, value, comment) {
  return { key: Math.random().toString(36).slice(2), label: label || "", value: value || "", comment: comment || "" };
}

export default function SupplierModal({ open, supplier, onClose, onSaved }) {
  const { supabase, materialCategories, supplierCategoryLinks, supplierContacts, reload } = useAppData();
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [notes, setNotes] = useState("");
  const [reliability, setReliability] = useState(0);
  const [selectedCats, setSelectedCats] = useState([]);
  const [contacts, setContacts] = useState([emptyContact()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const categoryOptions = materialCategories.map((c) => ({ id: c.id, label: c.name }));

  useEffect(() => {
    if (!open) return;
    // Resetting the form when the modal opens for a different record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setName(supplier ? supplier.name : "");
    setRegion(supplier ? supplier.region || "" : "");
    setNotes(supplier ? supplier.notes || "" : "");
    setReliability(supplier ? supplier.reliability_score || 0 : 0);
    setSelectedCats(
      supplier ? supplierCategoryLinks.filter((l) => l.supplier_id === supplier.id).map((l) => l.category_id) : []
    );
    const existing = supplier ? supplierContacts.filter((c) => c.supplier_id === supplier.id) : [];
    setContacts(existing.length ? existing.map((c) => emptyContact(c.label, c.value, c.comment)) : [emptyContact()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplier]);

  if (!open) return null;

  function updateContact(key, patch) {
    setContacts((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }
  function removeContact(key) {
    setContacts((prev) => prev.filter((c) => c.key !== key));
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Заповни назву постачальника.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        region: region.trim() || null,
        notes: notes.trim() || null,
        reliability_score: reliability || null,
      };
      let supplierId = supplier?.id;
      if (supplierId) {
        const { error: e } = await supabase.from("suppliers").update(payload).eq("id", supplierId);
        if (e) throw e;
      } else {
        const { data: created, error: e } = await supabase.from("suppliers").insert([payload]).select().single();
        if (e) throw e;
        supplierId = created.id;
      }

      await supabase.from("supplier_category_links").delete().eq("supplier_id", supplierId);
      if (selectedCats.length) {
        await supabase.from("supplier_category_links").insert(selectedCats.map((cid) => ({ supplier_id: supplierId, category_id: cid })));
      }

      const cleanContacts = contacts
        .filter((c) => c.value.trim())
        .map((c, idx) => ({
          supplier_id: supplierId,
          type: detectContactType(c.value),
          value: c.value.trim(),
          label: c.label.trim() || null,
          comment: c.comment.trim() || null,
          sort_order: idx,
        }));
      await supabase.from("supplier_contacts").delete().eq("supplier_id", supplierId);
      if (cleanContacts.length) {
        const { error: e } = await supabase.from("supplier_contacts").insert(cleanContacts);
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
        <h2>{supplier ? "Редагувати постачальника" : "Новий постачальник"}</h2>
        {error && <div className="auth-error">{error}</div>}

        <div className="form-row">
          <label>Назва компанії</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="form-row">
          <label>Категорії (може постачати декілька)</label>
          <ChipPicker options={categoryOptions} selected={selectedCats} onChange={setSelectedCats} placeholder="Почни вводити назву категорії..." />
        </div>

        <h4>Контакти (ім&apos;я + телефон/telegram/email/сайт/адреса — тип визначається автоматично)</h4>
        <div>
          {contacts.map((c) => {
            const type = c.value ? detectContactType(c.value) : null;
            return (
              <div key={c.key} style={{ marginBottom: 8 }}>
                <div className="contact-row">
                  <input
                    className="label-input"
                    type="text"
                    placeholder="Ім'я (напр. Марія)"
                    value={c.label}
                    onChange={(e) => updateContact(c.key, { label: e.target.value })}
                  />
                  <input
                    className="value-input"
                    type="text"
                    placeholder="телефон, telegram, email, сайт, адреса..."
                    value={c.value}
                    onChange={(e) => updateContact(c.key, { value: e.target.value })}
                  />
                  <span className="contact-type-badge">{type ? contactTypeLabels[type] : "—"}</span>
                  <span className="icon-x" onClick={() => removeContact(c.key)}>×</span>
                </div>
                <input
                  type="text"
                  className="note-link-input"
                  placeholder="коментар до контакту (необов'язково)"
                  value={c.comment}
                  onChange={(e) => updateContact(c.key, { comment: e.target.value })}
                />
              </div>
            );
          })}
        </div>
        <button className="btn small" style={{ marginBottom: 10 }} onClick={() => setContacts((p) => [...p, emptyContact()])}>
          + Додати контакт
        </button>

        <div className="form-row">
          <label>Надійність</label>
          <div className="star-picker">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={i <= reliability ? "filled" : ""} onClick={() => setReliability(i)}>★</span>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label>Коментар</label>
          <textarea rows={2} placeholder="Довільна нотатка про постачальника" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <details className="region-collapse">
          <summary>Регіон (необов&apos;язково)</summary>
          <div className="form-row" style={{ marginTop: 8 }}>
            <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} />
          </div>
        </details>

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

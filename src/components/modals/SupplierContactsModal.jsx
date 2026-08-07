"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { detectContactType, contactTypeLabels, contactHref, linkify } from "@/lib/format";

function emptyContact(label, value) {
  return { key: Math.random().toString(36).slice(2), label: label || "", value: value || "" };
}

export default function SupplierContactsModal({ supplierId, onClose, onOpenFull }) {
  const { supabase, suppliers, supplierContacts, reload } = useAppData();
  const { canWriteCatalog } = useAuth();
  const supplier = suppliers.find((s) => s.id === supplierId);
  const [rows, setRows] = useState([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supplierId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    const existing = supplierContacts.filter((c) => c.supplier_id === supplierId);
    setRows(existing.length ? existing.map((c) => emptyContact(c.label, c.value)) : [emptyContact()]);
    setNotes(suppliers.find((s) => s.id === supplierId)?.notes || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  if (!supplierId || !supplier) return null;

  function update(key, patch) {
    setRows((p) => p.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function remove(key) {
    setRows((p) => p.filter((r) => r.key !== key));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const clean = rows
        .filter((r) => r.value.trim())
        .map((r, idx) => ({
          supplier_id: supplierId,
          type: detectContactType(r.value),
          value: r.value.trim(),
          label: r.label.trim() || null,
          sort_order: idx,
        }));
      await supabase.from("supplier_contacts").delete().eq("supplier_id", supplierId);
      if (clean.length) {
        const { error: e } = await supabase.from("supplier_contacts").insert(clean);
        if (e) throw e;
      }
      const { error: e2 } = await supabase.from("suppliers").update({ notes: notes.trim() || null }).eq("id", supplierId);
      if (e2) throw e2;
      await reload(true);
      onClose();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Контакти — {supplier.name}</h2>
        {error && <div className="auth-error">{error}</div>}
        {rows.map((r) => {
          const type = r.value ? detectContactType(r.value) : null;
          const href = type ? contactHref(type, r.value) : null;
          return (
            <div className="contact-row" key={r.key}>
              <input
                className="label-input"
                type="text"
                placeholder="Ім'я"
                value={r.label}
                disabled={!canWriteCatalog}
                onChange={(e) => update(r.key, { label: e.target.value })}
              />
              <input
                className="value-input"
                type="text"
                placeholder="телефон, email, сайт, telegram..."
                value={r.value}
                disabled={!canWriteCatalog}
                onChange={(e) => update(r.key, { value: e.target.value })}
              />
              <span className="contact-type-badge">{type ? contactTypeLabels[type] : "—"}</span>
              {href && (
                <a href={href} target="_blank" rel="noreferrer" className="btn small">Відкрити</a>
              )}
              {canWriteCatalog && (
                <span className="icon-x" onClick={() => remove(r.key)}>×</span>
              )}
            </div>
          );
        })}
        {!rows.length && <div className="empty">Немає контактів</div>}
        {canWriteCatalog && (
          <button className="btn small" style={{ marginBottom: 10 }} onClick={() => setRows((p) => [...p, emptyContact()])}>
            + Додати контакт
          </button>
        )}

        <div className="form-row">
          <label>Коментар про постачальника</label>
          {canWriteCatalog ? (
            <textarea
              rows={2}
              placeholder="Нотатка, посилання..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          ) : (
            notes ? <div className="note-preview">{linkify(notes)}</div> : <span className="note">Немає коментаря</span>
          )}
        </div>

        <div className="modal-actions">
          {onOpenFull && (
            <button className="btn" style={{ marginRight: "auto" }} onClick={() => onOpenFull(supplier)} disabled={saving}>
              Відкрити повну форму
            </button>
          )}
          <button className="btn" onClick={onClose} disabled={saving}>{canWriteCatalog ? "Скасувати" : "Закрити"}</button>
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

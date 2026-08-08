"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProductionData } from "@/context/ProductionDataContext";

export default function ProductionSettingsModal({ open, onClose }) {
  const { supabase, sites, slots, capacityHistory, reload } = useProductionData();
  const { canWriteCatalog } = useAuth();
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [historyOpenFor, setHistoryOpenFor] = useState(null);
  const [capacityDraft, setCapacityDraft] = useState({});
  const [commentDraft, setCommentDraft] = useState({});
  const [saving, setSaving] = useState(null);

  if (!open) return null;

  function activeSlotCount(siteId) {
    return slots.filter((s) => s.site_id === siteId && s.status !== "готово").length;
  }

  async function renameSite(site, name) {
    if (!name.trim() || name === site.name) return;
    await supabase.from("production_sites").update({ name: name.trim() }).eq("id", site.id);
    await reload(true);
  }

  async function updateResponsible(site, value) {
    if (value === (site.responsible_person || "")) return;
    await supabase.from("production_sites").update({ responsible_person: value || null }).eq("id", site.id);
    await reload(true);
  }

  async function saveCapacity(site) {
    const raw = capacityDraft[site.id];
    const newValue = raw === "" || raw == null ? null : Number(raw);
    const oldValue = site.capacity_units_per_month ?? null;
    if (newValue === oldValue) return;
    setSaving(site.id);
    setError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error: e } = await supabase.from("production_sites").update({ capacity_units_per_month: newValue }).eq("id", site.id);
      if (e) throw e;
      await supabase.from("production_site_capacity_history").insert([
        { site_id: site.id, old_value: oldValue, new_value: newValue, comment: (commentDraft[site.id] || "").trim() || null, changed_by: user?.id || null },
      ]);
      setCapacityDraft((d) => ({ ...d, [site.id]: undefined }));
      setCommentDraft((d) => ({ ...d, [site.id]: "" }));
      await reload(true);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(null);
    }
  }

  async function deleteSite(site) {
    if (activeSlotCount(site.id) > 0) { setError("Не можна видалити майданчик з активними слотами."); return; }
    if (!confirm(`Видалити майданчик «${site.name}»?`)) return;
    setError("");
    const { error: e } = await supabase.from("production_sites").delete().eq("id", site.id);
    if (e) { setError(e.message); return; }
    await reload(true);
  }

  async function addSite() {
    if (!newName.trim()) return;
    const maxOrder = sites.length ? Math.max(...sites.map((s) => s.sort_order)) : 0;
    const { error: e } = await supabase.from("production_sites").insert([{ name: newName.trim(), sort_order: maxOrder + 1 }]);
    if (e) { setError(e.message); return; }
    setNewName("");
    await reload(true);
  }

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <h2>Налаштування виробництва</h2>
        {error && <div className="auth-error">{error}</div>}
        <p className="note">
          Майданчики: створення, редагування, видалення. Зміна пропускної здатності зберігається в історії — з коментарем і тим, хто змінив.
        </p>

        {sites.map((site) => {
          const draft = capacityDraft[site.id];
          const capacityValue = draft !== undefined ? draft : (site.capacity_units_per_month ?? "");
          const isDirty = draft !== undefined && Number(draft || null) !== (site.capacity_units_per_month ?? null) && !(draft === "" && site.capacity_units_per_month == null);
          const history = capacityHistory.filter((h) => h.site_id === site.id);
          return (
            <div key={site.id} className="section-details" style={{ padding: 12, marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input
                  style={{ flex: 1, fontWeight: 600 }}
                  defaultValue={site.name}
                  disabled={!canWriteCatalog}
                  onBlur={(e) => renameSite(site, e.target.value)}
                />
                <button className="btn small" style={{ color: "var(--danger)" }} onClick={() => deleteSite(site)} disabled={!canWriteCatalog}>
                  Видалити
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
                <div className="form-row" style={{ margin: 0 }}>
                  <label>Відповідальний</label>
                  <input
                    defaultValue={site.responsible_person || ""}
                    disabled={!canWriteCatalog}
                    onBlur={(e) => updateResponsible(site, e.target.value)}
                  />
                </div>
                <div className="form-row" style={{ margin: 0 }}>
                  <label>Юнітів / міс</label>
                  <input
                    type="number"
                    min="0"
                    value={capacityValue}
                    disabled={!canWriteCatalog}
                    onChange={(e) => setCapacityDraft((d) => ({ ...d, [site.id]: e.target.value }))}
                  />
                </div>
              </div>
              {isDirty && canWriteCatalog && (
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input
                    style={{ flex: 1 }}
                    placeholder="Коментар — чому змінюється (необов'язково)"
                    value={commentDraft[site.id] || ""}
                    onChange={(e) => setCommentDraft((d) => ({ ...d, [site.id]: e.target.value }))}
                  />
                  <button className="btn primary small" onClick={() => saveCapacity(site)} disabled={saving === site.id}>
                    {saving === site.id ? "..." : "Зберегти зміну"}
                  </button>
                </div>
              )}
              <button className="btn small" onClick={() => setHistoryOpenFor(historyOpenFor === site.id ? null : site.id)}>
                {historyOpenFor === site.id ? "Сховати історію" : `Історія змін (${history.length})`}
              </button>
              {historyOpenFor === site.id && (
                <div style={{ marginTop: 8 }}>
                  {!history.length && <div className="note">Змін пропускної здатності ще не було.</div>}
                  {history.map((h) => (
                    <div key={h.id} className="note" style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                      {h.old_value ?? "—"} → {h.new_value ?? "—"} юнітів/міс
                      {h.comment ? ` · ${h.comment}` : ""} · {h.profiles?.full_name || "—"} ·{" "}
                      {new Date(h.changed_at).toLocaleString("uk-UA")}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {canWriteCatalog && (
          <div style={{ display: "flex", gap: 6 }}>
            <input style={{ flex: 1 }} placeholder="Назва нового майданчика" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button className="btn primary small" onClick={addSite}>+ Майданчик</button>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Закрити</button>
        </div>
      </div>
    </div>
  );
}

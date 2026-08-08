"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMarketingData } from "@/context/MarketingDataContext";
import { CAMPAIGN_STATUSES, CHANNELS, CHANNEL_LABELS } from "@/lib/marketing";

export default function CampaignModal({ open, campaign, onClose, onSaved }) {
  const { supabase, reload } = useMarketingData();
  const { canWriteCatalog } = useAuth();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("instagram");
  const [budget, setBudget] = useState("");
  const [leads, setLeads] = useState("0");
  const [status, setStatus] = useState("активна");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Resetting the form when the modal opens for a different record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setName(campaign?.name || "");
    setChannel(campaign?.channel || "instagram");
    setBudget(campaign?.budget ?? "");
    setLeads(String(campaign?.leads_generated ?? 0));
    setStatus(campaign?.status || "активна");
    setStartDate(campaign?.start_date || "");
    setEndDate(campaign?.end_date || "");
    setNotes(campaign?.notes || "");
  }, [open, campaign]);

  if (!open) return null;

  async function handleSave() {
    if (!name.trim()) { setError("Вкажи назву кампанії."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        channel,
        budget: Number(budget) || 0,
        leads_generated: Number(leads) || 0,
        status,
        start_date: startDate || null,
        end_date: endDate || null,
        notes: notes.trim() || null,
      };
      if (campaign) {
        const { error: e } = await supabase.from("campaigns").update(payload).eq("id", campaign.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("campaigns").insert([payload]);
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

  async function handleDelete() {
    if (!campaign) return;
    if (!confirm("Видалити цю кампанію?")) return;
    setSaving(true);
    try {
      const { error: e } = await supabase.from("campaigns").delete().eq("id", campaign.id);
      if (e) throw e;
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
        <h2>{campaign ? "Редагувати кампанію" : "Нова кампанія"}</h2>
        {error && <div className="auth-error">{error}</div>}

        <div className="form-row">
          <label>Назва</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Осінній набір на глемпінги" disabled={!canWriteCatalog} />
        </div>
        <div className="form-row">
          <label>Канал</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} disabled={!canWriteCatalog}>
            {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Бюджет, грн</label>
          <input type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="20000" disabled={!canWriteCatalog} />
        </div>
        <div className="form-row">
          <label>Ліди отримано</label>
          <input type="number" min="0" value={leads} onChange={(e) => setLeads(e.target.value)} disabled={!canWriteCatalog} />
        </div>
        <div className="form-row">
          <label>Статус</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canWriteCatalog}>
            {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Період</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!canWriteCatalog} />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={!canWriteCatalog} />
          </div>
        </div>
        <div className="form-row">
          <label>Примітка</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canWriteCatalog} placeholder="Необов'язково" />
        </div>

        <div className="modal-actions">
          {campaign && canWriteCatalog && <button className="btn" style={{ color: "var(--danger)", marginRight: "auto" }} onClick={handleDelete} disabled={saving}>Видалити</button>}
          <button className="btn" onClick={onClose} disabled={saving}>Скасувати</button>
          {canWriteCatalog && (
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              {saving ? "Збереження..." : campaign ? "Зберегти" : "Створити"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

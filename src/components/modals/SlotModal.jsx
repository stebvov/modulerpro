"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProductionData } from "@/context/ProductionDataContext";
import SearchCombobox from "@/components/SearchCombobox";
import { SLOT_STATUSES, STAGE_NAMES, toDateInputValue } from "@/lib/production";

export default function SlotModal({ open, slot, defaultSiteId, onClose, onSaved }) {
  const { supabase, sites, slots, stages, houseDeals, templates, reload } = useProductionData();
  const { canWriteCatalog } = useAuth();
  const [siteId, setSiteId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState("вільний");
  const [dealId, setDealId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Resetting the form when the modal opens for a different record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setSiteId(slot ? slot.site_id : defaultSiteId || "");
    setStartDate(slot ? toDateInputValue(slot.start_date) : toDateInputValue(new Date()));
    setDeadline(slot ? toDateInputValue(slot.deadline) : toDateInputValue(new Date(Date.now() + 14 * 86400000)));
    setStatus(slot ? slot.status : "вільний");
    setDealId(slot ? slot.deal_id || "" : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slot]);

  if (!open) return null;

  const usedDealIds = new Set(slots.filter((s) => s.deal_id && s.id !== slot?.id).map((s) => s.deal_id));
  const dealOptions = houseDeals
    .filter((d) => d.id === dealId || !usedDealIds.has(d.id))
    .map((d) => {
      const tpl = templates.find((t) => t.id === d.template_id);
      const desc = d.is_custom ? `кастом ${d.custom_area_m2 || "?"} м²` : tpl ? `${tpl.name}` : "без шаблону";
      return { id: d.id, label: `${d.lead_name || d.id.slice(0, 8)} — ${desc}` };
    });

  const slotStages = slot ? stages.filter((s) => s.slot_id === slot.id).sort((a, b) => STAGE_NAMES.indexOf(a.stage_name) - STAGE_NAMES.indexOf(b.stage_name)) : [];

  async function toggleStage(stage) {
    const completed_at = stage.completed_at ? null : new Date().toISOString();
    await supabase.from("production_stages").update({ completed_at }).eq("id", stage.id);
    await reload(true);
  }

  async function handleSave() {
    if (!siteId) { setError("Обери майданчик."); return; }
    if (new Date(deadline) < new Date(startDate)) { setError("Дедлайн не може бути раніше дати початку."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        site_id: siteId,
        start_date: startDate,
        deadline,
        status,
        deal_id: dealId || null,
      };
      if (slot) {
        const { error: e } = await supabase.from("production_slots").update(payload).eq("id", slot.id);
        if (e) throw e;
      } else {
        const { data: created, error: e } = await supabase.from("production_slots").insert([payload]).select().single();
        if (e) throw e;
        const { error: e2 } = await supabase
          .from("production_stages")
          .insert(STAGE_NAMES.map((stage_name, i) => ({ slot_id: created.id, stage_name, sort_order: i })));
        if (e2) throw e2;
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
    if (!slot) return;
    if (!confirm("Видалити цей виробничий слот разом з чек-листом етапів?")) return;
    setSaving(true);
    try {
      const { error: e } = await supabase.from("production_slots").delete().eq("id", slot.id);
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
    <div className="modal-overlay open ops-theme" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{slot ? "Юніт у виробництві" : "Новий виробничий слот"}</h2>
        {error && <div className="auth-error">{error}</div>}

        <div className="form-row">
          <label>Майданчик</label>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={!canWriteCatalog}>
            <option value="">— обери —</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Дата початку</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!canWriteCatalog} />
        </div>
        <div className="form-row">
          <label>Дедлайн</label>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} disabled={!canWriteCatalog} />
        </div>
        <div className="form-row">
          <label>Статус</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canWriteCatalog}>
            {SLOT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Прив&apos;язана угода (з воронки «Продаж будинків»)</label>
          <SearchCombobox
            value={dealId}
            options={dealOptions}
            placeholder="Без угоди — резерв майданчика"
            onChange={(id) => { setDealId(id); if (id && status === "вільний") setStatus("заброньований"); }}
            disabled={!canWriteCatalog}
          />
        </div>

        {slot && (
          <div className="form-row">
            <label>Чек-лист етапів</label>
            <div className="stage-checklist">
              {slotStages.map((st) => (
                <div key={st.id} className={`stage-item${st.completed_at ? " done" : ""}`}>
                  <span className="stage-check" onClick={() => canWriteCatalog && toggleStage(st)}>{st.completed_at ? "✓" : ""}</span>
                  <span className="stage-name">{st.stage_name}</span>
                  {st.completed_at && <span className="stage-date mono">{new Date(st.completed_at).toLocaleDateString("uk-UA")}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions">
          {slot && canWriteCatalog && <button className="btn" style={{ color: "var(--danger)", marginRight: "auto" }} onClick={handleDelete} disabled={saving}>Видалити</button>}
          <button className="btn" onClick={onClose} disabled={saving}>Закрити</button>
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

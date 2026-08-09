"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useServicesData } from "@/context/ServicesDataContext";
import { SERVICE_TYPE_ICONS, SERVICE_TYPE_LABELS, EXECUTION_STATUSES, EXPENSE_FIELDS, curr } from "@/lib/services";

function dealServiceLabel(ds) {
  const leadName = ds.deals?.leads?.name || "Без клієнта";
  const type = SERVICE_TYPE_LABELS[ds.service_type] || ds.service_type;
  return `${leadName} — ${SERVICE_TYPE_ICONS[ds.service_type] || "•"} ${type} — ${curr(ds.price)}`;
}

export default function ExecutionModal({ open, execution, onClose, onSaved }) {
  const { supabase, partners, executions, dealServices, reload } = useServicesData();
  const { canWriteCatalog } = useAuth();
  const [dealServiceId, setDealServiceId] = useState("");
  const [executorType, setExecutorType] = useState("власна_бригада");
  const [partnerId, setPartnerId] = useState("");
  const [status, setStatus] = useState("заплановано");
  const [expenses, setExpenses] = useState({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Resetting the form when the modal opens for a different record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setDealServiceId(execution?.deal_service_id || "");
    setExecutorType(execution?.executor_type || "власна_бригада");
    setPartnerId(execution?.partner_id || "");
    setStatus(execution?.status || "заплановано");
    const t = execution?.trip_expenses || {};
    setExpenses(Object.fromEntries(EXPENSE_FIELDS.map((f) => [f.key, t[f.key] || 0])));
    setNotes(execution?.notes || "");
  }, [open, execution]);

  if (!open) return null;

  const usedIds = new Set(executions.filter((e) => e.id !== execution?.id).map((e) => e.deal_service_id));
  const availableDealServices = dealServices.filter((ds) => ds.id === dealServiceId || !usedIds.has(ds.id));
  const activePartners = partners.filter((p) => p.active);
  const actualSum = EXPENSE_FIELDS.reduce((s, f) => s + (Number(expenses[f.key]) || 0), 0);
  const ds = execution?.deal_services || dealServices.find((d) => d.id === dealServiceId);

  function setExpense(key, value) {
    setExpenses((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!dealServiceId) { setError("Обери послугу з угоди."); return; }
    if (executorType === "партнер" && !partnerId) { setError("Обери партнера."); return; }
    setSaving(true);
    setError("");
    try {
      const trip_expenses = Object.fromEntries(EXPENSE_FIELDS.map((f) => [f.key, Number(expenses[f.key]) || 0]));
      const payload = {
        executor_type: executorType,
        partner_id: executorType === "партнер" ? partnerId : null,
        status,
        trip_expenses,
        actual_cost: actualSum,
        notes: notes.trim() || null,
      };
      if (execution) {
        const { error: e } = await supabase.from("service_execution").update(payload).eq("id", execution.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("service_execution").insert([{ ...payload, deal_service_id: dealServiceId }]);
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
    if (!execution) return;
    if (!confirm("Видалити це виконання послуги?")) return;
    setSaving(true);
    try {
      const { error: e } = await supabase.from("service_execution").delete().eq("id", execution.id);
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
        <h2>{execution ? "Виконання послуги" : "Нове виконання послуги"}</h2>
        {error && <div className="auth-error">{error}</div>}

        <div className="form-row">
          <label>Послуга з угоди (CRM)</label>
          <select value={dealServiceId} onChange={(e) => setDealServiceId(e.target.value)} disabled={!canWriteCatalog || !!execution}>
            <option value="">— обери —</option>
            {availableDealServices.map((d) => <option key={d.id} value={d.id}>{dealServiceLabel(d)}</option>)}
          </select>
        </div>

        {ds && (
          <div style={{ background: "var(--accent-bg)", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
            <div className="note" style={{ display: "flex", justifyContent: "space-between" }}><span>Ціна клієнту</span><span>{curr(ds.price)}</span></div>
            <div className="note" style={{ display: "flex", justifyContent: "space-between" }}><span>Планова собівартість</span><span>{curr(ds.cost_estimate)}</span></div>
          </div>
        )}

        <div className="form-row">
          <label>Виконавець</label>
          <div className="seg-row">
            <button type="button" className={`seg-btn${executorType === "партнер" ? " active" : ""}`} onClick={() => canWriteCatalog && setExecutorType("партнер")}>Партнер</button>
            <button type="button" className={`seg-btn${executorType === "власна_бригада" ? " active" : ""}`} onClick={() => canWriteCatalog && setExecutorType("власна_бригада")}>Власна бригада</button>
          </div>
        </div>
        {executorType === "партнер" && (
          <div className="form-row">
            <label>Партнер</label>
            <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} disabled={!canWriteCatalog}>
              <option value="">— обери —</option>
              {activePartners.map((p) => <option key={p.id} value={p.id}>{p.name} ({SERVICE_TYPE_ICONS[p.service_type] || "•"} {SERVICE_TYPE_LABELS[p.service_type] || p.service_type})</option>)}
            </select>
          </div>
        )}

        {execution && (
          <>
            <div className="form-row">
              <label>Статус</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canWriteCatalog}>
                {EXECUTION_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Факт витрат</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {EXPENSE_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="note" style={{ display: "block", marginBottom: 4 }}>{f.label}</label>
                    <input type="number" min="0" value={expenses[f.key] ?? 0} onChange={(e) => setExpense(f.key, e.target.value)} disabled={!canWriteCatalog} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--amber-bg)", borderRadius: 8, padding: "10px 12px", marginTop: 10 }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>Разом факт</span>
                <span style={{ fontWeight: 600, fontSize: 16, color: "var(--amber)" }}>{curr(actualSum)}</span>
              </div>
            </div>
          </>
        )}

        <div className="form-row">
          <label>Примітка</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canWriteCatalog} placeholder="Необов'язково" />
        </div>

        <div className="modal-actions">
          {execution && canWriteCatalog && <button className="btn" style={{ color: "var(--danger)", marginRight: "auto" }} onClick={handleDelete} disabled={saving}>Видалити</button>}
          <button className="btn" onClick={onClose} disabled={saving}>Скасувати</button>
          {canWriteCatalog && (
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              {saving ? "Збереження..." : execution ? "Зберегти" : "Створити"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

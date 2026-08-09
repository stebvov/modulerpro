"use client";

import { useEffect, useState } from "react";
import { useCrmData } from "@/context/CrmDataContext";
import { useAuth } from "@/context/AuthContext";

export default function MarginThresholdModal({ open, onClose }) {
  const { supabase, reload } = useCrmData();
  const { user } = useAuth();
  const [value, setValue] = useState("20");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    (async () => {
      const { data } = await supabase
        .from("owner_dashboard_settings")
        .select("margin_alert_threshold_pct")
        .eq("owner_id", user.id)
        .maybeSingle();
      setValue(data ? String(data.margin_alert_threshold_pct) : "20");
    })();
  }, [open, user, supabase]);

  if (!open) return null;

  async function handleSave() {
    const pct = Number(value);
    if (!pct || pct <= 0) { setError("Вкажи додатне число."); return; }
    setSaving(true);
    setError("");
    try {
      const { error: e } = await supabase
        .from("owner_dashboard_settings")
        .upsert({ owner_id: user.id, margin_alert_threshold_pct: pct }, { onConflict: "owner_id" });
      if (e) throw e;
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
        <h2>Поріг маржі-сигналізації</h2>
        {error && <div className="auth-error">{error}</div>}
        <p className="note">
          Якщо маржа угоди (ціна виробництва мінус собівартість) падає нижче цього порогу — картка угоди
          у воронці CRM показує червоний бейдж-попередження.
        </p>
        <div className="form-row">
          <label>Поріг, %</label>
          <input type="number" min="0" max="100" step="1" value={value} onChange={(e) => setValue(e.target.value)} />
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

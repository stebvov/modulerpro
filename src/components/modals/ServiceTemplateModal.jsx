"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";

function emptyItemRow(overrides) {
  return {
    key: Math.random().toString(36).slice(2),
    service_id: overrides?.service_id || "",
    quantity: overrides?.quantity ?? 1,
    unit_price_override: overrides?.unit_price_override ?? "",
  };
}

export default function ServiceTemplateModal({ open, template, onClose, onSaved }) {
  const { supabase, services, serviceCategories, serviceTemplateItems, reload } = useAppData();
  const [name, setName] = useState("");
  const [status, setStatus] = useState("draft");
  const [fixedPrice, setFixedPrice] = useState("");
  const [rows, setRows] = useState([emptyItemRow()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setName(template?.name || "");
    setStatus(template?.status || "draft");
    setFixedPrice(template?.fixed_price ?? "");
    if (template) {
      const items = serviceTemplateItems
        .filter((i) => i.service_template_id === template.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((i) => emptyItemRow(i));
      setRows(items.length ? items : [emptyItemRow()]);
    } else {
      setRows([emptyItemRow()]);
    }
  }, [open, template, serviceTemplateItems]);

  if (!open) return null;

  function updateRow(idx, patch) {
    setRows((r) => { const next = [...r]; next[idx] = { ...next[idx], ...patch }; return next; });
  }
  function addRow() {
    setRows((r) => [...r, emptyItemRow()]);
  }
  function removeRow(idx) {
    setRows((r) => r.filter((_, i) => i !== idx));
  }

  function rowUnitPrice(row) {
    if (row.unit_price_override !== "" && row.unit_price_override != null) return Number(row.unit_price_override);
    const svc = services.find((s) => s.id === row.service_id);
    return Number(svc?.base_price) || 0;
  }
  const computedTotal = rows.reduce((sum, r) => sum + rowUnitPrice(r) * (Number(r.quantity) || 0), 0);
  const total = fixedPrice !== "" ? Number(fixedPrice) : computedTotal;

  async function handleSave() {
    if (!name.trim()) { setError("Вкажи назву шаблону послуг."); return; }
    const cleanRows = rows.filter((r) => r.service_id && Number(r.quantity) > 0);
    if (!cleanRows.length) { setError("Додай хоча б одну послугу."); return; }
    setSaving(true);
    setError("");
    try {
      const fixed_price = fixedPrice === "" ? null : Number(fixedPrice);
      let templateId = template?.id;
      if (templateId) {
        const { error: e } = await supabase.from("service_templates").update({ name: name.trim(), status, fixed_price }).eq("id", templateId);
        if (e) throw e;
        await supabase.from("service_template_items").delete().eq("service_template_id", templateId);
      } else {
        const { data: created, error: e } = await supabase.from("service_templates").insert([{ name: name.trim(), status, fixed_price }]).select().single();
        if (e) throw e;
        templateId = created.id;
      }

      const { error: e } = await supabase.from("service_template_items").insert(
        cleanRows.map((r, i) => ({
          service_template_id: templateId,
          service_id: r.service_id,
          quantity: Number(r.quantity),
          unit_price_override: r.unit_price_override === "" ? null : Number(r.unit_price_override),
          sort_order: i + 1,
        }))
      );
      if (e) throw e;

      await reload(true);
      onSaved?.();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!template) return;
    if (!confirm(`Видалити шаблон послуг «${template.name}»?`)) return;
    setSaving(true);
    setError("");
    try {
      await supabase.from("service_template_items").delete().eq("service_template_id", template.id);
      const { error: e } = await supabase.from("service_templates").delete().eq("id", template.id);
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
      <div className="modal modal-lg">
        <h2>{template ? "Редагувати шаблон послуг" : "Новий шаблон послуг"}</h2>
        {error && <div className="auth-error">{error}</div>}

        <div className="form-row">
          <label>Назва *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Повний монтаж під ключ" />
        </div>
        <div className="form-row">
          <label>Статус</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">Чернетка</option>
            <option value="active">Активний</option>
            <option value="archived">Архів</option>
          </select>
        </div>
        <div className="form-row">
          <label>Фіксована ціна, грн</label>
          <input type="number" value={fixedPrice} onChange={(e) => setFixedPrice(e.target.value)} placeholder={`за замовчуванням — сума послуг (${computedTotal.toLocaleString("uk-UA")} грн)`} />
        </div>

        <div className="form-row">
          <label>Послуги в шаблоні</label>
          {rows.map((row, i) => {
            const svc = services.find((s) => s.id === row.service_id);
            const cat = svc ? serviceCategories.find((c) => c.id === svc.category_id) : null;
            return (
              <div key={row.key} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                <select style={{ flex: 2 }} value={row.service_id} onChange={(e) => updateRow(i, { service_id: e.target.value })}>
                  <option value="">— обери послугу —</option>
                  {services.map((s) => {
                    const c = serviceCategories.find((x) => x.id === s.category_id);
                    return (
                      <option key={s.id} value={s.id}>
                        {c?.icon ? `${c.icon} ` : ""}{s.name}{s.base_price != null ? ` · ${Number(s.base_price).toLocaleString("uk-UA")} грн/${s.unit}` : ""}
                      </option>
                    );
                  })}
                </select>
                <input type="number" min="0.01" step="0.01" style={{ width: 70 }} value={row.quantity} onChange={(e) => updateRow(i, { quantity: e.target.value })} title="Кількість" />
                <input type="number" style={{ width: 90 }} value={row.unit_price_override} onChange={(e) => updateRow(i, { unit_price_override: e.target.value })} placeholder={svc?.base_price != null ? String(svc.base_price) : "ціна"} title="Ціна за одиницю (можна змінити)" />
                <span className="icon-x" onClick={() => removeRow(i)}>×</span>
              </div>
            );
          })}
          <button type="button" className="btn small self-left" onClick={addRow}>+ Додати послугу</button>
        </div>

        <div style={{ background: "var(--accent-bg)", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
          <div className="note" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>{fixedPrice !== "" ? "Разом (фіксована ціна)" : "Разом (базова ціна)"}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--accent)" }}>{total.toLocaleString("uk-UA")} грн</div>
        </div>

        <div className="modal-actions">
          {template && (
            <button className="btn" style={{ color: "var(--danger)", marginRight: "auto" }} onClick={handleDelete} disabled={saving}>Видалити</button>
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

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMarketingData } from "@/context/MarketingDataContext";
import { ASSET_STATUSES, ASSET_TYPE_LABELS, CHANNELS, CHANNEL_LABELS } from "@/lib/marketing";

function toDateInputValue(iso) {
  return iso ? iso.slice(0, 10) : "";
}

export default function AssetModal({ open, asset, defaultDate, onClose, onSaved }) {
  const { supabase, templates, reload } = useMarketingData();
  const { canWriteCatalog } = useAuth();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("фото");
  const [channel, setChannel] = useState("instagram");
  const [status, setStatus] = useState("чернетка");
  const [date, setDate] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Resetting the form when the modal opens for a different record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setTitle(asset?.title || "");
    setType(asset?.type || "фото");
    setChannel(asset?.channel || "instagram");
    setStatus(asset?.status || "чернетка");
    setDate(toDateInputValue(asset?.scheduled_at) || defaultDate || "");
    setTemplateId(asset?.template_id || "");
    setCaption(asset?.caption || "");
  }, [open, asset, defaultDate]);

  if (!open) return null;

  async function handleSave() {
    if (!title.trim()) { setError("Вкажи заголовок."); return; }
    setSaving(true);
    setError("");
    try {
      const scheduled_at = date ? `${date}T09:00:00` : null;
      const payload = {
        title: title.trim(),
        type,
        channel,
        status,
        template_id: templateId || null,
        caption: caption.trim() || null,
        scheduled_at,
        published_at: status === "опубліковано" ? scheduled_at : null,
      };
      if (asset) {
        const { error: e } = await supabase.from("marketing_assets").update(payload).eq("id", asset.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("marketing_assets").insert([payload]);
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
    if (!asset) return;
    if (!confirm("Видалити цей контент?")) return;
    setSaving(true);
    try {
      const { error: e } = await supabase.from("marketing_assets").delete().eq("id", asset.id);
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
        <h2>{asset ? "Редагувати контент" : "Новий контент"}</h2>
        {error && <div className="auth-error">{error}</div>}

        <div className="form-row">
          <label>Заголовок</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="напр. Простір40 — фото фасаду" disabled={!canWriteCatalog} />
        </div>
        <div className="form-row">
          <label>Тип</label>
          <select value={type} onChange={(e) => setType(e.target.value)} disabled={!canWriteCatalog}>
            {Object.entries(ASSET_TYPE_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Канал</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} disabled={!canWriteCatalog}>
            {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Статус</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canWriteCatalog}>
            {ASSET_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Дата публікації</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!canWriteCatalog} />
        </div>
        <div className="form-row">
          <label>Шаблон (необов&apos;язково)</label>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={!canWriteCatalog}>
            <option value="">— без прив&apos;язки —</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>Підпис / caption</label>
          <textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} disabled={!canWriteCatalog} placeholder="Текст посту або опис креативу" />
        </div>

        <div className="modal-actions">
          {asset && canWriteCatalog && <button className="btn" style={{ color: "var(--danger)", marginRight: "auto" }} onClick={handleDelete} disabled={saving}>Видалити</button>}
          <button className="btn" onClick={onClose} disabled={saving}>Скасувати</button>
          {canWriteCatalog && (
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              {saving ? "Збереження..." : asset ? "Зберегти" : "Створити"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

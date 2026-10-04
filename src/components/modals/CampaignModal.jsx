"use client";

// Рекламна кампанія: звідки ліди (наш квіз / UTM на сайті / лід-форма FB), план бюджету,
// ліди й витрати поза системою (вручну). Ліди з привʼязаного квізу чи з UTM рахуються самі,
// витрати — з транзакцій, привʼязаних до кампанії (💸 Внести витрату).
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMarketingData } from "@/context/MarketingDataContext";
import { CAMPAIGN_STATUSES } from "@/lib/marketing";

export const SOURCE_KINDS = [
  ["quiz", "🧩 Квіз"],
  ["fb_form", "📋 Лід-форма Facebook / Instagram"],
  ["site", "🌐 Сайт (за UTM-міткою)"],
  ["other", "Інше"],
];

export default function CampaignModal({ open, campaign, onClose, onSaved, defaultProject }) {
  const { supabase, reload, CHANNELS, CHANNEL_LABELS } = useMarketingData();
  const { canWriteCatalog, isPartner } = useAuth();
  const canEdit = canWriteCatalog || isPartner;
  const [f, setF] = useState({});
  const [quizzes, setQuizzes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));

  useEffect(() => {
    if (!open) return;
    // Resetting the form when the modal opens for a different record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    setF({
      name: campaign?.name || "", channel: campaign?.channel || "facebook", status: campaign?.status || "активна",
      start_date: campaign?.start_date || new Date().toISOString().slice(0, 10), end_date: campaign?.end_date || "",
      source_kind: campaign?.source_kind || "quiz", quiz_id: campaign?.quiz_id || "", utm_campaign: campaign?.utm_campaign || "",
      fb_campaign_id: campaign?.fb_campaign_id || "", budget: campaign?.budget ?? "", leads_manual: campaign?.leads_manual ?? 0,
      spend_manual: campaign?.spend_manual ?? 0, project: campaign?.project || defaultProject || "", notes: campaign?.notes || "",
    });
    supabase.from("quizzes").select("id,title,slug,published").order("created_at").then(({ data }) => setQuizzes(data || []));
    supabase.from("task_projects").select("name").neq("status", "done").order("sort").then(({ data }) => setProjects((data || []).map((x) => x.name)));
  }, [open, campaign, defaultProject, supabase]);

  const quizOpts = useMemo(() => quizzes.map((q) => [q.id, `${q.title} · /q/${q.slug}${q.published ? "" : " (не опубліковано)"}`]), [quizzes]);
  if (!open) return null;

  async function handleSave() {
    if (!f.name.trim()) { setError("Вкажіть назву кампанії."); return; }
    setSaving(true);
    setError("");
    const payload = {
      name: f.name.trim(), channel: f.channel, status: f.status, start_date: f.start_date || null, end_date: f.end_date || null,
      source_kind: f.source_kind, quiz_id: f.source_kind === "quiz" ? f.quiz_id || null : null,
      utm_campaign: f.utm_campaign.trim() || null, fb_campaign_id: f.fb_campaign_id.trim() || null,
      budget: Number(f.budget) || 0, leads_manual: Number(f.leads_manual) || 0, spend_manual: Number(f.spend_manual) || 0,
      project: f.project || null, notes: f.notes.trim() || null,
    };
    const { error: e } = campaign
      ? await supabase.from("campaigns").update(payload).eq("id", campaign.id)
      : await supabase.from("campaigns").insert([payload]);
    setSaving(false);
    if (e) { setError(e.message); return; }
    await reload(true);
    onSaved?.();
  }

  async function handleDelete() {
    if (!campaign || !confirm("Видалити цю кампанію? Ліди й витрати залишаться, але без привʼязки до неї.")) return;
    setSaving(true);
    const { error: e } = await supabase.from("campaigns").delete().eq("id", campaign.id);
    setSaving(false);
    if (e) { setError(e.message); return; }
    await reload(true);
    onSaved?.();
  }

  const dis = !canEdit;
  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{campaign ? "Кампанія" : "Нова кампанія"}</h2>
        {error && <div className="auth-error">{error}</div>}

        <div className="form-row">
          <label>Назва</label>
          <input value={f.name || ""} onChange={(e) => set({ name: e.target.value })} placeholder="напр. FB — квіз, осінь" disabled={dis} />
        </div>
        <div className="exp-grid">
          <div className="form-row">
            <label>Канал</label>
            <select value={f.channel} onChange={(e) => set({ channel: e.target.value })} disabled={dis}>
              {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>Статус</label>
            <select value={f.status} onChange={(e) => set({ status: e.target.value })} disabled={dis}>
              {CAMPAIGN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>Старт</label>
            <input type="date" value={f.start_date || ""} onChange={(e) => set({ start_date: e.target.value })} disabled={dis} />
          </div>
          <div className="form-row">
            <label>Кінець (якщо є)</label>
            <input type="date" value={f.end_date || ""} onChange={(e) => set({ end_date: e.target.value })} disabled={dis} />
          </div>
        </div>

        <h4>Звідки ліди</h4>
        <div className="form-row">
          <select value={f.source_kind} onChange={(e) => set({ source_kind: e.target.value })} disabled={dis}>
            {SOURCE_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        {f.source_kind === "quiz" && (
          <div className="form-row">
            <label>Наш квіз — заявки з нього рахуються в цю кампанію самі</label>
            <select value={f.quiz_id} onChange={(e) => set({ quiz_id: e.target.value })} disabled={dis}>
              <option value="">— квіз не в системі (ліди вносимо вручну) —</option>
              {quizOpts.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
            </select>
          </div>
        )}
        <div className="exp-grid">
          <div className="form-row">
            <label>UTM-мітка utm_campaign</label>
            <input value={f.utm_campaign} onChange={(e) => set({ utm_campaign: e.target.value })} placeholder="напр. fb_quiz_sept" disabled={dis} />
          </div>
          <div className="form-row">
            <label>ID кампанії в Meta (для автопідтягування)</label>
            <input value={f.fb_campaign_id} onChange={(e) => set({ fb_campaign_id: e.target.value })} placeholder="1202…" disabled={dis} />
          </div>
        </div>
        <p className="note" style={{ marginTop: 0 }}>Заявки з посиланням, де є utm_campaign з такою міткою, теж потрапляють у кампанію автоматично.</p>

        <h4>Гроші й ліди поза системою</h4>
        <div className="exp-grid">
          <div className="form-row">
            <label>План бюджету, грн</label>
            <input inputMode="decimal" value={f.budget} onChange={(e) => set({ budget: e.target.value })} placeholder="0" disabled={dis} />
          </div>
          <div className="form-row">
            <label>Лідів поза системою</label>
            <input inputMode="numeric" value={f.leads_manual} onChange={(e) => set({ leads_manual: e.target.value })} disabled={dis} />
          </div>
          <div className="form-row">
            <label>Витрачено поза транзакціями, грн</label>
            <input inputMode="decimal" value={f.spend_manual} onChange={(e) => set({ spend_manual: e.target.value })} disabled={dis} />
          </div>
          <div className="form-row">
            <label>Проєкт / напрям</label>
            <select value={f.project} onChange={(e) => set({ project: e.target.value })} disabled={dis}>
              <option value="">— загальне —</option>
              {projects.map((p) => <option key={p} value={p}>{p}</option>)}
              {f.project && !projects.includes(f.project) && <option value={f.project}>{f.project}</option>}
            </select>
          </div>
        </div>
        <p className="note" style={{ marginTop: 0 }}>«Поза системою» — те, чого ще немає в CRM: ліди з adsquiz чи лід-форми, витрата з кабінету. Реальні списання по картці краще вносити кнопкою «💸 Витрата» — вони підуть і у фінанси.</p>
        <div className="form-row">
          <label>Примітка</label>
          <textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} disabled={dis} />
        </div>

        <div className="modal-actions">
          {campaign && canWriteCatalog && <button className="btn" style={{ color: "var(--danger)", marginRight: "auto" }} onClick={handleDelete} disabled={saving}>Видалити</button>}
          <button className="btn" onClick={onClose} disabled={saving}>Закрити</button>
          {canEdit && <button className="btn primary" onClick={handleSave} disabled={saving}>{saving ? "Збереження..." : campaign ? "Зберегти" : "Створити"}</button>}
        </div>
      </div>
    </div>
  );
}

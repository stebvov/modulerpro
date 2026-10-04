"use client";

// 💸 Внести витрату з розподілом: списання по картці на рекламу, оплата таргетологу, квіз-сервісу, CRM тощо.
// Пишеться в операційні витрати (транзакція «витрата-офіс») зі статтею «Маркетинг → …»,
// привʼязкою до рекламної кампанії й розподілом між проєктами у %. Чек / скрін — файлом до транзакції.
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppData } from "@/context/DataContext";
import "@/components/screens/marketing.css";

const CURS = [["UAH", "грн"], ["USD", "$"], ["EUR", "€"]];
const today = () => new Date().toISOString().slice(0, 10);
const num = (v) => Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")) || 0;
const safeName = (n) => String(n).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
const stamp = () => Date.now();

export default function ExpenseModal({ open, onClose, onSaved, campaign = null }) {
  const supabase = useMemo(() => createClient(), []);
  const { exchangeRates = [] } = useAppData();
  const [cats, setCats] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [projects, setProjects] = useState([]);
  const [amount, setAmount] = useState("");
  const [cur, setCur] = useState("UAH");
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [alloc, setAlloc] = useState([{ project: "", pct: 100 }]);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      supabase.from("transaction_categories").select("id,name,kind,parent_id,sort_order").order("sort_order"),
      supabase.from("campaigns").select("id,name,project,status").order("created_at", { ascending: false }),
      supabase.from("task_projects").select("name,status").neq("status", "done").order("sort"),
    ]).then(([c, k, p]) => {
      setCats(c.data || []); setCampaigns(k.data || []); setProjects((p.data || []).map((x) => x.name));
    });
    // нова форма при кожному відкритті; з кампанії — одразу «Реклама» і проєкт кампанії
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAmount(""); setCur("UAH"); setDate(today()); setNote(""); setFiles([]); setErr(""); setCounterparty("");
    setCampaignId(campaign?.id || "");
    setCategory(campaign ? "Реклама — бюджет" : "");
    setAlloc([{ project: campaign?.project || "", pct: 100 }]);
  }, [open, campaign, supabase]);

  if (!open) return null;

  const mk = cats.find((c) => c.name === "Маркетинг");
  const mkCats = mk ? cats.filter((c) => c.parent_id === mk.id) : [];
  const otherCats = cats.filter((c) => (c.kind === "opex" || c.kind === "capex") && c.id !== mk?.id && c.parent_id !== mk?.id);
  const rate = cur === "UAH" ? 1 : Number(exchangeRates.find((r) => r.code === cur)?.rate_to_uah) || 0;
  const uah = num(amount) * rate;
  const pctSum = alloc.reduce((s, a) => s + num(a.pct), 0);

  function pickCampaign(id) {
    setCampaignId(id);
    const c = campaigns.find((x) => x.id === id);
    if (c && !category) setCategory("Реклама — бюджет");
    if (c?.project && alloc.length === 1 && !alloc[0].project) setAlloc([{ project: c.project, pct: 100 }]);
  }
  const setRow = (i, patch) => setAlloc((a) => a.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    if (!(num(amount) > 0)) return setErr("Вкажіть суму.");
    if (!rate) return setErr(`Немає курсу ${cur} — додайте його в налаштуваннях валют або внесіть у гривнях.`);
    if (!category) return setErr("Оберіть, на що витрата.");
    if (Math.round(pctSum) !== 100) return setErr(`Розподіл має давати 100% (зараз ${pctSum}%).`);
    setSaving(true); setErr("");
    const rows = alloc.filter((a) => num(a.pct) > 0).map((a) => ({ project: a.project || null, pct: num(a.pct) }));
    const main = [...rows].sort((a, b) => b.pct - a.pct)[0];
    const { data: { user } } = await supabase.auth.getUser();
    const origin = cur !== "UAH" ? `${num(amount).toLocaleString("uk-UA")} ${cur} за курсом ${rate}` : "";
    const { data, error } = await supabase.from("transactions").insert({
      type: "витрата-офіс", amount: Math.round(uah * 100) / 100, currency: "UAH", date, category,
      campaign_id: campaignId || null, project: main?.project || null, allocations: rows.length > 1 || rows[0]?.project ? rows : null,
      counterparty: counterparty.trim() || null, note: [note.trim(), origin].filter(Boolean).join(" · ") || null, created_by: user?.id || null,
    }).select("id").single();
    if (error) { setSaving(false); return setErr(error.message); }
    for (const f of files) {
      const path = `${data.id}/${stamp()}_${safeName(f.name)}`;
      const up = await supabase.storage.from("transaction-files").upload(path, f, { contentType: f.type || undefined });
      if (!up.error) await supabase.from("transaction_attachments").insert({ transaction_id: data.id, file_name: f.name, storage_path: path, uploaded_by: user?.id || null });
    }
    setSaving(false);
    onSaved?.();
  }

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal exp-modal">
        <h2>💸 Внести витрату</h2>
        {err && <div className="auth-error">{err}</div>}
        <div className="exp-grid">
          <div className="form-row">
            <label>Сума</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus style={{ flex: 1, minWidth: 0 }} />
              <select value={cur} onChange={(e) => setCur(e.target.value)} style={{ width: 70 }}>{CURS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </div>
            {cur !== "UAH" && uah > 0 && <div className="note">≈ {Math.round(uah).toLocaleString("uk-UA")} грн за курсом {rate}</div>}
          </div>
          <div className="form-row">
            <label>Дата списання / оплати</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <label>На що</label>
          <div className="exp-chips">
            {mkCats.map((c) => (
              <button key={c.id} type="button" className={`subtab${category === c.name ? " active" : ""}`} onClick={() => setCategory(c.name)}>{c.name}</button>
            ))}
          </div>
          <select value={mkCats.some((c) => c.name === category) ? "" : category} onChange={(e) => setCategory(e.target.value)} style={{ marginTop: 6 }}>
            <option value="">{mkCats.some((c) => c.name === category) ? "або інша стаття операційних витрат…" : "інша стаття операційних витрат…"}</option>
            {otherCats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        <div className="exp-grid">
          <div className="form-row">
            <label>Рекламна кампанія</label>
            <select value={campaignId} onChange={(e) => pickCampaign(e.target.value)}>
              <option value="">— без кампанії —</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}{c.status === "завершена" ? " (завершена)" : ""}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>Кому / за що платили</label>
            <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Meta, таргетолог Анна, AdsQuiz…" />
          </div>
        </div>

        <div className="form-row">
          <label>Розподіл між проєктами {Math.round(pctSum) !== 100 && <span style={{ color: "var(--danger)" }}>· зараз {pctSum}%</span>}</label>
          <div className="exp-alloc">
            {alloc.map((a, i) => (
              <div key={i} className="exp-alloc__row">
                <select value={a.project} onChange={(e) => setRow(i, { project: e.target.value })}>
                  <option value="">Загальне (без проєкту)</option>
                  {projects.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input inputMode="decimal" value={a.pct} onChange={(e) => setRow(i, { pct: e.target.value })} aria-label="Відсоток" />
                <span>%</span>
                {uah > 0 && <span className="note exp-alloc__sum">{Math.round((uah * num(a.pct)) / 100).toLocaleString("uk-UA")} грн</span>}
                {alloc.length > 1 && <button type="button" className="btn small" onClick={() => setAlloc((x) => x.filter((_, j) => j !== i))} aria-label="Прибрати">✕</button>}
              </div>
            ))}
          </div>
          <button type="button" className="btn small" style={{ marginTop: 6, justifySelf: "start" }}
            onClick={() => setAlloc((x) => { const n = x.length + 1; return [...x.map((r) => ({ ...r, pct: Math.round(100 / n) })), { project: "", pct: 100 - Math.round(100 / n) * (n - 1) }]; })}>
            + Поділити ще на проєкт
          </button>
        </div>

        <div className="form-row">
          <label>Коментар</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="напр. поповнення рекламного кабінету, вересень" />
        </div>
        <div className="form-row">
          <label>Чек, скрін списання, рахунок</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <label className="btn small exp-file">📎 Додати файл / фото<input type="file" multiple accept="image/*,application/pdf,.xlsx,.xls,.csv,.doc,.docx" onChange={(e) => { setFiles((x) => [...x, ...e.target.files]); e.target.value = ""; }} /></label>
            {files.map((f, i) => <span key={i} className="tag">📎 {f.name} <button type="button" className="exp-x" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>×</button></span>)}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>Скасувати</button>
          <button type="button" className="btn primary" onClick={save} disabled={saving}>{saving ? "Зберігаю…" : "Зберегти витрату"}</button>
        </div>
      </div>
    </div>
  );
}

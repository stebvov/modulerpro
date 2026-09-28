"use client";

// 💰 Журнал фінансів: помісячний список усіх доходів і витрат з фільтрами, сортуванням, пошуком
// і швидким додаванням. Кожну транзакцію можна привʼязати до проєкту, постачальника, підрядника, угоди.
// OPEX — операційні витрати компанії, CAPEX — інвестиції (не зменшують прибуток місяця),
// матеріали / роботи / підрядники — собівартість виготовлення будинків.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { fxTo, money, toNum, todayKyiv } from "@/lib/mod";

export const KINDS = [
  { type: "витрата-офіс", label: "OPEX — операційні", short: "OPEX", group: "opex", sign: -1 },
  { type: "витрата-капекс", label: "CAPEX — інвестиції", short: "CAPEX", group: "capex", sign: -1 },
  { type: "витрата-матеріали", label: "Виготовлення: матеріали", short: "Матеріали", group: "prod", sign: -1 },
  { type: "витрата-зп", label: "Виготовлення: роботи / ЗП", short: "Роботи", group: "prod", sign: -1 },
  { type: "витрата-послуга", label: "Виготовлення: підрядники", short: "Підрядники", group: "prod", sign: -1 },
  { type: "дохід-виробництво", label: "Дохід: будинки", short: "Дохід", group: "income", sign: 1 },
  { type: "дохід-послуга", label: "Дохід: послуги", short: "Дохід послуг", group: "income", sign: 1 },
  { type: "дохід-інше", label: "Дохід: інше", short: "Інший дохід", group: "income", sign: 1 },
];
const KIND = Object.fromEntries(KINDS.map((k) => [k.type, k]));
const GROUPS = [["", "Усі"], ["income", "Доходи"], ["prod", "Виготовлення"], ["opex", "OPEX"], ["capex", "CAPEX"]];
const PERIODS = [["month", "Місяць"], ["year", "Рік"], ["all", "Усі"]];
const GROUP_STYLE = {
  income: { background: "var(--success-bg)", color: "var(--success)" },
  prod: { background: "var(--amber-bg)", color: "var(--amber)" },
  opex: { background: "var(--accent-bg)", color: "var(--accent)" },
  capex: { background: "#eee8f6", color: "#5b3f8c" },
};

const shiftMonth = (m, d) => { const [y, mo] = m.split("-").map(Number); const t = new Date(Date.UTC(y, mo - 1 + d, 1)); return t.toISOString().slice(0, 7); };
const monthName = (m) => { const t = new Date(m + "-01T12:00:00Z").toLocaleDateString("uk-UA", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };

function blankRow(month) {
  const today = todayKyiv();
  return { date: today.startsWith(month) ? today : `${month}-01`, type: "витрата-офіс", amount: "", currency: "UAH", category: "", project: "", party: "", counterparty: "", note: "" };
}
const partyOf = (t) => (t.supplier_id ? "s:" + t.supplier_id : t.partner_id ? "p:" + t.partner_id : "");

export default function Ledger() {
  const supabase = useMemo(() => createClient(), []);
  const { currency, exchangeRates, suppliers } = useAppData();
  const { canWriteFinance } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cats, setCats] = useState([]);
  const [projects, setProjects] = useState([]);
  const [partners, setPartners] = useState([]);
  const [deals, setDeals] = useState([]);
  const [month, setMonth] = useState(() => todayKyiv().slice(0, 7));
  const [period, setPeriod] = useState("month");
  const [group, setGroup] = useState("");
  const [fCat, setFCat] = useState("");
  const [fProject, setFProject] = useState("");
  const [fParty, setFParty] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "date", dir: -1 });
  const [draft, setDraft] = useState(() => blankRow(todayKyiv().slice(0, 7)));
  const [edit, setEdit] = useState(null);
  const [sure, setSure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    let qy = supabase.from("transactions")
      .select("id, type, amount, currency, date, category, note, deal_id, site_id, project, supplier_id, partner_id, counterparty, created_at, deals(leads(name)), suppliers(name), service_partners(name)")
      .order("date", { ascending: false }).order("created_at", { ascending: false }).limit(3000);
    if (period === "month") qy = qy.gte("date", `${month}-01`).lt("date", `${shiftMonth(month, 1)}-01`);
    if (period === "year") qy = qy.gte("date", `${month.slice(0, 4)}-01-01`).lt("date", `${Number(month.slice(0, 4)) + 1}-01-01`);
    const { data, error: e } = await qy;
    if (e) setError(e.message); else { setRows(data || []); setError(""); }
    setLoading(false);
  }, [supabase, month, period]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    Promise.all([
      supabase.from("transaction_categories").select("name").order("sort_order"),
      supabase.from("task_projects").select("name,status,direction").order("sort"),
      supabase.from("service_partners").select("id,name").order("name"),
      supabase.from("deals").select("id, leads(name)").order("created_at", { ascending: false }).limit(200),
    ]).then(([c, p, sp, d]) => {
      setCats((c.data || []).map((x) => x.name));
      setProjects((p.data || []).filter((x) => x.status !== "done").map((x) => x.name));
      setPartners(sp.data || []);
      setDeals((d.data || []).map((x) => ({ id: x.id, name: x.leads?.name || "угода" })));
    });
  }, [supabase]);

  const partyOptions = useMemo(() => [
    ...(suppliers || []).map((s) => ["s:" + s.id, "🏪 " + s.name]),
    ...partners.map((p) => ["p:" + p.id, "🛠 " + p.name]),
  ], [suppliers, partners]);
  const partyName = (t) => t.suppliers?.name || t.service_partners?.name || t.counterparty || (t.deals?.leads?.name ? "🤝 " + t.deals.leads.name : "");
  const conv = useCallback((t) => (fxTo(t.amount, t.currency || "UAH", currency, exchangeRates) || 0) * (KIND[t.type]?.sign || -1), [currency, exchangeRates]);

  const view = useMemo(() => {
    const s = q.trim().toLowerCase();
    const f = rows.filter((t) =>
      (!group || KIND[t.type]?.group === group) && (!fCat || t.category === fCat) && (!fProject || (fProject === "—" ? !t.project : t.project === fProject)) &&
      (!fParty || partyOf(t) === fParty) &&
      (!s || [t.category, t.note, t.project, partyName(t), KIND[t.type]?.label, String(t.amount)].join(" ").toLowerCase().includes(s)));
    const val = (t) => sort.key === "amount" ? conv(t) : sort.key === "type" ? KIND[t.type]?.short || "" : sort.key === "party" ? partyName(t) : (t[sort.key] ?? "");
    return [...f].sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * sort.dir; });
  }, [rows, group, fCat, fProject, fParty, q, sort, conv]);

  const k = useMemo(() => {
    const sum = (g) => rows.filter((t) => KIND[t.type]?.group === g).reduce((a, t) => a + Math.abs(conv(t)), 0);
    const inc = sum("income"), prod = sum("prod"), opex = sum("opex"), capex = sum("capex");
    return { inc, prod, opex, capex, profit: inc - prod - opex, cash: inc - prod - opex - capex, filtered: view.reduce((a, t) => a + conv(t), 0) };
  }, [rows, view, conv]);

  function toPayload(r) {
    const party = r.party || "";
    return {
      date: r.date, type: r.type, amount: toNum(r.amount), currency: r.currency || "UAH", category: r.category.trim() || null,
      project: r.project || null, supplier_id: party.startsWith("s:") ? party.slice(2) : null, partner_id: party.startsWith("p:") ? party.slice(2) : null,
      counterparty: r.counterparty.trim() || null, note: r.note.trim() || null, deal_id: r.deal_id || null,
    };
  }
  async function add(e) {
    e?.preventDefault();
    const p = toPayload(draft);
    if (!p.amount || p.amount <= 0) { setMsg("Вкажіть суму"); return; }
    setBusy(true);
    const { error: er } = await supabase.from("transactions").insert(p);
    setBusy(false);
    if (er) { setMsg("Не додано: " + er.message); return; }
    setMsg(`Додано: ${KIND[p.type].short} · ${money(p.amount, p.currency)}${p.project ? " · " + p.project : ""}`);
    // тип, категорія, проєкт і контрагент лишаються — зручно вносити серію схожих витрат
    setDraft((d) => ({ ...d, amount: "", note: "" }));
    if (!p.date.startsWith(month) && period === "month") setMonth(p.date.slice(0, 7)); else load();
  }
  async function saveEdit() {
    const p = toPayload(edit);
    if (!p.amount || p.amount <= 0) { setMsg("Вкажіть суму"); return; }
    const { error: er } = await supabase.from("transactions").update(p).eq("id", edit.id);
    if (er) { setMsg("Не збережено: " + er.message); return; }
    setEdit(null); setMsg("Збережено"); load();
  }
  async function remove(id) {
    if (sure !== id) { setSure(id); setTimeout(() => setSure(null), 4000); return; }
    const { error: er } = await supabase.from("transactions").delete().eq("id", id);
    if (er) { setMsg("Не видалено: " + er.message); return; }
    setMsg("Видалено"); load();
  }
  function csv() {
    const qq = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const out = [["Дата", "Тип", "Категорія", "Сума", "Валюта", "Проєкт", "Контрагент", "Коментар"], ...view.map((t) => [t.date, KIND[t.type]?.label, t.category, KIND[t.type]?.sign * t.amount, t.currency, t.project, partyName(t), t.note])];
    const url = URL.createObjectURL(new Blob(["﻿" + out.map((r) => r.map(qq).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `Фінанси ${period === "month" ? month : period === "year" ? month.slice(0, 4) : "усі"}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const th = (key, label, right) => (
    <th style={{ cursor: "pointer", whiteSpace: "nowrap", textAlign: right ? "right" : "left" }} onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : key === "date" || key === "amount" ? -1 : 1 }))}>
      {label}{sort.key === key ? (sort.dir < 0 ? " ↓" : " ↑") : ""}
    </th>
  );
  const fields = (r, set, compact) => (
    <>
      <input type="date" value={r.date} onChange={(e) => set({ ...r, date: e.target.value })} style={{ width: 140 }} aria-label="Дата" />
      <select value={r.type} onChange={(e) => set({ ...r, type: e.target.value })} style={{ width: compact ? 150 : 200 }} aria-label="Тип">
        {KINDS.map((x) => <option key={x.type} value={x.type}>{x.label}</option>)}
      </select>
      <input value={r.amount} onChange={(e) => set({ ...r, amount: e.target.value })} inputMode="decimal" placeholder="Сума" style={{ width: 110, textAlign: "right" }} aria-label="Сума" />
      <select value={r.currency} onChange={(e) => set({ ...r, currency: e.target.value })} style={{ width: 70 }} aria-label="Валюта">
        <option value="UAH">грн</option><option value="USD">$</option><option value="EUR">€</option>
      </select>
      <input value={r.category} onChange={(e) => set({ ...r, category: e.target.value })} list="ledger-cats" placeholder="Категорія" style={{ width: 150 }} aria-label="Категорія" />
      <select value={r.project} onChange={(e) => set({ ...r, project: e.target.value })} style={{ width: 170 }} aria-label="Проєкт">
        <option value="">— проєкт —</option>
        {projects.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <select value={r.party} onChange={(e) => set({ ...r, party: e.target.value })} style={{ width: 170 }} aria-label="Постачальник або підрядник">
        <option value="">— постачальник / підрядник —</option>
        {partyOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {!r.party && <input value={r.counterparty} onChange={(e) => set({ ...r, counterparty: e.target.value })} placeholder="або кому / від кого" style={{ width: 140 }} aria-label="Контрагент" />}
      <input value={r.note} onChange={(e) => set({ ...r, note: e.target.value })} placeholder="Коментар" style={{ flex: 1, minWidth: 140 }} aria-label="Коментар" />
    </>
  );

  return (
    <div>
      <datalist id="ledger-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>

      <div className="toolbar" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div className="seg-row">
          {PERIODS.map(([v, l]) => <button key={v} className={`seg-btn${period === v ? " active" : ""}`} onClick={() => setPeriod(v)}>{l}</button>)}
        </div>
        {period !== "all" && (
          <div className="row" style={{ gap: 6, alignItems: "center" }}>
            <button className="btn small" onClick={() => setMonth((m) => shiftMonth(m, period === "year" ? -12 : -1))} aria-label="Раніше">◀</button>
            <b style={{ minWidth: 150, textAlign: "center" }}>{period === "month" ? monthName(month) : month.slice(0, 4) + " рік"}</b>
            <button className="btn small" onClick={() => setMonth((m) => shiftMonth(m, period === "year" ? 12 : 1))} aria-label="Пізніше">▶</button>
          </div>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn small" onClick={csv}>⬇ Excel (CSV)</button>
      </div>

      <div className="ops-kpi-grid">
        <div className="ops-kpi"><div className="k-label">Доходи</div><div className="k-value" style={{ color: "var(--success)" }}>{money(k.inc, currency)}</div></div>
        <div className="ops-kpi"><div className="k-label">Виготовлення будинків</div><div className="k-value">{money(k.prod, currency)}</div><div className="note">матеріали, роботи, підрядники</div></div>
        <div className="ops-kpi"><div className="k-label">OPEX</div><div className="k-value">{money(k.opex, currency)}</div><div className="note">операційні витрати</div></div>
        <div className="ops-kpi"><div className="k-label">Прибуток</div><div className="k-value" style={{ color: k.profit < 0 ? "var(--danger)" : "var(--success)" }}>{money(k.profit, currency)}</div><div className="note">доходи − виготовлення − OPEX</div></div>
        <div className="ops-kpi"><div className="k-label">CAPEX</div><div className="k-value">{money(k.capex, currency)}</div><div className="note">інвестиції; рух грошей {money(k.cash, currency)}</div></div>
      </div>

      {canWriteFinance && (
        <form onSubmit={add} className="card" style={{ padding: 12, marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <b style={{ width: "100%", fontSize: 13 }}>⚡ Швидке додавання <span className="note" style={{ fontWeight: 400 }}>— Enter додає; тип, категорія й проєкт лишаються для наступної</span></b>
          {fields(draft, setDraft)}
          <button className="btn primary" type="submit" disabled={busy}>Додати</button>
        </form>
      )}
      {msg && <div className="note" style={{ background: "var(--accent-bg)", padding: "6px 12px", borderRadius: 8, marginBottom: 10 }}>{msg}</div>}

      <div className="toolbar" style={{ gap: 6, flexWrap: "wrap" }}>
        <div className="seg-row">
          {GROUPS.map(([v, l]) => <button key={v} className={`seg-btn${group === v ? " active" : ""}`} onClick={() => setGroup(v)}>{l}</button>)}
        </div>
        <input className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук: категорія, коментар, контрагент, сума" style={{ flex: 1, minWidth: 200 }} />
        <select value={fCat} onChange={(e) => setFCat(e.target.value)} style={{ width: 160 }} aria-label="Категорія">
          <option value="">Усі категорії</option>
          {[...new Set([...cats, ...rows.map((t) => t.category).filter(Boolean)])].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fProject} onChange={(e) => setFProject(e.target.value)} style={{ width: 170 }} aria-label="Проєкт">
          <option value="">Усі проєкти</option><option value="—">Без проєкту</option>
          {projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fParty} onChange={(e) => setFParty(e.target.value)} style={{ width: 170 }} aria-label="Контрагент">
          <option value="">Усі контрагенти</option>
          {partyOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {(group || fCat || fProject || fParty || q) && <button className="btn small" onClick={() => { setGroup(""); setFCat(""); setFProject(""); setFParty(""); setQ(""); }}>Скинути</button>}
      </div>

      {error ? <div className="empty">Помилка: {error}</div> : loading ? <div className="empty">Завантаження…</div> : (
        <div className="table-scroll">
          <table>
            <thead><tr>{th("date", "Дата")}{th("type", "Тип")}{th("category", "Категорія")}{th("amount", "Сума", true)}{th("project", "Проєкт")}{th("party", "Контрагент")}<th>Коментар</th><th /></tr></thead>
            <tbody>
              {view.map((t) => edit?.id === t.id ? (
                <tr key={t.id}><td colSpan={8}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    {fields(edit, setEdit, true)}
                    <select value={edit.deal_id || ""} onChange={(e) => setEdit({ ...edit, deal_id: e.target.value })} style={{ width: 160 }} aria-label="Угода">
                      <option value="">— угода CRM —</option>
                      {deals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <button className="btn primary small" onClick={saveEdit}>Зберегти</button>
                    <button className="btn small" onClick={() => setEdit(null)}>Скасувати</button>
                  </div>
                </td></tr>
              ) : (
                <tr key={t.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(t.date + "T12:00:00Z").toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: period === "month" ? undefined : "2-digit" })}</td>
                  <td><span className="badge" style={GROUP_STYLE[KIND[t.type]?.group]}>{KIND[t.type]?.short || t.type}</span></td>
                  <td>{t.category || <span className="note">—</span>}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap", fontWeight: 600, color: KIND[t.type]?.sign > 0 ? "var(--success)" : "var(--text)" }}>
                    {KIND[t.type]?.sign > 0 ? "+" : "−"}{money(t.amount, t.currency)}
                    {t.currency !== currency && <div className="note" style={{ fontWeight: 400 }}>≈ {money(Math.abs(conv(t)), currency)}</div>}
                  </td>
                  <td>{t.project || <span className="note">—</span>}</td>
                  <td>{partyName(t) || <span className="note">—</span>}</td>
                  <td style={{ maxWidth: 260, overflowWrap: "anywhere" }}>{t.note}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {canWriteFinance && <>
                      <button className="btn small" title="Редагувати" onClick={() => setEdit({ ...t, amount: String(t.amount), category: t.category || "", project: t.project || "", party: partyOf(t), counterparty: t.counterparty || "", note: t.note || "" })}>✎</button>{" "}
                      <button className="btn small" title="Видалити" onClick={() => remove(t.id)}>{sure === t.id ? "Точно?" : "×"}</button>
                    </>}
                  </td>
                </tr>
              ))}
              {!view.length && <tr><td colSpan={8} className="note" style={{ textAlign: "center" }}>Транзакцій за цей період немає{group || q || fCat || fProject || fParty ? " (перевірте фільтри)" : ""}.</td></tr>}
            </tbody>
            {view.length > 0 && (
              <tfoot><tr><td colSpan={3}><b>Разом за фільтром · {view.length}</b></td><td style={{ textAlign: "right", fontWeight: 700, color: k.filtered < 0 ? "var(--danger)" : "var(--success)" }}>{k.filtered < 0 ? "−" : "+"}{money(Math.abs(k.filtered), currency)}</td><td colSpan={4} /></tr></tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

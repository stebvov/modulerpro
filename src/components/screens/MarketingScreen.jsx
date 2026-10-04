"use client";

// 📣 Контент і маркетинг: Кампанії (ліди, витрати, ціна ліда, договори) · Контент-календар · Дашборд.
// Ліди в кампанію потрапляють самі (привʼязаний квіз або utm_campaign), решта — вручну в картці кампанії.
// Витрати — транзакції з привʼязкою до кампанії (💸 Внести витрату) + «поза системою» з картки.
import SettingsButton from "@/components/SettingsButton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAppData } from "@/context/DataContext";
import ChannelsModal from "@/components/modals/ChannelsModal";
import { useMarketingData } from "@/context/MarketingDataContext";
import AssetModal from "@/components/modals/AssetModal";
import CampaignModal, { SOURCE_KINDS } from "@/components/modals/CampaignModal";
import ExpenseModal from "@/components/modals/ExpenseModal";
import InfoTip from "@/components/InfoTip";
import { fmtCurrency } from "@/lib/format";
import {
  ASSET_TYPE_ICONS,
  CAMPAIGN_STATUSES,
  MONTHS,
  addMonths,
  campaignStatusStyles,
  monthGridCells,
  startOfMonth,
  toDateKey,
} from "@/lib/marketing";
import "./marketing.css";

const VIEWS = [["campaigns", "📣 Кампанії"], ["calendar", "🗓 Контент-календар"], ["dashboard", "📊 Дашборд"]];
const PERIODS = [["all", "Увесь час"], ["month", "Цей місяць"], ["30", "30 днів"], ["7", "7 днів"]];
const iso = (d) => d.toISOString().slice(0, 10);
function periodRange(p) {
  const now = new Date();
  if (p === "month") return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), null];
  if (p === "30" || p === "7") return [iso(new Date(Date.now() - Number(p) * 86400000)), null];
  return [null, null];
}
const sum = (list, k) => list.reduce((s, x) => s + (Number(x[k]) || 0), 0);

export default function MarketingScreen({ direction }) {
  const { loading, error, assets: allAssets, campaigns: allCampaigns, supabase, reload, CHANNELS, CHANNEL_COLORS, CHANNEL_LABELS } = useMarketingData();
  const { currency, exchangeRates, showDecimals } = useAppData();
  const [scopeProjects, setScopeProjects] = useState(null);
  useEffect(() => {
    if (!direction) return;
    supabase.from("task_projects").select("name").eq("direction", direction).neq("status", "done").then(({ data }) => setScopeProjects((data || []).map((x) => x.name)));
  }, [direction, supabase]);
  const inScope = (x) => !direction || (scopeProjects || []).includes(x.project);
  const assets = allAssets.filter(inScope);
  const campaigns = allCampaigns.filter(inScope);
  const defaultProject = direction ? (scopeProjects || [])[0] || null : null;
  const [channelsOpen, setChannelsOpen] = useState(false);
  const { canWriteCatalog, canWriteFinance, isPartner } = useAuth();
  const canEditCampaigns = canWriteCatalog || isPartner;
  const [view, setView] = useState("campaigns");
  const [period, setPeriod] = useState("all");
  const [stats, setStats] = useState(null);
  const [statsErr, setStatsErr] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()));
  const [hiddenChannels, setHiddenChannels] = useState(() => new Set());
  const activeChannels = { has: (ch) => !hiddenChannels.has(ch) };
  const [assetModal, setAssetModal] = useState(null);
  const [campaignModal, setCampaignModal] = useState(null);
  const [expense, setExpense] = useState(null); // { campaign } — відкрита форма витрати
  const [quizzes, setQuizzes] = useState([]);

  const cells = useMemo(() => monthGridCells(monthStart), [monthStart]);
  const today = useMemo(() => toDateKey(new Date()), []);
  const money = (uah) => fmtCurrency(Number(uah) || 0, currency, exchangeRates, showDecimals);

  const loadStats = useCallback(async () => {
    const [from, to] = periodRange(period);
    const { data, error: e } = await supabase.rpc("marketing_stats", { p_from: from, p_to: to });
    if (e) { setStatsErr(e.message); setStats(null); return; }
    setStatsErr(""); setStats(data);
  }, [supabase, period]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadStats(); }, [loadStats, allCampaigns]);
  useEffect(() => {
    supabase.from("quizzes").select("id,title,slug").then(({ data }) => setQuizzes(data || []));
  }, [supabase]);

  function toggleChannel(ch) {
    setHiddenChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch); else next.add(ch); // у наборі — сховані канали
      return next;
    });
  }

  async function cycleCampaignStatus(c) {
    if (!canEditCampaigns) return;
    const next = CAMPAIGN_STATUSES[(CAMPAIGN_STATUSES.indexOf(c.status) + 1) % CAMPAIGN_STATUSES.length];
    await supabase.from("campaigns").update({ status: next }).eq("id", c.id);
    await reload(true);
  }

  if (loading) return <div className="empty">Завантаження маркетингу...</div>;
  if (error) return <div className="empty">Помилка підключення: {error}</div>;

  // ручні цифри (поза системою) не мають дат — рахуємо їх лише у «Увесь час»
  const withManual = period === "all";
  const statOf = (c) => (stats?.campaigns || []).find((x) => x.id === c.id) || {};
  const rows = campaigns.map((c) => {
    const st = statOf(c);
    const leadsAuto = Number(st.leads) || 0;
    const leads = leadsAuto + (withManual ? Number(c.leads_manual) || 0 : 0);
    const spend = (Number(st.spend_tx) || 0) + (withManual ? Number(c.spend_manual) || 0 : 0);
    return { c, st, leadsAuto, leads, spend, cpl: leads ? spend / leads : null };
  });
  const visibleRows = rows.filter((r) => showDone || r.c.status !== "завершена");
  const un = stats?.unassigned || {};
  const byCat = Object.entries(stats?.by_category || {}).sort((a, b) => b[1] - a[1]);
  const spendTxAll = byCat.reduce((s, [, v]) => s + Number(v), 0);
  const spendManual = withManual ? sum(campaigns, "spend_manual") : 0;
  const totalSpend = spendTxAll + spendManual;
  const totalLeads = rows.reduce((s, r) => s + r.leads, 0) + (Number(un.leads) || 0);
  const qualified = rows.reduce((s, r) => s + (Number(r.st.qualified) || 0), 0) + (Number(un.qualified) || 0);
  const contracts = rows.reduce((s, r) => s + (Number(r.st.contracts) || 0), 0) + (Number(un.contracts) || 0);
  const contractSum = rows.reduce((s, r) => s + (Number(r.st.contract_sum) || 0), 0) + (Number(un.contract_sum) || 0);
  const autoLeads = rows.reduce((s, r) => s + r.leadsAuto, 0) + (Number(un.leads) || 0);
  const weeks = stats?.by_week || [];
  const maxWeek = Math.max(1, ...weeks.map((w) => w.leads));
  const maxCat = Math.max(1, ...byCat.map(([, v]) => Number(v)));
  const sourceLabel = (c) => {
    const k = SOURCE_KINDS.find(([x]) => x === c.source_kind)?.[1];
    const q = c.quiz_id && quizzes.find((x) => x.id === c.quiz_id);
    return [q ? `🧩 ${q.title}` : k, c.utm_campaign && `utm: ${c.utm_campaign}`].filter(Boolean).join(" · ");
  };
  const periodChips = (
    <div className="mk-chips">
      {PERIODS.map(([k, l]) => <button key={k} type="button" className={`subtab${period === k ? " active" : ""}`} onClick={() => setPeriod(k)}>{l}</button>)}
    </div>
  );

  return (
    <div>
      <div className="toolbar">
        <div className="mk-chips">
          {VIEWS.map(([k, l]) => <button key={k} type="button" className={`seg-btn${view === k ? " active" : ""}`} onClick={() => setView(k)}>{l}</button>)}
        </div>
        <div className="toolbar-actions">
          {canWriteFinance && <button className="btn" onClick={() => setExpense({ campaign: null })}>💸 Внести витрату</button>}
          {canEditCampaigns && view === "campaigns" && <button className="btn primary" onClick={() => setCampaignModal({ campaign: null })}>+ Кампанія</button>}
          {canWriteCatalog && <SettingsButton title="Канали реклами й контенту: додати, змінити, видалити" onClick={() => setChannelsOpen(true)} />}
        </div>
      </div>
      {statsErr && <div className="auth-error">Цифри кампаній: {statsErr}</div>}

      {view === "campaigns" && (
        <>
          <div className="mk-bar">
            {periodChips}
            <label className="tag-check"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> завершені</label>
            <InfoTip label="Як рахується" text="Ліди: заявки з привʼязаного квізу або з utm_campaign кампанії рахуються самі; «поза системою» (adsquiz, лід-форма FB) — вручну в картці. Витрачено: транзакції, привʼязані до кампанії (💸 Внести витрату), плюс «поза транзакціями» з картки. Договори — угоди цих лідів, що дійшли до договору. Ручні цифри без дат, тож видно лише в «Увесь час»." />
          </div>
          {!visibleRows.length && <div className="empty">Кампаній немає. Натисніть «+ Кампанія».</div>}
          <div className="mk-grid">
            {visibleRows.map(({ c, st, leads, leadsAuto, spend, cpl }) => {
              const style = campaignStatusStyles[c.status] || campaignStatusStyles["активна"];
              const budget = Number(c.budget) || 0;
              return (
                <div key={c.id} className={`card mk-card${c.status === "завершена" ? " mk-card--done" : ""}`}>
                  <div className="mk-card__top">
                    <span className="mk-status" style={{ background: style.bg, color: style.text }} onClick={() => cycleCampaignStatus(c)} title={canEditCampaigns ? "Клік — наступний статус" : ""}>{c.status}</span>
                    <span className="tag" style={{ background: "var(--bg)", color: CHANNEL_COLORS[c.channel] }}>{CHANNEL_LABELS[c.channel] || c.channel}</span>
                  </div>
                  <h3 className="mk-card__name" onClick={() => setCampaignModal({ campaign: c })}>{c.name}</h3>
                  <div className="note mk-card__sub">{[c.start_date && `з ${new Date(c.start_date).toLocaleDateString("uk-UA")}`, c.end_date && `до ${new Date(c.end_date).toLocaleDateString("uk-UA")}`, sourceLabel(c), c.project].filter(Boolean).join(" · ")}</div>
                  <div className="mk-metrics">
                    <div><span>Ліди</span><b>{leads}</b><small>{withManual && Number(c.leads_manual) ? `${leadsAuto} у CRM + ${c.leads_manual} вручну` : `${Number(st.qualified) || 0} кваліф.`}</small></div>
                    <div><span>Витрачено</span><b>{money(spend)}</b><small>{budget ? `план ${money(budget)}` : " "}</small></div>
                    <div><span>Ціна ліда</span><b>{cpl != null ? money(cpl) : "—"}</b><small>{" "}</small></div>
                    <div><span>Договори</span><b>{Number(st.contracts) || 0}</b><small>{Number(st.contract_sum) ? money(st.contract_sum) : " "}</small></div>
                  </div>
                  {budget > 0 && <div className="mk-progress" title={`Використано ${Math.round((spend / budget) * 100)}% плану`}><i style={{ width: `${Math.min(100, (spend / budget) * 100)}%` }} /></div>}
                  <div className="mk-card__acts">
                    <button type="button" className="btn small" onClick={() => setCampaignModal({ campaign: c })}>{canEditCampaigns ? "✎ Картка" : "Відкрити"}</button>
                    {canWriteFinance && <button type="button" className="btn small" onClick={() => setExpense({ campaign: c })}>💸 Витрата</button>}
                  </div>
                </div>
              );
            })}
          </div>
          {Number(un.leads) > 0 && (
            <p className="note">Ще {un.leads} лід(ів) за період без кампанії — з сайту, дзвінків чи квізів без привʼязки. Привʼяжіть квіз або UTM-мітку в картці кампанії, щоб нові рахувались самі.</p>
          )}
        </>
      )}

      {view === "calendar" && (
        <>
          <div className="legend-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div className="seg-row">
              {CHANNELS.map((ch) => {
                const on = activeChannels.has(ch);
                return (
                  <button
                    key={ch}
                    className={`seg-btn${on ? " active" : ""}`}
                    style={on ? { background: CHANNEL_COLORS[ch], borderColor: CHANNEL_COLORS[ch] } : { color: "var(--text-muted)" }}
                    onClick={() => toggleChannel(ch)}
                  >
                    {CHANNEL_LABELS[ch]}
                  </button>
                );
              })}
            </div>
            <div className="seg-row">
              <button className="seg-btn" onClick={() => setMonthStart(addMonths(monthStart, -1))}>‹</button>
              <span className="note" style={{ minWidth: 130, textAlign: "center", marginTop: 0 }}>{MONTHS[monthStart.getMonth()]} {monthStart.getFullYear()}</span>
              <button className="seg-btn" onClick={() => setMonthStart(addMonths(monthStart, 1))}>›</button>
            </div>
            {canWriteCatalog && (
              <button className="btn primary" onClick={() => setAssetModal({ asset: null, defaultDate: today })}>+ Контент</button>
            )}
          </div>

          <div className="mkt-cal-weekdays">
            <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Нд</div>
          </div>
          <div className="mkt-cal-grid">
            {cells.map((c, idx) => {
              const ds = toDateKey(c.date);
              const dayAssets = assets.filter((a) => a.scheduled_at && a.scheduled_at.slice(0, 10) === ds && activeChannels.has(a.channel));
              const isToday = ds === today;
              return (
                <div
                  key={idx}
                  className={`mkt-day${c.outside ? " outside" : ""}${isToday ? " today" : ""}`}
                  onClick={() => canWriteCatalog && setAssetModal({ asset: null, defaultDate: ds })}
                >
                  <div className="mkt-day-num">{c.date.getDate()}</div>
                  {dayAssets.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      className={`mkt-asset-pill st-${a.status}`}
                      style={{ color: CHANNEL_COLORS[a.channel] || "var(--text-secondary)" }}
                      title={a.title}
                      onClick={(e) => { e.stopPropagation(); setAssetModal({ asset: a }); }}
                    >
                      <span>{ASSET_TYPE_ICONS[a.type] || "•"}</span>
                      <span>{a.title || a.type}</span>
                    </div>
                  ))}
                  {dayAssets.length > 3 && <div className="mkt-asset-more">+{dayAssets.length - 3} ще</div>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {view === "dashboard" && (
        <>
          <div className="mk-bar">{periodChips}</div>
          <div className="ops-kpi-grid">
            <div className="ops-kpi">
              <div className="k-label">Витрачено на маркетинг</div>
              <div className="k-value">{money(totalSpend)}</div>
              <div className="note" style={{ marginTop: 4 }}>{spendManual ? `з них ${money(spendManual)} поза транзакціями` : "реклама, підрядники, сервіси"}</div>
            </div>
            <div className="ops-kpi">
              <div className="k-label">Лідів</div>
              <div className="k-value">{totalLeads}</div>
              <div className="note" style={{ marginTop: 4 }}>у CRM {autoLeads}{totalLeads > autoLeads ? ` · вручну ${totalLeads - autoLeads}` : ""}</div>
            </div>
            <div className="ops-kpi">
              <div className="k-label">Ціна ліда</div>
              <div className="k-value" style={{ color: "var(--amber)" }}>{totalLeads ? money(totalSpend / totalLeads) : "—"}</div>
              <div className="note" style={{ marginTop: 4 }}>кваліфікованого: {qualified ? money(totalSpend / qualified) : "—"}</div>
            </div>
            <div className="ops-kpi">
              <div className="k-label">Договори з лідів</div>
              <div className="k-value">{contracts}</div>
              <div className="note" style={{ marginTop: 4 }}>{contractSum ? `${money(contractSum)}${totalSpend ? ` · ${Math.round(contractSum / totalSpend)} грн на 1 грн маркетингу` : ""}` : `кваліфіковано ${qualified} з ${autoLeads}`}</div>
            </div>
          </div>

          <div className="mk-dash">
            <div className="card mk-panel">
              <div className="section-label" style={{ marginTop: 0 }}>Куди пішли гроші</div>
              {!byCat.length && !spendManual && <div className="note">Витрат за період немає. Внесіть списання кнопкою «💸 Внести витрату».</div>}
              {byCat.map(([k, v]) => (
                <div key={k} className="mk-hbar"><span>{k}</span><i><b style={{ width: `${Math.max(2, (Number(v) / maxCat) * 100)}%` }} /></i><em>{money(v)}</em></div>
              ))}
              {spendManual > 0 && <div className="mk-hbar"><span>поза транзакціями (з карток кампаній)</span><i><b style={{ width: `${Math.max(2, (spendManual / Math.max(maxCat, spendManual)) * 100)}%`, opacity: 0.5 }} /></i><em>{money(spendManual)}</em></div>}
            </div>
            <div className="card mk-panel">
              <div className="section-label" style={{ marginTop: 0 }}>Ліди в CRM по тижнях</div>
              {!weeks.length ? <div className="note">Лідів за період немає.</div> : (
                <div className="mk-weeks">
                  {weeks.map((w) => (
                    <div key={w.week} className="mk-week" title={`тиждень з ${new Date(w.week).toLocaleDateString("uk-UA")}: ${w.leads}`}>
                      <em>{w.leads}</em><i style={{ height: `${Math.max(4, (w.leads / maxWeek) * 100)}%` }} /><span>{new Date(w.week).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="section-label">Кампанії за період</div>
          <div className="table-scroll">
            <table className="dense">
              <thead>
                <tr><th>Кампанія</th><th style={{ textAlign: "right" }}>Ліди</th><th style={{ textAlign: "right" }}>Кваліф.</th><th style={{ textAlign: "right" }}>Відмови</th><th style={{ textAlign: "right" }}>Договори</th><th style={{ textAlign: "right" }}>Витрачено</th><th style={{ textAlign: "right" }}>Ціна ліда</th></tr>
              </thead>
              <tbody>
                {rows.filter((r) => r.leads || r.spend || r.c.status === "активна").map(({ c, st, leads, spend, cpl }) => (
                  <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setCampaignModal({ campaign: c })}>
                    <td>{c.name}<div className="note" style={{ marginTop: 0 }}>{CHANNEL_LABELS[c.channel] || c.channel} · {c.status}</div></td>
                    <td style={{ textAlign: "right" }}>{leads}</td>
                    <td style={{ textAlign: "right" }}>{Number(st.qualified) || 0}</td>
                    <td style={{ textAlign: "right" }}>{Number(st.rejected) || 0}</td>
                    <td style={{ textAlign: "right" }}>{Number(st.contracts) || 0}{Number(st.contract_sum) ? <div className="note" style={{ marginTop: 0 }}>{money(st.contract_sum)}</div> : null}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{money(spend)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap", color: "var(--amber)" }}>{cpl != null ? money(cpl) : "—"}</td>
                  </tr>
                ))}
                {Number(un.leads) > 0 && (
                  <tr><td>Без кампанії<div className="note" style={{ marginTop: 0 }}>сайт, дзвінки, інше</div></td><td style={{ textAlign: "right" }}>{un.leads}</td><td style={{ textAlign: "right" }}>{un.qualified}</td><td style={{ textAlign: "right" }}>{un.rejected}</td><td style={{ textAlign: "right" }}>{un.contracts}</td><td /><td /></tr>
                )}
              </tbody>
            </table>
          </div>
          {!withManual && <p className="note">Ліди й витрати «поза системою» з карток кампаній показуються лише у «Увесь час».</p>}
        </>
      )}

      {assetModal && (
        <AssetModal defaultProject={defaultProject}
          open
          asset={assetModal.asset}
          defaultDate={assetModal.defaultDate}
          onClose={() => setAssetModal(null)}
          onSaved={() => setAssetModal(null)}
        />
      )}
      {campaignModal && (
        <CampaignModal defaultProject={defaultProject}
          open
          campaign={campaignModal.campaign}
          onClose={() => setCampaignModal(null)}
          onSaved={() => setCampaignModal(null)}
        />
      )}
      <ExpenseModal open={!!expense} campaign={expense?.campaign || null} onClose={() => setExpense(null)} onSaved={() => { setExpense(null); loadStats(); }} />
      <ChannelsModal open={channelsOpen} onClose={() => setChannelsOpen(false)} />
    </div>
  );
}

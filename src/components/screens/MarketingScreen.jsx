"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMarketingData } from "@/context/MarketingDataContext";
import AssetModal from "@/components/modals/AssetModal";
import CampaignModal from "@/components/modals/CampaignModal";
import {
  ASSET_TYPE_ICONS,
  CAMPAIGN_STATUSES,
  CHANNELS,
  CHANNEL_COLORS,
  CHANNEL_LABELS,
  MONTHS,
  addMonths,
  campaignStatusStyles,
  curr,
  monthGridCells,
  startOfMonth,
  toDateKey,
} from "@/lib/marketing";

export default function MarketingScreen() {
  const { loading, error, assets, campaigns, supabase, reload } = useMarketingData();
  const { canWriteCatalog } = useAuth();
  const [view, setView] = useState("calendar");
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()));
  const [activeChannels, setActiveChannels] = useState(() => new Set(CHANNELS));
  const [assetModal, setAssetModal] = useState(null);
  const [campaignModal, setCampaignModal] = useState(null);

  const cells = useMemo(() => monthGridCells(monthStart), [monthStart]);
  const today = useMemo(() => toDateKey(new Date()), []);

  function toggleChannel(ch) {
    setActiveChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch); else next.add(ch);
      return next;
    });
  }

  async function cycleCampaignStatus(c) {
    if (!canWriteCatalog) return;
    const next = CAMPAIGN_STATUSES[(CAMPAIGN_STATUSES.indexOf(c.status) + 1) % CAMPAIGN_STATUSES.length];
    await supabase.from("campaigns").update({ status: next }).eq("id", c.id);
    await reload(true);
  }

  if (loading) return <div className="empty">Завантаження маркетингу...</div>;
  if (error) return <div className="empty">Помилка підключення: {error}</div>;

  const totalBudget = campaigns.reduce((s, c) => s + (Number(c.budget) || 0), 0);
  const totalLeads = campaigns.reduce((s, c) => s + (Number(c.leads_generated) || 0), 0);
  const activeCount = campaigns.filter((c) => c.status === "активна").length;
  const avgCpl = totalLeads > 0 ? totalBudget / totalLeads : 0;
  const publishedCount = assets.filter((a) => a.status === "опубліковано").length;
  const byChannel = CHANNELS.map((ch) => ({
    ch,
    budget: campaigns.filter((c) => c.channel === ch).reduce((s, c) => s + (Number(c.budget) || 0), 0),
  }));
  const maxChannelBudget = Math.max(1, ...byChannel.map((b) => b.budget));

  return (
    <div>
      <p className="note">Контент-календар і рекламні кампанії — окремий дохід від ліда до публікації.</p>

      <div className="toolbar">
        <div className="seg-row">
          <button className={`seg-btn${view === "calendar" ? " active" : ""}`} onClick={() => setView("calendar")}>Контент-календар</button>
          <button className={`seg-btn${view === "dashboard" ? " active" : ""}`} onClick={() => setView("dashboard")}>Дашборд реклами</button>
        </div>
      </div>

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
          <div className="ops-kpi-grid">
            <div className="ops-kpi">
              <div className="k-label">Бюджет усього</div>
              <div className="k-value">{curr(totalBudget)}</div>
              <div className="note" style={{ marginTop: 4 }}>{campaigns.length} кампаній</div>
            </div>
            <div className="ops-kpi">
              <div className="k-label">Ліди згенеровано</div>
              <div className="k-value">{totalLeads}</div>
              <div className="note" style={{ marginTop: 4 }}>{activeCount} активних кампаній</div>
            </div>
            <div className="ops-kpi">
              <div className="k-label">Середня ціна ліда</div>
              <div className="k-value" style={{ color: "var(--amber)" }}>{curr(avgCpl)}</div>
              <div className="note" style={{ marginTop: 4 }}>по всіх каналах</div>
            </div>
            <div className="ops-kpi">
              <div className="k-label">Контенту опубліковано</div>
              <div className="k-value">{publishedCount}<span className="note" style={{ fontSize: 14 }}> / {assets.length}</span></div>
              <div className="note" style={{ marginTop: 4 }}>чернеток: {assets.filter((a) => a.status === "чернетка").length}</div>
            </div>
          </div>

          <div className="section-label">Бюджет по каналах</div>
          <div className="card" style={{ padding: 16, marginBottom: 20, cursor: "default" }}>
            {byChannel.map(({ ch, budget }) => (
              <div key={ch} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 90, fontSize: 12, color: CHANNEL_COLORS[ch] }}>{CHANNEL_LABELS[ch]}</div>
                <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(2, (budget / maxChannelBudget) * 100)}%`, height: "100%", background: CHANNEL_COLORS[ch] }} />
                </div>
                <div className="note" style={{ marginTop: 0, minWidth: 90, textAlign: "right" }}>{budget ? curr(budget) : "—"}</div>
              </div>
            ))}
          </div>

          <div className="toolbar">
            <div className="section-label" style={{ margin: 0 }}>Кампанії</div>
            {canWriteCatalog && (
              <button className="btn primary" onClick={() => setCampaignModal({ campaign: null })}>+ Кампанія</button>
            )}
          </div>
          <table>
            <thead>
              <tr>
                <th>Назва</th>
                <th>Канал</th>
                <th style={{ textAlign: "right" }}>Бюджет</th>
                <th style={{ textAlign: "right" }}>Ліди</th>
                <th style={{ textAlign: "right" }}>Ціна ліда</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const cpl = c.leads_generated > 0 ? Number(c.budget || 0) / c.leads_generated : null;
                const style = campaignStatusStyles[c.status] || campaignStatusStyles["активна"];
                return (
                  <tr key={c.id} style={{ opacity: c.status === "пауза" ? 0.6 : 1 }}>
                    <td style={{ cursor: "pointer" }} onClick={() => setCampaignModal({ campaign: c })}>
                      {c.name}
                      <div className="note" style={{ marginTop: 2 }}>{c.start_date || ""} {c.end_date ? `→ ${c.end_date}` : ""}</div>
                    </td>
                    <td><span className="tag" style={{ background: "var(--bg)", color: CHANNEL_COLORS[c.channel] }}>{CHANNEL_LABELS[c.channel]}</span></td>
                    <td style={{ textAlign: "right" }}>{curr(c.budget)}</td>
                    <td style={{ textAlign: "right" }}>{c.leads_generated}</td>
                    <td style={{ textAlign: "right", color: "var(--amber)" }}>{cpl ? curr(cpl) : "—"}</td>
                    <td>
                      <span
                        style={{ background: style.bg, color: style.text, borderRadius: 6, padding: "3px 8px", fontSize: 12, cursor: canWriteCatalog ? "pointer" : "default" }}
                        onClick={() => cycleCampaignStatus(c)}
                        title={canWriteCatalog ? "Клік — наступний статус" : ""}
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!campaigns.length && (
                <tr><td colSpan={6} className="empty">Кампаній ще немає.</td></tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {assetModal && (
        <AssetModal
          open
          asset={assetModal.asset}
          defaultDate={assetModal.defaultDate}
          onClose={() => setAssetModal(null)}
          onSaved={() => setAssetModal(null)}
        />
      )}
      {campaignModal && (
        <CampaignModal
          open
          campaign={campaignModal.campaign}
          onClose={() => setCampaignModal(null)}
          onSaved={() => setCampaignModal(null)}
        />
      )}
    </div>
  );
}

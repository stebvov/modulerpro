"use client";
import SettingsButton from "@/components/SettingsButton";
import SearchFilter from "@/components/SearchFilter";
import { useAppData } from "@/context/DataContext";
import { fmtCurrency } from "@/lib/format";
import { flagOf } from "@/lib/site/leadMeta";

import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCrmData } from "@/context/CrmDataContext";
import DealModal from "@/components/modals/DealModal";
import CrmSettingsModal from "@/components/modals/CrmSettingsModal";
import { computeProductionCostSnapshot, fmtDate, fmtDateTime, stageColor } from "@/lib/crm";

function AttentionReport({ rows, onOpenDeal, onClose }) {
  const sorted = [...rows].sort((a, b) => (b.days_without_attention || 0) - (a.days_without_attention || 0));
  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <h2>Ліди без уваги</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map((r) => {
            const overdue = r.next_action_at && new Date(r.next_action_at) < new Date();
            const warn = (r.days_without_attention || 0) >= 7;
            return (
              <div
                key={r.deal_id}
                onClick={() => onOpenDeal(r)}
                className="card"
                style={{ padding: "10px 12px", background: warn ? "var(--danger-bg)" : "var(--card)" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.lead_name}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: warn ? "#C1652F" : "var(--text-secondary)" }}>{r.days_without_attention} дн.</div>
                </div>
                <div className="note" style={{ marginTop: 2 }}>
                  {r.pipeline_name} · {r.stage_label} · останній контакт: {r.last_activity_type ? `${r.last_activity_type}, ` : ""}{fmtDate(r.last_activity_at || r.created_at)}
                </div>
                {r.next_action_at && (
                  <div style={{ fontSize: 12, marginTop: 2, color: overdue ? "var(--danger)" : "var(--accent)" }}>
                    🔔 {overdue ? "Прострочено: " : "Заплановано: "}{fmtDateTime(r.next_action_at)}{r.next_action_note ? ` — ${r.next_action_note}` : ""}
                  </div>
                )}
              </div>
            );
          })}
          {sorted.length === 0 && <div className="empty">Немає угод.</div>}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Закрити</button>
        </div>
      </div>
    </div>
  );
}

export default function CrmScreen({ onlySlug, hideSlug = "uk-owners" }) {
  const {
    loading, error, pipelines: allPipelines, pipelineStages, dealsKanban, deals, dealServices,
    templates, serviceTemplates, bomItems, extraCosts, supplierPrices, marginAlerts, supabase, reload,
  } = useCrmData();
  const { currency, exchangeRates, showDecimals } = useAppData();
  const money = (uah) => fmtCurrency(uah, currency, exchangeRates, showDecimals);
  const { canWriteCrm: canWriteCatalog } = useAuth(); // для CRM — право змінювати угоди
  const [pipelineId, setPipelineId] = useState(null);
  // розділ «УК і сервіс» має свою воронку; в основних продажах її не показуємо
  const pipelines = useMemo(() => (onlySlug ? allPipelines.filter((p) => p.slug === onlySlug) : allPipelines.filter((p) => p.slug !== hideSlug)), [allPipelines, onlySlug, hideSlug]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);

  const activePipelineId = pipelineId || pipelines[0]?.id || null;
  const pipeline = pipelines.find((p) => p.id === activePipelineId) || pipelines[0];
  const stages = useMemo(
    () => (pipeline ? pipelineStages.filter((s) => s.pipeline_id === pipeline.id).sort((a, b) => a.sort_order - b.sort_order) : []),
    [pipeline, pipelineStages]
  );

  const pipelineDeals = pipeline ? dealsKanban.filter((d) => d.pipeline_id === pipeline.id) : [];
  const filtered = pipelineDeals.filter((d) => {
    const q = search.trim().toLowerCase();
    const matchesQuery = !q || (d.lead_name || "").toLowerCase().includes(q) || (d.lead_region || "").toLowerCase().includes(q);
    return matchesQuery;
  });

  function byStage(stageId) {
    return filtered.filter((d) => d.stage_id === stageId);
  }
  const grandTotal = filtered.reduce((s, d) => s + Number(d.total_price || 0), 0);
  const overdueCount = dealsKanban.filter((d) => d.next_action_at && new Date(d.next_action_at) < new Date()).length;

  async function moveStage(deal, dir) {
    const idx = stages.findIndex((s) => s.id === deal.stage_id);
    const next = stages[idx + dir];
    if (!next) return;
    const patch = { stage_id: next.id };
    const rawDeal = deals.find((d) => d.id === deal.deal_id);
    if (rawDeal && rawDeal.production_cost_snapshot == null) {
      const snapshot = computeProductionCostSnapshot(rawDeal, { templates, bomItems, extraCosts, supplierPrices });
      if (snapshot != null) patch.production_cost_snapshot = snapshot;
    }
    await supabase.from("deals").update(patch).eq("id", deal.deal_id);
    await reload(true);
  }

  function openDealFromReport(row) {
    setPipelineId(row.pipeline_id);
    setModal({ mode: "edit", dealId: row.deal_id });
  }

  if (loading) return <div className="empty">Завантаження CRM...</div>;
  if (error) return <div className="empty">Помилка підключення: {error}</div>;
  if (!pipeline) return <div className="empty">Немає жодної воронки. Створи її в налаштуваннях.</div>;

  return (
    <div>
      <div className="toolbar" style={{ alignItems: "flex-start" }}>
        <div className="toolbar-left" style={{ flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {pipelines.map((p) => {
            const count = dealsKanban.filter((d) => d.pipeline_id === p.id).length;
            return (
              <button key={p.id} className={`seg-btn${p.id === pipeline.id ? " active" : ""}`} onClick={() => setPipelineId(p.id)}>
                {p.name} <span className="note">({count})</span>
              </button>
            );
          })}
          <SettingsButton title="Налаштування воронок і етапів" onClick={() => setModal({ mode: "settings" })} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div className="note" style={{ textTransform: "uppercase" }}>Разом у воронці</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--accent)" }}>{money(grandTotal)}</div>
          </div>
          <button className="btn" style={{ position: "relative" }} title="Ліди без уваги" onClick={() => setModal({ mode: "report" })}>
            📋
            {overdueCount > 0 && <span className="notif-badge">{overdueCount}</span>}
          </button>
          {canWriteCatalog && (
            <button className="btn primary" onClick={() => setModal({ mode: "add" })}>+ Новий лід</button>
          )}
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left" style={{ flex: 1, flexWrap: "wrap" }}>
          <SearchFilter value={search} onChange={setSearch} placeholder="Пошук за іменем, регіоном..." />
        </div>
      </div>

      <div className="kanban-board">
        {stages.map((stage, idx) => {
          const stageDeals = byStage(stage.id);
          const stageTotal = stageDeals.reduce((s, d) => s + Number(d.total_price || 0), 0);
          const color = stageColor(idx, stages.length);
          return (
            <div key={stage.id} className="kanban-col">
              <div className="kanban-col-head" style={{ borderTopColor: color }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{stage.label}</h3>
                </div>
                <div className="note" style={{ color, marginTop: 4, fontWeight: 600 }}>{stageDeals.length} · {money(stageTotal)}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 40 }}>
                {stageDeals.length === 0 && <div className="kanban-empty">Порожньо</div>}
                {stageDeals.map((d) => {
                  const services = dealServices.filter((s) => s.deal_id === d.deal_id);
                  const overdue = d.next_action_at && new Date(d.next_action_at) < new Date();
                  const dSince = d.days_without_attention;
                  const marginAlert = marginAlerts.find((m) => m.deal_id === d.deal_id);
                  return (
                    <div key={d.deal_id} className="card kanban-card" style={{ borderColor: overdue ? "var(--danger)" : undefined, cursor: "pointer" }}
                      title="Відкрити угоду" onClick={(e) => { if (!e.target.closest("button,a,input,select,.icon-x")) setModal({ mode: "edit", dealId: d.deal_id }); }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.25 }}>{d.lead_name}</div>
                        <span className="icon-x" onClick={() => setModal({ mode: "edit", dealId: d.deal_id })} title="Редагувати">✎</span>
                      </div>
                      {marginAlert?.is_below_threshold && (
                        <div
                          className="badge"
                          style={{ marginTop: 4, background: "var(--danger-bg)", color: "var(--danger)" }}
                          title={`Маржа ${marginAlert.margin_pct}% — нижче порогу ${marginAlert.threshold_pct}%`}
                        >
                          ⚠ Маржа {marginAlert.margin_pct}%
                        </div>
                      )}
                      <div className="note" style={{ marginTop: 4 }}>
                        {d.is_custom && (
                          <>Кастом · {d.custom_area_m2 || "?"} м²{d.quantity > 1 && <> · ×{d.quantity}</>}{d.template_lines?.length ? " + " : ""}</>
                        )}
                        {d.template_lines?.length ? (
                          d.template_lines.map((l, i) => {
                            let itemLabel = l.label;
                            if (!itemLabel && l.kind === "house") itemLabel = templates.find((t) => t.id === l.template_id)?.name || "?";
                            else if (!itemLabel && l.kind === "service") itemLabel = serviceTemplates.find((t) => t.id === l.template_id)?.name || "?";
                            return (
                              <span key={i}>
                                {i > 0 && ", "}
                                {itemLabel} ×{l.quantity}
                              </span>
                            );
                          })
                        ) : !d.is_custom && (
                          d.template_name ? (
                            <>{d.template_name}{d.area_m2 ? <> · {d.area_m2} м²</> : null}{d.quantity > 1 && <> · ×{d.quantity}</>}</>
                          ) : (
                            <>Без позицій</>
                          )
                        )}
                      </div>
                      <div className="note" style={{ marginTop: 2 }}>
                        {d.lead_cc && <>{flagOf(d.lead_cc)} </>}{d.lead_region}
                        {(d.lead_device || d.lead_channel) && (
                          <span title="Заявка з сайту: пристрій і джерело (деталі — в картці угоди)">
                            {d.lead_region ? " · " : ""}{d.lead_device ? (d.lead_device === "Комп'ютер" ? "💻" : "📱") : ""}{d.lead_channel ? ` ${d.lead_channel}` : ""}
                          </span>
                        )}
                      </div>
                      {d.lead_phone && <div className="note" style={{ marginTop: 2 }}>{d.lead_phone}</div>}
                      {services.length > 0 && (
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
                          {services.map((s) => (
                            <div key={s.id} className="note" style={{ display: "flex", justifyContent: "space-between" }}>
                              <span>{s.service_type.replace("_", " ")}{s.variant ? ` (${s.variant})` : ""}</span>
                              <span>{s.calc_method === "середнє" ? "≈" : ""}{money(s.price)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 10, flexWrap: "wrap", gap: 4 }}>
                        {Number(d.production_price || d.estimated_price) > 0 && (
                          <span style={{ fontSize: 15, fontWeight: 600, color: d.is_custom ? "var(--text-secondary)" : "var(--text)" }}>
                            {d.is_custom ? "≈" : ""}{money((Number(d.production_price || d.estimated_price)) * (d.quantity || 1))}
                          </span>
                        )}
                        {Number(d.services_price_total) > 0 && (
                          <span style={{ fontSize: 11, color: "#C1652F" }}>
                            {Number(d.production_price || d.estimated_price) > 0 ? "+" : ""}{money(d.services_price_total)}{Number(d.production_price || d.estimated_price) > 0 ? " посл." : ""}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                        <span className="note" style={{ color: dSince >= 7 ? "#C1652F" : undefined }}>
                          🕒 {dSince} дн.{d.attachments_count > 0 ? ` · 📎${d.attachments_count}` : ""}
                        </span>
                        {d.next_action_at && <span style={{ fontSize: 11, color: overdue ? "var(--danger)" : "var(--accent)" }}>🔔 {fmtDate(d.next_action_at)}</span>}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, gap: 6 }}>
                        <span className="note">{d.owner_name || "—"}</span>
                        {canWriteCatalog && (
                          <div style={{ display: "flex", gap: 4 }}>
                            {idx > 0 && (
                              <button className="btn small" onClick={() => moveStage(d, -1)} title="Повернути на попередній етап">
                                <span className="btn-label-full">← Назад</span>
                                <span className="btn-label-compact">←</span>
                              </button>
                            )}
                            {idx < stages.length - 1 && (
                              <button className="btn small primary" onClick={() => moveStage(d, 1)} title="Далі">
                                <span className="btn-label-full">Далі →</span>
                                <span className="btn-label-compact">→</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {(modal?.mode === "add" || modal?.mode === "edit") && (
        <DealModal open dealId={modal.dealId || null} pipeline={{ ...pipeline, stages }} onClose={() => setModal(null)} onSaved={() => setModal(null)} />
      )}
      {modal?.mode === "settings" && <CrmSettingsModal open onClose={() => setModal(null)} />}
      {modal?.mode === "report" && <AttentionReport rows={dealsKanban} onOpenDeal={openDealFromReport} onClose={() => setModal(null)} />}
    </div>
  );
}

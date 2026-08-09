"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useServicesData } from "@/context/ServicesDataContext";
import ExecutionModal from "@/components/modals/ExecutionModal";
import PartnerModal from "@/components/modals/PartnerModal";
import { EXECUTION_STATUSES, SERVICE_TYPE_ICONS, SERVICE_TYPE_LABELS, actualTotal, curr, statusStyles } from "@/lib/services";

export default function ServicesScreen() {
  const { loading, error, partners, executions } = useServicesData();
  const { canWriteCatalog } = useAuth();
  const [view, setView] = useState("executions");
  const [statusFilter, setStatusFilter] = useState("");
  const [executionModal, setExecutionModal] = useState(null);
  const [partnerModal, setPartnerModal] = useState(null);

  const kpis = useMemo(() => {
    const plan = executions.reduce((s, e) => s + (Number(e.deal_services?.cost_estimate) || 0), 0);
    const fact = executions.reduce((s, e) => s + actualTotal(e), 0);
    const active = executions.filter((e) => e.status !== "завершено").length;
    return { plan, fact, delta: plan - fact, active };
  }, [executions]);

  const filteredExecutions = statusFilter ? executions.filter((e) => e.status === statusFilter) : executions;

  if (loading) return <div className="empty">Завантаження послуг...</div>;
  if (error) return <div className="empty">Помилка підключення: {error}</div>;

  return (
    <div>
      <p className="note">Виконання послуг з угод CRM — планова і фактична собівартість, партнери та власні бригади.</p>

      <div className="ops-kpi-grid">
        <div className="ops-kpi">
          <div className="k-label">Планова собівартість</div>
          <div className="k-value">{curr(kpis.plan)}</div>
        </div>
        <div className="ops-kpi">
          <div className="k-label">Фактичні витрати</div>
          <div className="k-value" style={{ color: "var(--amber)" }}>{curr(kpis.fact)}</div>
        </div>
        <div className="ops-kpi">
          <div className="k-label">Дельта (план − факт)</div>
          <div className="k-value" style={{ color: kpis.delta >= 0 ? "var(--success)" : "var(--danger)" }}>{curr(kpis.delta)}</div>
        </div>
        <div className="ops-kpi">
          <div className="k-label">Активні виконання</div>
          <div className="k-value">{kpis.active}</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="seg-row">
          <button className={`seg-btn${view === "executions" ? " active" : ""}`} onClick={() => setView("executions")}>Виконання послуг</button>
          <button className={`seg-btn${view === "partners" ? " active" : ""}`} onClick={() => setView("partners")}>Партнери</button>
        </div>
        {view === "executions" && canWriteCatalog && (
          <button className="btn primary" onClick={() => setExecutionModal({ execution: null })}>+ Виконання</button>
        )}
        {view === "partners" && canWriteCatalog && (
          <button className="btn primary" onClick={() => setPartnerModal({ partner: null })}>+ Партнер</button>
        )}
      </div>

      {view === "executions" && (
        <>
          <div className="form-row" style={{ maxWidth: 260 }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Усі статуси</option>
              {EXECUTION_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </div>
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Угода</th>
                <th>Тип послуги</th>
                <th>Виконавець</th>
                <th style={{ textAlign: "right" }}>План</th>
                <th style={{ textAlign: "right" }}>Факт</th>
                <th style={{ textAlign: "right" }}>Дельта</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {filteredExecutions.map((e) => {
                const ds = e.deal_services;
                const plan = Number(ds?.cost_estimate) || 0;
                const fact = actualTotal(e);
                const delta = plan - fact;
                const style = statusStyles[e.status] || statusStyles["заплановано"];
                const executor = e.executor_type === "партнер" ? e.service_partners?.name || "партнер" : "власна бригада";
                return (
                  <tr key={e.id} style={{ cursor: "pointer" }} onClick={() => setExecutionModal({ execution: e })}>
                    <td>{ds?.deals?.leads?.name || "—"}</td>
                    <td>{ds?.service_type ? `${SERVICE_TYPE_ICONS[ds.service_type] || "•"} ` : ""}{SERVICE_TYPE_LABELS[ds?.service_type] || ds?.service_type || "—"}</td>
                    <td>{executor}</td>
                    <td style={{ textAlign: "right" }}>{curr(plan)}</td>
                    <td style={{ textAlign: "right" }}>{curr(fact)}</td>
                    <td style={{ textAlign: "right", color: delta >= 0 ? "var(--success)" : "var(--danger)" }}>{curr(delta)}</td>
                    <td><span style={{ background: style.bg, color: style.text, borderRadius: 6, padding: "3px 8px", fontSize: 12 }}>{e.status.replace("_", " ")}</span></td>
                  </tr>
                );
              })}
              {!filteredExecutions.length && (
                <tr><td colSpan={7} className="empty">Немає виконань послуг.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </>
      )}

      {view === "partners" && (
        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Назва</th>
              <th>Тип послуги</th>
              <th>Регіон</th>
              <th>Надійність</th>
              <th>Статус</th>
              <th>Контакт</th>
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => {
              const rel = p.reliability_score || 0;
              return (
                <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => setPartnerModal({ partner: p })}>
                  <td>{p.name}</td>
                  <td>{SERVICE_TYPE_ICONS[p.service_type] || "•"} {SERVICE_TYPE_LABELS[p.service_type] || p.service_type}</td>
                  <td>{p.region || "—"}</td>
                  <td>{"★".repeat(rel)}{"☆".repeat(5 - rel)}</td>
                  <td>
                    <span style={{ background: p.active ? "var(--success-bg)" : "var(--border)", color: p.active ? "var(--success)" : "var(--text-secondary)", borderRadius: 6, padding: "3px 8px", fontSize: 12 }}>
                      {p.active ? "активний" : "архів"}
                    </span>
                  </td>
                  <td>{p.contact?.phone || "—"}</td>
                </tr>
              );
            })}
            {!partners.length && (
              <tr><td colSpan={6} className="empty">Немає партнерів.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      )}

      {executionModal && (
        <ExecutionModal
          open
          execution={executionModal.execution}
          onClose={() => setExecutionModal(null)}
          onSaved={() => setExecutionModal(null)}
        />
      )}
      {partnerModal && (
        <PartnerModal
          open
          partner={partnerModal.partner}
          onClose={() => setPartnerModal(null)}
          onSaved={() => setPartnerModal(null)}
        />
      )}
    </div>
  );
}

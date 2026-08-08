"use client";

import { useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { useFinanceData } from "@/context/FinanceDataContext";
import MonthlyMarginChart from "@/components/MonthlyMarginChart";
import CumulativeTrendChart from "@/components/CumulativeTrendChart";
import GoalProgressBar from "@/components/GoalProgressBar";
import TransactionModal from "@/components/modals/TransactionModal";
import { convert, fmtCurrency } from "@/lib/format";
import { marginProduction, marginServices, marginPct, fmtMonthLong } from "@/lib/finance";

export default function FinanceScreen() {
  const { exchangeRates } = useAppData();
  const { canWriteFinance } = useAuth();
  const { loading, error, monthlyPnl, cumulativePnl, deals, overheadTransactions, reload, supabase } = useFinanceData();
  const [dealId, setDealId] = useState("");
  const [dealPnl, setDealPnl] = useState(null);
  const [dealPnlLoading, setDealPnlLoading] = useState(false);
  const [txModalOpen, setTxModalOpen] = useState(false);

  async function deleteOverhead(id) {
    if (!confirm("Видалити цю витрату?")) return;
    await supabase.from("transactions").delete().eq("id", id);
    await reload(true);
  }

  async function handleSelectDeal(id) {
    setDealId(id);
    setDealPnl(null);
    if (!id) return;
    setDealPnlLoading(true);
    const { data } = await supabase.from("v_deal_pnl").select("*").eq("deal_id", id).maybeSingle();
    setDealPnl(data || false);
    setDealPnlLoading(false);
  }

  if (loading) return <div className="empty">Завантаження фінансів...</div>;
  if (error) return <div className="empty">Помилка підключення: {error}</div>;

  const lastMonth = monthlyPnl[monthlyPnl.length - 1];
  const lastCumulative = cumulativePnl[cumulativePnl.length - 1];
  const cumulativeUsd = lastCumulative ? convert(lastCumulative.cumulative_net_profit, "USD", exchangeRates) || 0 : 0;

  const totalOverhead = overheadTransactions.reduce((s, t) => s + Number(t.amount || 0), 0);
  const byCategory = Object.values(
    overheadTransactions.reduce((acc, t) => {
      const key = t.category || "Без категорії";
      if (!acc[key]) acc[key] = { category: key, sum: 0 };
      acc[key].sum += Number(t.amount || 0);
      return acc;
    }, {})
  ).sort((a, b) => b.sum - a.sum);
  const maxCategorySum = Math.max(1, ...byCategory.map((c) => c.sum));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <p className="note">Дохід і маржа виробництва та послуг рахуються окремо, в реальному часі — на основі транзакцій.</p>
        {canWriteFinance && (
          <button className="btn primary small" onClick={() => setTxModalOpen(true)}>+ Транзакція</button>
        )}
      </div>

      <div className="section-label">01 — Дашборд власника</div>
      {!lastMonth ? (
        <div className="empty">Транзакцій ще немає — дані з&apos;являться після перших записів у бухгалтерії.</div>
      ) : (
        <>
          <div className="ops-kpi-grid">
            <div className="ops-kpi">
              <div className="k-label">Дохід усього</div>
              <div className="k-value">{fmtCurrency(lastMonth.revenue_total, "UAH", exchangeRates)}</div>
              <div className="note" style={{ marginTop: 4 }}>виробництво + послуги</div>
            </div>
            <div className="ops-kpi">
              <div className="k-label">Маржа виробництва</div>
              <div className="k-value" style={{ color: "var(--accent)" }}>{fmtCurrency(marginProduction(lastMonth), "UAH", exchangeRates)}</div>
              <div className="note" style={{ marginTop: 4 }}>{marginPct(marginProduction(lastMonth), lastMonth.revenue_production).toFixed(1)}% маржинальність</div>
            </div>
            <div className="ops-kpi">
              <div className="k-label">Маржа послуг</div>
              <div className="k-value" style={{ color: "var(--success)" }}>{fmtCurrency(marginServices(lastMonth), "UAH", exchangeRates)}</div>
              <div className="note" style={{ marginTop: 4 }}>{marginPct(marginServices(lastMonth), lastMonth.revenue_services).toFixed(1)}% маржинальність</div>
            </div>
            <div className="ops-kpi">
              <div className="k-label">Чистий дохід/міс</div>
              <div className="k-value" style={{ color: Number(lastMonth.net_profit) >= 0 ? "var(--text)" : "var(--danger)" }}>
                {fmtCurrency(lastMonth.net_profit, "UAH", exchangeRates)}
              </div>
              <div className="note" style={{ marginTop: 4 }}>{fmtMonthLong(lastMonth.month)}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, margin: "10px 0" }}>
            <span className="note"><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "var(--accent)", marginRight: 5 }} />Маржа виробництва</span>
            <span className="note"><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "var(--success)", marginRight: 5 }} />Маржа послуг</span>
          </div>
          <div className="card" style={{ padding: 16, cursor: "default" }}>
            <MonthlyMarginChart rows={monthlyPnl} />
          </div>
        </>
      )}

      <div className="section-label">02 — Тренд до цілі</div>
      {!cumulativePnl.length ? (
        <div className="empty">Немає даних для тренду.</div>
      ) : (
        <>
          <div className="card" style={{ padding: 20, marginBottom: 14, cursor: "default" }}>
            <GoalProgressBar valueUsd={cumulativeUsd} />
            <div className="note" style={{ marginTop: 8 }}>
              ≈ {fmtCurrency(lastCumulative.cumulative_net_profit, "UAH", exchangeRates)} за курсом на сьогодні
            </div>
          </div>
          <div className="card" style={{ padding: 16, cursor: "default" }}>
            <CumulativeTrendChart rows={cumulativePnl} />
          </div>
        </>
      )}

      <div className="section-label">03 — P&amp;L по угоді</div>
      <div className="form-row" style={{ maxWidth: 420 }}>
        <select value={dealId} onChange={(e) => handleSelectDeal(e.target.value)}>
          <option value="">Обери угоду...</option>
          {deals.map((d) => (
            <option key={d.id} value={d.id}>{d.leadName || d.id.slice(0, 8)}</option>
          ))}
        </select>
      </div>
      {!dealId && <div className="empty">Оберіть угоду вище, щоб побачити P&amp;L.</div>}
      {dealId && dealPnlLoading && <div className="empty">Завантаження...</div>}
      {dealId && !dealPnlLoading && dealPnl === false && <div className="empty">По цій угоді ще немає транзакцій.</div>}
      {dealId && !dealPnlLoading && dealPnl && (
        <table>
          <thead><tr><th>Стаття</th><th style={{ textAlign: "right" }}>Сума</th></tr></thead>
          <tbody>
            <tr><td className="note">Дохід — виробництво</td><td style={{ textAlign: "right", color: "var(--success)" }}>{fmtCurrency(dealPnl.revenue_production, "UAH", exchangeRates)}</td></tr>
            <tr><td className="note">Собівартість виробництва</td><td style={{ textAlign: "right", color: "var(--danger)" }}>−{fmtCurrency(dealPnl.cost_production, "UAH", exchangeRates)}</td></tr>
            <tr>
              <td className="note" style={{ paddingLeft: 28 }}>= Маржа виробництва</td>
              <td style={{ textAlign: "right", color: dealPnl.revenue_production - dealPnl.cost_production >= 0 ? "var(--success)" : "var(--danger)" }}>
                {fmtCurrency(dealPnl.revenue_production - dealPnl.cost_production, "UAH", exchangeRates)}
              </td>
            </tr>
            <tr><td className="note">Дохід — послуги</td><td style={{ textAlign: "right", color: "var(--success)" }}>{fmtCurrency(dealPnl.revenue_services, "UAH", exchangeRates)}</td></tr>
            <tr><td className="note">Витрати на послуги</td><td style={{ textAlign: "right", color: "var(--danger)" }}>−{fmtCurrency(dealPnl.cost_services, "UAH", exchangeRates)}</td></tr>
            <tr>
              <td className="note" style={{ paddingLeft: 28 }}>= Маржа послуг</td>
              <td style={{ textAlign: "right", color: dealPnl.revenue_services - dealPnl.cost_services >= 0 ? "var(--success)" : "var(--danger)" }}>
                {fmtCurrency(dealPnl.revenue_services - dealPnl.cost_services, "UAH", exchangeRates)}
              </td>
            </tr>
            <tr>
              <td className="note">Розподілені адмін./майданчикові витрати</td>
              <td style={{ textAlign: "right", color: "var(--danger)" }}>−{fmtCurrency(dealPnl.cost_overhead, "UAH", exchangeRates)}</td>
            </tr>
            <tr style={{ fontWeight: 600 }}><td>Чистий прибуток по угоді</td><td style={{ textAlign: "right" }}>{fmtCurrency(dealPnl.net_profit, "UAH", exchangeRates)}</td></tr>
          </tbody>
        </table>
      )}
      {dealId && !dealPnlLoading && dealPnl && Number(dealPnl.cost_overhead) > 0 && (
        <p className="note" style={{ marginTop: 6 }}>
          Загальні витрати (оренда офісу, зарплати, реклама тощо) та витрати конкретного майданчика розподіляються між будинками пропорційно до їх площі та кількості днів у виробництві за відповідний місяць.
        </p>
      )}

      <div className="section-label">04 — Адміністративні та майданчикові витрати</div>
      {!overheadTransactions.length ? (
        <div className="empty">Витрат цього типу ще немає.</div>
      ) : (
        <>
          <div className="ops-kpi-grid" style={{ marginBottom: 16 }}>
            <div className="ops-kpi">
              <div className="k-label">Усього витрачено</div>
              <div className="k-value">{fmtCurrency(totalOverhead, "UAH", exchangeRates)}</div>
              <div className="note" style={{ marginTop: 4 }}>{overheadTransactions.length} записів</div>
            </div>
          </div>

          <div className="note" style={{ textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Звіт по категоріях</div>
          <div className="card" style={{ padding: 16, marginBottom: 20, cursor: "default" }}>
            {byCategory.map(({ category, sum }) => (
              <div key={category} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 160, fontSize: 12 }}>{category}</div>
                <div style={{ flex: 1, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(2, (sum / maxCategorySum) * 100)}%`, height: "100%", background: "var(--accent)" }} />
                </div>
                <div className="note" style={{ marginTop: 0, minWidth: 100, textAlign: "right" }}>{fmtCurrency(sum, "UAH", exchangeRates)}</div>
              </div>
            ))}
          </div>

          <div className="note" style={{ textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Усі записи</div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Категорія</th>
                  <th>Майданчик</th>
                  <th style={{ textAlign: "right" }}>Сума</th>
                  <th>Коментар</th>
                  {canWriteFinance && <th />}
                </tr>
              </thead>
              <tbody>
                {overheadTransactions.map((t) => (
                  <tr key={t.id}>
                    <td>{new Date(t.date).toLocaleDateString("uk-UA")}</td>
                    <td className="note">{t.category || "—"}</td>
                    <td className="note">{t.siteName || "Загальні (компанія)"}</td>
                    <td style={{ textAlign: "right" }}>{fmtCurrency(t.amount, "UAH", exchangeRates)}</td>
                    <td className="note">{t.note || "—"}</td>
                    {canWriteFinance && (
                      <td><span className="icon-x" onClick={() => deleteOverhead(t.id)}>×</span></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <TransactionModal
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        onSaved={() => dealId && handleSelectDeal(dealId)}
      />
    </div>
  );
}

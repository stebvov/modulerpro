"use client";

// 🏘 Містечка: проєкт-містечко → лоти (ділянка + будинок з каталогу) → продаж → передача в УК.
import { useCallback, useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import ModTable from "@/components/ModTable";
import { fxTo, money, useRows } from "@/lib/mod";

const STATUS = [["free", "вільний"], ["reserved", "бронь"], ["sold", "продано"], ["built", "збудовано"]];
const CURS = [["USD", "$"], ["UAH", "грн"], ["EUR", "€"]];

export default function TownsScreen() {
  const { currency, exchangeRates, templates } = useAppData();
  const townFilter = useCallback((q) => q.eq("direction", "towns").neq("status", "done"), []);
  const towns = useRows("task_projects", { order: "sort", filter: townFilter });
  const [pick, setPick] = useState("");
  const town = pick || towns.rows[0]?.name || "";
  const lotFilter = useCallback((q) => q.eq("project", town || "—"), [town]);
  const lots = useRows("town_lots", { order: "sort", filter: lotFilter });
  const objects = useRows("managed_objects");
  const [msg, setMsg] = useState("");
  const [gen, setGen] = useState("");

  const cv = useCallback((n, c) => fxTo(n, c, currency, exchangeRates), [currency, exchangeRates]);
  const k = useMemo(() => {
    const L = lots.rows;
    const sum = (arr, f) => arr.reduce((a, x) => a + (cv(x[f], x.currency) || 0), 0);
    const sold = L.filter((x) => ["sold", "built"].includes(x.status));
    return {
      n: L.length, free: L.filter((x) => x.status === "free").length, res: L.filter((x) => x.status === "reserved").length, sold: sold.length,
      plan: sum(L, "price"), fact: sum(sold, "price"), margin: sum(L, "price") - sum(L, "cost"),
      inUk: L.filter((x) => objects.rows.some((o) => o.lot_id === x.id)).length,
    };
  }, [lots.rows, objects.rows, cv]);

  const tplOpts = [["", "— будинок —"], ...(templates || []).filter((t) => t.status !== "archived").map((t) => [t.id, `${t.name}${t.area_m2 ? ` · ${t.area_m2} м²` : ""}`])];
  const columns = [
    { key: "code", label: "Лот", width: 70 },
    { key: "area_sotka", label: "Сот.", type: "number", width: 60, num: true },
    { key: "house_template_id", label: "Будинок з каталогу", type: "select", options: tplOpts, width: 200 },
    { key: "house_m2", label: "м²", type: "number", width: 60, num: true },
    { key: "price", label: "Ціна лота", type: "number", width: 110, num: true },
    { key: "cost", label: "Собівартість", type: "number", width: 110, num: true },
    { key: "currency", label: "", type: "select", options: CURS, width: 60 },
    { key: "status", label: "Стан", type: "select", options: STATUS, width: 110 },
    { key: "buyer", label: "Покупець", width: 140 },
    { key: "to_uk", label: "В УК", type: "check" },
    { key: "note", label: "Примітка", width: 160 },
  ];

  async function addLot() {
    return lots.insert({ project: town, code: `Л-${lots.rows.length + 1}`, sort: lots.rows.length, currency: "USD" });
  }
  async function generate() {
    const n = Math.min(100, Math.max(1, parseInt(gen, 10) || 0));
    if (!n || !town) return;
    const start = lots.rows.length;
    const rows = Array.from({ length: n }, (_, i) => ({ project: town, code: `Л-${start + i + 1}`, sort: start + i, currency: "USD" }));
    const { error } = await lots.supabase.from("town_lots").insert(rows);
    if (error) { setMsg(error.message); return; }
    setGen(""); setMsg(`Створено лотів: ${n}. Заповніть площу, будинок, ціну й собівартість.`); lots.reload();
  }
  async function toUk() {
    const ready = lots.rows.filter((x) => (x.to_uk || ["sold", "built"].includes(x.status)) && !objects.rows.some((o) => o.lot_id === x.id));
    if (!ready.length) { setMsg("Немає проданих лотів або позначених «В УК», які ще не передані."); return; }
    const { error } = await objects.supabase.from("managed_objects").insert(ready.map((x) => ({
      name: `${town}: ${x.code}`, project: town, lot_id: x.id, location: town, owner_kind: "client", owner_name: x.buyer || null, status: "lead", rent_enabled: true,
    })));
    if (error) { setMsg(error.message); return; }
    setMsg(`Передано в УК: ${ready.length}. Далі — договір управління у розділі «УК і сервіс».`); objects.reload();
  }

  if (towns.loading) return <div className="empty">Завантаження містечок…</div>;
  if (towns.error) return <div className="empty">Помилка: {towns.error}</div>;
  if (!towns.rows.length) return <div className="empty">Проєктів-містечок ще немає. Створіть проєкт у «Напрямах» → «Містечка».</div>;

  return (
    <div>
      <p className="note">Містечко = земля → поділ на лоти → будинок з каталогу на кожен лот → продаж → передача в УК (сервіс і оренда).</p>
      <div className="toolbar">
        <div className="seg-row">
          {towns.rows.map((t) => (
            <button key={t.name} className={`seg-btn${t.name === town ? " active" : ""}`} onClick={() => setPick(t.name)}>🏘 {t.name}</button>
          ))}
        </div>
      </div>
      <div className="ops-kpi-grid">
        <div className="ops-kpi"><div className="k-label">Лотів</div><div className="k-value">{k.n}</div><div className="note">вільних {k.free} · бронь {k.res} · продано {k.sold}</div></div>
        <div className="ops-kpi"><div className="k-label">Виручка за планом</div><div className="k-value">{money(k.plan, currency)}</div></div>
        <div className="ops-kpi"><div className="k-label">Продано на суму</div><div className="k-value" style={{ color: "var(--success)" }}>{money(k.fact, currency)}</div><div className="k-bar"><div className="k-bar-fill" style={{ width: `${k.plan ? Math.min(100, (k.fact / k.plan) * 100) : 0}%` }} /></div></div>
        <div className="ops-kpi"><div className="k-label">Маржа (ціна − собівартість)</div><div className="k-value" style={{ color: k.margin < 0 ? "var(--danger)" : "var(--text)" }}>{money(k.margin, currency)}</div></div>
        <div className="ops-kpi"><div className="k-label">Передано в УК</div><div className="k-value">{k.inUk}</div></div>
      </div>
      {msg && <div className="note" style={{ background: "var(--accent-bg)", padding: "8px 12px", borderRadius: 8, marginBottom: 10 }}>{msg}</div>}
      {lots.error ? <div className="empty">Помилка: {lots.error}</div> : (
        <ModTable columns={columns} rows={lots.rows} onUpdate={lots.update} onDelete={lots.remove} onAdd={addLot} addLabel="+ Лот" empty="Лотів ще немає — згенеруйте їх нижче." />
      )}
      <div className="toolbar" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 6, alignItems: "center" }}>
          <input value={gen} onChange={(e) => setGen(e.target.value)} inputMode="numeric" placeholder="к-сть" style={{ width: 70 }} />
          <button className="btn" onClick={generate}>Згенерувати лоти</button>
        </div>
        <button className="btn primary" onClick={toUk}>🛎 Передати продані в УК</button>
      </div>
    </div>
  );
}

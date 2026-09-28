"use client";

// 🛎 УК і сервіс: будинки в управлінні (власні, клієнтські, інвесторські) і заявки на обслуговування.
import { useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import ModTable from "@/components/ModTable";
import { fxTo, money, useRows } from "@/lib/mod";

const OWNER = [["own", "власний"], ["client", "клієнт"], ["investor", "інвестор"]];
const OSTATUS = [["lead", "перемовини"], ["active", "в управлінні"], ["paused", "пауза"], ["ended", "завершено"]];
const KIND = [["cleaning", "прибирання"], ["repair", "ремонт"], ["security", "охорона"], ["checkin", "заселення"], ["utilities", "комуналка"], ["other", "інше"]];
const RSTATUS = [["new", "нова"], ["in_work", "в роботі"], ["done", "виконано"], ["cancelled", "скасовано"]];
const CURS = [["UAH", "грн"], ["USD", "$"], ["EUR", "€"]];
const UK_GOAL = 30;

export default function UkScreen() {
  const { currency, exchangeRates } = useAppData();
  const objects = useRows("managed_objects");
  const reqs = useRows("service_requests", { select: "*, tasks(num,status)" });
  const members = useRows("task_members", { order: "sort" });
  const [view, setView] = useState("objects");
  const [showDone, setShowDone] = useState(false);

  const k = useMemo(() => {
    const act = objects.rows.filter((o) => o.status === "active");
    const clientAct = act.filter((o) => o.owner_kind !== "own");
    const done = reqs.rows.filter((r) => r.status === "done");
    return {
      act: act.length, client: clientAct.length, leads: objects.rows.filter((o) => o.status === "lead").length,
      subs: act.reduce((a, o) => a + (fxTo(o.fee_month, o.currency, currency, exchangeRates) || 0), 0),
      open: reqs.rows.filter((r) => ["new", "in_work"].includes(r.status)).length,
      reqMargin: done.reduce((a, r) => a + (fxTo(r.price, r.currency, currency, exchangeRates) || 0) - (fxTo(r.cost, r.currency, currency, exchangeRates) || 0), 0),
    };
  }, [objects.rows, reqs.rows, currency, exchangeRates]);

  const people = [["", "—"], ...members.rows.filter((m) => m.active && !m.is_ai).map((m) => [m.id, m.name])];
  const objOpts = objects.rows.map((o) => [o.id, o.name]);
  const objCols = [
    { key: "name", label: "Об'єкт", width: 170 },
    { key: "status", label: "Стан", type: "select", options: OSTATUS, width: 120 },
    { key: "owner_kind", label: "Власник", type: "select", options: OWNER, width: 95 },
    { key: "owner_name", label: "Імʼя власника", width: 120 },
    { key: "fee_month", label: "Підписка/міс", type: "number", width: 90, num: true },
    { key: "currency", label: "", type: "select", options: CURS, width: 60 },
    { key: "rent_enabled", label: "Здаємо", type: "check" },
    { key: "uk_share_pct", label: "УК з оренди, %", type: "number", width: 60, num: true },
    { key: "manager_id", label: "Менеджер", type: "select", options: people, width: 120 },
    { key: "location", label: "Де", width: 110 },
    { key: "owner_contact", label: "Контакт", width: 120 },
    { key: "note", label: "Примітка", width: 150 },
  ];
  const reqCols = [
    { key: "object_id", label: "Об'єкт", type: "select", options: objOpts, width: 170 },
    { key: "title", label: "Що зробити", width: 200 },
    { key: "kind", label: "Тип", type: "select", options: KIND, width: 110 },
    { key: "status", label: "Стан", type: "select", options: RSTATUS, width: 100 },
    { key: "due", label: "Термін", type: "date", width: 130 },
    { key: "assignee_id", label: "Виконавець", type: "select", options: people, width: 120 },
    { key: "cost", label: "Витрати", type: "number", width: 90, num: true },
    { key: "price", label: "Рахунок власнику", type: "number", width: 100, num: true },
    { key: "currency", label: "", type: "select", options: CURS, width: 60 },
    { key: "note", label: "Примітка", width: 150 },
    { key: "_task", label: "Задача", render: (r) => (r.tasks?.num ? <a href={`/?s=pult-tasks#t/${r.tasks.num}`} title="Відкрити задачу в пульті">#{r.tasks.num}</a> : <span className="note">—</span>) },
  ];
  const reqRows = reqs.rows.filter((r) => showDone || !["done", "cancelled"].includes(r.status));
  const updReq = (id, patch) => reqs.update(id, patch.status ? { ...patch, done_at: patch.status === "done" ? new Date().toISOString() : null } : patch);

  if (objects.loading) return <div className="empty">Завантаження УК…</div>;
  if (objects.error) return <div className="empty">Помилка: {objects.error}</div>;

  return (
    <div>
      <p className="note">Кожна заявка автоматично стає задачею в пульті виконавцю (з Telegram). Бронювання в «Оренді» саме створює заселення й прибирання. Закрили задачу — заявка виконана. Керуюча компанія: власник не думає про будинок — оренда, прибирання, ремонт, охорона під ключ. Дохід УК = підписки + частка з оренди + маржа на заявках.</p>
      <div className="ops-kpi-grid">
        <div className="ops-kpi"><div className="k-label">В управлінні</div><div className="k-value">{k.act}</div><div className="note">клієнтських {k.client} · у перемовинах {k.leads}</div></div>
        <div className="ops-kpi"><div className="k-label">Ціль Avatar: +{UK_GOAL} будинків</div><div className="k-value">{k.client} / {UK_GOAL}</div><div className="k-bar"><div className="k-bar-fill" style={{ width: `${Math.min(100, (k.client / UK_GOAL) * 100)}%` }} /></div></div>
        <div className="ops-kpi"><div className="k-label">Підписки на місяць</div><div className="k-value" style={{ color: "var(--success)" }}>{money(k.subs, currency)}</div></div>
        <div className="ops-kpi"><div className="k-label">Відкриті заявки</div><div className="k-value" style={{ color: k.open ? "var(--amber)" : "var(--text)" }}>{k.open}</div></div>
        <div className="ops-kpi"><div className="k-label">Маржа на заявках</div><div className="k-value">{money(k.reqMargin, currency)}</div></div>
      </div>
      <div className="toolbar">
        <div className="seg-row">
          <button className={`seg-btn${view === "objects" ? " active" : ""}`} onClick={() => setView("objects")}>🏠 Об&apos;єкти ({objects.rows.length})</button>
          <button className={`seg-btn${view === "reqs" ? " active" : ""}`} onClick={() => setView("reqs")}>🧰 Заявки ({k.open})</button>
        </div>
        {view === "reqs" && (
          <label className="note" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> показати виконані
          </label>
        )}
      </div>
      {view === "objects" ? (
        <ModTable columns={objCols} rows={objects.rows} onUpdate={objects.update} onDelete={objects.remove}
          onAdd={() => objects.insert({ name: `Будинок ${objects.rows.length + 1}`, status: "lead", owner_kind: "client" })} addLabel="+ Об'єкт" />
      ) : (
        <ModTable columns={reqCols} rows={reqRows} onUpdate={updReq} onDelete={reqs.remove}
          onAdd={async () => { if (!objects.rows[0]) return "Спершу додайте об'єкт"; const e = await reqs.insert({ object_id: objects.rows[0].id, title: "Нова заявка" }); await reqs.reload(); return e; }}
          addLabel="+ Заявка" empty="Відкритих заявок немає." />
      )}
    </div>
  );
}

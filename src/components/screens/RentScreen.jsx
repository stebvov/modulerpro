"use client";

// 🔑 Оренда і дохід: бронювання будинків в управлінні → завантаженість → дохід власника і УК (пасивний дохід).
import { useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import ModTable from "@/components/ModTable";
import { fxTo, money, nights, todayKyiv, useRows } from "@/lib/mod";

const BSTATUS = [["booked", "бронь"], ["paid", "оплачено"], ["cancelled", "скасовано"]];
const CHANNEL = [["", "—"], ["direct", "напряму"], ["booking", "Booking"], ["airbnb", "Airbnb"], ["instagram", "Instagram"], ["olx", "OLX"], ["partner", "партнер"]];
const CURS = [["UAH", "грн"], ["USD", "$"], ["EUR", "€"]];

// ночі бронювання, що припадають на місяць [m0, m1)
function nightsIn(b, m0, m1) {
  const a = b.date_from > m0 ? b.date_from : m0;
  const z = b.date_to < m1 ? b.date_to : m1;
  return a < z ? nights(a, z) : 0;
}

export default function RentScreen() {
  const { currency, exchangeRates } = useAppData();
  const objects = useRows("managed_objects");
  const books = useRows("rent_bookings", { order: "date_from", ascending: false });
  const [month, setMonth] = useState(() => todayKyiv().slice(0, 7));
  const [obj, setObj] = useState("");

  const m0 = `${month}-01`;
  const m1 = (() => { const [y, m] = month.split("-").map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`; })();
  const days = nights(m0, m1);
  const rentObjs = objects.rows.filter((o) => o.rent_enabled && o.status === "active");

  const stat = useMemo(() => {
    const byObj = {};
    for (const b of books.rows) {
      if (b.status === "cancelled") continue;
      const n = nightsIn(b, m0, m1);
      if (!n) continue;
      const total = nights(b.date_from, b.date_to) || 1;
      const inc = (fxTo(b.amount, b.currency, currency, exchangeRates) || 0) * (n / total);
      const o = objects.rows.find((x) => x.id === b.object_id);
      const uk = inc * (Number(o?.uk_share_pct) || 0) / 100;
      const s = (byObj[b.object_id] ??= { nights: 0, inc: 0, uk: 0, own: o?.owner_kind === "own" });
      s.nights += n; s.inc += inc; s.uk += uk;
    }
    const all = Object.values(byObj);
    const sum = (f) => all.reduce((a, x) => a + x[f], 0);
    const occ = rentObjs.length ? sum("nights") / (rentObjs.length * days) * 100 : 0;
    const ownerOwn = all.filter((x) => x.own).reduce((a, x) => a + x.inc - x.uk, 0);
    return { byObj, nights: sum("nights"), inc: sum("inc"), uk: sum("uk"), owners: sum("inc") - sum("uk"), occ, ownerOwn };
  }, [books.rows, objects.rows, m0, m1, days, rentObjs.length, currency, exchangeRates]);

  const objOpts = objects.rows.map((o) => [o.id, o.name]);
  const cols = [
    { key: "object_id", label: "Об'єкт", type: "select", options: objOpts, width: 170 },
    { key: "date_from", label: "Заїзд", type: "date", width: 130 },
    { key: "date_to", label: "Виїзд", type: "date", width: 130 },
    { key: "_n", label: "Ночей", num: true, render: (b) => <span>{nights(b.date_from, b.date_to)}</span> },
    { key: "guest", label: "Гість", width: 130 },
    { key: "contact", label: "Контакт", width: 120 },
    { key: "amount", label: "Сума", type: "number", width: 100, num: true },
    { key: "currency", label: "", type: "select", options: CURS, width: 60 },
    { key: "channel", label: "Канал", type: "select", options: CHANNEL, width: 110 },
    { key: "status", label: "Стан", type: "select", options: BSTATUS, width: 110 },
    { key: "note", label: "Примітка", width: 140 },
  ];
  const rows = books.rows.filter((b) => (!obj || b.object_id === obj) && b.date_to > m0 && b.date_from < m1);

  async function addBooking() {
    const o = obj || rentObjs[0]?.id || objects.rows[0]?.id;
    if (!o) return "Спершу додайте об'єкт у «УК і сервіс»";
    const d0 = todayKyiv() >= m0 && todayKyiv() < m1 ? todayKyiv() : m0;
    const d1 = new Date(new Date(d0 + "T12:00:00Z").getTime() + 2 * 864e5).toISOString().slice(0, 10);
    return books.insert({ object_id: o, date_from: d0, date_to: d1, amount: 0, currency: "UAH" });
  }
  function upd(id, patch) {
    const b = books.rows.find((x) => x.id === id);
    const next = { ...b, ...patch };
    if (next.date_to <= next.date_from) return Promise.resolve("Виїзд має бути пізніше заїзду");
    return books.update(id, patch);
  }

  if (objects.loading || books.loading) return <div className="empty">Завантаження оренди…</div>;
  if (books.error) return <div className="empty">Помилка: {books.error}</div>;

  return (
    <div>
      <p className="note">Пасивний дохід: будинок в управлінні УК → бронювання → дохід власнику, частка УК. Суми рахуються за ночами, що припадають на обраний місяць.</p>
      <div className="toolbar" style={{ gap: 8, flexWrap: "wrap" }}>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value || month)} style={{ width: 160 }} />
        <select value={obj} onChange={(e) => setObj(e.target.value)} style={{ width: 240 }}>
          <option value="">Усі об&apos;єкти</option>
          {objOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="ops-kpi-grid">
        <div className="ops-kpi"><div className="k-label">Завантаженість</div><div className="k-value">{Math.round(stat.occ)}%</div><div className="k-bar"><div className="k-bar-fill" style={{ width: `${Math.min(100, stat.occ)}%` }} /></div><div className="note">{stat.nights} ночей · {rentObjs.length} будинків здаються</div></div>
        <div className="ops-kpi"><div className="k-label">Дохід з оренди</div><div className="k-value">{money(stat.inc, currency)}</div></div>
        <div className="ops-kpi"><div className="k-label">УК отримує</div><div className="k-value" style={{ color: "var(--success)" }}>{money(stat.uk, currency)}</div></div>
        <div className="ops-kpi"><div className="k-label">Власникам</div><div className="k-value">{money(stat.owners, currency)}</div></div>
        <div className="ops-kpi"><div className="k-label">💎 Мій пасивний дохід</div><div className="k-value" style={{ color: "var(--success)" }}>{money(stat.ownerOwn, currency)}</div><div className="note">з власних будинків</div></div>
      </div>
      <ModTable columns={cols} rows={rows} onUpdate={upd} onDelete={books.remove} onAdd={addBooking} addLabel="+ Бронювання" empty="Бронювань у цьому місяці немає." />
      {rentObjs.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: "20px 0 8px" }}>По будинках за місяць</h3>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Об&apos;єкт</th><th>Власник</th><th style={{ textAlign: "right" }}>Ночей</th><th style={{ textAlign: "right" }}>Завантаженість</th><th style={{ textAlign: "right" }}>Дохід</th><th style={{ textAlign: "right" }}>УК</th><th style={{ textAlign: "right" }}>Власнику</th></tr></thead>
              <tbody>
                {rentObjs.map((o) => {
                  const s = stat.byObj[o.id] || { nights: 0, inc: 0, uk: 0 };
                  return (
                    <tr key={o.id}>
                      <td>{o.name}</td><td>{o.owner_kind === "own" ? "власний" : o.owner_name || "—"}</td>
                      <td style={{ textAlign: "right" }}>{s.nights}</td><td style={{ textAlign: "right" }}>{Math.round((s.nights / days) * 100)}%</td>
                      <td style={{ textAlign: "right" }}>{money(s.inc, currency)}</td><td style={{ textAlign: "right" }}>{money(s.uk, currency)}</td><td style={{ textAlign: "right" }}>{money(s.inc - s.uk, currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

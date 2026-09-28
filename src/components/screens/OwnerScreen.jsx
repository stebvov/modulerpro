"use client";

// 🔑 Кабінет власника юніта: завантаженість, ціна ночі, його частка, виплати, швидкість заробітку,
// дохідність (% річних), окупність і точка беззбитковості. Власник бачить лише свої юніти (owner_cabinet).
// Персонал УК бачить усіх і вносить інвестицію, email власника та виплати.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { createClient } from "@/lib/supabase/client";
import { fxTo, money, nights, todayKyiv, toNum } from "@/lib/mod";

const ym = (d) => d.slice(0, 7);
const addMonths = (m, k) => { const [y, mo] = m.split("-").map(Number); const t = new Date(Date.UTC(y, mo - 1 + k, 1)); return t.toISOString().slice(0, 7); };
const monthLabel = (m) => new Date(m + "-01T12:00:00Z").toLocaleDateString("uk-UA", { month: "short", year: "2-digit" });

function Chart({ points, invest, cur }) {
  // накопичений дохід власника по місяцях + лінія інвестиції (точка беззбитковості — перетин)
  if (points.length < 2) return <div className="note">Графік зʼявиться після двох місяців з доходом.</div>;
  const W = 720, H = 220, P = 34;
  const maxY = Math.max(invest || 0, ...points.map((p) => p.cum)) * 1.08 || 1;
  const x = (i) => P + (i * (W - P * 2)) / (points.length - 1);
  const y = (v) => H - P + 6 - (v / maxY) * (H - P * 1.6);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.cum).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Накопичений дохід власника">
      <path d={area} fill="var(--accent-bg)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      {invest > 0 && <>
        <line x1={P} x2={W - P} y1={y(invest)} y2={y(invest)} stroke="var(--danger)" strokeDasharray="5 4" />
        <text x={W - P} y={y(invest) - 6} textAnchor="end" fontSize="11" fill="var(--danger)">інвестиція {money(invest, cur)}</text>
      </>}
      {points.map((p, i) => (i % Math.ceil(points.length / 8) === 0 || i === points.length - 1) && (
        <text key={p.m} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="var(--text-muted)">{monthLabel(p.m)}</text>
      ))}
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].cum)} r="4" fill="var(--accent)" />
      <text x={x(points.length - 1) - 6} y={y(points[points.length - 1].cum) - 8} textAnchor="end" fontSize="11.5" fontWeight="600" fill="var(--accent)">{money(points[points.length - 1].cum, cur)}</text>
    </svg>
  );
}

export default function OwnerScreen() {
  const supabase = useMemo(() => createClient(), []);
  const { currency, exchangeRates } = useAppData();
  const [data, setData] = useState(null);
  const [objId, setObjId] = useState("");
  const [err, setErr] = useState("");
  const [pay, setPay] = useState({ amount: "", currency: "UAH", paid_at: todayKyiv(), period: "", note: "" });

  const load = useCallback(async () => {
    const { data: d, error } = await supabase.rpc("owner_cabinet");
    if (error) setErr(error.message); else setData(d);
  }, [supabase]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const cv = useCallback((n, c) => fxTo(n, c, currency, exchangeRates) || 0, [currency, exchangeRates]);
  const obj = data?.objects?.find((o) => o.id === objId) || data?.objects?.[0];

  const k = useMemo(() => {
    if (!obj) return null;
    const today = todayKyiv(), share = 1 - (Number(obj.uk_share_pct) || 0) / 100;
    const bks = data.bookings.filter((b) => b.object_id === obj.id);
    const pays = data.payouts.filter((p) => p.object_id === obj.id);
    const byMonth = {};
    let nightsAll = 0, grossAll = 0, earned = 0, upcoming = 0;
    for (const b of bks) {
      const n = nights(b.date_from, b.date_to), g = cv(b.amount, b.currency), own = g * share, m = ym(b.date_from);
      const row = (byMonth[m] ??= { m, nights: 0, gross: 0, own: 0 });
      row.nights += n; row.gross += g; row.own += own; nightsAll += n; grossAll += g;
      if (b.date_to <= today) earned += own; else upcoming += own;
    }
    const paid = pays.reduce((a, p) => a + cv(p.amount, p.currency), 0);
    const invest = cv(obj.invest_amount, obj.invest_currency);
    const cm = ym(today), start12 = addMonths(cm, -11);
    const last12 = Object.values(byMonth).filter((r) => r.m >= start12 && r.m <= cm);
    const annual = last12.reduce((a, r) => a + r.own, 0);
    const nights12 = last12.reduce((a, r) => a + r.nights, 0);
    // середнє за всі місяці володіння в межах року (не лише місяці з бронюваннями)
    const firstM = obj.purchased_at ? ym(obj.purchased_at) : Object.keys(byMonth).sort()[0] || cm;
    const startM = firstM > start12 ? firstM : start12;
    const [sy, sm] = startM.split("-").map(Number), [cy, cmo] = cm.split("-").map(Number);
    const monthsActive = Math.max(1, Math.min(12, (cy - sy) * 12 + (cmo - sm) + 1));
    const annualized = last12.length ? (annual / monthsActive) * 12 : 0;
    const yieldPct = invest > 0 && annualized ? (annualized / invest) * 100 : null;
    const paybackYears = invest > 0 && annualized ? invest / annualized : null;
    const cur = byMonth[cm] || { nights: 0 };
    const daysInMonth = nights(`${cm}-01`, `${addMonths(cm, 1)}-01`);
    // накопичений дохід по місяцях від першого місяця (або дати покупки)
    const first = obj.purchased_at ? ym(obj.purchased_at) : Object.keys(byMonth).sort()[0];
    const points = [];
    if (first) { let m = first, cum = 0, guard = 0; while (m <= cm && guard++ < 240) { cum += byMonth[m]?.own || 0; points.push({ m, cum }); m = addMonths(m, 1); } }
    const cumNow = points.length ? points[points.length - 1].cum : 0;
    let breakEven = null;
    if (invest > 0 && cumNow >= invest) breakEven = "досягнуто";
    else if (invest > 0 && annualized > 0) { const monthsLeft = Math.ceil(((invest - cumNow) / annualized) * 12); breakEven = monthLabel(addMonths(cm, monthsLeft)); }
    return {
      bks, pays, months: Object.values(byMonth).sort((a, b) => b.m.localeCompare(a.m)), earned, upcoming, paid, balance: earned - paid, invest,
      occNow: daysInMonth ? (cur.nights / daysInMonth) * 100 : 0, occ12: (nights12 / 365) * 100,
      avgNight: nightsAll ? grossAll / nightsAll : cv(obj.night_price, "UAH"), annualized, yieldPct, paybackYears, breakEven, points, cumNow,
      covered: invest > 0 ? Math.min(100, (cumNow / invest) * 100) : null,
    };
  }, [obj, data, cv]);

  async function updObj(patch) {
    const { error } = await supabase.from("managed_objects").update(patch).eq("id", obj.id);
    setErr(error ? error.message : ""); load();
  }
  async function addPayout() {
    const a = toNum(pay.amount);
    if (!a) { setErr("Вкажіть суму виплати"); return; }
    const { error } = await supabase.from("owner_payouts").insert({ object_id: obj.id, amount: a, currency: pay.currency, paid_at: pay.paid_at, period: pay.period || null, note: pay.note || null });
    if (error) { setErr(error.message); return; }
    setPay({ ...pay, amount: "", note: "" }); setErr(""); load();
  }
  async function delPayout(id) {
    const { error } = await supabase.from("owner_payouts").delete().eq("id", id);
    setErr(error ? error.message : ""); load();
  }

  if (err && !data) return <div className="empty">Помилка: {err}</div>;
  if (!data) return <div className="empty">Завантаження кабінету…</div>;
  if (!data.objects.length) return <div className="empty">{data.staff ? "Об'єктів ще немає — додайте їх в «Об'єкти й заявки»." : "За вашим email ще не закріплено жодного юніта. Зверніться до керуючої компанії."}</div>;

  const staff = data.staff;
  return (
    <div>
      <p className="note">{staff ? "Так власник бачить свій юніт. Внесіть інвестицію, дату покупки й email власника — і він зможе увійти й бачити цей кабінет. Виплати — внизу." : "Ваш юніт в управлінні: завантаженість, дохід, ваша частка й виплати."}</p>
      <div className="toolbar" style={{ gap: 8, flexWrap: "wrap" }}>
        <select value={obj.id} onChange={(e) => setObjId(e.target.value)} style={{ minWidth: 260 }} aria-label="Юніт">
          {data.objects.map((o) => <option key={o.id} value={o.id}>{o.name}{staff && o.owner_name ? ` · ${o.owner_name}` : ""}</option>)}
        </select>
      </div>
      {err && <div className="auth-error">{err}</div>}

      <div className="ops-kpi-grid">
        <div className="ops-kpi"><div className="k-label">Завантаженість</div><div className="k-value">{Math.round(k.occNow)}%</div><div className="note">цей місяць · за рік {Math.round(k.occ12)}%</div></div>
        <div className="ops-kpi"><div className="k-label">Середня ціна ночі</div><div className="k-value">{money(k.avgNight, currency)}</div><div className="note">ваша частка {100 - (Number(obj.uk_share_pct) || 0)}%</div></div>
        <div className="ops-kpi"><div className="k-label">Зароблено вами</div><div className="k-value" style={{ color: "var(--success)" }}>{money(k.earned, currency)}</div><div className="note">ще заброньовано {money(k.upcoming, currency)}</div></div>
        <div className="ops-kpi"><div className="k-label">Виплачено / до виплати</div><div className="k-value">{money(k.paid, currency)}</div><div className="note" style={{ color: k.balance > 0 ? "var(--amber)" : undefined }}>до виплати {money(Math.max(0, k.balance), currency)}</div></div>
      </div>
      <div className="ops-kpi-grid">
        <div className="ops-kpi"><div className="k-label">Дохідність</div><div className="k-value">{k.yieldPct != null ? `${k.yieldPct.toFixed(1)}%` : "—"}</div><div className="note">річних від інвестиції</div></div>
        <div className="ops-kpi"><div className="k-label">Швидкість заробітку</div><div className="k-value">{money(k.annualized / 12, currency)}</div><div className="note">на місяць (середнє за рік)</div></div>
        <div className="ops-kpi"><div className="k-label">Окупність</div><div className="k-value">{k.paybackYears != null ? `${k.paybackYears.toFixed(1)} р.` : "—"}</div><div className="note">{k.covered != null ? `окуплено ${k.covered.toFixed(0)}%` : "внесіть суму інвестиції"}</div><div className="k-bar"><div className="k-bar-fill" style={{ width: `${k.covered || 0}%` }} /></div></div>
        <div className="ops-kpi"><div className="k-label">Точка беззбитковості</div><div className="k-value" style={{ color: k.breakEven === "досягнуто" ? "var(--success)" : undefined }}>{k.breakEven || "—"}</div><div className="note">коли дохід = інвестиції</div></div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 14, cursor: "default" }}>
        <div className="section-label" style={{ marginBottom: 8 }}>Накопичений дохід власника</div>
        <Chart points={k.points} invest={k.invest} cur={currency} />
      </div>

      {staff && (
        <div className="card" style={{ padding: 14, marginBottom: 14, cursor: "default" }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Дані для власника (заповнює УК)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label className="note" style={{ marginTop: 0 }}>Інвестиція <input key={"ia" + obj.id} defaultValue={obj.invest_amount ?? ""} inputMode="decimal" style={{ width: 120 }} onBlur={(e) => updObj({ invest_amount: toNum(e.target.value) })} /></label>
            <select value={obj.invest_currency || "USD"} onChange={(e) => updObj({ invest_currency: e.target.value })} aria-label="Валюта інвестиції"><option value="USD">$</option><option value="UAH">грн</option><option value="EUR">€</option></select>
            <label className="note" style={{ marginTop: 0 }}>Куплено <input type="date" key={"pa" + obj.id} defaultValue={obj.purchased_at || ""} onBlur={(e) => updObj({ purchased_at: e.target.value || null })} /></label>
            <label className="note" style={{ marginTop: 0 }}>Email власника (для входу) <input key={"oe" + obj.id} defaultValue={data.objects.find((o) => o.id === obj.id)?.owner_email || ""} placeholder="owner@mail.com" style={{ width: 220 }} onBlur={(e) => updObj({ owner_email: e.target.value.trim().toLowerCase() || null })} /></label>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>По місяцях</div>
          <div className="table-scroll"><table>
            <thead><tr><th>Місяць</th><th style={{ textAlign: "right" }}>Ночей</th><th style={{ textAlign: "right" }}>Дохід</th><th style={{ textAlign: "right" }}>Вам</th></tr></thead>
            <tbody>{k.months.map((r) => <tr key={r.m}><td>{monthLabel(r.m)}</td><td style={{ textAlign: "right" }}>{r.nights}</td><td style={{ textAlign: "right" }}>{money(r.gross, currency)}</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(r.own, currency)}</td></tr>)}
              {!k.months.length && <tr><td colSpan={4} className="note" style={{ textAlign: "center" }}>Бронювань ще немає</td></tr>}</tbody>
          </table></div>
        </div>
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>Історія виплат</div>
          <div className="table-scroll"><table>
            <thead><tr><th>Дата</th><th>Період</th><th style={{ textAlign: "right" }}>Сума</th>{staff && <th />}</tr></thead>
            <tbody>{k.pays.slice().reverse().map((p) => <tr key={p.id}><td>{new Date(p.paid_at + "T12:00:00Z").toLocaleDateString("uk-UA")}</td><td>{p.period || p.note || "—"}</td><td style={{ textAlign: "right", fontWeight: 600 }}>{money(p.amount, p.currency)}</td>{staff && <td><button className="btn small" onClick={() => delPayout(p.id)} aria-label="Видалити виплату">×</button></td>}</tr>)}
              {!k.pays.length && <tr><td colSpan={staff ? 4 : 3} className="note" style={{ textAlign: "center" }}>Виплат ще не було</td></tr>}</tbody>
          </table></div>
          {staff && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              <input type="date" value={pay.paid_at} onChange={(e) => setPay({ ...pay, paid_at: e.target.value })} aria-label="Дата виплати" />
              <input value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} inputMode="decimal" placeholder="Сума" style={{ width: 110 }} />
              <select value={pay.currency} onChange={(e) => setPay({ ...pay, currency: e.target.value })} aria-label="Валюта"><option value="UAH">грн</option><option value="USD">$</option><option value="EUR">€</option></select>
              <input value={pay.period} onChange={(e) => setPay({ ...pay, period: e.target.value })} placeholder="Період: вересень 2026" style={{ width: 170 }} />
              <button className="btn primary" onClick={addPayout}>+ Виплата</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

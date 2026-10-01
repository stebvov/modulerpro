"use client";

// 🏡 Облік оренди (будинки МОХО): бронювання без накладок, гості, витрати, тарифи й акції, показники по місяцях.
// Дані — окремий модуль бази (схема rental, доступ через public.rental_*). Ціну за тарифом і акцією рахує база (rental_quote),
// вона ж не дає забронювати будинок двічі на ті самі дати й веде журнал змін.
import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import ModTable from "@/components/ModTable";
import SearchFilter from "@/components/SearchFilter";
import { money, nights, todayKyiv, useRows } from "@/lib/mod";

const STATUS = [["inquiry", "запит"], ["booked", "бронь"], ["checked_in", "заїхали"], ["checked_out", "виїхали"], ["cancelled", "скасовано"], ["blocked", "закрито (не здається)"]];
const SOURCE = [["instagram", "Instagram"], ["word_of_mouth", "сарафанне радіо"], ["direct", "напряму"], ["booking_com", "Booking.com"], ["airbnb", "Airbnb"], ["repeat", "повторний гість"], ["operator", "оператор"], ["other", "інше"]];
const PAY = [["unpaid", "не оплачено"], ["prepaid", "передоплата"], ["paid", "оплачено"], ["refunded", "повернено"]];
const ALLOC = [["direct", "на цей будинок"], ["equal", "порівну на всі"], ["by_nights", "за проданими ночами"]];
const PROMO_KIND = [["nights_free", "ночі в подарунок"], ["percent", "знижка %"]];
const TABS = [["months", "📊 Місяці"], ["bookings", "📅 Бронювання"], ["guests", "👤 Гості"], ["expenses", "💸 Витрати"], ["rates", "🏷 Тарифи й акції"]];

const uah = (n) => money(Number(n) || 0, "UAH");
const num = (v) => Number(v) || 0;
const monthName = (m) => new Date(m + "T12:00:00Z").toLocaleDateString("uk-UA", { month: "long", year: "numeric", timeZone: "UTC" });
// зрозуміле повідомлення замість технічного
function friendly(m) {
  if (!m) return m;
  if (/exclu|conflicting key|23P01/i.test(m)) return "Цей будинок уже зайнятий на ці дати — оберіть інші дати або інший будинок.";
  if (/foreign key|23503/i.test(m)) return "Є пов'язані записи (бронювання) — спершу приберіть їх.";
  if (/date_to|check constraint/i.test(m)) return "Перевірте дати: виїзд має бути пізніше заїзду.";
  return m;
}

export default function RentalScreen() {
  const { profile, user, role } = useAuth();
  const who = profile?.full_name || user?.email || "crm";
  const houses = useRows("rental_houses", { order: "sort_order" });
  const guests = useRows("rental_guests", { order: "full_name" });
  const books = useRows("rental_bookings", { order: "date_from", ascending: false });
  const exps = useRows("rental_expenses", { order: "expense_date", ascending: false });
  const rates = useRows("rental_rate_periods", { order: "date_from" });
  const promos = useRows("rental_promos", { order: "created_at" });
  const monthly = useRows("rental_monthly", { order: "month" });

  const [tab, setTab] = useState("months");
  const [month, setMonth] = useState(() => todayKyiv().slice(0, 7));
  const [allMonths, setAllMonths] = useState(false);
  const [house, setHouse] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [newGuest, setNewGuest] = useState({ full_name: "", phone: "" });
  const [msg, setMsg] = useState("");
  const [sure, setSure] = useState(false);

  const m0 = `${month}-01`;
  const m1 = (() => { const [y, m] = month.split("-").map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`; })();
  const houseOpts = houses.rows.map((h) => [h.id, h.name]);
  const houseName = (id) => houses.rows.find((h) => h.id === id)?.name || "—";
  const guestOf = (id) => guests.rows.find((g) => g.id === id);

  // показники: по будинках за обраний місяць і по місяцях загалом
  const stat = useMemo(() => {
    const expIn = (a, z, hid) => exps.rows.filter((e) => e.expense_date >= a && e.expense_date < z && (!hid || e.house_id === hid)).reduce((s, e) => s + num(e.amount), 0);
    const cur = monthly.rows.filter((r) => r.month === m0);
    const sum = (rows, f) => rows.reduce((s, r) => s + num(r[f]), 0);
    const avail = sum(cur, "available_nights"), sold = sum(cur, "sold_nights"), rev = sum(cur, "revenue");
    const byMonth = {};
    for (const r of monthly.rows) { const x = (byMonth[r.month] ??= { month: r.month, avail: 0, sold: 0, rev: 0 }); x.avail += num(r.available_nights); x.sold += num(r.sold_nights); x.rev += num(r.revenue); }
    const thisMonth = `${todayKyiv().slice(0, 7)}-01`;
    const months = Object.values(byMonth).filter((x) => x.sold > 0 || x.month <= thisMonth).sort((a, b) => (a.month < b.month ? 1 : -1)).map((x) => {
      const [y, m] = x.month.split("-").map(Number);
      const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      return { ...x, exp: expIn(x.month, next) };
    });
    return { cur, avail, sold, rev, exp: expIn(m0, m1), expOf: (hid) => expIn(m0, m1, hid), months };
  }, [monthly.rows, exps.rows, m0, m1]);

  const demo = books.rows.filter((b) => b.created_by === "demo").length + exps.rows.filter((e) => e.created_by === "demo").length + guests.rows.filter((g) => g.note === "ДЕМО").length;

  async function quote(b) {
    const { data, error } = await books.supabase.rpc("rental_quote", { p_house: b.house_id, p_from: b.date_from, p_to: b.date_to, p_promo: b.promo_id || null });
    return error ? null : data;
  }
  // після зміни будинку, дат чи акції — перерахувати «за тарифом»; суму підміняємо, лише якщо її не правили вручну
  async function requote(b) {
    const v = await quote(b);
    if (v == null) return;
    const patch = { quoted_amount: v };
    if (!num(b.amount_total) || num(b.amount_total) === num(b.quoted_amount)) patch.amount_total = v;
    return books.update(b.id, patch);
  }
  async function updBooking(id, patch) {
    const b = books.rows.find((x) => x.id === id);
    const next = { ...b, ...patch };
    if (next.date_to <= next.date_from) return "Виїзд має бути пізніше заїзду";
    const e = await books.update(id, patch);
    if (e) return friendly(e);
    if ("house_id" in patch || "date_from" in patch || "date_to" in patch || "promo_id" in patch) await requote(next);
    monthly.reload();
    return null;
  }
  async function addBooking() {
    const h = house || houses.rows.find((x) => x.is_active)?.id || houses.rows[0]?.id;
    if (!h) return "Немає жодного будинку";
    const t = todayKyiv();
    const d0 = !allMonths && !(t >= m0 && t < m1) ? m0 : t;
    const d1 = new Date(new Date(d0 + "T12:00:00Z").getTime() + 2 * 864e5).toISOString().slice(0, 10);
    const v = await quote({ house_id: h, date_from: d0, date_to: d1 });
    const e = await books.insert({ house_id: h, date_from: d0, date_to: d1, quoted_amount: v, amount_total: v || 0, created_by: who });
    if (!e) monthly.reload();
    return friendly(e);
  }
  async function addGuest() {
    if (!newGuest.full_name.trim()) { setMsg("Вкажіть ім'я гостя"); return; }
    const e = await guests.insert({ full_name: newGuest.full_name.trim(), phone: newGuest.phone.trim() || null });
    setMsg(e ? friendly(e) : `Гостя «${newGuest.full_name.trim()}» додано — оберіть його в бронюванні.`);
    if (!e) setNewGuest({ full_name: "", phone: "" });
  }
  async function clearDemo() {
    if (!sure) { setSure(true); setTimeout(() => setSure(false), 5000); return; }
    const sb = books.supabase;
    const r1 = await sb.from("rental_bookings").delete().eq("created_by", "demo");
    const r2 = await sb.from("rental_expenses").delete().eq("created_by", "demo");
    const r3 = await sb.from("rental_guests").delete().eq("note", "ДЕМО");
    const err = r1.error || r2.error || r3.error;
    setMsg(err ? friendly(err.message) : "Демо-дані прибрано. Будинки, тарифи й акція лишились.");
    setSure(false);
    books.reload(); exps.reload(); guests.reload(); monthly.reload();
  }

  const loading = houses.loading || books.loading || guests.loading || exps.loading || monthly.loading;
  const error = houses.error || books.error || guests.error || exps.error || monthly.error;
  if (loading) return <div className="empty">Завантаження обліку оренди…</div>;
  if (error) return <div className="empty">Помилка: {error}</div>;

  const s = q.trim().toLowerCase();
  const guestOpts = [["", "— гість —"], ...guests.rows.map((g) => [g.id, g.phone ? `${g.full_name} · ${g.phone}` : g.full_name])];
  const promoOpts = [["", "—"], ...promos.rows.map((p) => [p.id, p.name])];

  const bookRows = books.rows.filter((b) => {
    if (house && b.house_id !== house) return false;
    if (status && b.status !== status) return false;
    if (!allMonths && !(b.date_to > m0 && b.date_from < m1)) return false;
    if (!s) return true;
    const g = guestOf(b.guest_id);
    return [g?.full_name, g?.phone, b.note, houseName(b.house_id)].join(" ").toLowerCase().includes(s);
  });
  const bookCols = [
    { key: "house_id", label: "Будинок", type: "select", options: houseOpts, width: 110 },
    { key: "guest_id", label: "Гість", type: "select", options: guestOpts, width: 170 },
    { key: "date_from", label: "Заїзд", type: "date", width: 128 },
    { key: "date_to", label: "Виїзд", type: "date", width: 128 },
    { key: "_n", label: "Ночей", num: true, render: (b) => <span>{nights(b.date_from, b.date_to)}</span> },
    { key: "status", label: "Стан", type: "select", options: STATUS, width: 120 },
    { key: "guests_count", label: "Гостей", type: "number", width: 56, num: true },
    { key: "promo_id", label: "Акція", type: "select", options: promoOpts, width: 120 },
    { key: "quoted_amount", label: "За тарифом", num: true, render: (b) => (
      <span title="Тариф × ночі − акція. Рахує база.">{b.quoted_amount != null ? uah(b.quoted_amount) : "—"}{" "}
        <button type="button" className="btn small" style={{ minHeight: 22, padding: "0 6px" }} title="Перерахувати за тарифом" onClick={() => requote(b).then(() => monthly.reload())}>↻</button>
      </span>) },
    { key: "amount_total", label: "Сума, грн", type: "number", width: 92, num: true },
    { key: "prepayment", label: "Передоплата", type: "number", width: 92, num: true },
    { key: "payment_status", label: "Оплата", type: "select", options: PAY, width: 120 },
    { key: "source", label: "Звідки", type: "select", options: SOURCE, width: 130 },
    { key: "note", label: "Примітка", width: 150 },
  ];

  const guestRows = guests.rows.filter((g) => !s || [g.full_name, g.phone, g.email, g.note].join(" ").toLowerCase().includes(s));
  const guestCols = [
    { key: "full_name", label: "Ім'я", width: 190 },
    { key: "phone", label: "Телефон", width: 140 },
    { key: "email", label: "Email", width: 170 },
    { key: "_b", label: "Бронювань", num: true, render: (g) => { const l = books.rows.filter((b) => b.guest_id === g.id && b.status !== "cancelled"); return <span title={l.length ? `останнє: ${l[0].date_from}` : ""}>{l.length || "—"}</span>; } },
    { key: "_sum", label: "Приніс, грн", num: true, render: (g) => <span>{uah(books.rows.filter((b) => b.guest_id === g.id && b.status !== "cancelled").reduce((a, b) => a + num(b.amount_total), 0))}</span> },
    { key: "note", label: "Примітка", width: 220 },
  ];

  const expRows = exps.rows.filter((e) => (!house || e.house_id === house) && (allMonths || (e.expense_date >= m0 && e.expense_date < m1)) && (!s || [e.category, e.note].join(" ").toLowerCase().includes(s)));
  const expCols = [
    { key: "expense_date", label: "Дата", type: "date", width: 128 },
    { key: "house_id", label: "Будинок", type: "select", options: [["", "— усі будинки —"], ...houseOpts], width: 150 },
    { key: "category", label: "Категорія", width: 170 },
    { key: "amount", label: "Сума, грн", type: "number", width: 100, num: true },
    { key: "allocation", label: "Як ділити", type: "select", options: ALLOC, width: 170 },
    { key: "note", label: "Примітка", width: 220 },
  ];

  const filters = (
    <SearchFilter value={q} onChange={setQ} placeholder={tab === "guests" ? "Пошук гостя: ім'я, телефон…" : tab === "expenses" ? "Пошук: категорія, примітка…" : "Пошук: гість, телефон, примітка…"}
      active={[house, tab === "bookings" && status].filter(Boolean).length} onReset={() => { setHouse(""); setStatus(""); }}>
      {tab !== "guests" && (
        <select value={house} onChange={(e) => setHouse(e.target.value)} aria-label="Будинок"><option value="">Усі будинки</option>{houseOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      )}
      {tab === "bookings" && (
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Стан"><option value="">Усі стани</option>{STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      )}
    </SearchFilter>
  );
  // місяць — головний перемикач списку, тому на видноті поруч із пошуком
  const monthPick = (
    <>
      <input type="month" value={month} disabled={allMonths} onChange={(e) => setMonth(e.target.value || month)} style={{ width: 150 }} aria-label="Місяць" />
      <label className="note" style={{ display: "flex", alignItems: "center", gap: 5, margin: 0, whiteSpace: "nowrap" }}><input type="checkbox" checked={allMonths} onChange={(e) => setAllMonths(e.target.checked)} /> усі місяці</label>
    </>
  );

  return (
    <div>
      <p className="note">Облік оренди будинків МОХО: бронювання (база не дає зайняти будинок двічі на ті самі дати), гості, витрати, тарифи й акції. Ціну «за тарифом» рахує система: тариф × ночі − акція.</p>
      {demo > 0 && (
        <div className="lsrc-flag" style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span>⚠ Зараз тут демо-дані від 15.09.2026 (позначені «demo» / «ДЕМО»): {books.rows.filter((b) => b.created_by === "demo").length} бронювань, {guests.rows.filter((g) => g.note === "ДЕМО").length} гостей, {exps.rows.filter((e) => e.created_by === "demo").length} витрат. Будинки, тарифи й акція — справжні.</span>
          {role === "admin" && <button type="button" className="btn small" onClick={clearDemo}>{sure ? "Точно прибрати демо?" : "Прибрати демо-дані"}</button>}
        </div>
      )}
      {msg && <div className="note" style={{ marginBottom: 8, color: "var(--accent)" }}>{msg}</div>}

      <div className="seg-row" style={{ marginBottom: 12, flexWrap: "wrap" }}>
        {TABS.map(([id, label]) => <button key={id} type="button" className={`seg-btn${tab === id ? " active" : ""}`} onClick={() => { setTab(id); setMsg(""); }}>{label}</button>)}
      </div>

      {tab === "months" && (
        <>
          <div className="toolbar"><input type="month" value={month} onChange={(e) => setMonth(e.target.value || month)} style={{ width: 160 }} aria-label="Місяць" /></div>
          <div className="ops-kpi-grid">
            <div className="ops-kpi"><div className="k-label">Завантаженість</div><div className="k-value">{stat.avail ? Math.round((stat.sold / stat.avail) * 100) : 0}%</div><div className="k-bar"><div className="k-bar-fill" style={{ width: `${stat.avail ? Math.min(100, (stat.sold / stat.avail) * 100) : 0}%` }} /></div><div className="note">{stat.sold} з {stat.avail} ночей</div></div>
            <div className="ops-kpi"><div className="k-label">Дохід</div><div className="k-value">{uah(stat.rev)}</div></div>
            <div className="ops-kpi"><div className="k-label">Середня ціна ночі</div><div className="k-value">{stat.sold ? uah(stat.rev / stat.sold) : "—"}</div><div className="note">ADR: дохід ÷ продані ночі</div></div>
            <div className="ops-kpi"><div className="k-label">Дохід на доступну ніч</div><div className="k-value">{stat.avail ? uah(stat.rev / stat.avail) : "—"}</div><div className="note">RevPAR: з урахуванням порожніх ночей</div></div>
            <div className="ops-kpi"><div className="k-label">Витрати</div><div className="k-value">{uah(stat.exp)}</div></div>
            <div className="ops-kpi"><div className="k-label">Результат</div><div className="k-value" style={{ color: stat.rev - stat.exp < 0 ? "var(--danger)" : "var(--success)" }}>{uah(stat.rev - stat.exp)}</div><div className="note">дохід − витрати</div></div>
          </div>
          <h3 style={{ fontSize: 14, margin: "18px 0 8px" }}>По будинках за {monthName(m0)}</h3>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Будинок</th><th style={{ textAlign: "right" }}>Продано ночей</th><th style={{ textAlign: "right" }}>Завантаженість</th><th style={{ textAlign: "right" }}>Дохід</th><th style={{ textAlign: "right" }}>Середня ніч</th><th style={{ textAlign: "right" }}>На доступну ніч</th><th style={{ textAlign: "right" }}>Прямі витрати</th></tr></thead>
              <tbody>
                {stat.cur.map((r) => (
                  <tr key={r.house_id}>
                    <td>{houseName(r.house_id)}</td>
                    <td style={{ textAlign: "right" }}>{r.sold_nights} з {r.available_nights}</td>
                    <td style={{ textAlign: "right" }}>{Math.round(num(r.occupancy_pct))}%</td>
                    <td style={{ textAlign: "right" }}>{uah(r.revenue)}</td>
                    <td style={{ textAlign: "right" }}>{r.adr != null ? uah(r.adr) : "—"}</td>
                    <td style={{ textAlign: "right" }}>{uah(r.revpar)}</td>
                    <td style={{ textAlign: "right" }}>{uah(stat.expOf(r.house_id))}</td>
                  </tr>
                ))}
                {!stat.cur.length && <tr><td colSpan={7} className="note" style={{ textAlign: "center" }}>Немає даних за цей місяць.</td></tr>}
              </tbody>
            </table>
          </div>
          <h3 style={{ fontSize: 14, margin: "18px 0 8px" }}>По місяцях</h3>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Місяць</th><th style={{ textAlign: "right" }}>Продано ночей</th><th style={{ textAlign: "right" }}>Завантаженість</th><th style={{ textAlign: "right" }}>Дохід</th><th style={{ textAlign: "right" }}>Витрати</th><th style={{ textAlign: "right" }}>Результат</th></tr></thead>
              <tbody>
                {stat.months.map((x) => (
                  <tr key={x.month} style={{ cursor: "pointer", fontWeight: x.month === m0 ? 600 : undefined }} title="Показати цей місяць" onClick={() => setMonth(x.month.slice(0, 7))}>
                    <td>{monthName(x.month)}</td>
                    <td style={{ textAlign: "right" }}>{x.sold} з {x.avail}</td>
                    <td style={{ textAlign: "right" }}>{x.avail ? Math.round((x.sold / x.avail) * 100) : 0}%</td>
                    <td style={{ textAlign: "right" }}>{uah(x.rev)}</td>
                    <td style={{ textAlign: "right" }}>{uah(x.exp)}</td>
                    <td style={{ textAlign: "right", color: x.rev - x.exp < 0 ? "var(--danger)" : undefined }}>{uah(x.rev - x.exp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "bookings" && (
        <>
          <div className="toolbar">
            {filters}
            {monthPick}
            <div className="toolbar-actions">
              <input value={newGuest.full_name} onChange={(e) => setNewGuest({ ...newGuest, full_name: e.target.value })} placeholder="Новий гість: ім'я" style={{ width: 170 }} aria-label="Ім'я нового гостя" />
              <input value={newGuest.phone} onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })} placeholder="телефон" style={{ width: 130 }} aria-label="Телефон нового гостя" />
              <button type="button" className="btn" onClick={addGuest}>+ Гість</button>
            </div>
          </div>
          <ModTable columns={bookCols} rows={bookRows} onUpdate={updBooking} onDelete={async (id) => { const e = await books.remove(id); if (!e) monthly.reload(); return friendly(e); }} onAdd={addBooking} addLabel="+ Бронювання" empty="Бронювань за цим фільтром немає." />
        </>
      )}

      {tab === "guests" && (
        <>
          <div className="toolbar">{filters}</div>
          <ModTable columns={guestCols} rows={guestRows} onUpdate={async (id, p) => friendly(await guests.update(id, p))} onDelete={async (id) => friendly(await guests.remove(id))} onAdd={async () => friendly(await guests.insert({ full_name: "Новий гість" }))} addLabel="+ Гість" empty="Гостей ще немає." />
        </>
      )}

      {tab === "expenses" && (
        <>
          <div className="toolbar">{filters}{monthPick}<div className="toolbar-actions"><span className="note" style={{ margin: 0 }}>Разом: <b>{uah(expRows.reduce((a, e) => a + num(e.amount), 0))}</b></span></div></div>
          <ModTable columns={expCols} rows={expRows} onUpdate={async (id, p) => friendly(await exps.update(id, p))} onDelete={async (id) => friendly(await exps.remove(id))}
            onAdd={async () => { const t = todayKyiv(); return friendly(await exps.insert({ expense_date: allMonths || (t >= m0 && t < m1) ? t : m0, house_id: house || null, category: "Прибирання", amount: 0, allocation: house ? "direct" : "equal", created_by: who })); }}
            addLabel="+ Витрата" empty="Витрат за цим фільтром немає." />
        </>
      )}

      {tab === "rates" && (
        <>
          <h3 style={{ fontSize: 14, margin: "4px 0 8px" }}>Будинки</h3>
          <ModTable rows={houses.rows} onUpdate={async (id, p) => friendly(await houses.update(id, p))}
            columns={[{ key: "name", label: "Назва", width: 150 }, { key: "code", label: "Код", readOnly: true }, { key: "area_m2", label: "Площа, м²", type: "number", width: 80, num: true }, { key: "terrace_m2", label: "Тераса, м²", type: "number", width: 80, num: true }, { key: "capacity", label: "Місць", type: "number", width: 60, num: true }, { key: "is_active", label: "Здається", type: "check" }, { key: "description", label: "Опис", width: 260 }]} />
          <h3 style={{ fontSize: 14, margin: "20px 0 8px" }}>Тарифи (ціна ночі за періодами)</h3>
          <ModTable rows={rates.rows} onUpdate={async (id, p) => friendly(await rates.update(id, p))} onDelete={async (id) => friendly(await rates.remove(id))}
            onAdd={async () => friendly(await rates.insert({ house_id: houses.rows[0]?.id, date_from: todayKyiv(), date_to: `${todayKyiv().slice(0, 4)}-12-31`, price_weekday: 0, price_weekend: 0, label: "Новий тариф", created_by: who }))} addLabel="+ Тариф" empty="Тарифів ще немає."
            columns={[{ key: "house_id", label: "Будинок", type: "select", options: houseOpts, width: 120 }, { key: "date_from", label: "Діє з", type: "date", width: 128 }, { key: "date_to", label: "по", type: "date", width: 128 }, { key: "price_weekday", label: "Будні, грн", type: "number", width: 90, num: true }, { key: "price_weekend", label: "Вихідні, грн", type: "number", width: 90, num: true }, { key: "label", label: "Назва", width: 220 }, { key: "is_active", label: "Діє", type: "check" }]} />
          <h3 style={{ fontSize: 14, margin: "20px 0 8px" }}>Акції</h3>
          <ModTable rows={promos.rows} onUpdate={async (id, p) => friendly(await promos.update(id, p))} onDelete={async (id) => friendly(await promos.remove(id))}
            onAdd={async () => friendly(await promos.insert({ code: `promo-${Date.now().toString(36)}`, name: "Нова акція", kind: "percent", percent_off: 10, is_active: false }))} addLabel="+ Акція" empty="Акцій ще немає."
            columns={[{ key: "name", label: "Назва", width: 220 }, { key: "kind", label: "Тип", type: "select", options: PROMO_KIND, width: 150 }, { key: "buy_nights", label: "Купує ночей", type: "number", width: 70, num: true }, { key: "free_nights", label: "У подарунок", type: "number", width: 70, num: true }, { key: "percent_off", label: "Знижка, %", type: "number", width: 70, num: true }, { key: "min_nights", label: "Мін. ночей", type: "number", width: 70, num: true }, { key: "date_from", label: "Діє з", type: "date", width: 128 }, { key: "date_to", label: "по", type: "date", width: 128 }, { key: "is_active", label: "Діє", type: "check" }]} />
        </>
      )}
    </div>
  );
}

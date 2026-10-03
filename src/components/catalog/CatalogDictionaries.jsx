"use client";

// ⚙ Довідники каталогу: «Тип обʼєкта» (обирається в моделі, можна кілька) і «Прайс собівартості»
// (моделі «за прайсом» беруть суму звідси; змінили суму — собівартість і ціна оновлюються в усіх таких моделях).
import { useCallback, useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";

const CURS = [["UAH", "грн"], ["USD", "$"], ["EUR", "€"]];

export default function CatalogDictionaries({ onClose }) {
  const { supabase, templates, reload } = useAppData();
  const [tab, setTab] = useState("price");
  const [types, setTypes] = useState([]);
  const [prices, setPrices] = useState([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [o, p] = await Promise.all([
      supabase.from("object_types").select("*").order("sort_order").order("name"),
      supabase.from("cost_price_list").select("*").order("sort_order").order("name"),
    ]);
    setTypes(o.data || []); setPrices(p.data || []);
  }, [supabase]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function run(q, ok) {
    setErr(""); setMsg("");
    const { error } = await q;
    if (error) { setErr(error.message); return; }
    if (ok) setMsg(ok);
    await load();
  }

  // типи обʼєкта
  const addType = () => { const name = (window.prompt("Новий тип обʼєкта") || "").trim(); if (name) run(supabase.from("object_types").insert({ name, sort_order: types.length + 1 })); };
  const renameType = (t, name) => { name = name.trim(); if (name && name !== t.name) run(supabase.from("object_types").update({ name }).eq("id", t.id)); };
  const delType = (t) => { if (window.confirm(`Прибрати «${t.name}» зі списку? У моделях, де він обраний, лишиться як був.`)) run(supabase.from("object_types").delete().eq("id", t.id)); };
  async function moveType(i, d) {
    const j = i + d; if (j < 0 || j >= types.length) return;
    const a = [...types]; [a[i], a[j]] = [a[j], a[i]];
    await Promise.all(a.map((t, k) => supabase.from("object_types").update({ sort_order: k }).eq("id", t.id)));
    load();
  }

  // прайс
  const used = (id) => templates.filter((t) => t.price_list_id === id).length;
  const addPrice = () => run(supabase.from("cost_price_list").insert({ name: "Нова позиція прайсу", amount: 0, currency: "USD", sort_order: prices.length + 1 }));
  async function savePrice(p, patch) {
    const n = used(p.id);
    await run(supabase.from("cost_price_list").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", p.id),
      ("amount" in patch || "currency" in patch) && n ? `Збережено — оновлено собівартість у ${n} мод.` : "Збережено");
    if (("amount" in patch || "currency" in patch) && n) reload(true);
  }
  const delPrice = (p) => { if (window.confirm(`Видалити «${p.name}»?${used(p.id) ? ` ${used(p.id)} мод. залишаться зі своєю сумою, але без звʼязку з прайсом.` : ""}`)) run(supabase.from("cost_price_list").delete().eq("id", p.id)); };

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Довідники каталогу</h2>
          <button type="button" className="btn" onClick={onClose}>Готово</button>
        </div>
        <div className="seg-row" style={{ marginBottom: 12 }}>
          <button type="button" className={`seg-btn${tab === "price" ? " active" : ""}`} onClick={() => setTab("price")}>💲 Прайс собівартості</button>
          <button type="button" className={`seg-btn${tab === "types" ? " active" : ""}`} onClick={() => setTab("types")}>🏷 Типи обʼєкта</button>
        </div>
        {err && <div className="auth-error">{err}</div>}
        {msg && <div className="note" style={{ color: "var(--success)" }}>{msg}</div>}

        {tab === "price" ? (
          <>
            <p className="note">Суми собівартості за прайсом (напр. «2 модулі 3 × 6,5 — 25 700 $»). У картці моделі: «Собівартість і ціна» → «Одна сума за прайсом» → оберіть позицію. Змінили суму тут — собівартість і ціна оновляться в усіх моделях з цією позицією.</p>
            <div className="dict-list">
              {prices.map((p) => (
                <div key={p.id} className="dict-row dict-row--price">
                  <input defaultValue={p.name} onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && savePrice(p, { name: e.target.value.trim() })} aria-label="Назва" />
                  <input inputMode="decimal" defaultValue={Number(p.amount) || ""} placeholder="сума" style={{ width: 110 }}
                    onBlur={(e) => { const v = Number(e.target.value.replace(/\s/g, "").replace(",", ".")); if (!Number.isNaN(v) && v !== Number(p.amount)) savePrice(p, { amount: v }); }} aria-label="Сума" />
                  <select defaultValue={p.currency} onChange={(e) => savePrice(p, { currency: e.target.value })} style={{ width: 70 }} aria-label="Валюта">{CURS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  <input defaultValue={p.note || ""} placeholder="звідки (напр. прайс 14.09)" onBlur={(e) => e.target.value !== (p.note || "") && savePrice(p, { note: e.target.value.trim() || null })} aria-label="Примітка" />
                  <span className="note" style={{ margin: 0, whiteSpace: "nowrap" }} title="Скільки моделей бере суму звідси">{used(p.id)} мод.</span>
                  <button type="button" className="btn small" onClick={() => delPrice(p)} title="Видалити">✕</button>
                </div>
              ))}
              {!prices.length && <div className="empty">Прайс порожній.</div>}
            </div>
            <button type="button" className="btn small" onClick={addPrice}>+ Позиція прайсу</button>
          </>
        ) : (
          <>
            <p className="note">Список для поля «Тип обʼєкта» в картці моделі (можна обрати кілька). На сайті показується через кому.</p>
            <div className="dict-list">
              {types.map((t, i) => (
                <div key={t.id} className="dict-row">
                  <input defaultValue={t.name} onBlur={(e) => renameType(t, e.target.value)} aria-label="Назва" />
                  <button type="button" className="btn small" disabled={!i} onClick={() => moveType(i, -1)}>▲</button>
                  <button type="button" className="btn small" disabled={i === types.length - 1} onClick={() => moveType(i, 1)}>▼</button>
                  <button type="button" className="btn small" onClick={() => delType(t)}>✕</button>
                </div>
              ))}
            </div>
            <button type="button" className="btn small" onClick={addType}>+ Тип обʼєкта</button>
          </>
        )}
      </div>
    </div>
  );
}

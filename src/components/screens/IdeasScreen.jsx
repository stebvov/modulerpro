"use client";

// 💡 Ідеї та роздуми засновника: «Записати думку» → картка-гіпотеза зі статусом (сира → обдумуємо → перевіряємо → рішення).
// Бачить лише засновник (RLS: pult_is_owner). Розбір і звʼязки зі знаннями — у базі знань; kb_id — номер картки там.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DeleteButton from "@/components/DeleteButton";
import "./ideas.css";

const TYPES = [["", "— не визначено —"], ["business-model", "Бізнес-модель"], ["product", "Продукт"], ["go-to-market", "Маркетинг і продажі"], ["operations", "Процеси й команда"], ["platform", "Система"]];
const DIRS = [["factory", "Завод"], ["towns", "Містечка"], ["income-property", "Дохідна нерухомість"], ["service", "Сервіс"], ["cross", "Наскрізне"]];
const HORIZONS = [["", "— не визначено —"], ["now", "Зараз (до 3 міс.)"], ["year", "Цей рік"], ["later", "Колись"]];
const STATUSES = [["raw", "Сира"], ["thinking", "Обдумуємо"], ["testing", "Перевіряємо"], ["do", "Робимо"], ["later", "Відкладено"], ["no", "Ні"]];
const FILTERS = [["", "Усі"], ["raw", "Сирі"], ["thinking", "Обдумуємо"], ["testing", "Перевіряємо"], ["decided", "Рішення"]];
const DECIDED = ["do", "later", "no"];

const label = (list, v) => list.find(([k]) => k === v)?.[1] || "";
const code = (n) => `i-${String(n).padStart(4, "0")}`;
const inFilter = (r, f) => !f || (f === "decided" ? DECIDED.includes(r.status) : r.status === f);
// теза з думки: перше речення, до 120 знаків — далі її можна уточнити
function firstLine(t) {
  const s = t.trim().split(/(?<=[.!?…])\s|\n/)[0] || t.trim();
  return s.length > 120 ? s.slice(0, 117).trimEnd() + "…" : s;
}

export default function IdeasScreen() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [openId, setOpenId] = useState(null);
  const [status, setStatus] = useState("");
  const [msg, setMsg] = useState("");
  const [listening, setListening] = useState(false);
  const rec = useRef(null);
  const pending = useRef({}); // id → { patch, timer }: зміни, що чекають збереження

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("founder_ideas").select("*").order("created_at", { ascending: false });
    if (error) { setMsg("Не вдалося завантажити: " + error.message); setRows([]); return; }
    setRows(data || []);
  }, [supabase]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // при виході з розділу — дозберегти незбережене й зупинити диктування
  useEffect(() => () => {
    Object.entries(pending.current).forEach(([id, p]) => { clearTimeout(p.timer); supabase.from("founder_ideas").update(p.patch).eq("id", id).then(() => {}); });
    rec.current?.stop();
  }, [supabase]);

  async function add() {
    const said = text.trim();
    if (!said || busy) return;
    setBusy(true); setMsg("");
    const { data, error } = await supabase.from("founder_ideas").insert({ said, title: firstLine(said), status: "raw" }).select().single();
    setBusy(false);
    if (error) { setMsg("Не записано: " + error.message); return; }
    rec.current?.stop();
    setText(""); setFilter(""); setRows((rs) => [data, ...(rs || [])]); setOpenId(data.id);
    setStatus("Думку записано");
  }

  function edit(id, patch) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    // кілька правок поспіль зливаються в один запит: чекаємо 0,7 с тиші
    const prev = pending.current[id];
    clearTimeout(prev?.timer);
    const merged = { ...prev?.patch, ...patch };
    setStatus("Зберігаю…");
    const timer = setTimeout(async () => {
      const rest = { ...pending.current };
      delete rest[id];
      pending.current = rest;
      const { error } = await supabase.from("founder_ideas").update(merged).eq("id", id);
      if (error) { setStatus(""); setMsg("Не збережено: " + error.message); } else setStatus("Збережено");
    }, 700);
    pending.current = { ...pending.current, [id]: { patch: merged, timer } };
  }

  // диктування голосом (Chrome, Edge, Safari); в інших браузерах — мікрофон на клавіатурі
  function dictate() {
    if (rec.current) { rec.current.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setMsg("Цей браузер не вміє диктування — скористайтеся мікрофоном на клавіатурі телефона."); return; }
    const r = new SR();
    r.lang = "uk-UA"; r.continuous = true; r.interimResults = false;
    r.onresult = (e) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript;
      if (t.trim()) setText((x) => (x ? x.trimEnd() + " " : "") + t.trim());
    };
    r.onerror = (e) => { if (e.error !== "no-speech" && e.error !== "aborted") setMsg(e.error === "not-allowed" ? "Дозвольте браузеру доступ до мікрофона." : "Диктування зупинилось: " + e.error); };
    r.onend = () => { rec.current = null; setListening(false); };
    rec.current = r; setListening(true); setMsg("");
    r.start();
  }

  if (rows === null) return <div className="empty">Завантаження ідей…</div>;

  const shown = rows.filter((r) => inFilter(r, filter));
  const count = (f) => rows.filter((r) => inFilter(r, f)).length;

  return (
    <div className="ideas">
      <div className="ideas__capture">
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Запишіть або надиктуйте думку як є — розкласти по поличках можна потім"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) add(); }} />
        <div className="ideas__row">
          <button type="button" className="btn primary ideas__add" onClick={add} disabled={!text.trim() || busy}>{busy ? "Записую…" : "💡 Записати думку"}</button>
          <button type="button" className={`btn ideas__mic${listening ? " on" : ""}`} onClick={dictate} title="Диктувати голосом">{listening ? "⏹ Зупинити" : "🎙 Диктувати"}</button>
          <span className="note ideas__status">{status}</span>
        </div>
      </div>
      {msg && <div className="auth-error" onClick={() => setMsg("")}>{msg}</div>}

      <div className="ideas__filters">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" className={`subtab${filter === k ? " active" : ""}`} onClick={() => setFilter(k)}>{l} · {count(k)}</button>
        ))}
      </div>

      {shown.map((r) => {
        const open = openId === r.id;
        return (
          <div key={r.id} className={`idea idea--${r.status}${open ? " open" : ""}`}>
            <button type="button" className="idea__head" onClick={() => setOpenId(open ? null : r.id)}>
              <span className={`idea__status st-${r.status}`}>{label(STATUSES, r.status)}</span>
              <span className="idea__title">{r.title || "Без назви"}</span>
              <span className="idea__meta">
                <span>{code(r.num)}</span>
                <span>{new Date(r.created_at).toLocaleDateString("uk-UA")}</span>
                {r.type && <span>{label(TYPES, r.type)}</span>}
                {(r.directions || []).map((d) => <span key={d}>{label(DIRS, d)}</span>)}
                {r.horizon && <span>{label(HORIZONS, r.horizon)}</span>}
              </span>
            </button>
            {open && (
              <div className="idea__body">
                <div className="form-row">
                  <label>Теза одним реченням</label>
                  <textarea rows={2} value={r.title || ""} onChange={(e) => edit(r.id, { title: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Що з нею</label>
                  <div className="idea__seg">
                    {STATUSES.map(([k, l]) => (
                      <button key={k} type="button" className={`subtab${r.status === k ? " active" : ""}`} onClick={() => edit(r.id, { status: k })}>{l}</button>
                    ))}
                  </div>
                </div>
                <div className="idea__grid">
                  <div className="form-row">
                    <label>Про що</label>
                    <select value={r.type || ""} onChange={(e) => edit(r.id, { type: e.target.value || null })}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  </div>
                  <div className="form-row">
                    <label>Коли</label>
                    <select value={r.horizon || ""} onChange={(e) => edit(r.id, { horizon: e.target.value || null })}>{HORIZONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  </div>
                </div>
                <div className="form-row">
                  <label>Чий напрям</label>
                  <div className="idea__dirs">
                    {DIRS.map(([k, l]) => {
                      const on = (r.directions || []).includes(k);
                      return (
                        <label key={k}><input type="checkbox" checked={on} onChange={() => edit(r.id, { directions: on ? r.directions.filter((x) => x !== k) : [...(r.directions || []), k] })} /> {l}</label>
                      );
                    })}
                  </div>
                </div>
                <div className="form-row">
                  <label>Перша перевірка — найдешевший спосіб за 1–2 тижні зрозуміти, чи ідея жива</label>
                  <textarea rows={2} value={r.next_check || ""} onChange={(e) => edit(r.id, { next_check: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Як сказано</label>
                  <textarea rows={Math.min(12, Math.max(3, Math.ceil((r.said || "").length / 90)))} value={r.said || ""} onChange={(e) => edit(r.id, { said: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Розбір: суть, що це дає, що вже є, ризики</label>
                  <textarea rows={Math.min(14, Math.max(3, Math.ceil((r.note || "").length / 90)))} value={r.note || ""} onChange={(e) => edit(r.id, { note: e.target.value })} />
                </div>
                <div className="ideas__row">
                  {r.kb_id && <span className="note">Картка в базі знань: {r.kb_id}</span>}
                  {r.status === "no" ? (
                    <DeleteButton table="founder_ideas" id={r.id} what="ідею" onDone={() => { setOpenId(null); load(); }} onError={setMsg} />
                  ) : (
                    <span className="note">Щоб видалити — спершу поставте статус «Ні».</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {!shown.length && <div className="empty">{rows.length ? "У цьому статусі ідей немає." : "Ще немає ідей. Запишіть першу думку вгорі."}</div>}
    </div>
  );
}

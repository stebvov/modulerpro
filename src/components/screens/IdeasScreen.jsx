"use client";

// 💡 Ідеї та роздуми засновника: «Записати думку» → картка-гіпотеза зі статусом (сира → обдумуємо → перевіряємо → рішення).
// Бачить лише засновник (RLS: pult_is_owner). Розбір і звʼязки зі знаннями — у базі знань; kb_id — номер картки там.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DeleteButton from "@/components/DeleteButton";
import { linkify } from "@/lib/format";
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
const fmtDT = (ts) => new Date(ts).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const safeName = (n) => String(n).replace(/[^A-Za-z0-9._-]+/g, "_").slice(-60) || "file";
const BUCKET = "pult-files";

// текстовий блок картки: показуємо лише заповнене
function ViewBlock({ title, text }) {
  if (!text || !String(text).trim()) return null;
  return (
    <div className="idea-v__block">
      <div className="idea-v__label">{title}</div>
      <div className="idea-v__text">{linkify(text)}</div>
    </div>
  );
}

// 💬 Коментарі до ідеї — як у задачах: текст, файли/фото, змінити або прибрати свій
function IdeaComments({ supabase, ideaId, onCount }) {
  const [list, setList] = useState(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [urls, setUrls] = useState({});

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("founder_idea_comments").select("*").eq("idea_id", ideaId).order("created_at");
    if (error) { setErr(error.message); setList([]); return; }
    setList(data || []);
    onCount?.(ideaId, (data || []).length);
    const paths = (data || []).flatMap((c) => (c.attachments || []).map((a) => a.path)).filter(Boolean);
    if (paths.length) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 6);
      setUrls(Object.fromEntries((signed || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl])));
    }
  }, [supabase, ideaId, onCount]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function send() {
    const body = text.trim();
    if ((!body && !files.length) || busy) return;
    setBusy(true); setErr("");
    const attachments = [];
    for (const f of files) {
      if (f.size > 50 * 1024 * 1024) { setErr(`${f.name}: більше 50 МБ`); continue; }
      const path = `ideas/${ideaId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${safeName(f.name)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || "application/octet-stream" });
      if (error) { setErr(`${f.name}: ${error.message}`); continue; }
      attachments.push({ path, name: f.name, mime: f.type || "application/octet-stream", size: f.size });
    }
    const { error } = await supabase.from("founder_idea_comments").insert({ idea_id: ideaId, body, attachments });
    setBusy(false);
    if (error) { setErr("Не надіслано: " + error.message); return; }
    setText(""); setFiles([]); load();
  }
  async function saveEdit(c) {
    const body = editText.trim();
    if (!body) return;
    const { error } = await supabase.from("founder_idea_comments").update({ body, updated_at: new Date().toISOString() }).eq("id", c.id);
    if (error) { setErr(error.message); return; }
    setEditId(null); load();
  }
  async function remove(c) {
    if (!window.confirm("Видалити коментар?")) return;
    const { error } = await supabase.from("founder_idea_comments").delete().eq("id", c.id);
    if (error) { setErr(error.message); return; }
    load();
  }

  return (
    <div className="idea-cmts">
      <h4>💬 Коментарі{list?.length ? ` · ${list.length}` : ""}</h4>
      {list === null ? <div className="note">Завантаження…</div> : !list.length ? <div className="note">Ще немає коментарів.</div> : (
        <div className="idea-cmts__list">
          {list.map((c) => (
            <div key={c.id} className="idea-cmt">
              <div className="idea-cmt__meta">
                <span>{fmtDT(c.created_at)}{c.updated_at ? " · змінено" : ""}</span>
                {editId !== c.id && (
                  <span className="idea-cmt__acts">
                    <button type="button" onClick={() => { setEditId(c.id); setEditText(c.body || ""); }} title="Змінити" aria-label="Змінити коментар">✎</button>
                    <button type="button" onClick={() => remove(c)} title="Видалити" aria-label="Видалити коментар">×</button>
                  </span>
                )}
              </div>
              {editId === c.id ? (
                <div className="idea-cmt__edit">
                  <textarea rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} autoFocus />
                  <div className="ideas__row" style={{ marginTop: 6 }}>
                    <button type="button" className="btn small primary" onClick={() => saveEdit(c)}>Зберегти</button>
                    <button type="button" className="btn small" onClick={() => setEditId(null)}>Скасувати</button>
                  </div>
                </div>
              ) : c.body ? <div className="idea-cmt__body">{linkify(c.body)}</div> : null}
              {!!(c.attachments || []).length && (
                <div className="idea-atts">
                  {c.attachments.map((a) => {
                    const u = urls[a.path];
                    if (!u) return <span key={a.path} className="note">📎 {a.name}</span>;
                    return (a.mime || "").startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a key={a.path} className="idea-atts__img" href={u} target="_blank" rel="noreferrer" title={a.name}><img src={u} alt={a.name} loading="lazy" /></a>
                    ) : <a key={a.path} className="idea-atts__file" href={u} target="_blank" rel="noreferrer">📎 {a.name}</a>;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {err && <div className="auth-error" onClick={() => setErr("")}>{err}</div>}
      <div className="idea-cmts__box">
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Коментар, уточнення, що дізналися…"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }}
          onPaste={(e) => { const f = [...(e.clipboardData?.files || [])]; if (f.length) { e.preventDefault(); setFiles((x) => [...x, ...f]); } }} />
        <div className="ideas__row" style={{ marginTop: 6 }}>
          <label className="btn small idea-file" title="Додати файл або фото">📎 Файл<input type="file" multiple onChange={(e) => { setFiles((x) => [...x, ...e.target.files]); e.target.value = ""; }} /></label>
          {files.map((f, i) => <span key={i} className="idea-pend">📎 {f.name} <button type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} aria-label="Прибрати">×</button></span>)}
          <button type="button" className="btn small primary" style={{ marginLeft: "auto" }} disabled={busy || (!text.trim() && !files.length)} onClick={send}>{busy ? "Надсилаю…" : "Надіслати"}</button>
        </div>
      </div>
    </div>
  );
}

// форма редагування відкритої ідеї (зберігається сама)
function IdeaEditForm({ r, edit, onDeleted, onError }) {
  return (
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
                  <textarea rows={Math.min(12, Math.max(3, Math.ceil((r.said || "").length / 70)))} value={r.said || ""} onChange={(e) => edit(r.id, { said: e.target.value })} />
                </div>
                <div className="form-row">
                  <label>Розбір: суть, що це дає, що вже є, ризики</label>
                  <textarea rows={Math.min(14, Math.max(3, Math.ceil((r.note || "").length / 70)))} value={r.note || ""} onChange={(e) => edit(r.id, { note: e.target.value })} />
                </div>
                <div className="ideas__row">
                  {r.status === "no" ? (
                    <DeleteButton table="founder_ideas" id={r.id} what="ідею" onDone={onDeleted} onError={onError} />
                  ) : (
                    <span className="note">Щоб видалити — спершу поставте статус «Ні».</span>
                  )}
                </div>
              </div>
  );
}

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
  const [editing, setEditing] = useState(false); // відкрита картка: перегляд або редагування
  const [cmtCount, setCmtCount] = useState({});
  const rec = useRef(null);
  const pending = useRef({}); // id → { patch, timer }: зміни, що чекають збереження

  const load = useCallback(async () => {
    const [{ data, error }, cm] = await Promise.all([
      supabase.from("founder_ideas").select("*").order("created_at", { ascending: false }),
      supabase.from("founder_idea_comments").select("idea_id"),
    ]);
    if (error) { setMsg("Не вдалося завантажити: " + error.message); setRows([]); return; }
    setRows(data || []);
    const n = {};
    (cm.data || []).forEach((c) => { n[c.idea_id] = (n[c.idea_id] || 0) + 1; });
    setCmtCount(n);
  }, [supabase]);
  const onCount = useCallback((id, n) => setCmtCount((x) => (x[id] === n ? x : { ...x, [id]: n })), []);
  const openIdea = (id, edit = false) => { setOpenId(id); setEditing(edit); };
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
    setText(""); setFilter(""); setRows((rs) => [data, ...(rs || [])]); openIdea(data.id, true);
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

  const opened = rows.find((r) => r.id === openId) || null;

  return (
    <div className="ideas">
      <div className="ideas__capture">
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Запишіть або надиктуйте думку як є — розкласти по поличках можна потім"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) add(); }} />
        <div className="ideas__row">
          <button type="button" className={`btn ideas__mic${listening ? " on" : ""}`} onClick={dictate} title="Диктувати голосом">{listening ? "⏹ Стоп" : "🎙 Диктувати"}</button>
          <button type="button" className="btn primary ideas__add" onClick={add} disabled={!text.trim() || busy}>{busy ? "Записую…" : "💡 Записати думку"}</button>
          <span className="note ideas__status">{status}</span>
        </div>
      </div>
      {msg && <div className="auth-error" onClick={() => setMsg("")}>{msg}</div>}

      <div className="ideas__filters">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" className={`subtab${filter === k ? " active" : ""}`} onClick={() => setFilter(k)}>{l} · {count(k)}</button>
        ))}
      </div>

      {shown.map((r) => (
        <button key={r.id} type="button" className={`idea idea--${r.status}`} onClick={() => openIdea(r.id)}>
          <span className="idea__top">
            <span className={`idea__status st-${r.status}`}>{label(STATUSES, r.status)}</span>
            {cmtCount[r.id] ? <span className="idea__cc">💬 {cmtCount[r.id]}</span> : null}
          </span>
          <span className="idea__title">{r.title || "Без назви"}</span>
          <span className="idea__meta">
            <span>{code(r.num)}</span>
            <span>{new Date(r.created_at).toLocaleDateString("uk-UA")}</span>
            {r.type && <span>{label(TYPES, r.type)}</span>}
            {(r.directions || []).map((d) => <span key={d}>{label(DIRS, d)}</span>)}
            {r.horizon && <span>{label(HORIZONS, r.horizon)}</span>}
          </span>
        </button>
      ))}
      {!shown.length && <div className="empty">{rows.length ? "У цьому статусі ідей немає." : "Ще немає ідей. Запишіть першу думку вгорі."}</div>}

      {opened && (
        <div className="modal-overlay open idea-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpenId(null)}>
          <div className="modal idea-modal">
            <div className="idea-modal__bar">
              <span className={`idea__status st-${opened.status}`}>{label(STATUSES, opened.status)}</span>
              <span className="note" style={{ margin: 0 }}>{code(opened.num)} · {new Date(opened.created_at).toLocaleDateString("uk-UA")}{status ? ` · ${status}` : ""}</span>
              <span className="idea-modal__acts">
                <button type="button" className={`btn small${editing ? " primary" : ""}`} onClick={() => setEditing((v) => !v)}>{editing ? "✓ Готово" : "✎ Редагувати"}</button>
                <button type="button" className="btn small" onClick={() => setOpenId(null)} aria-label="Закрити">✕</button>
              </span>
            </div>
            {editing ? <IdeaEditForm r={opened} edit={edit} onDeleted={() => { setOpenId(null); load(); }} onError={setMsg} /> : (
              <div className="idea-v">
                <h2 className="idea-v__title">{opened.title || "Без назви"}</h2>
                <div className="idea__seg idea-v__seg">
                  {STATUSES.map(([k, l]) => (
                    <button key={k} type="button" className={`subtab${opened.status === k ? " active" : ""}`} onClick={() => edit(opened.id, { status: k })}>{l}</button>
                  ))}
                </div>
                <div className="idea-v__facts">
                  {opened.type && <span><b>Про що:</b> {label(TYPES, opened.type)}</span>}
                  {opened.horizon && <span><b>Коли:</b> {label(HORIZONS, opened.horizon)}</span>}
                  {!!(opened.directions || []).length && <span><b>Напрям:</b> {opened.directions.map((d) => label(DIRS, d)).join(", ")}</span>}
                </div>
                <ViewBlock title="Перша перевірка" text={opened.next_check} />
                <ViewBlock title="Як сказано" text={opened.said} />
                <ViewBlock title="Розбір" text={opened.note} />
                {!opened.next_check && !opened.note && <button type="button" className="btn small" onClick={() => setEditing(true)}>+ Додати розбір і першу перевірку</button>}
                {opened.kb_id && <div className="note">Картка в базі знань: {opened.kb_id}</div>}
              </div>
            )}
            <IdeaComments supabase={supabase} ideaId={opened.id} onCount={onCount} />
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

// 🤖 Асистент — операційний ШІ-директор: розмова (та сама, що в Telegram з ботом), реєстр контролю (coo_issues),
// стан проєктів і людей. Бачить лише засновник (RLS: pult_is_owner). Відповідає edge-функція coo.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SettingsButton from "@/components/SettingsButton";
import InfoTip from "@/components/InfoTip";
import "./assistant.css";

const QUICK = ["Що горить сьогодні?", "Що потребує мого рішення?", "Хто чим зайнятий і хто перевантажений?", "Зведення по проєктах: де рух, де стоїть"];
const GROUPS = [
  ["", "Усе"], ["hot", "Горить"], ["task", "Задачі"], ["deal", "Угоди й виробництво"], ["project", "Проєкти"], ["people", "Люди"], ["question", "Питання"], ["dismissed", "Зняті"],
];
const KIND_GROUP = {
  task_overdue: "task", task_stale: "task", task_no_due: "task", task_no_owner: "task", deal_stuck: "deal", prod_late: "deal", request_overdue: "deal",
  project_no_owner: "project", project_idle: "project", member_no_tg: "people", question: "question",
};
const DIRS = { factory: "Завод", towns: "Містечка", income: "Дохідна нерухомість", service: "Сервіс" };
const MODELS = [["claude-opus-5-5", "Opus 5.5 — найрозумніша"], ["claude-sonnet-5-5", "Sonnet 5.5 — удвічі дешевша"]];

const dm = (iso) => (iso ? new Date(iso).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" }) : "");
const hm = (iso) => (iso ? new Date(iso).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
const inGroup = (r, g) => g === "dismissed" ? r.status === "dismissed" : r.status !== "dismissed" && (!g || (g === "hot" ? r.severity === 1 : KIND_GROUP[r.kind] === g));

// **жирний** і #12 → посилання на задачу; решта тексту як є
function Rich({ text }) {
  const parts = String(text || "").split(/(\*\*[^*\n]+\*\*|#\d+)/g);
  return parts.map((p, i) => {
    if (/^\*\*.+\*\*$/.test(p)) return <b key={i}>{p.slice(2, -2)}</b>;
    if (/^#\d+$/.test(p)) return <a key={i} href={`/?s=pult-tasks#t/${p.slice(1)}`} target="_blank" rel="noreferrer">{p}</a>;
    return p;
  });
}

// шлях файлу в сховищі фінансів (inbox/app/дата/…), звідки Асистент його читає
const inboxPath = (name) => `inbox/app/${new Date().toISOString().slice(0, 10)}/${Math.random().toString(36).slice(2, 8)}_${name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80)}`;

async function callCoo(supabase, body) {
  const { data, error } = await supabase.functions.invoke("coo", { body });
  if (!error) return data;
  let msg = error.message;
  try { msg = (await error.context.json()).error || msg; } catch { /* відповідь не JSON */ }
  throw new Error(msg);
}

export default function AssistantScreen() {
  const supabase = useMemo(() => createClient(), []);
  const [snap, setSnap] = useState(null);
  const [issues, setIssues] = useState([]);
  const [people, setPeople] = useState({});
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]); // чек, скрін, виписка — Асистент розбере й внесе витрату
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("issues");
  const [group, setGroup] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const feed = useRef(null);

  const loadControl = useCallback(async () => {
    const [o, i, m] = await Promise.all([
      supabase.rpc("coo_overview"),
      supabase.from("coo_issues").select("*").neq("status", "resolved").order("severity").order("first_seen").limit(400),
      supabase.from("task_members").select("id,name,tg_user_id").eq("active", true),
    ]);
    if (o.error) setErr("Не вдалося завантажити картину: " + o.error.message); else setSnap(o.data);
    setIssues(i.data || []);
    setPeople(Object.fromEntries((m.data || []).map((x) => [x.id, x])));
  }, [supabase]);
  const loadChat = useCallback(async () => {
    const { data, error } = await supabase.from("coo_messages").select("id,role,kind,channel,body,actions,attachments,created_at").order("id", { ascending: false }).limit(60);
    if (error) setErr("Не вдалося завантажити розмову: " + error.message);
    setMsgs((data || []).reverse());
  }, [supabase]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadControl(); loadChat(); }, [loadControl, loadChat]);
  useEffect(() => { if (feed.current) feed.current.scrollTop = feed.current.scrollHeight; }, [msgs, busy]);

  async function send(t) {
    const q = (t ?? text).trim();
    const fl = t == null ? files : [];
    if ((!q && !fl.length) || busy) return;
    setErr(""); setBusy("chat"); setText(""); setFiles([]);
    setMsgs((m) => [...(m || []), { id: "u" + Date.now(), role: "user", body: q || "(файл без підпису)", attachments: fl.map((f) => ({ name: f.name })), created_at: new Date().toISOString() }]);
    try {
      // файли — у сховище фінансів (inbox/…); звідти Асистент їх читає й прикладає до витрати
      const up = [];
      for (const f of fl) {
        const path = inboxPath(f.name);
        const { error } = await supabase.storage.from("transaction-files").upload(path, f, { contentType: f.type || undefined });
        if (error) throw new Error(`${f.name}: ${error.message}`);
        up.push({ path, name: f.name, mime: f.type || "" });
      }
      const r = await callCoo(supabase, { action: "chat", text: q, files: up });
      setMsgs((m) => [...(m || []), { id: r.id || "a" + Date.now(), role: "assistant", body: r.reply, actions: r.actions, created_at: r.created_at || new Date().toISOString() }]);
      if (r.actions?.length) loadControl();
    } catch (e) { setErr("Асистент не відповів: " + e.message); loadChat(); }
    setBusy("");
  }
  async function act(kind, body, after) {
    if (busy) return;
    setErr(""); setBusy(kind);
    try { const r = await callCoo(supabase, body); await after?.(r); } catch (e) { setErr(e.message); }
    setBusy("");
  }
  const briefNow = () => act("brief", { action: "brief" }, loadChat);
  const rescan = () => act("scan", { action: "scan" }, loadControl);
  const ask = (r) => act("ask" + r.id, { action: "ask", issue_id: r.id }, loadControl);
  async function setStatus(r, status) {
    setIssues((list) => list.map((x) => (x.id === r.id ? { ...x, status } : x)));
    const { error } = await supabase.from("coo_issues").update({ status }).eq("id", r.id);
    if (error) { setErr("Не збережено: " + error.message); loadControl(); }
  }

  const c = snap?.counts || {};
  const shown = issues.filter((r) => inGroup(r, group));
  const count = (g) => issues.filter((r) => inGroup(r, g)).length;

  return (
    <div className="coo">
      <div className="coo__tiles">
        <div className={`coo__tile${c.hot ? " hot" : ""}`}><b>{c.hot ?? "—"}</b><span>горить</span></div>
        <div className="coo__tile"><b>{c.open ?? "—"}</b><span>відкритих задач</span></div>
        <div className={`coo__tile${c.overdue ? " warn" : ""}`}><b>{c.overdue ?? "—"}</b><span>прострочено</span></div>
        <div className="coo__tile"><b>{c.stale ?? "—"}</b><span>без руху 7+ днів</span></div>
        <div className="coo__tile"><b>{c.done_7d ?? "—"}</b><span>закрито за тиждень</span></div>
        <div className="coo__tile"><b>{c.asked ?? "—"}</b><span>питань без відповіді</span></div>
        <div className={`coo__tile${c.no_tg ? " warn" : ""}`}><b>{c.no_tg ?? "—"}</b><span>людей без бота</span></div>
      </div>
      {err && <div className="auth-error" onClick={() => setErr("")}>{err}</div>}

      <div className="coo__cols">
        <section className="coo__chat">
          <div className="coo__feed" ref={feed}>
            {msgs === null && <div className="empty">Завантаження розмови…</div>}
            {msgs?.length === 0 && (
              <div className="empty">Запитайте будь-що про задачі, проєкти, угоди й людей — або дайте доручення: «постав Каті задачу…», «спитай у Насті статус по #58», «перенеси #12 на пʼятницю». Те саме можна писати боту в Telegram.</div>
            )}
            {msgs?.map((m) => (
              <div key={m.id} className={`coo__msg ${m.role}${m.kind && m.kind !== "chat" ? " " + m.kind : ""}`}>
                <div className="coo__bubble">
                  <Rich text={m.body} />
                  {Array.isArray(m.attachments) && m.attachments.length > 0 && <div className="coo__files">{m.attachments.map((f, i) => <span key={i}>📎 {f.name}</span>)}</div>}
                  {m.actions?.length > 0 && (
                    <div className="coo__done">⚙️ Зроблено:{m.actions.map((a, i) => <div key={i}>• <Rich text={a} /></div>)}</div>
                  )}
                </div>
                <div className="coo__meta">{m.kind === "brief" ? "зведення · " : m.kind === "alert" ? "сигнал · " : ""}{m.channel === "tg" ? "Telegram · " : ""}{hm(m.created_at)}</div>
              </div>
            ))}
            {busy === "chat" && <div className="coo__msg assistant"><div className="coo__bubble coo__think">Дивлюся в систему…</div></div>}
            {busy === "brief" && <div className="coo__msg assistant"><div className="coo__bubble coo__think">Збираю зведення…</div></div>}
          </div>
          <div className="coo__quick">
            {QUICK.map((q) => <button key={q} type="button" className="btn small" disabled={!!busy} onClick={() => send(q)}>{q}</button>)}
            <button type="button" className="btn small" disabled={!!busy} onClick={briefNow} title="Те саме зведення, що приходить о 08:30 у Telegram">☀️ Зведення зараз</button>
          </div>
          {files.length > 0 && (
            <div className="coo__pend">{files.map((f, i) => <span key={i}>📎 {f.name} <button type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} aria-label="Прибрати">×</button></span>)}</div>
          )}
          <div className="coo__input">
            <label className="btn coo__attach" title="Чек, скрін списання, виписка, рахунок — Асистент розбере й запропонує внести витрату">📎<input type="file" multiple accept="image/*,application/pdf,.csv,.txt" onChange={(e) => { setFiles((x) => [...x, ...e.target.files].slice(0, 5)); e.target.value = ""; }} /></label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Питання, доручення або «внеси витрату: …» (можна з фото чека)"
              onPaste={(e) => { const f = [...(e.clipboardData?.files || [])]; if (f.length) { e.preventDefault(); setFiles((x) => [...x, ...f].slice(0, 5)); } }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button type="button" className="btn primary" onClick={() => send()} disabled={(!text.trim() && !files.length) || !!busy}>Надіслати</button>
          </div>
        </section>

        <section className="coo__ctl">
          <div className="toolbar">
            <div className="toolbar-left">
              <button type="button" className={`subtab${tab === "issues" ? " active" : ""}`} onClick={() => setTab("issues")}>Увага · {count("")}</button>
              <button type="button" className={`subtab${tab === "projects" ? " active" : ""}`} onClick={() => setTab("projects")}>Проєкти</button>
              <button type="button" className={`subtab${tab === "people" ? " active" : ""}`} onClick={() => setTab("people")}>Люди</button>
            </div>
            <div className="toolbar-actions">
              <button type="button" className="btn" onClick={rescan} disabled={!!busy} title="Перевірити зараз: прострочене, без руху, без відповідального">↻<span className="coo__lbl">{busy === "scan" ? "Перевіряю…" : "Перевірити"}</span></button>
              <SettingsButton title="Налаштування Асистента: зведення, питання команді, модель, памʼять" onClick={() => setSettingsOpen(true)} />
            </div>
          </div>

          {tab === "issues" && (
            <>
              <div className="coo__groups">
                {GROUPS.map(([k, l]) => (
                  <button key={k} type="button" className={`btn small${group === k ? " on" : ""}`} onClick={() => setGroup(k)}>{l} · {count(k)}</button>
                ))}
              </div>
              <div className="table-scroll">
                <table className="coo__table">
                  <thead><tr><th className="w-sev"></th><th>Що</th><th className="coo__wide w-why">Причина</th><th className="coo__wide w-who">Хто</th><th className="w-state">Стан</th><th className="w-acts"></th></tr></thead>
                  <tbody>
                    {shown.map((r) => {
                      const who = people[r.member_id];
                      const why = r.kind === "question" ? r.question : r.detail;
                      return (
                        <tr key={r.id} className={r.status === "dismissed" ? "off" : ""}>
                          <td><span className={`coo__sev s${r.severity}`} title={r.severity === 1 ? "горить" : r.severity === 2 ? "увага" : "до відома"} /></td>
                          <td className="coo__what" title={r.title}>
                            {r.task_num ? <a href={`/?s=pult-tasks#t/${r.task_num}`} target="_blank" rel="noreferrer">{r.title}</a>
                              : r.project && KIND_GROUP[r.kind] === "project" ? <a href={`/?s=pult-tasks#p/${encodeURIComponent(r.project)}`} target="_blank" rel="noreferrer">{r.title}</a> : r.title}
                            <div className="coo__sub">{[who?.name, why].filter(Boolean).join(" · ")}</div>
                          </td>
                          <td className="coo__why coo__wide" title={why}>{why}</td>
                          <td className="coo__who coo__wide" title={who?.name}>{who?.name || "—"}</td>
                          <td className="coo__state">
                            {r.status === "asked" && <span className={r.escalated_at ? "stale" : ""}>спитав {dm(r.asked_at)}{r.escalated_at ? " · мовчить" : ""}</span>}
                            {r.status === "answered" && <><span className="fresh">{String(r.answer || "").split("\n")[0].slice(0, 28) || "відповів"}</span><InfoTip text={`${r.answer || ""}\n(${hm(r.answered_at)})`} label="Відповідь" /></>}
                            {r.status === "dismissed" && <span className="note">знято</span>}
                          </td>
                          <td className="coo__acts">
                            {r.status !== "dismissed" && who?.tg_user_id && !["member_no_tg", "question"].includes(r.kind) && (
                              <button type="button" className="btn small icon" disabled={!!busy} onClick={() => ask(r)} title={`Запитати ${who.name} в Telegram`}>💬</button>
                            )}
                            {r.status === "dismissed"
                              ? <button type="button" className="btn small icon" onClick={() => setStatus(r, "open")} title="Повернути в список">↺</button>
                              : <button type="button" className="btn small icon" onClick={() => setStatus(r, "dismissed")} title="Зняти: не турбувати, поки причина не зникне">✕</button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!shown.length && <div className="empty">{issues.length ? "У цій групі нічого немає." : "Реєстр порожній — натисніть «↻ Перевірити»."}</div>}
            </>
          )}

          {tab === "projects" && (
            <div className="table-scroll">
              <table className="coo__table">
                <thead><tr><th>Проєкт</th><th className="coo__wide w-dir">Напрям</th><th className="w-own">Відповідальний</th><th className="num w-n" title="Відкритих задач">Відкр.</th><th className="num w-n" title="Прострочених задач">Простр.</th><th className="num w-n coo__wide" title="Закрито за 7 днів">Закрито</th><th className="coo__wide w-date">Остання дія</th></tr></thead>
                <tbody>
                  {(snap?.projects || []).map((p) => (
                    <tr key={p.name}>
                      <td className="coo__what" title={p.name}><a href={`/?s=pult-tasks#p/${encodeURIComponent(p.name)}`} target="_blank" rel="noreferrer">{p.name}</a></td>
                      <td className="coo__wide">{DIRS[p.dir] || "—"}</td>
                      <td className={p.owner ? "" : "stale"} title={p.owner || ""}>{p.owner || "немає"}</td>
                      <td className="num">{p.open || ""}</td>
                      <td className={`num${p.overdue ? " stale" : ""}`}>{p.overdue || ""}</td>
                      <td className="num fresh coo__wide">{p.done_7d || ""}</td>
                      <td className="coo__wide">{dm(p.last_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "people" && (
            <div className="table-scroll">
              <table className="coo__table">
                <thead><tr><th>Людина</th><th className="coo__wide w-role">Роль</th><th className="w-bot">Бот</th><th className="num w-n" title="Відкритих задач">Відкр.</th><th className="num w-n" title="Прострочених задач">Простр.</th><th className="num w-n" title="У роботі чи очікуванні без оновлень 7+ днів">Стоїть</th><th className="num w-n coo__wide" title="Закрив за 7 днів">Закрив</th><th className="num w-n coo__wide" title="Задач інших людей, де ця людина контролер">Контр.</th></tr></thead>
                <tbody>
                  {(snap?.people || []).map((p) => (
                    <tr key={p.name}>
                      <td className="coo__what" title={p.name}>{p.name}</td>
                      <td className="coo__why coo__wide" title={p.role}>{p.role}</td>
                      <td className={p.tg ? "fresh" : "stale"} title={p.tg ? "Отримує нагадування й питання" : "Не підключений: нехай напише боту /iam Імʼя"}>{p.tg ? "✓" : "немає"}</td>
                      <td className="num">{p.open || ""}</td>
                      <td className={`num${p.overdue ? " stale" : ""}`}>{p.overdue || ""}</td>
                      <td className="num">{p.stale || ""}</td>
                      <td className="num fresh coo__wide">{p.done_7d || ""}</td>
                      <td className="num coo__wide">{p.controls || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {settingsOpen && <AssistantSettings supabase={supabase} onClose={() => setSettingsOpen(false)} onError={setErr} />}
    </div>
  );
}

function AssistantSettings({ supabase, onClose, onError }) {
  const [st, setSt] = useState(null);
  const [memory, setMemory] = useState([]);
  const [note, setNote] = useState("");
  const [spent, setSpent] = useState({ today: 0, month: 0 });

  useEffect(() => {
    let on = true;
    (async () => {
      const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();
      const [s, m, u] = await Promise.all([
        supabase.from("coo_settings").select("key,value"),
        supabase.from("coo_memory").select("id,body,created_at").order("id"),
        supabase.from("ai_usage").select("at,cost_usd").like("purpose", "coo_%").gte("at", monthAgo),
      ]);
      if (!on) return;
      setSt(Object.fromEntries((s.data || []).map((r) => [r.key, r.value])));
      setMemory(m.data || []);
      const day = new Date().toDateString();
      setSpent({
        today: (u.data || []).filter((r) => new Date(r.at).toDateString() === day).reduce((a, r) => a + Number(r.cost_usd), 0),
        month: (u.data || []).reduce((a, r) => a + Number(r.cost_usd), 0),
      });
    })();
    return () => { on = false; };
  }, [supabase]);

  async function save(key, value) {
    setSt((s) => ({ ...s, [key]: value }));
    const { error } = await supabase.from("coo_settings").upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) onError("Не збережено: " + error.message);
  }
  async function addNote() {
    const body = note.trim();
    if (!body) return;
    const { data, error } = await supabase.from("coo_memory").insert({ body }).select("id,body,created_at").single();
    if (error) { onError("Не записано: " + error.message); return; }
    setMemory((m) => [...m, data]); setNote("");
  }
  async function dropNote(id) {
    const { error } = await supabase.from("coo_memory").delete().eq("id", id);
    if (error) { onError("Не видалено: " + error.message); return; }
    setMemory((m) => m.filter((x) => x.id !== id));
  }

  const tp = st?.team_pings || {};
  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Налаштування Асистента</h2>
        {!st ? <div className="empty">Завантаження…</div> : (
          <>
            <label className="coo__check"><input type="checkbox" checked={st.brief?.enabled !== false} onChange={(e) => save("brief", { ...st.brief, enabled: e.target.checked })} />
              <span>☀️ Ранкове зведення мені в Telegram о 08:30 (пн–сб)</span></label>
            <label className="coo__check"><input type="checkbox" checked={!!tp.enabled} onChange={(e) => save("team_pings", { ...tp, enabled: e.target.checked })} />
              <span>💬 Асистент сам питає виконавців про прострочені задачі й задачі без руху (будні, 9–18, лише тих, хто підключив бота)</span></label>
            <div className="form-row coo__inline">
              <label>Питань одній людині на день, не більше</label>
              <input type="number" min={1} max={10} value={tp.max_per_day ?? 3} onChange={(e) => save("team_pings", { ...tp, max_per_day: Math.max(1, Number(e.target.value) || 3) })} />
            </div>
            <div className="form-row coo__inline">
              <label>Модель ШІ</label>
              <select value={st.model || MODELS[0][0]} onChange={(e) => save("model", e.target.value)}>{MODELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </div>
            <div className="form-row coo__inline">
              <label>Стеля витрат на день, $</label>
              <input type="number" min={0.5} step={0.5} value={st.daily_usd ?? 3} onChange={(e) => save("daily_usd", Math.max(0.5, Number(e.target.value) || 3))} />
            </div>
            <div className="stat-row"><span>Витрати Асистента на ШІ:</span><b>сьогодні ${spent.today.toFixed(2)}</b><span>за 30 днів ${spent.month.toFixed(2)}</span></div>

            <h4>Памʼять — правила й домовленості, які Асистент враховує завжди</h4>
            {memory.map((m) => (
              <div key={m.id} className="coo__mem"><span>{m.body}</span><button type="button" className="icon-x" onClick={() => dropNote(m.id)} title="Забути">×</button></div>
            ))}
            {!memory.length && <div className="note">Поки порожньо. Скажіть Асистенту «запамʼятай…» або додайте тут.</div>}
            <div className="coo__memadd">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Напр.: рахунки клієнтам виставляє лише Оксана" onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} />
              <button type="button" className="btn" onClick={addNote} disabled={!note.trim()}>Додати</button>
            </div>
          </>
        )}
        <div className="modal-actions"><button type="button" className="btn primary" onClick={onClose}>Готово</button></div>
      </div>
    </div>
  );
}

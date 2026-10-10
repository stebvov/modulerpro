"use client";

// 📡 Радар Telegram: повідомлення з публічних груп, де шукають або обговорюють модульні будинки.
// Радар лише знаходить і оцінює (ключові слова → ШІ); відповідає людині менеджер — сам, від імені компанії.
// Знахідка = посилання на повідомлення + автор + оцінка й короткий зміст; тексту повідомлень система не зберігає.
// Групи читає окремий Telegram-акаунт компанії (підключається в налаштуваннях), обхід — кожні 10 хвилин.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SettingsButton from "@/components/SettingsButton";
import TgTargets from "@/components/TgTargets";
import "./tg-radar.css";

const STATUS = { new: "Нова", work: "У роботі", replied: "Відповіли", lead: "Лід", skip: "Не наш" };
const TABS = [["new", "Нові"], ["work", "У роботі"], ["replied", "Відповіли"], ["lead", "Ліди"], ["skip", "Не наші"], ["", "Усі"]];
const INTENT = { buy: "хоче купити", choose: "вибирає", price: "питає ціну", discuss: "обговорює", offer: "продає сам", other: "згадка" };
const ACC = { none: "не підключено", code_sent: "чекає код із Telegram", password: "чекає пароль двоетапної перевірки", ok: "підключено", error: "потрібно підключити заново" };
const when = (ts) => (ts ? new Date(ts).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const num = (n) => (n == null ? "—" : Number(n).toLocaleString("uk-UA"));
const scoreCls = (n) => (n >= 8 ? "hot" : n >= 6 ? "warm" : "cold");
const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);
// «t.me/назва», «@назва», «https://t.me/назва/123» → назва
const parseNames = (s) => [...new Set(String(s || "").split(/[\s,;]+/).map((x) => x.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "").replace(/^@/, "").split(/[/?]/)[0].toLowerCase()).filter((x) => /^[a-z0-9_]{4,40}$/.test(x)))];

async function api(path, body) {
  const r = await fetch(`/api/tg-radar/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && !j.error) j.error = `Помилка сервера (${r.status})`;
  return j;
}

export default function TgRadarScreen() {
  const supabase = useMemo(() => createClient(), []);
  const [can, setCan] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [me, setMe] = useState("");
  const [view, setView] = useState("hits");        // hits | groups
  const [tab, setTab] = useState("new");
  const [hits, setHits] = useState(null);
  const [groups, setGroups] = useState([]);
  const [settings, setSettings] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [panel, setPanel] = useState(null);        // settings | add | find
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [h, g, s, r] = await Promise.all([
      supabase.from("tgr_hits").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("tgr_groups").select("id,username,title,members,kind,active,last_checked_at,last_error,seen,hits,note,added_at").order("title"),
      supabase.from("tgr_settings").select("*").maybeSingle(),
      supabase.from("tgr_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (h.error) setMsg("Не вдалося завантажити знахідки: " + h.error.message);
    setHits(h.data || []); setGroups(g.data || []); setSettings(s.data || null); setLastRun(r.data || null);
  }, [supabase]);

  useEffect(() => {
    supabase.rpc("tgr_can").then(({ data }) => { setCan(data === true); if (data === true) load(); });
    supabase.rpc("tgr_admin").then(({ data }) => setAdmin(data === true));
    supabase.auth.getUser().then(({ data }) => setMe(data?.user?.email || ""));
  }, [supabase, load]);

  // пряме посилання зі сповіщення: ?s=tg-radar&hit=<id>
  const linked = useRef(false);
  useEffect(() => {
    if (!hits || linked.current) return;
    linked.current = true;
    const url = new URL(window.location.href);
    const id = Number(url.searchParams.get("hit"));
    if (!id) return;
    url.searchParams.delete("hit");
    window.history.replaceState(null, "", url.pathname + url.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hits.some((x) => x.id === id)) { setTab(""); setOpenId(id); }
  }, [hits]);

  const gById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  if (can === null || (can && hits === null)) return <div className="empty">Завантаження радара…</div>;
  if (!can) return <div className="empty">Радар Telegram доступний менеджерам продажу, керівникам і засновнику.</div>;

  const shown = hits.filter((h) => !tab || h.status === tab);
  const count = (s) => hits.filter((h) => !s || h.status === s).length;
  const opened = openId ? hits.find((h) => h.id === openId) : null;
  const accOk = settings?.acc_state === "ok";

  async function patchHit(id, patch) {
    const full = { ...patch, updated_at: new Date().toISOString(), ...(patch.status && patch.status !== "new" ? { taken_by: me || null } : {}) };
    setHits((hs) => hs.map((h) => (h.id === id ? { ...h, ...full } : h)));
    const { error } = await supabase.from("tgr_hits").update(full).eq("id", id);
    if (error) { setMsg("Не збережено: " + error.message); load(); }
  }
  async function runNow() {
    setBusy(true); setMsg("");
    const r = await api("run");
    setBusy(false);
    setMsg(r.error || r.skipped || `Обхід завершено: груп ${r.groups}, повідомлень ${num(r.messages)}, підійшло за словами ${r.candidates}, нових знахідок ${r.hits}.`);
    load();
  }
  async function toggleGroup(g) {
    setGroups((gs) => gs.map((x) => (x.id === g.id ? { ...x, active: !g.active } : x)));
    const { error } = await supabase.from("tgr_groups").update({ active: !g.active }).eq("id", g.id);
    if (error) { setMsg("Не збережено: " + error.message); load(); }
  }
  async function removeGroup(g) {
    if (!window.confirm(`Прибрати групу «${g.title || "@" + g.username}» з радара? Її знахідки теж зникнуть.`)) return;
    const { error } = await supabase.from("tgr_groups").delete().eq("id", g.id);
    if (error) setMsg("Не видалено: " + error.message);
    load();
  }
  async function addGroups(list) {
    const have = new Set(groups.map((g) => g.username));
    const rows = list.filter((g) => !have.has(g.username)).map((g) => ({ username: g.username, title: g.title || null, members: g.members || null, kind: g.kind || "group", added_by: me || null }));
    if (!rows.length) return 0;
    const { error } = await supabase.from("tgr_groups").insert(rows);
    if (error) { setMsg("Не додано: " + error.message); return 0; }
    await load();
    return rows.length;
  }

  return (
    <div className="tgr">
      {msg && <div className="tgr__msg" onClick={() => setMsg("")}>{msg}</div>}

      {!accOk && (
        <div className="tgr__warn">
          Радар ще не слухає групи: Telegram-акаунт {ACC[settings?.acc_state || "none"]}.{settings?.acc_error ? ` ${settings.acc_error}.` : ""}{" "}
          {admin ? <button type="button" className="btn small" onClick={() => setPanel("settings")}>Підключити</button> : "Підключає засновник або адмін."}
        </div>
      )}
      {accOk && !settings.enabled && <div className="tgr__warn">Розклад вимкнено — радар перевіряє групи лише кнопкою «Перевірити зараз».{admin && <> <button type="button" className="btn small" onClick={() => setPanel("settings")}>Увімкнути</button></>}</div>}

      <div className="toolbar">
        <div className="toolbar-left tgr__views">
          <button type="button" className={`subtab${view === "hits" ? " active" : ""}`} onClick={() => setView("hits")}>Знахідки · {hits.length}</button>
          <button type="button" className={`subtab${view === "groups" ? " active" : ""}`} onClick={() => setView("groups")}>Групи · {groups.length}</button>
          <span className="note tgr__last">{lastRun ? `Останній обхід ${when(lastRun.started_at)}: груп ${lastRun.groups}, нових знахідок ${lastRun.hits}${lastRun.error ? " · є помилки" : ""}` : "Обходів ще не було"}</span>
        </div>
        <div className="toolbar-actions">
          {view === "groups" && <button type="button" className="btn" onClick={() => setPanel("find")} title="Пошук публічних груп за словами — як у Telegram">🔎 Знайти в Telegram</button>}
          {view === "groups" && <button type="button" className="btn" onClick={() => setPanel("add")}>+ Додати групу</button>}
          <button type="button" className="btn" disabled={busy || !accOk} onClick={runNow} title="Обійти групи зараз, не чекаючи розкладу">{busy ? "Перевіряю…" : "↻ Перевірити зараз"}</button>
          {admin && <SettingsButton title="Налаштування радара й Telegram-акаунт" onClick={() => setPanel("settings")} />}
        </div>
      </div>

      {view === "hits" ? (
        <>
          <div className="tgr__tabs">
            {TABS.map(([k, l]) => <button key={k} type="button" className={`kb-chip tgr-chip${tab === k ? " on" : ""}`} onClick={() => setTab(k)}>{l} · {count(k)}</button>)}
          </div>
          <div className="tgr__list">
            {shown.map((h) => {
              const g = gById.get(h.group_id);
              return (
                <button key={h.id} type="button" className="tgr-row" onClick={() => setOpenId(h.id)}>
                  <span className={`tgr-score tgr-score--${scoreCls(h.score)}`} title="Оцінка ШІ: наскільки це наш клієнт">{h.score}</span>
                  <span className="tgr-row__main">
                    <span className="tgr-row__title">{h.summary || "(без опису)"}</span>
                    <span className="tgr-row__meta">
                      <span>{INTENT[h.intent] || h.intent}</span>
                      <span>{g?.title || (g ? "@" + g.username : "група")}</span>
                      {(h.author_name || h.author_username) && <span>{h.author_name || "@" + h.author_username}</span>}
                      <span>{when(h.msg_at || h.created_at)}</span>
                      {!tab && <span className={`tgr-st tgr-st--${h.status}`}>{STATUS[h.status]}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
            {!shown.length && <div className="empty">{hits.length ? "У цій вкладці порожньо." : accOk ? "Знахідок ще немає. Додайте групи й натисніть «Перевірити зараз»." : "Знахідки зʼявляться, коли підключите Telegram-акаунт і додасте групи."}</div>}
          </div>
        </>
      ) : (
        <div className="table-wrap tgr__groups">
          <table>
            <thead><tr><th>Група</th><th className="num">Учасників</th><th>Перевірено</th><th className="num">Переглянуто</th><th className="num">Знахідок</th><th>Слухаємо</th><th /></tr></thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className={g.active ? "" : "tgr-off"}>
                  <td>
                    <a href={`https://t.me/${g.username}`} target="_blank" rel="noreferrer">{g.title || "@" + g.username}</a>
                    <div className="note">@{g.username}{g.kind === "channel" ? " · канал (повідомлень від людей зазвичай немає)" : ""}{g.last_error ? <span className="tgr-err"> · {g.last_error}</span> : ""}</div>
                  </td>
                  <td className="num">{num(g.members)}</td>
                  <td>{when(g.last_checked_at)}</td>
                  <td className="num">{num(g.seen)}</td>
                  <td className="num">{num(g.hits)}</td>
                  <td><label className="tag-check"><input type="checkbox" checked={g.active} onChange={() => toggleGroup(g)} /> {g.active ? "так" : "ні"}</label></td>
                  <td>{admin && <button type="button" className="btn small" onClick={() => removeGroup(g)} title="Прибрати групу з радара" aria-label="Прибрати групу">×</button>}</td>
                </tr>
              ))}
              {!groups.length && <tr><td colSpan={7} className="empty">Груп ще немає. «Знайти в Telegram» — пошук за словами («будівництво», «дача», «ділянки Київська область»), або «+ Додати групу» — якщо знаєте посилання.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {opened && <HitModal h={opened} g={gById.get(opened.group_id)} supabase={supabase} onClose={() => setOpenId(null)} onPatch={patchHit} onLead={load} onError={setMsg} />}
      {panel === "add" && <AddGroups onClose={() => setPanel(null)} onAdd={addGroups} />}
      {panel === "find" && <FindGroups accOk={accOk} onClose={() => setPanel(null)} onAdd={addGroups} />}
      {panel === "settings" && settings && <Settings s={settings} supabase={supabase} me={me} onClose={() => { setPanel(null); load(); }} onError={setMsg} />}
    </div>
  );
}

function HitModal({ h, g, supabase, onClose, onPatch, onLead, onError }) {
  const [note, setNote] = useState(h.note || "");
  const [lead, setLead] = useState(null);          // { name, contact } — форма «у ліди»
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const link = g ? `https://t.me/${g.username}/${h.msg_id}` : null;
  async function makeLead() {
    setBusy(true);
    const { error } = await supabase.rpc("tgr_make_lead", { p_hit: h.id, p_name: lead.name, p_contact: lead.contact });
    setBusy(false);
    if (error) { onError("Лід не створено: " + error.message); return; }
    setLead(null); onLead();
  }
  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal tgr-modal">
        <div className="tgr-modal__bar">
          <span className={`tgr-score tgr-score--${scoreCls(h.score)}`}>{h.score}</span>
          <span className="note">{INTENT[h.intent] || h.intent} · {when(h.msg_at || h.created_at)}</span>
          <span className={`tgr-st tgr-st--${h.status}`}>{STATUS[h.status]}</span>
          <button type="button" className="btn small tgr-modal__x" onClick={onClose} aria-label="Закрити">✕</button>
        </div>
        <h2>{h.summary || "(без опису)"}</h2>
        <div className="tgr-facts">
          <span>Група: <b>{g?.title || (g ? "@" + g.username : "—")}</b></span>
          {(h.author_name || h.author_username) && <span>Автор: <b>{h.author_name || ""}</b>{h.author_username && <> <a href={`https://t.me/${h.author_username}`} target="_blank" rel="noreferrer">@{h.author_username}</a></>}</span>}
          {!!h.matched?.length && <span>Слова: {h.matched.join(", ")}</span>}
        </div>
        {link && <a className="btn primary tgr-open" href={link} target="_blank" rel="noreferrer">Відкрити повідомлення в Telegram ↗</a>}
        {h.reply_draft && (
          <div className="kb-block">
            <div className="kb-block__label">Чернетка відповіді (перечитайте й поправте під себе)</div>
            <div className="tgr-draft">{h.reply_draft}</div>
            <button type="button" className="btn small" onClick={() => { navigator.clipboard?.writeText(h.reply_draft); setCopied(true); }}>{copied ? "Скопійовано ✓" : "Скопіювати"}</button>
          </div>
        )}
        <div className="form-row">
          <label>Нотатка</label>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note.trim() !== (h.note || "") && onPatch(h.id, { note: note.trim() || null })} placeholder="Що відповіли, про що домовились" />
        </div>
        {lead ? (
          <div className="tgr-lead">
            <div className="form-row"><label>Імʼя</label><input value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} autoFocus /></div>
            <div className="form-row"><label>Контакт (телефон або Telegram)</label><input value={lead.contact} onChange={(e) => setLead({ ...lead, contact: e.target.value })} /></div>
            <div className="tgr-acts">
              <button type="button" className="btn" onClick={() => setLead(null)}>Скасувати</button>
              <button type="button" className="btn primary" disabled={busy || !lead.name.trim()} onClick={makeLead}>{busy ? "Створюю…" : "Створити лід і угоду"}</button>
            </div>
          </div>
        ) : (
          <div className="tgr-acts">
            {h.status !== "work" && h.status !== "lead" && <button type="button" className="btn" onClick={() => onPatch(h.id, { status: "work" })}>Беру в роботу</button>}
            {h.status !== "replied" && h.status !== "lead" && <button type="button" className="btn" onClick={() => onPatch(h.id, { status: "replied" })}>Відповіли</button>}
            {h.status !== "skip" && h.status !== "lead" && <button type="button" className="btn" onClick={() => { onPatch(h.id, { status: "skip" }); onClose(); }}>Не наш</button>}
            {h.status === "lead" ? <span className="note">Лід у CRM створено{h.taken_by ? ` · ${h.taken_by}` : ""}</span>
              : <button type="button" className="btn primary" onClick={() => setLead({ name: h.author_name || "", contact: h.author_username ? "Telegram @" + h.author_username : "" })}>→ У ліди CRM</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function AddGroups({ onClose, onAdd }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const names = parseNames(text);
  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Додати групи</h2>
        <div className="form-row">
          <label>Посилання або назви публічних груп — по одній у рядку</label>
          <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={"https://t.me/назва_групи\n@інша_група"} autoFocus />
        </div>
        <p className="note">Радар читає лише публічні групи (з адресою t.me/назва). Закриті групи за запрошенням не підходять. Розпізнано: {names.length}.</p>
        <div className="tgr-acts">
          <button type="button" className="btn" onClick={onClose}>Скасувати</button>
          <button type="button" className="btn primary" disabled={!names.length || busy} onClick={async () => { setBusy(true); await onAdd(names.map((username) => ({ username }))); onClose(); }}>Додати</button>
        </div>
      </div>
    </div>
  );
}

const IDEAS = ["модульний будинок", "будівництво будинку", "каркасний будинок", "дача", "ділянки Київська область", "котеджне містечко", "глемпінг"];

function FindGroups({ accOk, onClose, onAdd }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState(null);
  const [pick, setPick] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function search(text) {
    const s = (text ?? q).trim();
    if (s.length < 3 || busy) return;
    setQ(s); setBusy(true); setErr("");
    const r = await api("groups", { q: s });
    setBusy(false);
    if (r.error) { setErr(r.error); return; }
    setList(r.groups || []); setPick(new Set());
  }
  const toggle = (u) => { const n = new Set(pick); if (n.has(u)) n.delete(u); else n.add(u); setPick(n); };
  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal tgr-find">
        <h2>Знайти групи в Telegram</h2>
        {!accOk && <p className="tgr__warn">Пошук працює після підключення Telegram-акаунта.</p>}
        <div className="tgr-find__row">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Слово чи фраза, як у пошуку Telegram" autoFocus />
          <button type="button" className="btn primary" disabled={busy || q.trim().length < 3} onClick={() => search()}>{busy ? "Шукаю…" : "Шукати"}</button>
        </div>
        <div className="tgr__tabs">{IDEAS.map((x) => <button key={x} type="button" className="kb-chip" onClick={() => search(x)}>{x}</button>)}</div>
        {err && <div className="auth-error">{err}</div>}
        {list && (
          <div className="tgr-find__list">
            {list.map((g) => (
              <label key={g.username} className={`tgr-find__item${g.added ? " added" : ""}`}>
                <input type="checkbox" disabled={g.added} checked={g.added || pick.has(g.username)} onChange={() => toggle(g.username)} />
                <span>{g.title || "@" + g.username}<small>@{g.username} · {g.kind === "channel" ? "канал" : "група"}{g.members ? ` · ${num(g.members)} учасників` : ""}{g.added ? " · уже в радарі" : ""}</small></span>
              </label>
            ))}
            {!list.length && <span className="note">Нічого не знайдено — спробуйте інше слово.</span>}
          </div>
        )}
        <p className="note">Telegram показує лише частину груп за кожним словом — шукайте різними фразами. Для радара корисні саме групи (де пишуть люди), а не канали.</p>
        <div className="tgr-acts">
          <button type="button" className="btn" onClick={onClose}>Закрити</button>
          <button type="button" className="btn primary" disabled={!pick.size} onClick={async () => { await onAdd((list || []).filter((g) => pick.has(g.username))); onClose(); }}>Додати вибрані · {pick.size}</button>
        </div>
      </div>
    </div>
  );
}

function Settings({ s, supabase, me, onClose, onError }) {
  const [f, setF] = useState({ enabled: s.enabled, keywords: (s.keywords || []).join("\n"), stop_words: (s.stop_words || []).join("\n"), brief: s.brief || "", min_score: s.min_score, daily_usd: s.daily_usd, notify_owner: s.notify_owner, tg_chats: s.tg_chats || "" });
  const [acc, setAcc] = useState({ state: s.acc_state, label: s.acc_label, error: s.acc_error });
  const [form, setForm] = useState({ api_id: "", api_hash: "", phone: "", code: "", password: "" });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [probe, setProbe] = useState({ text: "", res: null });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy("save");
    const { error } = await supabase.from("tgr_settings").update({
      enabled: f.enabled && acc.state === "ok", keywords: lines(f.keywords), stop_words: lines(f.stop_words), brief: f.brief.trim(),
      min_score: Math.max(1, Math.min(10, Number(f.min_score) || 6)), daily_usd: Math.max(0, Number(f.daily_usd) || 0),
      notify_owner: f.notify_owner, tg_chats: f.tg_chats, updated_at: new Date().toISOString(), updated_by: me || null,
    }).eq("id", true);
    setBusy("");
    if (error) { onError("Не збережено: " + error.message); return; }
    onClose();
  }
  async function account(action, extra = {}) {
    setBusy(action); setErr("");
    const r = await api("account", { action, ...extra });
    setBusy("");
    if (r.error) { setErr(r.error); return; }
    setAcc({ state: r.state, label: r.label ?? acc.label, error: null });
    setForm((x) => ({ ...x, code: "", password: "" }));
  }
  async function runProbe() {
    setBusy("probe");
    const r = await api("probe", { text: probe.text });
    setBusy("");
    setProbe((p) => ({ ...p, res: r }));
  }

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal tgr-set">
        <h2>Налаштування радара</h2>

        <div className="kb-block">
          <div className="kb-block__label">Telegram-акаунт, яким читаємо групи</div>
          <p className="tgr-set__state">Стан: <b>{ACC[acc.state]}</b>{acc.label ? ` — ${acc.label}` : ""}</p>
          {err && <div className="auth-error" onClick={() => setErr("")}>{err}</div>}
          {(acc.state === "none" || acc.state === "error") && (
            <>
              <p className="note">Потрібен окремий акаунт компанії (не особистий). Зайдіть із його номера на my.telegram.org → API development tools, створіть застосунок і скопіюйте сюди api_id та api_hash. Код входу Telegram надішле в цей акаунт.</p>
              <div className="tgr-set__grid">
                <div className="form-row"><label>api_id</label><input value={form.api_id} onChange={(e) => setForm({ ...form, api_id: e.target.value })} inputMode="numeric" autoComplete="off" /></div>
                <div className="form-row"><label>api_hash</label><input value={form.api_hash} onChange={(e) => setForm({ ...form, api_hash: e.target.value })} autoComplete="off" /></div>
                <div className="form-row"><label>Номер телефону акаунта</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+380…" inputMode="tel" autoComplete="off" /></div>
              </div>
              <button type="button" className="btn primary" disabled={!!busy || !form.api_id || !form.api_hash || !form.phone} onClick={() => account("start", form)}>{busy === "start" ? "Надсилаю код…" : "Отримати код"}</button>
            </>
          )}
          {acc.state === "code_sent" && (
            <div className="tgr-set__grid">
              <div className="form-row"><label>Код із Telegram (прийде в цей акаунт повідомленням від «Telegram»)</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} inputMode="numeric" autoComplete="one-time-code" autoFocus /></div>
              <div className="tgr-acts">
                <button type="button" className="btn" disabled={!!busy} onClick={() => account("logout")}>Почати заново</button>
                <button type="button" className="btn primary" disabled={!!busy || form.code.trim().length < 4} onClick={() => account("code", { code: form.code })}>{busy === "code" ? "Перевіряю…" : "Підтвердити"}</button>
              </div>
            </div>
          )}
          {acc.state === "password" && (
            <div className="tgr-set__grid">
              <div className="form-row"><label>Пароль двоетапної перевірки Telegram</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="off" autoFocus /></div>
              <div className="tgr-acts">
                <button type="button" className="btn" disabled={!!busy} onClick={() => account("logout")}>Почати заново</button>
                <button type="button" className="btn primary" disabled={!!busy || !form.password} onClick={() => account("password", { password: form.password })}>{busy === "password" ? "Перевіряю…" : "Увійти"}</button>
              </div>
            </div>
          )}
          {acc.state === "ok" && (
            <div className="tgr-acts tgr-acts--left">
              <button type="button" className="btn small" disabled={!!busy} onClick={() => account("check")}>{busy === "check" ? "Перевіряю…" : "Перевірити звʼязок"}</button>
              <button type="button" className="btn small" disabled={!!busy} onClick={() => window.confirm("Відʼєднати Telegram-акаунт? Радар перестане читати групи, ключі буде стерто.") && account("logout")}>Відʼєднати</button>
            </div>
          )}
        </div>

        <label className="tag-check tgr-set__on"><input type="checkbox" checked={f.enabled && acc.state === "ok"} disabled={acc.state !== "ok"} onChange={(e) => set("enabled", e.target.checked)} /> Перевіряти групи автоматично, кожні 10 хвилин</label>

        <div className="tgr-set__grid tgr-set__grid--2">
          <div className="form-row">
            <label>Ключові слова — по одному в рядку</label>
            <textarea rows={8} value={f.keywords} onChange={(e) => set("keywords", e.target.value)} />
            <span className="note">Слово або його початок («модульн» знайде «модульний», «модульного»). Кілька слів у рядку — мають бути всі («дачн будин»).</span>
          </div>
          <div className="form-row">
            <label>Стоп-слова — по одному в рядку</label>
            <textarea rows={8} value={f.stop_words} onChange={(e) => set("stop_words", e.target.value)} />
            <span className="note">Повідомлення з таким словом радар пропускає одразу, без ШІ.</span>
          </div>
        </div>
        <div className="form-row">
          <label>Кого шукаємо — пояснення для ШІ своїми словами</label>
          <textarea rows={6} value={f.brief} onChange={(e) => set("brief", e.target.value)} />
        </div>
        <div className="tgr-set__grid tgr-set__grid--2">
          <div className="form-row"><label>Сповіщати від оцінки (1–10)</label><input type="number" min={1} max={10} value={f.min_score} onChange={(e) => set("min_score", e.target.value)} /></div>
          <div className="form-row"><label>Стеля витрат на ШІ, $ на день</label><input type="number" min={0} step={0.5} value={f.daily_usd} onChange={(e) => set("daily_usd", e.target.value)} /></div>
        </div>
        <div className="kb-block">
          <div className="kb-block__label">Куди слати знахідки в Telegram</div>
          <TgTargets notifyOwner={f.notify_owner} chats={f.tg_chats} onChange={(p) => setF((x) => ({ ...x, ...p }))} />
        </div>

        <div className="kb-block">
          <div className="kb-block__label">Перевірити на прикладі</div>
          <textarea rows={3} value={probe.text} onChange={(e) => setProbe({ text: e.target.value, res: null })} placeholder="Вставте текст повідомлення з чату — побачите, як радар його оцінить (за збереженими словами й описом)" />
          <button type="button" className="btn small" disabled={!!busy || probe.text.trim().length < 12} onClick={runProbe}>{busy === "probe" ? "Оцінюю…" : "Оцінити"}</button>
          {probe.res && (
            <div className="tgr-probe">
              <div>Ключові слова: {probe.res.matched?.length ? <b>{probe.res.matched.join(", ")}</b> : <b>не спрацювали — радар таке повідомлення до ШІ не передасть</b>}</div>
              {probe.res.error ? <div className="tgr-err">{probe.res.error}</div> : (
                <>
                  <div>Оцінка ШІ: <b>{probe.res.score}/10</b> · {INTENT[probe.res.intent]} · {probe.res.notify ? "сповіщення прийшло б" : "без сповіщення"}</div>
                  <div>{probe.res.summary}</div>
                  {probe.res.reply && <div className="tgr-draft">{probe.res.reply}</div>}
                </>
              )}
            </div>
          )}
        </div>

        <div className="tgr-acts tgr-set__foot">
          <button type="button" className="btn" onClick={onClose}>Закрити</button>
          <button type="button" className="btn primary" disabled={!!busy} onClick={save}>{busy === "save" ? "Зберігаю…" : "Зберегти"}</button>
        </div>
      </div>
    </div>
  );
}

"use client";

// 📖 База знань: що компанія знає про свою роботу — з документів, робочих чатів і слів засновника.
// Записи приходять із локального «університету знань» (таблиця kb_items, завантажує функція kb-sync).
// Кожен запис має статус перевірки: ✅ затверджено · 🟡 з джерел, не перевірено · ❓ потребує уточнення.
// Засновник бачить усе й ставить статус; у режимі «команда» решта бачать лише затверджені записи «для команди» (RLS).
// Окремим записом можна поділитися з людьми чи посадами (як файлом на Google Диску) — вони бачать його одразу.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SearchFilter from "@/components/SearchFilter";
import SettingsButton from "@/components/SettingsButton";
import KbText from "@/components/kb/KbText";
import "./knowledge.css";

const STATUS = {
  approved: { icon: "✅", label: "Затверджено", short: "Затверджено" },
  unverified: { icon: "🟡", label: "З джерел, не перевірено", short: "Не перевірено" },
  needs_check: { icon: "❓", label: "Потребує уточнення", short: "Уточнити" },
};
const TABS = [["", "Усі"], ["approved", "✅ Затверджено"], ["unverified", "🟡 Не перевірено"], ["needs_check", "❓ Уточнити"]];
const KIND = { synthesis: "Огляд теми", claim: "Висновок", note: "Факт" };
const KIND_ORDER = { synthesis: 0, claim: 1, note: 2 };
const KINDS = [["", "Усі типи"], ["synthesis", "Огляди тем"], ["claim", "Висновки"], ["note", "Факти"]];
const CONF = { H: "висока", M: "середня", L: "низька" };
// теми — у порядку шляху будинку: завод → доставка → містечка → сервіс → продаж → керування
const TOPICS = [
  ["construction-tech", "Технологія будівництва"], ["production-site", "Виробнича площадка"], ["production-economics", "Собівартість і ціни"],
  ["engineering", "Інженерні системи"], ["regulations-ua", "Норми й сертифікати"], ["logistics", "Перевезення"], ["site-prep", "Фундамент і мережі"],
  ["installation", "Монтаж"], ["fit-out", "Меблі й наповнення"], ["landscaping", "Благоустрій"], ["land-and-permits", "Земля й дозволи"],
  ["town-economics", "Економіка містечок"], ["yield-and-investors", "Дохідність та інвестори"], ["property-management", "Керуюча компанія"],
  ["rentals", "Оренда"], ["marketing", "Маркетинг"], ["sales", "Продаж"], ["org-and-hiring", "Команда й найм"], ["ai-agents", "ШІ й автоматизація"],
  ["stack-practices", "Система Moduler Pro"],
];
const topicName = (k) => TOPICS.find(([x]) => x === k)?.[1] || k;
const REL = { supports: "підтверджує", refines: "уточнює", generalizes: "узагальнює", contradicts: "суперечить", evidence: "доказ", mentions: "спирається на" };
const REL_IN = { supports: "підтверджено записом", refines: "уточнено записом", generalizes: "узагальнено записом", contradicts: "суперечить запис" };
const SRC_TYPE = { "internal-chat": "робочий чат", "internal-doc": "внутрішній документ", "founder-statement": "слова засновника" };
const LIST = "id,kind,title,topics,confidence,status,audience,share_members,share_roles,stale,review_note,src_created,synced_at";
const shareCount = (r) => (r.share_members?.length || 0) + (r.share_roles?.length || 0);
const PAGE = 60;
const day = (d) => (d ? new Date(d).toLocaleDateString("uk-UA") : "");
const openQ = (r) => r.status === "pending" || r.status === "asked" || /^(відкрите|частково|відкладено|дія)/.test(r.resolution || "");

export default function KnowledgeScreen() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [teamMode, setTeamMode] = useState(false);
  const [tab, setTab] = useState("");            // статус або "questions"
  const [topic, setTopic] = useState("");
  const [kind, setKind] = useState("");
  const [conf, setConf] = useState("");
  const [aud, setAud] = useState("");
  const [staleOnly, setStaleOnly] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState(null);      // id → чи збіг у назві (пошук по тексту на сервері)
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState(null);
  const [back, setBack] = useState([]);          // звідки прийшли по посиланнях між записами
  const [detail, setDetail] = useState({});
  const [autoNext, setAutoNext] = useState(true);
  const [questions, setQuestions] = useState(null);
  const [panel, setPanel] = useState(null);      // "settings" | "add" | "share"
  const [people, setPeople] = useState([]);      // кому можна відкрити запис: люди команди
  const [roles, setRoles] = useState([]);        // …і посади
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const all = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("kb_items").select(LIST).eq("removed", false).order("id").range(from, from + 999);
      if (error) { setMsg("Не вдалося завантажити базу знань: " + error.message); break; }
      all.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    setRows(all);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    supabase.rpc("pult_is_owner").then(({ data }) => setIsOwner(data === true));
    supabase.from("kb_settings").select("team_mode").maybeSingle().then(({ data }) => setTeamMode(!!data?.team_mode));
  }, [load, supabase]);

  useEffect(() => {
    if (!isOwner) return;
    supabase.from("task_members").select("id,name,role,hr_role,is_owner,is_ai").eq("active", true).order("name")
      .then(({ data }) => setPeople((data || []).filter((m) => !m.is_owner && !m.is_ai)));
    supabase.from("hr_roles").select("key,name").eq("active", true).order("sort").then(({ data }) => setRoles(data || []));
  }, [isOwner, supabase]);

  // пошук по тексту записів — на сервері, з паузою; по назві — одразу тут
  useEffect(() => {
    const s = q.trim();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s.length < 3) { setFound(null); return; }
    let on = true;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("kb_search", { p_q: s });
      if (on) setFound(new Map((data || []).map((r) => [r.id, r.in_title])));
    }, 350);
    return () => { on = false; clearTimeout(t); };
  }, [q, supabase]);

  useEffect(() => {
    if (!openId || detail[openId]) return;
    supabase.from("kb_items").select("id,body,sources,links,extra,reviewed_at,reviewed_by").eq("id", openId).maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) { setMsg("Запис не відкрився" + (error ? ": " + error.message : "")); return; }
        setDetail((d) => ({ ...d, [openId]: data }));
      });
  }, [openId, detail, supabase]);

  useEffect(() => {
    if (tab !== "questions" || questions || !isOwner) return;
    supabase.from("kb_survey").select("id,code,sort,prio,title,question,assumption,answer,status,resolution").order("sort")
      .then(({ data, error }) => { if (error) setMsg("Питання не завантажились: " + error.message); setQuestions(data || []); });
  }, [tab, questions, isOwner, supabase]);

  const byId = useMemo(() => new Map((rows || []).map((r) => [r.id, r])), [rows]);
  // пряме посилання на запис (його дає бот бази знань): ?s=kb&kb=<id> — відкриваємо один раз і прибираємо з адреси
  const linked = useRef(false);
  useEffect(() => {
    if (!rows || linked.current) return;
    linked.current = true;
    const url = new URL(window.location.href);
    const id = url.searchParams.get("kb");
    if (!id) return;
    url.searchParams.delete("kb");
    window.history.replaceState(null, "", url.pathname + url.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (byId.has(id)) setOpenId(id);
  }, [rows, byId]);
  const titleOf = useCallback((id) => byId.get(id)?.title || "", [byId]);

  const words = useMemo(() => q.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 1), [q]);
  // фільтри: окремо рахуємо «усе, крім статусу» й «усе, крім теми» — для лічильників на вкладках і темах
  const pass = useCallback((r, skip) => {
    if (kind && r.kind !== kind) return false;
    if (conf && r.confidence !== conf) return false;
    if (aud === "team" && r.audience !== "team") return false;
    if (aud === "shared" && !shareCount(r)) return false;
    if (aud === "owner" && (r.audience === "team" || shareCount(r))) return false;
    if (staleOnly && !r.stale) return false;
    if (skip !== "topic" && topic && !(r.topics || []).includes(topic)) return false;
    if (skip !== "status" && tab && tab !== "questions" && r.status !== tab) return false;
    if (words.length) {
      const t = r.title.toLowerCase();
      if (!words.every((w) => t.includes(w)) && !found?.has(r.id)) return false;
    }
    return true;
  }, [kind, conf, aud, staleOnly, topic, tab, words, found]);

  const shown = useMemo(() => {
    const inTitle = (r) => (words.length && words.every((w) => r.title.toLowerCase().includes(w)) ? 0 : 1);
    return (rows || []).filter((r) => pass(r)).sort((a, b) =>
      (words.length ? inTitle(a) - inTitle(b) : 0) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (b.src_created || "").localeCompare(a.src_created || "") || a.id.localeCompare(b.id));
  }, [rows, pass, words]);

  if (rows === null) return <div className="empty">Завантаження бази знань…</div>;

  const exceptStatus = rows.filter((r) => pass(r, "status"));
  const exceptTopic = rows.filter((r) => pass(r, "topic"));
  const count = (s) => (s ? exceptStatus.filter((r) => r.status === s).length : exceptStatus.length);
  const approved = rows.filter((r) => r.status === "approved").length;
  const forTeam = rows.filter((r) => r.status === "approved" && r.audience === "team").length;
  const activeFilters = [kind, conf, aud, staleOnly].filter(Boolean).length;
  const lastSync = rows.reduce((m, r) => (r.synced_at > m ? r.synced_at : m), "");

  function open(id, viaRef) {
    if (viaRef && openId) setBack((b) => [...b, openId]);
    if (!viaRef) setBack([]);
    setOpenId(id);
  }
  function close() { setOpenId(null); setBack([]); }
  function goBack() { setOpenId(back[back.length - 1]); setBack(back.slice(0, -1)); }

  async function review(id, patch, advance) {
    const idx = shown.findIndex((r) => r.id === id);
    const nextId = idx >= 0 ? shown[idx + 1]?.id || null : null;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch, ...(patch.status ? { stale: false } : {}) } : r)));
    const { error } = await supabase.from("kb_items").update(patch).eq("id", id);
    if (error) { setMsg("Не збережено: " + error.message); load(); return; }
    if (advance && autoNext && !back.length) { if (nextId) setOpenId(nextId); else close(); }
  }

  const opened = openId ? byId.get(openId) : null;
  const d = openId ? detail[openId] : null;
  const pos = opened ? shown.findIndex((r) => r.id === opened.id) : -1;

  return (
    <div className="kb">
      {msg && <div className="auth-error" onClick={() => setMsg("")}>{msg}</div>}

      {isOwner && (
        <div className="kb__progress" title="Скільки записів ви вже перевірили й затвердили">
          <div className="kb__bar"><span style={{ width: `${rows.length ? Math.round((approved / rows.length) * 100) : 0}%` }} /></div>
          <span className="note">Затверджено {approved} з {rows.length} · {teamMode ? `команда бачить ${forTeam}` : "базу бачите лише ви"}</span>
        </div>
      )}

      {isOwner && (
        <div className="kb__tabs">
          {TABS.map(([k, l]) => (
            <button key={k} type="button" className={`subtab${tab === k ? " active" : ""}`} onClick={() => { setTab(k); setLimit(PAGE); }}>{l} · {count(k)}</button>
          ))}
          <button type="button" className={`subtab${tab === "questions" ? " active" : ""}`} onClick={() => setTab("questions")}>Питання до вас</button>
        </div>
      )}

      {tab === "questions" ? <Questions rows={questions} supabase={supabase} onSaved={(id, patch) => setQuestions((qs) => qs.map((x) => (x.id === id ? { ...x, ...patch } : x)))} onError={setMsg} /> : (
        <>
          <div className="toolbar">
            <div className="toolbar-left">
              <SearchFilter value={q} onChange={(v) => { setQ(v); setLimit(PAGE); }} placeholder="Пошук по базі знань: фундамент, вікна, оплата бригади…" active={activeFilters}
                onReset={() => { setKind(""); setConf(""); setAud(""); setStaleOnly(false); }}>
                <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Тип запису">{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <select value={conf} onChange={(e) => setConf(e.target.value)} aria-label="Достовірність">
                  <option value="">Будь-яка достовірність</option><option value="H">Висока</option><option value="M">Середня</option><option value="L">Низька</option>
                </select>
                {isOwner && (
                  <select value={aud} onChange={(e) => setAud(e.target.value)} aria-label="Для кого">
                    <option value="">Будь-який доступ</option><option value="team">Для всієї команди</option><option value="shared">Поділено з людьми чи посадами</option><option value="owner">Лише для мене</option>
                  </select>
                )}
                {isOwner && <label className="tag-check"><input type="checkbox" checked={staleOnly} onChange={(e) => setStaleOnly(e.target.checked)} /> текст змінився після затвердження</label>}
              </SearchFilter>
            </div>
            {isOwner && (
              <div className="toolbar-actions">
                <button type="button" className="btn" onClick={() => setPanel("add")} title="Додати знання, виправлення або посилання — потрапить у базу після обробки">+ Додати</button>
                <SettingsButton title="Хто бачить базу знань" onClick={() => setPanel("settings")} />
              </div>
            )}
          </div>

          <div className="kb__topics">
            <button type="button" className={`kb-chip${!topic ? " on" : ""}`} onClick={() => { setTopic(""); setLimit(PAGE); }}>Усі теми · {exceptTopic.length}</button>
            {TOPICS.map(([k, l]) => {
              const n = exceptTopic.filter((r) => (r.topics || []).includes(k)).length;
              return n ? <button key={k} type="button" className={`kb-chip${topic === k ? " on" : ""}`} onClick={() => { setTopic(topic === k ? "" : k); setLimit(PAGE); }}>{l} · {n}</button> : null;
            })}
          </div>

          <div className="kb__list">
            {shown.slice(0, limit).map((r) => (
              <button key={r.id} type="button" className={`kb-row kb-row--${r.kind}`} onClick={() => open(r.id)}>
                {(isOwner || r.status !== "approved") && <span className="kb-row__st" title={STATUS[r.status].label}>{STATUS[r.status].icon}</span>}
                <span className="kb-row__main">
                  <span className="kb-row__title">{r.title}</span>
                  <span className="kb-row__meta">
                    <span className={`kb-kind kb-kind--${r.kind}`}>{KIND[r.kind]}</span>
                    {r.kind === "synthesis" ? (r.src_created && <span>оновлено {day(r.src_created)}</span>) : (r.topics || []).slice(0, 3).map((t) => <span key={t}>{topicName(t)}</span>)}
                    {r.confidence && <span>достовірність {CONF[r.confidence]}</span>}
                    {isOwner && r.audience === "team" && <span title="Після затвердження запис побачить команда">👥 для команди</span>}
                    {isOwner && shareCount(r) > 0 && <span title="Запис відкрито окремим людям чи посадам — вони бачать його вже зараз">👤 поділено · {shareCount(r)}</span>}
                    {isOwner && r.stale && <span className="kb-warn">текст змінився після затвердження</span>}
                  </span>
                </span>
              </button>
            ))}
            {!shown.length && <div className="empty">{rows.length ? "За цими умовами записів немає." : isOwner ? "База ще порожня — її завантажує Claude з ноутбука." : "Затверджених записів для команди ще немає."}</div>}
            {shown.length > limit && <button type="button" className="btn kb__more" onClick={() => setLimit((n) => n + 120)}>Показати ще · лишилось {shown.length - limit}</button>}
          </div>
        </>
      )}

      {opened && (
        <div className="modal-overlay open kb-overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <div className="modal kb-modal">
            <div className="kb-modal__bar">
              {back.length > 0 && <button type="button" className="btn small" onClick={goBack}>← Назад</button>}
              {(isOwner || opened.status !== "approved") && <span className={`kb-st kb-st--${opened.status}`}>{STATUS[opened.status].icon} {STATUS[opened.status].label}</span>}
              <span className="note" style={{ margin: 0 }}>{KIND[opened.kind]} · {opened.id.startsWith("c-") ? opened.id : day(opened.src_created)}</span>
              <span className="kb-modal__acts">
                {!back.length && pos >= 0 && (
                  <>
                    <button type="button" className="btn small" disabled={pos <= 0} onClick={() => setOpenId(shown[pos - 1].id)} aria-label="Попередній запис">‹</button>
                    <span className="note" style={{ margin: 0 }}>{pos + 1} / {shown.length}</span>
                    <button type="button" className="btn small" disabled={pos >= shown.length - 1} onClick={() => setOpenId(shown[pos + 1].id)} aria-label="Наступний запис">›</button>
                  </>
                )}
                <button type="button" className="btn small" onClick={close} aria-label="Закрити">✕</button>
              </span>
            </div>

            <h2 className="kb-modal__title">{opened.title}</h2>
            <div className="kb-modal__facts">
              {(opened.topics || []).map((t) => <span key={t} className="tag">{topicName(t)}</span>)}
              {opened.confidence && <span>Достовірність: <b>{CONF[opened.confidence]}</b></span>}
            </div>
            {isOwner && opened.stale && <div className="kb-warnbox">Текст цього запису оновився після того, як ви його затвердили. Перечитайте й натисніть «Затвердити» ще раз або поставте «Уточнити».</div>}
            {isOwner && opened.review_note && <div className="kb-notebox"><b>{opened.status === "approved" ? "Примітка" : "Що уточнити"}:</b> {opened.review_note}</div>}

            {!d ? <div className="empty">Завантаження…</div> : (
              <>
                <KbText text={d.body} titleOf={titleOf} onRef={(id) => open(id, true)} />
                {d.extra?.implication_for_project && <div className="kb-block"><div className="kb-block__label">Що це означає для системи Модулер</div>{d.extra.implication_for_project}</div>}
                {d.extra?.test_method && <div className="kb-block"><div className="kb-block__label">Як перевірити</div>{d.extra.test_method}</div>}
                <Links links={d.links} byId={byId} onOpen={(id) => open(id, true)} isOwner={isOwner} />
                {!!(d.sources || []).length && (
                  <div className="kb-block">
                    <div className="kb-block__label">Звідки це відомо</div>
                    <ul className="kb-src">{d.sources.map((s) => <li key={s.id}>{s.title} <span className="note">· {SRC_TYPE[s.type] || s.type}{s.date ? ` · ${day(s.date)}` : ""}</span></li>)}</ul>
                  </div>
                )}
                {isOwner && d.reviewed_at && <div className="note">Перевірено: {day(d.reviewed_at)}{d.reviewed_by ? ` · ${d.reviewed_by}` : ""}</div>}
              </>
            )}

            {!isOwner && opened.status !== "approved" && <div className="kb-notebox">Засновник поділився з вами цим записом до перевірки: дані взято з документів і чатів, вони ще не затверджені.</div>}
            {isOwner && <ReviewBar key={opened.id} r={opened} autoNext={autoNext} setAutoNext={setAutoNext} onReview={review} onShare={() => setPanel("share")} />}
          </div>
        </div>
      )}

      {panel === "settings" && (
        <SettingsPanel supabase={supabase} teamMode={teamMode} forTeam={forTeam} approved={approved} total={rows.length} lastSync={lastSync}
          onClose={() => setPanel(null)} onSaved={setTeamMode} onError={setMsg} />
      )}
      {panel === "add" && <AddPanel supabase={supabase} onClose={() => setPanel(null)} onError={setMsg} />}
      {panel === "share" && opened && (
        <SharePanel r={opened} people={people} roles={roles} teamMode={teamMode} onClose={() => setPanel(null)}
          onSave={(patch) => { review(opened.id, patch); setPanel(null); }} />
      )}
    </div>
  );
}

// рішення засновника по запису: статус, кому показувати, коментар («що уточнити» читає Claude під час наступної сесії з базою)
function ReviewBar({ r, autoNext, setAutoNext, onReview, onShare }) {
  const [note, setNote] = useState(r.review_note || "");
  const dirty = note.trim() !== (r.review_note || "").trim();
  const withNote = (patch) => (dirty ? { ...patch, review_note: note.trim() || null } : patch);
  return (
    <div className="kb-review">
      <textarea rows={1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Коментар: що не так, як насправді (необов’язково)"
        onBlur={() => dirty && onReview(r.id, { review_note: note.trim() || null })} />
      <div className="kb-review__row">
        <button type="button" className={`btn kb-review__ok${r.status === "approved" && !r.stale ? " on" : ""}`} onClick={() => onReview(r.id, withNote({ status: "approved", stale: false }), true)}>✅ Затвердити</button>
        <button type="button" className={`btn kb-review__ask${r.status === "needs_check" ? " on" : ""}`} onClick={() => onReview(r.id, withNote({ status: "needs_check" }), true)}>❓ Уточнити</button>
        {r.status !== "unverified" && <button type="button" className="btn" onClick={() => onReview(r.id, withNote({ status: "unverified" }))} title="Зняти позначку: запис знову «з джерел, не перевірено»">↺</button>}
      </div>
      <div className="kb-review__row kb-review__opts">
        <span className="kb-access" role="group" aria-label="Хто бачить запис">
          <button type="button" className={`btn small${r.audience !== "team" ? " on" : ""}`} onClick={() => r.audience === "team" && onReview(r.id, { audience: "owner" })} title="Запис бачите ви й ті, з ким ви ним поділились">🔒 Лише я</button>
          <button type="button" className={`btn small${r.audience === "team" ? " on" : ""}`} onClick={() => r.audience !== "team" && onReview(r.id, { audience: "team" })} title="Після затвердження запис побачить уся команда (коли базу відкрито команді)">👥 Уся команда</button>
        </span>
        <button type="button" className={`btn small${shareCount(r) ? " kb-access__shared" : ""}`} onClick={onShare} title="Відкрити запис окремим людям або посадам — як файл на Google Диску">👤 Поділитися{shareCount(r) ? ` · ${shareCount(r)}` : "…"}</button>
        <label className="tag-check"><input type="checkbox" checked={autoNext} onChange={(e) => setAutoNext(e.target.checked)} /> після рішення — наступний запис</label>
      </div>
    </div>
  );
}

function Links({ links, byId, onOpen, isOwner }) {
  const list = (links || []).filter((l) => byId.has(l.id));
  if (!list.length) return null;
  const ev = list.filter((l) => l.rel === "evidence" || l.rel === "mentions");
  const rest = list.filter((l) => l.rel !== "evidence" && l.rel !== "mentions");
  const row = (l, i) => {
    const t = byId.get(l.id);
    return (
      <li key={`${l.id}-${i}`}>
        <button type="button" className="kb-link" onClick={() => onOpen(l.id)}>
          {isOwner && <span title={STATUS[t.status].label}>{STATUS[t.status].icon} </span>}{t.title}
        </button>
        {l.rel !== "evidence" && l.rel !== "mentions" && <span className="note"> · {l.dir === "in" ? REL_IN[l.rel] || l.rel : REL[l.rel] || l.rel}</span>}
      </li>
    );
  };
  return (
    <>
      {!!ev.length && <div className="kb-block"><div className="kb-block__label">На чому це тримається · {ev.length}</div><ul className="kb-links">{ev.map(row)}</ul></div>}
      {!!rest.length && <div className="kb-block"><div className="kb-block__label">Пов’язані записи · {rest.length}</div><ul className="kb-links">{rest.map(row)}</ul></div>}
    </>
  );
}

// питання, які виникли під час розбору документів і чатів; відповісти можна тут або боту в Telegram
function Questions({ rows, supabase, onSaved, onError }) {
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  if (!rows) return <div className="empty">Завантаження питань…</div>;
  const sorted = [...rows].sort((a, b) => Number(openQ(b)) - Number(openQ(a)) || a.sort - b.sort);
  const nOpen = rows.filter(openQ).length;
  async function save(r) {
    setBusy(true);
    const patch = { answer: draft.trim() || null, status: draft.trim() ? "answered" : r.status, answered_at: new Date().toISOString() };
    const { error } = await supabase.from("kb_survey").update(patch).eq("id", r.id);
    setBusy(false);
    if (error) { onError("Відповідь не збережено: " + error.message); return; }
    onSaved(r.id, patch);
  }
  return (
    <div className="kb__list">
      <div className="note" style={{ margin: "0 0 10px" }}>Відкритих: {nOpen} з {rows.length}. Відповідь можна змінити будь-коли — у базу знань вона потрапляє під час наступної обробки.</div>
      {sorted.map((r) => {
        const on = openId === r.id;
        return (
          <div key={r.id} className={`kb-q${on ? " open" : ""}`}>
            <button type="button" className="kb-q__head" onClick={() => { setOpenId(on ? null : r.id); setDraft(r.answer || ""); }}>
              <span className={`kb-st kb-st--${openQ(r) ? "needs_check" : "approved"}`}>{openQ(r) ? "відкрите" : "закрите"}</span>
              <span className="kb-row__title">{r.code} · {r.title}</span>
            </button>
            {on && (
              <div className="kb-q__body">
                <p>{r.question}</p>
                {r.assumption && <p className="note">Робоче припущення: {r.assumption}</p>}
                {r.resolution && <p className="note">Стан: {r.resolution}</p>}
                <div className="form-row">
                  <label>Ваша відповідь</label>
                  <textarea rows={Math.min(10, Math.max(3, Math.ceil(draft.length / 80)))} value={draft} onChange={(e) => setDraft(e.target.value)} />
                </div>
                <button type="button" className="btn primary" disabled={busy || draft.trim() === (r.answer || "").trim()} onClick={() => save(r)}>{busy ? "Зберігаю…" : "Зберегти відповідь"}</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SettingsPanel({ supabase, teamMode, forTeam, approved, total, lastSync, onClose, onSaved, onError }) {
  const [busy, setBusy] = useState(false);
  async function set(v) {
    if (v === teamMode || busy) return;
    if (v && !window.confirm(`Відкрити базу знань команді? Вони побачать лише затверджені записи з позначкою «для команди» — зараз таких ${forTeam}.`)) return;
    setBusy(true);
    const { error } = await supabase.from("kb_settings").update({ team_mode: v, updated_at: new Date().toISOString() }).eq("id", true);
    setBusy(false);
    if (error) { onError("Не збережено: " + error.message); return; }
    onSaved(v);
  }
  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Хто бачить базу знань</h2>
        <div className="kb-mode">
          <button type="button" className={`kb-mode__opt${!teamMode ? " on" : ""}`} onClick={() => set(false)}>
            <b>Лише я</b><span>База наповнюється й перевіряється. Команда розділу не бачить.</span>
          </button>
          <button type="button" className={`kb-mode__opt${teamMode ? " on" : ""}`} onClick={() => set(true)}>
            <b>Команда</b><span>Розділ з’являється в меню кожного учасника команди. Видно лише записи, які ви затвердили й позначили «для команди» — зараз {forTeam}.</span>
          </button>
        </div>
        <p className="note">Затверджено {approved} з {total}. Статуси, коментарі й «для команди» ставите лише ви — у відкритому записі внизу.</p>
        <p className="note">Окремим записом можна поділитися з конкретними людьми чи посадами — кнопка «👤 Поділитися» у відкритому записі. Вони побачать його одразу, незалежно від цього перемикача.</p>
        <p className="note">Нові знання приходять із ноутбука{lastSync ? ` (останнє оновлення ${day(lastSync)})` : ""}: документи, чати й ваші відповіді розбирає Claude. Ваші рішення тут при оновленні зберігаються.</p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="button" className="btn" onClick={onClose}>Закрити</button></div>
      </div>
    </div>
  );
}

// кому відкрито запис, крім засновника: люди й посади (як «Поділитися» на Google Диску)
function SharePanel({ r, people, roles, teamMode, onClose, onSave }) {
  const [members, setMembers] = useState(() => new Set(r.share_members || []));
  const [rk, setRk] = useState(() => new Set(r.share_roles || []));
  const [q, setQ] = useState("");
  const toggle = (set, setter, id) => { const next = new Set(set); if (next.has(id)) next.delete(id); else next.add(id); setter(next); };
  const roleName = (k) => roles.find((x) => x.key === k)?.name || "";
  const s = q.trim().toLowerCase();
  const shownPeople = people.filter((m) => !s || `${m.name} ${m.role || ""} ${roleName(m.hr_role)}`.toLowerCase().includes(s));
  const shownRoles = roles.filter((x) => !s || x.name.toLowerCase().includes(s));
  // хто побачить через посаду — щоб було видно, кого це зачепить
  const byRole = (k) => people.filter((m) => m.hr_role === k).map((m) => m.name);
  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal kb-share">
        <h2>Поділитися записом</h2>
        <p className="note" style={{ marginTop: 0 }}>«{r.title}»</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук: імʼя або посада" autoFocus />
        <div className="kb-share__cols">
          <div>
            <div className="kb-block__label">Люди · {members.size}</div>
            <div className="kb-share__list">
              {shownPeople.map((m) => (
                <label key={m.id} className="kb-share__row">
                  <input type="checkbox" checked={members.has(m.id)} onChange={() => toggle(members, setMembers, m.id)} />
                  <span>{m.name}<small>{roleName(m.hr_role) || m.role || ""}</small></span>
                </label>
              ))}
              {!shownPeople.length && <span className="note">Нікого не знайдено.</span>}
            </div>
          </div>
          <div>
            <div className="kb-block__label">Посади · {rk.size}</div>
            <div className="kb-share__list">
              {shownRoles.map((x) => (
                <label key={x.key} className="kb-share__row">
                  <input type="checkbox" checked={rk.has(x.key)} onChange={() => toggle(rk, setRk, x.key)} />
                  <span>{x.name}<small>{byRole(x.key).join(", ") || "зараз нікого на цій посаді"}</small></span>
                </label>
              ))}
              {!shownRoles.length && <span className="note">Посад не знайдено.</span>}
            </div>
          </div>
        </div>
        <p className="note">Обрані бачать запис одразу — у розділі «База знань» і за прямим посиланням, навіть якщо він ще не затверджений{teamMode ? "" : " і базу не відкрито всій команді"}. Посада — це всі, хто на ній зараз і хто прийде потім. Бот у Telegram відповідає їм із цього запису лише після затвердження.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {(members.size > 0 || rk.size > 0) && <button type="button" className="btn" onClick={() => { setMembers(new Set()); setRk(new Set()); }}>Закрити доступ усім</button>}
          <button type="button" className="btn" onClick={onClose}>Скасувати</button>
          <button type="button" className="btn primary" onClick={() => onSave({ share_members: [...members], share_roles: [...rk] })}>Зберегти</button>
        </div>
      </div>
    </div>
  );
}

function AddPanel({ supabase, onClose, onError }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function add() {
    if (!text.trim() || busy) return;
    setBusy(true);
    const { error } = await supabase.from("kb_inbox").insert({ said: text.trim() });
    setBusy(false);
    if (error) { onError("Не записано: " + error.message); return; }
    setDone(true);
  }
  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Додати в базу знань</h2>
        {done ? <p>Записано. Claude розбере це під час наступної роботи з базою й покаже тут новим записом.</p> : (
          <div className="form-row">
            <label>Факт, правило, виправлення або посилання на статтю чи відео — як є, одним текстом</label>
            <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </div>
        )}
        <p className="note">Те саме з телефона: напишіть боту «База: …» або /kb текст.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>{done ? "Закрити" : "Скасувати"}</button>
          {!done && <button type="button" className="btn primary" disabled={!text.trim() || busy} onClick={add}>{busy ? "Записую…" : "Додати"}</button>}
        </div>
      </div>
    </div>
  );
}

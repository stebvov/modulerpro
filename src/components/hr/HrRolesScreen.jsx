"use client";

// Профілі посад: кого шукаємо й чого чекаємо. Місія, результати, компетенції з прикладами поведінки, показники,
// питання для скринінгу й співбесіди, практичне завдання, чек-лист якості, план адаптації, текст оголошення.
// З профілю беруться: оцінка кандидатів, план адаптації, цілі й підказки в «Якості роботи».
import { useState } from "react";
import { useRows } from "@/lib/mod";
import { STEP_KINDS, STEP_WHO, useHrMe } from "@/lib/hr";
import { Copy, Field, ListEditor, StringsEditor } from "./ui";
import HrText from "./HrText";

const METRICS = [
  ["", "— вручну —"], ["first_touch_hours", "швидкість першої відповіді, год"], ["untouched", "заявки без контакту"], ["deals_no_next", "угоди без наступного кроку"],
  ["deals_overdue", "прострочені дії в угодах"], ["deals_stale", "угоди без руху 14+ днів"], ["activities", "контакти з клієнтами"], ["deals_won", "договори"],
  ["tasks_overdue", "прострочені задачі"], ["req_overdue", "прострочені сервісні заявки"], ["req_hours", "час закриття заявки, год"],
  ["qa_avg", "середня за чек-листом, %"], ["learning_pct", "навчання пройдено, %"],
  ["team_deals_won", "відділ: договори"], ["team_untouched", "відділ: заявки без контакту"], ["team_deals_no_next", "відділ: угоди без кроку"], ["team_deals_overdue", "відділ: прострочені дії"],
  ["qa_given_per_report", "розборів на менеджера"], ["one_on_one_per_report", "зустрічей 1:1 на менеджера"],
];
const SECTIONS = [["main", "Суть посади"], ["comp", "Компетенції"], ["kpi", "Показники"], ["hire", "Відбір"], ["qa", "Чек-лист якості"], ["onb", "Адаптація"], ["ad", "Оголошення"]];

// Перегляд профілю (для працівника — його власна посада)
export function RoleProfile({ role, sections = ["main", "comp", "kpi"] }) {
  const has = (k) => sections.includes(k);
  return (
    <div className="hr-profile">
      {has("main") && (
        <>
          <p><b>Місія.</b> {role.mission}</p>
          <h4 className="hr-phase">Очікувані результати</h4>
          <ol>{(role.outcomes || []).map((x, i) => <li key={i}>{x}</li>)}</ol>
        </>
      )}
      {has("comp") && (
        <>
          <h4 className="hr-phase">Компетенції</h4>
          {(role.competencies || []).map((c) => (
            <div className="hr-evalcomp" key={c.key}>
              <b>{c.name}</b> <span className="note">вага {c.weight}</span>
              <div className="hr-anchors"><span><b>Добре:</b> {c.good}</span><span><b>Погано:</b> {c.bad}</span></div>
            </div>
          ))}
        </>
      )}
      {has("kpi") && (
        <>
          <h4 className="hr-phase">Показники</h4>
          <ul>{(role.kpis || []).map((k) => <li key={k.key}>{k.name}{k.target != null ? ` — ціль ${k.better === "less" ? "не більше" : "не менше"} ${k.target} ${k.unit || ""}` : " — ціль ставить керівник"}</li>)}</ul>
        </>
      )}
      {has("qa") && (role.qa_checklist || []).length > 0 && (
        <>
          <h4 className="hr-phase">Чек-лист якості</h4>
          <ul>{role.qa_checklist.map((x, i) => <li key={i}>{x.text}</li>)}</ul>
        </>
      )}
    </div>
  );
}

export default function HrRolesScreen() {
  const { canHr, loading: meLoading } = useHrMe();
  const roles = useRows("hr_roles", { order: "sort" });
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [sec, setSec] = useState("main");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);

  if (meLoading || roles.loading) return <div className="empty">Завантаження…</div>;
  if (!canHr) return <div className="empty">Розділ доступний тим, хто веде найм. Профіль своєї посади ви бачите у «Мій розвиток».</div>;
  if (roles.error) return <div className="empty">Помилка: {roles.error}</div>;

  const set = (p) => setDraft((d) => ({ ...d, ...p }));
  function openRole(r) { setOpenId(r.id); setDraft(structuredClone(r)); setSec("main"); setMsg(""); }
  async function save() {
    if (!draft.name.trim()) { setMsg("Вкажіть назву посади"); return; }
    const w = (draft.competencies || []).reduce((a, c) => a + (Number(c.weight) || 0), 0);
    setBusy(true);
    const { id, created_at, key, ...rest } = draft; // ключ посади не міняємо: на нього посилаються люди, курси й тести
    void created_at; void key;
    const e = await roles.update(id, { ...rest, name: draft.name.trim(), competencies: (draft.competencies || []).map((c) => ({ ...c, key: c.key || `c${Math.random().toString(36).slice(2, 7)}` })), updated_at: new Date().toISOString() });
    setBusy(false);
    setMsg(e || (w && w !== 100 ? `Збережено. Сума ваг компетенцій — ${w}, а не 100: оцінка рахується правильно, але ваги легше читати, коли в сумі 100.` : "Збережено."));
  }
  async function add() {
    const key = `role-${Date.now().toString(36)}`;
    const e = await roles.insert({ key, name: "Нова посада", sort: roles.rows.length + 1 });
    if (e) { setMsg(e); return; }
    await roles.reload();
  }

  if (draft && openId) {
    return (
      <div>
        <div className="toolbar">
          <button type="button" className="btn" onClick={() => { setOpenId(null); setDraft(null); }}>← Усі посади</button>
          <div className="toolbar-actions">
            <button type="button" className="btn small" onClick={async () => { if (!sure) { setSure(true); setTimeout(() => setSure(false), 4000); return; } const e = await roles.remove(openId); if (e) setMsg(e.includes("foreign") ? "Посаду використано у вакансіях чи планах — спершу приберіть їх." : e); else { setOpenId(null); setDraft(null); } }}>{sure ? "Точно видалити посаду?" : "Видалити"}</button>
            <button type="button" className="btn primary" disabled={busy} onClick={save}>{busy ? "Зберігаємо…" : "Зберегти профіль"}</button>
          </div>
        </div>
        {msg && <div className="note" style={{ color: "var(--accent)", marginBottom: 8 }}>{msg}</div>}
        <div className="seg-row" style={{ marginBottom: 14, flexWrap: "wrap" }}>
          {SECTIONS.map(([k, l]) => <button key={k} type="button" className={`seg-btn${sec === k ? " active" : ""}`} onClick={() => setSec(k)}>{l}</button>)}
        </div>

        {sec === "main" && (
          <>
            <Field label="Назва посади"><input type="text" value={draft.name} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label="Місія: навіщо ця посада існує (одне-два речення)"><textarea rows={3} value={draft.mission || ""} onChange={(e) => set({ mission: e.target.value })} /></Field>
            <Field label="Очікувані результати за рік — вимірювані, 3–5 пунктів"><StringsEditor items={draft.outcomes} onChange={(v) => set({ outcomes: v })} addLabel="+ Результат" /></Field>
            <Field label="Обов'язкові вимоги"><StringsEditor items={draft.must_have} onChange={(v) => set({ must_have: v })} addLabel="+ Вимога" /></Field>
            <Field label="Тривожні сигнали (кого не беремо)"><StringsEditor items={draft.red_flags} onChange={(v) => set({ red_flags: v })} addLabel="+ Сигнал" /></Field>
          </>
        )}
        {sec === "comp" && (
          <>
            <p className="note" style={{ marginTop: 0 }}>5–7 компетенцій. Для кожної опишіть, як виглядає «добре» і «погано» в поведінці, — тоді різні інтерв’юери оцінюють однаково. Вага — важливість у загальній оцінці.</p>
            <ListEditor items={draft.competencies} onChange={(v) => set({ competencies: v })} addLabel="+ Компетенція" blank={{ name: "", weight: 15, desc: "", good: "", bad: "" }}
              fields={[{ key: "name", label: "Назва" }, { key: "weight", label: "Вага", type: "number", width: 70 }, { key: "desc", label: "Коротко" }, { key: "good", label: "Як виглядає добре (оцінка 5)", type: "area" }, { key: "bad", label: "Як виглядає погано (оцінка 1)", type: "area" }]} />
          </>
        )}
        {sec === "kpi" && (
          <>
            <p className="note" style={{ marginTop: 0 }}>Показник із джерелом система рахує сама й порівнює з ціллю. «Вручну» — керівник оцінює на огляді. Ціль порожня — показник показується без оцінки.</p>
            <ListEditor items={draft.kpis} onChange={(v) => set({ kpis: v.map((k) => ({ ...k, key: k.key || k.metric || `k${Math.random().toString(36).slice(2, 7)}` })) })} addLabel="+ Показник" blank={{ name: "", target: null, unit: "шт", better: "more", metric: "" }}
              fields={[{ key: "name", label: "Назва" }, { key: "metric", label: "Звідки дані", type: "select", options: METRICS, width: 230 }, { key: "target", label: "Ціль", type: "number", width: 80 }, { key: "unit", label: "Одиниця", width: 90 },
                { key: "better", label: "Краще, коли", type: "select", width: 110, options: [["more", "більше"], ["less", "менше"]] }, { key: "note", label: "Примітка" }]} />
          </>
        )}
        {sec === "hire" && (
          <>
            <h4 className="hr-phase">Скринінг-дзвінок (15 хвилин)</h4>
            <ListEditor items={draft.screening} onChange={(v) => set({ screening: v })} addLabel="+ Питання" blank={{ q: "", good: "", knockout: false }}
              fields={[{ key: "q", label: "Питання", type: "area" }, { key: "good", label: "Хороша відповідь", type: "area" }, { key: "knockout", label: "Стоп-питання", type: "bool", width: 100 }]} />
            <h4 className="hr-phase">Співбесіда: питання про минулу поведінку</h4>
            <ListEditor items={draft.interview} onChange={(v) => set({ interview: v })} addLabel="+ Питання" blank={{ comp: draft.competencies?.[0]?.key || "", q: "", probe: "", good: "", bad: "" }}
              fields={[{ key: "comp", label: "Компетенція", type: "select", width: 200, options: (draft.competencies || []).map((c) => [c.key, c.name]) }, { key: "q", label: "Питання", type: "area" }, { key: "probe", label: "Уточнення" }, { key: "good", label: "Сильна відповідь", type: "area" }, { key: "bad", label: "Слабка відповідь", type: "area" }]} />
            <Field label="Практичне завдання або рольова гра"><textarea rows={8} value={draft.case_task || ""} onChange={(e) => set({ case_task: e.target.value })} /></Field>
          </>
        )}
        {sec === "qa" && (
          <>
            <p className="note" style={{ marginTop: 0 }}>За цим чек-листом керівник перевіряє одну розмову, зустріч, підготовлений будинок чи монтаж. Кожен пункт — «так / частково / ні», вага — внесок у загальну оцінку.</p>
            <ListEditor items={draft.qa_checklist} onChange={(v) => set({ qa_checklist: v })} addLabel="+ Пункт" blank={{ text: "", weight: 10 }} fields={[{ key: "text", label: "Що перевіряємо", type: "area" }, { key: "weight", label: "Вага", type: "number", width: 70 }]} />
          </>
        )}
        {sec === "onb" && (
          <>
            <p className="note" style={{ marginTop: 0 }}>Шаблон плану на 90 днів. З нього створюється план кожного новачка на цій посаді. Обов’язково — контрольні точки на 30, 60 і 90 день.</p>
            <ListEditor items={draft.onboarding} onChange={(v) => set({ onboarding: v.map((x) => ({ ...x, id: x.id || `s${Math.random().toString(36).slice(2, 7)}`, day: Number(x.day) || 1 })) })} addLabel="+ Крок" blank={{ day: 1, title: "", kind: "task", who: "self" }}
              fields={[{ key: "day", label: "День", type: "number", width: 64 }, { key: "title", label: "Що зробити", type: "area" }, { key: "kind", label: "Тип", type: "select", width: 150, options: Object.entries(STEP_KINDS) }, { key: "who", label: "Хто", type: "select", width: 140, options: Object.entries(STEP_WHO) }, { key: "ref", label: "Курс або тест (course:ключ / test:ключ)", width: 190 }]} />
          </>
        )}
        {sec === "ad" && (
          <>
            <Field label="Текст оголошення про вакансію (**жирний**, «- » — пункт)"><textarea rows={16} value={draft.job_ad || ""} onChange={(e) => set({ job_ad: e.target.value })} /></Field>
            <div className="toolbar"><Copy text={`${draft.name}\n\n${String(draft.job_ad || "").replace(/\*\*/g, "")}`} label="Скопіювати текст" /></div>
            <details className="hr-q" open><summary>Як це побачить кандидат</summary><HrText text={draft.job_ad} /></details>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="note">Профіль посади — основа всієї системи. З нього беруться питання для відбору, план адаптації новачка, цілі й чек-лист для оцінки роботи. Спершу описуємо, кого шукаємо й за що платимо, — потім наймаємо.</p>
      <div className="toolbar"><div className="toolbar-actions" style={{ marginLeft: "auto" }}><button type="button" className="btn primary" onClick={add}>+ Посада</button></div></div>
      {msg && <div className="auth-error">{msg}</div>}
      <div className="hr-cards">
        {roles.rows.map((r) => (
          <div className="card" key={r.id} onClick={() => openRole(r)}>
            <h3>{r.name}</h3>
            <p className="note" style={{ marginTop: 0 }}>{r.mission || "Місію ще не описано"}</p>
            <div className="hr-chips">
              <span className="tag">{(r.competencies || []).length} компетенцій</span>
              <span className="tag">{(r.kpis || []).length} показників</span>
              <span className="tag">{(r.interview || []).length} питань</span>
              <span className="tag">{(r.onboarding || []).length} кроків адаптації</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

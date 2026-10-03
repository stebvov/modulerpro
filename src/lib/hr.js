"use client";

// Люди: найм і розвиток — спільне для екранів: етапи воронки, оцінки, показники й підказки.
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

export const STAGES = [
  ["new", "Новий відгук"], ["screen", "Скринінг"], ["test", "Тест"], ["interview", "Співбесіда"],
  ["task", "Завдання"], ["reference", "Рекомендації"], ["offer", "Пропозиція"], ["hired", "Прийнято"],
];
export const SIDE_STAGES = [["reserve", "Резерв"], ["rejected", "Відмова"]];
export const stageLabel = (k) => [...STAGES, ...SIDE_STAGES].find(([s]) => s === k)?.[1] || k;
export const SOURCES = ["сайт", "work.ua", "robota.ua", "OLX Робота", "LinkedIn", "Telegram-канал", "рекомендація", "сам написав", "інше"];
export const REJECT_REASONS = ["не відповідає вимогам", "слабкий тест", "слабка співбесіда", "слабке завдання", "очікування щодо оплати", "сам відмовився", "не вийшов на зв'язок", "рекомендації", "інше"];
export const VAC_STATUS = [["draft", "чернетка"], ["open", "відкрита"], ["paused", "пауза"], ["closed", "закрита"]];
export const EVAL_KINDS = {
  screen: "Скринінг-дзвінок", interview: "Співбесіда", task: "Практичне завдання", reference: "Рекомендації",
  probation: "Контрольна точка адаптації", review: "Огляд роботи", qa: "Чек-лист якості", one_on_one: "Зустріч 1:1",
};
export const VERDICTS = [["strong_yes", "Точно так"], ["yes", "Так"], ["no", "Ні"], ["strong_no", "Точно ні"]];
export const verdictLabel = (v) => VERDICTS.find(([k]) => k === v)?.[1] || v || "";
export const STEP_KINDS = { learn: "📘 навчання", task: "🛠 завдання", meet: "🤝 зустріч", check: "🎯 контрольна точка" };
export const STEP_WHO = { self: "сам", mentor: "з наставником", head: "з керівником" };
export const LEVELS = { start: "старт", base: "базовий", pro: "поглиблений" };
export const SLA_NEW_DAYS = 2; // новому відгуку відповідаємо за два робочі дні

export const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date());
export const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
export const addDays = (iso, n) => new Date(new Date(iso + "T12:00:00Z").getTime() + n * 864e5).toISOString().slice(0, 10);
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
export const monthRange = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return [`${ym}-01`, new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)];
};

// я в команді + чи маю кадровий доступ (засновник, керівник пульту, позначений hr_admin, адмін системи)
export function useHrMe() {
  const { user, isAdmin } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [me, setMe] = useState(undefined);
  useEffect(() => {
    if (!user?.email) return;
    let on = true;
    supabase.from("task_members").select("id,name,role,email,is_owner,can_manage,hr_admin,hr_role,avatar_url").ilike("email", user.email).eq("active", true).maybeSingle()
      .then(({ data }) => { if (on) setMe(data || null); });
    return () => { on = false; };
  }, [supabase, user?.email]);
  const canHr = !!(isAdmin || me?.is_owner || me?.can_manage || me?.hr_admin);
  return { me, canHr, loading: me === undefined, supabase, who: me?.name || user?.email || "" };
}

// ── Оцінки ───────────────────────────────────────────────────────────────────
// компетенції 1–5 із вагами → 0–100%
export function compTotal(scores, competencies) {
  let sum = 0, w = 0;
  for (const c of competencies || []) {
    const s = Number(scores?.[c.key]);
    if (!s) continue;
    const k = Number(c.weight) || 1;
    sum += ((s - 1) / 4) * k; w += k;
  }
  return w ? Math.round((sum / w) * 100) : null;
}
// чек-лист: 1 — так, 0.5 — частково, 0 — ні; з вагами → 0–100%
export function listTotal(scores, items) {
  let sum = 0, w = 0;
  (items || []).forEach((it, i) => {
    const s = scores?.[i];
    if (s == null || s === "") return;
    const k = Number(it.weight) || 1;
    sum += Number(s) * k; w += k;
  });
  return w ? Math.round((sum / w) * 100) : null;
}
// загальна оцінка кандидата: тест 30%, співбесіди 50%, завдання 20% — з того, що вже є
export function candidateScore(c, evals) {
  const mine = (evals || []).filter((e) => e.candidate_id === c.id);
  const avg = (kind) => { const l = mine.filter((e) => e.kind === kind && e.total != null); return l.length ? l.reduce((a, e) => a + Number(e.total), 0) / l.length : null; };
  const parts = [[c.score_test, 30], [avg("interview"), 50], [avg("task"), 20]].filter(([v]) => v != null);
  if (!parts.length) return null;
  return Math.round(parts.reduce((a, [v, w]) => a + Number(v) * w, 0) / parts.reduce((a, [, w]) => a + w, 0));
}

// ── Показники й підказки ─────────────────────────────────────────────────────
// урок, який допоможе з компетенцією: [ключ курсу, початок назви уроку]
export const COMP_LESSON = {
  contact: ["sales", "Перша розмова"], discovery: ["sales", "Перша розмова"], product: ["product", "Рівні готовності"],
  closing: ["sales", "Заперечення"], discipline: ["sales", "Наступний крок"], drive: ["sales", "Наступний крок"],
  results: ["leadership", "Воронка в цифрах"], coaching: ["leadership", "Розбір розмови"], hiring: ["leadership", "Найм"],
  process: ["leadership", "Ритм керування"], selling: ["sales", "Заперечення"], cross: ["leadership", "Воронка в цифрах"],
  service: ["uk", "Стандарт"], ops: ["uk", "Сервісна заявка"], numbers: ["uk", "Економіка будинку"], owners: ["uk", "Власники"],
  growth: ["uk", "Економіка будинку"], own: ["company", "Як ми працюємо"], reliability: ["company", "Як ми працюємо"],
  comm: ["uk", "Гості"], handy: ["uk", "Стандарт"], records: ["uk", "Сервісна заявка"],
};
const METRIC_LESSON = {
  untouched: ["sales", "Заявка: перші"], first_touch_hours: ["sales", "Заявка: перші"], deals_no_next: ["sales", "Наступний крок"],
  deals_overdue: ["sales", "Наступний крок"], deals_stale: ["sales", "Наступний крок"], activities: ["sales", "Наступний крок"],
  tasks_overdue: ["system", "Задачі"], req_overdue: ["uk", "Сервісна заявка"], req_hours: ["uk", "Сервісна заявка"],
  qa_avg: null, learning_pct: null,
};

// значення, яких немає в hr_metrics, рахуємо тут: навчання, середня за чек-листами, показники відділу для керівника
export function enrich(values, { evals = [], member, period, reports = [] } = {}) {
  const v = { ...(values || {}) };
  v.learning_pct = v.lessons_total ? Math.round((v.lessons_done / v.lessons_total) * 100) : null;
  const inPeriod = (e) => !period || (e.created_at >= period[0] && e.created_at < addDays(period[1], 1));
  const qa = evals.filter((e) => e.member_id === member?.id && e.kind === "qa" && e.total != null && inPeriod(e));
  v.qa_avg = qa.length ? Math.round(qa.reduce((a, e) => a + Number(e.total), 0) / qa.length) : null;
  v.qa_count = qa.length;
  if (reports.length) {
    for (const k of ["deals_won", "untouched", "deals_no_next", "deals_overdue"]) v[`team_${k}`] = reports.reduce((a, r) => a + (Number(r.values?.[k]) || 0), 0);
    const ids = new Set(reports.map((r) => r.member.id));
    const given = (kind) => evals.filter((e) => e.kind === kind && ids.has(e.member_id) && e.evaluator === member?.name && inPeriod(e)).length;
    v.qa_given_per_report = Math.round((given("qa") / reports.length) * 10) / 10;
    v.one_on_one_per_report = Math.round((given("one_on_one") / reports.length) * 10) / 10;
  }
  return v;
}

// стан показника проти цілі: ok | warn | bad | none (даних або цілі немає)
export function kpiState(kpi, values) {
  const val = kpi.metric ? values?.[kpi.metric] : null;
  if (val == null || kpi.target == null) return { val, state: "none" };
  const t = Number(kpi.target), x = Number(val);
  if (kpi.better === "less") return { val, state: x <= t ? "ok" : x <= (t === 0 ? 2 : t * 1.5) ? "warn" : "bad" };
  return { val, state: x >= t ? "ok" : x >= t * 0.8 ? "warn" : "bad" };
}

const n = (x) => Number(x) || 0;
const pl = (k, one, few, many) => { const a = Math.abs(k) % 100, b = a % 10; return `${k} ${a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many}`; };

// Підказки: що зробити саме зараз і який урок допоможе. role — профіль посади, v — показники (після enrich).
export function buildHints({ role, v, evals = [], attempts = [], tests = [], member, forHr }) {
  const out = [];
  const add = (level, text, lesson) => out.push({ level, text, lesson: lesson || null });
  const has = (m) => (role?.kpis || []).some((k) => k.metric === m);
  if (!role) return [{ level: "info", text: "Посаду ще не призначено — без неї немає цілей, навчання й показників. Призначити можна в розділі «Якість роботи».", lesson: null }];

  if (has("untouched") && n(v.untouched) > 0) add("bad", `${pl(n(v.untouched), "заявка", "заявки", "заявок")} без жодного контакту — зв'яжіться сьогодні: кожна година знижує шанс на розмову.`, METRIC_LESSON.untouched);
  if (has("first_touch_hours") && v.first_touch_hours != null && n(v.first_touch_hours) > 0.25) add(n(v.first_touch_hours) > 2 ? "bad" : "warn", `Перша відповідь на заявку в середньому через ${String(v.first_touch_hours).replace(".", ",")} год. Стандарт — 15 хвилин у робочий час.`, METRIC_LESSON.first_touch_hours);
  if (has("deals_no_next") && n(v.deals_no_next) > 0) add("bad", `${pl(n(v.deals_no_next), "угода", "угоди", "угод")} без наступного кроку. Відкрийте кожну й поставте дату наступного контакту.`, METRIC_LESSON.deals_no_next);
  if (has("deals_overdue") && n(v.deals_overdue) > 0) add("bad", `${pl(n(v.deals_overdue), "прострочена дія", "прострочені дії", "прострочених дій")} в угодах — виконайте або перенесіть із причиною.`, METRIC_LESSON.deals_overdue);
  if (has("deals_stale") && n(v.deals_stale) > 0) add("warn", `${pl(n(v.deals_stale), "угода", "угоди", "угод")} без руху понад 14 днів — зв'яжіться з клієнтом або закрийте з причиною.`, METRIC_LESSON.deals_stale);
  if (has("activities") && n(v.deals_open) > 0 && n(v.activities) === 0) add("warn", "За період у відкритих угодах немає жодного записаного контакту. Записуйте кожну розмову в CRM того ж дня.", METRIC_LESSON.activities);
  if (has("deals_no_next") && n(v.deals_open) === 0 && n(v.deals_new) === 0) add("info", forHr ? "У CRM немає угод, де ця людина відповідальна, — показники продажу не рахуються. Призначайте відповідального в картці угоди." : "У CRM немає угод, де ви відповідальні, — показники продажу не рахуються. Перевірте, що у ваших угодах ви вказані відповідальним.", null);

  if (has("team_untouched") && n(v.team_untouched) > 0) add("bad", `У відділі ${pl(n(v.team_untouched), "заявка", "заявки", "заявок")} без жодного контакту — розберіть сьогодні з менеджерами.`, ["leadership", "Ритм керування"]);
  if (has("team_deals_no_next") && n(v.team_deals_no_next) > 0) add("bad", `У відділі ${pl(n(v.team_deals_no_next), "угода", "угоди", "угод")} без наступного кроку.`, ["leadership", "Ритм керування"]);
  if (has("team_deals_overdue") && n(v.team_deals_overdue) > 0) add("warn", `У відділі ${pl(n(v.team_deals_overdue), "прострочена дія", "прострочені дії", "прострочених дій")} в угодах.`, ["leadership", "Ритм керування"]);
  if (has("qa_given_per_report") && v.qa_given_per_report != null && n(v.qa_given_per_report) < 4) add("warn", `Розборів розмов за місяць: ${String(v.qa_given_per_report).replace(".", ",")} на менеджера (ціль — 4). Менеджери ростуть від розборів власних розмов.`, ["leadership", "Розбір розмови"]);
  if (has("one_on_one_per_report") && v.one_on_one_per_report != null && n(v.one_on_one_per_report) < 4) add("warn", `Зустрічей 1:1 за місяць: ${String(v.one_on_one_per_report).replace(".", ",")} на менеджера (ціль — 4).`, ["leadership", "Розбір розмови"]);

  if (has("req_overdue") && n(v.req_overdue) > 0) add("bad", `${pl(n(v.req_overdue), "прострочена сервісна заявка", "прострочені сервісні заявки", "прострочених сервісних заявок")} — закрийте або попередьте заявника про новий строк.`, METRIC_LESSON.req_overdue);
  const reqT = (role.kpis || []).find((k) => k.metric === "req_hours")?.target;
  if (reqT && v.req_hours != null && n(v.req_hours) > n(reqT)) add("warn", `Заявки закриваються в середньому за ${String(v.req_hours).replace(".", ",")} год (стандарт — ${reqT} год).`, METRIC_LESSON.req_hours);

  if (n(v.tasks_overdue) > 0) add(n(v.tasks_overdue) > 3 ? "bad" : "warn", `${pl(n(v.tasks_overdue), "прострочена задача", "прострочені задачі", "прострочених задач")} — закрийте або перенесіть термін із причиною.`, METRIC_LESSON.tasks_overdue);
  if (n(v.tasks_done) >= 4 && n(v.tasks_done_late) / n(v.tasks_done) > 0.3) add("warn", `${Math.round((n(v.tasks_done_late) / n(v.tasks_done)) * 100)}% задач закрито після терміну. Переносьте термін заздалегідь, а не після.`, METRIC_LESSON.tasks_overdue);

  if (v.learning_pct != null && v.learning_pct < 100) add("warn", `Обов'язкове навчання пройдено на ${v.learning_pct}% — лишилось ${pl(n(v.lessons_total) - n(v.lessons_done), "урок", "уроки", "уроків")}.`, null);
  const mineAttempts = attempts.filter((a) => a.member_id === member?.id);
  for (const t of tests.filter((x) => x.kind !== "candidate" && (!x.role_keys?.length || x.role_keys.includes(role.key)))) {
    const last = mineAttempts.filter((a) => a.test_id === t.id && a.status === "checked").sort((a, b) => (a.finished_at < b.finished_at ? 1 : -1))[0];
    const passed = mineAttempts.some((a) => a.test_id === t.id && a.passed);
    if (last && !passed) add("warn", `Тест «${t.title.replace(/^Тест:\s*/, "")}» не складено (${Math.round(n(last.score_pct))}%, треба ${t.pass_pct}%) — повторіть курс і перескладіть.`, null);
  }

  const qaT = (role.kpis || []).find((k) => k.metric === "qa_avg")?.target;
  if (qaT && v.qa_avg != null && v.qa_avg < n(qaT)) add("warn", `Середня оцінка за чек-листом якості — ${v.qa_avg}% (ціль ${qaT}%).`, null);
  const mine = evals.filter((e) => e.member_id === member?.id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  // найслабший пункт останніх чек-листів
  const lastQa = mine.filter((e) => e.kind === "qa").slice(0, 3);
  if (lastQa.length && role.qa_checklist?.length) {
    const miss = role.qa_checklist.map((it, i) => ({ it, bad: lastQa.filter((e) => e.scores?.[i] != null && Number(e.scores[i]) < 1).length })).filter((x) => x.bad >= Math.min(2, lastQa.length)).sort((a, b) => b.bad - a.bad)[0];
    if (miss) add("warn", `В останніх перевірках повторюється зауваження: «${miss.it.text}».`, null);
  }
  // зона росту з останнього огляду
  const rev = mine.find((e) => (e.kind === "review" || e.kind === "probation") && Object.keys(e.scores || {}).length);
  if (rev) {
    const weak = (role.competencies || []).map((c) => ({ c, s: Number(rev.scores[c.key]) })).filter((x) => x.s && x.s <= 2).sort((a, b) => a.s - b.s)[0];
    if (weak) add("warn", `Зона росту з останнього огляду: «${weak.c.name}» (${weak.s} з 5). ${weak.c.good ? "Як виглядає добре: " + weak.c.good : ""}`, COMP_LESSON[weak.c.key]);
  }
  if (forHr) {
    const lastRev = mine.find((e) => e.kind === "review" || e.kind === "probation" || e.kind === "one_on_one");
    if (!lastRev) add("info", "Із цією людиною ще не було жодного огляду чи зустрічі 1:1 — проведіть і запишіть.", null);
    else if (daysBetween(lastRev.created_at, new Date()) > 35) add("info", `Останній огляд або 1:1 був ${fmtDate(lastRev.created_at)} — понад місяць тому.`, null);
    if (qaT && !v.qa_count) add("info", "За цей період немає жодної перевірки за чек-листом якості.", null);
  }
  if (!out.some((h) => h.level === "bad" || h.level === "warn")) out.unshift({ level: "ok", text: "Показники в нормі: прострочень і відкритих зауважень немає.", lesson: null });
  return out;
}

// знайти урок за підказкою: [ключ курсу, початок назви] → { course, lesson }
export function findLesson(ref, courses, lessons) {
  if (!ref) return null;
  const course = courses.find((c) => c.key === ref[0]);
  if (!course) return null;
  const lesson = lessons.find((l) => l.course_id === course.id && l.title.startsWith(ref[1]));
  return { course, lesson: lesson || null };
}

export const uid = () => Math.random().toString(36).slice(2, 8);

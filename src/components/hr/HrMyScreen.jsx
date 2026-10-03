"use client";

// Мій розвиток: усе про власне зростання на одній сторінці — план адаптації, підказки й показники за місяць,
// навчання й тести своєї посади, оцінки від керівника, профіль посади («чого від мене чекають»).
import { useCallback, useMemo, useRef, useState } from "react";
import { useRows } from "@/lib/mod";
import { monthRange, todayISO, useHrMe } from "@/lib/hr";
import PersonQuality, { EvalHistory, personView, useMetrics } from "./PersonQuality";
import { PlanView } from "./HrOnboardingScreen";
import { RoleProfile } from "./HrRolesScreen";
import HrLearningScreen from "./HrLearningScreen";

export default function HrMyScreen() {
  const { me, loading: meLoading, supabase } = useHrMe();
  const roles = useRows("hr_roles", { order: "sort" });
  const myId = me?.id || null;
  const mine = useCallback((q) => (myId ? q.eq("member_id", myId) : q.is("member_id", null)), [myId]);
  const plans = useRows("hr_onboarding", { order: "start_date", ascending: false, filter: mine });
  const evals = useRows("hr_evals", { order: "created_at", ascending: false, filter: mine });
  const attempts = useRows("hr_attempts", { order: "created_at", ascending: false, filter: mine });
  const tests = useRows("hr_tests", { order: "sort" });
  const courses = useRows("hr_courses", { order: "sort" });
  const lessons = useRows("hr_lessons", { order: "sort" });
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const [learn, setLearn] = useState({ n: 0, initial: null }); // відкрити потрібний курс у блоці навчання
  const [msg, setMsg] = useState("");
  const learnRef = useRef(null);

  const period = useMemo(() => monthRange(month), [month]);
  const ids = useMemo(() => (myId ? [myId] : []), [myId]);
  const metrics = useMetrics(supabase, ids, period);
  const role = roles.rows.find((r) => r.key === me?.hr_role) || null;
  const view = useMemo(() => personView({ member: me, role, values: metrics.map[myId], evals: evals.rows, attempts: attempts.rows, tests: tests.rows, period, reports: [], forHr: false }),
    [me, myId, role, metrics.map, evals.rows, attempts.rows, tests.rows, period]);

  if (meLoading || roles.loading) return <div className="empty">Завантаження…</div>;
  if (!me) return <div className="empty">Ця сторінка — для учасників команди. Попросіть Катю або Володимира додати вас у «Команду».</div>;

  const plan = plans.rows.find((p) => p.status === "active" || p.status === "extended") || null;
  function openLearning(initial) {
    setLearn((x) => ({ n: x.n + 1, initial }));
    setTimeout(() => { try { learnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch { /* */ } }, 60);
  }
  async function toggle(s, on) {
    const { data, error } = await supabase.rpc("hr_step_toggle", { p_plan: plan.id, p_step: s.id, p_done: on });
    if (error || !data?.ok) { setMsg(data?.error || error?.message || "Не вдалося зберегти"); return; }
    setMsg(""); plans.reload();
  }

  return (
    <div className="hr-my">
      <div className="hr-myhead">
        <div>
          <h2>{me.name}</h2>
          <div className="note" style={{ marginTop: 0 }}>{role ? role.name : "Посаду ще не призначено — зверніться до керівника: від неї залежать ваші курси, цілі й підказки."}</div>
        </div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value || month)} style={{ width: 160 }} aria-label="Місяць показників" />
      </div>
      {msg && <div className="auth-error">{msg}</div>}

      {plan && (
        <section className="hr-sec">
          <h3>🧭 Мій план адаптації</h3>
          <p className="note" style={{ marginTop: 0 }}>Відмічайте зроблене самі. Контрольні точки закриває керівник після зустрічі з вами.</p>
          <PlanView plan={plan} courses={courses.rows} tests={tests.rows} onToggle={(s, on) => (s.kind === "check" ? setMsg("Контрольну точку відмічає керівник після зустрічі.") : toggle(s, on))}
            onOpenRef={(kind, ref) => openLearning({ courseId: kind === "course" ? ref.id : ref.course_id })} />
        </section>
      )}

      <section className="hr-sec">
        <h3>🎯 Мої показники й підказки</h3>
        {metrics.loading ? <div className="empty">Рахуємо показники…</div> : (
          <PersonQuality view={view} role={role} courses={courses.rows} lessons={lessons.rows} onOpenLesson={(ref) => openLearning({ courseId: ref.course.id, lessonId: ref.lesson?.id || null })} />
        )}
      </section>

      <section className="hr-sec" ref={learnRef}>
        <h3>📘 Моє навчання</h3>
        <HrLearningScreen key={learn.n} mine initial={learn.initial} />
      </section>

      <section className="hr-sec">
        <h3>📝 Мої оцінки</h3>
        <p className="note" style={{ marginTop: 0 }}>Огляди, перевірки за чек-листом і домовленості із зустрічей 1:1.</p>
        <EvalHistory evals={evals.rows.filter((e) => ["review", "probation", "qa", "one_on_one"].includes(e.kind))} role={role} />
      </section>

      {role && (
        <section className="hr-sec">
          <h3>📌 Чого від мене чекають</h3>
          <RoleProfile role={role} sections={["main", "comp", "kpi", "qa"]} />
        </section>
      )}
    </div>
  );
}

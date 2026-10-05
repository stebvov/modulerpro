"use client";
// Вакансії на сайті: відкриті вакансії з системи («Люди: найм і розвиток») + форма відгуку.
// Відгук → hr_apply → картка кандидата в системі й сповіщення в Telegram. Якщо вакансій немає — форма «в резерв».
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import HrText from "@/components/hr/HrText";
import { useT } from "./I18n";

let client;
const sb = () => (client ||= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } }));
const COLS = "id,title,city,format,conditions,description,sort,created_at";

function utm() {
  try { return sessionStorage.getItem("moduler_utm") || ""; } catch { return ""; }
}

export default function Vacancies({ initial, emptyText, formTitle, steps }) {
  const [list, setList] = useState(initial || null);
  const [pick, setPick] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done | error
  const [err, setErr] = useState("");
  const formRef = useRef(null);
  const { t, lang } = useT();

  // у живому перегляді конструктора даних із сервера немає — беремо самі
  useEffect(() => {
    if (initial) return;
    let on = true;
    sb().from("hr_vacancies").select(COLS).eq("status", "open").eq("on_site", true).order("sort").order("created_at")
      .then(({ data }) => { if (on) setList(data || []); });
    return () => { on = false; };
  }, [initial]);

  function apply(id) {
    setPick(id);
    setTimeout(() => { try { formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); formRef.current?.querySelector("input[name=name]")?.focus({ preventScroll: true }); } catch { /* */ } }, 30);
  }

  async function submit(e) {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(e.currentTarget).entries());
    if (!String(p.name || "").trim()) { e.currentTarget.name.focus(); return; }
    if (String(p.phone || "").replace(/\D/g, "").length < 9) { setErr(t("Перевірте номер телефону")); e.currentTarget.phone.focus(); return; }
    setState("sending"); setErr("");
    const { data, error } = await sb().rpc("hr_apply", { p: { ...p, vacancy: pick || "", page: location.pathname, utm: utm() } });
    if (error || !data?.ok) { setState("error"); setErr((lang === "uk" && data?.error) || t("Не вдалося надіслати. Спробуйте ще раз або зателефонуйте нам.")); return; }
    setState("done");
  }

  const items = list || [];
  return (
    <div className="s-vacs">
      {list && !items.length && <p className="s-vacs__empty">{emptyText || t("Зараз відкритих вакансій немає. Але сильним людям ми раді завжди — залиште контакти, і ми зв'яжемося, щойно з'явиться задача для вас.")}</p>}
      {items.map((v) => (
        <article className="s-vac" key={v.id} id={`v-${v.id}`}>
          <div className="s-vac__head">
            <h3>{v.title}</h3>
            <div className="s-vac__meta">
              {v.city && <span>📍 {v.city}</span>}
              {v.format && <span>🗓 {v.format}</span>}
            </div>
          </div>
          {v.conditions && <p className="s-vac__cond"><b>{t("Умови:")}</b> {v.conditions}</p>}
          {v.description && (
            <details className="s-vac__more">
              <summary>{t("Що робити й кого шукаємо")}</summary>
              <HrText text={v.description} />
            </details>
          )}
          <button type="button" className="s-btn s-btn--primary s-btn--sm" onClick={() => apply(v.id)}>{t("Відгукнутися")}</button>
        </article>
      ))}

      {!!steps?.length && (
        <ol className="s-vacs__steps" aria-label={t("Як ми наймаємо")}>
          {steps.map((x, i) => <li key={i}><b>{x.title}</b>{x.text && <span>{x.text}</span>}</li>)}
        </ol>
      )}

      <div ref={formRef} id="apply">
        {state === "done" ? (
          <div className="s-form s-form--done" role="status">
            <div className="s-form__ok">🌿</div>
            <h3>{t("Дякуємо! Відгук отримали")}</h3>
            <p>{t("Ми переглянемо ваш відгук і зв'яжемося з вами. Наступний крок — коротка розмова телефоном.")}</p>
          </div>
        ) : (
          <form className="s-form" onSubmit={submit} noValidate>
            <h3 className="s-vacs__ftitle">{formTitle || t("Відгукнутися")}</h3>
            <input type="text" name="company" tabIndex={-1} autoComplete="off" className="s-hp" aria-hidden />
            {items.length > 0 && (
              <label className="s-field"><span>{t("Вакансія")}</span>
                <select value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">{t("Не знайшов своєї — хочу в команду")}</option>
                  {items.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                </select>
              </label>
            )}
            <div className="s-form__row">
              <label className="s-field"><span>{t("Ім'я та прізвище")}</span><input name="name" autoComplete="name" required /></label>
              <label className="s-field"><span>{t("Телефон")}</span><input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder={t("+380 __ ___ __ __")} required /></label>
            </div>
            <div className="s-form__row">
              <label className="s-field"><span>{t("Місто")}</span><input name="city" autoComplete="address-level2" /></label>
              <label className="s-field"><span>{t("Email (необов'язково)")}</span><input name="email" type="email" autoComplete="email" /></label>
            </div>
            <label className="s-field"><span>{t("Посилання на резюме або профіль")}</span><input name="cv" inputMode="url" placeholder="work.ua, LinkedIn, Google Drive…" /></label>
            <label className="s-field"><span>{t("Кілька слів про себе")}</span>
              <textarea name="about" rows={4} placeholder={t("Де працювали, чим пишаєтесь, чому хочете до нас")} />
            </label>
            {err && <div className="s-form__err" role="alert">{err}</div>}
            <button className="s-btn s-btn--primary s-btn--block" disabled={state === "sending"}>{state === "sending" ? t("Надсилаємо…") : t("Надіслати відгук")}</button>
            <p className="s-form__note">{t("Натискаючи кнопку, ви погоджуєтесь на обробку ваших контактних даних для розгляду кандидатури.")}</p>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";
// Форма заявки: ім'я, телефон, де зручно спілкуватись, задача. Заявка → leads (джерело «сайт») → CRM і Telegram.
import { useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { phoneHref } from "@/lib/site/format";
import { visitorMeta } from "@/lib/site/visitor";
import { buildLeadMeta } from "@/lib/site/leadMeta";
import { LANGS } from "@/lib/site/i18n";
import { useT } from "./I18n";

let client;
const sb = () => (client ||= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } }));

export const DEFAULT_GOALS = [
  "Дім для себе: дача чи постійне житло",
  "Індивідуальний проєкт будинку",
  "База відпочинку, глемпінг, кемпінг",
  "Котеджне чи смарт-містечко, забудова",
  "Дохідна нерухомість, інвестиція",
  "Соціальне житло, переселенці",
  "Житло для працівників",
  "Інше",
];
export const DEFAULT_AREAS = ["Ще не знаю", "до 30 м²", "30–50 м²", "50–100 м²", "100+ м²"];
const VIA = ["Дзвінок", "Viber", "Telegram"];

function utm() {
  try { return sessionStorage.getItem("moduler_utm") || ""; } catch { return ""; }
}

// Мовні версії: відвідувач бачить варіанти своєю мовою, а в CRM іде український варіант (за ним обирається воронка).
// *Src — українські відповідники перекладених значень (їх дає сервер: goal_src, goals_src, areas_src); без них значення вже українське.
export default function LeadForm({ settings = {}, goal, goalSrc, model, calc, compact, submitLabel, hint, noArea, goalOptions, goalOptionsSrc, goalLabel, pipeline }) {
  const { t, lang } = useT();
  const lead = settings.lead || {};
  const pairs = (labels, srcs) => labels.map((l, i) => ({ label: l, value: srcs?.[i] ?? l }));
  const own = (list) => list.map((v) => ({ label: t(v), value: v })); // стандартні варіанти з коду
  // варіанти «Що плануєте»: свої для цієї форми (блок) → з налаштувань сайту → стандартні
  const baseGoals = goalOptions?.filter(Boolean).length ? pairs(goalOptions.filter(Boolean), goalOptionsSrc?.filter(Boolean))
    : lead.goals?.length ? pairs(lead.goals, lead.goals_src) : own(DEFAULT_GOALS);
  const goalValue = goalSrc ?? goal; // що піде в CRM
  // своя задача сторінки (проєкт, партнерство) — першою
  const goals = goalValue && !baseGoals.some((g) => g.value === goalValue) ? [{ label: goalSrc ? goal : t(goal), value: goalValue }, ...baseGoals] : baseGoals;
  const areas = lead.areas?.length ? pairs(lead.areas, lead.areas_src) : own(DEFAULT_AREAS);
  const phone = settings.contacts?.phone;
  const [state, setState] = useState("idle"); // idle | sending | done | error
  const [err, setErr] = useState("");
  const [via, setVia] = useState(VIA[0]);
  const startedAt = useRef(null); // коли людина почала заповнювати — щоб бачити «бот за 1 секунду» і реальний час

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const p = Object.fromEntries(f.entries());
    if (!String(p.name || "").trim()) { e.currentTarget.name.focus(); return; }
    if (String(p.phone || "").replace(/\D/g, "").length < 9) { setErr(t("Перевірте номер телефону")); e.currentTarget.phone.focus(); return; }
    setState("sending"); setErr("");
    // заявка з мовної версії: менеджер одразу бачить, якою мовою відповідати
    if (lang !== "uk") p.message = [p.message, `[Мова сайту: ${LANGS[lang]?.name || lang}]`].filter(Boolean).join("\n");
    const fields = { ...p, contact_via: via, model: model || "", calc: calc || "", page: location.pathname, utm: utm(), ...(pipeline ? { pipeline } : {}) }; // pipeline — воронка CRM, якщо її задано в блоці форми
    let meta = null;
    try { meta = await visitorMeta({ formStartedAt: startedAt.current, form: { kind: compact ? "коротка" : "повна", model: model || undefined, calc: calc || undefined } }); } catch { /* без деталей теж приймаємо */ }
    // основний шлях — через сервер сайту (додає країну, місто, пристрій); якщо він недоступний — напряму в базу, як раніше
    let data = null, error = null;
    try {
      const r = await fetch("/api/site/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...fields, meta }) });
      if (r.status < 500) data = await r.json(); else throw new Error(String(r.status));
    } catch {
      let m = null;
      try { m = meta ? buildLeadMeta(meta, null) : null; } catch { /* */ }
      ({ data, error } = await sb().rpc("site_submit_lead", { p: { ...fields, ...(m ? { meta: m } : {}) } }));
    }
    if (error || !data?.ok) {
      setState("error");
      setErr((lang === "uk" && data?.error) || t("Не вдалося надіслати. Зателефонуйте нам, будь ласка."));
      return;
    }
    setState("done");
    try { window.gtag?.("event", "generate_lead"); window.fbq?.("track", "Lead"); } catch { /* аналітика не обов'язкова */ }
  }

  if (state === "done") {
    return (
      <div className={`s-form s-form--done${compact ? " s-form--compact" : ""}`} role="status">
        <div className="s-form__ok">🌿</div>
        <h3>{lead.success_title || t("Дякуємо! Заявку отримали")}</h3>
        <p>{lead.success_text || t("Зв'яжемося найближчим часом у зручний для вас спосіб, щоб спокійно все обговорити.")}</p>
      </div>
    );
  }

  return (
    <form className={`s-form${compact ? " s-form--compact" : ""}`} onSubmit={submit} onFocus={() => { startedAt.current ||= Date.now(); }} noValidate>
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="s-hp" aria-hidden />
      <div className="s-form__row">
        <label className="s-field"><span>{t("Як вас звати")}</span><input name="name" autoComplete="name" placeholder={t("Ім'я")} required /></label>
        <label className="s-field"><span>{t("Телефон")}</span><input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder={t("+380 __ ___ __ __")} required /></label>
      </div>
      <div className="s-field">
        <span>{t("Де зручніше спілкуватись")}</span>
        <div className="s-seg" role="radiogroup">
          {VIA.map((v) => <button key={v} type="button" role="radio" aria-checked={via === v} className={via === v ? "on" : ""} onClick={() => setVia(v)}>{t(v)}</button>)}
        </div>
      </div>
      {!compact && (
        <>
          <div className={noArea ? "" : "s-form__row"}>
            <label className="s-field"><span>{goalLabel || t("Що плануєте")}</span>
              <select name="goal" defaultValue={goals.some((g) => g.value === goalValue) ? goalValue : goals[0]?.value}>{goals.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select>
            </label>
            {!noArea && (
              <label className="s-field"><span>{t("Площа")}</span>
                <select name="area" defaultValue={areas[0]?.value}>{areas.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select>
              </label>
            )}
          </div>
          <label className="s-field"><span>{t("Кілька слів про задачу")}</span>
            <textarea name="message" rows={3} placeholder={hint || t("Для чого дім, скільки людей, чи є ділянка, орієнтовний бюджет")} />
          </label>
        </>
      )}
      {compact && goalValue && <input type="hidden" name="goal" value={goalValue} />}
      {err && <div className="s-form__err" role="alert">{err}</div>}
      <button className="s-btn s-btn--primary s-btn--block" disabled={state === "sending"}>
        {state === "sending" ? t("Надсилаємо…") : submitLabel || lead.button || t("Надіслати заявку")}
      </button>
      <p className="s-form__note">
        {lead.note || t("Без тиску й завчених скриптів. Натискаючи кнопку, ви погоджуєтесь на обробку контактних даних і технічних даних візиту (країна, пристрій, джерело переходу).")}
        {phone && <> {t("Або зателефонуйте:")} <a href={phoneHref(phone)}>{settings.contacts.phone_display || phone}</a></>}
      </p>
    </form>
  );
}

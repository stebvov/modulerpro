"use client";
// 🌐 Сайт → Переклад: англійська версія сайту. Український текст — основний; тут до кожного тексту — переклад.
// Тексту без перекладу на англійському сайті відповідає український. Нові й змінені тексти зʼявляються
// у «Без перекладу» самі; кнопка «Перекласти автоматично» перекладає їх (потім варто вичитати).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LANGS, collectStrings, i18nKey, isLang } from "@/lib/site/i18n";
import { queryStems } from "@/lib/site/search";
import { revalidateSite } from "./SitePagesScreen";
import "./editor.css";

const PAGE = 40;      // рядків на екрані за раз
const BATCH = 30;     // текстів за один запит автоперекладу
const OTHER = Object.keys(LANGS).filter(isLang);
// назва мови в українських фразах екрана: «Англійська версія», «переклад англійською»
const UK = { en: { adj: "Англійська", how: "англійською" } };

// усі рядки таблиці (база віддає по 1000)
async function fetchAll(supabase, lang) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("site_i18n").select("src,text,auto").eq("lang", lang).order("src_hash").range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export default function SiteI18nScreen() {
  const supabase = useMemo(() => createClient(), []);
  const [lang] = useState(OTHER[0]);
  const [sources, setSources] = useState(null); // [{ src, where }]
  const [dict, setDict] = useState({});         // src → { text, auto }
  const [filter, setFilter] = useState("missing");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState("");
  const [auto, setAuto] = useState(null); // { done, total } поки йде автопереклад
  const stop = useRef(false);

  const load = useCallback(async () => {
    try {
      const [pg, md, cs, st, vac, rows] = await Promise.all([
        supabase.from("site_pages").select("slug,title,nav_label,seo_title,seo_description,blocks,draft,published").order("sort"),
        supabase.from("site_models").select("*").order("sort"),
        supabase.from("site_cases").select("*").order("sort"),
        supabase.from("site_settings").select("value").eq("key", "main").maybeSingle(),
        supabase.from("hr_vacancies").select("title,city,format,conditions,description").eq("status", "open").eq("on_site", true),
        fetchAll(supabase, lang),
      ]);
      const seen = new Map(); // текст → де зустрівся вперше
      const add = (where, v) => { for (const s of collectStrings(v)) if (!seen.has(s)) seen.set(s, where); };
      add("Меню й налаштування", st.data?.value || {});
      for (const p of pg.data || []) {
        const where = `Сторінка «${p.title}»${p.published ? "" : " · прихована"}`;
        add(where, { title: p.title, nav_label: p.nav_label, seo_title: p.seo_title, seo_description: p.seo_description, blocks: p.blocks });
        if (p.draft) add(where + " · чернетка", p.draft);
      }
      for (const m of md.data || []) add(`${m.kind === "concept" ? "Проєкт" : "Модель"} «${m.name}»${m.published ? "" : " · прихована"}`, m);
      for (const c of cs.data || []) add(`Кейс «${c.title}»${c.published ? "" : " · прихований"}`, c);
      for (const v of vac.data || []) add(`Вакансія «${v.title}»`, v);
      setSources([...seen.entries()].map(([src, where]) => ({ src, where })));
      setDict(Object.fromEntries(rows.map((r) => [i18nKey(r.src), { text: r.text || "", auto: !!r.auto }])));
    } catch (e) { setMsg("Не вдалося завантажити: " + (e.message || e)); setSources([]); }
  }, [supabase, lang]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (sources || []).map((s) => ({ ...s, text: dict[s.src]?.text || "", auto: !!dict[s.src]?.auto })), [sources, dict]);
  const missing = rows.filter((r) => !r.text.trim());
  const autos = rows.filter((r) => r.text.trim() && r.auto);
  const stems = queryStems(q);
  const shown = rows.filter((r) => (filter === "missing" ? !r.text.trim() : filter === "auto" ? r.text.trim() && r.auto : true)
    && (!stems.length || stems.every((s) => (r.src + " " + r.text + " " + r.where).toLowerCase().includes(s))));

  async function save(src, text) {
    const prev = dict[src];
    const clean = text.trim();
    if ((prev?.text || "") === clean && !prev?.auto) return;
    if (!clean && !prev) return;
    setDict((d) => ({ ...d, [src]: { text: clean, auto: false } }));
    setStatus("Зберігаю…");
    const { error } = await supabase.from("site_i18n").upsert({ lang, src, text: clean, auto: false, updated_at: new Date().toISOString() }, { onConflict: "lang,src_hash" });
    if (error) { setStatus(""); setMsg("Не збережено: " + error.message); return; }
    setStatus("Збережено · на сайті"); setMsg("");
    revalidateSite();
  }

  async function translateAll() {
    const todo = missing.map((r) => r.src);
    if (!todo.length || auto) return;
    stop.current = false; setMsg("");
    setAuto({ done: 0, total: todo.length });
    let done = 0, got = 0;
    for (let i = 0; i < todo.length && !stop.current; i += BATCH) {
      const part = todo.slice(i, i + BATCH);
      const { data, error } = await supabase.functions.invoke("site-translate", { body: { lang, texts: part } });
      if (error || data?.error) {
        let text = data?.error || error?.message || "невідома помилка";
        try { const j = await error?.context?.json?.(); if (j?.error) text = j.error; } catch { /* тіла відповіді немає */ }
        setMsg("Автопереклад зупинився: " + text);
        break;
      }
      const items = data?.items || {};
      got += Object.keys(items).length;
      setDict((d) => ({ ...d, ...Object.fromEntries(Object.entries(items).map(([src, text]) => [i18nKey(src), { text, auto: true }])) }));
      done += part.length;
      setAuto({ done, total: todo.length });
    }
    setAuto(null);
    if (got) { revalidateSite(); setStatus(`Перекладено автоматично: ${got}`); setFilter("auto"); setLimit(PAGE); }
  }

  if (sources === null) return <div className="empty">Збираю тексти сайту…</div>;
  const uk = UK[lang] || { adj: LANGS[lang]?.name || lang, how: LANGS[lang]?.name || lang };

  return (
    <div className="se-i18n">
      <p className="se-intro">
        {uk.adj} версія сайту відкривається за адресою з <b>/{lang}</b> (наприклад, moduler.pro/{lang}) — на сайті є перемикач мови.
        Основний текст — український: сторінки, моделі й кейси редагуються, як і раніше. Тут до кожного тексту додається переклад;
        якщо перекладу немає, на сайті {uk.how} лишається український текст. Після зміни українського тексту його переклад треба оновити — він зʼявиться в «Без перекладу».
      </p>
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="se-tabs">
            {[["missing", `Без перекладу · ${missing.length}`], ["auto", `Перекладено автоматично · ${autos.length}`], ["all", `Усі · ${rows.length}`]].map(([k, l]) => (
              <button key={k} type="button" className={`subtab${filter === k ? " active" : ""}`} onClick={() => { setFilter(k); setLimit(PAGE); }}>{l}</button>
            ))}
          </div>
          <input className="se-search" type="search" placeholder="Пошук у текстах і перекладах" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
          <span className="note">{status}</span>
        </div>
        <a className="btn" href={`/site/${lang}`} target="_blank" rel="noopener">Відкрити сайт {uk.how}</a>
        {auto
          ? <button type="button" className="btn" onClick={() => { stop.current = true; }}>Зупинити · {auto.done} / {auto.total}</button>
          : <button type="button" className="btn primary" onClick={translateAll} disabled={!missing.length} title="Перекласти всі тексти без перекладу за допомогою ШІ">Перекласти автоматично{missing.length ? ` · ${missing.length}` : ""}</button>}
      </div>
      {msg && <div className="se-msg" onClick={() => setMsg("")}>{msg}</div>}
      {filter === "auto" && !!autos.length && <div className="se-tip">Ці тексти переклав ШІ. Перечитайте й поправте, де треба: після збереження вашої правки текст вважається вичитаним.</div>}

      <div className="se-i18n__list">
        {shown.slice(0, limit).map((r) => (
          <div key={r.src} className={`se-i18n__row${r.text.trim() ? "" : " miss"}`}>
            <div className="se-i18n__src">
              <small>{r.where}</small>
              <div>{r.src}</div>
            </div>
            <div className="se-i18n__tr">
              <textarea rows={Math.min(10, Math.max(1, Math.ceil(Math.max(r.src.length, r.text.length) / 60) + (r.src.split("\n").length - 1)))} defaultValue={r.text} key={r.text}
                placeholder={`Переклад ${uk.how}`} lang={LANGS[lang]?.html} onBlur={(e) => save(r.src, e.target.value)} />
              {r.auto && r.text.trim() && (
                <button type="button" className="btn small" onClick={() => save(r.src, r.text)} title="Переклад перевірено — прибрати з «Перекладено автоматично»">✓ Вичитано</button>
              )}
            </div>
          </div>
        ))}
        {!shown.length && <div className="empty">{filter === "missing" && !q ? "Усі тексти сайту перекладено." : "Нічого не знайдено."}</div>}
        {shown.length > limit && <button type="button" className="btn" onClick={() => setLimit(limit + PAGE * 2)}>Показати ще · лишилось {shown.length - limit}</button>}
      </div>
    </div>
  );
}

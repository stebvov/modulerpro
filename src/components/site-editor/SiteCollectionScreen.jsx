"use client";
// 🌐 Сайт → Моделі / Кейси: список карток, клік — форма праворуч. Зміни зберігаються самі й одразу йдуть на сайт.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CASE_KINDS, SIZE_GROUPS } from "@/lib/site/blocks";
import { CASE_FIELDS, MODEL_FIELDS, slugify } from "@/lib/site/schemas";
import { caseKinds, imgSmall, isHiddenStr, money, modelPriceFrom } from "@/lib/site/format";
import { Fields, LinkOptions } from "./Fields";
import { revalidateSite } from "./SitePagesScreen";
import DeleteButton from "@/components/DeleteButton";
import { ArrowDownIcon, ArrowUpIcon, ExternalIcon } from "@/components/Icon";
import "./editor.css";

// фото, які показуються на сайті (без прихованих «~~…»)
const visiblePhotos = (x) => (x.photos || []).filter((u) => !isHiddenStr(u));

const KINDS = {
  models: {
    table: "site_models", fields: MODEL_FIELDS, one: "модель", add: "+ Модель", path: "modeli", titleKey: "name",
    blank: (tab) => ({ name: tab === "concept" ? "Нова розробка" : "Нова модель", kind: tab === "concept" ? "concept" : "ready", slug: `model-${Date.now().toString(36)}`, size_group: 1, currency: "USD", published: false, photos: [], plans: [], features: [], highlights: [] }),
    sub: (x) => [x.popular && "★ популярна", SIZE_GROUPS[x.size_group], x.area_m2 && `${Number(x.area_m2)} м²`, x.kind === "concept" ? "розробка" : modelPriceFrom(x) ? `від ${money(modelPriceFrom(x), x.currency)}` : "без ціни"].filter(Boolean).join(" · "),
    warn: (x) => (x.kind !== "concept" && !modelPriceFrom(x) ? "Немає ціни — на сайті буде «порахуємо під вас»" : !visiblePhotos(x).length ? "Немає фото" : ""),
    tabs: [["ready", "Готові моделі"], ["concept", "Індивідуальні проєкти"], ["", "Усі"]],
    tabOf: (x) => x.kind || "ready",
    intro: "Готові моделі — каталог з цінами: кожна має свою сторінку-лендинг. Популярні (★) показуються першими. Індивідуальні проєкти — ваші розробки й візуалізації: окрема сторінка «Індивідуальні проєкти», щоб показати, що можливо безліч варіантів.",
  },
  cases: {
    table: "site_cases", fields: CASE_FIELDS, one: "кейс", add: "+ Кейс", path: "kejsy", titleKey: "title",
    blank: () => ({ title: "Новий об'єкт", slug: `case-${Date.now().toString(36)}`, kind: "private", kinds: ["private"], published: false, photos: [] }),
    sub: (x) => [caseKinds(x).map((k) => CASE_KINDS[k]).filter(Boolean).join(" + "), x.location, x.format].filter(Boolean).join(" · "),
    warn: (x) => (!visiblePhotos(x).length ? "Немає фото" : !x.task && !x.solution ? "Додайте історію: задача → що зробили" : !x.quote ? "Немає слів власника" : ""),
    intro: "Портфоліо: картки в блоці «Кейси» і сторінка кожного об'єкта з галереєю. Історія «задача → рішення» і слова власника продають краще за фото.",
  },
};

export default function SiteCollectionScreen({ kind }) {
  const K = KINDS[kind];
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState([]);
  const [selId, setSelId] = useState(null);
  const [status, setStatus] = useState("");
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState(K.tabs ? K.tabs[0][0] : "");
  const timer = useRef(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from(K.table).select("*").order("sort").order(K.titleKey);
    if (error) { setMsg("Не вдалося завантажити: " + error.message); return; }
    setRows(data || []);
  }, [supabase, K]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const sel = rows.find((r) => r.id === selId) || null;

  function edit(next) {
    if (next[K.titleKey] !== sel[K.titleKey] && sel.slug === slugify(sel[K.titleKey])) next.slug = slugify(next[K.titleKey]) || next.slug;
    setRows((rs) => rs.map((r) => (r.id === next.id ? next : r)));
    setStatus("Зберігаю…");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const patch = {};
      K.fields.forEach((f) => { patch[f.key] = next[f.key] ?? null; });
      if ("kinds" in patch) patch.kind = patch.kinds?.[0] || "private"; // старе поле kind = основний (перший) тип
      if (!/^[a-z0-9-]+$/.test(patch.slug || "")) { setStatus(""); setMsg("Адреса — лише латиниця, цифри й дефіс."); return; }
      const { error } = await supabase.from(K.table).update(patch).eq("id", next.id);
      if (error) { setStatus(""); setMsg(error.code === "23505" ? "Така адреса вже зайнята." : "Не збережено: " + error.message); return; }
      setStatus("Збережено · на сайті"); setMsg("");
      revalidateSite();
    }, 800);
  }

  async function add() {
    const { data, error } = await supabase.from(K.table).insert({ ...K.blank(tab), sort: (rows.at(-1)?.sort || 0) + 1 }).select().single();
    if (error) { setMsg("Не додано: " + error.message); return; }
    setRows((rs) => [...rs, data]); setSelId(data.id);
  }

  async function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const a = [...rows]; [a[i], a[j]] = [a[j], a[i]];
    const withSort = a.map((r, k) => ({ ...r, sort: k }));
    setRows(withSort);
    await Promise.all([withSort[i], withSort[j]].map((r) => supabase.from(K.table).update({ sort: r.sort }).eq("id", r.id)));
    revalidateSite();
  }

  const shown = rows.filter((r) => (!tab || !K.tabOf || K.tabOf(r) === tab) && (!q || JSON.stringify([r[K.titleKey], r.location, r.tagline]).toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="se-coll">
      <LinkOptions />
      <p className="se-intro">{K.intro}</p>
      {K.tabs && (
        <div className="se-tabs" style={{ marginBottom: 10 }}>
          {K.tabs.map(([k, l]) => (
            <button key={k} type="button" className={`subtab${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>
              {l} · {rows.filter((r) => !k || K.tabOf(r) === k).length}
            </button>
          ))}
        </div>
      )}
      <div className="toolbar">
        <div className="toolbar-left">
          <input className="se-search" placeholder="Пошук" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="note">{rows.filter((r) => r.published).length} на сайті · {rows.filter((r) => !r.published).length} приховано</span>
        </div>
        <button type="button" className="btn primary" onClick={add}>{tab === "concept" ? "+ Розробка" : K.add}</button>
      </div>
      {msg && <div className="se-msg" onClick={() => setMsg("")}>{msg}</div>}
      <div className={`se-coll__main${sel ? " has-sel" : ""}`}>
        <div className="se-coll__list">
          {shown.map((r) => {
            const i = rows.indexOf(r);
            const w = K.warn(r);
            return (
              <div key={r.id} className={`se-item${r.id === selId ? " on" : ""}${r.published ? "" : " off"}`}>
                <button type="button" className="se-item__main" onClick={() => setSelId(r.id)}>
                  <span className="se-item__img">{visiblePhotos(r)[0] ? <img src={imgSmall(visiblePhotos(r)[0])} alt="" /> : "📷"}</span>
                  <span className="se-item__txt">
                    <b>{r[K.titleKey]}</b>
                    <small>{K.sub(r)}</small>
                    {!r.published ? <em className="se-badge">приховано</em> : w ? <em className="se-badge se-badge--warn">{w}</em> : null}
                  </span>
                </button>
                <div className="se-tools se-tools--col">
                  <button type="button" onClick={() => move(i, -1)} disabled={!i || !!q || !!tab} title={tab ? "Порядок — на вкладці «Усі»" : "Вище"}><ArrowUpIcon /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1 || !!q || !!tab} title={tab ? "Порядок — на вкладці «Усі»" : "Нижче"}><ArrowDownIcon /></button>
                </div>
              </div>
            );
          })}
          {!shown.length && <div className="empty">Нічого не знайдено.</div>}
        </div>
        {sel && (
          <div className="se-coll__form">
            <div className="se-coll__formhead">
              <b>{sel[K.titleKey]}</b>
              <span className="note">{status}</span>
              <a className="btn small" href={`/site/${K.path}/${sel.slug}`} target="_blank" rel="noopener"><ExternalIcon /> На сайті</a>
              <button type="button" className="btn small" onClick={() => setSelId(null)}>Закрити</button>
            </div>
            <Fields fields={K.fields} value={sel} onChange={edit} />
            <div className="se-row">
              {/* спершу ховаємо з сайту; видалити назавжди можна лише прихований запис */}
              {sel.published ? (
                <button type="button" className="btn small" onClick={() => edit({ ...sel, published: false })}>Сховати з сайту</button>
              ) : (
                <DeleteButton table={K.table} id={sel.id} what={K.one} onDone={() => { setSelId(null); load(); revalidateSite(); }} onError={setMsg} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

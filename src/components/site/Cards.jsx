"use client";
// Картки моделі й кейсу — спільні для каталогу, сторінок сайту й живого перегляду.
import { useRef, useState } from "react";
import { CASE_KINDS, SIZE_GROUPS } from "@/lib/site/blocks";
import { caseKinds, imgProps, imgSmall, modelPriceFrom, money, num, siteHref } from "@/lib/site/format";
import { pluralForm } from "@/lib/site/i18n";
import { useT } from "./I18n";

const MAX_SLIDES = 12;

// swipe — фото в картці можна гортати (стрілки на компʼютері, палець на телефоні), не відкриваючи сторінку моделі;
// у стрічці карток, яка сама гортається вбік, лишається одна обкладинка
export function ModelCard({ m, base, swipe = true }) {
  const { t, tf, lang } = useT();
  const from = modelPriceFrom(m);
  const href = siteHref(base, `/modeli/${m.slug}`);
  // «2 спальні» / «2 bedrooms» / «2 sypialnie» / «5 спален»: форма множини залежить від мови
  const beds = (n) => `${n} ${t(["спальня", "спальні", "спалень"][pluralForm(lang, n)])}`;
  const photos = m.photos || [];
  const plans = m.plans?.length ? m.plans : m.plan_image ? [m.plan_image] : [];
  // спершу фото й візуалізації (перше — обкладинка), далі планування
  const slides = (swipe ? [...photos.map((u) => [u, false]), ...plans.map((u) => [u, true])] : photos.slice(0, 1).map((u) => [u, false])).slice(0, MAX_SLIDES);
  const firstPlan = slides.findIndex(([, plan]) => plan);
  const box = useRef(null);
  const [i, setI] = useState(0);
  const sizes = "(max-width: 700px) 100vw, 33vw";

  function to(k, e) {
    e?.preventDefault(); e?.stopPropagation();
    const el = box.current;
    if (el) el.scrollTo({ left: Math.max(0, Math.min(slides.length - 1, k)) * el.clientWidth, behavior: "smooth" });
  }

  return (
    <article className="s-card s-model">
      <div className="s-card__img">
        {slides.length ? (
          <div className="s-card__slides" ref={box} onScroll={(e) => { const k = Math.round(e.currentTarget.scrollLeft / (e.currentTarget.clientWidth || 1)); if (k !== i) setI(k); }}>
            {slides.map(([u, plan], k) => (
              <a key={u + k} href={href} className={plan ? "s-card__slide s-card__slide--plan" : "s-card__slide"} tabIndex={k ? -1 : undefined}>
                <img alt={k ? tf("{name}, фото {n}", { name: m.name, n: k + 1 }) : m.name} loading="lazy" {...imgProps(u, sizes)} />
              </a>
            ))}
          </div>
        ) : <a href={href} className="s-card__noimg">🏡</a>}
        {slides.length > 1 && (
          <>
            <button type="button" className="s-card__nav s-card__nav--prev" aria-label={t("Попереднє")} disabled={i === 0} onClick={(e) => to(i - 1, e)}>‹</button>
            <button type="button" className="s-card__nav s-card__nav--next" aria-label={t("Наступне")} disabled={i >= slides.length - 1} onClick={(e) => to(i + 1, e)}>›</button>
            <div className="s-card__dots" aria-hidden>{slides.map((_, k) => <i key={k} className={k === i ? "on" : undefined} />)}</div>
          </>
        )}
        {/* маленький ескіз планування поверх обкладинки: натиск гортає до планування */}
        {swipe && firstPlan > 0 && i === 0 && (
          <button type="button" className="s-card__plan" title={t("Планування")} aria-label={t("Планування")} onClick={(e) => to(firstPlan, e)}>
            <img src={imgSmall(slides[firstPlan][0])} alt="" loading="lazy" />
          </button>
        )}
        <div className="s-card__tags">
          <span className="s-card__tag">{t(SIZE_GROUPS[m.size_group])}</span>
          {m.popular && <span className="s-card__badge">{t("★ Популярна")}</span>}
          {m.kind === "concept" && <span className="s-card__badge s-card__badge--concept">{t("Індивідуальний проєкт")}</span>}
        </div>
      </div>
      <a className="s-card__body" href={href}>
        <h3>{m.name}</h3>
        <div className="s-model__meta">
          {m.area_m2 && <span>{num(Number(m.area_m2), lang)} {t("м²")}</span>}
          {m.bedrooms != null && <span>{m.bedrooms ? beds(m.bedrooms) : t("студія")}</span>}
          {m.modules && <span>{num(m.modules, lang)} {lang === "uk" ? "мод." : t(["модуль", "модулі", "модулів"][pluralForm(lang, m.modules)])}</span>}
        </div>
        {m.tagline && <p>{m.tagline}</p>}
        <div className="s-model__price">
          {from ? <>{t("від")} <b>{money(from, m.currency, lang)}</b></> : <span className="s-muted">{m.kind === "concept" ? t("Адаптуємо під вас і порахуємо") : t("Ціну порахуємо під вас")}</span>}
        </div>
      </a>
    </article>
  );
}

export function CaseCard({ c, base }) {
  const { t } = useT();
  return (
    <a className="s-case" href={siteHref(base, `/kejsy/${c.slug}`)}>
      {c.photos?.[0] && <img alt={c.title} loading="lazy" {...imgProps(c.photos[0], "(max-width: 700px) 100vw, 33vw")} />}
      <div className="s-case__veil" />
      <div className="s-case__meta">
        <span className="s-case__kind">{[...caseKinds(c).map((k) => t(CASE_KINDS[k])).filter(Boolean), c.location].filter(Boolean).join(" · ")}</span>
        <h3>{c.title}</h3>
        {c.format && <span className="s-case__fmt">{c.format}</span>}
      </div>
    </a>
  );
}

"use client";
// Картки моделі й кейсу — спільні для каталогу, сторінок сайту й живого перегляду.
import { CASE_KINDS, SIZE_GROUPS } from "@/lib/site/blocks";
import { caseKinds, imgProps, modelPriceFrom, money, num, siteHref } from "@/lib/site/format";
import { useT } from "./I18n";

export function ModelCard({ m, base }) {
  const { t, lang } = useT();
  const from = modelPriceFrom(m);
  // «2 спальні» / «2 bedrooms»: множина залежить від мови
  const beds = (n) => (lang === "uk" ? `${n} спальн${n === 1 ? "я" : "і"}` : `${n} ${t(n === 1 ? "спальня" : "спальні")}`);
  return (
    <a className="s-card s-model" href={siteHref(base, `/modeli/${m.slug}`)}>
      <div className="s-card__img">
        {m.photos?.[0] ? <img alt={m.name} loading="lazy" {...imgProps(m.photos[0], "(max-width: 700px) 100vw, 33vw")} /> : <div className="s-card__noimg">🏡</div>}
        <span className="s-card__tag">{t(SIZE_GROUPS[m.size_group])}</span>
        {m.popular && <span className="s-card__badge">{t("★ Популярна")}</span>}
        {m.kind === "concept" && <span className="s-card__badge s-card__badge--concept">{t("Індивідуальний проєкт")}</span>}
      </div>
      <div className="s-card__body">
        <h3>{m.name}</h3>
        <div className="s-model__meta">
          {m.area_m2 && <span>{num(Number(m.area_m2), lang)} {t("м²")}</span>}
          {m.bedrooms != null && <span>{m.bedrooms ? beds(m.bedrooms) : t("студія")}</span>}
          {m.modules && <span>{num(m.modules, lang)} {lang === "uk" ? "мод." : t(Number(m.modules) === 1 ? "модуль" : "модулі")}</span>}
        </div>
        {m.tagline && <p>{m.tagline}</p>}
        <div className="s-model__price">
          {from ? <>{t("від")} <b>{money(from, m.currency, lang)}</b></> : <span className="s-muted">{m.kind === "concept" ? t("Адаптуємо під вас і порахуємо") : t("Ціну порахуємо під вас")}</span>}
        </div>
      </div>
    </a>
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

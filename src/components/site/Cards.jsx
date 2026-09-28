// Картки моделі й кейсу — спільні для каталогу, сторінок сайту й живого перегляду.
import { CASE_KINDS, SIZE_GROUPS } from "@/lib/site/blocks";
import { imgProps, money, modelPriceFrom, siteHref } from "@/lib/site/format";

export function ModelCard({ m, base }) {
  const from = modelPriceFrom(m);
  return (
    <a className="s-card s-model" href={siteHref(base, `/modeli/${m.slug}`)}>
      <div className="s-card__img">
        {m.photos?.[0] ? <img alt={m.name} loading="lazy" {...imgProps(m.photos[0], "(max-width: 700px) 100vw, 33vw")} /> : <div className="s-card__noimg">🏡</div>}
        <span className="s-card__tag">{SIZE_GROUPS[m.size_group]}</span>
      </div>
      <div className="s-card__body">
        <h3>{m.name}</h3>
        <div className="s-model__meta">
          {m.area_m2 && <span>{Number(m.area_m2)} м²</span>}
          {m.bedrooms != null && <span>{m.bedrooms ? `${m.bedrooms} спальн${m.bedrooms === 1 ? "я" : "і"}` : "студія"}</span>}
          {m.modules && <span>{String(m.modules).replace(".", ",")} мод.</span>}
        </div>
        {m.tagline && <p>{m.tagline}</p>}
        <div className="s-model__price">{from ? <>від <b>{money(from, m.currency)}</b></> : <span className="s-muted">Ціну порахуємо під вас</span>}</div>
      </div>
    </a>
  );
}

export function CaseCard({ c, base }) {
  return (
    <a className="s-case" href={siteHref(base, `/kejsy/${c.slug}`)}>
      {c.photos?.[0] && <img alt={c.title} loading="lazy" {...imgProps(c.photos[0], "(max-width: 700px) 100vw, 33vw")} />}
      <div className="s-case__veil" />
      <div className="s-case__meta">
        <span className="s-case__kind">{CASE_KINDS[c.kind] || ""}{c.location ? ` · ${c.location}` : ""}</span>
        <h3>{c.title}</h3>
        {c.format && <span className="s-case__fmt">{c.format}</span>}
      </div>
    </a>
  );
}

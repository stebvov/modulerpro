// Сторінка моделі: фото, характеристики, ціни за рівнями готовності, заявка з уже обраною моделлю.
import { notFound } from "next/navigation";
import { getBase, getModels, getSettings } from "@/lib/site/data";
import { LEVELS, SIZE_GROUPS } from "@/lib/site/blocks";
import { imgProps, money, modelPriceFrom, paragraphs, rich, siteHref } from "@/lib/site/format";
import { siteRobots } from "@/components/site/CmsPage";
import { ModelCard } from "@/components/site/Cards";
import Gallery from "@/components/site/Gallery";
import LeadForm from "@/components/site/LeadForm";

async function find(slug) {
  return (await getModels()).find((m) => m.slug === slug) || null;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const m = await find(slug);
  if (!m) return {};
  const from = modelPriceFrom(m);
  return {
    title: `${m.name}${m.area_m2 ? ` — модульний будинок ${Number(m.area_m2)} м²` : ""}`,
    description: [m.tagline, from ? `Ціна від ${money(from, m.currency)}.` : null, "Виробництво, доставка й монтаж під ключ."].filter(Boolean).join(" "),
    alternates: { canonical: `${await getBase()}/modeli/${m.slug}` },
    openGraph: { images: m.photos?.[0] ? [m.photos[0]] : undefined },
    robots: await siteRobots(),
  };
}

export default async function ModelPage({ params }) {
  const { slug } = await params;
  const [all, settings, base] = await Promise.all([getModels(), getSettings(), getBase()]);
  const m = all.find((x) => x.slug === slug);
  if (!m) notFound();
  const from = modelPriceFrom(m);
  const prices = LEVELS.map(([k, name]) => [name, m[`price_${k}`]]).filter(([, v]) => Number(v) > 0);
  const similar = all.filter((x) => x.id !== m.id).sort((a, b) => Math.abs(a.size_group - m.size_group) - Math.abs(b.size_group - m.size_group)).slice(0, 3);
  const photos = m.photos || [];
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: m.name, description: m.tagline || m.description,
    image: photos.slice(0, 4), brand: { "@type": "Brand", name: settings.brand?.name || "Moduler" },
    ...(from ? { offers: { "@type": "Offer", priceCurrency: m.currency || "USD", price: from, availability: "https://schema.org/PreOrder" } } : {}),
  };

  return (
    <>
      <section className="s-sec s-sec--cloud s-detail">
        <div className="s-wrap">
          <nav className="s-crumbs"><a href={siteHref(base, "/")}>Головна</a> / <a href={siteHref(base, "/modeli")}>Моделі</a> / <span>{m.name}</span></nav>
          <div className="s-detail__grid">
            <div className="s-detail__media">
              {photos[0] ? <img className="s-detail__cover" alt={m.name} {...imgProps(photos[0], "(max-width: 900px) 100vw, 60vw")} fetchPriority="high" /> : <div className="s-card__noimg">🏡</div>}
              {photos.length > 1 && <Gallery images={photos.slice(1)} title={m.name} layout="strip" />}
            </div>
            <aside className="s-detail__side">
              <div className="s-eyebrow">{SIZE_GROUPS[m.size_group]}</div>
              <h1 className="s-title">{m.name}</h1>
              {m.tagline && <p className="s-lead">{m.tagline}</p>}
              <dl className="s-specs">
                {m.area_m2 && <><dt>Площа</dt><dd>{Number(m.area_m2)} м²</dd></>}
                {m.modules && <><dt>Модулів</dt><dd>{String(m.modules).replace(".", ",")}</dd></>}
                {m.bedrooms != null && <><dt>Спальні</dt><dd>{m.bedrooms || "студія"}</dd></>}
                {m.dimensions && <><dt>Габарити</dt><dd>{m.dimensions}</dd></>}
              </dl>
              {prices.length ? (
                <div className="s-prices">
                  {prices.map(([name, v]) => <div key={name}><span>{name}</span><b>від {money(v, m.currency)}</b></div>)}
                  <small>Фундамент, доставка й монтаж рахуються окремо під вашу ділянку.</small>
                </div>
              ) : (
                <div className="s-prices"><div><span>Вартість</span><b>порахуємо під вас</b></div><small>Залежить від рівня готовності, ділянки й регіону.</small></div>
              )}
              <a className="s-btn s-btn--primary s-btn--block" href="#contact">Отримати кошторис на {m.name}</a>
            </aside>
          </div>
        </div>
      </section>

      {(m.description || m.features?.length || m.plan_image) && (
        <section className="s-sec s-sec--light">
          <div className={`s-wrap s-split${m.plan_image ? "" : " s-split--solo"}`}>
            <div className="s-prose">
              <h2 className="s-title">Про модель</h2>
              {paragraphs(m.description).map((p, i) => <p key={i}>{rich(p)}</p>)}
              {!!m.features?.length && <ul className="s-checks s-checks--dark">{m.features.map((f, i) => <li key={i}>{typeof f === "string" ? f : f.text}</li>)}</ul>}
            </div>
            {m.plan_image && <figure className="s-plan"><img alt={`Планування ${m.name}`} loading="lazy" src={m.plan_image} /><figcaption>Планування — адаптуємо під вашу родину</figcaption></figure>}
          </div>
        </section>
      )}

      <section id="contact" className="s-sec s-sec--dark s-formsec">
        <div className="s-wrap">
          <div className="s-head s-head--center">
            <div className="s-eyebrow">Кошторис за 1 розмову</div>
            <h2 className="s-title">Порахуємо {m.name} під вашу ділянку</h2>
            <p className="s-lead">Рівень готовності, фундамент, доставка й монтаж — усе в одному кошторисі.</p>
          </div>
          <LeadForm settings={settings} model={m.name} />
        </div>
      </section>

      {!!similar.length && (
        <section className="s-sec s-sec--cloud">
          <div className="s-wrap">
            <div className="s-head"><h2 className="s-title">Інші моделі</h2></div>
            <div className="s-grid s-grid--models">{similar.map((x) => <ModelCard key={x.id} m={x} base={base} />)}</div>
          </div>
        </section>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
    </>
  );
}

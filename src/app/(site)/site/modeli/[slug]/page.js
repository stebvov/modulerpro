// Сторінка моделі — окремий лендинг: перший екран з ціною, переваги, візуалізації, планування, ціни за рівнями,
// реалізовані будинки цього формату, етапи й питання (з головної), заявка з уже обраною моделлю.
// Для розробок (kind=concept) — сторінка індивідуального проєкту: основа, яку адаптуємо під клієнта.
import { notFound } from "next/navigation";
import { getBase, getCases, getModels, getPage, getSettings } from "@/lib/site/data";
import { LEVELS, SIZE_GROUPS } from "@/lib/site/blocks";
import { imgProps, money, modelPriceFrom, paragraphs, rich, siteHref, youtubeId } from "@/lib/site/format";
import { siteRobots } from "@/components/site/CmsPage";
import { CaseCard, ModelCard } from "@/components/site/Cards";
import SiteRenderer, { Choice } from "@/components/site/SiteRenderer";
import Gallery from "@/components/site/Gallery";
import LeadForm from "@/components/site/LeadForm";
import YouTube from "@/components/site/YouTube";

const LEVEL_TEXT = {
  shell: "Каркас, утеплення, покрівля, фасад, вікна й двері",
  prefinish: "+ електрика, вода, каналізація, стіни й підлога під фініш",
  ready: "+ оздоблення, сантехніка, світло, кухня й меблі",
};

const CHOICE = {
  id: "model-choice", theme: "cloud", eyebrow: "Як обрати", title: "Готова модель чи *свій проєкт*?",
  a_title: "Готова модель", a_text: "Проєкт уже відпрацьований на фабриці — тому швидше й вигідніше.",
  a_points: [{ text: "Коротший строк виготовлення" }, { text: "Краща ціна: без витрат на проєктування" }, { text: "Видно, як виглядає наживо" }],
  a_cta: { label: "Обрати готову модель", href: "/modeli" },
  b_title: "Індивідуальний проєкт", b_text: "Беремо одну з наших розробок за основу й адаптуємо під вас.",
  b_points: [{ text: "Планування під вашу родину чи бізнес" }, { text: "Фасад, площа, тераса, сауна — на вибір" }, { text: "Строк і ціну рахуємо окремо" }],
  b_cta: { label: "Дивитися розробки", href: "/proekty" },
};

async function find(slug) {
  return (await getModels()).find((m) => m.slug === slug) || null;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const m = await find(slug);
  if (!m) return {};
  const from = modelPriceFrom(m);
  const concept = m.kind === "concept";
  return {
    title: concept ? `${m.name} — індивідуальний проєкт модульного будинку` : `${m.name}${m.area_m2 ? ` — модульний будинок ${Number(m.area_m2)} м²` : ""}`,
    description: [m.tagline, from ? `Ціна від ${money(from, m.currency)}.` : null, concept ? "Адаптуємо під вашу ділянку й бюджет." : "Виробництво, доставка й монтаж під ключ."].filter(Boolean).join(" "),
    alternates: { canonical: `${await getBase()}/modeli/${m.slug}` },
    openGraph: { images: m.photos?.[0] ? [m.photos[0]] : undefined },
    robots: await siteRobots(),
  };
}

export default async function ModelPage({ params }) {
  const { slug } = await params;
  const [all, settings, base, cases, home] = await Promise.all([getModels(), getSettings(), getBase(), getCases(), getPage("home")]);
  const m = all.find((x) => x.slug === slug);
  if (!m) notFound();
  const concept = m.kind === "concept";
  const ctx = { base, settings, models: all, cases };
  const from = modelPriceFrom(m);
  const photos = m.photos || [];
  const plans = (m.plans?.length ? m.plans : m.plan_image ? [m.plan_image] : []);
  const prices = LEVELS.map(([k, name]) => [k, name, m[`price_${k}`]]).filter(([, , v]) => Number(v) > 0);
  const area = m.area_m2 ? Math.round(Number(m.area_m2)) : null;
  const sameFormat = area ? cases.filter((c) => new RegExp(`(^|\\D)${area}\\s?м`).test(c.format || "")).slice(0, 3) : [];
  const others = all.filter((x) => x.id !== m.id && (x.kind || "ready") === (m.kind || "ready"))
    .sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0) || Math.abs(a.size_group - m.size_group) - Math.abs(b.size_group - m.size_group)).slice(0, 3);
  const homeBlocks = home?.blocks || [];
  const steps = homeBlocks.find((b) => b.type === "steps" && !b.hidden);
  const faq = homeBlocks.find((b) => b.type === "faq" && !b.hidden);
  const vid = youtubeId(m.video);
  const facts = [
    m.area_m2 && ["Площа", `${String(Number(m.area_m2)).replace(".", ",")} м²`],
    m.modules && ["Модулів", String(m.modules).replace(".", ",")],
    m.bedrooms != null && ["Спальні", m.bedrooms ? String(m.bedrooms) : "студія"],
    m.dimensions && ["Габарити", m.dimensions],
    m.build_time && ["Виготовлення", m.build_time],
  ].filter(Boolean);
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: m.name, description: m.tagline || m.description,
    image: photos.slice(0, 4), brand: { "@type": "Brand", name: settings.brand?.name || "Moduler" },
    ...(from ? { offers: { "@type": "Offer", priceCurrency: m.currency || "USD", price: from, availability: "https://schema.org/PreOrder" } } : {}),
  };

  return (
    <>
      <section className="s-hero s-hero--photo s-hero--model s-sec--dark">
        {photos[0] && <img className="s-hero__bg" alt={m.name} {...imgProps(photos[0])} fetchPriority="high" />}
        <div className="s-hero__veil" />
        <div className="s-wrap">
          <nav className="s-crumbs"><a href={siteHref(base, "/")}>Головна</a> / <a href={siteHref(base, concept ? "/proekty" : "/modeli")}>{concept ? "Індивідуальні проєкти" : "Моделі"}</a></nav>
          <div className="s-eyebrow">
            {concept ? "Індивідуальний проєкт · розробка Moduler" : `${m.popular ? "★ Популярна модель · " : ""}${SIZE_GROUPS[m.size_group] || ""}`}
          </div>
          <h1 className="s-hero__title">{m.name}</h1>
          {m.tagline && <p className="s-hero__sub">{m.tagline}</p>}
          {!!facts.length && (
            <div className="s-facts">{facts.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
          )}
          {from ? <div className="s-price-chip">від {money(from, m.currency)}</div> : !concept && <div className="s-price-chip">Ціну порахуємо під вашу ділянку</div>}
          <div className="s-actions">
            <a className="s-btn s-btn--primary" href="#contact">{concept ? "Хочу подібний будинок" : `Отримати кошторис`}</a>
            <a className="s-btn s-btn--ghost" href="#gallery">{concept ? "Дивитися візуалізації" : "Дивитися фото"}</a>
          </div>
        </div>
      </section>

      {concept && (
        <section className="s-sec s-sec--cloud s-sec--tight">
          <div className="s-wrap">
            <div className="s-callout">
              💡 Це розробка нашої команди, а не готова модель з каталогу. Беремо її за основу й адаптуємо під вашу ділянку, родину чи бізнес: площу, планування, фасад, терасу.
              Строк і ціну рахуємо індивідуально. Якщо важливі швидкість і ціна — <a href={siteHref(base, "/modeli")}>оберіть готову модель</a>.
            </div>
          </div>
        </section>
      )}

      {(!!m.highlights?.length || m.description || m.features?.length) && (
        <section className="s-sec s-sec--light">
          <div className="s-wrap">
            <div className="s-head">
              <div className="s-eyebrow">Про модель</div>
              <h2 className="s-title">Чому обирають <em>{m.name}</em></h2>
              {paragraphs(m.description).map((p, i) => <p key={i} className="s-lead">{rich(p, { links: true })}</p>)}
            </div>
            {!!m.highlights?.length && (
              <div className={`s-feats s-cols-${Math.min(4, Math.max(2, m.highlights.length))}`}>
                {m.highlights.map((f, i) => (
                  <div key={i} className="s-feat">{f.icon && <div className="s-feat__icon">{f.icon}</div>}<h3>{f.title}</h3><p>{rich(f.text)}</p></div>
                ))}
              </div>
            )}
            {!!m.features?.length && (
              <ul className="s-checks s-checks--dark s-checks--cols">{m.features.map((f, i) => <li key={i}>{typeof f === "string" ? f : f.text}</li>)}</ul>
            )}
          </div>
        </section>
      )}

      {photos.length > 1 && (
        <section id="gallery" className="s-sec s-sec--cloud">
          <div className="s-wrap">
            <div className="s-head"><div className="s-eyebrow">{concept ? "Візуалізації" : "Фото й візуалізації"}</div><h2 className="s-title">Роздивіться <em>ближче</em></h2></div>
            <Gallery images={photos} title={m.name} captions={m.photo_captions} />
          </div>
        </section>
      )}

      {!!plans.length && (
        <section className="s-sec s-sec--light">
          <div className="s-wrap">
            <div className="s-head">
              <div className="s-eyebrow">Планування</div>
              <h2 className="s-title">{plans.length > 1 ? <>Варіанти <em>планування</em></> : <>Як усе <em>влаштовано</em></>}</h2>
              <p className="s-lead">Планування адаптуємо під вашу родину: кількість спалень, кухня, гардеробна, тераса.</p>
            </div>
            <Gallery images={plans} title={`Планування ${m.name}`} layout="plans" captions={m.photo_captions} />
          </div>
        </section>
      )}

      {!concept && (
        <section className="s-sec s-sec--cloud">
          <div className="s-wrap">
            <div className="s-head"><div className="s-eyebrow">Ціна</div><h2 className="s-title">Скільки коштує <em>{m.name}</em></h2>
              <p className="s-lead">Ціна залежить від рівня готовності. Фундамент, доставку й монтаж рахуємо окремо під вашу ділянку.</p></div>
            <div className="s-tiers">
              {LEVELS.map(([k, name], i) => {
                const v = m[`price_${k}`];
                return (
                  <div key={k} className={`s-tier${k === "ready" ? " s-tier--hl" : ""}`}>
                    <div className="s-tier__n">{String(i + 1).padStart(2, "0")}</div>
                    <h3>{name}</h3>
                    <p>{LEVEL_TEXT[k]}</p>
                    <div className="s-tier__price">{Number(v) > 0 ? `від ${money(v, m.currency)}` : "за запитом"}</div>
                  </div>
                );
              })}
            </div>
            {!prices.length && <p className="s-note">Точну вартість на {m.name} надішлемо в месенджер після короткої розмови — залиште контакт нижче.</p>}
          </div>
        </section>
      )}

      {vid && (
        <section className="s-sec s-sec--light">
          <div className="s-wrap"><div className="s-video"><YouTube id={vid} caption={m.name} /></div></div>
        </section>
      )}

      {!!sameFormat.length && (
        <section className="s-sec s-sec--light">
          <div className="s-wrap">
            <div className="s-head"><div className="s-eyebrow">Реалізовані об&apos;єкти</div><h2 className="s-title">Такі будинки <em>вже стоять</em></h2></div>
            <div className="s-grid s-grid--cases">{sameFormat.map((c) => <CaseCard key={c.id} c={c} base={base} />)}</div>
          </div>
        </section>
      )}

      {!concept && steps && <SiteRenderer blocks={[{ ...steps, id: "model-steps", theme: "cloud" }]} ctx={ctx} />}

      <Choice b={CHOICE} ctx={ctx} />

      <section id="contact" className="s-sec s-sec--dark s-formsec">
        <div className="s-wrap">
          <div className="s-head s-head--center">
            <div className="s-eyebrow">{concept ? "Індивідуальний проєкт" : "Кошторис за одну розмову"}</div>
            <h2 className="s-title">{concept ? <>Обговоримо ваш будинок на основі <em>{m.name}</em></> : <>Порахуємо <em>{m.name}</em> під вашу ділянку</>}</h2>
            <p className="s-lead">{concept ? "Розкажіть про задачу — запропонуємо планування, строк і вартість." : "Рівень готовності, фундамент, доставка й монтаж — усе в одному кошторисі."}</p>
          </div>
          <LeadForm settings={settings} model={m.name} goal={concept ? "Індивідуальний проєкт будинку" : undefined} />
        </div>
      </section>

      {!concept && faq && <SiteRenderer blocks={[{ ...faq, id: "model-faq", anchor: "faq" }]} ctx={ctx} />}

      {!!others.length && (
        <section className="s-sec s-sec--cloud">
          <div className="s-wrap">
            <div className="s-head"><h2 className="s-title">{concept ? "Інші розробки" : "Інші моделі"}</h2></div>
            <div className="s-grid s-grid--models">{others.map((x) => <ModelCard key={x.id} m={x} base={base} />)}</div>
          </div>
        </section>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
    </>
  );
}

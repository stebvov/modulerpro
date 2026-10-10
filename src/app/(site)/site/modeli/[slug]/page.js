// Сторінка моделі — окремий лендинг: перший екран з ціною, переваги, візуалізації, планування, ціни за рівнями,
// реалізовані будинки цього формату, етапи й питання (з головної), заявка з уже обраною моделлю.
// Для розробок (kind=concept) — сторінка індивідуального проєкту: основа, яку адаптуємо під клієнта.
import { notFound } from "next/navigation";
import { getAlternates, getBase, getCases, getDict, getModels, getOgBase, getPage, getSettings, getT } from "@/lib/site/data";
import { LEVELS, SIZE_GROUPS } from "@/lib/site/blocks";
import { imgProps, money, modelPriceFrom, num, paragraphs, rich, siteHref, youtubeId } from "@/lib/site/format";
import { translateDeep } from "@/lib/site/i18n";
import { siteRobots } from "@/components/site/CmsPage";
import { CaseCard, ModelCard } from "@/components/site/Cards";
import { moduleDims, moduleDimsText } from "@/lib/site/modules";
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
  const [m, { t, tf, lang }] = await Promise.all([find(slug), getT()]);
  if (!m) return {};
  const from = modelPriceFrom(m);
  const concept = m.kind === "concept";
  return {
    title: concept ? tf("{name} — індивідуальний проєкт модульного будинку", { name: m.name })
      : m.area_m2 ? tf("{name} — модульний будинок {area} м²", { name: m.name, area: num(Number(m.area_m2), lang) }) : m.name,
    description: [m.tagline, from ? tf("Ціна від {price}.", { price: money(from, m.currency, lang) }) : null, concept ? t("Адаптуємо під вашу ділянку й бюджет.") : t("Виробництво, доставка й монтаж під ключ.")].filter(Boolean).join(" "),
    alternates: await getAlternates(`/modeli/${m.slug}`),
    openGraph: { ...(await getOgBase()), images: m.photos?.[0] ? [m.photos[0]] : undefined },
    robots: await siteRobots(),
  };
}

export default async function ModelPage({ params }) {
  const { slug } = await params;
  const [all, settings, base, cases, home, { t, tf, lang }] = await Promise.all([getModels(), getSettings(), getBase(), getCases(), getPage("home"), getT()]);
  const m = all.find((x) => x.slug === slug);
  if (!m) notFound();
  const concept = m.kind === "concept";
  const ctx = { base, settings, models: all, cases, t, tf, lang };
  const dict = await getDict(lang);
  const choice = dict ? translateDeep(CHOICE, dict) : CHOICE;
  const m2 = t("м²");
  const from = modelPriceFrom(m);
  const photos = m.photos || [];
  const plans = (m.plans?.length ? m.plans : m.plan_image ? [m.plan_image] : []);
  const prices = LEVELS.map(([k, name]) => [k, name, m[`price_${k}`]]).filter(([, , v]) => Number(v) > 0);
  const area = m.area_m2 ? Math.round(Number(m.area_m2)) : null;
  const sameFormat = area ? cases.filter((c) => new RegExp(`(^|\\D)${area}\\s?м`).test(c.format_src || c.format || "")).slice(0, 3) : [];
  const others = all.filter((x) => x.id !== m.id && (x.kind || "ready") === (m.kind || "ready"))
    .sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0) || Math.abs(a.size_group - m.size_group) - Math.abs(b.size_group - m.size_group)).slice(0, 3);
  const homeBlocks = home?.blocks || [];
  const steps = homeBlocks.find((b) => b.type === "steps" && !b.hidden);
  const faq = homeBlocks.find((b) => b.type === "faq" && !b.hidden);
  const vid = youtubeId(m.video);
  // дім із одного модуля: розмір модуля збігається з габаритами — двічі не показуємо
  const dimNums = (String(m.dimensions || "").match(/\d+(?:[.,]\d+)?/g) || []).map((x) => Number(x.replace(",", "."))).sort((a, b) => a - b);
  const mods = moduleDims(m);
  const oneModuleHouse = mods.length === 1 && dimNums.length === 2 && dimNums[0] === Math.min(mods[0].w, mods[0].l || 0) && dimNums[1] === Math.max(mods[0].w, mods[0].l || 0);
  const facts = [
    m.area_m2 && [t("Площа"), `${num(Number(m.area_m2), lang)} ${m2}`],
    m.modules && [t("Модулів"), num(m.modules, lang)],
    moduleDimsText(m) && !oneModuleHouse && [t("Розмір модуля"), moduleDimsText(m, (v) => num(v, lang), t("м"))],
    m.bedrooms != null && [t("Спальні"), m.bedrooms ? String(m.bedrooms) : t("студія")],
    m.bathrooms != null && m.bathrooms > 0 && [t("Санвузли"), String(m.bathrooms)],
    m.dimensions && [t("Габарити"), m.dimensions],
    m.height_m && [t("Висота"), `${num(Number(m.height_m), lang)} ${t("м")}`],
    ...(Array.isArray(m.terraces) ? m.terraces : []).filter((x) => Number(x.area) > 0).map((x) => [
      x.name || t("Тераса"),
      `${x.w && x.l ? `${num(x.w, lang)} × ${num(x.l, lang)} ${t("м")} · ` : ""}${num(Number(x.area), lang)} ${m2}${x.included === false ? ` · ${t("опція")}` : ""}`,
    ]),
    m.object_type && [t("Тип"), m.object_type],
    m.build_time && [t("Виготовлення"), m.build_time],
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
          <nav className="s-crumbs"><a href={siteHref(base, "/")}>{t("Головна")}</a> / <a href={siteHref(base, concept ? "/proekty" : "/modeli")}>{concept ? t("Індивідуальні проєкти") : t("Моделі")}</a></nav>
          <div className="s-eyebrow">
            {concept ? t("Індивідуальний проєкт · розробка Moduler") : `${m.popular ? `${t("★ Популярна модель")} · ` : ""}${t(SIZE_GROUPS[m.size_group] || "")}`}
          </div>
          <h1 className="s-hero__title">{m.name}</h1>
          {m.tagline && <p className="s-hero__sub">{m.tagline}</p>}
          {!!facts.length && (
            <div className="s-facts">{facts.map(([k, v], i) => <div key={`${k}-${i}`}><span>{k}</span><b>{v}</b></div>)}</div>
          )}
          {from ? <div className="s-price-chip">{t("від")} {money(from, m.currency, lang)}</div> : !concept && <div className="s-price-chip">{t("Ціну порахуємо під вашу ділянку")}</div>}
          <div className="s-actions">
            <a className="s-btn s-btn--primary" href="#contact">{concept ? t("Хочу подібний будинок") : t("Отримати кошторис")}</a>
            <a className="s-btn s-btn--ghost" href="#gallery">{concept ? t("Дивитися візуалізації") : t("Дивитися фото")}</a>
          </div>
        </div>
      </section>

      {concept && (
        <section className="s-sec s-sec--cloud s-sec--tight">
          <div className="s-wrap">
            <div className="s-callout">
              {t("💡 Це розробка нашої команди, а не готова модель з каталогу. Беремо її за основу й адаптуємо під вашу ділянку, родину чи бізнес: площу, планування, фасад, терасу. Строк і ціну рахуємо індивідуально. Якщо важливі швидкість і ціна —")}{" "}
              <a href={siteHref(base, "/modeli")}>{t("оберіть готову модель")}</a>.
            </div>
          </div>
        </section>
      )}

      {(!!m.highlights?.length || m.description || m.features?.length) && (
        <section className="s-sec s-sec--light">
          <div className="s-wrap">
            <div className="s-head">
              <div className="s-eyebrow">{t("Про модель")}</div>
              <h2 className="s-title">{rich(tf("Чому обирають *{name}*", { name: m.name }))}</h2>
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
            <div className="s-head"><div className="s-eyebrow">{concept ? t("Візуалізації") : t("Фото й візуалізації")}</div><h2 className="s-title">{rich(t("Роздивіться *ближче*"))}</h2></div>
            <Gallery images={photos} title={m.name} captions={m.photo_captions} />
          </div>
        </section>
      )}

      {!!plans.length && (
        <section className="s-sec s-sec--light">
          <div className="s-wrap">
            <div className="s-head">
              <div className="s-eyebrow">{t("Планування")}</div>
              <h2 className="s-title">{rich(plans.length > 1 ? t("Варіанти *планування*") : t("Як усе *влаштовано*"))}</h2>
              <p className="s-lead">{t("Планування адаптуємо під вашу родину: кількість спалень, кухня, гардеробна, тераса.")}</p>
            </div>
            <Gallery images={plans} title={tf("Планування {name}", { name: m.name })} layout="plans" captions={m.photo_captions} />
          </div>
        </section>
      )}

      {!concept && (
        <section className="s-sec s-sec--cloud">
          <div className="s-wrap">
            <div className="s-head"><div className="s-eyebrow">{t("Ціна")}</div><h2 className="s-title">{rich(tf("Скільки коштує *{name}*", { name: m.name }))}</h2>
              <p className="s-lead">{t("Ціна залежить від рівня готовності. Фундамент, доставку й монтаж рахуємо окремо під вашу ділянку.")}</p></div>
            <div className="s-tiers">
              {LEVELS.map(([k, name], i) => {
                const v = m[`price_${k}`];
                return (
                  <div key={k} className={`s-tier${k === "ready" ? " s-tier--hl" : ""}`}>
                    <div className="s-tier__n">{String(i + 1).padStart(2, "0")}</div>
                    <h3>{t(name)}</h3>
                    <p>{t(LEVEL_TEXT[k])}</p>
                    <div className="s-tier__price">{Number(v) > 0 ? `${t("від")} ${money(v, m.currency, lang)}` : t("за запитом")}</div>
                  </div>
                );
              })}
            </div>
            {!prices.length && <p className="s-note">{tf("Точну вартість на {name} надішлемо в месенджер після короткої розмови — залиште контакт нижче.", { name: m.name })}</p>}
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
            <div className="s-head"><div className="s-eyebrow">{t("Реалізовані об'єкти")}</div><h2 className="s-title">{rich(t("Такі будинки *вже стоять*"))}</h2></div>
            <div className="s-grid s-grid--cases">{sameFormat.map((c) => <CaseCard key={c.id} c={c} base={base} />)}</div>
          </div>
        </section>
      )}

      {!concept && steps && <SiteRenderer blocks={[{ ...steps, id: "model-steps", theme: "cloud" }]} ctx={ctx} />}

      <Choice b={choice} ctx={ctx} />

      <section id="contact" className="s-sec s-sec--dark s-formsec">
        <div className="s-wrap">
          <div className="s-head s-head--center">
            <div className="s-eyebrow">{concept ? t("Індивідуальний проєкт") : t("Кошторис за одну розмову")}</div>
            <h2 className="s-title">{rich(concept ? tf("Обговоримо ваш будинок на основі *{name}*", { name: m.name }) : tf("Порахуємо *{name}* під вашу ділянку", { name: m.name }))}</h2>
            <p className="s-lead">{concept ? t("Розкажіть про задачу — запропонуємо планування, строк і вартість.") : t("Рівень готовності, фундамент, доставка й монтаж — усе в одному кошторисі.")}</p>
          </div>
          <LeadForm settings={settings} model={m.name_src || m.name} goal={concept ? "Індивідуальний проєкт будинку" : undefined} />
        </div>
      </section>

      {!concept && faq && <SiteRenderer blocks={[{ ...faq, id: "model-faq", anchor: "faq" }]} ctx={ctx} />}

      {!!others.length && (
        <section className="s-sec s-sec--cloud">
          <div className="s-wrap">
            <div className="s-head"><h2 className="s-title">{concept ? t("Інші розробки") : t("Інші моделі")}</h2></div>
            <div className="s-grid s-grid--models">{others.map((x) => <ModelCard key={x.id} m={x} base={base} />)}</div>
          </div>
        </section>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
    </>
  );
}

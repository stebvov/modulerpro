// Сторінка кейсу: галерея, задача → рішення, слова власника, заявка «хочу так само».
import { notFound } from "next/navigation";
import { getAlternates, getBase, getCases, getOgBase, getSettings, getT } from "@/lib/site/data";
import { CASE_KINDS } from "@/lib/site/blocks";
import { quotes } from "@/lib/site/i18n";
import { caseKinds, imgProps, paragraphs, richLinks, siteHref } from "@/lib/site/format";
import { siteRobots } from "@/components/site/CmsPage";
import { CaseCard } from "@/components/site/Cards";
import Gallery from "@/components/site/Gallery";
import LeadForm from "@/components/site/LeadForm";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [cases, { tf }] = await Promise.all([getCases(), getT()]);
  const c = cases.find((x) => x.slug === slug);
  if (!c) return {};
  return {
    title: tf("{name} — реалізований проєкт", { name: c.title }),
    description: [c.format, c.location, c.task].filter(Boolean).join(". ").slice(0, 200),
    alternates: await getAlternates(`/kejsy/${c.slug}`),
    openGraph: { ...(await getOgBase()), images: c.photos?.[0] ? [c.photos[0]] : undefined },
    robots: await siteRobots(),
  };
}

export default async function CasePage({ params }) {
  const { slug } = await params;
  const [all, settings, base, { t, lang }] = await Promise.all([getCases(), getSettings(), getBase(), getT()]);
  const [q1, q2] = quotes(lang);
  const c = all.find((x) => x.slug === slug);
  if (!c) notFound();
  const photos = c.photos || [];
  const more = all.filter((x) => x.id !== c.id).sort((a, b) => (a.kind === c.kind ? -1 : 0) - (b.kind === c.kind ? -1 : 0)).slice(0, 3);

  return (
    <>
      <section className="s-hero s-hero--compact s-hero--case s-sec--dark">
        {photos[0] && <img className="s-hero__bg" alt="" {...imgProps(photos[0])} fetchPriority="high" />}
        <div className="s-hero__veil" />
        <div className="s-wrap">
          <nav className="s-crumbs"><a href={siteHref(base, "/")}>{t("Головна")}</a> / <a href={siteHref(base, "/kejsy")}>{t("Кейси")}</a></nav>
          <div className="s-eyebrow">{[...caseKinds(c).map((k) => t(CASE_KINDS[k])), c.year].filter(Boolean).join(" · ")}</div>
          <h1 className="s-hero__title">{c.title}</h1>
          <div className="s-hero__facts">
            {c.location && <span>📍 {c.location}</span>}
            {c.format && <span>🏠 {c.format}</span>}
          </div>
        </div>
      </section>

      <section className="s-sec s-sec--light">
        <div className="s-wrap">
          {(c.task || c.solution || c.quote) && (
            <div className="s-story">
              {c.task && <div><h3>{t("Задача")}</h3>{paragraphs(c.task).map((p, i) => <p key={i}>{richLinks(p)}</p>)}</div>}
              {c.solution && <div><h3>{t("Що зробили")}</h3>{paragraphs(c.solution).map((p, i) => <p key={i}>{richLinks(p)}</p>)}</div>}
              {c.quote && <blockquote className="s-quote">{q1}{richLinks(c.quote)}{q2}{c.quote_author && <cite>— {c.quote_author}</cite>}</blockquote>}
            </div>
          )}
          <Gallery images={photos} title={c.title} captions={c.photo_captions} />
        </div>
      </section>

      <section id="contact" className="s-sec s-sec--dark s-formsec">
        <div className="s-wrap">
          <div className="s-head s-head--center">
            <div className="s-eyebrow">{t("Хочете так само?")}</div>
            <h2 className="s-title">{t("Розкажіть про свою задачу")}</h2>
            <p className="s-lead">{t("Підберемо формат, порахуємо вартість і строки.")}</p>
          </div>
          <LeadForm settings={settings} model={`Як кейс: ${c.title_src || c.title}`} />
        </div>
      </section>

      {!!more.length && (
        <section className="s-sec s-sec--cloud">
          <div className="s-wrap">
            <div className="s-head"><h2 className="s-title">{t("Інші об'єкти")}</h2></div>
            <div className="s-grid s-grid--cases">{more.map((x) => <CaseCard key={x.id} c={x} base={base} />)}</div>
          </div>
        </section>
      )}
    </>
  );
}

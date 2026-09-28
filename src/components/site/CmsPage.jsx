// Сторінка сайту з конструктора: дані + метадані. Використовують /site, /site/[slug], /site/modeli, /site/kejsy.
import { notFound } from "next/navigation";
import { getBase, getPage, getSettings, getSiteContext } from "@/lib/site/data";
import SiteRenderer from "./SiteRenderer";

// поки сайт живе на app.moduler.pro/site — це робоча копія, пошуковикам її не показуємо
export async function siteRobots() {
  return (await getBase()) === "/site" ? { index: false, follow: false } : undefined;
}

export async function cmsMetadata(slug) {
  const [page, s, base] = await Promise.all([getPage(slug), getSettings(), getBase()]);
  if (!page) return {};
  const title = page.seo_title || (slug === "home" ? s.seo?.title : page.title);
  const description = page.seo_description || s.seo?.description;
  const img = page.og_image || s.seo?.og_image;
  return {
    title: slug === "home" ? { absolute: title || "Moduler" } : title,
    description,
    alternates: { canonical: (base || "") + (slug === "home" ? "/" : `/${slug}`) },
    openGraph: { title, description, images: img ? [img] : undefined },
    robots: await siteRobots(),
  };
}

export default async function CmsPage({ slug }) {
  const [page, ctx] = await Promise.all([getPage(slug), getSiteContext()]);
  if (!page) notFound();
  const faq = (page.blocks || []).filter((b) => b.type === "faq" && !b.hidden).flatMap((b) => b.items || []);
  return (
    <>
      <SiteRenderer blocks={page.blocks} ctx={ctx} />
      {!!faq.length && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org", "@type": "FAQPage",
          mainEntity: faq.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })),
        }).replace(/</g, "\\u003c") }} />
      )}
    </>
  );
}

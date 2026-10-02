// Публічний сайт moduler.pro — окремий кореневий макет: свої шрифти й стилі, без входу в систему.
import "./site.css";
import Script from "next/script";
import { Manrope, Unbounded } from "next/font/google";
import { getBase, getModels, getOrigin, getPagesList, getSettings } from "@/lib/site/data";
import { SiteHeader, SiteScripts } from "@/components/site/SiteChrome";
import { SiteFooter, StickyBar } from "@/components/site/SiteFooter";

const display = Unbounded({ subsets: ["latin", "cyrillic"], weight: ["600", "700", "800"], variable: "--f-display", display: "swap" });
const body = Manrope({ subsets: ["latin", "cyrillic"], variable: "--f-body", display: "swap" });

export async function generateMetadata() {
  const s = await getSettings();
  const seo = s.seo || {};
  const origin = await getOrigin();
  return {
    metadataBase: new URL(origin),
    title: { default: seo.title || "Moduler — модульні будинки", template: `%s · ${s.brand?.name || "Moduler"}` },
    description: seo.description,
    openGraph: { siteName: s.brand?.name || "Moduler", locale: "uk_UA", type: "website", images: seo.og_image ? [seo.og_image] : undefined },
    other: { "theme-color": "#1E3D2F" },
  };
}

export const viewport = { themeColor: "#1E3D2F", width: "device-width", initialScale: 1 };

export default async function SiteLayout({ children }) {
  const [settings, base, origin, models, pages] = await Promise.all([getSettings(), getBase(), getOrigin(), getModels(), getPagesList()]);
  // сторінка розробки живе за адресою /modeli/…, але в меню належить до «Індивідуальних проєктів»
  const navAs = Object.fromEntries(models.filter((m) => m.kind === "concept").map((m) => [`/modeli/${m.slug}`, `/proekty/${m.slug}`]));
  const a = settings.analytics || {};
  const c = settings.contacts || {};
  const org = {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    name: settings.brand?.name || "Moduler",
    url: origin + (base || "/"),
    logo: settings.brand?.logo ? new URL(settings.brand.logo, origin).href : undefined,
    telephone: c.phone,
    address: c.office_street
      ? { "@type": "PostalAddress", streetAddress: c.office_street, addressLocality: c.office_city || "Київ", addressCountry: "UA" }
      : undefined,
    sameAs: [c.instagram && `https://instagram.com/${c.instagram.replace(/^@/, "")}`, c.facebook, c.youtube].filter(Boolean),
    areaServed: ["UA", "EU"],
  };
  return (
    <html lang="uk" className={`${display.variable} ${body.variable}`}>
      <body className="s-body">
        <a className="s-skip" href="#main">До змісту</a>
        <SiteHeader settings={settings} base={base} navAs={navAs} />
        <main id="main">{children}</main>
        <SiteFooter settings={settings} base={base} pages={pages} />
        <StickyBar settings={settings} base={base} />
        <SiteScripts />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org).replace(/</g, "\\u003c") }} />
        {a.ga4 && /^G-[A-Z0-9]+$/.test(a.ga4) && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${a.ga4}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${a.ga4}');`}</Script>
          </>
        )}
        {a.meta_pixel && /^\d{8,20}$/.test(a.meta_pixel) && (
          <Script id="fbq" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${a.meta_pixel}');fbq('track','PageView');`}</Script>
        )}
      </body>
    </html>
  );
}

// Підвал сайту + нижня панель швидкого зв'язку на телефоні.
import { phoneHref, siteHref, telegramHref, viberHref } from "@/lib/site/format";
import { LANGS, isLang } from "@/lib/site/i18n";

const same = (s) => s;

// Жодна опублікована сторінка не має загубитись: до посилань підвалу дописуємо підпункти меню
// і сторінки, на які немає входу ні в меню, ні в підвалі (нова сторінка з конструктора зʼявиться тут сама).
const pathOf = (h) => String(h || "").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
function footerLinks(settings, pages) {
  const base = settings.footer_links?.length ? settings.footer_links : settings.nav || [];
  const out = [];
  const have = new Set(["/"]);
  const add = (label, href) => {
    if (!label || !href || /^(https?:|tel:|mailto:|#)/.test(href) || have.has(pathOf(href))) return;
    have.add(pathOf(href));
    out.push({ label, href });
  };
  base.forEach((l) => add(l?.label, l?.href));
  (settings.nav || []).forEach((l) => { add(l?.label, l?.href); (Array.isArray(l?.items) ? l.items : []).forEach((k) => add(k?.label, k?.href)); });
  (pages || []).forEach((p) => { if (p.slug !== "home") add(p.nav_label || p.title, `/${p.slug}`); });
  return out;
}

// t — переклад написів (макет передає його для мовних версій); lang — поточна мова
export function SiteFooter({ settings, base, pages, t = same, lang = "uk" }) {
  // корінь сайту без мови: посилання на інші мовні версії
  const root = isLang(lang) ? base.slice(0, -(lang.length + 1)) : base;
  const c = settings.contacts || {};
  const brand = settings.brand || {};
  const links = footerLinks(settings, pages);
  const wide = links.length > 8; // багато розділів — у дві колонки
  return (
    <footer className="s-foot">
      <div className={`s-wrap s-foot__grid${wide ? " s-foot__grid--map" : ""}`}>
        <div>
          {brand.logo_light ? <img className="s-foot__logo" src={brand.logo_light} alt={brand.name || "Moduler"} /> : <b>{brand.name || "Moduler"}</b>}
          {settings.footer_text && <p>{settings.footer_text}</p>}
        </div>
        <div>
          <h4>{t("Контакти")}</h4>
          {c.phone && <a href={phoneHref(c.phone)}>{c.phone_display || c.phone}</a>}
          {c.phone && <a href={viberHref(c.viber || c.phone)}>Viber</a>}
          {(c.telegram || c.phone) && <a href={telegramHref(c.telegram || c.phone)} target="_blank" rel="noopener">Telegram</a>}
          {c.instagram && <a href={`https://instagram.com/${c.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener">Instagram @{c.instagram.replace(/^@/, "")}</a>}
          {c.facebook && <a href={c.facebook} target="_blank" rel="noopener">Facebook</a>}
          {c.youtube && <a href={c.youtube} target="_blank" rel="noopener">YouTube</a>}
          {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
        </div>
        <div>
          <h4>{t("Розділи сайту")}</h4>
          <nav className={`s-foot__links${wide ? " s-foot__links--2" : ""}`} aria-label={t("Усі розділи сайту")}>
            {links.map((l, i) => <a key={i} href={siteHref(base, l.href)}>{l.label}</a>)}
          </nav>
        </div>
        <div>
          <h4>{t("Де ми")}</h4>
          {c.office && (c.office_url ? <a href={c.office_url} target="_blank" rel="noopener">{c.office}</a> : <span>{c.office}</span>)}
          {c.address && (c.address_url ? <a href={c.address_url} target="_blank" rel="noopener">{c.address}</a> : <span>{c.address}</span>)}
          {c.showroom && (c.showroom_url ? <a href={c.showroom_url} target="_blank" rel="noopener">{c.showroom}</a> : <span>{c.showroom}</span>)}
        </div>
      </div>
      <div className="s-wrap s-foot__bottom">
        <span>© {new Date().getFullYear()} {brand.name || "Moduler"}{brand.tagline ? ` · ${brand.tagline}` : ""}</span>
        <span className="s-foot__langs">
          {Object.entries(LANGS).map(([k, l]) => (k === lang
            ? <b key={k}>{l.name}</b>
            : <a key={k} href={(root + (isLang(k) ? `/${k}` : "")) || "/"} hrefLang={l.html} lang={l.html}>{l.name}</a>))}
        </span>
        <span>{t("возимо в Україні та ЄС")}</span>
      </div>
    </footer>
  );
}

export function StickyBar({ settings, base, t = same }) {
  if (settings.sticky_bar === false) return null;
  const c = settings.contacts || {};
  return (
    <div className="s-sticky" aria-label={t("Швидкий зв'язок")}>
      {c.phone && <a href={phoneHref(c.phone)}><span>📞</span>{t("Дзвінок")}</a>}
      {c.phone && <a href={viberHref(c.viber || c.phone)}><span>💬</span>Viber</a>}
      {(c.telegram || c.phone) && <a href={telegramHref(c.telegram || c.phone)} target="_blank" rel="noopener"><span>✈️</span>Telegram</a>}
      <a className="s-sticky__main" href={siteHref(base, "#contact")}>{t("Заявка")}</a>
    </div>
  );
}

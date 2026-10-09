"use client";
// Шапка сайту (меню-бургер на телефоні, тінь при прокрутці, випадні підпункти) + перемикач розділів під шапкою
// + запам'ятовування UTM для заявок + плавна поява секцій.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { phoneHref, siteHref } from "@/lib/site/format";
import { LANGS, isLang, langPath } from "@/lib/site/i18n";
import { trackVisit } from "@/lib/site/visitor";
import { useT } from "./I18n";

// який пункт меню підсвітити: сторінка пункту, вкладені (/modeli/…) або сторінки з поля «Підсвічувати також»
// (/site і мовний префікс /en не враховуємо: /site/en/modeli → /modeli)
const logical = (p) => (String(p || "/").split(/[?#]/)[0].replace(/^\/site(?=\/|$)/, "").replace(/^\/en(?=\/|$)/, "").replace(/\/+$/, "")) || "/";
// navAs — сторінки, що належать іншому розділу, ніж каже адреса (розробка /modeli/… — це «Індивідуальні проєкти»)
function hitter(pathname, navAs) {
  const path = logical(pathname);
  const here = navAs?.[path] || path;
  return (h) => {
    if (!h || /^(https?:|tel:|#)/.test(h)) return false;
    const t = logical(h);
    if (t === "/") return here === "/" && !String(h).includes("#");
    return here === t || here.startsWith(t + "/");
  };
}
// підпункти пункту меню: є вони — пункт відкриває список, а на сторінках цих підпунктів під шапкою стоїть перемикач
const kids = (l) => (Array.isArray(l?.items) ? l.items.filter((x) => x?.label && x?.href) : []);
// серед підпунктів підсвічуємо найточніший: /modeli/terasa → «Проєкти», а не «Моделі»
function activeKid(list, hit) {
  let best = -1;
  list.forEach((k, j) => { if (hit(k.href) && (best < 0 || logical(k.href).length > logical(list[best].href).length)) best = j; });
  return best;
}

export function SiteHeader({ settings, base, navAs }) {
  const [open, setOpen] = useState(false);
  const [drop, setDrop] = useState(-1); // який випадний список відкрито натиском (на компʼютері він ще й відкривається наведенням)
  const [scrolled, setScrolled] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const c = settings.contacts || {};
  const brand = settings.brand || {};
  const nav = settings.nav || [];
  const { t, tf, lang } = useT();
  const pathname = usePathname();
  const cta = settings.header_cta || { label: t("Обговорити проєкт"), href: "#contact" };
  const hit = hitter(pathname, navAs);
  // інші мови: та сама сторінка за адресою іншої мовної версії
  const root = isLang(lang) ? base.slice(0, -(lang.length + 1)) : base;
  const langs = (
    <div className={`s-langs${langOpen ? " open" : ""}`}>
      <button type="button" className="s-lang" aria-haspopup="true" aria-expanded={langOpen} aria-label={t("Мова сайту")} title={t("Мова сайту")} onClick={() => setLangOpen(!langOpen)}>
        {LANGS[lang].label}<span className="s-lang__caret" aria-hidden>▾</span>
      </button>
      <div className="s-langs__panel">
        {Object.entries(LANGS).filter(([k]) => k !== lang).map(([k, l]) => (
          <a key={k} href={langPath(pathname, root, k)} hrefLang={l.html} lang={l.html}><b>{l.label}</b>{l.name}</a>
        ))}
      </div>
    </div>
  );
  const active = nav.findIndex((l) => hit(l.href) || String(l.also || "").split(",").map((x) => x.trim()).some(hit) || kids(l).some((k) => hit(k.href)));
  const group = active >= 0 ? kids(nav[active]) : [];

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  // список мов закривається так само: натиском повз нього або клавішею Esc
  useEffect(() => {
    if (!langOpen) return;
    const off = (e) => { if (e.type === "keydown" ? e.key === "Escape" : !e.target.closest?.(".s-langs")) setLangOpen(false); };
    document.addEventListener("click", off);
    document.addEventListener("keydown", off);
    return () => { document.removeEventListener("click", off); document.removeEventListener("keydown", off); };
  }, [langOpen]);
  // відкритий список закривається натиском повз нього або клавішею Esc
  useEffect(() => {
    if (drop < 0) return;
    const off = (e) => { if (e.type === "keydown" ? e.key === "Escape" : !e.target.closest?.(".s-nav__group")) setDrop(-1); };
    document.addEventListener("click", off);
    document.addEventListener("keydown", off);
    return () => { document.removeEventListener("click", off); document.removeEventListener("keydown", off); };
  }, [drop]);

  return (
    <>
    <header className={`s-nav${scrolled ? " s-nav--scrolled" : ""}${open ? " s-nav--open" : ""}`}>
      <div className="s-wrap s-nav__in">
        <a className="s-nav__logo" href={siteHref(base, "/")} aria-label={brand.name || "Moduler"}>
          {brand.logo ? <img src={brand.logo} alt={brand.name || "Moduler"} /> : <b>{brand.name || "Moduler"}</b>}
        </a>
        <nav className="s-nav__links" aria-label={t("Меню сайту")}>
          {nav.map((l, i) => {
            const sub = kids(l);
            if (!sub.length) return <a key={i} href={siteHref(base, l.href)} className={i === active ? "on" : undefined} aria-current={i === active ? "page" : undefined} onClick={() => setOpen(false)}>{l.label}</a>;
            const cur = i === active ? activeKid(sub, hit) : -1;
            return (
              <div key={i} className={`s-nav__group${drop === i ? " open" : ""}`}>
                {/* назва розділу — посилання на його головну сторінку; стрілка поруч розкриває підпункти (на компʼютері — ще й наведення) */}
                <span className="s-nav__head">
                  <a href={siteHref(base, l.href || sub[0].href)} className={`s-nav__top${i === active ? " on" : ""}`} aria-current={i === active && cur < 0 ? "page" : undefined} onClick={() => { setOpen(false); setDrop(-1); }}>{l.label}</a>
                  <button type="button" className="s-nav__more" aria-haspopup="true" aria-expanded={drop === i} aria-label={tf("Підрозділи: {name}", { name: l.label })} onClick={() => setDrop(drop === i ? -1 : i)}>
                    <span className="s-nav__caret" aria-hidden>▾</span>
                  </button>
                </span>
                <div className="s-nav__drop">
                  <div className="s-nav__panel">
                    {sub.map((k, j) => (
                      <a key={j} href={siteHref(base, k.href)} className={j === cur ? "on" : undefined} aria-current={j === cur ? "page" : undefined} onClick={() => { setOpen(false); setDrop(-1); }}>
                        <b>{k.label}</b>
                        {k.text && <small>{k.text}</small>}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          {c.phone && <a className="s-nav__phone s-only-m" href={phoneHref(c.phone)}>📞 {c.phone_display || c.phone}</a>}
          <a className="s-btn s-btn--primary s-only-m" href={siteHref(base, cta.href)} onClick={() => setOpen(false)}>{cta.label}</a>
        </nav>
        <div className="s-nav__right">
          {langs}
          {c.phone && <a className="s-nav__phone s-only-d" href={phoneHref(c.phone)}>{c.phone_display || c.phone}</a>}
          <a className="s-btn s-btn--primary s-btn--sm s-only-d" href={siteHref(base, cta.href)}>{cta.label}</a>
          {/* на телефоні меню відкривається з розгорнутим поточним розділом, решта — згорнуті */}
          <button type="button" className="s-burger" aria-label={t("Меню")} aria-expanded={open} onClick={() => { setOpen(!open); setDrop(!open && group.length ? active : -1); }}><span /><span /><span /></button>
        </div>
      </div>
    </header>
    {group.length > 1 && (
      <nav className="s-subnav" aria-label={nav[active].label}>
        <div className="s-wrap s-subnav__in">
          {group.map((k, j) => {
            const on = j === activeKid(group, hit);
            return <a key={j} href={siteHref(base, k.href)} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>{k.label}</a>;
          })}
        </div>
      </nav>
    )}
    </>
  );
}

export function SiteScripts() {
  const pathname = usePathname();
  // перегляди сторінок і джерело візиту — лише в браузері відвідувача, ідуть разом із заявкою (lib/site/visitor.js)
  useEffect(() => { trackVisit(location.pathname); }, [pathname]);

  useEffect(() => {
    // UTM з реклами — зберігаємо на сесію, щоб заявка знала джерело
    try {
      const q = new URLSearchParams(location.search);
      const u = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"].filter((k) => q.get(k)).map((k) => `${k}=${q.get(k)}`).join("&");
      if (u) sessionStorage.setItem("moduler_utm", u);
    } catch { /* приватний режим */ }
    // плавна поява секцій
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = document.querySelectorAll(".s-sec .s-head, .s-card, .s-case, .s-feat, .s-tier, .s-step, .s-aud__card, .s-review");
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("s-in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => { if (el.getBoundingClientRect().top > innerHeight) { el.classList.add("s-rv"); io.observe(el); } });
    return () => io.disconnect();
  }, []);
  return null;
}

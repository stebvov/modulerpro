"use client";
// Шапка сайту (меню-бургер на телефоні, тінь при прокрутці) + запам'ятовування UTM для заявок + плавна поява секцій.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { phoneHref, siteHref } from "@/lib/site/format";
import { trackVisit } from "@/lib/site/visitor";

export function SiteHeader({ settings, base }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const c = settings.contacts || {};
  const brand = settings.brand || {};
  const nav = settings.nav || [];
  const cta = settings.header_cta || { label: "Обговорити проєкт", href: "#contact" };

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

  return (
    <header className={`s-nav${scrolled ? " s-nav--scrolled" : ""}${open ? " s-nav--open" : ""}`}>
      <div className="s-wrap s-nav__in">
        <a className="s-nav__logo" href={siteHref(base, "/")} aria-label={brand.name || "Moduler"}>
          {brand.logo ? <img src={brand.logo} alt={brand.name || "Moduler"} /> : <b>{brand.name || "Moduler"}</b>}
        </a>
        <nav className="s-nav__links" aria-label="Меню сайту">
          {nav.map((l, i) => <a key={i} href={siteHref(base, l.href)} onClick={() => setOpen(false)}>{l.label}</a>)}
          {c.phone && <a className="s-nav__phone s-only-m" href={phoneHref(c.phone)}>📞 {c.phone_display || c.phone}</a>}
          <a className="s-btn s-btn--primary s-only-m" href={siteHref(base, cta.href)} onClick={() => setOpen(false)}>{cta.label}</a>
        </nav>
        <div className="s-nav__right">
          {c.phone && <a className="s-nav__phone s-only-d" href={phoneHref(c.phone)}>{c.phone_display || c.phone}</a>}
          <a className="s-btn s-btn--primary s-btn--sm s-only-d" href={siteHref(base, cta.href)}>{cta.label}</a>
          <button type="button" className="s-burger" aria-label="Меню" aria-expanded={open} onClick={() => setOpen(!open)}><span /><span /><span /></button>
        </div>
      </div>
    </header>
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

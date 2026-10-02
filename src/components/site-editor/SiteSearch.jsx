"use client";
// Пошук по вмісту сайту в конструкторі: сторінки (кожен блок), моделі, кейси, меню й налаштування.
// Натиск на знахідку відкриває це місце для редагування.
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BLOCKS } from "@/lib/site/blocks";
import { findIn, queryStems, textsOf } from "@/lib/site/search";
import { SearchIcon } from "@/components/Icon";
import "./editor.css";

const LIMIT = 40;

// pages — сторінки з поточного екрана (з незбереженими правками), якщо пошук стоїть у конструкторі сторінок;
// onOpenBlock(pageId, blockId) — відкрити блок без перезавантаження; без нього переходимо за адресою
export default function SiteSearch({ pages: ownPages, onOpenBlock }) {
  const supabase = useMemo(() => createClient(), []);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const box = useRef(null);
  const asked = useRef(false);

  async function ensure() {
    if (asked.current) return;
    asked.current = true;
    const [pg, md, cs, st] = await Promise.all([
      supabase.from("site_pages").select("id,slug,title,seo_title,seo_description,blocks,draft,published").order("sort"),
      supabase.from("site_models").select("*").order("sort"),
      supabase.from("site_cases").select("*").order("sort"),
      supabase.from("site_settings").select("value").eq("key", "main").maybeSingle(),
    ]);
    setData({ pages: pg.data || [], models: md.data || [], cases: cs.data || [], settings: st.data?.value || {} });
  }

  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (e.type === "keydown" ? e.key === "Escape" : !box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", off);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", off); };
  }, [open]);

  const results = useMemo(() => {
    const stems = queryStems(q);
    if (!stems.length) return [];
    const out = [];
    const pages = ownPages || data?.pages || [];
    for (const p of pages) {
      const off = p.published ? "" : " · сторінка прихована";
      const meta = findIn([p.title, p.slug === "home" ? "" : `/${p.slug}`, p.seo_title, p.seo_description].filter(Boolean), stems);
      if (meta) out.push({ group: "Сторінки", title: p.title, where: "Назва, адреса й опис для Google" + off, snip: meta, pageId: p.id, slug: p.slug, meta: true });
      for (const b of p.draft ?? p.blocks ?? []) {
        const hit = findIn(textsOf(b), stems);
        if (hit) out.push({ group: "Сторінки", title: p.title, where: `${BLOCKS[b.type]?.label || b.type}${b.hidden ? " · прихований блок" : ""}${off}`, snip: hit, pageId: p.id, slug: p.slug, block: b.id });
      }
    }
    for (const m of data?.models || []) {
      const hit = findIn(textsOf(m), stems);
      if (hit) out.push({ group: m.kind === "concept" ? "Індивідуальні проєкти" : "Моделі", title: m.name, where: m.published ? "" : "приховано з сайту", snip: hit, tab: "site-models", open: m.slug });
    }
    for (const c of data?.cases || []) {
      const hit = findIn(textsOf(c), stems);
      if (hit) out.push({ group: "Кейси", title: c.title, where: c.published ? "" : "приховано з сайту", snip: hit, tab: "site-cases", open: c.slug });
    }
    // меню, підвал, контакти: кожен пункт меню чи посилання — окрема знахідка
    const s = data?.settings || {};
    for (const [key, label] of [["nav", "Меню"], ["footer_links", "Посилання в підвалі"]]) {
      for (const item of s[key] || []) {
        const hit = findIn(textsOf(item), stems);
        if (hit) out.push({ group: "Меню й налаштування", title: item.label || label, where: label, snip: hit, tab: "site-settings" });
      }
    }
    const rest = Object.fromEntries(Object.entries(s).filter(([k]) => k !== "nav" && k !== "footer_links"));
    const hit = findIn(textsOf(rest), stems);
    if (hit) out.push({ group: "Меню й налаштування", title: "Налаштування сайту", where: "Контакти, тексти, калькулятор", snip: hit, tab: "site-settings" });
    return out;
  }, [q, data, ownPages]);

  function go(r) {
    setOpen(false);
    if (r.pageId && onOpenBlock) { onOpenBlock(r.pageId, r.block || null, !!r.meta); return; }
    const u = new URL(window.location.href);
    u.searchParams.set("s", r.pageId ? "site-pages" : r.tab);
    for (const k of ["open", "block", "meta"]) u.searchParams.delete(k);
    if (r.pageId) { u.searchParams.set("open", r.slug); if (r.block) u.searchParams.set("block", r.block); if (r.meta) u.searchParams.set("meta", "1"); }
    else if (r.open) u.searchParams.set("open", r.open);
    window.location.assign(u.pathname + u.search);
  }

  const shown = results.slice(0, LIMIT);
  const ready = !!data || !!ownPages;
  return (
    <div className="se-find" ref={box}>
      <SearchIcon className="se-find__ico" />
      <input type="search" value={q} placeholder="Пошук по сайту: слово чи фраза" aria-label="Пошук по вмісту сайту"
        onFocus={() => { ensure(); setOpen(true); }} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
      {open && q.trim().length > 1 && (
        <div className="se-find__panel" role="listbox">
          {!ready && <div className="se-find__empty">Завантажую вміст сайту…</div>}
          {ready && !shown.length && <div className="se-find__empty">Нічого не знайдено. Спробуйте одне слово або його частину.</div>}
          {shown.map((r, i) => (
            <div key={i}>
              {(i === 0 || shown[i - 1].group !== r.group) && <div className="se-find__group">{r.group}</div>}
              <button type="button" className="se-find__item" role="option" aria-selected="false" onClick={() => go(r)}>
                <span className="se-find__head"><b>{r.title}</b>{r.where && <span>{r.where}</span>}<em>Редагувати →</em></span>
                <small>{r.snip.before}<mark>{r.snip.hit}</mark>{r.snip.after}</small>
              </button>
            </div>
          ))}
          {results.length > LIMIT && <div className="se-find__empty">Показано перші {LIMIT} з {results.length} — уточніть запит.</div>}
        </div>
      )}
    </div>
  );
}

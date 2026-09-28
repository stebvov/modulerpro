"use client";
// Живий перегляд для конструктора: блоки приходять з оболонки через postMessage і малюються одразу, без збереження.
// Клік по секції — оболонка відкриває цей блок у формі. Посилання тут не ведуть геть.
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SiteRenderer from "@/components/site/SiteRenderer";

export default function Preview() {
  const supabase = useMemo(() => createClient(), []);
  const [blocks, setBlocks] = useState(null);
  const [ctx, setCtx] = useState({ base: "/site", settings: {}, models: [], cases: [] });
  const [sel, setSel] = useState(null);

  useEffect(() => {
    Promise.all([
      supabase.from("site_settings").select("value").eq("key", "main").maybeSingle(),
      supabase.from("site_models").select("*").order("sort").order("area_m2"),
      supabase.from("site_cases").select("*").order("sort"),
    ]).then(([s, m, c]) => setCtx((x) => ({ ...x, settings: s.data?.value || {}, models: m.data || [], cases: c.data || [] })));

    const onMsg = (e) => {
      if (e.origin !== location.origin) return;
      if (e.data?.type === "site-preview-ping") { window.parent?.postMessage({ type: "site-preview-ready" }, location.origin); return; }
      if (e.data?.type !== "site-preview") return;
      if (e.data.blocks) setBlocks(e.data.blocks);
      if (e.data.settings) setCtx((x) => ({ ...x, settings: e.data.settings }));
      if ("selected" in e.data) setSel(e.data.selected);
    };
    window.addEventListener("message", onMsg);
    window.parent?.postMessage({ type: "site-preview-ready" }, location.origin);

    const onClick = (e) => {
      const a = e.target.closest("a");
      if (a && !a.getAttribute("href")?.startsWith("#")) e.preventDefault();
      const sec = e.target.closest("[data-block]");
      if (sec) window.parent?.postMessage({ type: "site-preview-select", id: sec.dataset.block }, location.origin);
    };
    document.addEventListener("click", onClick, true);
    const onSubmit = (e) => { e.preventDefault(); e.stopPropagation(); alert("Це перегляд — заявка не надсилається."); };
    document.addEventListener("submit", onSubmit, true);
    return () => { window.removeEventListener("message", onMsg); document.removeEventListener("click", onClick, true); document.removeEventListener("submit", onSubmit, true); };
  }, [supabase]);

  // виділений блок — підсвітити; прокрутити лише коли вибір змінився (не на кожну літеру)
  const lastSel = useRef(null);
  useEffect(() => {
    document.querySelectorAll(".s-preview-sel").forEach((el) => el.classList.remove("s-preview-sel"));
    if (!sel) { lastSel.current = null; return; }
    const el = document.querySelector(`[data-block="${sel}"]`);
    if (!el) return;
    el.classList.add("s-preview-sel");
    if (lastSel.current !== sel) { el.scrollIntoView({ behavior: "smooth", block: "start" }); lastSel.current = sel; }
  }, [sel, blocks]);

  if (!blocks) return <div className="s-wrap s-sec"><p className="s-muted">Відкрийте сторінку в конструкторі…</p></div>;
  if (!blocks.filter((b) => !b.hidden).length) return <div className="s-wrap s-sec"><p className="s-muted">На сторінці ще немає блоків. Додайте перший у конструкторі.</p></div>;
  return <SiteRenderer blocks={blocks} ctx={ctx} />;
}

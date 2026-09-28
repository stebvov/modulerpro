"use client";
// 🌐 Сайт → Сторінки: конструктор сторінок moduler.pro з блоків.
// Зліва — блоки сторінки (перетягування, приховати, дублювати, видалити) і форма вибраного блоку,
// справа — живий перегляд (комп'ютер / телефон). Зміни одразу зберігаються в чернетку;
// на сайті їх видно після «Опублікувати».
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BLOCKS, BLOCK_ORDER, COMMON_FIELDS, newBlock } from "@/lib/site/blocks";
import { PAGE_FIELDS, slugify } from "@/lib/site/schemas";
import { Fields, LinkOptions } from "./Fields";
import DeleteButton from "@/components/DeleteButton";
import { CopyIcon, DragIcon, ExternalIcon, EyeIcon, EyeOffIcon, MonitorIcon, PhoneIcon, TrashIcon } from "@/components/Icon";
import "./editor.css";

const TEMPLATES = {
  empty: { label: "Порожня", blocks: () => [] },
  landing: {
    label: "Лендинг: перший екран + переваги + кейси + заявка",
    blocks: () => [
      { ...newBlock("hero"), variant: "compact", title: "Заголовок *сторінки*", subtitle: "Коротко: що пропонуємо і кому." },
      { ...newBlock("features"), title: "Чому це *вигідно*", items: [{ icon: "✅", title: "Перевага", text: "Опис" }] },
      newBlock("cases"),
      newBlock("faq"),
      newBlock("lead_form"),
    ],
  },
};

export async function revalidateSite() {
  try { await fetch("/api/site/revalidate", { method: "POST" }); } catch { /* сайт оновиться сам за 10 хв */ }
}

function blockTitle(b) {
  const t = b.title || b.eyebrow || b.items?.[0]?.title || b.items?.[0]?.q || "";
  return String(t).replace(/\*/g, "").slice(0, 60);
}

function Preview({ blocks, selected, onSelect, device }) {
  const frame = useRef(null);
  const box = useRef(null);
  const [ready, setReady] = useState(0);
  const [size, setSize] = useState({ w: 800, h: 700 });
  const deviceW = device === "mobile" ? 390 : 1280;

  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === "site-preview-ready") setReady((n) => n + 1);
      if (e.data?.type === "site-preview-select") onSelect(e.data.id);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onSelect]);

  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  // перегляд міг завантажитись раніше за нас — питаємо, доки не відповість «готовий»
  const alive = useRef(false);
  useEffect(() => {
    if (ready) alive.current = true;
    const t = setInterval(() => {
      if (!alive.current) frame.current?.contentWindow?.postMessage({ type: "site-preview-ping" }, location.origin);
    }, 300);
    return () => clearInterval(t);
  }, [ready]);

  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage({ type: "site-preview", blocks, selected }, location.origin);
  }, [ready, blocks, selected]);

  const scale = Math.min(1, size.w / deviceW);
  return (
    <div className={`se-preview se-preview--${device}`} ref={box}>
      <iframe
        ref={frame}
        src="/site/preview"
        title="Перегляд сторінки"
        onLoad={() => { alive.current = false; }}
        style={{ width: deviceW, height: size.h / scale, transform: `scale(${scale})` }}
      />
    </div>
  );
}

export default function SitePagesScreen() {
  const supabase = useMemo(() => createClient(), []);
  const [pages, setPages] = useState([]);
  const [pageId, setPageId] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [sel, setSel] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | dirty | saving | saved | error
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("blocks"); // blocks | page
  const [device, setDevice] = useState("desktop");
  const [library, setLibrary] = useState(false);
  const [creating, setCreating] = useState(null);
  const [mobileView, setMobileView] = useState("edit");
  const [publishing, setPublishing] = useState(false);
  const timer = useRef(null);
  const pending = useRef(null);
  const drag = useRef(null);
  const listRef = useRef(null);

  const page = pages.find((p) => p.id === pageId) || null;
  const hasDraft = !!page && page.draft != null;

  const load = useCallback(async (keepId) => {
    const { data, error } = await supabase.from("site_pages").select("*").order("sort").order("title");
    if (error) { setMsg("Не вдалося завантажити сторінки: " + error.message); return; }
    setPages(data || []);
    const id = keepId && data.some((p) => p.id === keepId) ? keepId : data?.[0]?.id;
    if (id) {
      const p = data.find((x) => x.id === id);
      setPageId(id);
      setBlocks(p.draft ?? p.blocks ?? []);
    }
  }, [supabase]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // автозбереження чернетки
  const saveDraft = useCallback(async (id, b) => {
    setStatus("saving");
    const { error } = await supabase.from("site_pages").update({ draft: b }).eq("id", id);
    if (error) { setStatus("error"); setMsg("Чернетку не збережено: " + error.message); return false; }
    pending.current = null;
    setPages((ps) => ps.map((p) => (p.id === id ? { ...p, draft: b } : p)));
    setStatus("saved");
    return true;
  }, [supabase]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (pending.current) return saveDraft(pending.current.id, pending.current.blocks);
    return true;
  }, [saveDraft]);

  function change(next) {
    setBlocks(next);
    setStatus("dirty");
    pending.current = { id: pageId, blocks: next };
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveDraft(pageId, next), 700);
  }

  useEffect(() => {
    const warn = (e) => { if (pending.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("beforeunload", warn); if (pending.current) saveDraft(pending.current.id, pending.current.blocks); };
  }, [saveDraft]);

  async function openPage(id) {
    await flush();
    const p = pages.find((x) => x.id === id);
    setPageId(id); setBlocks(p?.draft ?? p?.blocks ?? []); setSel(null); setStatus("idle"); setMsg("");
  }

  async function publish() {
    setPublishing(true);
    if (!(await flush())) { setPublishing(false); return; }
    const { error } = await supabase.from("site_pages").update({ blocks, draft: null, published: true, published_at: new Date().toISOString() }).eq("id", pageId);
    if (error) { setMsg("Не опубліковано: " + error.message); setPublishing(false); return; }
    await revalidateSite();
    setPages((ps) => ps.map((p) => (p.id === pageId ? { ...p, blocks, draft: null, published: true } : p)));
    setStatus("idle"); setMsg("✅ Опубліковано — зміни вже на сайті."); setPublishing(false);
  }

  async function discard() {
    if (!confirm("Скасувати всі неопубліковані зміни на цій сторінці?")) return;
    clearTimeout(timer.current); pending.current = null;
    await supabase.from("site_pages").update({ draft: null }).eq("id", pageId);
    setPages((ps) => ps.map((p) => (p.id === pageId ? { ...p, draft: null } : p)));
    setBlocks(page.blocks || []); setStatus("idle"); setMsg("Повернуто опубліковану версію.");
  }

  // налаштування сторінки (назва, адреса, SEO) — одразу в базу
  const metaTimer = useRef(null);
  function changeMeta(next) {
    setPages((ps) => ps.map((p) => (p.id === pageId ? { ...p, ...next } : p)));
    clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(async () => {
      const patch = {};
      PAGE_FIELDS.forEach((f) => { patch[f.key] = next[f.key]; });
      patch.nav_label = next.title;
      if (!/^[a-z0-9-]+$/.test(patch.slug || "")) { setMsg("Адреса — лише латиниця, цифри й дефіс."); return; }
      const { error } = await supabase.from("site_pages").update(patch).eq("id", pageId);
      if (error) { setMsg(error.code === "23505" ? "Така адреса вже є в іншої сторінки." : "Не збережено: " + error.message); return; }
      setMsg("Збережено."); revalidateSite();
    }, 800);
  }

  async function createPage() {
    const title = creating.title.trim();
    if (!title) return;
    const slug = slugify(creating.slug || title) || `page-${Date.now().toString(36)}`;
    const b = creating.tpl === "copy" ? structuredClone(blocks).map((x) => ({ ...x, id: newBlock(x.type).id })) : TEMPLATES[creating.tpl].blocks();
    const { data, error } = await supabase.from("site_pages")
      .insert({ slug, title, nav_label: title, blocks: [], draft: b, published: false, sort: (pages.at(-1)?.sort || 0) + 1 })
      .select().single();
    if (error) { setMsg(error.code === "23505" ? "Сторінка з такою адресою вже є." : "Не створено: " + error.message); return; }
    setCreating(null);
    await load(data.id);
    setMsg("Сторінку створено як чернетку. Наповніть блоки й натисніть «Опублікувати».");
  }

  const selectBlock = useCallback((id) => {
    setSel(id); setTab("blocks"); setMobileView("edit");
    setTimeout(() => listRef.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 50);
  }, []);

  function addBlock(type) {
    const b = newBlock(type);
    const i = blocks.findIndex((x) => x.id === sel);
    const next = [...blocks];
    next.splice(i >= 0 ? i + 1 : next.length, 0, b);
    change(next); setLibrary(false); setSel(b.id);
  }
  const update = (id, data) => change(blocks.map((b) => (b.id === id ? data : b)));
  const move = (from, to) => { if (to < 0 || to >= blocks.length || from === to) return; const a = [...blocks]; const [x] = a.splice(from, 1); a.splice(to, 0, x); change(a); };

  const siteUrl = page ? `/site${page.slug === "home" ? "" : `/${page.slug}`}` : "/site";
  const statusText = { dirty: "Зміни…", saving: "Зберігаю…", saved: "Чернетку збережено", error: "Помилка збереження", idle: "" }[status];

  return (
    <div className={`se se--${mobileView}`}>
      <LinkOptions pages={pages} />
      <div className="se-bar">
        <select className="se-pagesel" value={pageId || ""} onChange={(e) => openPage(e.target.value)} aria-label="Сторінка">
          {pages.map((p) => <option key={p.id} value={p.id}>{p.title}{p.draft != null ? " •" : ""}{!p.published ? " (прихована)" : ""}</option>)}
        </select>
        <button type="button" className="btn" onClick={() => setCreating({ title: "", slug: "", tpl: "landing" })}>+ Сторінка</button>
        <a className="btn" href={siteUrl} target="_blank" rel="noopener"><ExternalIcon /> Відкрити на сайті</a>
        <div className="se-bar__right">
          <span className={`se-status se-status--${hasDraft ? "draft" : "live"}`}>
            {statusText || (hasDraft ? "Є неопубліковані зміни" : "Усе опубліковано")}
          </span>
          {hasDraft && <button type="button" className="btn" onClick={discard}>Скасувати зміни</button>}
          <button type="button" className="btn primary" onClick={publish} disabled={publishing || (!hasDraft && status !== "dirty" && page?.published)}>
            {publishing ? "Публікую…" : "Опублікувати"}
          </button>
        </div>
      </div>
      {msg && <div className="se-msg" onClick={() => setMsg("")}>{msg}</div>}

      {creating && (
        <div className="se-create">
          <div className="form-row"><label>Назва сторінки</label><input autoFocus value={creating.title} onChange={(e) => setCreating({ ...creating, title: e.target.value, slug: slugify(e.target.value) })} /></div>
          <div className="form-row"><label>Адреса</label><input value={creating.slug} onChange={(e) => setCreating({ ...creating, slug: e.target.value })} /></div>
          <div className="form-row"><label>Почати з</label>
            <select value={creating.tpl} onChange={(e) => setCreating({ ...creating, tpl: e.target.value })}>
              {Object.entries(TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
              <option value="copy">Копія сторінки «{page?.title}»</option>
            </select>
          </div>
          <div className="se-row"><button type="button" className="btn primary" onClick={createPage}>Створити</button><button type="button" className="btn" onClick={() => setCreating(null)}>Скасувати</button></div>
        </div>
      )}

      <div className="se-mobtabs">
        <button type="button" className={`seg-btn${mobileView === "edit" ? " active" : ""}`} onClick={() => setMobileView("edit")}>Редагувати</button>
        <button type="button" className={`seg-btn${mobileView === "view" ? " active" : ""}`} onClick={() => setMobileView("view")}>Перегляд</button>
      </div>

      <div className="se-main">
        <div className="se-left">
          <div className="se-tabs" role="tablist">
            <button type="button" role="tab" className={`subtab${tab === "blocks" ? " active" : ""}`} onClick={() => setTab("blocks")}>Блоки · {blocks.length}</button>
            <button type="button" role="tab" className={`subtab${tab === "page" ? " active" : ""}`} onClick={() => setTab("page")}>Сторінка і Google</button>
          </div>

          {tab === "page" && page && (
            <div className="se-panel">
              <Fields fields={PAGE_FIELDS} value={page} onChange={changeMeta} />
              <div className="note">Адреса на сайті: {siteUrl.replace("/site", "moduler.pro") || "moduler.pro"}</div>
              {page.slug !== "home" && (
                <div className="se-row" style={{ marginTop: 12 }}>
                  <DeleteButton table="site_pages" id={page.id} what="сторінку" onDone={() => { revalidateSite(); load(); }} onError={setMsg} />
                </div>
              )}
            </div>
          )}

          {tab === "blocks" && (
            <div className="se-blocks" ref={listRef}>
              {blocks.map((b, i) => {
                const def = BLOCKS[b.type];
                const open = sel === b.id;
                return (
                  <div key={b.id} data-id={b.id} className={`se-block${open ? " open" : ""}${b.hidden ? " hidden" : ""}`}
                    onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag.current != null) move(drag.current, i); drag.current = null; }}>
                    <div className="se-block__head">
                      <span className="se-drag" draggable onDragStart={() => { drag.current = i; }} title="Перетягніть, щоб змінити порядок"><DragIcon /></span>
                      <button type="button" className="se-block__name" onClick={() => setSel(open ? null : b.id)}>
                        <span className="se-block__icon">{def?.icon || "▫️"}</span>
                        <span><b>{def?.label || b.type}</b><small>{blockTitle(b)}</small></span>
                      </button>
                      <div className="se-tools">
                        <button type="button" onClick={() => update(b.id, { ...b, hidden: !b.hidden })} title={b.hidden ? "Показати на сайті" : "Сховати з сайту"}>{b.hidden ? <EyeOffIcon /> : <EyeIcon />}</button>
                        <button type="button" onClick={() => { const a = [...blocks]; a.splice(i + 1, 0, { ...structuredClone(b), id: newBlock(b.type).id }); change(a); }} title="Дублювати"><CopyIcon /></button>
                        <button type="button" onClick={() => { if (confirm(`Видалити блок «${def?.label}»?`)) change(blocks.filter((x) => x.id !== b.id)); }} title="Видалити"><TrashIcon /></button>
                      </div>
                    </div>
                    {open && def && (
                      <div className="se-block__body">
                        {def.hint && <div className="se-tip">💡 {def.hint}</div>}
                        <Fields fields={def.fields} value={b} onChange={(v) => update(b.id, v)} />
                        <details className="se-more"><summary>Вигляд і якір</summary><Fields fields={COMMON_FIELDS} value={b} onChange={(v) => update(b.id, v)} /></details>
                        <div className="se-row">
                          <button type="button" className="btn small" onClick={() => move(i, i - 1)} disabled={!i}>↑ Вище</button>
                          <button type="button" className="btn small" onClick={() => move(i, i + 1)} disabled={i === blocks.length - 1}>↓ Нижче</button>
                          <button type="button" className="btn small" onClick={() => setSel(null)}>Згорнути</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!blocks.length && <div className="empty">На сторінці ще немає блоків.</div>}
              <button type="button" className="btn se-add" onClick={() => setLibrary(!library)}>{library ? "Закрити бібліотеку" : "+ Додати блок"}</button>
              {library && (
                <div className="se-lib">
                  {BLOCK_ORDER.map((t) => (
                    <button key={t} type="button" className="se-lib__item" onClick={() => addBlock(t)}>
                      <span className="se-block__icon">{BLOCKS[t].icon}</span>
                      <span><b>{BLOCKS[t].label}</b>{BLOCKS[t].hint && <small>{BLOCKS[t].hint}</small>}</span>
                    </button>
                  ))}
                  <div className="note">Блок з’явиться після вибраного (або в кінці сторінки).</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="se-right">
          <div className="se-devices">
            <button type="button" className={`seg-btn${device === "desktop" ? " active" : ""}`} onClick={() => setDevice("desktop")} title="Комп'ютер"><MonitorIcon /> Комп&apos;ютер</button>
            <button type="button" className={`seg-btn${device === "mobile" ? " active" : ""}`} onClick={() => setDevice("mobile")} title="Телефон"><PhoneIcon /> Телефон</button>
            <span className="note">Клік по секції в перегляді — відкриває її для редагування</span>
          </div>
          <Preview blocks={blocks} selected={sel} onSelect={selectBlock} device={device} />
        </div>
      </div>
    </div>
  );
}

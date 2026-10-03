"use client";

// 🛒 Каталог → Товари: меблі, техніка, сантехніка, оздоблення — те, що продаємо разом із будинком.
// Вставили посилання на товар → назва, опис, фото й ціна підтягуються з сайту продавця → ставимо свою ціну або націнку %.
import { useCallback, useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { fmtCurrency } from "@/lib/format";
import { productPrices } from "@/lib/products";
import { swapOrder } from "@/lib/reorder";
import SearchFilter from "@/components/SearchFilter";
import SelectSearch from "@/components/SelectSearch";
import FolderTree, { dragItem, inFolder, useFolders } from "@/components/catalog/FolderTree";
import OrderButtons from "@/components/catalog/OrderButtons";
import { BulkBar, useMultiSelect } from "@/components/catalog/MultiSelect";
import ProductModal, { readProductPage } from "@/components/catalog/ProductModal";

const STATUS = [{ value: "active", label: "Активні" }, { value: "draft", label: "Чернетки" }, { value: "archived", label: "Архів" }];

export default function ProductsScreen() {
  const { supabase, currency, exchangeRates, showDecimals } = useAppData();
  const { canWriteCatalog } = useAuth();
  const folders = useFolders("products");
  const ms = useMultiSelect();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [folder, setFolder] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(null); // { product, prefill }
  const [link, setLink] = useState("");
  const [reading, setReading] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("catalog_products").select("*").order("sort_order").order("created_at");
    if (error) { setErr("Не вдалося завантажити: " + error.message); setRows([]); return; }
    setRows(data || []);
  }, [supabase]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  if (rows === null) return <div className="empty">Завантаження…</div>;

  const s = q.trim().toLowerCase();
  const list = rows.filter((p) => inFolder(folders, p.folder_id, folder) && (!status || p.status === status) && (!s || [p.name, p.site, p.description].join(" ").toLowerCase().includes(s)));
  const nextSort = rows.length ? Math.max(...rows.map((r) => r.sort_order ?? 0)) + 1 : 0;
  const money = (uah) => (uah == null ? "—" : fmtCurrency(uah, currency, exchangeRates, showDecimals));

  async function importLink() {
    if (!link.trim()) return;
    setReading(true); setErr("");
    const r = await readProductPage(/^https?:\/\//i.test(link.trim()) ? link.trim() : `https://${link.trim()}`).catch((e) => ({ error: e.message, url: link }));
    setReading(false);
    setOpen({ product: null, prefill: r.error ? { url: r.url || link, fields: {}, error: r.error + " Заповніть поля вручну." } : r });
    setLink("");
  }
  async function move(p, dir) {
    const i = list.indexOf(p);
    const b = list[i + dir];
    if (!b) return;
    try { await swapOrder(supabase, "catalog_products", rows, p, b); } catch (e) { setErr(e.message); }
    load();
  }
  async function moveManyToFolder(ids, folderId) {
    const { error } = await supabase.from("catalog_products").update({ folder_id: folderId || null }).in("id", ids);
    if (error) setErr(error.message);
    load();
  }
  async function moveToFolder(id, folderId) {
    const { error } = await supabase.from("catalog_products").update({ folder_id: folderId || null }).eq("id", id);
    if (error) setErr(error.message);
    load();
  }

  return (
    <div>
      <p className="note">Товари, які пропонуємо клієнтам разом із будинком: меблі, техніка, сантехніка, оздоблення. Вставте посилання з сайту продавця — назва, опис, фото й ціна підтягнуться самі; ви ставите свою ціну або націнку.</p>
      {canWriteCatalog && (
        <div className="prod-import">
          <span>🔗</span>
          <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === "Enter" && importLink()} placeholder="Вставте посилання на товар (rozetka, epicentrk, сайт виробника…)" />
          <button type="button" className="btn primary" disabled={reading || !link.trim()} onClick={importLink}>{reading ? "Читаю сторінку…" : "Додати за посиланням"}</button>
          <button type="button" className="btn" onClick={() => setOpen({ product: null, prefill: null })}>+ Вручну</button>
        </div>
      )}
      {err && <div className="auth-error">{err}</div>}
      <div className="toolbar">
        <SearchFilter value={q} onChange={setQ} placeholder="Пошук товару…" active={status ? 1 : 0} onReset={() => setStatus("")}>
          <SelectSearch value={status} options={STATUS} onChange={setStatus} placeholder="Усі статуси" emptyLabel="Усі статуси" width={160} ariaLabel="Статус" />
        </SearchFilter>
      </div>
      <div className="cat-layout">
        <FolderTree scope="products" items={rows} selected={folder} onSelect={setFolder} canEdit={canWriteCatalog} onMoveItem={moveToFolder} />
        <main>
          {!list.length ? (
            <div className="empty">{rows.length ? "Нічого не знайдено в цій папці" : "Товарів ще немає — вставте посилання вище."}</div>
          ) : (
            <div className="prod-grid">
              {list.map((p, i) => {
                const pr = productPrices(p, exchangeRates);
                const fold = folders.find((f) => f.id === p.folder_id);
                return (
                  <div key={p.id} className="card prod-card" {...dragItem(p.id, canWriteCatalog && !ms.selecting)} {...ms.bind(p.id, () => setOpen({ product: p, prefill: null }), canWriteCatalog)}>
                    <div className="prod-card__img" style={p.image ? { backgroundImage: `url(${p.image})` } : undefined}>{!p.image && "📦"}</div>
                    <div className="prod-card__body">
                      <h3>{p.name}</h3>
                      <div className="prod-sub">{[p.site, fold && `📁 ${fold.name}`, p.status !== "active" && (p.status === "draft" ? "чернетка" : "архів")].filter(Boolean).join(" · ")}</div>
                      <div className="prod-price">{money(pr.client)}{p.unit && pr.client != null ? <small className="prod-sub"> / {p.unit}</small> : null}</div>
                      <div className="prod-sub">
                        продавець {money(pr.source)}
                        {p.price_mode === "markup" ? ` · +${Number(p.markup_percent) || 0}%` : pr.pct != null ? ` · маржа ${Math.round(pr.pct)}%` : ""}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
                        {p.url ? <a className="prod-sub" href={p.url} target="_blank" rel="noreferrer">↗ на сайті продавця</a> : <span />}
                        {canWriteCatalog && <OrderButtons onMove={(d) => move(p, d)} first={i === 0} last={i === list.length - 1} disabled={!!s} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <BulkBar ms={ms} scope="products" allIds={list.map((p) => p.id)} onMove={moveManyToFolder} />
        </main>
      </div>
      {open && (
        <ProductModal product={open.product} prefill={open.prefill} defaultFolder={folder} nextSort={nextSort} canEdit={canWriteCatalog}
          onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load(); }} />
      )}
    </div>
  );
}

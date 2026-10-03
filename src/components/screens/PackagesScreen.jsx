"use client";

// 📦 Пакети: кілька будинків (однакових чи різних) + послуги + власні позиції → один продукт.
// Приклади: котеджне містечко, база відпочинку, дохідна нерухомість, «будинок + фундамент + доставка + монтаж».
// Ціна рахується як в угоді CRM; собівартість — зі специфікації будинків і вказаної собівартості позицій.
import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import SearchFilter from "@/components/SearchFilter";
import SelectSearch from "@/components/SelectSearch";
import DeleteButton from "@/components/DeleteButton";
import { templateProductionCost, curr } from "@/lib/crm";
import OrderButtons from "@/components/catalog/OrderButtons";
import { swapOrder } from "@/lib/reorder";
import { productPrices, toUah } from "@/lib/products";
import FolderTree, { FolderSelect, dragItem, inFolder, useFolders } from "@/components/catalog/FolderTree";
import { BulkBar, useMultiSelect } from "@/components/catalog/MultiSelect";
import "@/components/catalog/catalog.css";


function usePackageMath(products = []) {
  const { templates, bomItems, extraCosts, supplierPrices, services, exchangeRates } = useAppData();
  return useMemo(() => {
    const prod = (it) => products.find((x) => x.id === it.template_id);
    const unitPrice = (it) =>
      it.kind === "house" ? (() => { const t = templates.find((x) => x.id === it.template_id); return t && t.base_cost_per_m2 != null ? t.area_m2 * t.base_cost_per_m2 : 0; })()
      : it.kind === "service" ? (Number(services.find((x) => x.id === it.template_id)?.base_price) || 0)
      : it.kind === "product" ? (prod(it) ? productPrices(prod(it), exchangeRates).client || 0 : 0)
      : Number(it.unit_price) || 0;
    // собівартість товару — ціна продавця (якщо не вказали свою)
    const unitCost = (it) =>
      it.kind === "house" ? (templateProductionCost(it.template_id, bomItems, extraCosts, supplierPrices, templates) || 0)
      : it.kind === "product" && (it.unit_cost === "" || it.unit_cost == null) ? (prod(it) ? toUah(prod(it).source_price, prod(it).source_currency, exchangeRates) || 0 : 0)
      : Number(it.unit_cost) || 0;
    function totals(pkg, items) {
      const price = items.reduce((s2, it) => s2 + unitPrice(it) * (Number(it.quantity) || 0), 0);
      const cost = items.reduce((s2, it) => s2 + unitCost(it) * (Number(it.quantity) || 0), 0);
      const final = pkg.price_override != null && pkg.price_override !== "" ? Number(pkg.price_override) : price * (1 + (Number(pkg.markup_percent) || 0) / 100);
      return { price, cost, final, margin: final - cost, pct: final ? ((final - cost) / final) * 100 : 0 };
    }
    return { unitPrice, unitCost, totals };
  }, [templates, bomItems, extraCosts, supplierPrices, services, exchangeRates, products]);
}

function PackageEditor({ pkg, items: initialItems, products, defaultFolder, onClose, onSaved }) {
  const { supabase, templates, services } = useAppData();
  const { canWriteCatalog } = useAuth();
  const m = usePackageMath(products);
  const [form, setForm] = useState({ name: pkg?.name || "", folder_id: pkg ? pkg.folder_id || null : defaultFolder && defaultFolder !== "none" ? defaultFolder : null, description: pkg?.description || "", markup_percent: pkg?.markup_percent ?? "", price_override: pkg?.price_override ?? "", status: pkg?.status || "active" });
  const [items, setItems] = useState(() => (initialItems || []).map((x) => ({ ...x, key: x.id })));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const houseOpts = templates.filter((t) => t.status !== "archived").map((t) => ({ value: t.id, label: t.name, hint: t.area_m2 ? `${t.area_m2} м²` : "" }));
  const prodOpts = products.filter((x) => x.status !== "archived").map((x) => ({ value: x.id, label: x.name, hint: x.site || "" }));
  const svcOpts = services.map((x) => ({ value: x.id, label: x.name, hint: x.base_price != null ? `${curr(x.base_price)} грн` : "" }));
  const t = m.totals(form, items);
  const setIt = (i, patch) => setItems((l) => l.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  async function save() {
    if (!form.name.trim()) { setErr("Вкажіть назву пакета"); return; }
    setBusy(true); setErr("");
    const payload = { name: form.name.trim(), folder_id: form.folder_id || null, description: form.description.trim() || null, status: form.status,
      markup_percent: form.markup_percent === "" ? null : Number(form.markup_percent), price_override: form.price_override === "" ? null : Number(form.price_override), updated_at: new Date().toISOString() };
    let id = pkg?.id;
    const r = id ? await supabase.from("packages").update(payload).eq("id", id) : await supabase.from("packages").insert({ ...payload, sort: Math.floor(Date.now() / 1000) }).select("id").single();
    if (r.error) { setErr(r.error.message); setBusy(false); return; }
    id = id || r.data.id;
    await supabase.from("package_items").delete().eq("package_id", id);
    const rows = items.filter((x) => x.kind === "custom" ? x.label : x.template_id).map((x, i) => ({
      package_id: id, kind: x.kind, template_id: x.kind === "custom" ? null : x.template_id, label: x.kind === "custom" ? x.label : null,
      unit_price: x.kind === "custom" ? Number(x.unit_price) || 0 : null, unit_cost: x.kind === "house" ? null : (x.unit_cost === "" || x.unit_cost == null ? null : Number(x.unit_cost)),
      quantity: Number(x.quantity) || 1, sort: i,
    }));
    if (rows.length) { const e2 = await supabase.from("package_items").insert(rows); if (e2.error) { setErr(e2.error.message); setBusy(false); return; } }
    setBusy(false); onSaved();
  }

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 920 }}>
        <h2>{pkg ? "Пакет" : "Новий пакет"}</h2>
        {err && <div className="auth-error">{err}</div>}
        <div className="deal-grid">
          <div className="form-row"><label>Назва</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="напр. База відпочинку «Карпати»: 6 будинків + SPA" /></div>
          <div className="form-row"><label>Папка</label><FolderSelect scope="packages" value={form.folder_id} onChange={(v) => setForm({ ...form, folder_id: v })} width="100%" /></div>
        </div>
        <div className="form-row"><label>Опис</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Що входить, для кого, умови" /></div>

        <div className="section-label" style={{ margin: "6px 0" }}>Склад пакета</div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Позиція</th><th style={{ width: 70 }}>К-сть</th><th style={{ textAlign: "right" }}>Ціна/од</th><th style={{ textAlign: "right" }}>Собів./од</th><th style={{ textAlign: "right" }}>Сума</th><th /></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.key}>
                  <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <select value={it.kind} onChange={(e) => setIt(i, { kind: e.target.value, template_id: null })} style={{ width: 120 }} aria-label="Тип позиції">
                      <option value="house">🏠 Будинок</option><option value="service">🛠 Послуга</option><option value="product">🛒 Товар</option><option value="custom">✎ Своє</option>
                    </select>
                    {it.kind === "house" && <SelectSearch value={it.template_id || ""} options={houseOpts} onChange={(v) => setIt(i, { template_id: v })} placeholder="Модель будинку" width={230} />}
                    {it.kind === "product" && <SelectSearch value={it.template_id || ""} options={prodOpts} onChange={(v) => setIt(i, { template_id: v })} placeholder="Товар з каталогу" width={230} />}
                    {it.kind === "service" && <SelectSearch value={it.template_id || ""} options={svcOpts} onChange={(v) => setIt(i, { template_id: v })} placeholder="Послуга з каталогу" width={230} />}
                    {it.kind === "custom" && <>
                      <input value={it.label || ""} onChange={(e) => setIt(i, { label: e.target.value })} placeholder="Земля, комунікації, SPA…" style={{ width: 170 }} />
                      <input value={it.unit_price ?? ""} onChange={(e) => setIt(i, { unit_price: e.target.value })} inputMode="decimal" placeholder="ціна" style={{ width: 90 }} />
                    </>}
                  </td>
                  <td><input value={it.quantity} onChange={(e) => setIt(i, { quantity: e.target.value })} inputMode="decimal" style={{ width: 60 }} aria-label="Кількість" /></td>
                  <td style={{ textAlign: "right" }}>{curr(m.unitPrice(it))}</td>
                  <td style={{ textAlign: "right" }}>{it.kind === "house" ? curr(m.unitCost(it)) : <input value={it.unit_cost ?? ""} title={it.kind === "product" ? "Порожньо — ціна продавця" : undefined} onChange={(e) => setIt(i, { unit_cost: e.target.value })} inputMode="decimal" placeholder={it.kind === "product" ? curr(m.unitCost(it)) : "собів."} style={{ width: 90 }} aria-label="Собівартість" />}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{curr(m.unitPrice(it) * (Number(it.quantity) || 0))}</td>
                  <td><button type="button" className="btn small" onClick={() => setItems((l) => l.filter((_, k) => k !== i))} aria-label="Прибрати">×</button></td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={6} className="note" style={{ textAlign: "center" }}>Додайте будинки, послуги або свої позиції (земля, комунікації, спільна зона…)</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 6, margin: "8px 0 14px", flexWrap: "wrap" }}>
          <button type="button" className="btn small" onClick={() => setItems((l) => [...l, { key: Math.random(), kind: "house", quantity: 1 }])}>+ Будинок</button>
          <button type="button" className="btn small" onClick={() => setItems((l) => [...l, { key: Math.random(), kind: "service", quantity: 1 }])}>+ Послуга</button>
          <button type="button" className="btn small" onClick={() => setItems((l) => [...l, { key: Math.random(), kind: "product", quantity: 1 }])}>+ Товар</button>
          <button type="button" className="btn small" onClick={() => setItems((l) => [...l, { key: Math.random(), kind: "custom", quantity: 1 }])}>+ Своя позиція</button>
        </div>

        <div className="deal-grid">
          <div className="form-row"><label>Націнка на пакет, %</label><input value={form.markup_percent} onChange={(e) => setForm({ ...form, markup_percent: e.target.value })} inputMode="decimal" placeholder="0" /></div>
          <div className="form-row"><label>Або фіксована ціна пакета, грн</label><input value={form.price_override} onChange={(e) => setForm({ ...form, price_override: e.target.value })} inputMode="decimal" placeholder="рахується автоматично" /></div>
        </div>
        <div className="ops-kpi-grid" style={{ marginBottom: 12 }}>
          <div className="ops-kpi"><div className="k-label">Сума позицій</div><div className="k-value">{curr(t.price)} грн</div></div>
          <div className="ops-kpi"><div className="k-label">Ціна пакета</div><div className="k-value" style={{ color: "var(--accent)" }}>{curr(t.final)} грн</div></div>
          <div className="ops-kpi"><div className="k-label">Собівартість</div><div className="k-value">{curr(t.cost)} грн</div></div>
          <div className="ops-kpi"><div className="k-label">Маржа</div><div className="k-value" style={{ color: t.margin < 0 ? "var(--danger)" : "var(--success)" }}>{curr(t.margin)} грн · {t.pct.toFixed(0)}%</div></div>
        </div>

        <div className="modal-actions">
          {pkg?.id && canWriteCatalog && <DeleteButton table="packages" id={pkg.id} what="пакет" onDone={onSaved} onError={setErr} />}
          <button className="btn" onClick={onClose}>Скасувати</button>
          <button className="btn primary" onClick={save} disabled={busy || !canWriteCatalog}>{busy ? "Збереження…" : "Зберегти"}</button>
        </div>
      </div>
    </div>
  );
}

export default function PackagesScreen() {
  const { supabase } = useAppData();
  const { canWriteCatalog } = useAuth();
  const folders = useFolders("packages");
  const ms = useMultiSelect();
  const [pkgs, setPkgs] = useState(null);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const m = usePackageMath(products);
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("");
  const [open, setOpen] = useState(null);

  async function load() {
    const [p, i, pr] = await Promise.all([
      supabase.from("packages").select("*").order("sort").order("created_at"),
      supabase.from("package_items").select("*").order("sort"),
      supabase.from("catalog_products").select("*").order("sort_order"),
    ]);
    setPkgs(p.data || []); setItems(i.data || []); setProducts(pr.data || []);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pkgs === null) return <div className="empty">Завантаження пакетів…</div>;
  const s = q.trim().toLowerCase();
  const list = pkgs.filter((p) => inFolder(folders, p.folder_id, folder) && (!s || [p.name, p.description].join(" ").toLowerCase().includes(s)));
  const folderName = (id) => folders.find((f) => f.id === id)?.name;
  async function move(p, dir) {
    const i = list.indexOf(p);
    const b = list[i + dir];
    if (!b) return;
    await swapOrder(supabase, "packages", pkgs, p, b, "sort");
    load();
  }
  async function moveMany(ids, folderId) {
    await supabase.from("packages").update({ folder_id: folderId || null }).in("id", ids);
    load();
  }
  return (
    <div>
      <p className="note">Пакет — кілька будинків, послуги, товари й інші позиції одним продуктом: котеджне містечко, база відпочинку, дохідна нерухомість, «будинок + фундамент + доставка + монтаж». Пакет додається в угоду CRM одним вибором.</p>
      <div className="toolbar">
        <SearchFilter value={q} onChange={setQ} placeholder="Пошук пакета…" />
        <div className="toolbar-actions">
          {canWriteCatalog && <button className="btn primary" onClick={() => setOpen({ pkg: null, items: [] })}>+ Пакет</button>}
        </div>
      </div>
      <div className="cat-layout">
        <FolderTree scope="packages" items={pkgs} selected={folder} onSelect={setFolder} canEdit={canWriteCatalog} onMoveItem={(id, f) => moveMany([id], f)} />
        <main>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 12 }}>
            {list.map((p) => {
              const its = items.filter((x) => x.package_id === p.id);
              const t = m.totals(p, its);
              return (
                <div key={p.id} className="card" style={{ padding: 14 }} {...dragItem(p.id, canWriteCatalog && !ms.selecting)} {...ms.bind(p.id, () => setOpen({ pkg: p, items: its }), canWriteCatalog)}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{p.name}</b>{folderName(p.folder_id) && <span className="folder-tag">📁 {folderName(p.folder_id)}</span>}</div>
                  {p.description && <div className="note" style={{ marginTop: 4 }}>{p.description}</div>}
                  <div className="note" style={{ marginTop: 6 }}>{its.length} позицій · {its.filter((x) => x.kind === "house").reduce((a, x) => a + Number(x.quantity || 0), 0)} будинків</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ fontWeight: 700, color: "var(--accent)" }}>{curr(t.final)} грн</span>
                    <span className="note" style={{ marginTop: 0, color: t.margin < 0 ? "var(--danger)" : "var(--success)" }}>маржа {t.pct.toFixed(0)}%</span>
                  </div>
                  {canWriteCatalog && (
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                      <OrderButtons onMove={(d) => move(p, d)} first={list.indexOf(p) === 0} last={list.indexOf(p) === list.length - 1} disabled={!!s} />
                    </div>
                  )}
                </div>
              );
            })}
            {!list.length && <div className="empty">Пакетів ще немає{canWriteCatalog ? " — натисніть «+ Пакет»" : ""}.</div>}
          </div>
          <BulkBar ms={ms} scope="packages" allIds={list.map((p) => p.id)} onMove={moveMany} />
        </main>
      </div>
      {open && <PackageEditor pkg={open.pkg} items={open.items} products={products} defaultFolder={folder} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load(); }} />}
    </div>
  );
}

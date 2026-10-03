"use client";

// Ціни за постачальником: під кожним постачальником — щільний список його товарів із ціною,
// ринковими мін / середня / макс і різницею з іншими постачальниками. Правки в рядку немає:
// клік по рядку або кнопка ✎ відкриває картку цін матеріалу.
import { useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { daysAgo, isStale } from "@/lib/format";
import { savePrice, ensureSupplierHasCategory } from "@/lib/prices";
import { getCategoryAndDescendantIds } from "@/lib/categoryOrder";
import { priceStats, compare, diffGroup, priceLink, priceTitle, money } from "@/lib/priceStats";
import SupplierContactsModal from "@/components/modals/SupplierContactsModal";
import SupplierModal from "@/components/modals/SupplierModal";
import MaterialPricesModal from "@/components/modals/MaterialPricesModal";
import CategoryTreeSelect from "@/components/CategoryTreeSelect";
import SearchCombobox from "@/components/SearchCombobox";
import SearchFilter from "@/components/SearchFilter";
import PriceDiff from "@/components/PriceDiff";
import StickyScroll from "@/components/StickyScroll";
import { useColumns } from "@/lib/useColumns";
import ColHead, { ColReset } from "@/components/ColHead";

// «Оновлено» у фільтрі — групами, а не кожна кількість днів окремо
const ageGroup = (d) => (d <= 0 ? "сьогодні" : d <= 7 ? "до 7 днів" : d <= 30 ? "до 30 днів" : "понад 30 днів");
const ago = (d) => (d <= 0 ? "сьогодні" : d === 1 ? "вчора" : `${d} дн. тому`);

export default function PriceBySupplierScreen() {
  const { supabase, suppliers, materials, materialCategories, supplierPrices, supplierCategoryLinks, currency, exchangeRates, showDecimals, reload } =
    useAppData();
  const { canWriteFinance, profile, user } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [contactsSupplierId, setContactsSupplierId] = useState(null);
  const [fullSupplier, setFullSupplier] = useState(null);
  const [open, setOpen] = useState(null); // { materialId, supplierId } — картка цін матеріалу
  const [addFor, setAddFor] = useState(null); // постачальник, якому додаємо ціну
  const [addForm, setAddForm] = useState({ materialId: "", price: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const updatedBy = profile?.full_name || user?.email || null;

  const allowedCategoryIds = categoryFilter ? getCategoryAndDescendantIds(categoryFilter, materialCategories) : null;
  const list = suppliers.filter((s) => {
    const cats = supplierCategoryLinks.filter((l) => l.supplier_id === s.id).map((l) => l.category_id);
    return (
      (!search || s.name.toLowerCase().includes(search.toLowerCase())) &&
      (!allowedCategoryIds || cats.some((id) => allowedCategoryIds.includes(id)))
    );
  });

  // ціни матеріалу в усіх постачальників — щоб порівняти ціну цього постачальника з рештою
  const market = useMemo(() => {
    const by = new Map();
    for (const p of supplierPrices) {
      if (!by.has(p.material_id)) by.set(p.material_id, []);
      by.get(p.material_id).push(p);
    }
    const stats = new Map([...by].map(([id, prices]) => [id, priceStats(prices)]));
    return { of: (p) => by.get(p.material_id) || [], stats: (p) => stats.get(p.material_id) };
  }, [supplierPrices]);

  // сортування й фільтр стовпчиків — спільні для всіх таблиць (один стан на екран); рядки — ціни постачальників
  const cols = useMemo(() => ({
    material: { value: (p) => materials.find((x) => x.id === p.material_id)?.name },
    unit: { value: (p) => materials.find((x) => x.id === p.material_id)?.unit },
    price: { value: (p) => Number(p.price) },
    min: { value: (p) => market.stats(p)?.min },
    avg: { value: (p) => market.stats(p)?.avg },
    max: { value: (p) => market.stats(p)?.max },
    dmin: { value: (p) => diffGroup(compare(p, market.of(p)).min), sort: (p) => compare(p, market.of(p)).min?.pct },
    davg: { value: (p) => diffGroup(compare(p, market.of(p)).avg), sort: (p) => compare(p, market.of(p)).avg?.pct },
    updated: { value: (p) => ageGroup(daysAgo(p.updated_at)), sort: (p) => daysAgo(p.updated_at) },
  }), [materials, market]);
  const shown = useMemo(() => { const ids = new Set(list.map((s) => s.id)); return supplierPrices.filter((p) => ids.has(p.supplier_id)); }, [list, supplierPrices]);
  const t = useColumns(shown, cols);

  const fmt = (v) => money(v, currency, exchangeRates, showDecimals);
  const grn = currency === "UAH" ? ", грн" : "";

  function toggleAdd(supplierId) {
    setError("");
    setAddForm({ materialId: "", price: "", note: "" });
    setAddFor((v) => (v === supplierId ? null : supplierId));
  }

  async function handleAdd(supplierId) {
    const price = parseFloat(String(addForm.price).replace(",", "."));
    if (!addForm.materialId || !(price > 0)) { setError("Обери матеріал і вкажи ціну більшу за нуль."); return; }
    setBusy(true);
    setError("");
    const res = await savePrice(supabase, { supplierId, materialId: addForm.materialId, price, updatedBy, note: addForm.note || "" });
    if (res.error) setError(res.error.message);
    else {
      await ensureSupplierHasCategory(supabase, { supplierId, materialId: addForm.materialId, materials, supplierCategoryLinks });
      setAddForm({ materialId: "", price: "", note: "" });
    }
    await reload(true);
    setBusy(false);
  }

  function openFullSupplier(supplier) {
    setContactsSupplierId(null);
    setFullSupplier(supplier);
  }

  return (
    <div>
      <p className="note">Під кожним постачальником — його товари: ціна, ринкові мін / середня / макс і різниця з іншими постачальниками. Клік по рядку — усі ціни товару й правка.</p>
      <div className="toolbar">
        <div className="toolbar-left">
          <CategoryTreeSelect value={categoryFilter} categories={materialCategories} onChange={setCategoryFilter} />
          <SearchFilter value={search} onChange={setSearch} placeholder="Пошук постачальника..." />
        </div>
        <div className="toolbar-actions"><ColReset t={t} /></div>
      </div>

      {!list.length && <div className="empty">Нічого не знайдено</div>}
      {t.active > 0 && !t.rows.length && <div className="empty">За фільтром стовпчиків нічого не знайдено — натисніть «Скинути фільтри» вгорі.</div>}
      {list.map((s) => {
        const all = supplierPrices.filter((p) => p.supplier_id === s.id);
        const rows = t.sortRows(all.filter((p) => t.passes(p)));
        if (t.active > 0 && !rows.length) return null; // при фільтрі показуємо лише постачальників, де є відповідні ціни
        const usedMaterialIds = new Set(all.map((r) => r.material_id));
        const adding = addFor === s.id;
        return (
          <div key={s.id} style={{ marginBottom: 14 }}>
            <h3 className="group-head">
              {s.website ? <a href={s.website} target="_blank" rel="noreferrer">{s.name}</a> : s.name}
              <button type="button" className="btn small icon" title="Контакти постачальника" aria-label="Контакти постачальника" onClick={() => setContactsSupplierId(s.id)}>👤</button>
              <span className="note" style={{ marginTop: 0, fontWeight: 400 }}>цін: {all.length}</span>
              {canWriteFinance && <button type="button" className="btn small" title="Додати ціну на товар цього постачальника" onClick={() => toggleAdd(s.id)}>{adding ? "× закрити" : "+ ціна"}</button>}
            </h3>
            {adding && (
              <div className="toolbar" style={{ margin: "0 0 8px" }}>
                <div className="toolbar-left">
                  <div style={{ width: 320, maxWidth: "100%" }}>
                    <SearchCombobox
                      value={addForm.materialId}
                      options={materials.filter((m) => !usedMaterialIds.has(m.id)).map((m) => ({ id: m.id, label: `${m.name} (${m.unit})` }))}
                      placeholder="матеріал…"
                      onChange={(id) => setAddForm((v) => ({ ...v, materialId: id }))}
                    />
                  </div>
                  <input type="number" className="price-input" placeholder="ціна за од." value={addForm.price} onChange={(e) => setAddForm((v) => ({ ...v, price: e.target.value }))} />
                  <input type="text" style={{ width: 260, maxWidth: "100%" }} placeholder="що саме, посилання (необов'язково)" value={addForm.note} onChange={(e) => setAddForm((v) => ({ ...v, note: e.target.value }))} />
                  <button className="btn small primary" disabled={busy} onClick={() => handleAdd(s.id)}>+ Додати</button>
                </div>
                {error && <div className="auth-error" style={{ flexBasis: "100%" }}>{error}</div>}
              </div>
            )}
            {all.length > 0 && (
              <StickyScroll>
                <table className="dense price-list">
                  <thead>
                    <tr>
                      <ColHead t={t} k="material">Матеріал</ColHead>
                      <ColHead t={t} k="unit">Од.</ColHead>
                      <ColHead t={t} k="price" num noFilter>Ціна{grn}</ColHead>
                      <ColHead t={t} k="min" num noFilter><span title="Найнижча ціна цього матеріалу серед усіх постачальників">Мін</span></ColHead>
                      <ColHead t={t} k="avg" num noFilter>Середня</ColHead>
                      <ColHead t={t} k="max" num noFilter>Макс</ColHead>
                      <ColHead t={t} k="dmin"><span title="Різниця з найнижчою ціною серед інших постачальників">До мін. інших</span></ColHead>
                      <ColHead t={t} k="davg"><span title="Різниця із середньою ціною серед інших постачальників">До сер. інших</span></ColHead>
                      <ColHead t={t} k="updated">Оновлено</ColHead>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const m = materials.find((x) => x.id === p.material_id);
                      const st = market.stats(p);
                      const cmp = compare(p, market.of(p));
                      const link = priceLink(p);
                      const sub = m?.spec || priceTitle(p);
                      const d = daysAgo(p.updated_at);
                      return (
                        <tr key={p.material_id} className="row-click" title="Клік — усі ціни товару й правка" onClick={(e) => { if (!e.target.closest("a,button,input,.btn")) setOpen({ materialId: p.material_id, supplierId: s.id }); }}>
                          <td>
                            {m ? `${m.icon ? `${m.icon} ` : ""}${m.name}` : "—"}
                            {sub && <span className="sub-clip" title={sub}>{sub}</span>}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>{m?.unit || "од."}</td>
                          <td className="num">{link ? <a href={link} target="_blank" rel="noreferrer" title={priceTitle(p) || "Відкрити товар на сайті"}><b>{fmt(p.price)}</b></a> : <b>{fmt(p.price)}</b>}</td>
                          <td className="num">{st && st.n > 1 ? fmt(st.min) : <span className="note">—</span>}</td>
                          <td className="num">{st && st.n > 1 ? fmt(st.avg) : <span className="note">—</span>}</td>
                          <td className="num">{st && st.n > 1 ? fmt(st.max) : <span className="note">—</span>}</td>
                          <td style={{ whiteSpace: "nowrap" }}><PriceDiff d={cmp.min} fmt={fmt} title="проти найнижчої ціни серед інших постачальників" /></td>
                          <td style={{ whiteSpace: "nowrap" }}><PriceDiff d={cmp.avg} fmt={fmt} title="проти середньої ціни серед інших постачальників" /></td>
                          <td style={{ whiteSpace: "nowrap" }} className={isStale(p.updated_at) ? "stale" : undefined} title={p.source === "parsing" ? "ціна з сайту — оновлюється сама" : p.updated_by || "внесено вручну"}>{ago(d)}</td>
                          <td><button type="button" className="btn small icon" title="Відкрити: усі ціни товару й правка" aria-label="Відкрити товар" onClick={() => setOpen({ materialId: p.material_id, supplierId: s.id })}>✎</button></td>
                        </tr>
                      );
                    })}
                    {!rows.length && <tr><td colSpan={10} className="empty">Немає цін</td></tr>}
                  </tbody>
                </table>
              </StickyScroll>
            )}
          </div>
        );
      })}

      {open && <MaterialPricesModal key={open.materialId} materialId={open.materialId} supplierId={open.supplierId} onClose={() => setOpen(null)} />}
      <SupplierContactsModal
        supplierId={contactsSupplierId}
        onClose={() => setContactsSupplierId(null)}
        onOpenFull={openFullSupplier}
      />
      <SupplierModal open={!!fullSupplier} supplier={fullSupplier} onClose={() => setFullSupplier(null)} onSaved={() => setFullSupplier(null)} />
    </div>
  );
}

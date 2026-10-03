"use client";

// Ціни за товаром: один щільний рядок на матеріал — скільки постачальників, найнижча / середня / найвища ціна
// і ціна обраного постачальника проти решти. Правки в рядку немає (більшість цін приходить із сайтів):
// клік по рядку або кнопка ✎ відкриває картку цін матеріалу.
import { Fragment, useEffect, useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { daysAgo, isStale } from "@/lib/format";
import { getCategoryAndDescendantIds, flattenCategoryOrder } from "@/lib/categoryOrder";
import { priceStats, compare, diffGroup, priceLink, priceTitle, money } from "@/lib/priceStats";
import { useColumns } from "@/lib/useColumns";
import ColHead, { ColReset } from "@/components/ColHead";
import SearchFilter from "@/components/SearchFilter";
import CategoryTreeSelect from "@/components/CategoryTreeSelect";
import SearchCombobox from "@/components/SearchCombobox";
import InfoTip from "@/components/InfoTip";
import StickyScroll from "@/components/StickyScroll";
import PriceDiff from "@/components/PriceDiff";
import MaterialPricesModal from "@/components/modals/MaterialPricesModal";

// «Оновлено» у фільтрі — групами, а не кожна кількість днів окремо
const ageGroup = (d) => (d <= 0 ? "сьогодні" : d <= 7 ? "до 7 днів" : d <= 30 ? "до 30 днів" : "понад 30 днів");
const ago = (d) => (d <= 0 ? "сьогодні" : d === 1 ? "вчора" : `${d} дн. тому`);
const COMPARE_KEY = "moduler.price.compareSupplier";

export default function PriceByMaterialScreen() {
  const { materials, materialCategories, suppliers, supplierPrices, currency, exchangeRates, showDecimals } = useAppData();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [compareId, setCompareId] = useState("");
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    // Обраний для порівняння постачальник запам'ятовується в браузері.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setCompareId(window.localStorage.getItem(COMPARE_KEY) || ""); } catch { /* сховище недоступне */ }
  }, []);
  function chooseCompare(id) {
    setCompareId(id || "");
    try { window.localStorage.setItem(COMPARE_KEY, id || ""); } catch { /* сховище недоступне */ }
  }

  const chosen = suppliers.find((s) => s.id === compareId) || null;
  const supplierOptions = useMemo(() => {
    const withPrices = new Set(supplierPrices.map((p) => p.supplier_id));
    return suppliers.filter((s) => withPrices.has(s.id)).sort((a, b) => a.name.localeCompare(b.name, "uk")).map((s) => ({ id: s.id, label: s.name }));
  }, [suppliers, supplierPrices]);

  // один рядок на товар: зведення цін і ціна обраного постачальника проти решти
  const base = useMemo(() => {
    const byMaterial = new Map();
    for (const p of supplierPrices) {
      if (!byMaterial.has(p.material_id)) byMaterial.set(p.material_id, []);
      byMaterial.get(p.material_id).push(p);
    }
    const allowed = categoryFilter ? getCategoryAndDescendantIds(categoryFilter, materialCategories) : null;
    const order = flattenCategoryOrder(materialCategories);
    const q = search.trim().toLowerCase();
    return materials
      .filter((m) => (!q || m.name.toLowerCase().includes(q)) && (!allowed || allowed.includes(m.category_id)))
      .sort((a, b) => (order.get(a.category_id) ?? 999999) - (order.get(b.category_id) ?? 999999) || a.name.localeCompare(b.name, "uk", { numeric: true }))
      .map((m) => {
        const prices = byMaterial.get(m.id) || [];
        const st = priceStats(prices);
        const own = chosen ? prices.find((p) => p.supplier_id === chosen.id) || null : null;
        return {
          m, ...st, own,
          cmp: compare(own, prices),
          cat: materialCategories.find((c) => c.id === m.category_id) || null,
          cheapestName: st.cheapest ? suppliers.find((s) => s.id === st.cheapest.supplier_id)?.name || "" : "",
        };
      });
  }, [materials, materialCategories, suppliers, supplierPrices, search, categoryFilter, chosen]);

  const cols = useMemo(() => ({
    name: { value: (r) => r.m.name },
    unit: { value: (r) => r.m.unit },
    n: { value: (r) => r.n },
    min: { value: (r) => r.min },
    cheapest: { value: (r) => r.cheapestName },
    avg: { value: (r) => r.avg },
    max: { value: (r) => r.max },
    own: { value: (r) => (r.own ? Number(r.own.price) : null) },
    dmin: { value: (r) => diffGroup(r.cmp.min), sort: (r) => r.cmp.min?.pct },
    davg: { value: (r) => diffGroup(r.cmp.avg), sort: (r) => r.cmp.avg?.pct },
    updated: { value: (r) => (r.fresh ? ageGroup(daysAgo(r.fresh)) : ""), sort: (r) => (r.fresh ? daysAgo(r.fresh) : null) },
  }), []);
  const t = useColumns(base, cols);

  const fmt = (v) => money(v, currency, exchangeRates, showDecimals);
  const grn = currency === "UAH" ? ", грн" : "";
  const colCount = chosen ? 12 : 9;
  // зведення по обраному постачальнику: де він найдешевший, де дорожчий за інших
  const summary = chosen && (() => {
    const own = base.filter((r) => r.own);
    return {
      n: own.length,
      best: own.filter((r) => r.cmp.min && r.cmp.min.abs <= 0).length,
      worse: own.filter((r) => r.cmp.min && r.cmp.min.abs > 0).length,
      alone: own.filter((r) => !r.cmp.min).length,
    };
  })();

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-left">
          <SearchFilter value={search} onChange={setSearch} placeholder="Пошук товару..." active={categoryFilter ? 1 : 0} onReset={() => setCategoryFilter("")}>
            <CategoryTreeSelect value={categoryFilter} categories={materialCategories} onChange={setCategoryFilter} />
          </SearchFilter>
          <InfoTip label="Як читати" text="Один рядок на товар: найнижча, середня й найвища ціна серед постачальників. Оберіть постачальника — побачите, наскільки його ціни вищі чи нижчі за інших. Клік по рядку — усі ціни товару й правка." />
          <div style={{ width: 260, maxWidth: "100%" }} title="Ціни цього постачальника стануть окремим стовпцем із порівнянням">
            <SearchCombobox value={compareId} options={supplierOptions} onChange={chooseCompare} placeholder="Порівняти з постачальником…" />
          </div>
        </div>
        <div className="toolbar-actions"><ColReset t={t} /></div>
      </div>
      {summary && (
        <p className="note" style={{ marginTop: -6 }}>
          <b>{chosen.name}</b>: цін у списку — {summary.n}; найдешевший або нарівні — <span className="fresh">{summary.best}</span>, дорожчий за найнижчу в інших — <span className="stale">{summary.worse}</span>
          {summary.alone > 0 && <>, порівняти нема з ким — {summary.alone}</>}.
        </p>
      )}

      <StickyScroll>
        <table className="dense price-list">
          <thead>
            <tr>
              <ColHead t={t} k="name">Матеріал</ColHead>
              <ColHead t={t} k="unit">Од.</ColHead>
              <ColHead t={t} k="n" num>Постач.</ColHead>
              <ColHead t={t} k="min" num noFilter>Мін{grn}</ColHead>
              <ColHead t={t} k="cheapest">Найдешевший</ColHead>
              <ColHead t={t} k="avg" num noFilter>Середня</ColHead>
              <ColHead t={t} k="max" num noFilter>Макс</ColHead>
              {chosen && (
                <>
                  <ColHead t={t} k="own" num noFilter><span className="cell-clip" style={{ maxWidth: 130 }} title={`Ціна постачальника «${chosen.name}»`}>{chosen.name}</span></ColHead>
                  <ColHead t={t} k="dmin"><span title="Різниця з найнижчою ціною серед інших постачальників">До мін. інших</span></ColHead>
                  <ColHead t={t} k="davg"><span title="Різниця із середньою ціною серед інших постачальників">До сер. інших</span></ColHead>
                </>
              )}
              <ColHead t={t} k="updated">Оновлено</ColHead>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r, idx) => {
              const { m } = r;
              const link = priceLink(r.cheapest);
              const ownLink = priceLink(r.own);
              // заголовок категорії — коли список іде в порядку категорій (без сортування стовпчика)
              const header = !t.sorted && r.cat && t.rows[idx - 1]?.cat?.id !== r.cat.id;
              return (
                <Fragment key={m.id}>
                {header && (
                  <tr><td colSpan={colCount} className="group-row"><span className="sticky-left">{r.cat.icon ? `${r.cat.icon} ` : ""}{r.cat.name}</span></td></tr>
                )}
                <tr className="row-click" title="Клік — усі ціни товару й правка" onClick={(e) => { if (!e.target.closest("a,button,input,.btn")) setOpenId(m.id); }}>
                  <td>{m.icon ? `${m.icon} ` : ""}{m.name}<InfoTip text={m.spec} image={m.image_url} /></td>
                  <td style={{ whiteSpace: "nowrap" }}>{m.unit}</td>
                  <td className="num">{r.n || <span className="badge draft" style={{ color: "var(--danger)" }}>немає ціни</span>}</td>
                  <td className="num">
                    {r.n ? (link ? <a href={link} target="_blank" rel="noreferrer" title={priceTitle(r.cheapest) || "Відкрити товар на сайті"}><b>{fmt(r.min)}</b></a> : <b>{fmt(r.min)}</b>) : "—"}
                  </td>
                  <td><span className="cell-clip" style={{ maxWidth: 140 }} title={r.cheapestName}>{r.cheapestName || "—"}</span></td>
                  <td className="num">{r.n > 1 ? fmt(r.avg) : <span className="note">—</span>}</td>
                  <td className="num">{r.n > 1 ? fmt(r.max) : <span className="note">—</span>}</td>
                  {chosen && (
                    <>
                      <td className="num">
                        {r.own ? (ownLink ? <a href={ownLink} target="_blank" rel="noreferrer" title={priceTitle(r.own) || "Відкрити товар на сайті"}><b>{fmt(r.own.price)}</b></a> : <b>{fmt(r.own.price)}</b>) : <span className="note">—</span>}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{r.own ? <PriceDiff d={r.cmp.min} fmt={fmt} title="проти найнижчої ціни серед інших постачальників" /> : <span className="note">—</span>}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{r.own ? <PriceDiff d={r.cmp.avg} fmt={fmt} title="проти середньої ціни серед інших постачальників" /> : <span className="note">—</span>}</td>
                    </>
                  )}
                  <td style={{ whiteSpace: "nowrap" }} className={r.fresh && isStale(r.fresh) ? "stale" : undefined}>{r.fresh ? ago(daysAgo(r.fresh)) : "—"}</td>
                  <td><button type="button" className="btn small icon" title="Відкрити: усі ціни товару й правка" aria-label="Відкрити товар" onClick={() => setOpenId(m.id)}>✎</button></td>
                </tr>
                </Fragment>
              );
            })}
            {!t.rows.length && <tr><td colSpan={colCount} className="empty">Нічого не знайдено</td></tr>}
          </tbody>
        </table>
      </StickyScroll>

      {openId && <MaterialPricesModal key={openId} materialId={openId} supplierId={chosen?.id} onClose={() => setOpenId(null)} />}
    </div>
  );
}

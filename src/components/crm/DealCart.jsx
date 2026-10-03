"use client";

// 🛒 Кошик угоди: будинки, послуги, товари, пакети й свої рядки — як кошик інтернет-магазину.
// Кожна позиція: ціна за одиницю (у вибраній валюті, за замовчуванням — валюта системи) × кількість = сума.
// Ціни зберігаються і в гривні (unit_price — для звітів і сум), і у валюті введення (unit_price_cur + currency).
import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { fmtCurrency, templateTotalUah } from "@/lib/format";
import { productPrices, rateOf } from "@/lib/products";
import { inBranch, treeOptions } from "@/lib/tree";
import SelectSearch from "@/components/SelectSearch";
import "./cart.css";

const KINDS = { house: "🏠", service: "🛠", product: "🛒", custom: "✏️" };
const CURS = [["UAH", "грн"], ["USD", "$"], ["EUR", "€"]];
const uid = () => Math.random().toString(36).slice(2, 10);
const round2 = (n) => Math.round(n * 100) / 100;

// позиція кошика з ціною в гривні → у валюті введення
export function makeLine({ kind, ref_id, label, unitUah, quantity = 1, currency, rates, from_package }) {
  const cur = currency || "UAH";
  const priceCur = unitUah == null ? null : round2(unitUah / rateOf(cur, rates));
  return {
    key: uid(), kind, ref_id: ref_id || null, template_id: kind === "house" ? ref_id : null,
    label: label || "", currency: cur, unit_price_cur: priceCur, unit_price: unitUah == null ? null : round2(unitUah), quantity, from_package: from_package || null,
  };
}

// старі позиції угоди (без ціни в рядку) → позиції кошика
export function linesFromDeal(deal, { templates, services, serviceTemplateUnitPrice, rates, currency }) {
  const out = (deal?.template_lines || []).map((l) => {
    let unitUah = l.unit_price != null ? Number(l.unit_price) : null;
    let label = l.label || "";
    if (l.kind === "house") {
      const t = templates.find((x) => x.id === l.template_id);
      label ||= t?.name || "Будинок";
      if (unitUah == null && t) unitUah = templateTotalUah(t);
    } else if (l.kind === "service" && l.template_id && !l.ref_id) {
      label ||= "Послуги (шаблон)";
      if (unitUah == null && serviceTemplateUnitPrice) unitUah = serviceTemplateUnitPrice(l.template_id);
    } else if (l.kind === "service") {
      const sv = services.find((x) => x.id === l.ref_id);
      label ||= sv?.name || "Послуга";
    }
    const cur = l.currency || "UAH";
    return {
      key: uid(), kind: l.kind === "service" && l.template_id && !l.ref_id ? "custom" : l.kind, ref_id: l.ref_id || l.template_id || null,
      template_id: l.kind === "house" ? l.template_id : null, label, currency: cur,
      unit_price_cur: l.unit_price_cur != null ? Number(l.unit_price_cur) : unitUah == null ? null : round2(unitUah / rateOf(cur, rates)),
      unit_price: unitUah, quantity: Number(l.quantity) || 1, from_package: l.from_package || null,
    };
  });
  // давній «індивідуальний» запит з однією сумою → рядок кошика
  if (!out.length && Number(deal?.estimated_price) > 0) out.push(makeLine({ kind: "custom", label: "Орієнтовна сума", unitUah: Number(deal.estimated_price), currency, rates }));
  return out;
}

export const lineTotalUah = (l) => (Number(l.unit_price) || 0) * (Number(l.quantity) || 0);
export const cartTotalUah = (lines) => lines.reduce((s, l) => s + lineTotalUah(l), 0);

// для збереження в deals.template_lines
export const linesForSave = (lines) => lines
  .filter((l) => (l.label || l.ref_id) && Number(l.quantity) > 0)
  .map(({ key: _k, ...l }) => ({ ...l, quantity: Number(l.quantity), unit_price: l.unit_price == null ? 0 : round2(Number(l.unit_price)) }));

export default function DealCart({ lines, setLines, readOnly }) {
  const { supabase, templates, services, catalogFolders = [], currency, exchangeRates, showDecimals } = useAppData();
  const [picker, setPicker] = useState(false);
  const money = (uah) => fmtCurrency(uah, currency, exchangeRates, showDecimals);

  function update(key, patch) {
    setLines((ls) => ls.map((l) => {
      if (l.key !== key) return l;
      const n = { ...l, ...patch };
      // ціна чи валюта змінились — перераховуємо гривневу ціну
      if ("unit_price_cur" in patch || "currency" in patch) {
        if ("currency" in patch && !("unit_price_cur" in patch) && l.unit_price != null) n.unit_price_cur = round2(l.unit_price / rateOf(n.currency, exchangeRates));
        else n.unit_price = n.unit_price_cur === "" || n.unit_price_cur == null ? null : round2(Number(n.unit_price_cur) * rateOf(n.currency, exchangeRates));
      }
      return n;
    }));
  }
  function add(newLines) {
    setLines((ls) => {
      const out = [...ls];
      newLines.forEach((nl) => {
        // той самий будинок/послуга/товар без пакета — збільшуємо кількість
        const same = nl.ref_id && !nl.from_package && out.find((x) => x.kind === nl.kind && x.ref_id === nl.ref_id && !x.from_package);
        if (same) same.quantity = (Number(same.quantity) || 0) + (Number(nl.quantity) || 1);
        else out.push(nl);
      });
      return out.map((x) => ({ ...x }));
    });
  }

  const total = cartTotalUah(lines);

  return (
    <div className="cart">
      <div className="cart-head">
        <b>🛒 Позиції замовлення</b>
        <span className="cart-total">{money(total)}</span>
      </div>
      {!lines.length && <div className="note" style={{ margin: "4px 0 8px" }}>Додайте будинки, послуги, товари чи свої рядки — сума порахується сама.</div>}
      {lines.map((l) => (
        <div key={l.key} className="cart-line">
          <span className="cart-ico" title={l.kind}>{KINDS[l.kind] || "•"}</span>
          <div className="cart-name">
            {l.kind === "custom" && !readOnly
              ? <input value={l.label} onChange={(e) => update(l.key, { label: e.target.value })} placeholder="Назва (напр. вуличний диван)" />
              : <span>{l.label}</span>}
            {l.from_package && <small className="note">📦 {l.from_package}</small>}
          </div>
          <div className="cart-price">
            <input inputMode="decimal" value={l.unit_price_cur ?? ""} disabled={readOnly} placeholder="ціна"
              onChange={(e) => update(l.key, { unit_price_cur: e.target.value.replace(",", ".").replace(/[^\d.]/g, "") })} aria-label="Ціна за одиницю" />
            <select value={l.currency} disabled={readOnly} onChange={(e) => update(l.key, { currency: e.target.value })} aria-label="Валюта">{CURS.map(([k, s]) => <option key={k} value={k}>{s}</option>)}</select>
          </div>
          <span className="cart-x">×</span>
          <input className="cart-qty" type="number" min="0" step="1" value={l.quantity} disabled={readOnly} onChange={(e) => update(l.key, { quantity: e.target.value })} aria-label="Кількість" />
          <span className="cart-sum">{money(lineTotalUah(l))}</span>
          {!readOnly && <button type="button" className="cart-del" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} title="Прибрати">✕</button>}
        </div>
      ))}
      {!readOnly && (
        <div className="cart-actions">
          <button type="button" className="btn small primary" onClick={() => setPicker(true)}>+ Додати з каталогу</button>
          <button type="button" className="btn small" onClick={() => add([makeLine({ kind: "custom", label: "", unitUah: null, currency, rates: exchangeRates })])}>+ Свій рядок</button>
        </div>
      )}
      {lines.length > 0 && (
        <div className="cart-foot"><span>Разом{lines.length > 1 ? ` · ${lines.length} поз.` : ""}</span><b>{money(total)}</b></div>
      )}
      {picker && <CatalogPicker onClose={() => setPicker(false)} onAdd={add} supabase={supabase} templates={templates} services={services} folders={catalogFolders} currency={currency} rates={exchangeRates} money={money} />}
    </div>
  );
}

// Вибір із каталогу: вкладки, папки, пошук; «+» додає й лишає вікно відкритим — можна набрати кілька позицій
function CatalogPicker({ onClose, onAdd, supabase, templates, services, folders, currency, rates, money }) {
  const [tab, setTab] = useState("house");
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("");
  const [products, setProducts] = useState([]);
  const [pkgs, setPkgs] = useState({ list: [], items: [] });
  const [added, setAdded] = useState({});
  const [own, setOwn] = useState({ label: "", price: "", cur: currency, qty: 1 });

  useEffect(() => {
    let on = true;
    Promise.all([
      supabase.from("catalog_products").select("*").eq("status", "active").order("sort_order"),
      supabase.from("packages").select("id,name,description,markup_percent,price_override").eq("status", "active").order("sort"),
      supabase.from("package_items").select("*").order("sort"),
    ]).then(([p, k, i]) => { if (on) { setProducts(p.data || []); setPkgs({ list: k.data || [], items: i.data || [] }); } });
    return () => { on = false; };
  }, [supabase]);

  const scope = tab === "house" ? "models" : tab === "service" ? "services" : tab === "product" ? "products" : null;
  const fl = scope ? folders.filter((f) => f.scope === scope) : [];
  const s = q.trim().toLowerCase();
  const okFolder = (fid) => !folder || (!!fid && inBranch(fl, fid, folder));

  const rows = useMemo(() => {
    if (tab === "house") return templates.filter((t) => t.status !== "archived" && okFolder(t.folder_id) && (!s || t.name.toLowerCase().includes(s)))
      .map((t) => ({ id: t.id, name: t.name, sub: [t.area_m2 && `${t.area_m2} м²`, t.module_count && `${t.module_count} мод.`].filter(Boolean).join(" · "), uah: templateTotalUah(t) }));
    if (tab === "service") return services.filter((x) => okFolder(x.folder_id) && (!s || x.name.toLowerCase().includes(s)))
      .map((x) => ({ id: x.id, name: `${x.icon ? x.icon + " " : ""}${x.name}`, plain: x.name, sub: x.unit ? `за ${x.unit}` : "", uah: x.base_price != null ? Number(x.base_price) : null }));
    if (tab === "product") return products.filter((x) => okFolder(x.folder_id) && (!s || [x.name, x.site].join(" ").toLowerCase().includes(s)))
      .map((x) => ({ id: x.id, name: x.name, sub: [x.site, x.unit && `за ${x.unit}`].filter(Boolean).join(" · "), uah: productPrices(x, rates).client, image: x.image }));
    if (tab === "package") return pkgs.list.filter((p) => !s || p.name.toLowerCase().includes(s))
      .map((p) => ({ id: p.id, name: p.name, sub: `${pkgs.items.filter((x) => x.package_id === p.id).length} поз. — розгорнеться в позиції`, uah: null }));
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, s, folder, templates, services, products, pkgs, rates]);

  function pick(r) {
    let lines;
    if (tab === "package") {
      const p = pkgs.list.find((x) => x.id === r.id);
      lines = pkgs.items.filter((x) => x.package_id === r.id).map((it) => {
        if (it.kind === "house") { const t = templates.find((x) => x.id === it.template_id); return makeLine({ kind: "house", ref_id: it.template_id, label: t?.name || "Будинок", unitUah: t ? templateTotalUah(t) : null, quantity: Number(it.quantity) || 1, currency, rates, from_package: p?.name }); }
        if (it.kind === "service") { const sv = services.find((x) => x.id === it.template_id); return makeLine({ kind: "service", ref_id: it.template_id, label: sv?.name || "Послуга", unitUah: sv?.base_price != null ? Number(sv.base_price) : null, quantity: Number(it.quantity) || 1, currency, rates, from_package: p?.name }); }
        return makeLine({ kind: "custom", label: it.label || "Позиція", unitUah: it.unit_price != null ? Number(it.unit_price) : null, quantity: Number(it.quantity) || 1, currency, rates, from_package: p?.name });
      });
    } else {
      lines = [makeLine({ kind: tab, ref_id: r.id, label: r.plain || r.name, unitUah: r.uah, currency, rates })];
    }
    onAdd(lines);
    setAdded((a) => ({ ...a, [`${tab}:${r.id}`]: (a[`${tab}:${r.id}`] || 0) + 1 }));
  }
  function addOwn() {
    if (!own.label.trim()) return;
    const uah = own.price === "" ? null : Number(String(own.price).replace(",", ".")) * rateOf(own.cur, rates);
    onAdd([{ ...makeLine({ kind: "custom", label: own.label.trim(), unitUah: uah, quantity: Number(own.qty) || 1, currency: own.cur, rates }) }]);
    setOwn({ label: "", price: "", cur: own.cur, qty: 1 });
  }

  const TABS = [["house", "🏠 Будинки"], ["service", "🛠 Послуги"], ["product", "🛒 Товари"], ["package", "📦 Пакети"], ["custom", "✏️ Свій рядок"]];
  return (
    <div className="modal-overlay open" style={{ zIndex: 1100 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg cart-picker">
        <div className="cart-picker__head">
          <h2 style={{ margin: 0 }}>Додати в замовлення</h2>
          <button type="button" className="btn primary" onClick={onClose}>Готово</button>
        </div>
        <div className="subtabs" style={{ marginBottom: 10 }}>
          {TABS.map(([k, l]) => <button key={k} type="button" className={`subtab${tab === k ? " active" : ""}`} onClick={() => { setTab(k); setFolder(""); setQ(""); }}>{l}</button>)}
        </div>
        {tab === "custom" ? (
          <div className="cart-own">
            <input value={own.label} onChange={(e) => setOwn({ ...own, label: e.target.value })} placeholder="Що саме (напр. вуличний диван)" autoFocus />
            <input inputMode="decimal" value={own.price} onChange={(e) => setOwn({ ...own, price: e.target.value })} placeholder="ціна за шт" style={{ width: 110 }} />
            <select value={own.cur} onChange={(e) => setOwn({ ...own, cur: e.target.value })} style={{ width: 70 }}>{CURS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <span>×</span>
            <input type="number" min="1" value={own.qty} onChange={(e) => setOwn({ ...own, qty: e.target.value })} style={{ width: 64 }} />
            <button type="button" className="btn primary" onClick={addOwn} disabled={!own.label.trim()}>+ Додати</button>
          </div>
        ) : (
          <>
            <div className="cart-picker__filters">
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук…" />
              {fl.length > 0 && <SelectSearch value={folder} options={treeOptions(fl, (f) => `📁 ${f.name}`)} onChange={setFolder} emptyLabel="Усі папки" placeholder="Усі папки" width={220} ariaLabel="Папка" />}
            </div>
            <div className="cart-picker__list">
              {rows.map((r) => {
                const n = added[`${tab}:${r.id}`];
                return (
                  <button key={r.id} type="button" className={`cart-pick${n ? " on" : ""}`} onClick={() => pick(r)}>
                    {r.image ? <span className="cart-pick__img" style={{ backgroundImage: `url(${r.image})` }} /> : null}
                    <span className="cart-pick__name"><b>{r.name}</b>{r.sub && <small>{r.sub}</small>}</span>
                    <span className="cart-pick__price">{r.uah != null ? money(r.uah) : tab === "package" ? "" : "ціна не вказана"}</span>
                    <span className="cart-pick__add">{n ? `✓ ${n}` : "+"}</span>
                  </button>
                );
              })}
              {!rows.length && <div className="empty">Нічого не знайдено{tab === "product" ? " — товари додаються в Каталог → Товари" : ""}.</div>}
            </div>
          </>
        )}
        <p className="note">Натискайте «+» скільки треба — позиції додаються в кошик, вікно лишається відкритим. Ціни підставляються у валюті, вибраній угорі ({currency}); у кошику їх можна змінити.</p>
      </div>
    </div>
  );
}

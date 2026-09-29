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
import { GearIcon } from "@/components/Icon";
import TreeCategoriesPanel from "@/components/panels/TreeCategoriesPanel";


function usePackageMath() {
  const { templates, bomItems, extraCosts, supplierPrices, services } = useAppData();
  return useMemo(() => {
    const unitPrice = (it) =>
      it.kind === "house" ? (() => { const t = templates.find((x) => x.id === it.template_id); return t && t.base_cost_per_m2 != null ? t.area_m2 * t.base_cost_per_m2 : 0; })()
      : it.kind === "service" ? (Number(services.find((x) => x.id === it.template_id)?.base_price) || 0)
      : Number(it.unit_price) || 0;
    const unitCost = (it) =>
      it.kind === "house" ? (templateProductionCost(it.template_id, bomItems, extraCosts, supplierPrices) || 0)
      : Number(it.unit_cost) || 0;
    function totals(pkg, items) {
      const price = items.reduce((s2, it) => s2 + unitPrice(it) * (Number(it.quantity) || 0), 0);
      const cost = items.reduce((s2, it) => s2 + unitCost(it) * (Number(it.quantity) || 0), 0);
      const final = pkg.price_override != null && pkg.price_override !== "" ? Number(pkg.price_override) : price * (1 + (Number(pkg.markup_percent) || 0) / 100);
      return { price, cost, final, margin: final - cost, pct: final ? ((final - cost) / final) * 100 : 0 };
    }
    return { unitPrice, unitCost, totals };
  }, [templates, bomItems, extraCosts, supplierPrices, services]);
}

// категорії пакетів деревом: [{value,label,depth}]
function catTree(cats) {
  const out = [];
  const walk = (pid, d) => cats.filter((c) => (c.parent_id || null) === pid).forEach((c) => { out.push({ value: c.id, label: c.name, depth: d }); walk(c.id, d + 1); });
  walk(null, 0);
  return out;
}

function CategoriesModal({ onClose }) {
  const { canWriteCatalog } = useAuth();
  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 720 }}>
        <TreeCategoriesPanel table="package_categories" title="Категорії пакетів" canWrite={canWriteCatalog} addPlaceholder="Нова категорія пакетів" />
        <div className="modal-actions"><button className="btn" onClick={onClose}>Готово</button></div>
      </div>
    </div>
  );
}

function PackageEditor({ pkg, items: initialItems, cats, onClose, onSaved, onCats }) {
  const { supabase, templates, services } = useAppData();
  const { canWriteCatalog } = useAuth();
  const m = usePackageMath();
  const [form, setForm] = useState({ name: pkg?.name || "", category_id: pkg?.category_id || "", description: pkg?.description || "", markup_percent: pkg?.markup_percent ?? "", price_override: pkg?.price_override ?? "", status: pkg?.status || "active" });
  const [items, setItems] = useState(() => (initialItems || []).map((x) => ({ ...x, key: x.id })));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const houseOpts = templates.filter((t) => t.status !== "archived").map((t) => ({ value: t.id, label: t.name, hint: t.area_m2 ? `${t.area_m2} м²` : "" }));
  const svcOpts = services.map((x) => ({ value: x.id, label: x.name, hint: x.base_price != null ? `${curr(x.base_price)} грн` : "" }));
  const t = m.totals(form, items);
  const setIt = (i, patch) => setItems((l) => l.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  async function save() {
    if (!form.name.trim()) { setErr("Вкажіть назву пакета"); return; }
    setBusy(true); setErr("");
    const payload = { name: form.name.trim(), category_id: form.category_id || null, description: form.description.trim() || null, status: form.status,
      markup_percent: form.markup_percent === "" ? null : Number(form.markup_percent), price_override: form.price_override === "" ? null : Number(form.price_override), updated_at: new Date().toISOString() };
    let id = pkg?.id;
    const r = id ? await supabase.from("packages").update(payload).eq("id", id) : await supabase.from("packages").insert(payload).select("id").single();
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
          <div className="form-row"><label>Категорія</label>
            <div style={{ display: "flex", gap: 6 }}>
              <SelectSearch value={form.category_id} options={catTree(cats)} onChange={(v) => setForm({ ...form, category_id: v })} placeholder="Категорія пакета" emptyLabel="— без категорії —" width="100%" />
              {canWriteCatalog && <button type="button" className="btn icon-btn-sq" title="Категорії пакетів" aria-label="Категорії пакетів" onClick={onCats}><GearIcon /></button>}
            </div></div>
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
                      <option value="house">🏠 Будинок</option><option value="service">🛠 Послуга</option><option value="custom">✎ Своє</option>
                    </select>
                    {it.kind === "house" && <SelectSearch value={it.template_id || ""} options={houseOpts} onChange={(v) => setIt(i, { template_id: v })} placeholder="Модель будинку" width={230} />}
                    {it.kind === "service" && <SelectSearch value={it.template_id || ""} options={svcOpts} onChange={(v) => setIt(i, { template_id: v })} placeholder="Послуга з каталогу" width={230} />}
                    {it.kind === "custom" && <>
                      <input value={it.label || ""} onChange={(e) => setIt(i, { label: e.target.value })} placeholder="Земля, комунікації, SPA…" style={{ width: 170 }} />
                      <input value={it.unit_price ?? ""} onChange={(e) => setIt(i, { unit_price: e.target.value })} inputMode="decimal" placeholder="ціна" style={{ width: 90 }} />
                    </>}
                  </td>
                  <td><input value={it.quantity} onChange={(e) => setIt(i, { quantity: e.target.value })} inputMode="decimal" style={{ width: 60 }} aria-label="Кількість" /></td>
                  <td style={{ textAlign: "right" }}>{curr(m.unitPrice(it))}</td>
                  <td style={{ textAlign: "right" }}>{it.kind === "house" ? curr(m.unitCost(it)) : <input value={it.unit_cost ?? ""} onChange={(e) => setIt(i, { unit_cost: e.target.value })} inputMode="decimal" placeholder="собів." style={{ width: 90 }} aria-label="Собівартість" />}</td>
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
  const m = usePackageMath();
  const [pkgs, setPkgs] = useState(null);
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState(null);
  const [catsOpen, setCatsOpen] = useState(false);

  async function load() {
    const [p, i, c] = await Promise.all([
      supabase.from("packages").select("*").order("sort").order("created_at"),
      supabase.from("package_items").select("*").order("sort"),
      supabase.from("package_categories").select("*").order("sort_order"),
    ]);
    setPkgs(p.data || []); setItems(i.data || []); setCats(c.data || []);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pkgs === null) return <div className="empty">Завантаження пакетів…</div>;
  const s = q.trim().toLowerCase();
  // категорія з усіма вкладеними
  const inCat = (id) => { if (!cat) return true; let x = cats.find((c) => c.id === id); while (x) { if (x.id === cat) return true; x = cats.find((c) => c.id === x.parent_id); } return false; };
  const list = pkgs.filter((p) => inCat(p.category_id) && (!s || [p.name, p.description].join(" ").toLowerCase().includes(s)));
  const catName = (id) => cats.find((c) => c.id === id)?.name || "без категорії";
  return (
    <div>
      <p className="note">Пакет — кілька будинків, послуги й інші позиції одним продуктом: котеджне містечко, база відпочинку, дохідна нерухомість, «будинок + фундамент + доставка + монтаж». Пакет додається в угоду CRM одним вибором.</p>
      <div className="toolbar">
        <SearchFilter value={q} onChange={setQ} placeholder="Пошук пакета…" active={cat ? 1 : 0} onReset={() => setCat("")}>
          <SelectSearch value={cat} options={catTree(cats)} onChange={setCat} placeholder="Усі категорії" emptyLabel="Усі категорії" width={220} ariaLabel="Категорія" />
        </SearchFilter>
        <div className="toolbar-actions">
          {canWriteCatalog && <button className="btn icon-btn-sq" title="Категорії пакетів" aria-label="Категорії пакетів" onClick={() => setCatsOpen(true)}><GearIcon /></button>}
          {canWriteCatalog && <button className="btn primary" onClick={() => setOpen({ pkg: null, items: [] })}>+ Пакет</button>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {list.map((p) => {
          const its = items.filter((x) => x.package_id === p.id);
          const t = m.totals(p, its);
          return (
            <div key={p.id} className="card" style={{ padding: 14, cursor: "pointer" }} onClick={() => setOpen({ pkg: p, items: its })}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{p.name}</b><span className="badge draft">{catName(p.category_id)}</span></div>
              {p.description && <div className="note" style={{ marginTop: 4 }}>{p.description}</div>}
              <div className="note" style={{ marginTop: 6 }}>{its.length} позицій · {its.filter((x) => x.kind === "house").reduce((a, x) => a + Number(x.quantity || 0), 0)} будинків</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ fontWeight: 700, color: "var(--accent)" }}>{curr(t.final)} грн</span>
                <span className="note" style={{ marginTop: 0, color: t.margin < 0 ? "var(--danger)" : "var(--success)" }}>маржа {t.pct.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}
        {!list.length && <div className="empty">Пакетів ще немає{canWriteCatalog ? " — натисніть «+ Пакет»" : ""}.</div>}
      </div>
      {open && <PackageEditor pkg={open.pkg} items={open.items} cats={cats} onCats={() => setCatsOpen(true)} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load(); }} />}
      {catsOpen && <CategoriesModal onClose={() => { setCatsOpen(false); load(); }} />}
    </div>
  );
}

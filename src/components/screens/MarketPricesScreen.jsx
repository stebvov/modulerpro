"use client";

// Ринкові ціни: що парсер знайшов на сайтах магазинів будматеріалів.
// Рядок — матеріал, колонка — магазин; у клітинці ціна магазину за одиницю матеріалу (вона ж лежить у «Цінах постачальників»).
// Розгорнутий рядок — усі знайдені товари: ціна «як продають» і перерахунок на м³ / м² / м.п.
import SettingsButton from "@/components/SettingsButton";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { daysAgo, isStale } from "@/lib/format";
import { getCategoryAndDescendantIds, flattenCategoryOrder } from "@/lib/categoryOrder";
import { attrChips, fmtPrice } from "@/lib/market";
import SearchFilter from "@/components/SearchFilter";
import { useColumns } from "@/lib/useColumns";
import ColHead, { ColReset } from "@/components/ColHead";
import CategoryTreeSelect from "@/components/CategoryTreeSelect";
import TrackRuleModal from "@/components/modals/TrackRuleModal";
import PriceSourcesModal from "@/components/modals/PriceSourcesModal";
import ManualPricesPanel from "@/components/panels/ManualPricesPanel";
import InfoTip from "@/components/InfoTip";
import StickyScroll from "@/components/StickyScroll";

const HIDDEN_KEY = "moduler_market_hidden_stores";
const OPEN_KEY = "moduler_market_stores_open";
const readLS = (k, d) => { try { const v = window.localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const writeLS = (k, v) => { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch { /* сховище недоступне */ } };

// Вибір магазинів, які показувати стовпцями таблиці (кілька)
function StoreColumnsPicker({ stores, hidden, onChange }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [open]);
  const shown = stores.filter((s) => !hidden.includes(s.id)).length;
  const flip = (id) => onChange(hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id]);
  return (
    <span ref={box} className="store-pick">
      <button type="button" className={`btn${shown < stores.length ? " active" : ""}`} onClick={() => setOpen((v) => !v)} title="Які магазини показувати стовпцями таблиці">
        🏪 Магазини: {shown === stores.length ? "усі" : `${shown} з ${stores.length}`} ▾
      </button>
      {open && (
        <div className="store-pick__pop">
          <div className="store-pick__row">
            <button type="button" className="btn small" onClick={() => onChange([])}>Усі</button>
            <button type="button" className="btn small" onClick={() => onChange(stores.map((s) => s.id))}>Жодного</button>
          </div>
          {stores.map((s) => (
            <label key={s.id} className="store-pick__item">
              <input type="checkbox" checked={!hidden.includes(s.id)} onChange={() => flip(s.id)} /> {s.name}
            </label>
          ))}
        </div>
      )}
    </span>
  );
}

const dateTime = (ts) => (ts ? new Date(ts).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const dateOnly = (ts) => (ts ? new Date(ts).toLocaleDateString("uk-UA") : "—");
// «Оновлено» у фільтрі стовпчика — групами, а не кожна дата окремо
const ageGroup = (d) => (d <= 0 ? "сьогодні" : d <= 7 ? "до 7 днів" : d <= 30 ? "до 30 днів" : "понад 30 днів");
const ago = (ts) => {
  const d = daysAgo(ts);
  return d <= 0 ? "сьогодні" : d === 1 ? "вчора" : `${d} дн. тому`;
};

export default function MarketPricesScreen() {
  const { supabase, materials, materialCategories, suppliers, supplierPrices, reload } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [onlyTracked, setOnlyTracked] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [offers, setOffers] = useState({}); // material_id → рядки market_offers
  const [storeFilter, setStoreFilter] = useState("");
  const [showGone, setShowGone] = useState(false);
  const [sources, setSources] = useState([]);
  const [lastRun, setLastRun] = useState(null);
  const [notReady, setNotReady] = useState(false);
  const [ruleFor, setRuleFor] = useState(undefined); // undefined — закрито, null — нова позиція
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sold, setSold] = useState(new Map()); // магазин|матеріал → пропозиції: щоб показати, як саме продають і куди клацнути
  const [running, setRunning] = useState({}); // parser_key → іде оновлення
  const [runNotes, setRunNotes] = useState([]);
  const [hiddenStores, setHiddenStores] = useState([]); // магазини, сховані з таблиці (запамʼятовується в браузері)
  const [storesOpen, setStoresOpen] = useState(false); // блок магазинів розгорнуто
  const [schedule, setSchedule] = useState(null); // як часто система сама обходить сайти

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHiddenStores(readLS(HIDDEN_KEY, []));
    setStoresOpen(readLS(OPEN_KEY, false));
  }, []);
  const chooseHidden = (ids) => { setHiddenStores(ids); writeLS(HIDDEN_KEY, ids); };
  const toggleStores = () => { setStoresOpen((v) => { writeLS(OPEN_KEY, !v); return !v; }); };

  const stores = useMemo(() => suppliers.filter((s) => s.parser_key).sort((a, b) => Number(b.parser_enabled) - Number(a.parser_enabled) || a.name.localeCompare(b.name, "uk")), [suppliers]);
  const activeStores = stores.filter((s) => s.parser_enabled);
  // колонки: магазини, які обходить парсер, і ті, де вже є ціни — надіслані з браузера чи внесені вручну
  const allColumnStores = stores.filter((s) => s.parser_enabled || supplierPrices.some((p) => p.supplier_id === s.id));
  const columnStores = allColumnStores.filter((s) => !hiddenStores.includes(s.id));
  const groups = useMemo(() => [...new Set(sources.map((s) => s.grp))].sort(), [sources]);

  const loadMeta = useCallback(async () => {
    const [src, run, sch] = await Promise.all([
      supabase.from("price_sources").select("*"),
      supabase.from("price_parser_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("price_parser_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    setSchedule(sch.data || null);
    if (src.error) return setNotReady(true);
    setSources(src.data || []);
    setLastRun(run.data || null);
  }, [supabase]);

  const loadSold = useCallback(async () => {
    const map = new Map();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("market_offers")
        .select("supplier_id,material_id,url,title,price,sale_unit,unit_price")
        .eq("active", true).eq("excluded", false).not("unit_price", "is", null).range(from, from + 999);
      if (error || !data) break;
      for (const o of data) {
        const k = `${o.supplier_id}|${o.material_id}`;
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(o);
      }
      if (data.length < 1000) break;
    }
    setSold(map);
  }, [supabase]);

  useEffect(() => {
    // Initial fetch of parser sources and the last run on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMeta();
    loadSold();
  }, [loadMeta, loadSold]);

  const loadOffers = useCallback(async (materialId) => {
    const { data } = await supabase.from("market_offers").select("*").eq("material_id", materialId).order("unit_price", { ascending: true, nullsFirst: false }).limit(1000);
    setOffers((p) => ({ ...p, [materialId]: data || [] }));
  }, [supabase]);

  function toggle(materialId) {
    if (openId === materialId) return setOpenId(null);
    setOpenId(materialId);
    loadOffers(materialId);
  }

  async function setExcluded(offer, excluded) {
    setBusy(true);
    await supabase.from("market_offers").update({ excluded }).eq("id", offer.id);
    await Promise.all([loadOffers(offer.material_id), reload(true), loadSold()]);
    setBusy(false);
  }

  // Оновити ціни зараз: сервер обходить сайт магазину (1–4 хв на магазин) і пише в базу
  async function refresh(list) {
    setRunNotes([]);
    setRunning((p) => ({ ...p, ...Object.fromEntries(list.map((s) => [s.parser_key, true])) }));
    await Promise.all(list.map(async (s) => {
      let note = null;
      try {
        const res = await fetch("/api/price-parser/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site: s.parser_key }) });
        const json = await res.json().catch(() => ({}));
        const r = json.results?.[0];
        if (res.status === 504) note = "сервер не встиг обійти сайт за відведений час — спробуй ще раз";
        else if (!res.ok || !r) note = json.error || `помилка ${res.status}`;
        else if (r.error) note = r.error;
      } catch (e) {
        note = e.message;
      }
      if (note) setRunNotes((p) => [...p, `${s.name}: ${note}`]);
      setRunning((p) => ({ ...p, [s.parser_key]: false }));
      await reload(true);
    }));
    await Promise.all([loadMeta(), loadSold()]);
    setOffers({});
    if (openId) loadOffers(openId);
  }
  const anyRunning = Object.values(running).some(Boolean);
  async function setInterval_(days) {
    const { data, error } = await supabase.from("price_parser_settings").update({ interval_days: days, updated_at: new Date().toISOString() }).eq("id", 1).select().maybeSingle();
    if (!error && data) setSchedule(data);
  }
  const nextRun = schedule && schedule.interval_days > 0 && schedule.last_auto_run
    ? new Date(new Date(schedule.last_auto_run).getTime() + schedule.interval_days * 864e5)
    : null;

  const catOrder = flattenCategoryOrder(materialCategories);
  const allowedCategoryIds = categoryFilter ? getCategoryAndDescendantIds(categoryFilter, materialCategories) : null;
  const storeIds = new Set(stores.map((s) => s.id));
  const list = materials
    .filter(
      (m) =>
        (!onlyTracked || m.parse_rule || m.spec) &&
        (!search || m.name.toLowerCase().includes(search.toLowerCase())) &&
        (!allowedCategoryIds || allowedCategoryIds.includes(m.category_id))
    )
    .sort((a, b) => (catOrder.get(a.category_id) ?? 999999) - (catOrder.get(b.category_id) ?? 999999) || a.name.localeCompare(b.name, "uk", { numeric: true }));

  // пропозиція, з якої взято ціну магазину (найближча за ціною одиниці), і посилання на товар; для ручних цін — посилання з примітки
  const offerOf = (p) => (sold.get(`${p.supplier_id}|${p.material_id}`) || []).reduce((a, o) => (!a || Math.abs(o.unit_price - p.price) < Math.abs(a.unit_price - p.price) ? o : a), null);
  const linkOf = (p, offer) => offer?.url || /https?:\/\/\S+/.exec(p.note || "")?.[0] || null;
  const priceOf = (materialId, supplierId) => supplierPrices.find((p) => p.material_id === materialId && p.supplier_id === supplierId);
  // сортування й фільтр стовпчиків головної таблиці (рядок — матеріал); у стовпчику магазину сортуємо за його ціною
  const pricesOf = (m) => supplierPrices.filter((p) => p.material_id === m.id);
  const bestOf = (m) => { const f = pricesOf(m); return f.length ? Math.min(...f.map((p) => Number(p.price))) : null; };
  const freshOf = (m) => { const f = pricesOf(m); return f.length ? f.map((p) => p.updated_at).sort().pop() : null; };
  const t = useColumns(list, {
    name: { value: (m) => m.name },
    unit: { value: (m) => m.unit },
    best: { value: (m) => { const b = bestOf(m); return b == null ? "" : suppliers.find((s) => s.id === pricesOf(m).find((p) => Number(p.price) === b).supplier_id)?.name || ""; }, sort: bestOf },
    updated: { value: (m) => { const f = freshOf(m); return f ? ageGroup(daysAgo(f)) : ""; }, sort: (m) => { const f = freshOf(m); return f ? daysAgo(f) : null; } },
    ...Object.fromEntries(columnStores.map((s) => [`s:${s.id}`, { value: (m) => (priceOf(m.id, s.id) ? "є ціна" : ""), sort: (m) => { const p = priceOf(m.id, s.id); return p ? Number(p.price) : null; } }])),
  });
  // знайдені товари відкритого матеріалу — своя пара сортування / фільтрів
  const openRows = (offers[openId] || []).filter((o) => (!storeFilter || o.supplier_id === storeFilter) && (showGone || o.active));
  const ot = useColumns(openRows, {
    store: { value: (o) => stores.find((s) => s.id === o.supplier_id)?.name },
    title: { value: (o) => o.brand || "", sort: (o) => o.title },
    attrs: { value: (o) => attrChips(o.attrs) },
    price: { value: (o) => o.sale_unit || "?", sort: (o) => Number(o.price) },
    unit: { value: (o) => (o.unit_price != null ? "перераховано" : "не перерахувати"), sort: (o) => (o.unit_price != null ? Number(o.unit_price) : null) },
    other: { value: (o) => Object.keys(o.unit_prices || {}).filter((u) => u !== o.sale_unit) },
    stock: { value: (o) => (!o.active ? "зник із сайту" : o.in_stock === false ? "немає" : o.in_stock ? "є" : "—") },
    seen: { value: (o) => dateOnly(o.last_seen_at), sort: (o) => o.last_seen_at },
  });
  const badOf = (s) => (!s.parser_enabled ? !s.parsed_at || daysAgo(s.parsed_at) > 30 : (s.parse_status && s.parse_status !== "ok") || (s.parsed_at && daysAgo(s.parsed_at) > 2));
  const tracked = materials.filter((m) => m.parse_rule).length;
  const withPrice = materials.filter((m) => m.parse_rule && supplierPrices.some((p) => p.material_id === m.id && storeIds.has(p.supplier_id))).length;

  if (notReady || !stores.length) {
    return <div className="empty">Парсер цін ще не підключено до бази: немає магазинів із сайтами. Після підключення тут зʼявляться ціни з сайтів будматеріалів.</div>;
  }

  const cols = 4 + columnStores.length;

  return (
    <div>
      <div className="market-stores">
        <button type="button" className="market-stores__head" onClick={toggleStores} aria-expanded={storesOpen}>
          <span>{storesOpen ? "▾" : "▸"}</span>
          <b>Магазини · {stores.length}</b>
          <span className="note" style={{ margin: 0 }}>
            {stores.filter((s) => !badOf(s)).length} свіжих{stores.some(badOf) ? ` · ${stores.filter(badOf).length} застарілих` : ""}
            {anyRunning ? " · оновлюється…" : ""}
            {" · "}у відстеженні {tracked}, з цінами {withPrice}
            {lastRun ? ` · обхід ${dateTime(lastRun.finished_at || lastRun.started_at)}` : ""}
          </span>
        </button>
        {storesOpen && schedule && (
          <div className="market-sched">
            <span>Автоматичний обхід сайтів:</span>
            <select value={schedule.interval_days} disabled={!canWriteCatalog} onChange={(e) => setInterval_(Number(e.target.value))} aria-label="Як часто оновлювати ціни">
              {[[1, "щодня"], [2, "раз на 2 дні"], [3, "раз на 3 дні"], [7, "раз на тиждень"], [14, "раз на 2 тижні"], [30, "раз на місяць"], [0, "вимкнено — лише вручну"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <span className="note" style={{ margin: 0 }}>{nextRun ? `наступний — ${nextRun.toLocaleDateString("uk-UA")} о 06:20` : "оновлюйте кнопкою ↻"}</span>
          </div>
        )}
        {storesOpen && (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {stores.map((s) => {
          // магазин «з браузера»: програм сайт не пускає, сторінки надсилає людина — свіжим вважаємо місяць
          const byHand = !s.parser_enabled;
          const bad = badOf(s);
          const isRunning = running[s.parser_key];
          return (
            <span key={s.id} className="tag-check" style={{ cursor: "default" }}
              title={byHand ? "Сайт не пускає програми. Ціни — зі сторінок, надісланих кнопкою «З браузера», або внесені вручну в «Цінах постачальників»" : s.parser_local ? "Сайт не пускає запити із сервера — ціни оновлюються лише з комп'ютера в Україні" : s.parse_status && s.parse_status !== "ok" ? s.parse_status : undefined}>
              <span className={bad ? "stale" : "fresh"}>●</span>
              <a href={s.website} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{s.name}</a>
              <span className="note" style={{ marginTop: 0 }}>
                {isRunning ? "оновлюється…" : byHand ? (s.parsed_at ? `з браузера · ${ago(s.parsed_at)}` : "вручну") : `${s.parser_local ? "з комп'ютера · " : ""}${s.parsed_at ? ago(s.parsed_at) : "ще не обходили"}`}
              </span>
              {canWriteCatalog && s.parser_enabled && !s.parser_local && (
                <button className="btn small" disabled={isRunning} title="Оновити ціни цього магазину зараз" onClick={() => refresh([s])}>↻</button>
              )}
            </span>
          );
        })}
      </div>
        )}
      </div>
      {runNotes.map((n) => <div key={n} className="note stale" style={{ margin: "-6px 0 10px" }}>{n}</div>)}

      <div className="toolbar">
        <div className="toolbar-left">
          <SearchFilter value={search} onChange={setSearch} placeholder="Пошук матеріалу..." active={(onlyTracked ? 0 : 1) + (categoryFilter ? 1 : 0)} onReset={() => { setOnlyTracked(true); setCategoryFilter(""); }}>
            <CategoryTreeSelect value={categoryFilter} categories={materialCategories} onChange={setCategoryFilter} />
            <label className="tag-check"><input type="checkbox" checked={!onlyTracked} onChange={(e) => setOnlyTracked(!e.target.checked)} /> показати весь довідник матеріалів</label>
          </SearchFilter>
          <StoreColumnsPicker stores={allColumnStores} hidden={hiddenStores} onChange={chooseHidden} />
          <InfoTip label="Як читати" text="Система сама обходить сайти магазинів (як часто — у блоці «Магазини») і бере ціни на позиції зі списку. Рядок — матеріал, стовпець — магазин; у клітинці ціна магазину за одиницю матеріалу (зелена — найнижча), під нею — як продають. «Найкраща» — найнижча ціна серед усіх постачальників. Клік на рядок — усі знайдені товари з ціною «як продають»; «Не той товар» прибирає його з розрахунку. Кнопка «Магазини» — обрати, які магазини показувати стовпцями." />
        </div>
        <div className="toolbar-actions">
          <ColReset t={t} />
          {canWriteCatalog && (
            <button className="btn" disabled={anyRunning} onClick={() => refresh(activeStores.filter((s) => !s.parser_local))} title="Обійти сайти магазинів зараз — кілька хвилин">
              {anyRunning ? "Оновлюється…" : "↻ Оновити ціни"}
            </button>
          )}
          <a className="btn" href="/capture" target="_blank" rel="noopener noreferrer" title="Магазини, чиї сайти не пускають програми: надіслати відкриту сторінку зі свого браузера">⇪ З браузера</a>
          <SettingsButton title="Джерела: сторінки магазинів, які обходить парсер" onClick={() => setSourcesOpen(true)} />
          {canWriteCatalog && <button className="btn primary" onClick={() => setRuleFor(null)}>+ Позиція</button>}
        </div>
      </div>

      <StickyScroll>
        <table className="dense market-table">
          <thead>
            <tr>
              <ColHead t={t} k="name">Матеріал</ColHead>
              <ColHead t={t} k="unit">Од.</ColHead>
              <ColHead t={t} k="best"><span title="Найкраща (найнижча) ціна за одиницю матеріалу серед усіх постачальників">Найкраща</span></ColHead>
              {columnStores.map((s) => <ColHead t={t} k={`s:${s.id}`} key={s.id}>{s.name}</ColHead>)}
              <ColHead t={t} k="updated">Оновлено</ColHead>
            </tr>
          </thead>
          <tbody>
            {!t.rows.length && <tr><td colSpan={cols} className="empty">Нічого не знайдено</td></tr>}
            {t.rows.map((m, idx) => {
              const cells = columnStores.map((s) => priceOf(m.id, s.id));
              // найкраща — серед усіх постачальників, зокрема з ціною, внесеною вручну (вікна, двері)
              const found = supplierPrices.filter((p) => p.material_id === m.id);
              const best = found.length ? Math.min(...found.map((p) => Number(p.price))) : null;
              const bestStore = best != null ? suppliers.find((s) => s.id === found.find((p) => Number(p.price) === best).supplier_id) : null;
              const freshest = found.length ? found.map((p) => p.updated_at).sort().pop() : null;
              const bestPrice = best != null ? found.find((p) => Number(p.price) === best) : null;
              const bestOffer = bestPrice && offerOf(bestPrice);
              const bestLink = bestPrice && linkOf(bestPrice, bestOffer);
              const cat = materialCategories.find((c) => c.id === m.category_id);
              const header = !t.sorted && cat && t.rows[idx - 1]?.category_id !== cat.id; // при сортуванні стовпчика групи категорій не показуємо
              const isOpen = openId === m.id;
              const rows = (offers[m.id] || []).filter((o) => (!storeFilter || o.supplier_id === storeFilter) && (showGone || o.active));
              return (
                <Fragment key={m.id}>
                  {header && (
                    <tr><td colSpan={cols} style={{ background: "var(--accent-bg)", fontWeight: 600, fontSize: 12 }}><span className="sticky-left">{cat.icon ? `${cat.icon} ` : ""}{cat.name}</span></td></tr>
                  )}
                  <tr style={{ cursor: "pointer" }} title="Клік — показати знайдені товари" onClick={(e) => { if (!e.target.closest("a,button,.btn")) toggle(m.id); }}>
                    <td>
                      {isOpen ? "▾" : "▸"} {m.icon ? `${m.icon} ` : ""}{m.name}
                      <InfoTip text={m.spec} image={m.image_url} />
                      {!m.parse_rule && <span className="badge draft" style={{ marginLeft: 6 }}>ціна вручну</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{m.unit}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {bestPrice ? (
                        <>
                          {bestLink ? <a href={bestLink} target="_blank" rel="noreferrer" title={bestOffer?.title || "Відкрити товар на сайті"}><b>{fmtPrice(best)}</b></a> : <b>{fmtPrice(best)}</b>}
                          <span className="note"> /{m.unit}</span>
                          <span className="sub-clip" style={{ maxWidth: 120 }} title={`${bestStore?.name || ""}${bestOffer ? ` · продають по ${fmtPrice(bestOffer.price)} грн/${bestOffer.sale_unit || "шт"}` : ""}`}>{bestStore?.name}</span>
                        </>
                      ) : "—"}
                    </td>
                    {cells.map((p, i) => {
                      const o = p && offerOf(p);
                      const href = p && linkOf(p, o);
                      const value = p && (Number(p.price) === best ? <b className="fresh">{fmtPrice(p.price)}</b> : fmtPrice(p.price));
                      return (
                        <td key={columnStores[i].id} style={{ whiteSpace: "nowrap" }} className={p && isStale(p.updated_at) ? "stale" : undefined}
                          title={p ? `${o?.title || p.note || ""}\nоновлено ${dateOnly(p.updated_at)}` : undefined}>
                          {p ? (
                            <>
                              {href ? <a href={href} target="_blank" rel="noreferrer">{value}</a> : value}
                              <span className="note"> /{m.unit}</span>
                              {o && <div className="note" style={{ marginTop: 0 }}>{fmtPrice(o.price)} грн/{o.sale_unit || "шт"}</div>}
                            </>
                          ) : <span className="note">—</span>}
                        </td>
                      );
                    })}
                    <td style={{ whiteSpace: "nowrap" }} className={freshest && isStale(freshest) ? "stale" : undefined}>
                      {freshest ? dateOnly(freshest) : "—"}{" "}
                      {canWriteCatalog && (
                        <SettingsButton title="Правило відстеження" onClick={() => setRuleFor(m)} />
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={cols} style={{ background: "var(--bg, #faf9f5)", padding: 12 }}>
                        <div className="sticky-view">
                        <div className="seg-row" style={{ marginBottom: 8 }}>
                          <button className={`seg-btn${!storeFilter ? " active" : ""}`} onClick={() => setStoreFilter("")}>Усі магазини</button>
                          {allColumnStores.filter((s) => (offers[m.id] || []).some((o) => o.supplier_id === s.id)).map((s) => (
                            <button key={s.id} className={`seg-btn${storeFilter === s.id ? " active" : ""}`} onClick={() => setStoreFilter(s.id)}>{s.name}</button>
                          ))}
                          <label className="tag-check" style={{ marginLeft: "auto" }}>
                            <input type="checkbox" checked={showGone} onChange={(e) => setShowGone(e.target.checked)} /> зниклі з сайту
                          </label>
                        </div>
                        {!offers[m.id] ? (
                          <div className="empty">Завантаження…</div>
                        ) : !rows.length ? (
                          <div className="empty">
                            {m.parse_rule ? "У магазинах зі списку парсер цього товару не знайшов." : "Цей матеріал парсер не шукає — ціну вносять вручну."}
                          </div>
                        ) : (
                          <table>
                            <thead>
                              <tr><ColHead t={ot} k="store">Магазин</ColHead><ColHead t={ot} k="title">Товар</ColHead><ColHead t={ot} k="attrs">Характеристики</ColHead><ColHead t={ot} k="price">Як продають, грн</ColHead><ColHead t={ot} k="unit">За {m.unit}, грн</ColHead><ColHead t={ot} k="other" noSort>Інші одиниці</ColHead><ColHead t={ot} k="stock">Наявність</ColHead><ColHead t={ot} k="seen">Бачили</ColHead><th>{(ot.active > 0 || ot.sorted) && <ColReset t={ot} />}</th></tr>
                            </thead>
                            <tbody>
                              {!ot.rows.length && <tr><td colSpan={9} className="empty">За фільтром стовпчиків нічого не знайдено</td></tr>}
                              {ot.rows.map((o) => {
                                const store = stores.find((s) => s.id === o.supplier_id);
                                const other = Object.entries(o.unit_prices || {}).filter(([u]) => u !== m.unit && u !== o.sale_unit);
                                const dim = o.excluded || !o.active;
                                return (
                                  <tr key={o.id} style={dim ? { opacity: 0.5 } : undefined}>
                                    <td>{store?.name || "—"}</td>
                                    <td style={{ maxWidth: 380 }}><a href={o.url} target="_blank" rel="noreferrer">{o.title}</a>{o.brand ? <span className="note"> · {o.brand}</span> : null}</td>
                                    <td>{attrChips(o.attrs).map((c) => <span className="tag" key={c}>{c}</span>)}</td>
                                    <td style={{ whiteSpace: "nowrap" }}>
                                      {fmtPrice(o.price)} <span className="note">/ {o.sale_unit || "?"}</span>
                                      {o.prev_price != null && Number(o.prev_price) !== Number(o.price) && (
                                        <div className="note" title={`ціна змінилась ${dateOnly(o.price_changed_at)}`}>було {fmtPrice(o.prev_price)}</div>
                                      )}
                                    </td>
                                    <td style={{ whiteSpace: "nowrap" }}>{o.unit_price != null ? <b>{fmtPrice(o.unit_price)}</b> : <span className="stale" title="У назві товару бракує розмірів або одиниці продажу">не перерахувати</span>}</td>
                                    <td className="note" style={{ whiteSpace: "nowrap" }}>{other.map(([u, v]) => <div key={u}>{fmtPrice(v)} / {u}</div>)}</td>
                                    <td className={o.in_stock === false ? "stale" : "fresh"}>{!o.active ? "зник із сайту" : o.in_stock === false ? "немає" : o.in_stock ? "є" : "—"}</td>
                                    <td style={{ whiteSpace: "nowrap" }}>{dateOnly(o.last_seen_at)}</td>
                                    <td>
                                      {canWriteCatalog && (
                                        <button className="btn small" disabled={busy} onClick={() => setExcluded(o, !o.excluded)}
                                          title={o.excluded ? "Повернути в розрахунок ціни магазину" : "Не той товар — прибрати з розрахунку ціни магазину"}>
                                          {o.excluded ? "Повернути" : "Не той товар"}
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                        <ManualPricesPanel material={m} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </StickyScroll>

      <TrackRuleModal open={ruleFor !== undefined} material={ruleFor || null} groups={groups} onClose={() => setRuleFor(undefined)} onSaved={() => setRuleFor(undefined)} />
      <PriceSourcesModal open={sourcesOpen} sources={sources} stores={stores} canWrite={canWriteCatalog} onClose={() => setSourcesOpen(false)} onChanged={loadMeta} />
    </div>
  );
}

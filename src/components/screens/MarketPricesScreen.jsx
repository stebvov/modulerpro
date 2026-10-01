"use client";

// Ринкові ціни: що парсер знайшов на сайтах магазинів будматеріалів.
// Рядок — матеріал, колонка — магазин; у клітинці ціна магазину за одиницю матеріалу (вона ж лежить у «Цінах постачальників»).
// Розгорнутий рядок — усі знайдені товари: ціна «як продають» і перерахунок на м³ / м² / м.п.
import SettingsButton from "@/components/SettingsButton";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { daysAgo, isStale } from "@/lib/format";
import { getCategoryAndDescendantIds, flattenCategoryOrder } from "@/lib/categoryOrder";
import { attrChips, fmtPrice } from "@/lib/market";
import SearchFilter from "@/components/SearchFilter";
import CategoryTreeSelect from "@/components/CategoryTreeSelect";
import TrackRuleModal from "@/components/modals/TrackRuleModal";
import PriceSourcesModal from "@/components/modals/PriceSourcesModal";
import ManualPricesPanel from "@/components/panels/ManualPricesPanel";

const dateTime = (ts) => (ts ? new Date(ts).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const dateOnly = (ts) => (ts ? new Date(ts).toLocaleDateString("uk-UA") : "—");
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
  const [running, setRunning] = useState({}); // parser_key → іде оновлення
  const [runNotes, setRunNotes] = useState([]);

  const stores = useMemo(() => suppliers.filter((s) => s.parser_key).sort((a, b) => Number(b.parser_enabled) - Number(a.parser_enabled) || a.name.localeCompare(b.name, "uk")), [suppliers]);
  const activeStores = stores.filter((s) => s.parser_enabled);
  // колонки: магазини, які обходить парсер, і ті, де вже є ціни — надіслані з браузера чи внесені вручну
  const columnStores = stores.filter((s) => s.parser_enabled || supplierPrices.some((p) => p.supplier_id === s.id));
  const groups = useMemo(() => [...new Set(sources.map((s) => s.grp))].sort(), [sources]);

  const loadMeta = useCallback(async () => {
    const [src, run] = await Promise.all([
      supabase.from("price_sources").select("*"),
      supabase.from("price_parser_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (src.error) return setNotReady(true);
    setSources(src.data || []);
    setLastRun(run.data || null);
  }, [supabase]);

  useEffect(() => {
    // Initial fetch of parser sources and the last run on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMeta();
  }, [loadMeta]);

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
    await Promise.all([loadOffers(offer.material_id), reload(true)]);
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
    await loadMeta();
    setOffers({});
    if (openId) loadOffers(openId);
  }
  const anyRunning = Object.values(running).some(Boolean);

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

  const priceOf = (materialId, supplierId) => supplierPrices.find((p) => p.material_id === materialId && p.supplier_id === supplierId);
  const tracked = materials.filter((m) => m.parse_rule).length;
  const withPrice = materials.filter((m) => m.parse_rule && supplierPrices.some((p) => p.material_id === m.id && storeIds.has(p.supplier_id))).length;

  if (notReady || !stores.length) {
    return <div className="empty">Парсер цін ще не підключено до бази: немає магазинів із сайтами. Після підключення тут зʼявляться ціни з сайтів будматеріалів.</div>;
  }

  const cols = 4 + columnStores.length;

  return (
    <div>
      <p className="note" style={{ marginTop: 0 }}>
        Раз на день система обходить сайти магазинів і бере ціни на позиції зі списку. У клітинці — ціна магазину за одиницю матеріалу; клік на рядок покаже всі знайдені товари з ціною «як продають».
      </p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {stores.map((s) => {
          // магазин «з браузера»: програм сайт не пускає, сторінки надсилає людина — свіжим вважаємо місяць
          const byHand = !s.parser_enabled;
          const bad = byHand ? !s.parsed_at || daysAgo(s.parsed_at) > 30 : (s.parse_status && s.parse_status !== "ok") || (s.parsed_at && daysAgo(s.parsed_at) > 2);
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
      {runNotes.map((n) => <div key={n} className="note stale" style={{ margin: "-6px 0 10px" }}>{n}</div>)}

      <div className="toolbar">
        <div className="toolbar-left">
          <CategoryTreeSelect value={categoryFilter} categories={materialCategories} onChange={setCategoryFilter} />
          <SearchFilter value={search} onChange={setSearch} placeholder="Пошук матеріалу..." active={onlyTracked ? 0 : 1} onReset={() => setOnlyTracked(true)}>
            <label className="tag-check"><input type="checkbox" checked={!onlyTracked} onChange={(e) => setOnlyTracked(!e.target.checked)} /> показати весь довідник матеріалів</label>
          </SearchFilter>
        </div>
        <div className="toolbar-actions">
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

      <p className="note">
        Позицій у відстеженні: {tracked}, з цінами — {withPrice}.
        {lastRun && <> Останній обхід: {dateTime(lastRun.finished_at || lastRun.started_at)}.</>}
      </p>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Матеріал</th>
              <th>Од.</th>
              <th>Найкраща ціна, грн</th>
              {columnStores.map((s) => <th key={s.id}>{s.name}</th>)}
              <th>Оновлено</th>
            </tr>
          </thead>
          <tbody>
            {!list.length && <tr><td colSpan={cols} className="empty">Нічого не знайдено</td></tr>}
            {list.map((m, idx) => {
              const cells = columnStores.map((s) => priceOf(m.id, s.id));
              // найкраща — серед усіх постачальників, зокрема з ціною, внесеною вручну (вікна, двері)
              const found = supplierPrices.filter((p) => p.material_id === m.id);
              const best = found.length ? Math.min(...found.map((p) => Number(p.price))) : null;
              const bestStore = best != null ? suppliers.find((s) => s.id === found.find((p) => Number(p.price) === best).supplier_id) : null;
              const freshest = found.length ? found.map((p) => p.updated_at).sort().pop() : null;
              const cat = materialCategories.find((c) => c.id === m.category_id);
              const header = cat && list[idx - 1]?.category_id !== cat.id;
              const isOpen = openId === m.id;
              const rows = (offers[m.id] || []).filter((o) => (!storeFilter || o.supplier_id === storeFilter) && (showGone || o.active));
              return (
                <Fragment key={m.id}>
                  {header && (
                    <tr><td colSpan={cols} style={{ background: "var(--accent-bg)", fontWeight: 600, fontSize: 12 }}>{cat.icon ? `${cat.icon} ` : ""}{cat.name}</td></tr>
                  )}
                  <tr style={{ cursor: "pointer" }} title="Клік — показати знайдені товари" onClick={(e) => { if (!e.target.closest("a,button,.btn")) toggle(m.id); }}>
                    <td>
                      {isOpen ? "▾" : "▸"} {m.icon ? `${m.icon} ` : ""}{m.name}
                      {!m.parse_rule && <span className="badge draft" style={{ marginLeft: 6 }}>ціна вручну</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{m.unit}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {best != null ? <><b>{fmtPrice(best)}</b> <span className="note">{bestStore?.name}</span></> : "—"}
                    </td>
                    {cells.map((p, i) => (
                      <td key={columnStores[i].id} style={{ whiteSpace: "nowrap" }} className={p && isStale(p.updated_at) ? "stale" : undefined}
                        title={p ? `${p.note || ""}\nоновлено ${dateOnly(p.updated_at)}` : undefined}>
                        {p ? (Number(p.price) === best ? <b className="fresh">{fmtPrice(p.price)}</b> : fmtPrice(p.price)) : <span className="note">—</span>}
                      </td>
                    ))}
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
                        {m.spec && <p className="note" style={{ marginTop: 0 }}>{m.spec}</p>}
                        <div className="seg-row" style={{ marginBottom: 8 }}>
                          <button className={`seg-btn${!storeFilter ? " active" : ""}`} onClick={() => setStoreFilter("")}>Усі магазини</button>
                          {columnStores.filter((s) => (offers[m.id] || []).some((o) => o.supplier_id === s.id)).map((s) => (
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
                              <tr><th>Магазин</th><th>Товар</th><th>Характеристики</th><th>Як продають, грн</th><th>За {m.unit}, грн</th><th>Інші одиниці</th><th>Наявність</th><th>Бачили</th><th></th></tr>
                            </thead>
                            <tbody>
                              {rows.map((o) => {
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
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <TrackRuleModal open={ruleFor !== undefined} material={ruleFor || null} groups={groups} onClose={() => setRuleFor(undefined)} onSaved={() => setRuleFor(undefined)} />
      <PriceSourcesModal open={sourcesOpen} sources={sources} stores={stores} canWrite={canWriteCatalog} onClose={() => setSourcesOpen(false)} onChanged={loadMeta} />
    </div>
  );
}

"use client";

// Розцінки на роботи: ринкові ціни з rabotniki.ua (мін / середня / макс за кожен вид робіт — по Україні й по містах)
// і кошторис робіт на будинок: скільки ті самі роботи коштують на ринку, за нашими ставками, акордом і на зарплаті.
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import SearchFilter from "@/components/SearchFilter";

const n = (v, d = 0) => (v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toLocaleString("uk-UA", { maximumFractionDigits: d }));
const key = (r) => `${r.category}|${r.work}`;
const numOrNull = (v) => (v === "" || v == null || Number.isNaN(Number(String(v).replace(",", "."))) ? null : Number(String(v).replace(",", ".")));

// усі рядки таблиці, по 1000 за запит
async function fetchAll(query) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query().range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}

export default function WorkRatesScreen() {
  const supabase = useMemo(() => createClient(), []);
  const { role } = useAuth();
  const canEstimate = ["admin", "manager", "accountant"].includes(role);
  const [view, setView] = useState("rates");
  const [cities, setCities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [city, setCity] = useState("");
  const [ratesByCity, setRatesByCity] = useState({}); // місто → рядки work_rates
  const [stage, setStage] = useState("");
  const [search, setSearch] = useState("");
  const [estimates, setEstimates] = useState([]);
  const [estimateId, setEstimateId] = useState("");
  const [lines, setLines] = useState([]);
  const [byCity, setByCity] = useState(null); // порівняння міст для кошторису
  const [error, setError] = useState("");

  const loadRates = useCallback(async (slug) => {
    try {
      const rows = await fetchAll(() => supabase.from("work_rates").select("*").eq("city", slug).order("category").order("name"));
      setRatesByCity((p) => ({ ...p, [slug]: rows }));
    } catch (e) {
      setError(e.message);
    }
  }, [supabase]);

  const loadEstimates = useCallback(async () => {
    const { data } = await supabase.from("work_estimates").select("*").order("created_at");
    setEstimates(data || []);
    return data || [];
  }, [supabase]);

  const loadLines = useCallback(async (id) => {
    if (!id) return setLines([]);
    const { data } = await supabase.from("work_estimate_lines").select("*").eq("estimate_id", id).order("sort").order("name");
    setLines(data || []);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const [c, k] = await Promise.all([
        supabase.from("work_cities").select("*").eq("enabled", true).order("sort"),
        supabase.from("work_categories").select("*").eq("enabled", true).order("sort"),
      ]);
      if (c.error) return setError("Розцінки на роботи ще не підключено до бази.");
      setCities(c.data || []);
      setCategories(k.data || []);
      loadRates("");
      if (canEstimate) {
        const list = await loadEstimates();
        if (list[0]) { setEstimateId(list[0].id); setCity(list[0].city || ""); loadLines(list[0].id); if (list[0].city) loadRates(list[0].city); }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, canEstimate]);

  function pickCity(slug) {
    setCity(slug);
    setByCity(null);
    if (!ratesByCity[slug]) loadRates(slug);
    if (estimateId && canEstimate) supabase.from("work_estimates").update({ city: slug }).eq("id", estimateId).then(() => loadEstimates());
  }

  const rates = ratesByCity[city];
  const cat = useMemo(() => new Map(categories.map((c) => [c.slug, c])), [categories]);
  const stages = useMemo(() => [...new Set(categories.map((c) => c.stage))], [categories]);
  const cityRate = useMemo(() => new Map((ratesByCity[city] || []).map((r) => [key(r), r])), [ratesByCity, city]);
  const uaRate = useMemo(() => new Map((ratesByCity[""] || []).map((r) => [key(r), r])), [ratesByCity]);
  const estimate = estimates.find((e) => e.id === estimateId) || null;
  const inEstimate = new Set(lines.map(key));
  const cityName = cities.find((c) => c.slug === city)?.name || "Вся Україна";

  const list = (rates || []).filter(
    (r) => (!stage || cat.get(r.category)?.stage === stage) && (!search || r.name.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => (cat.get(a.category)?.sort ?? 999) - (cat.get(b.category)?.sort ?? 999) || a.name.localeCompare(b.name, "uk"));

  // ── кошторис ──────────────────────────────────────────────────────────────
  async function ensureEstimate() {
    if (estimateId) return estimateId;
    const { data, error: e } = await supabase.from("work_estimates").insert([{ name: "Типовий будинок", city }]).select().single();
    if (e) { setError(e.message); return null; }
    await loadEstimates();
    setEstimateId(data.id);
    return data.id;
  }

  async function addLine(r) {
    const id = await ensureEstimate();
    if (!id) return;
    const row = r ? { category: r.category, work: r.work, name: r.name, unit: r.unit } : { name: "Своя робота", unit: "шт" };
    const { error: e } = await supabase.from("work_estimate_lines").insert([{ estimate_id: id, ...row, qty: 0, sort: lines.length }]);
    if (e) setError(e.message);
    await loadLines(id);
  }

  async function patchLine(line, patch) {
    setLines((p) => p.map((l) => (l.id === line.id ? { ...l, ...patch } : l)));
    const { error: e } = await supabase.from("work_estimate_lines").update(patch).eq("id", line.id);
    if (e) setError(e.message);
  }

  async function removeLine(line) {
    await supabase.from("work_estimate_lines").delete().eq("id", line.id);
    await loadLines(estimateId);
  }

  async function patchEstimate(patch) {
    setEstimates((p) => p.map((e) => (e.id === estimateId ? { ...e, ...patch } : e)));
    const { error: e } = await supabase.from("work_estimates").update(patch).eq("id", estimateId);
    if (e) setError(e.message);
  }

  async function newEstimate() {
    const name = window.prompt("Назва кошторису (напр. «Простір 40»)");
    if (!name?.trim()) return;
    const { data, error: e } = await supabase.from("work_estimates").insert([{ name: name.trim(), city }]).select().single();
    if (e) return setError(e.message);
    await loadEstimates();
    setEstimateId(data.id);
    setLines([]);
    setByCity(null);
  }

  async function removeEstimate() {
    if (!estimate || !window.confirm(`Видалити кошторис «${estimate.name}» з усіма рядками?`)) return;
    await supabase.from("work_estimates").delete().eq("id", estimate.id);
    const rest = await loadEstimates();
    setEstimateId(rest[0]?.id || "");
    loadLines(rest[0]?.id || "");
  }

  // ринкова ціна рядка: у вибраному місті, а якщо там такої роботи немає — по Україні
  const market = (l) => (l.category ? cityRate.get(key(l)) || (city ? uaRate.get(key(l)) : null) : null);
  const sums = lines.reduce(
    (a, l) => {
      const r = market(l);
      const q = Number(l.qty) || 0;
      if (r) { a.min += q * r.price_min; a.avg += q * r.price_avg; a.max += q * r.price_max; }
      if (l.our_rate != null) a.our += q * Number(l.our_rate);
      return a;
    },
    { min: 0, avg: 0, max: 0, our: 0 }
  );
  const salary = estimate && estimate.staff_count && estimate.staff_salary && estimate.houses_per_month
    ? (estimate.staff_count * estimate.staff_salary * (1 + (Number(estimate.payroll_tax_pct) || 0) / 100)) / estimate.houses_per_month
    : null;
  const vsAvg = (v) => (v && sums.avg ? ` (${v > sums.avg ? "+" : "−"}${n(Math.abs((v / sums.avg - 1) * 100))}% до середньої ринкової)` : "");

  async function compareCities() {
    const linked = lines.filter((l) => l.category && Number(l.qty) > 0);
    if (!linked.length) return setByCity([]);
    try {
      const works = [...new Set(linked.map((l) => l.work))];
      const rows = await fetchAll(() => supabase.from("work_rates").select("category,work,city,price_min,price_avg,price_max").in("work", works));
      const idx = new Map(rows.map((r) => [`${r.city}|${key(r)}`, r]));
      setByCity(
        cities.map((c) => {
          const t = { name: c.name, slug: c.slug, min: 0, avg: 0, max: 0, own: 0 };
          for (const l of linked) {
            const r = idx.get(`${c.slug}|${key(l)}`) || idx.get(`|${key(l)}`); // немає в місті — беремо по Україні
            if (!r) continue;
            if (idx.has(`${c.slug}|${key(l)}`)) t.own++;
            t.min += l.qty * r.price_min; t.avg += l.qty * r.price_avg; t.max += l.qty * r.price_max;
          }
          return { ...t, lines: linked.length };
        }).sort((a, b) => a.avg - b.avg)
      );
    } catch (e) {
      setError(e.message);
    }
  }

  if (error && !cities.length) return <div className="empty">{error}</div>;
  const checked = cities.find((c) => c.slug === city)?.checked_at;

  return (
    <div>
      <p className="note" style={{ marginTop: 0 }}>
        Ринкові розцінки з rabotniki.ua: скільки майстри й бригади беруть за кожен вид робіт. Оновлюються раз на тиждень. У «Кошторисі» — ті самі роботи на ваш будинок: ринок, ваші ставки, акорд і зарплата поруч.
      </p>
      {error && <div className="auth-error">{error}</div>}

      <div className="toolbar" style={{ marginBottom: 10 }}>
        <div className="seg-row">
          <button className={`seg-btn${view === "rates" ? " active" : ""}`} onClick={() => setView("rates")}>Розцінки</button>
          {canEstimate && <button className={`seg-btn${view === "estimate" ? " active" : ""}`} onClick={() => setView("estimate")}>Кошторис робіт на будинок{lines.length ? ` · ${lines.length}` : ""}</button>}
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <select value={city} onChange={(e) => pickCity(e.target.value)} style={{ width: 200 }} title="Місто, куди їде будинок">
            {cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          {view === "rates" && <SearchFilter value={search} onChange={setSearch} placeholder="Пошук роботи..." />}
          <span className="note" style={{ marginTop: 0 }}>{checked ? `оновлено ${new Date(checked).toLocaleDateString("uk-UA")}` : rates && !rates.length ? "для цього міста даних ще немає" : ""}</span>
        </div>
      </div>

      {view === "rates" && (
        <>
          <div className="seg-row" style={{ marginBottom: 10 }}>
            <button className={`seg-btn${!stage ? " active" : ""}`} onClick={() => setStage("")}>Усі етапи</button>
            {stages.map((s) => <button key={s} className={`seg-btn${stage === s ? " active" : ""}`} onClick={() => setStage(s)}>{s}</button>)}
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Робота</th><th>Од.</th><th>Пропозицій</th><th>Мін, грн</th><th>Середня, грн</th><th>Макс, грн</th><th></th></tr>
              </thead>
              <tbody>
                {!rates && <tr><td colSpan={7} className="empty">Завантаження…</td></tr>}
                {rates && !list.length && <tr><td colSpan={7} className="empty">Нічого не знайдено</td></tr>}
                {list.map((r, i) => {
                  const head = list[i - 1]?.category !== r.category;
                  return (
                    <Fragment key={r.id}>
                      {head && (
                        <tr><td colSpan={7} style={{ background: "var(--accent-bg)", fontWeight: 600, fontSize: 12 }}>{cat.get(r.category)?.stage} · {cat.get(r.category)?.name}</td></tr>
                      )}
                      <tr>
                        <td><a href={r.url} target="_blank" rel="noreferrer">{r.name}</a></td>
                        <td style={{ whiteSpace: "nowrap" }}>{r.unit}</td>
                        <td>{r.offers ?? "—"}</td>
                        <td>{n(r.price_min)}</td>
                        <td><b>{n(r.price_avg)}</b></td>
                        <td>{n(r.price_max)}</td>
                        <td>
                          {canEstimate && (inEstimate.has(key(r))
                            ? <span className="note" style={{ marginTop: 0 }}>у кошторисі</span>
                            : <button className="btn small" onClick={() => addLine(r)} title="Додати цю роботу в кошторис будинку">+ у кошторис</button>)}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === "estimate" && canEstimate && (
        <>
          <div className="toolbar">
            <div className="toolbar-left">
              <select value={estimateId} onChange={(e) => { setEstimateId(e.target.value); loadLines(e.target.value); setByCity(null); const es = estimates.find((x) => x.id === e.target.value); if (es) { setCity(es.city || ""); if (!ratesByCity[es.city || ""]) loadRates(es.city || ""); } }} style={{ width: 240 }}>
                {!estimates.length && <option value="">кошторису ще немає</option>}
                {estimates.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <button className="btn" onClick={newEstimate}>+ Новий кошторис</button>
              {estimate && <button className="btn" onClick={removeEstimate}>Видалити</button>}
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Робота</th><th>Од.</th><th>К-сть</th>
                  <th>Ринок за од.: мін / середня / макс</th>
                  <th>Сума мін</th><th>Сума середня</th><th>Сума макс</th>
                  <th>Наша ставка</th><th>Наша сума</th><th></th>
                </tr>
              </thead>
              <tbody>
                {!lines.length && <tr><td colSpan={10} className="empty">Додай роботи з вкладки «Розцінки» кнопкою «+ у кошторис» і простав кількість — метри, штуки, точки.</td></tr>}
                {lines.map((l) => {
                  const r = market(l);
                  const q = Number(l.qty) || 0;
                  const fromUa = r && city && !cityRate.get(key(l));
                  return (
                    <tr key={l.id}>
                      <td style={{ minWidth: 220 }}>
                        {l.category ? (r?.url ? <a href={r.url} target="_blank" rel="noreferrer">{l.name}</a> : l.name)
                          : <input type="text" defaultValue={l.name} onBlur={(e) => e.target.value !== l.name && patchLine(l, { name: e.target.value })} />}
                      </td>
                      <td>{l.category ? l.unit : <input type="text" defaultValue={l.unit || ""} style={{ width: 60 }} onBlur={(e) => patchLine(l, { unit: e.target.value })} />}</td>
                      <td><input type="number" className="price-input" defaultValue={l.qty} onBlur={(e) => patchLine(l, { qty: numOrNull(e.target.value) ?? 0 })} /></td>
                      <td style={{ whiteSpace: "nowrap" }}>{r ? <>{n(r.price_min)} / <b>{n(r.price_avg)}</b> / {n(r.price_max)}{fromUa && <span className="note" title="У цьому місті такої роботи немає — взято по Україні"> *</span>}</> : <span className="note">немає ринкової</span>}</td>
                      <td>{r ? n(q * r.price_min) : "—"}</td>
                      <td>{r ? <b>{n(q * r.price_avg)}</b> : "—"}</td>
                      <td>{r ? n(q * r.price_max) : "—"}</td>
                      <td><input type="number" className="price-input" defaultValue={l.our_rate ?? ""} placeholder="грн" onBlur={(e) => patchLine(l, { our_rate: numOrNull(e.target.value) })} /></td>
                      <td>{l.our_rate != null ? <b>{n(q * l.our_rate)}</b> : "—"}</td>
                      <td><button className="btn small" title="Прибрати рядок" onClick={() => removeLine(l)}>×</button></td>
                    </tr>
                  );
                })}
                {!!lines.length && (
                  <tr style={{ fontWeight: 600 }}>
                    <td colSpan={4}>Разом за роботи · {cityName}</td>
                    <td>{n(sums.min)}</td><td>{n(sums.avg)}</td><td>{n(sums.max)}</td><td></td><td>{n(sums.our)}</td><td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p style={{ margin: "8px 0 16px" }}><button className="btn small" onClick={() => addLine(null)}>+ Своя робота (без ринкової ціни)</button></p>

          {estimate && (
            <>
              <h4 style={{ fontSize: 14, margin: "0 0 8px" }}>Скільки це коштує нам</h4>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div className="form-row" style={{ width: 220 }}>
                  <label>Платимо за будинок акордом, грн</label>
                  <input type="number" defaultValue={estimate.paid_lump ?? ""} key={`lump-${estimate.id}`} onBlur={(e) => patchEstimate({ paid_lump: numOrNull(e.target.value) })} />
                </div>
                <div className="form-row" style={{ width: 150 }}>
                  <label>На зарплаті: людей</label>
                  <input type="number" defaultValue={estimate.staff_count ?? ""} key={`sc-${estimate.id}`} onBlur={(e) => patchEstimate({ staff_count: numOrNull(e.target.value) })} />
                </div>
                <div className="form-row" style={{ width: 200 }}>
                  <label>Зарплата на людину, грн/міс</label>
                  <input type="number" defaultValue={estimate.staff_salary ?? ""} key={`ss-${estimate.id}`} onBlur={(e) => patchEstimate({ staff_salary: numOrNull(e.target.value) })} />
                </div>
                <div className="form-row" style={{ width: 170 }}>
                  <label>Будинків за місяць</label>
                  <input type="number" defaultValue={estimate.houses_per_month ?? ""} key={`hm-${estimate.id}`} onBlur={(e) => patchEstimate({ houses_per_month: numOrNull(e.target.value) })} />
                </div>
                <div className="form-row" style={{ width: 190 }}>
                  <label>Нарахування на зарплату, %</label>
                  <input type="number" defaultValue={estimate.payroll_tax_pct ?? 22} key={`pt-${estimate.id}`} onBlur={(e) => patchEstimate({ payroll_tax_pct: numOrNull(e.target.value) ?? 0 })} />
                </div>
              </div>
              <div className="table-scroll" style={{ maxWidth: 760 }}>
                <table>
                  <thead><tr><th>Варіант</th><th>За будинок, грн</th><th></th></tr></thead>
                  <tbody>
                    <tr><td>Ринок, мінімальні ціни · {cityName}</td><td>{n(sums.min)}</td><td></td></tr>
                    <tr><td>Ринок, середні ціни · {cityName}</td><td><b>{n(sums.avg)}</b></td><td></td></tr>
                    <tr><td>Ринок, максимальні ціни · {cityName}</td><td>{n(sums.max)}</td><td></td></tr>
                    <tr><td>Наші ставки за одиницю</td><td>{sums.our ? <b>{n(sums.our)}</b> : "—"}</td><td className="note">{vsAvg(sums.our)}</td></tr>
                    <tr><td>Акорд за будинок</td><td>{estimate.paid_lump ? <b>{n(estimate.paid_lump)}</b> : "—"}</td><td className="note">{vsAvg(Number(estimate.paid_lump))}</td></tr>
                    <tr><td>На зарплаті (з нарахуваннями)</td><td>{salary ? <b>{n(salary)}</b> : "—"}</td><td className="note">{vsAvg(salary)}</td></tr>
                  </tbody>
                </table>
              </div>

              <p style={{ margin: "14px 0 8px" }}>
                <button className="btn" onClick={compareCities}>Порівняти міста</button>
                <span className="note" style={{ marginLeft: 8 }}>ті самі роботи й кількість — у кожному місті зі списку</span>
              </p>
              {byCity && (
                <div className="table-scroll" style={{ maxWidth: 760 }}>
                  <table>
                    <thead><tr><th>Місто</th><th>Мін, грн</th><th>Середня, грн</th><th>Макс, грн</th><th>Своїх цін</th></tr></thead>
                    <tbody>
                      {!byCity.length && <tr><td colSpan={5} className="empty">Додай роботи й кількість — тоді буде що порівнювати</td></tr>}
                      {byCity.map((c) => (
                        <tr key={c.slug} style={c.slug === city ? { fontWeight: 600 } : undefined}>
                          <td>{c.name}</td><td>{n(c.min)}</td><td>{n(c.avg)}</td><td>{n(c.max)}</td>
                          <td className="note" title="Скільки робіт мають ціну саме в цьому місті; решту взято по Україні">{c.own} з {c.lines}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

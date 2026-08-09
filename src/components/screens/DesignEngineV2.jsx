"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";

const DEFAULT = {
  type: "Проживання",
  width: 6,
  length: 6,
  height: 2.7,
  people: 4,
  bedrooms: 2,
  bathrooms: 1,
  budget: 50000,
  finish: "Стандарт",
  terrace: true,
  panoramic: true,
};

const clone = (v) => JSON.parse(JSON.stringify(v));
const n = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const money = (v) => new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(Math.round(n(v)));

function generateModel(brief) {
  const W = Math.max(2, n(brief.width, 6));
  const L = Math.max(2, n(brief.length, 6));
  const bedrooms = Math.max(1, Math.round(n(brief.bedrooms, 1)));
  const bathrooms = Math.max(1, Math.round(n(brief.bathrooms, 1)));
  const livingW = W * 0.58;
  const serviceW = W - livingW;
  const serviceH = Math.min(L * 0.34, 2.2);
  const rooms = [
    { id: "living", name: "Кухня-вітальня", x: 0, y: 0, w: livingW, h: L },
    { id: "bath", name: bathrooms > 1 ? "Санвузли" : "Санвузол", x: livingW, y: 0, w: serviceW, h: serviceH },
  ];
  const bedroomArea = Math.max(1.2, (L - serviceH) / bedrooms);
  for (let i = 0; i < bedrooms; i++) {
    rooms.push({ id: `bed${i + 1}`, name: `Спальня ${i + 1}`, x: livingW, y: serviceH + i * bedroomArea, w: serviceW, h: bedroomArea });
  }
  const windowFactor = brief.panoramic ? 1.8 : 1;
  return {
    width: W,
    length: L,
    height: Math.max(2, n(brief.height, 2.7)),
    area: W * L,
    rooms,
    openings: { panoramic: Boolean(brief.panoramic), windowFactor },
    terrace: Boolean(brief.terrace),
    generatedAt: new Date().toISOString(),
  };
}

function buildBom(model, materials, templates, bomItems) {
  const area = model.area;
  const candidates = templates
    .map((t) => ({ t, delta: Math.abs(n(t.area_m2) - area) }))
    .filter(({ t }) => n(t.area_m2) > 0)
    .sort((a, b) => a.delta - b.delta);
  const source = candidates[0]?.t || null;
  const materialMap = new Map(materials.map((m) => [m.id, m]));
  if (!source) return { source: null, rows: [], coverage: 0 };
  const scale = n(source.area_m2) ? area / n(source.area_m2) : 1;
  const rows = bomItems
    .filter((b) => b.template_id === source.id)
    .map((b) => {
      const material = materialMap.get(b.material_id);
      const qty = n(b.quantity_per_unit) * scale;
      const price = n(b.unit_price_override, NaN);
      return {
        id: b.id,
        materialId: b.material_id,
        material: material?.name || "Матеріал",
        unit: b.unit || material?.unit || "",
        quantity: qty,
        unitPrice: Number.isFinite(price) ? price : null,
        cost: Number.isFinite(price) ? qty * price : null,
      };
    });
  const priced = rows.filter((r) => r.cost != null);
  return {
    source,
    rows,
    coverage: rows.length ? priced.length / rows.length : 0,
    materialCost: priced.reduce((s, r) => s + r.cost, 0),
  };
}

function diffModel(a, b, aBom, bBom) {
  const changes = [];
  const areaDelta = b.area - a.area;
  if (areaDelta) changes.push({ label: "Площа", before: `${a.area.toFixed(1)} м²`, after: `${b.area.toFixed(1)} м²`, delta: `${areaDelta >= 0 ? "+" : ""}${areaDelta.toFixed(1)} м²` });
  const volumeDelta = b.area * b.height - a.area * a.height;
  if (volumeDelta) changes.push({ label: "Будівельний об'єм", before: `${(a.area * a.height).toFixed(1)} м³`, after: `${(b.area * b.height).toFixed(1)} м³`, delta: `${volumeDelta >= 0 ? "+" : ""}${volumeDelta.toFixed(1)} м³` });
  if (a.terrace !== b.terrace) changes.push({ label: "Тераса", before: a.terrace ? "Так" : "Ні", after: b.terrace ? "Так" : "Ні", delta: "зміна" });
  if (a.openings.panoramic !== b.openings.panoramic) changes.push({ label: "Панорамні вікна", before: a.openings.panoramic ? "Так" : "Ні", after: b.openings.panoramic ? "Так" : "Ні", delta: "зміна" });

  const mapA = new Map(aBom.rows.map((r) => [r.materialId, r]));
  const mapB = new Map(bBom.rows.map((r) => [r.materialId, r]));
  const ids = new Set([...mapA.keys(), ...mapB.keys()]);
  const bomChanges = [...ids].map((id) => {
    const x = mapA.get(id);
    const y = mapB.get(id);
    const qA = n(x?.quantity);
    const qB = n(y?.quantity);
    const cA = n(x?.cost);
    const cB = n(y?.cost);
    return {
      material: y?.material || x?.material || "Матеріал",
      unit: y?.unit || x?.unit || "",
      quantityDelta: qB - qA,
      costDelta: x?.cost != null && y?.cost != null ? cB - cA : null,
    };
  }).filter((r) => Math.abs(r.quantityDelta) > 0.0001 || (r.costDelta != null && Math.abs(r.costDelta) > 0.01));
  return { changes, bomChanges };
}

export default function DesignEngineV2() {
  const { supabase, materials, templates, bomItems } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [brief, setBrief] = useState(DEFAULT);
  const [model, setModel] = useState(() => generateModel(DEFAULT));
  const [baseline, setBaseline] = useState(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [projectId, setProjectId] = useState(null);

  const bom = useMemo(() => buildBom(model, materials, templates, bomItems), [model, materials, templates, bomItems]);
  const baselineBom = useMemo(() => baseline ? buildBom(baseline, materials, templates, bomItems) : null, [baseline, materials, templates, bomItems]);
  const comparison = useMemo(() => baseline && baselineBom ? diffModel(baseline, model, baselineBom, bom) : null, [baseline, model, baselineBom, bom]);
  const targetPrice = n(brief.budget);
  const cost = bom.materialCost || 0;
  const margin = targetPrice ? ((targetPrice - cost) / targetPrice) * 100 : 0;

  function update(key, value) {
    const nextBrief = { ...brief, [key]: value };
    setBrief(nextBrief);
    setModel(generateModel(nextBrief));
  }

  function createBaseline() {
    setBaseline(clone(model));
    setNotice("Зафіксовано базову версію. Тепер змінюй параметри — система покаже різницю.");
  }

  function resetBaseline() {
    setBaseline(null);
    setNotice("");
  }

  async function save() {
    if (!supabase || !canWriteCatalog) return;
    setSaving(true);
    try {
      const generated = { model, bom, targetPrice, materialCost: cost, margin, comparison };
      let id = projectId;
      if (!id) {
        const { data, error } = await supabase.from("design_projects").insert({ name: `${brief.type} ${model.width}×${model.length}`, brief, model, generated }).select("id").single();
        if (error) throw error;
        id = data.id;
        setProjectId(id);
      } else {
        const { error } = await supabase.from("design_projects").update({ brief, model, generated }).eq("id", id);
        if (error) throw error;
      }
      setNotice("Проєкт збережено.");
    } catch (e) {
      setNotice(`Помилка збереження: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="design-engine">
      <div className="design-engine-head">
        <div>
          <div className="design-kicker">MODULER DESIGN ENGINE · PARAMETRIC V2</div>
          <h2>Змінив параметр — бачиш наслідок у всій моделі</h2>
          <p>План → площа → BOM → собівартість → маржа. Базову версію можна зафіксувати і порівнювати з новою конфігурацією.</p>
        </div>
        <div className="design-actions">
          <button className="btn" onClick={createBaseline} disabled={Boolean(baseline)}>Зафіксувати V1</button>
          <button className="btn" onClick={resetBaseline} disabled={!baseline}>Скинути порівняння</button>
          <button className="btn primary" onClick={save} disabled={saving || !canWriteCatalog}>{saving ? "Збереження…" : "Зберегти"}</button>
        </div>
      </div>

      {notice && <div className="design-notice">{notice}</div>}

      <div className="design-grid two">
        <section className="design-panel">
          <div className="design-panel-title">Параметри моделі</div>
          <div className="design-form-grid">
            <label>Призначення<select value={brief.type} onChange={(e) => update("type", e.target.value)}>{["Проживання","Дача","Глемпінг","Кемпінг","Ретрит","Офіс"].map(x => <option key={x}>{x}</option>)}</select></label>
            <label>Ширина, м<input type="number" min="2" step="0.1" value={brief.width} onChange={(e) => update("width", e.target.value)} /></label>
            <label>Довжина, м<input type="number" min="2" step="0.1" value={brief.length} onChange={(e) => update("length", e.target.value)} /></label>
            <label>Висота, м<input type="number" min="2" step="0.1" value={brief.height} onChange={(e) => update("height", e.target.value)} /></label>
            <label>Людей<input type="number" min="1" value={brief.people} onChange={(e) => update("people", e.target.value)} /></label>
            <label>Спалень<input type="number" min="1" value={brief.bedrooms} onChange={(e) => update("bedrooms", e.target.value)} /></label>
            <label>Санвузлів<input type="number" min="1" value={brief.bathrooms} onChange={(e) => update("bathrooms", e.target.value)} /></label>
            <label>Бюджет, $<input type="number" min="0" value={brief.budget} onChange={(e) => update("budget", e.target.value)} /></label>
            <label>Оздоблення<select value={brief.finish} onChange={(e) => update("finish", e.target.value)}><option>Базове</option><option>Стандарт</option><option>Преміум</option></select></label>
            <label className="design-check"><input type="checkbox" checked={brief.terrace} onChange={(e) => update("terrace", e.target.checked)} /> Тераса</label>
            <label className="design-check"><input type="checkbox" checked={brief.panoramic} onChange={(e) => update("panoramic", e.target.checked)} /> Панорамні вікна / двері</label>
          </div>
        </section>

        <section className="design-panel">
          <div className="design-panel-title">Жива модель</div>
          <div className="result-summary">
            <div><b>{model.width.toFixed(1)} × {model.length.toFixed(1)} м</b><span>габарит</span></div>
            <div><b>{model.area.toFixed(1)} м²</b><span>площа</span></div>
            <div><b>{money(cost)} грн</b><span>відомий BOM</span></div>
            <div><b>{margin.toFixed(1)}%</b><span>маржа від бюджету</span></div>
          </div>
          <div className="plan-canvas" style={{ minHeight: 300 }}>
            <svg viewBox={`-0.5 -0.5 ${model.width + 1} ${model.length + 1}`} preserveAspectRatio="xMidYMid meet">
              <rect x="0" y="0" width={model.width} height={model.length} fill="white" stroke="currentColor" strokeWidth="0.05" />
              {model.rooms.map(room => <g key={room.id}><rect x={room.x} y={room.y} width={room.w} height={room.h} fill="white" stroke="currentColor" strokeWidth="0.035" /><text x={room.x + room.w / 2} y={room.y + room.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize="0.18">{room.name}</text></g>)}
            </svg>
          </div>
        </section>
      </div>

      <section className="design-panel" style={{ marginTop: 16 }}>
        <div className="design-panel-title"><span>Що змінилося</span>{baseline ? <span className="rule-badge">V1 → CURRENT</span> : <span className="rule-badge">Порівняння не зафіксовано</span>}</div>
        {!comparison ? (
          <div className="design-upload">Натисни «Зафіксувати V1», потім зміни, наприклад, 6×6 → 3×8. Тут з'явиться повний delta-звіт.</div>
        ) : (
          <>
            <div className="result-summary">
              {comparison.changes.map((x) => <div key={x.label}><b>{x.delta}</b><span>{x.label}: {x.before} → {x.after}</span></div>)}
              {!comparison.changes.length && <div><b>Без змін</b><span>геометрія та комплектація не змінилися</span></div>}
            </div>
            <div className="design-table-wrap">
              <table className="design-table"><thead><tr><th>Матеріал</th><th>Δ кількість</th><th>Δ вартість</th></tr></thead><tbody>
                {comparison.bomChanges.map((x) => <tr key={x.material}><td>{x.material}</td><td>{x.quantityDelta > 0 ? "+" : ""}{x.quantityDelta.toFixed(2)} {x.unit}</td><td>{x.costDelta == null ? "—" : `${x.costDelta >= 0 ? "+" : ""}${money(x.costDelta)} грн`}</td></tr>)}
                {!comparison.bomChanges.length && <tr><td colSpan="3">BOM не змінився.</td></tr>}
              </tbody></table>
            </div>
            <div className="result-footer"><span>BOM покриття: <b>{(bom.coverage * 100).toFixed(0)}%</b></span><span>Відомий BOM: <b>{money(cost)} грн</b></span><span>Ціль: <b>${money(targetPrice)}</b></span></div>
          </>
        )}
      </section>
    </div>
  );
}

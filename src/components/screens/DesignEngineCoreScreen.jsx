"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { buildCanonicalHouseModel, buildCostEngine, buildParametricBom, formatMoney } from "@/lib/design-engine/canonical";

const DEFAULT_BRIEF = { type: "Проживання", width: 6, length: 6, height: 2.7, people: 4, bedrooms: 2, bathrooms: 1, budget: 50000, finish: "Стандарт", terrace: true, panoramic: true, description: "Сучасний компактний будинок для сім'ї." };
const STEPS = [["brief", "Brief"], ["model", "House Model"], ["bom", "Parametric BOM"], ["cost", "Cost Engine"], ["result", "Результат"]];
const money = (value) => value == null ? "—" : formatMoney(value);

function Badge({ children, tone = "default" }) { return <span className={`rule-badge ${tone}`}>{children}</span>; }

export default function DesignEngineCoreScreen() {
  const { supabase, materials, templates, bomItems, supplierPrices, extraCosts } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [brief, setBrief] = useState(DEFAULT_BRIEF);
  const [model, setModel] = useState(null);
  const [bom, setBom] = useState(null);
  const [cost, setCost] = useState(null);
  const [step, setStep] = useState("brief");
  const [projectId, setProjectId] = useState(null);
  const [version, setVersion] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const area = model?.dimensions.area || 0;
  const modelSummary = useMemo(() => model ? { rooms: model.rooms.length, bedrooms: model.program.bedrooms, bathrooms: model.program.bathrooms } : null, [model]);

  function updateBrief(key, value) { setBrief((current) => ({ ...current, [key]: value })); }

  function generate() {
    const nextModel = buildCanonicalHouseModel(brief);
    const nextBom = buildParametricBom(nextModel, templates, bomItems, materials, supplierPrices);
    const nextCost = buildCostEngine(nextModel, nextBom, extraCosts, nextBom.sourceTemplateId);
    setModel(nextModel); setBom(nextBom); setCost(nextCost); setStep("model");
    setNotice("Canonical House Model створено. BOM і Cost Engine побудовані з доступних ERP-даних.");
  }

  async function saveVersion() {
    if (!model || !supabase || !canWriteCatalog) return;
    setSaving(true); setNotice("");
    try {
      let id = projectId;
      if (!id) {
        const { data, error } = await supabase.from("design_projects").insert({ name: `${brief.type} ${model.dimensions.width}×${model.dimensions.length}`, brief, model, generated: { bom, cost } }).select("id").single();
        if (error) throw error;
        id = data.id; setProjectId(id);
      } else {
        const { error } = await supabase.from("design_projects").update({ brief, model, generated: { bom, cost } }).eq("id", id);
        if (error) throw error;
      }
      const nextVersion = version + 1;
      const { error } = await supabase.from("design_project_versions").insert({ project_id: id, version_no: nextVersion, label: `V${nextVersion}`, snapshot: { brief, model, bom, cost } });
      if (error) throw error;
      setVersion(nextVersion); setNotice(`Збережено версію V${nextVersion}.`);
    } catch (error) { setNotice(`Не вдалося зберегти: ${error.message}`); }
    finally { setSaving(false); }
  }

  function newProject() { setBrief(DEFAULT_BRIEF); setModel(null); setBom(null); setCost(null); setProjectId(null); setVersion(0); setSelectedRoom(null); setStep("brief"); setNotice(""); }

  return <div className="design-engine">
    <div className="design-engine-head">
      <div><div className="design-kicker">MODULER DESIGN ENGINE · CORE V1</div><h2>Єдина модель будинку → BOM → собівартість</h2><p>Один canonical record. Похідні результати будуються з нього. Якщо правила або даних немає — система це показує.</p></div>
      <div className="design-actions"><button className="btn" onClick={newProject}>Новий проєкт</button><button className="btn primary" disabled={!model || saving || !canWriteCatalog} onClick={saveVersion}>{saving ? "Збереження…" : "Зберегти версію"}</button></div>
    </div>

    <div className="design-stepper">{STEPS.map(([id, label], i) => <button key={id} className={`design-step ${step === id ? "active" : ""}`} onClick={() => (id === "brief" || model) && setStep(id)}>{i + 1}. {label}</button>)}</div>
    {notice && <div className="design-notice">{notice}</div>}

    {step === "brief" && <div className="design-grid two">
      <section className="design-panel"><div className="design-panel-title">Brief проєкту</div>
        <div className="design-form-grid">
          <label>Призначення<select value={brief.type} onChange={(e) => updateBrief("type", e.target.value)}>{["Проживання", "Дача", "Глемпінг", "Кемпінг", "Ретрит", "Офіс"].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label>Ширина, м<input type="number" min="2" step="0.1" value={brief.width} onChange={(e) => updateBrief("width", e.target.value)} /></label>
          <label>Довжина, м<input type="number" min="2" step="0.1" value={brief.length} onChange={(e) => updateBrief("length", e.target.value)} /></label>
          <label>Висота, м<input type="number" min="2" step="0.1" value={brief.height} onChange={(e) => updateBrief("height", e.target.value)} /></label>
          <label>Людей<input type="number" min="1" value={brief.people} onChange={(e) => updateBrief("people", e.target.value)} /></label>
          <label>Спалень<input type="number" min="1" value={brief.bedrooms} onChange={(e) => updateBrief("bedrooms", e.target.value)} /></label>
          <label>Санвузлів<input type="number" min="1" value={brief.bathrooms} onChange={(e) => updateBrief("bathrooms", e.target.value)} /></label>
          <label>Бюджет, $<input type="number" min="0" value={brief.budget} onChange={(e) => updateBrief("budget", e.target.value)} /></label>
          <label>Оздоблення<select value={brief.finish} onChange={(e) => updateBrief("finish", e.target.value)}><option>Базове</option><option>Стандарт</option><option>Преміум</option></select></label>
          <label className="design-check"><input type="checkbox" checked={brief.terrace} onChange={(e) => updateBrief("terrace", e.target.checked)} /> Тераса</label>
          <label className="design-check"><input type="checkbox" checked={brief.panoramic} onChange={(e) => updateBrief("panoramic", e.target.checked)} /> Панорамні вікна</label>
        </div>
        <label className="design-full">Опис<textarea rows="4" value={brief.description} onChange={(e) => updateBrief("description", e.target.value)} /></label>
        <div className="design-upload">Ескіз / референс: наступним шаром прив'яжемо файли безпосередньо до canonical record.</div>
        <button className="btn primary design-generate" onClick={generate}>Створити модель</button>
      </section>
      <section className="design-panel design-vision"><div className="design-panel-title">Що система зробить</div><div className="design-vision-list">
        <div><b>01</b><span>Створить Canonical House Model.</span></div><div><b>02</b><span>Підбере найближчий ERP-шаблон як джерело BOM.</span></div><div><b>03</b><span>Перерахує кількості BOM за параметрами.</span></div><div><b>04</b><span>Візьме override або найкращу ціну постачальника.</span></div><div><b>05</b><span>Покаже відсутні дані замість вигаданих значень.</span></div>
      </div></section>
    </div>}

    {step === "model" && model && <div className="design-workspace">
      <section className="design-panel plan-panel"><div className="design-panel-title"><span>Canonical House Model · 2D</span><Badge tone="approved">RULE V1 · 95%</Badge></div><div className="plan-canvas"><svg viewBox={`-0.8 -0.8 ${model.dimensions.width + 1.6} ${model.dimensions.length + 1.6}`} preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width={model.dimensions.width} height={model.dimensions.length} fill="white" stroke="currentColor" strokeWidth="0.05" />
        {model.rooms.map((room) => <g key={room.id} onClick={() => setSelectedRoom(room.id)} className={`plan-room ${selectedRoom === room.id ? "selected" : ""}`}><rect x={room.x} y={room.y} width={room.width} height={room.length} fill={room.type === "bathroom" ? "#faeeda" : room.type === "bedroom" ? "#e6f1fb" : "#eaf3de"} stroke="currentColor" strokeWidth="0.035" /><text x={room.x + room.width / 2} y={room.y + room.length / 2 - 0.1} textAnchor="middle" dominantBaseline="middle" fontSize="0.2">{room.name}</text><text x={room.x + room.width / 2} y={room.y + room.length / 2 + 0.25} textAnchor="middle" fontSize="0.13">{room.area.toFixed(1)} м²</text></g>)}
        <text x={model.dimensions.width / 2} y={model.dimensions.length + 0.5} textAnchor="middle" fontSize="0.18">{model.dimensions.width.toFixed(2)} м</text><text x={model.dimensions.width + 0.4} y={model.dimensions.length / 2} textAnchor="middle" fontSize="0.18" transform={`rotate(90 ${model.dimensions.width + 0.4} ${model.dimensions.length / 2})`}>{model.dimensions.length.toFixed(2)} м</text>
      </svg></div></section>
      <section className="design-panel"><div className="design-panel-title">Canonical Record</div><div className="design-stat-grid">
        <div><small>Габарити</small><strong>{model.dimensions.width} × {model.dimensions.length} м</strong></div><div><small>Площа</small><strong>{area.toFixed(1)} м²</strong></div><div><small>Висота</small><strong>{model.dimensions.height} м</strong></div><div><small>Кімнати</small><strong>{modelSummary.rooms}</strong></div><div><small>Спальні</small><strong>{modelSummary.bedrooms}</strong></div><div><small>Санвузли</small><strong>{modelSummary.bathrooms}</strong></div>
      </div><div className="design-decision-list">{model.decisions.map((d) => <div key={d.rule}><span>{d.rule}</span><Badge tone={d.status === "approved" ? "approved" : "warning"}>{d.status}</Badge></div>)}</div>{selectedRoom && <div className="design-notice">Обрано: {model.rooms.find((r) => r.id === selectedRoom)?.name}</div>}</section>
    </div>}

    {step === "bom" && bom && <section className="design-panel"><div className="design-panel-title"><span>Parametric BOM</span><span><Badge>Джерело: {bom.sourceTemplate || "немає"}</Badge> <Badge>{(bom.scale || 1).toFixed(2)}×</Badge></span></div>{bom.warnings?.map((w) => <div className="design-notice" key={w}>{w}</div>)}<div className="design-table-wrap"><table className="design-table"><thead><tr><th>Матеріал</th><th>Кількість</th><th>Од.</th><th>Ціна</th><th>Сума</th><th>Статус</th></tr></thead><tbody>{bom.rows.map((row) => <tr key={row.id}><td>{row.material}</td><td>{row.quantity.toFixed(2)}</td><td>{row.unit}</td><td>{money(row.unitPrice)}</td><td>{money(row.total)}</td><td><Badge tone={row.status === "estimate" ? "approved" : "warning"}>{row.status}</Badge></td></tr>)}</tbody></table></div></section>}

    {step === "cost" && cost && <div className="design-grid two"><section className="design-panel"><div className="design-panel-title">Cost Engine</div><div className="design-stat-grid cost"><div><small>Матеріали</small><strong>{money(cost.materials)}</strong></div><div><small>Додаткові ERP-витрати</small><strong>{money(cost.extras)}</strong></div><div><small>Відомо зараз</small><strong>{money(cost.knownCost)}</strong></div><div><small>Модельна оцінка</small><strong>{money(cost.modeledCost)}</strong></div></div><div className="design-notice">{cost.note}</div></section><section className="design-panel"><div className="design-panel-title">Контроль якості</div><div className="design-quality"><strong>{Math.round(cost.completeness * 100)}%</strong><span>покриття BOM цінами</span></div><div className="design-decision-list"><div><span>Статус</span><Badge tone={cost.status === "estimate" ? "approved" : "warning"}>{cost.status}</Badge></div><div><span>Без ціни</span><strong>{cost.missingPrices}</strong></div><div><span>Джерело</span><strong>{bom?.sourceTemplate || "—"}</strong></div></div></section></div>}

    {step === "result" && model && cost && <div className="design-grid two"><section className="design-panel"><div className="design-panel-title">Проєкт</div><h3>{brief.type} · {model.dimensions.width} × {model.dimensions.length} м</h3><p>{brief.description}</p><div className="design-decision-list"><div><span>Canonical Model</span><Badge tone="approved">V1.0</Badge></div><div><span>BOM</span><Badge tone={bom?.rows.length ? "approved" : "warning"}>{bom?.rows.length || 0} позицій</Badge></div><div><span>Планова собівартість</span><strong>{money(cost.modeledCost)}</strong></div><div><span>Бюджет клієнта</span><strong>{Number(brief.budget || 0).toLocaleString("uk-UA")} $</strong></div><div><span>Версія</span><strong>{projectId ? `V${version}` : "Чернетка"}</strong></div></div></section><section className="design-panel"><div className="design-panel-title">Що ще не підтверджується автоматично</div><div className="design-vision-list"><div><b>01</b><span>Конструктив — потрібне затверджене правило або рішення.</span></div><div><b>02</b><span>Інженерія — потрібне правило та відповідальний фахівець.</span></div><div><b>03</b><span>Праця, логістика, монтаж і накладні — потрібні реальні ERP-дані.</span></div></div></section></div>}
  </div>;
}

"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";

const DEFAULT_BRIEF = {
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
  description: "Сучасний компактний будинок для сім'ї, простора кухня-вітальня та два спальних приміщення.",
};

const ROOM_PRESETS = [
  { key: "living", name: "Кухня-вітальня", color: "#eaf3de" },
  { key: "bed1", name: "Спальня", color: "#e6f1fb" },
  { key: "bed2", name: "Спальня", color: "#e6f1fb" },
  { key: "bath", name: "Санвузол", color: "#faeeda" },
];

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function generateModel(brief) {
  const W = Number(brief.width) || 6;
  const L = Number(brief.length) || 6;
  const bedrooms = Math.max(1, Number(brief.bedrooms) || 1);
  const bathrooms = Math.max(1, Number(brief.bathrooms) || 1);
  const livingWidth = W * 0.58;
  const bathWidth = W - livingWidth;
  const topHeight = bedrooms > 1 ? L * 0.55 : L * 0.5;
  const rooms = [
    { id: "living", name: "Кухня-вітальня", x: 0, y: 0, w: livingWidth, h: L, color: "#eaf3de" },
    { id: "bath", name: bathrooms > 1 ? "Санвузли" : "Санвузол", x: livingWidth, y: 0, w: bathWidth, h: L * 0.34, color: "#faeeda" },
    { id: "bed1", name: "Спальня", x: livingWidth, y: L * 0.34, w: bathWidth, h: topHeight, color: "#e6f1fb" },
  ];
  if (bedrooms > 1) rooms.push({ id: "bed2", name: "Спальня", x: livingWidth, y: L * 0.34 + topHeight, w: bathWidth, h: L - (L * 0.34 + topHeight), color: "#e6f1fb" });
  return {
    width: W,
    length: L,
    height: Number(brief.height) || 2.7,
    rooms,
    doors: [{ room: "living", side: "south", offset: W * 0.42 }],
    windows: [
      { room: "living", side: "south", offset: W * 0.15, width: W * 0.18 },
      { room: "living", side: "south", offset: W * 0.68, width: W * 0.18 },
      { room: "living", side: "west", offset: L * 0.35, width: L * 0.25 },
      { room: "bed1", side: "east", offset: L * 0.18, width: L * 0.25 },
    ],
    terrace: Boolean(brief.terrace),
    generatedAt: new Date().toISOString(),
  };
}

function estimateBom(brief, model, materials, templates, bomItems) {
  const area = model.width * model.length;
  const source = templates.find((t) => Math.abs(Number(t.area_m2 || 0) - area) < Math.max(5, area * 0.12));
  const sourceItems = source ? bomItems.filter((b) => b.template_id === source.id) : [];
  const materialMap = new Map(materials.map((m) => [m.id, m]));
  const rows = sourceItems.map((b) => ({
    material: materialMap.get(b.material_id)?.name || "Матеріал",
    quantity: Number(b.quantity_per_unit || 0) * (source && Number(source.area_m2) ? area / Number(source.area_m2) : 1),
    unit: b.unit,
    source: `Шаблон: ${source.name}`,
  }));
  return { area, sourceTemplate: source?.name || null, rows };
}

function money(value) { return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(Math.round(value || 0)); }

export default function DesignEngineScreen() {
  const { supabase, materials, templates, bomItems } = useAppData();
  const { canWriteCatalog } = useAuth();
  const [step, setStep] = useState("brief");
  const [brief, setBrief] = useState(DEFAULT_BRIEF);
  const [model, setModel] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedRoom, setSelectedRoom] = useState(null);

  const bom = useMemo(() => model ? estimateBom(brief, model, materials, templates, bomItems) : null, [brief, model, materials, templates, bomItems]);
  const area = model ? model.width * model.length : 0;
  const indicativeCost = bom?.rows.length ? bom.rows.reduce((sum, row) => sum + row.quantity, 0) : area * 17000;
  const targetPrice = Number(brief.budget) || area * 2500;
  const margin = targetPrice ? ((targetPrice - indicativeCost) / targetPrice) * 100 : 0;

  function updateBrief(key, value) {
    setBrief((b) => ({ ...b, [key]: value }));
  }

  function generate() {
    const next = generateModel(brief);
    setModel(next);
    setStep("plan");
    setNotice("План згенеровано rule-based генератором. Автоматичні рішення позначені як V1.");
  }

  function resizeRoom(roomId, delta) {
    if (!model) return;
    const rooms = model.rooms.map((r) => r.id === roomId ? { ...r, w: clamp(r.w + delta, 1.2, model.width - 1) } : r);
    setModel({ ...model, rooms });
  }

  async function saveProject() {
    if (!model || !supabase || !canWriteCatalog) return;
    setSaving(true); setNotice("");
    const payload = { brief, model, generated: { bom, indicativeCost, targetPrice, margin } };
    try {
      let id = projectId;
      if (!id) {
        const { data, error } = await supabase.from("design_projects").insert({ name: `${brief.type} ${model.width}×${model.length}`, brief, model, generated: payload.generated }).select("id").single();
        if (error) throw error;
        id = data.id; setProjectId(id); setVersion(1);
      } else {
        const { error } = await supabase.from("design_projects").update({ brief, model, generated: payload.generated }).eq("id", id);
        if (error) throw error;
        setVersion((v) => v + 1);
      }
      const nextVersion = id === projectId ? version + 1 : 1;
      const { error: versionError } = await supabase.from("design_project_versions").insert({ project_id: id, version_no: nextVersion, label: `V${nextVersion}`, snapshot: payload });
      if (versionError) throw versionError;
      setNotice(`Збережено версію V${nextVersion}.`);
    } catch (e) {
      setNotice(`Не вдалося зберегти: ${e.message}`);
    } finally { setSaving(false); }
  }

  const stepIndex = ["brief", "plan", "architecture", "bom", "result"].indexOf(step);
  const canNext = Boolean(model);

  return (
    <div className="design-engine">
      <div className="design-engine-head">
        <div>
          <div className="design-kicker">MODULER DESIGN ENGINE · V1</div>
          <h2>Від ідеї до керованої моделі будинку</h2>
          <p>Rule-based генерація зараз. Далі цей самий проєктний контур розширюється правилами, конструктивом, BOM і виробництвом.</p>
        </div>
        <div className="design-actions">
          <button className="btn" onClick={() => { setBrief(DEFAULT_BRIEF); setModel(null); setProjectId(null); setVersion(0); setStep("brief"); setNotice(""); }}>Новий проєкт</button>
          <button className="btn primary" disabled={!model || saving || !canWriteCatalog} onClick={saveProject}>{saving ? "Збереження…" : "Зберегти версію"}</button>
        </div>
      </div>

      <div className="design-stepper">
        {[['brief','Brief'],['plan','План'],['architecture','Архітектура'],['bom','BOM / Ціна'],['result','Результат']].map(([id,label], i) => (
          <button key={id} className={`design-step ${step === id ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`} onClick={() => (id === 'brief' || canNext) && setStep(id)}>{i + 1}. {label}</button>
        ))}
      </div>

      {notice && <div className="design-notice">{notice}</div>}

      {step === "brief" && (
        <div className="design-grid two">
          <section className="design-panel">
            <div className="design-panel-title">Короткий brief</div>
            <div className="design-form-grid">
              <label>Призначення<select value={brief.type} onChange={(e) => updateBrief('type', e.target.value)}>{['Проживання','Дача','Глемпінг','Кемпінг','Ретрит','Офіс'].map(x=><option key={x}>{x}</option>)}</select></label>
              <label>Ширина, м<input type="number" min="2" step="0.1" value={brief.width} onChange={(e)=>updateBrief('width',e.target.value)}/></label>
              <label>Довжина, м<input type="number" min="2" step="0.1" value={brief.length} onChange={(e)=>updateBrief('length',e.target.value)}/></label>
              <label>Висота, м<input type="number" min="2" step="0.1" value={brief.height} onChange={(e)=>updateBrief('height',e.target.value)}/></label>
              <label>Людей<input type="number" min="1" value={brief.people} onChange={(e)=>updateBrief('people',e.target.value)}/></label>
              <label>Спалень<input type="number" min="1" value={brief.bedrooms} onChange={(e)=>updateBrief('bedrooms',e.target.value)}/></label>
              <label>Санвузлів<input type="number" min="1" value={brief.bathrooms} onChange={(e)=>updateBrief('bathrooms',e.target.value)}/></label>
              <label>Бюджет, $<input type="number" min="0" value={brief.budget} onChange={(e)=>updateBrief('budget',e.target.value)}/></label>
              <label>Оздоблення<select value={brief.finish} onChange={(e)=>updateBrief('finish',e.target.value)}><option>Базове</option><option>Стандарт</option><option>Преміум</option></select></label>
              <label className="design-check"><input type="checkbox" checked={brief.terrace} onChange={(e)=>updateBrief('terrace',e.target.checked)}/> Тераса</label>
              <label className="design-check"><input type="checkbox" checked={brief.panoramic} onChange={(e)=>updateBrief('panoramic',e.target.checked)}/> Панорамні вікна / двері</label>
            </div>
            <label className="design-full">Опис<textarea rows="4" value={brief.description} onChange={(e)=>updateBrief('description',e.target.value)} /></label>
            <div className="design-upload">Перетягніть сюди ескіз або референс — завантаження файлів підключимо до проєктного сховища наступним шаром.</div>
            <button className="btn primary design-generate" onClick={generate}>Створити проєкт</button>
          </section>
          <section className="design-panel design-vision">
            <div className="design-panel-title">Що система зробить</div>
            <div className="design-vision-list">
              <div><b>01</b><span>Побудує параметричну модель габаритів.</span></div>
              <div><b>02</b><span>Розкладе простір на базові функціональні зони.</span></div>
              <div><b>03</b><span>Покаже план, архітектурну схему та BOM.</span></div>
              <div><b>04</b><span>Прив'яже рішення до існуючих шаблонів і матеріалів ERP.</span></div>
              <div><b>05</b><span>Збереже версію, щоб рішення не губилися в чатах.</span></div>
            </div>
          </section>
        </div>
      )}

      {step === "plan" && model && (
        <div className="design-workspace">
          <section className="design-panel plan-panel">
            <div className="design-panel-title"><span>2D План</span><span className="rule-badge">RULE V1 · 95%</span></div>
            <div className="plan-canvas">
              <svg viewBox={`-0.8 -0.8 ${model.width + 1.6} ${model.length + 1.6}`} preserveAspectRatio="xMidYMid meet">
                <rect x="0" y="0" width={model.width} height={model.length} fill="white" stroke="currentColor" strokeWidth="0.05"/>
                {model.rooms.map((room) => <g key={room.id} onClick={()=>setSelectedRoom(room.id)} className={`plan-room ${selectedRoom===room.id?'selected':''}`}><rect x={room.x} y={room.y} width={room.w} height={room.h} fill={room.color} stroke="currentColor" strokeWidth="0.035"/><text x={room.x+room.w/2} y={room.y+room.h/2} textAnchor="middle" dominantBaseline="middle" fontSize="0.22" fill="currentColor">{room.name}</text></g>)}
                <line x1="0" y1={model.length + 0.3} x2={model.width} y2={model.length + 0.3} stroke="currentColor" strokeWidth="0.02"/><text x={model.width/2} y={model.length+0.55} textAnchor="middle" fontSize="0.18">{model.width.toFixed(2)} м</text>
                <line x1={model.width+0.3} y1="0" x2={model.width+0.3} y2={model.length} stroke="currentColor" strokeWidth="0.02"/><text x={model.width+0.55} y={model.length/2} textAnchor="middle" fontSize="0.18" transform={`rotate(90 ${model.width+0.55} ${model.length/2})`}>{model.length.toFixed(2)} м</text>
              </svg>
            </div>
          </section>
          <aside className="design-panel design-inspector">
            <div className="design-panel-title">Інспектор</div>
            {selectedRoom ? <><div className="inspector-name">{model.rooms.find(r=>r.id===selectedRoom)?.name}</div><button className="btn small" onClick={()=>resizeRoom(selectedRoom,-0.2)}>Зменшити на 0,2 м</button><button className="btn small" onClick={()=>resizeRoom(selectedRoom,0.2)}>Збільшити на 0,2 м</button></> : <p className="muted">Оберіть кімнату на плані.</p>}
            <div className="rule-card"><b>Джерело рішення</b><span>Rule: MODULE_RECTANGULAR_V1</span><small>Система не вигадує конструктивні норми.</small></div>
            <button className="btn primary full" onClick={()=>setStep('architecture')}>Далі → Архітектура</button>
          </aside>
        </div>
      )}

      {step === "architecture" && model && (
        <div className="design-grid two">
          <section className="design-panel">
            <div className="design-panel-title">Архітектурна схема</div>
            <div className="axonometric">
              <div className="axo-top"><span>{model.width} м</span><span>{model.length} м</span></div>
              <div className="axo-house"><div className="axo-window"></div><div className="axo-door"></div></div>
              <div className="axo-label">{model.width} × {model.length} × {model.height} м</div>
            </div>
            <div className="architecture-metrics"><div><b>{area.toFixed(1)} м²</b><span>площа</span></div><div><b>{model.rooms.length}</b><span>зони</span></div><div><b>{brief.people}</b><span>мешканців</span></div></div>
          </section>
          <section className="design-panel">
            <div className="design-panel-title">Контроль рішень</div>
            <div className="decision-list"><div><span className="rule-badge">RULE</span> Прямокутний об'єм <b>95%</b></div><div><span className="rule-badge">INPUT</span> Габарити з brief <b>100%</b></div><div><span className="pending-badge">PENDING</span> Несуча схема <b>потрібен фахівець</b></div><div><span className="pending-badge">PENDING</span> Інженерія <b>потрібен фахівець</b></div></div>
            <button className="btn primary full" onClick={()=>setStep('bom')}>Далі → BOM / Ціна</button>
          </section>
        </div>
      )}

      {step === "bom" && model && bom && (
        <div className="design-grid two">
          <section className="design-panel">
            <div className="design-panel-title">BOM · попередній</div>
            {bom.sourceTemplate && <div className="design-source">База: {bom.sourceTemplate}</div>}
            {!bom.rows.length ? <div className="empty">У базі не знайдено близького шаблону BOM. Потрібне наповнення Parametric BOM.</div> : <div className="design-bom-table">{bom.rows.map((r,i)=><div className="design-bom-row" key={i}><span>{r.material}</span><b>{r.quantity.toFixed(2)} {r.unit}</b><small>{r.source}</small></div>)}</div>}
          </section>
          <section className="design-panel price-panel">
            <div className="design-panel-title">Економіка</div>
            <div className="price-big">${money(targetPrice)}</div><div className="muted">цільова ціна з brief</div>
            <div className="price-grid"><div><span>Площа</span><b>{area.toFixed(1)} м²</b></div><div><span>Орієнтовна база</span><b>${money(indicativeCost)}</b></div><div><span>Маржа*</span><b>{margin.toFixed(1)}%</b></div></div>
            <small>* MVP-оцінка. Не є фінальною калькуляцією, доки Parametric BOM і Cost Engine не підтверджені.</small>
            <button className="btn primary full" onClick={()=>setStep('result')}>Далі → Результат</button>
          </section>
        </div>
      )}

      {step === "result" && model && (
        <div className="design-panel">
          <div className="design-panel-title">Проєкт готовий до наступного шару</div>
          <div className="result-tabs"><span className="active">План</span><span>Архітектура</span><span>Конструктив</span><span>Інженерія</span><span>BOM</span><span>Ціна</span><span>Файли</span><span>Версії</span></div>
          <div className="result-summary"><div><b>{model.width} × {model.length} м</b><span>габарит</span></div><div><b>{area.toFixed(1)} м²</b><span>площа</span></div><div><b>${money(targetPrice)}</b><span>цільова ціна</span></div><div><b>{projectId ? `V${version}` : 'Чернетка'}</b><span>версія</span></div></div>
          <div className="result-footer"><span>Конструктивні та інженерні рішення: <b>Потребує рішення архітектора / фахівця</b></span><button className="btn primary" disabled={!canWriteCatalog || saving} onClick={saveProject}>{saving ? 'Збереження…' : 'Зберегти версію'}</button></div>
        </div>
      )}
    </div>
  );
}

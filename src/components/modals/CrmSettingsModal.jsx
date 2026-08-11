"use client";

import { useState } from "react";
import { useCrmData } from "@/context/CrmDataContext";
import ProductCategoriesPanel from "@/components/panels/ProductCategoriesPanel";

const REQUEST_TYPE_LABELS = { template: "Шаблон", custom: "Кастомний", individual: "Індивідуальний" };

export default function CrmSettingsModal({ open, onClose }) {
  const { supabase, pipelines, pipelineStages, deals, reload } = useCrmData();
  const [selectedId, setSelectedId] = useState(null);
  const [showCategories, setShowCategories] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState("");
  const [newStageLabel, setNewStageLabel] = useState({});
  const [error, setError] = useState("");

  if (!open) return null;

  function stagesOf(pipelineId) {
    return pipelineStages.filter((s) => s.pipeline_id === pipelineId).sort((a, b) => a.sort_order - b.sort_order);
  }
  function dealsInPipeline(pipelineId) {
    return deals.filter((d) => d.pipeline_id === pipelineId).length;
  }
  function dealsInStage(stageId) {
    return deals.filter((d) => d.stage_id === stageId).length;
  }

  async function renamePipeline(id, name) {
    await supabase.from("pipelines").update({ name }).eq("id", id);
    await reload(true);
  }
  async function updateDefaultRequestType(id, value) {
    await supabase.from("pipelines").update({ default_request_type: value }).eq("id", id);
    await reload(true);
  }
  async function deletePipeline(p) {
    if (dealsInPipeline(p.id) > 0) { setError("Не можна видалити воронку, в якій є угоди."); return; }
    if (!confirm(`Видалити воронку «${p.name}»?`)) return;
    setError("");
    try {
      await supabase.from("pipeline_stages").delete().eq("pipeline_id", p.id);
      const { error: e } = await supabase.from("pipelines").delete().eq("id", p.id);
      if (e) throw e;
      setSelectedId(null);
      await reload(true);
    } catch (err) {
      setError(err.message || String(err));
    }
  }
  async function addPipeline() {
    if (!newPipelineName.trim()) return;
    const maxOrder = pipelines.length ? Math.max(...pipelines.map((p) => p.sort_order ?? 0)) : 0;
    const { data: created, error: e } = await supabase.from("pipelines").insert([{ name: newPipelineName.trim(), slug: crypto.randomUUID(), sort_order: maxOrder + 1 }]).select().single();
    if (e) { setError(e.message); return; }
    await supabase.from("pipeline_stages").insert([{ pipeline_id: created.id, key: "новий_етап", label: "Новий етап", sort_order: 1 }]);
    setNewPipelineName("");
    await reload(true);
  }
  async function movePipeline(index, dir) {
    const j = index + dir;
    if (j < 0 || j >= pipelines.length) return;
    const a = pipelines[index], b = pipelines[j];
    await Promise.all([
      supabase.from("pipelines").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("pipelines").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    await reload(true);
  }

  async function renameStage(id, label) {
    await supabase.from("pipeline_stages").update({ label }).eq("id", id);
    await reload(true);
  }
  async function deleteStage(pipelineId, stage) {
    if (dealsInStage(stage.id) > 0) { setError("Не можна видалити етап, в якому є угоди."); return; }
    if (stagesOf(pipelineId).length <= 1) { setError("У воронці має лишитись хоча б один етап."); return; }
    setError("");
    await supabase.from("pipeline_stages").delete().eq("id", stage.id);
    await reload(true);
  }
  async function addStage(pipelineId) {
    const label = (newStageLabel[pipelineId] || "").trim();
    if (!label) return;
    const sibs = stagesOf(pipelineId);
    const maxOrder = sibs.length ? Math.max(...sibs.map((s) => s.sort_order)) : 0;
    await supabase.from("pipeline_stages").insert([{ pipeline_id: pipelineId, key: label.toLowerCase().replace(/\s+/g, "_"), label, sort_order: maxOrder + 1 }]);
    setNewStageLabel((s) => ({ ...s, [pipelineId]: "" }));
    await reload(true);
  }
  async function moveStage(pipelineId, index, dir) {
    const sibs = stagesOf(pipelineId);
    const j = index + dir;
    if (j < 0 || j >= sibs.length) return;
    const a = sibs[index], b = sibs[j];
    await Promise.all([
      supabase.from("pipeline_stages").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("pipeline_stages").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    await reload(true);
  }

  const selected = selectedId ? pipelines.find((p) => p.id === selectedId) : null;

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        {showCategories ? (
          <ProductCategoriesPanel onBack={() => setShowCategories(false)} />
        ) : selected ? (
          <>
            <div className="cat-panel-header">
              <button className="btn small" onClick={() => setSelectedId(null)}>← Назад</button>
              <h2 style={{ margin: 0, fontSize: 16 }}>Воронка</h2>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <div className="section-details" style={{ padding: 12, marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input style={{ flex: 1, fontWeight: 600 }} value={selected.name} onChange={(e) => renamePipeline(selected.id, e.target.value)} />
                <button className="btn small" style={{ color: "var(--danger)" }} onClick={() => deletePipeline(selected)}>Видалити</button>
              </div>
              <div className="form-row" style={{ marginBottom: 10 }}>
                <label>Тип запиту за замовчуванням (для нового ліда)</label>
                <select value={selected.default_request_type || "individual"} onChange={(e) => updateDefaultRequestType(selected.id, e.target.value)}>
                  {Object.entries(REQUEST_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="note" style={{ textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Етапи</div>
              {stagesOf(selected.id).map((s, i, arr) => (
                <div key={s.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                  <div className="reorder-mini">
                    <button disabled={i === 0} onClick={() => moveStage(selected.id, i, -1)}>▲</button>
                    <button disabled={i === arr.length - 1} onClick={() => moveStage(selected.id, i, 1)}>▼</button>
                  </div>
                  <input style={{ flex: 1 }} value={s.label} onChange={(e) => renameStage(s.id, e.target.value)} />
                  <span className="note" style={{ minWidth: 60 }}>{dealsInStage(s.id)} угод</span>
                  <span className="icon-x" onClick={() => deleteStage(selected.id, s)}>×</span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input style={{ flex: 1 }} placeholder="Назва нового етапу" value={newStageLabel[selected.id] || ""} onChange={(e) => setNewStageLabel((s) => ({ ...s, [selected.id]: e.target.value }))} />
                <button className="btn small" onClick={() => addStage(selected.id)}>+ Етап</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2>Воронки продажів</h2>
            {error && <div className="auth-error">{error}</div>}
            <p className="note">
              Кожна воронка може мати свій обмежений доступ — налаштуй його в «Ролі доступу».
            </p>
            <div className="toolbar" style={{ marginBottom: 10 }}>
              <div className="toolbar-left" />
              <button className="btn small" onClick={() => setShowCategories(true)}>🏷 Категорії лідів</button>
            </div>

            {pipelines.map((p, i) => (
              <div key={p.id} className="cat-item">
                <div className="cat-reorder">
                  <button type="button" disabled={i === 0} onClick={() => movePipeline(i, -1)} title="Вище">▲</button>
                  <button type="button" disabled={i === pipelines.length - 1} onClick={() => movePipeline(i, 1)} title="Нижче">▼</button>
                </div>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                <span className="note" style={{ marginTop: 0, minWidth: 60 }}>{dealsInPipeline(p.id)} угод</span>
                <button className="btn small" title="Налаштувати воронку" onClick={() => setSelectedId(p.id)}>⚙</button>
              </div>
            ))}
            {!pipelines.length && <div className="empty">Немає жодної воронки</div>}

            <div className="cat-add">
              <input style={{ flex: 1 }} placeholder="Назва нової воронки" value={newPipelineName} onChange={(e) => setNewPipelineName(e.target.value)} />
              <button className="btn primary small" onClick={addPipeline}>+ Нова воронка</button>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Закрити</button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useCrmData } from "@/context/CrmDataContext";

export default function CrmSettingsModal({ open, onClose }) {
  const { supabase, pipelines, pipelineStages, deals, reload } = useCrmData();
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
  async function deletePipeline(p) {
    if (dealsInPipeline(p.id) > 0) { setError("Не можна видалити воронку, в якій є угоди."); return; }
    if (!confirm(`Видалити воронку «${p.name}»?`)) return;
    setError("");
    try {
      await supabase.from("pipeline_stages").delete().eq("pipeline_id", p.id);
      const { error: e } = await supabase.from("pipelines").delete().eq("id", p.id);
      if (e) throw e;
      await reload(true);
    } catch (err) {
      setError(err.message || String(err));
    }
  }
  async function addPipeline() {
    if (!newPipelineName.trim()) return;
    const { data: created, error: e } = await supabase.from("pipelines").insert([{ name: newPipelineName.trim(), slug: crypto.randomUUID(), sort_order: pipelines.length + 1 }]).select().single();
    if (e) { setError(e.message); return; }
    await supabase.from("pipeline_stages").insert([{ pipeline_id: created.id, key: "новий_етап", label: "Новий етап", sort_order: 1 }]);
    setNewPipelineName("");
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

  return (
    <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <h2>Налаштування CRM</h2>
        {error && <div className="auth-error">{error}</div>}
        <p className="note">
          Категорії будинків спільні з каталогом шаблонів — керуй ними на вкладці «Категорії».
        </p>

        {pipelines.map((p) => (
          <div key={p.id} className="section-details" style={{ padding: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input style={{ flex: 1, fontWeight: 600 }} value={p.name} onChange={(e) => renamePipeline(p.id, e.target.value)} />
              <button className="btn small" style={{ color: "var(--danger)" }} onClick={() => deletePipeline(p)}>Видалити</button>
            </div>
            <div className="note" style={{ textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Етапи</div>
            {stagesOf(p.id).map((s, i, arr) => (
              <div key={s.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                <div className="reorder-mini">
                  <button disabled={i === 0} onClick={() => moveStage(p.id, i, -1)}>▲</button>
                  <button disabled={i === arr.length - 1} onClick={() => moveStage(p.id, i, 1)}>▼</button>
                </div>
                <input style={{ flex: 1 }} value={s.label} onChange={(e) => renameStage(s.id, e.target.value)} />
                <span className="note" style={{ minWidth: 60 }}>{dealsInStage(s.id)} угод</span>
                <span className="icon-x" onClick={() => deleteStage(p.id, s)}>×</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input style={{ flex: 1 }} placeholder="Назва нового етапу" value={newStageLabel[p.id] || ""} onChange={(e) => setNewStageLabel((s) => ({ ...s, [p.id]: e.target.value }))} />
              <button className="btn small" onClick={() => addStage(p.id)}>+ Етап</button>
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 6 }}>
          <input style={{ flex: 1 }} placeholder="Назва нової воронки" value={newPipelineName} onChange={(e) => setNewPipelineName(e.target.value)} />
          <button className="btn primary small" onClick={addPipeline}>+ Нова воронка</button>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Закрити</button>
        </div>
      </div>
    </div>
  );
}

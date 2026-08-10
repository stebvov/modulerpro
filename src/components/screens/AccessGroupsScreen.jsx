"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { PARTNER_TAB_OPTIONS } from "@/lib/partnerAccess";

export default function AccessGroupsScreen() {
  const { supabase } = useAppData();
  const [groups, setGroups] = useState([]);
  const [tabsByGroup, setTabsByGroup] = useState({});
  const [pipelinesByGroup, setPipelinesByGroup] = useState({});
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  async function load() {
    const [g, t, p, pl] = await Promise.all([
      supabase.from("partner_groups").select("*").order("sort_order"),
      supabase.from("partner_group_tabs").select("*"),
      supabase.from("partner_group_pipelines").select("*"),
      supabase.from("pipelines").select("*").order("sort_order"),
    ]);
    setGroups(g.data || []);
    const tabsMap = {};
    (t.data || []).forEach((row) => {
      if (!tabsMap[row.partner_group_id]) tabsMap[row.partner_group_id] = new Set();
      tabsMap[row.partner_group_id].add(row.tab_key);
    });
    setTabsByGroup(tabsMap);
    const pipeMap = {};
    (p.data || []).forEach((row) => {
      if (!pipeMap[row.partner_group_id]) pipeMap[row.partner_group_id] = new Set();
      pipeMap[row.partner_group_id].add(row.pipeline_id);
    });
    setPipelinesByGroup(pipeMap);
    setPipelines(pl.data || []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addGroup() {
    if (!newGroupName.trim()) return;
    const maxOrder = groups.length ? Math.max(...groups.map((g) => g.sort_order ?? 0)) : 0;
    const { error: e } = await supabase.from("partner_groups").insert([{ name: newGroupName.trim(), sort_order: maxOrder + 1 }]);
    if (e) { setError(e.message); return; }
    setError("");
    setNewGroupName("");
    await load();
  }
  async function renameGroup(id, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    await supabase.from("partner_groups").update({ name: trimmed }).eq("id", id);
    await load();
  }
  async function deleteGroup(g) {
    if (!confirm(`Видалити групу «${g.name}»? Користувачі цієї групи втратять доступ.`)) return;
    await supabase.from("partner_groups").delete().eq("id", g.id);
    await load();
  }
  async function toggleTab(groupId, tabKey) {
    const has = tabsByGroup[groupId]?.has(tabKey);
    if (has) {
      await supabase.from("partner_group_tabs").delete().eq("partner_group_id", groupId).eq("tab_key", tabKey);
    } else {
      await supabase.from("partner_group_tabs").insert([{ partner_group_id: groupId, tab_key: tabKey }]);
    }
    await load();
  }
  async function togglePipeline(groupId, pipelineId) {
    const has = pipelinesByGroup[groupId]?.has(pipelineId);
    if (has) {
      await supabase.from("partner_group_pipelines").delete().eq("partner_group_id", groupId).eq("pipeline_id", pipelineId);
    } else {
      await supabase.from("partner_group_pipelines").insert([{ partner_group_id: groupId, pipeline_id: pipelineId }]);
    }
    await load();
  }

  if (loading) return <div className="empty">Завантаження...</div>;

  return (
    <div>
      <p className="note">
        Групи доступу для ролі «Партнер» — обмежений зовнішній доступ (наприклад, для партнерів по маркетингу).
        Кожна група бачить лише дозволені вкладки, а якщо дозволено CRM — лише дозволені воронки. Користувача
        призначай на групу на вкладці «Користувачі».
      </p>
      {error && <div className="auth-error">{error}</div>}

      {groups.map((g) => {
        const grantedTabs = tabsByGroup[g.id] || new Set();
        const grantedPipelines = pipelinesByGroup[g.id] || new Set();
        const hasCrm = grantedTabs.has("crm");
        return (
          <div key={g.id} className="section-details" style={{ padding: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input style={{ flex: 1, fontWeight: 600 }} defaultValue={g.name} onBlur={(e) => renameGroup(g.id, e.target.value)} />
              <button className="btn small" style={{ color: "var(--danger)" }} onClick={() => deleteGroup(g)}>Видалити</button>
            </div>
            <div className="note" style={{ textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Дозволені вкладки</div>
            <div className="tag-checks" style={{ marginBottom: hasCrm ? 12 : 0 }}>
              {PARTNER_TAB_OPTIONS.map((t) => (
                <label className="tag-check" key={t.key}>
                  <input type="checkbox" checked={grantedTabs.has(t.key)} onChange={() => toggleTab(g.id, t.key)} />
                  {t.label}
                </label>
              ))}
            </div>
            {hasCrm && (
              <>
                <div className="note" style={{ textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Дозволені воронки CRM</div>
                <div className="tag-checks">
                  {pipelines.map((p) => (
                    <label className="tag-check" key={p.id}>
                      <input type="checkbox" checked={grantedPipelines.has(p.id)} onChange={() => togglePipeline(g.id, p.id)} />
                      {p.name}
                    </label>
                  ))}
                  {!pipelines.length && <span className="note">Немає жодної воронки</span>}
                </div>
              </>
            )}
          </div>
        );
      })}
      {!groups.length && <div className="empty">Немає жодної групи доступу</div>}

      <div className="cat-add">
        <input style={{ flex: 1 }} placeholder="Назва нової групи (напр. Партнер — Іванов)" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
        <button className="btn primary small" onClick={addGroup}>+ Нова група</button>
      </div>
    </div>
  );
}

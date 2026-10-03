"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/context/DataContext";
import { PARTNER_TAB_OPTIONS, ROLE_PRESETS } from "@/lib/partnerAccess";

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
  // готова роль: назва, опис, розділи (і за потреби — редагування CRM; воронки обираються далі)
  async function addPreset(pr) {
    const maxOrder = groups.length ? Math.max(...groups.map((g) => g.sort_order ?? 0)) : 0;
    const name = groups.some((g) => g.name === pr.name) ? `${pr.name} ${groups.length + 1}` : pr.name;
    const { data, error: e } = await supabase.from("partner_groups").insert([{ name, sort_order: maxOrder + 1, description: pr.description, crm_edit: pr.crm_edit }]).select().single();
    if (e) {
      // база ще без нових полів — створюємо без них
      const r = await supabase.from("partner_groups").insert([{ name, sort_order: maxOrder + 1 }]).select().single();
      if (r.error) { setError(r.error.message); return; }
      await supabase.from("partner_group_tabs").insert(pr.tabs.map((t) => ({ partner_group_id: r.data.id, tab_key: t })));
    } else {
      await supabase.from("partner_group_tabs").insert(pr.tabs.map((t) => ({ partner_group_id: data.id, tab_key: t })));
    }
    setError("");
    await load();
  }
  async function setGroupField(id, patch) {
    const { error: e } = await supabase.from("partner_groups").update(patch).eq("id", id);
    if (e) { setError(e.message); return; }
    setError("");
    await load();
  }
  async function renameGroup(id, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    await supabase.from("partner_groups").update({ name: trimmed }).eq("id", id);
    await load();
  }
  async function deleteGroup(g) {
    if (!confirm(`Видалити роль «${g.name}»? Люди з цією роллю втратять доступ.`)) return;
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
        Ролі для людей з обмеженим доступом: кожна роль бачить лише відкриті їй розділи, а в CRM — лише вибрані воронки.
        Людину запрошують на вкладці «Зовнішні логіни» з роллю «Роль із доступом» і вибирають їй роль звідси.
      </p>
      {error && <div className="auth-error">{error}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 16px" }}>
        {ROLE_PRESETS.map((pr) => <button key={pr.name} className="btn small" onClick={() => addPreset(pr)} title={pr.description}>+ Роль: {pr.name.toLowerCase()}</button>)}
      </div>

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
            <input className="note" style={{ width: "100%", marginBottom: 10 }} defaultValue={g.description || ""} placeholder="Опис ролі: для кого й навіщо (необовʼязково)" onBlur={(e) => { if ((g.description || "") !== e.target.value) setGroupField(g.id, { description: e.target.value.trim() || null }); }} />
            <div className="note" style={{ textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Дозволені розділи</div>
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
                <label className="tag-check" style={{ marginTop: 10, display: "inline-flex" }}>
                  <input type="checkbox" checked={!!g.crm_edit} onChange={(e) => setGroupField(g.id, { crm_edit: e.target.checked })} />
                  Може змінювати угоди й ліди в цих воронках (етапи, поля, нотатки, нові ліди)
                </label>
                {!grantedPipelines.size && <p className="note" style={{ color: "var(--amber)" }}>Оберіть хоча б одну воронку — інакше в CRM буде порожньо.</p>}
              </>
            )}
          </div>
        );
      })}
      {!groups.length && <div className="empty">Ще немає жодної ролі</div>}

      <div className="cat-add">
        <input style={{ flex: 1 }} placeholder="Назва нової ролі (напр. Маркетолог — Іванов)" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
        <button className="btn primary small" onClick={addGroup}>+ Порожня роль</button>
      </div>
    </div>
  );
}

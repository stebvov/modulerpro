"use client";

// 📁 Папки каталогу (Моделі, Послуги, Товари): дерево зліва (на телефоні — рядок папок зверху).
// Вибір папки фільтрує список (разом із підпапками). Картку можна перетягнути на папку — вона туди переміститься.
// Керування (адмін/менеджер): + папка, підпапка, перейменувати, вище/нижче, видалити (вміст переходить на рівень вище).
import { useMemo, useState } from "react";
import { useAppData } from "@/context/DataContext";
import SelectSearch from "@/components/SelectSearch";
import { inBranch, treeOptions } from "@/lib/tree";
import "./catalog.css";

export const NO_FOLDER = "none";

// чи елемент потрапляє у вибрану папку ("" — усі, "none" — без папки)
export function inFolder(folders, folderId, selected) {
  if (!selected) return true;
  if (selected === NO_FOLDER) return !folderId;
  return !!folderId && inBranch(folders, folderId, selected);
}

export function useFolders(scope) {
  const { catalogFolders = [] } = useAppData();
  return useMemo(() => catalogFolders.filter((f) => f.scope === scope), [catalogFolders, scope]);
}

// вибір папки у формі елемента
export function FolderSelect({ scope, value, onChange, width = 260 }) {
  const folders = useFolders(scope);
  return (
    <SelectSearch
      value={value || ""}
      options={treeOptions(folders, (f) => `📁 ${f.name}`)}
      onChange={(v) => onChange(v || null)}
      placeholder="Без папки"
      emptyLabel="Без папки"
      width={width}
      ariaLabel="Папка"
    />
  );
}

export default function FolderTree({ scope, items, selected, onSelect, canEdit, onMoveItem, title = "Папки" }) {
  const { supabase, reload } = useAppData();
  const folders = useFolders(scope);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [dropOn, setDropOn] = useState(null);

  const kids = (pid) => folders.filter((f) => (f.parent_id || null) === pid).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "uk"));
  const count = (id) => items.filter((x) => x.folder_id && inBranch(folders, x.folder_id, id)).length;
  const noFolder = items.filter((x) => !x.folder_id).length;
  const sel = folders.find((f) => f.id === selected) || null;

  async function run(fn) {
    setBusy(true); setErr("");
    try { await fn(); await reload(true); } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  }
  function add(parentId) {
    const name = (window.prompt(parentId ? "Назва підпапки" : "Назва папки") || "").trim();
    if (!name) return;
    run(async () => {
      const siblings = kids(parentId || null);
      const { data, error } = await supabase.from("catalog_folders")
        .insert({ scope, name, parent_id: parentId || null, sort_order: siblings.length }).select().single();
      if (error) throw error;
      onSelect(data.id);
    });
  }
  function rename(f) {
    const name = (window.prompt("Нова назва папки", f.name) || "").trim();
    if (!name || name === f.name) return;
    run(async () => { const { error } = await supabase.from("catalog_folders").update({ name }).eq("id", f.id); if (error) throw error; });
  }
  function move(f, dir) {
    const list = kids(f.parent_id || null);
    const i = list.findIndex((x) => x.id === f.id), j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    run(async () => { await Promise.all(next.map((x, k) => supabase.from("catalog_folders").update({ sort_order: k }).eq("id", x.id))); });
  }
  function setParent(f, parentId) {
    if (parentId && inBranch(folders, parentId, f.id)) { setErr("Папку не можна вкласти саму в себе."); return; }
    run(async () => { const { error } = await supabase.from("catalog_folders").update({ parent_id: parentId || null }).eq("id", f.id); if (error) throw error; });
  }
  function remove(f) {
    const n = count(f.id);
    if (!window.confirm(`Видалити папку «${f.name}»?${n ? ` ${n} поз. перейдуть ${f.parent_id ? "у папку вище" : "в «Без папки»"}.` : ""} Підпапки піднімуться на рівень вище.`)) return;
    run(async () => {
      const table = { models: "product_templates", services: "services", products: "catalog_products", packages: "packages" }[scope];
      const up = f.parent_id || null;
      const r1 = await supabase.from(table).update({ folder_id: up }).eq("folder_id", f.id);
      if (r1.error) throw r1.error;
      const r2 = await supabase.from("catalog_folders").update({ parent_id: up }).eq("parent_id", f.id);
      if (r2.error) throw r2.error;
      const r3 = await supabase.from("catalog_folders").delete().eq("id", f.id);
      if (r3.error) throw r3.error;
      onSelect(up || "");
    });
  }

  const dropProps = (folderId) => !onMoveItem || !canEdit ? {} : {
    onDragOver: (e) => { if (e.dataTransfer.types.includes("text/x-catalog-item")) { e.preventDefault(); setDropOn(folderId ?? "root"); } },
    onDragLeave: () => setDropOn(null),
    onDrop: (e) => {
      e.preventDefault(); setDropOn(null);
      const id = e.dataTransfer.getData("text/x-catalog-item");
      if (id) onMoveItem(id, folderId);
    },
  };

  function node(f, depth) {
    const open = selected === f.id || inBranch(folders, selected, f.id);
    const sub = kids(f.id);
    return (
      <div key={f.id}>
        <button type="button" className={`ft-node${selected === f.id ? " on" : ""}${dropOn === f.id ? " drop" : ""}`} style={{ paddingLeft: 8 + depth * 14 }} onClick={() => onSelect(f.id)} {...dropProps(f.id)}>
          <span className="ft-ico">{open && sub.length ? "📂" : "📁"}</span>
          <span className="ft-name">{f.name}</span>
          <span className="ft-n">{count(f.id) || ""}</span>
        </button>
        {open && sub.map((c) => node(c, depth + 1))}
      </div>
    );
  }

  // шлях до вибраної папки — для рядка на телефоні
  const path = [];
  for (let x = sel, g = 0; x && g < 20; g++) { path.unshift(x); x = folders.find((y) => y.id === x.parent_id); }
  const mobileList = sel ? kids(sel.id) : kids(null);

  return (
    <aside className="ft">
      <div className="ft-head">
        <b>{title}</b>
        {canEdit && <button type="button" className="btn small" disabled={busy} onClick={() => add(null)} title="Нова папка">+ Папка</button>}
      </div>

      {/* компʼютер: дерево */}
      <div className="ft-tree">
        <button type="button" className={`ft-node${!selected ? " on" : ""}`} onClick={() => onSelect("")}><span className="ft-ico">🗂</span><span className="ft-name">Усі</span><span className="ft-n">{items.length}</span></button>
        {kids(null).map((f) => node(f, 0))}
        <button type="button" className={`ft-node ft-node--none${selected === NO_FOLDER ? " on" : ""}${dropOn === "root" ? " drop" : ""}`} onClick={() => onSelect(NO_FOLDER)} {...dropProps(null)}>
          <span className="ft-ico">·</span><span className="ft-name">Без папки</span><span className="ft-n">{noFolder || ""}</span>
        </button>
      </div>

      {/* телефон: шлях + підпапки в рядок із прокруткою */}
      <div className="ft-mobile">
        <div className="ft-chips">
          <button type="button" className={`subtab${!selected ? " active" : ""}`} onClick={() => onSelect("")}>🗂 Усі · {items.length}</button>
          {path.map((f) => <button key={f.id} type="button" className={`subtab${selected === f.id ? " active" : ""}`} onClick={() => onSelect(f.id)}>📂 {f.name}</button>)}
          {mobileList.map((f) => <button key={f.id} type="button" className="subtab" onClick={() => onSelect(f.id)}>📁 {f.name} · {count(f.id)}</button>)}
          <button type="button" className={`subtab${selected === NO_FOLDER ? " active" : ""}`} onClick={() => onSelect(NO_FOLDER)}>Без папки · {noFolder}</button>
        </div>
      </div>

      {canEdit && sel && (
        <div className="ft-actions">
          <span className="note">📂 {sel.name}</span>
          <div className="ft-actions__row">
            <button type="button" className="btn small" disabled={busy} onClick={() => add(sel.id)}>+ Підпапка</button>
            <button type="button" className="btn small" disabled={busy} onClick={() => rename(sel)}>✎</button>
            <button type="button" className="btn small" disabled={busy} onClick={() => move(sel, -1)} title="Вище">▲</button>
            <button type="button" className="btn small" disabled={busy} onClick={() => move(sel, 1)} title="Нижче">▼</button>
            <button type="button" className="btn small danger" disabled={busy} onClick={() => remove(sel)} title="Видалити папку">🗑</button>
          </div>
          <div className="ft-actions__row">
            <span className="note" style={{ margin: 0 }}>Всередині:</span>
            <SelectSearch
              value={sel.parent_id || ""}
              options={treeOptions(folders.filter((f) => f.id !== sel.id && !inBranch(folders, f.id, sel.id)), (f) => `📁 ${f.name}`)}
              onChange={(v) => setParent(sel, v)}
              emptyLabel="— верхній рівень —"
              placeholder="— верхній рівень —"
              width={170}
              ariaLabel="Батьківська папка"
            />
          </div>
        </div>
      )}
      {canEdit && onMoveItem && <p className="note ft-hint">Перетягніть картку на папку, щоб перемістити.</p>}
      {err && <div className="auth-error">{err}</div>}
    </aside>
  );
}

// атрибути для картки, яку можна перетягнути на папку
export function dragItem(id, enabled = true) {
  return enabled ? { draggable: true, onDragStart: (e) => { e.dataTransfer.setData("text/x-catalog-item", id); e.dataTransfer.effectAllowed = "move"; } } : {};
}

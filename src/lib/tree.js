// Довідники-дерева (категорії з parent_id): опції для SelectSearch і перевірка «входить у гілку».

// [{ value, label, depth }] — батьки перед дітьми; без parent_id — плоский список.
export function treeOptions(items, label = (x) => x.name) {
  const out = [];
  const seen = new Set();
  const walk = (pid, d) => items.filter((c) => (c.parent_id || null) === pid).forEach((c) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    out.push({ value: c.id, label: label(c), depth: d });
    walk(c.id, d + 1);
  });
  walk(null, 0);
  // сироти (батька видалено) — в кінець, щоб не зникали з фільтра
  items.filter((c) => !seen.has(c.id)).forEach((c) => out.push({ value: c.id, label: label(c), depth: 0 }));
  return out;
}

// id дорівнює rootId або лежить у його гілці
export function inBranch(items, id, rootId) {
  if (!rootId) return true;
  let x = items.find((c) => c.id === id);
  for (let guard = 0; x && guard < 50; guard++) {
    if (x.id === rootId) return true;
    x = items.find((c) => c.id === x.parent_id);
  }
  return false;
}

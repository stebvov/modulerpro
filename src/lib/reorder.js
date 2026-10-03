// Ручний порядок у списках: перенумеровуємо весь список 0..n-1 (щоб «вище/нижче» працювало навіть при однакових позиціях).
// list — уже відсортований масив рядків; повертає новий масив із оновленим полем порядку.
export async function moveInList(supabase, table, list, id, dir, col = "sort_order") {
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return null;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  const renumbered = next.map((x, k) => ({ ...x, [col]: k }));
  const changed = renumbered.filter((x, k) => list.find((y) => y.id === x.id)?.[col] !== k);
  const res = await Promise.all(changed.map((x) => supabase.from(table).update({ [col]: x[col] }).eq("id", x.id)));
  const err = res.find((r) => r.error)?.error;
  if (err) throw err;
  return renumbered;
}

// Поміняти місцями два сусідні елементи видимого списку (у папці, з фільтром): обмін значеннями порядку.
// Якщо значення однакові (старі дані) — спершу перенумеровуємо весь список allSorted.
export async function swapOrder(supabase, table, allSorted, a, b, col = "sort_order") {
  let va = a[col], vb = b[col];
  if (va == null || vb == null || va === vb || new Set(allSorted.map((x) => x[col])).size !== allSorted.length) {
    const res = await Promise.all(allSorted.map((x, k) => supabase.from(table).update({ [col]: k }).eq("id", x.id)));
    const err = res.find((r) => r.error)?.error;
    if (err) throw err;
    va = allSorted.findIndex((x) => x.id === a.id);
    vb = allSorted.findIndex((x) => x.id === b.id);
  }
  const r = await Promise.all([
    supabase.from(table).update({ [col]: vb }).eq("id", a.id),
    supabase.from(table).update({ [col]: va }).eq("id", b.id),
  ]);
  const err = r.find((x) => x.error)?.error;
  if (err) throw err;
}

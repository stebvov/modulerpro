// Depth-first flattening of a nested category list (respecting each level's
// sort_order) into a Map(categoryId -> flat priority index). Used to sort
// materials by "where their category sits in the Categories tab", including
// nested child categories.
export function flattenCategoryOrder(categories) {
  const map = new Map();
  let i = 0;
  function walk(parentId) {
    categories
      .filter((c) => (c.parent_id || null) === parentId)
      .forEach((c) => {
        map.set(c.id, i++);
        walk(c.id);
      });
  }
  walk(null);
  return map;
}

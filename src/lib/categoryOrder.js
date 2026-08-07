// Depth-first flattening of a nested category list (respecting each level's
// sort_order) into a Map(categoryId -> flat priority index). Used to sort
// materials by "where their category sits in the Categories tab", including
// nested child categories.
// A category and every descendant's id (depth-first), used so filtering by
// a parent category also matches items filed under its children.
export function getCategoryAndDescendantIds(categoryId, categories) {
  const ids = [categoryId];
  function walk(parentId) {
    categories
      .filter((c) => c.parent_id === parentId)
      .forEach((c) => {
        ids.push(c.id);
        walk(c.id);
      });
  }
  walk(categoryId);
  return ids;
}

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

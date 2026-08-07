export async function savePrice(supabase, { supplierId, materialId, price, updatedBy, note }) {
  return supabase
    .from("supplier_prices")
    .upsert(
      [
        {
          supplier_id: supplierId,
          material_id: materialId,
          price,
          currency: "UAH",
          updated_at: new Date().toISOString(),
          source: "manual",
          updated_by: updatedBy || null,
          note: note !== undefined ? (note || null) : undefined,
        },
      ],
      { onConflict: "supplier_id,material_id" }
    );
}

// If the material's category isn't already linked to the supplier, link it —
// keeps "what does this supplier deal in" consistent with what's actually
// been priced for them.
export async function ensureSupplierHasCategory(supabase, { supplierId, materialId, materials, supplierCategoryLinks }) {
  const material = materials.find((m) => m.id === materialId);
  if (!material?.category_id) return;
  const alreadyLinked = supplierCategoryLinks.some(
    (l) => l.supplier_id === supplierId && l.category_id === material.category_id
  );
  if (alreadyLinked) return;
  await supabase.from("supplier_category_links").insert([{ supplier_id: supplierId, category_id: material.category_id }]);
}

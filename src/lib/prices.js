export async function savePrice(supabase, { supplierId, materialId, price, updatedBy }) {
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
        },
      ],
      { onConflict: "supplier_id,material_id" }
    );
}

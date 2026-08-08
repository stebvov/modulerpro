"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ProductionDataContext = createContext(null);

const EMPTY = {
  sites: [],
  slots: [],
  stages: [],
  houseDeals: [],
  templates: [],
};

export function ProductionDataProvider({ children }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [sites, slots, stages, houseDeals, templates] = await Promise.all([
          supabase.from("production_sites").select("*").order("sort_order"),
          supabase.from("production_slots").select("*").order("start_date"),
          supabase.from("production_stages").select("*"),
          supabase
            .from("deals")
            .select("id, is_custom, custom_area_m2, template_id, quantity, leads(name), pipelines!inner(slug)")
            .eq("pipelines.slug", "houses"),
          supabase.from("product_templates").select("id,name,area_m2"),
        ]);
        const firstError = [sites, slots, stages, houseDeals, templates].find((r) => r.error);
        if (firstError) throw firstError.error;

        setData({
          sites: sites.data || [],
          slots: slots.data || [],
          stages: stages.data || [],
          houseDeals: (houseDeals.data || []).map((d) => ({ ...d, lead_name: d.leads?.name || null })),
          templates: templates.data || [],
        });
        setError(null);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    // Initial data fetch on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const value = { ...data, loading, error, reload, supabase };

  return <ProductionDataContext.Provider value={value}>{children}</ProductionDataContext.Provider>;
}

export function useProductionData() {
  const ctx = useContext(ProductionDataContext);
  if (!ctx) throw new Error("useProductionData must be used within ProductionDataProvider");
  return ctx;
}

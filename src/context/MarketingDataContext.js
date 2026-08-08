"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MarketingDataContext = createContext(null);

const EMPTY = {
  assets: [],
  campaigns: [],
  templates: [],
};

export function MarketingDataProvider({ children }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [assets, campaigns, templates] = await Promise.all([
          supabase.from("marketing_assets").select("*").order("scheduled_at"),
          supabase.from("campaigns").select("*").order("created_at"),
          supabase.from("product_templates").select("id,name").order("sort_order"),
        ]);
        const firstError = [assets, campaigns, templates].find((r) => r.error);
        if (firstError) throw firstError.error;

        setData({
          assets: assets.data || [],
          campaigns: campaigns.data || [],
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

  return <MarketingDataContext.Provider value={value}>{children}</MarketingDataContext.Provider>;
}

export function useMarketingData() {
  const ctx = useContext(MarketingDataContext);
  if (!ctx) throw new Error("useMarketingData must be used within MarketingDataProvider");
  return ctx;
}

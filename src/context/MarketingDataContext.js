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
        const [assets, campaigns, templates, channels] = await Promise.all([
          supabase.from("marketing_assets").select("*").order("scheduled_at"),
          supabase.from("campaigns").select("*").order("created_at"),
          supabase.from("product_templates").select("id,name").order("sort_order"),
          supabase.from("marketing_channels").select("*").order("sort"),
        ]);
        const firstError = [assets, campaigns, templates, channels].find((r) => r.error);
        if (firstError) throw firstError.error;

        setData({
          assets: assets.data || [],
          campaigns: campaigns.data || [],
          templates: templates.data || [],
          channels: channels.data || [],
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

  // канали — з довідника marketing_channels (редагуються у ⚙ Канали)
  const channelMeta = useMemo(() => {
    const all = data.channels || [];
    return {
      CHANNELS: all.filter((c) => c.active).map((c) => c.key),
      CHANNEL_LABELS: Object.fromEntries(all.map((c) => [c.key, c.label])),
      CHANNEL_COLORS: Object.fromEntries(all.map((c) => [c.key, c.color || "var(--text-secondary)"])),
    };
  }, [data.channels]);
  const value = { ...data, ...channelMeta, loading, error, reload, supabase };

  return <MarketingDataContext.Provider value={value}>{children}</MarketingDataContext.Provider>;
}

export function useMarketingData() {
  const ctx = useContext(MarketingDataContext);
  if (!ctx) throw new Error("useMarketingData must be used within MarketingDataProvider");
  return ctx;
}

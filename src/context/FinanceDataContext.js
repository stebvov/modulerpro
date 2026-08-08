"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const FinanceDataContext = createContext(null);

const EMPTY = {
  monthlyPnl: [],
  cumulativePnl: [],
  deals: [],
  sites: [],
  overheadTransactions: [],
};

export function FinanceDataProvider({ children }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [monthlyPnl, cumulativePnl, deals, sites, overheadTransactions] = await Promise.all([
          supabase.from("v_monthly_pnl").select("*").order("month"),
          supabase.from("v_cumulative_net_profit").select("*").order("month"),
          supabase.from("deals").select("id, created_at, leads(name)").order("created_at", { ascending: false }).limit(200),
          supabase.from("production_sites").select("id, name").order("sort_order"),
          supabase
            .from("transactions")
            .select("id, date, amount, category, note, site_id, production_sites(name)")
            .eq("type", "витрата-офіс")
            .order("date", { ascending: false }),
        ]);
        const firstError = [monthlyPnl, cumulativePnl, deals, sites, overheadTransactions].find((r) => r.error);
        if (firstError) throw firstError.error;

        setData({
          monthlyPnl: monthlyPnl.data || [],
          cumulativePnl: cumulativePnl.data || [],
          deals: (deals.data || []).map((d) => ({ id: d.id, leadName: d.leads?.name || null })),
          sites: sites.data || [],
          overheadTransactions: (overheadTransactions.data || []).map((t) => ({ ...t, siteName: t.production_sites?.name || null })),
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

  return <FinanceDataContext.Provider value={value}>{children}</FinanceDataContext.Provider>;
}

export function useFinanceData() {
  const ctx = useContext(FinanceDataContext);
  if (!ctx) throw new Error("useFinanceData must be used within FinanceDataProvider");
  return ctx;
}

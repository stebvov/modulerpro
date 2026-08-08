"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ServicesDataContext = createContext(null);

const EMPTY = {
  partners: [],
  executions: [],
  dealServices: [],
};

const EXECUTION_SELECT =
  "*, service_partners(id,name,service_type), deal_services(id,service_type,price,cost_estimate,deal_id,deals(id,leads(name)))";
const DEAL_SERVICE_SELECT = "id,service_type,price,cost_estimate,deal_id,deals(id,leads(name))";

export function ServicesDataProvider({ children }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [partners, executions, dealServices] = await Promise.all([
          supabase.from("service_partners").select("*").order("name"),
          supabase.from("service_execution").select(EXECUTION_SELECT).order("created_at", { ascending: false }),
          supabase.from("deal_services").select(DEAL_SERVICE_SELECT).order("created_at", { ascending: false }),
        ]);
        const firstError = [partners, executions, dealServices].find((r) => r.error);
        if (firstError) throw firstError.error;

        setData({
          partners: partners.data || [],
          executions: executions.data || [],
          dealServices: dealServices.data || [],
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

  return <ServicesDataContext.Provider value={value}>{children}</ServicesDataContext.Provider>;
}

export function useServicesData() {
  const ctx = useContext(ServicesDataContext);
  if (!ctx) throw new Error("useServicesData must be used within ServicesDataProvider");
  return ctx;
}

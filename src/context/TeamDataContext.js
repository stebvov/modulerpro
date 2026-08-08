"use client";

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TeamDataContext = createContext(null);

export function TeamDataProvider({ children }) {
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const { data, error: e } = await supabase.from("team_members").select("*").order("name");
        if (e) throw e;
        setMembers(data || []);
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

  const value = { members, loading, error, reload, supabase };

  return <TeamDataContext.Provider value={value}>{children}</TeamDataContext.Provider>;
}

export function useTeamData() {
  const ctx = useContext(TeamDataContext);
  if (!ctx) throw new Error("useTeamData must be used within TeamDataProvider");
  return ctx;
}

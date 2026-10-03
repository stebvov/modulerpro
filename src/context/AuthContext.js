"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [partnerTabs, setPartnerTabs] = useState(null);
  const [partnerCrmEdit, setPartnerCrmEdit] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(
    async (currentUser) => {
      if (!currentUser) {
        setProfile(null);
        setPartnerTabs(null);
        setPartnerCrmEdit(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();
      setProfile(data || null);
      if (data?.role === "partner" && data.partner_group_id) {
        const { data: tabs } = await supabase.from("partner_group_tabs").select("tab_key").eq("partner_group_id", data.partner_group_id);
        setPartnerTabs(new Set((tabs || []).map((t) => t.tab_key)));
        // роль може мати право змінювати угоди у своїх воронках (база все одно перевіряє кожну воронку)
        const { data: grp } = await supabase.from("partner_groups").select("*").eq("id", data.partner_group_id).maybeSingle();
        setPartnerCrmEdit(!!grp?.crm_edit);
      } else {
        setPartnerTabs(null);
        setPartnerCrmEdit(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!active) return;
      setUser(u);
      await loadProfile(u);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      const u = session?.user || null;
      setUser(u);
      await loadProfile(u);
      setLoading(false);
      if (!u) router.push("/login");
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadProfile, router]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // пульт тримає свою копію сесії в localStorage — прибираємо, щоб наступний вхід у цьому браузері не підхопив чужий акаунт
    try { Object.keys(localStorage).filter((k) => k.startsWith("sb-")).forEach((k) => localStorage.removeItem(k)); } catch { /* приватний режим */ }
    router.push("/login");
  }, [supabase, router]);

  const role = profile?.role || null;

  const value = {
    user,
    profile,
    role,
    loading,
    signOut,
    refreshProfile: () => loadProfile(user),
    canWriteCatalog: role === "admin" || role === "manager",
    canWriteFinance: role === "admin" || role === "accountant",
    // CRM: адмін і менеджер — усе; роль із доступом — лише якщо їй дозволено змінювати угоди (у своїх воронках)
    canWriteCrm: role === "admin" || role === "manager" || (role === "partner" && partnerCrmEdit),
    isAdmin: role === "admin",
    isPartner: role === "partner",
    // null = no tab restriction (non-partner roles); Set = the only tab
    // groups a partner's access group has been granted.
    partnerTabs,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

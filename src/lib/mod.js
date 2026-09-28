"use client";

// Спільне для модулів «Містечка», «УК і сервіс», «Оренда і дохід»:
// завантаження рядків таблиці Supabase з CRUD і перерахунок валют.
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRows(table, { order = "created_at", ascending = true, filter, select = "*" } = {}) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    let q = supabase.from(table).select(select).order(order, { ascending });
    if (filter) q = filter(q);
    const { data, error: e } = await q;
    if (e) setError(e.message);
    else { setRows(data || []); setError(null); }
    setLoading(false);
  }, [supabase, table, order, ascending, filter, select]);

  useEffect(() => {
    // Initial load; reload() sets state after the fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const insert = useCallback(async (row) => {
    const { data, error: e } = await supabase.from(table).insert(row).select().single();
    if (e) return e.message;
    setRows((r) => [...r, data]);
    return null;
  }, [supabase, table]);

  const update = useCallback(async (id, patch) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error: e } = await supabase.from(table).update(patch).eq("id", id);
    if (e) { reload(); return e.message; }
    return null;
  }, [supabase, table, reload]);

  const remove = useCallback(async (id) => {
    const { error: e } = await supabase.from(table).delete().eq("id", id);
    if (e) return e.message;
    setRows((r) => r.filter((x) => x.id !== id));
    return null;
  }, [supabase, table]);

  return { rows, loading, error, reload, insert, update, remove, supabase };
}

// курси з exchange_rates Moduler Pro: rate_to_uah
export function fxTo(amount, from, to, rates) {
  if (amount == null || amount === "" || isNaN(Number(amount))) return null;
  const r = (c) => (c === "UAH" || !c ? 1 : Number((rates || []).find((x) => x.code === c)?.rate_to_uah) || 1);
  return (Number(amount) * r(from)) / r(to);
}

export function money(n, cur) {
  if (n == null || isNaN(n)) return "—";
  const s = Math.round(n).toLocaleString("uk-UA");
  return cur === "USD" ? `$${s}` : cur === "EUR" ? `€${s}` : `${s} грн`;
}

export const toNum = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return isFinite(n) ? n : null;
};

export const todayKyiv = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date());
export const nights = (a, b) => Math.max(0, Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 864e5));

// засновник (task_members.is_owner) — лише він бачить ціль і капітал
export function useIsOwner() {
  const supabase = useMemo(() => createClient(), []);
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    let on = true;
    supabase.auth.getUser().then(({ data }) => {
      const email = data?.user?.email;
      if (!email) return;
      supabase.from("task_members").select("is_owner").ilike("email", email).eq("active", true).maybeSingle()
        .then(({ data: m }) => { if (on) setOwner(!!m?.is_owner); });
    });
    return () => { on = false; };
  }, [supabase]);
  return owner;
}

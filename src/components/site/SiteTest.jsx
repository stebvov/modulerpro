"use client";
// Тест для кандидата за особистим посиланням (moduler.pro/test/<код>). Без входу в систему: питання й перевірка — через функції бази.
import { useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import TestRunner from "@/components/hr/TestRunner";

export default function SiteTest({ token }) {
  const supabase = useMemo(() => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } }), []);
  return (
    <section className="s-sec s-sec--cloud s-testsec">
      <div className="s-wrap">
        <TestRunner supabase={supabase} token={token} />
      </div>
    </section>
  );
}

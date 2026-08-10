import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Shared admin-only guard for /api/admin/* routes — mirrors the check in
// invite-user/route.js. Returns { user } on success or { error: NextResponse }
// to return directly from the route handler.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Не авторизовано." }, { status: 401 }) };
  }
  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Лише адміністратор має доступ." }, { status: 403 }) };
  }
  return { user };
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/apiAdminAuth";

// ~100 years — Supabase Auth has no permanent-ban primitive, only a
// ban_duration; "none" lifts it. This is the same magnitude used in the
// Supabase docs' own examples for an effectively-permanent ban.
const BAN_DURATION = "876000h";

export async function POST(request) {
  const { user: caller, error: authError } = await requireAdmin();
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const userId = body.userId;
  const blocked = !!body.blocked;
  if (!userId) {
    return NextResponse.json({ error: "Не вказано користувача." }, { status: 400 });
  }
  if (userId === caller.id && blocked) {
    return NextResponse.json({ error: "Не можна заблокувати самого себе." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY не налаштовано на сервері — додай змінну середовища у Vercel." },
      { status: 500 }
    );
  }

  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: blocked ? BAN_DURATION : "none" });
  if (banError) {
    return NextResponse.json({ error: banError.message }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").update({ is_blocked: blocked }).eq("id", userId);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ blocked });
}

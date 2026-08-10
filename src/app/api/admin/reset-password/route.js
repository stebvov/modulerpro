import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/apiAdminAuth";

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generatePassword(length = 12) {
  return Array.from({ length }, () => PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)]).join("");
}

export async function POST(request) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const userId = body.userId;
  if (!userId) {
    return NextResponse.json({ error: "Не вказано користувача." }, { status: 400 });
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

  const password = generatePassword();
  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(userId, { password });
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ email: updated.user.email, password });
}

// Після «Опублікувати» в конструкторі — скинути кеш сайту, щоб зміни одразу були на сторінках.
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Потрібно увійти" }, { status: 401 });
  const { data: can } = await supabase.rpc("mod_can");
  if (!can) return Response.json({ error: "Немає доступу до сайту" }, { status: 403 });
  revalidateTag("site", { expire: 0 });
  return Response.json({ ok: true });
}

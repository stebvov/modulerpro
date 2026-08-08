import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Server-only client authenticated with the service_role key — bypasses RLS
// and can call the Supabase Auth admin API (auth.admin.createUser, etc).
// NEVER import this from a Client Component; SUPABASE_SERVICE_ROLE_KEY has
// no NEXT_PUBLIC_ prefix specifically so Next.js keeps it off the bundle.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

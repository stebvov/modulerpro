import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login"];

export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run any code between createServerClient and getUser: it refreshes
  // the auth token and must run on every request that touches cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // після входу повертаємо туди, куди людина йшла (розділ ?s=…; хеш браузер збереже сам)
    const back = path.startsWith("/pult") ? "/" : path + request.nextUrl.search;
    if (back !== "/") url.searchParams.set("next", back);
    return NextResponse.redirect(url);
  }

  if (user && isPublic) {
    const next = request.nextUrl.searchParams.get("next");
    const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    return NextResponse.redirect(new URL(safe, request.url));
  }

  return supabaseResponse;
}

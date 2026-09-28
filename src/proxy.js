import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Домени публічного сайту: коли moduler.pro переведуть на Vercel, сайт відкриватиметься з кореня.
// На app.moduler.pro той самий сайт живе під /site (робоча копія).
const SITE_HOSTS = (process.env.SITE_HOSTS || "moduler.pro,www.moduler.pro").split(",").map((s) => s.trim()).filter(Boolean);

export default async function proxy(request) {
  const url = request.nextUrl;
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  const path = url.pathname;

  if (SITE_HOSTS.includes(host)) {
    // старі адреси сайту: index.html → /, modeli.html → /modeli
    if (path.endsWith(".html")) {
      const to = url.clone();
      to.pathname = path === "/index.html" ? "/" : path.replace(/\.html$/, "");
      return NextResponse.redirect(to, 301);
    }
    if (path === "/site" || path.startsWith("/site/")) {
      const to = url.clone();
      to.pathname = path.slice(5) || "/";
      return NextResponse.redirect(to, 301);
    }
    if (path.startsWith("/api/site")) return NextResponse.next();
    const headers = new Headers(request.headers);
    headers.set("x-site-base", "");
    const to = url.clone();
    to.pathname = "/site" + (path === "/" ? "" : path);
    return NextResponse.rewrite(to, { request: { headers } });
  }

  // публічний сайт і його API — без входу в систему
  if (path === "/site" || path.startsWith("/site/") || path.startsWith("/api/site")) {
    const headers = new Headers(request.headers);
    headers.delete("x-site-base");
    return NextResponse.next({ request: { headers } });
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

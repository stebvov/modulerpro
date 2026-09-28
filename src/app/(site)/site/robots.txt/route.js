// robots.txt: на робочій копії (app.moduler.pro/site) індексацію закрито, на домені сайту — відкрито.
import { getBase, getOrigin } from "@/lib/site/data";

export async function GET() {
  const [base, origin] = await Promise.all([getBase(), getOrigin()]);
  const body = base === "/site"
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\nDisallow: /preview\n\nSitemap: ${origin}/sitemap.xml\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

// robots.txt: на робочих і тестових копіях (app.moduler.pro/site, new.moduler.pro) індексацію закрито, на основному домені — відкрито.
import { getOrigin, isIndexable } from "@/lib/site/data";

export async function GET() {
  const [indexable, origin] = await Promise.all([isIndexable(), getOrigin()]);
  const body = !indexable
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\nDisallow: /preview\n\nSitemap: ${origin}/sitemap.xml\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

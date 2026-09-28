import { getBase } from "@/lib/site/data";
import { siteHref } from "@/lib/site/format";

export default async function NotFound() {
  const base = await getBase();
  return (
    <section className="s-sec s-sec--cloud">
      <div className="s-wrap s-head s-head--center">
        <div className="s-eyebrow">404</div>
        <h1 className="s-title">Такої сторінки немає</h1>
        <p className="s-lead">Можливо, її перейменували. Почніть з головної або з каталогу моделей.</p>
        <div className="s-actions">
          <a className="s-btn s-btn--primary" href={siteHref(base, "/")}>На головну</a>
          <a className="s-btn s-btn--outline" href={siteHref(base, "/modeli")}>Моделі</a>
        </div>
      </div>
    </section>
  );
}

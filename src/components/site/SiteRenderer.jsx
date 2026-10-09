// Малює сторінку сайту з блоків конструктора. Працює і на сервері (сайт), і в браузері (живий перегляд у конструкторі).
import { BLOCKS } from "@/lib/site/blocks";
import { quotes } from "@/lib/site/i18n";
import { imgProps, isExternal, paragraphs, rich, siteHref, stripHidden, youtubeId } from "@/lib/site/format";
import YouTube from "./YouTube";
import Gallery from "./Gallery";
import Catalog from "./Catalog";
import Calculator from "./Calculator";
import LeadForm from "./LeadForm";
import DaylightImage from "./DaylightImage";
import InvestCalc from "./InvestCalc";
import Vacancies from "./Vacancies";

// переклад написів із коду: на сервері його дає ctx.t (мовна версія), у живому перегляді конструктора — без перекладу
const tOf = (ctx) => ctx?.t || ((s) => s);

export function Btn({ link, base, kind = "primary", className = "" }) {
  if (!link?.label) return null;
  const href = siteHref(base, link.href);
  const ext = isExternal(href);
  return (
    <a className={`s-btn s-btn--${kind} ${className}`} href={href} {...(ext ? { target: "_blank", rel: "noopener" } : {})}>
      {link.label}
    </a>
  );
}

function Head({ b, center }) {
  if (!b.eyebrow && !b.title && !b.lead) return null;
  return (
    <div className={`s-head${center ? " s-head--center" : ""}`}>
      {b.eyebrow && <div className="s-eyebrow">{b.eyebrow}</div>}
      {b.title && <h2 className="s-title">{rich(b.title)}</h2>}
      {b.lead && <p className="s-lead">{rich(b.lead)}</p>}
    </div>
  );
}

function Section({ b, children, className = "", wide }) {
  return (
    <section id={b.anchor || undefined} className={`s-sec s-sec--${b.theme || "light"} ${className}`} data-block={b.id}>
      <div className={`s-wrap${wide ? " s-wrap--wide" : ""}`}>{children}</div>
    </section>
  );
}

function Hero({ b, ctx }) {
  const compact = b.variant === "compact";
  const vid = youtubeId(b.video);
  return (
    <section id={b.anchor || undefined} className={`s-hero ${compact ? "s-hero--compact" : "s-hero--photo"} s-sec--${b.theme || "dark"}`} data-block={b.id}>
      {b.image && <img className="s-hero__bg" alt="" {...imgProps(b.image)} fetchPriority="high" />}
      <div className="s-hero__veil" />
      <div className="s-wrap s-hero__grid">
        <div className="s-hero__text">
          {b.eyebrow && <div className="s-eyebrow">{b.eyebrow}</div>}
          <h1 className="s-hero__title">{rich(b.title)}</h1>
          {b.subtitle && <p className="s-hero__sub">{rich(b.subtitle)}</p>}
          {b.price && <div className="s-price-chip">{b.price}</div>}
          {!!b.bullets?.length && (
            <ul className="s-checks">{b.bullets.map((x, i) => <li key={i}>{x.text}</li>)}</ul>
          )}
          <div className="s-actions">
            <Btn link={b.cta_primary} base={ctx.base} />
            <Btn link={b.cta_secondary} base={ctx.base} kind="ghost" />
          </div>
        </div>
        {vid && !compact && (
          <div className="s-hero__media"><YouTube id={vid} caption={tOf(ctx)("Подивіться, як це виглядає наживо")} /></div>
        )}
      </div>
      {!!b.stats?.length && (
        <div className="s-wrap">
          <div className="s-hero__stats">
            {b.stats.map((s, i) => <div key={i}><b>{s.value}</b><span>{s.label}</span></div>)}
          </div>
        </div>
      )}
    </section>
  );
}

function Audience({ b, ctx }) {
  return (
    <Section b={b}>
      <Head b={b} />
      <div className={`s-aud s-aud--n${(b.items || []).length}`}>
        {(b.items || []).map((x, i) => {
          const href = siteHref(ctx.base, x.href);
          return (
            <a key={i} className="s-aud__card" href={href} {...(isExternal(href) ? { target: "_blank", rel: "noopener" } : {})}>
              <span className="s-aud__icon">{x.icon}</span>
              <h3>{x.title}</h3>
              <p>{x.text}</p>
              <span className="s-more">{x.cta || tOf(ctx)("Детальніше")} →</span>
            </a>
          );
        })}
      </div>
    </Section>
  );
}

// Картки проєктів: фото зі статусом, опис, посилання. Якщо карток не ділиться на 3 — перша ширша (див. site.css).
function Projects({ b, ctx }) {
  const items = b.items || [];
  const n = items.length;
  return (
    <Section b={b}>
      <Head b={b} />
      <div className={`s-grid s-grid--projects s-grid--r${n % 3}${n % 2 ? " s-grid--odd" : ""}`}>
        {items.map((x, i) => {
          const href = x.href ? siteHref(ctx.base, x.href) : "";
          const Tag = href ? "a" : "div";
          const link = href ? { href, ...(isExternal(href) ? { target: "_blank", rel: "noopener" } : {}) } : {};
          return (
            <Tag key={i} className="s-card s-proj" {...link}>
              <div className="s-card__img">
                {x.image ? <img alt={x.title || ""} loading="lazy" {...imgProps(x.image, "(min-width: 1000px) 66vw, 100vw")} /> : <div className="s-card__noimg">🏡</div>}
                {x.badge && <span className="s-card__tag">{x.badge}</span>}
              </div>
              <div className="s-card__body">
                {x.place && <div className="s-proj__place">{x.place}</div>}
                <h3>{rich(x.title)}</h3>
                {x.text && <p>{rich(x.text)}</p>}
                {href && <span className="s-more">{x.cta || tOf(ctx)("Детальніше")} →</span>}
              </div>
            </Tag>
          );
        })}
      </div>
    </Section>
  );
}

function Tiers({ b }) {
  return (
    <Section b={b}>
      <Head b={b} />
      <div className={`s-tiers s-tiers--n${(b.items || []).length}`}>
        {(b.items || []).map((t, i) => (
          <div key={i} className={`s-tier${t.highlight ? " s-tier--hl" : ""}`}>
            <div className="s-tier__n">{String(i + 1).padStart(2, "0")}</div>
            <h3>{t.name}</h3>
            {t.sub && <div className="s-tier__sub">{t.sub}</div>}
            <p>{rich(t.text)}</p>
            {t.price && <div className="s-tier__price">{t.price}</div>}
          </div>
        ))}
      </div>
      {b.note && <p className="s-note">{rich(b.note)}</p>}
    </Section>
  );
}

function Features({ b, ctx }) {
  return (
    <Section b={b}>
      <Head b={b} />
      <div className={`s-feats s-cols-${b.columns || 3}`}>
        {(b.items || []).map((f, i) => (
          <div key={i} className="s-feat">
            {f.icon && <div className="s-feat__icon">{f.icon}</div>}
            <h3>{f.title}</h3>
            <p>{rich(f.text)}</p>
          </div>
        ))}
      </div>
      {b.cta?.label && <div className="s-actions s-actions--center"><Btn link={b.cta} base={ctx.base} /></div>}
    </Section>
  );
}

function Reviews({ b, ctx }) {
  const items = (b.items || []).filter((r) => r.text);
  const [q1, q2] = quotes(ctx?.lang);
  if (!items.length) return null;
  return (
    <Section b={b}>
      <Head b={b} />
      <div className="s-reviews">
        {items.map((r, i) => {
          const vid = youtubeId(r.video);
          return (
            <figure key={i} className="s-review">
              {vid && <YouTube id={vid} />}
              <blockquote>{q1}{r.text}{q2}</blockquote>
              <figcaption>
                {r.photo && <img alt="" loading="lazy" src={r.photo.replace(/-1280\.webp$/, "-640.webp")} />}
                <span><b>{r.name}</b>{r.place && <small>{r.place}</small>}</span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </Section>
  );
}

function Steps({ b }) {
  return (
    <Section b={b}>
      <Head b={b} />
      <ol className="s-steps">
        {(b.items || []).map((s, i) => (
          <li key={i} className="s-step">
            <div className="s-step__n">{i + 1}</div>
            <div>
              <h3>{s.title}{s.time && <span className="s-step__time">{s.time}</span>}</h3>
              {s.text && <p>{rich(s.text)}</p>}
            </div>
          </li>
        ))}
      </ol>
      {b.note && <div className="s-callout">{rich(b.note)}</div>}
    </Section>
  );
}

function Faq({ b, ctx }) {
  const t = tOf(ctx);
  const side = !!(b.yes?.length || b.no?.length);
  return (
    <Section b={b}>
      <Head b={b} />
      <div className={`s-faq${side ? " s-faq--side" : ""}`}>
        <div className="s-acc">
          {(b.items || []).map((x, i) => (
            <details key={i} className="s-acc__item" name={`faq-${b.id}`}>
              <summary>{x.q}<span className="s-acc__plus" aria-hidden>+</span></summary>
              <div className="s-acc__a">{paragraphs(x.a).map((p, j) => <p key={j}>{rich(p, { links: true })}</p>)}</div>
            </details>
          ))}
        </div>
        {side && (
          <aside className="s-promise">
            {!!b.yes?.length && <><h4>{t("Що ми гарантуємо")}</h4><ul className="s-yes">{b.yes.map((x, i) => <li key={i}>{x.text}</li>)}</ul></>}
            {!!b.no?.length && <><h4>{t("Чесно не обіцяємо")}</h4><ul className="s-no">{b.no.map((x, i) => <li key={i}>{x.text}</li>)}</ul></>}
          </aside>
        )}
      </div>
    </Section>
  );
}

function Showroom({ b, ctx }) {
  return (
    <Section b={b}>
      <div className="s-split">
        <div>
          <Head b={b} />
          {!!b.bullets?.length && <ul className="s-checks s-checks--dark">{b.bullets.map((x, i) => <li key={i}>{x.text}</li>)}</ul>}
          {!!b.info?.length && (
            <div className="s-info">{b.info.map((x, i) => <div key={i}><span>{x.icon}</span><span>{x.text}</span></div>)}</div>
          )}
          <div className="s-actions">
            <Btn link={b.cta} base={ctx.base} />
            {b.map_url && <a className="s-btn s-btn--outline" href={b.map_url} target="_blank" rel="noopener">{tOf(ctx)("Маршрут на мапі")}</a>}
          </div>
        </div>
        {b.image && <img className="s-split__img" alt="" loading="lazy" {...imgProps(b.image, "(max-width: 900px) 100vw, 50vw")} />}
      </div>
    </Section>
  );
}

function TextImage({ b, ctx }) {
  const live = b.daylight && b.image && (b.image_evening || b.image_night || b.image_morning);
  return (
    <Section b={b}>
      <div className={`s-split${b.side === "left" ? " s-split--rev" : ""}${b.image ? "" : " s-split--solo"}`}>
        <div>
          {b.eyebrow && <div className="s-eyebrow">{b.eyebrow}</div>}
          {b.title && <h2 className="s-title">{rich(b.title)}</h2>}
          {paragraphs(b.text).map((p, i) => <p key={i} className="s-lead">{rich(p, { links: true })}</p>)}
          {b.cta?.label && <div className="s-actions"><Btn link={b.cta} base={ctx.base} /></div>}
        </div>
        {live ? (
          <DaylightImage images={{ day: b.image, morning: b.image_morning, evening: b.image_evening, night: b.image_night }} />
        ) : (
          b.image && <img className={`s-split__img${b.fit === "contain" ? " s-split__img--contain" : ""}`} alt="" loading="lazy" {...imgProps(b.image, "(max-width: 900px) 100vw, 50vw")} />
        )}
      </div>
    </Section>
  );
}

export function Choice({ b, ctx }) {
  const side = (k, main) => (
    <div className={`s-choice__card${main ? " s-choice__card--main" : ""}`}>
      {main && <span className="s-choice__tag">{tOf(ctx)("Рекомендуємо")}</span>}
      <h3>{b[`${k}_title`]}</h3>
      {b[`${k}_text`] && <p>{rich(b[`${k}_text`])}</p>}
      {!!b[`${k}_points`]?.length && <ul className={main ? "s-checks" : "s-checks s-checks--dark"}>{b[`${k}_points`].map((x, i) => <li key={i}>{x.text}</li>)}</ul>}
      <div className="s-actions"><Btn link={b[`${k}_cta`]} base={ctx.base} kind={main ? "primary" : "outline"} /></div>
    </div>
  );
  return (
    <Section b={b}>
      <Head b={b} />
      <div className="s-choice">{side("a", true)}{side("b", false)}</div>
    </Section>
  );
}

function Table({ b }) {
  const split = (t) => String(t || "").split("|").map((x) => x.trim());
  const head = split(b.head);
  return (
    <Section b={b}>
      <Head b={b} />
      <div className="s-table-wrap">
        <table className="s-table">
          <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>
            {(b.rows || []).map((r, i) => (
              <tr key={i} className={r.highlight ? "hl" : ""}>{split(r.cells).map((c, j) => (j ? <td key={j} data-label={head[j]}>{c}</td> : <th key={j} scope="row">{c}</th>))}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {b.note && <p className="s-note">{rich(b.note)}</p>}
    </Section>
  );
}

function Team({ b }) {
  return (
    <Section b={b}>
      <Head b={b} />
      <div className="s-team">
        {(b.items || []).map((p, i) => (
          <figure key={i} className="s-person">
            {p.photo && <img alt={p.name} loading="lazy" {...imgProps(p.photo, "(max-width: 700px) 100vw, 33vw")} />}
            <figcaption>
              {p.role && <span className="s-person__role">{p.role}</span>}
              <b>{p.name}</b>
              {p.text && <p>{rich(p.text)}</p>}
            </figcaption>
          </figure>
        ))}
      </div>
      {b.note && <div className="s-callout">{rich(b.note)}</div>}
    </Section>
  );
}

function Stats({ b }) {
  return (
    <Section b={b} className="s-sec--tight">
      <div className="s-stats">{(b.items || []).map((s, i) => <div key={i}><b>{s.value}</b><span>{s.label}</span></div>)}</div>
    </Section>
  );
}

function PhotoBand({ b }) {
  return (
    <section id={b.anchor || undefined} className="s-band" data-block={b.id}>
      {b.image && <img alt="" loading="lazy" {...imgProps(b.image)} />}
      <div className="s-band__veil" />
      <div className="s-wrap s-band__text">
        {b.title && <h2>{rich(b.title)}</h2>}
        {b.text && <p>{rich(b.text)}</p>}
      </div>
    </section>
  );
}

function TextBlock({ b }) {
  return (
    <Section b={b}>
      <div className="s-prose">
        {b.eyebrow && <div className="s-eyebrow">{b.eyebrow}</div>}
        {b.title && <h2 className="s-title">{rich(b.title)}</h2>}
        {paragraphs(b.body).map((p, i) => <p key={i}>{rich(p)}</p>)}
      </div>
    </Section>
  );
}

function CtaBand({ b, ctx }) {
  return (
    <Section b={b} className="s-ctaband">
      <div className="s-ctaband__in">
        <div>
          {b.title && <h2 className="s-title">{rich(b.title)}</h2>}
          {b.text && <p className="s-lead">{rich(b.text)}</p>}
        </div>
        <div className="s-actions">
          <Btn link={b.cta_primary} base={ctx.base} />
          <Btn link={b.cta_secondary} base={ctx.base} kind="outline" />
        </div>
      </div>
    </Section>
  );
}

const RENDER = {
  hero: Hero,
  audience: Audience,
  projects: Projects,
  models: ({ b, ctx }) => (
    <Section b={b}>
      <Head b={b} />
      <Catalog kind="models" items={(ctx.models || []).filter((m) => (b.kind === "all" ? true : (m.kind || "ready") === (b.kind || "ready")))} group={b.group} filters={b.filters} limit={Number(b.limit) || 0} base={ctx.base} />
      {b.cta?.label && <div className="s-center"><Btn link={b.cta} base={ctx.base} kind="outline" /></div>}
    </Section>
  ),
  calculator: ({ b, ctx }) => (
    <Section b={b}>
      <Head b={b} />
      <Calculator settings={ctx.settings || {}} models={ctx.models || []} note={b.note} />
    </Section>
  ),
  tiers: Tiers,
  features: Features,
  cases: ({ b, ctx }) => (
    <Section b={b}>
      <Head b={b} />
      <Catalog kind="cases" items={ctx.cases || []} group={b.kind} filters={b.filters} limit={Number(b.limit) || 0} base={ctx.base} />
      {b.cta?.label && <div className="s-center"><Btn link={b.cta} base={ctx.base} kind="outline" /></div>}
    </Section>
  ),
  reviews: Reviews,
  steps: Steps,
  faq: Faq,
  showroom: Showroom,
  text_image: TextImage,
  choice: Choice,
  invest: ({ b }) => (
    <Section b={b}>
      <Head b={b} />
      <InvestCalc b={b} />
    </Section>
  ),
  table: Table,
  team: Team,
  stats: Stats,
  photo_band: PhotoBand,
  gallery: ({ b }) => (
    <Section b={b}>
      <Head b={b} />
      <Gallery images={b.images || []} title={b.title} layout={b.layout === "plans" ? "plans" : "grid"} captions={b.captions} />
    </Section>
  ),
  video: ({ b }) => {
    const vid = youtubeId(b.video);
    if (!vid) return null;
    return (
      <Section b={b}>
        <Head b={b} />
        <div className="s-video"><YouTube id={vid} caption={b.caption} /></div>
      </Section>
    );
  },
  text: TextBlock,
  cta_band: CtaBand,
  vacancies: ({ b, ctx }) => (
    <Section b={b}>
      <Head b={b} center />
      <Vacancies initial={ctx.vacancies} emptyText={b.empty} formTitle={b.form_title} steps={b.steps} />
    </Section>
  ),
  lead_form: ({ b, ctx }) => (
    <Section b={b} className="s-formsec">
      <Head b={b} center />
      <LeadForm settings={ctx.settings || {}} goal={b.goal} goalSrc={b.goal_src} hint={b.hint} noArea={b.no_area} goalOptions={b.goals} goalOptionsSrc={b.goals_src} goalLabel={b.goal_label} pipeline={b.pipeline} />
    </Section>
  ),
};

export default function SiteRenderer({ blocks, ctx }) {
  return (
    <>
      {stripHidden(blocks || []).filter((b) => BLOCKS[b.type] && RENDER[b.type]).map((b) => { /* приховані блоки, пункти й фото не показуємо */
        const C = RENDER[b.type];
        return <C key={b.id} b={b} ctx={ctx} />;
      })}
    </>
  );
}

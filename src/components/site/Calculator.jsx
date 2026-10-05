"use client";
// Калькулятор: площа × рівень готовності + доставка в регіон + додаткові роботи → орієнтовна сума і заявка з розрахунком.
// Ставки задаються в «Сайт → Налаштування → Калькулятор». Немає ставки — показуємо параметри й просимо контакт.
import { useMemo, useState } from "react";
import { LEVELS } from "@/lib/site/blocks";
import { money } from "@/lib/site/format";
import LeadForm from "./LeadForm";
import { useT } from "./I18n";

const LEVEL_TEXT = {
  shell: "Каркас, утеплення, покрівля, фасад, вікна й двері",
  prefinish: "+ електрика, вода, каналізація, стіни й підлога під фініш",
  ready: "+ оздоблення, сантехніка, світло, кухня й меблі",
};

export default function Calculator({ settings, models, note }) {
  const { t, lang } = useT();
  const m2 = t("м²");
  const calc = settings.calc;
  const cur = calc?.currency || "USD";
  const { rates, regions, extras } = useMemo(() => ({
    rates: calc?.rates || {},
    regions: (calc?.regions || []).filter((r) => r.name),
    extras: (calc?.extras || []).filter((x) => x.name),
  }), [calc]);
  const quick = models.filter((m) => m.area_m2).slice(0, 6);

  const [area, setArea] = useState(quick[0] ? Number(quick[0].area_m2) : 40);
  const [level, setLevel] = useState("ready");
  const [region, setRegion] = useState(0);
  const [ext, setExt] = useState({});

  const r = useMemo(() => {
    const rate = Number(rates[level]) || 0;
    const house = rate ? area * rate : null;
    const reg = regions[region];
    const delivery = reg && Number(reg.price) ? Number(reg.price) : 0;
    const extra = extras.reduce((s, x, i) => (ext[i] ? s + (x.per === "m2" ? area * Number(x.price || 0) : Number(x.price || 0)) : s), 0);
    return { rate, house, delivery, extra, total: house == null ? null : house + delivery + extra };
  }, [area, level, region, ext, rates, regions, extras]);

  const levelName = t(LEVELS.find(([k]) => k === level)?.[1]);
  const summary = [
    `${area} ${m2}`, levelName,
    regions[region]?.name,
    ...extras.filter((_, i) => ext[i]).map((x) => x.name),
    r.total != null ? `≈ ${money(r.total, cur, lang)}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="s-calc">
      <div className="s-calc__in">
        <div className="s-field">
          <span>{t("Площа будинку:")} <b>{area} {m2}</b></span>
          <input type="range" min={15} max={160} step={5} value={area} onChange={(e) => setArea(Number(e.target.value))} aria-label={t("Площа, м²")} />
          {!!quick.length && (
            <div className="s-chips s-chips--sm">
              {quick.map((m) => (
                <button key={m.id} type="button" className={`s-chip${Number(m.area_m2) === area ? " on" : ""}`} onClick={() => setArea(Number(m.area_m2))}>{m.name}</button>
              ))}
            </div>
          )}
        </div>
        <div className="s-field">
          <span>{t("Рівень готовності")}</span>
          <div className="s-levels">
            {LEVELS.map(([k, name]) => (
              <button key={k} type="button" className={`s-level${level === k ? " on" : ""}`} onClick={() => setLevel(k)}>
                <b>{t(name)}</b><small>{t(LEVEL_TEXT[k])}</small>
                {Number(rates[k]) > 0 && <em>{money(rates[k], cur, lang)}/{m2}</em>}
              </button>
            ))}
          </div>
        </div>
        {!!regions.length && (
          <label className="s-field"><span>{t("Куди везти")}</span>
            <select value={region} onChange={(e) => setRegion(Number(e.target.value))}>
              {regions.map((x, i) => <option key={i} value={i}>{x.name}</option>)}
            </select>
          </label>
        )}
        {!!extras.length && (
          <div className="s-field"><span>{t("Додатково")}</span>
            <div className="s-extras">
              {extras.map((x, i) => (
                <label key={i} className="s-check"><input type="checkbox" checked={!!ext[i]} onChange={(e) => setExt({ ...ext, [i]: e.target.checked })} /> {x.name}</label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="s-calc__out">
        {r.total != null ? (
          <>
            <div className="s-calc__label">{t("Орієнтовна вартість")}</div>
            <div className="s-calc__sum">{money(r.total, cur, lang)}</div>
            <ul className="s-calc__lines">
              <li><span>{t("Будинок")} · {area} {m2} × {money(r.rate, cur, lang)}</span><b>{money(r.house, cur, lang)}</b></li>
              {!!r.delivery && <li><span>{t("Доставка")}</span><b>{money(r.delivery, cur, lang)}</b></li>}
              {!!r.extra && <li><span>{t("Додаткові роботи")}</span><b>{money(r.extra, cur, lang)}</b></li>}
            </ul>
          </>
        ) : (
          <>
            <div className="s-calc__label">{t("Ваш вибір")}</div>
            <div className="s-calc__sum s-calc__sum--sm">{area} {m2} · {levelName}</div>
            <p className="s-calc__hint">{t("Точну суму порахуємо під вашу ділянку й регіон і надішлемо в месенджер.")}</p>
          </>
        )}
        <p className="s-calc__note">{note || calc?.note || t("Фундамент, доставка й монтаж краном залежать від ділянки — точний кошторис підготуємо після розмови.")}</p>
        <LeadForm settings={settings} compact goal="Дім для себе: дача чи постійне житло" calc={summary} submitLabel={t("Отримати точний кошторис")} />
      </div>
    </div>
  );
}

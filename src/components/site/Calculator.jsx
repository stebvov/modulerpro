"use client";
// Калькулятор: площа × рівень готовності + доставка в регіон + додаткові роботи → орієнтовна сума і заявка з розрахунком.
// Ставки задаються в «Сайт → Налаштування → Калькулятор». Немає ставки — показуємо параметри й просимо контакт.
import { useMemo, useState } from "react";
import { LEVELS } from "@/lib/site/blocks";
import { money } from "@/lib/site/format";
import LeadForm from "./LeadForm";

const LEVEL_TEXT = {
  shell: "Каркас, утеплення, покрівля, фасад, вікна й двері",
  prefinish: "+ електрика, вода, каналізація, стіни й підлога під фініш",
  ready: "+ оздоблення, сантехніка, світло, кухня й меблі",
};

export default function Calculator({ settings, models, note }) {
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

  const levelName = LEVELS.find(([k]) => k === level)?.[1];
  const summary = [
    `${area} м²`, levelName,
    regions[region]?.name,
    ...extras.filter((_, i) => ext[i]).map((x) => x.name),
    r.total != null ? `≈ ${money(r.total, cur)}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="s-calc">
      <div className="s-calc__in">
        <div className="s-field">
          <span>Площа будинку: <b>{area} м²</b></span>
          <input type="range" min={15} max={160} step={5} value={area} onChange={(e) => setArea(Number(e.target.value))} aria-label="Площа, м²" />
          {!!quick.length && (
            <div className="s-chips s-chips--sm">
              {quick.map((m) => (
                <button key={m.id} type="button" className={`s-chip${Number(m.area_m2) === area ? " on" : ""}`} onClick={() => setArea(Number(m.area_m2))}>{m.name}</button>
              ))}
            </div>
          )}
        </div>
        <div className="s-field">
          <span>Рівень готовності</span>
          <div className="s-levels">
            {LEVELS.map(([k, name]) => (
              <button key={k} type="button" className={`s-level${level === k ? " on" : ""}`} onClick={() => setLevel(k)}>
                <b>{name}</b><small>{LEVEL_TEXT[k]}</small>
                {Number(rates[k]) > 0 && <em>{money(rates[k], cur)}/м²</em>}
              </button>
            ))}
          </div>
        </div>
        {!!regions.length && (
          <label className="s-field"><span>Куди везти</span>
            <select value={region} onChange={(e) => setRegion(Number(e.target.value))}>
              {regions.map((x, i) => <option key={i} value={i}>{x.name}</option>)}
            </select>
          </label>
        )}
        {!!extras.length && (
          <div className="s-field"><span>Додатково</span>
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
            <div className="s-calc__label">Орієнтовна вартість</div>
            <div className="s-calc__sum">{money(r.total, cur)}</div>
            <ul className="s-calc__lines">
              <li><span>Будинок · {area} м² × {money(r.rate, cur)}</span><b>{money(r.house, cur)}</b></li>
              {!!r.delivery && <li><span>Доставка</span><b>{money(r.delivery, cur)}</b></li>}
              {!!r.extra && <li><span>Додаткові роботи</span><b>{money(r.extra, cur)}</b></li>}
            </ul>
          </>
        ) : (
          <>
            <div className="s-calc__label">Ваш вибір</div>
            <div className="s-calc__sum s-calc__sum--sm">{area} м² · {levelName}</div>
            <p className="s-calc__hint">Точну суму порахуємо під вашу ділянку й регіон і надішлемо в месенджер.</p>
          </>
        )}
        <p className="s-calc__note">{note || calc?.note || "Фундамент, доставка й монтаж краном залежать від ділянки — точний кошторис підготуємо після розмови."}</p>
        <LeadForm settings={settings} compact goal="Дім для себе: дача чи постійне житло" calc={summary} submitLabel="Отримати точний кошторис" />
      </div>
    </div>
  );
}

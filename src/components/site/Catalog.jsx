"use client";
// Сітка моделей або кейсів з фільтрами: площа / тип об'єкта, а для моделей ще ширина модуля й кількість модулів.
import { useState } from "react";
import { CASE_KINDS, SIZE_GROUPS } from "@/lib/site/blocks";
import { CaseCard, ModelCard } from "./Cards";
import { caseKinds, num } from "@/lib/site/format";
import { matchesModules, moduleFilterOptions } from "@/lib/site/modules";
import { useT } from "./I18n";

export default function Catalog({ kind, items, group, filters, limit, base }) {
  const isModels = kind === "models";
  const labels = isModels ? SIZE_GROUPS : CASE_KINDS;
  // модель — одна група площі; кейс може мати кілька типів (соціальний + містечко)
  const has = (x, k) => (isModels ? String(x.size_group) === String(k) : caseKinds(x).includes(String(k)));
  const [f, setF] = useState("");
  const [w, setW] = useState(null); // ширина модуля, м
  const [c, setC] = useState(null); // кількість модулів
  const { t, lang } = useT();
  let list = group ? items.filter((x) => has(x, group)) : items;
  // популярні моделі — першими
  if (isModels) list = [...list].sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0));
  const present = Object.keys(labels).filter((k) => list.some((x) => has(x, k)));
  // фільтри модулів — лише в повному каталозі (не в короткій стрічці на головній)
  const mod = isModels && filters && !limit ? moduleFilterOptions(list) : { widths: [], counts: [] };
  const showArea = filters && !group && present.length > 1;
  const showW = mod.widths.length > 1, showC = mod.counts.length > 1;
  if (f) list = list.filter((x) => has(x, f));
  if (showW || showC) list = list.filter((x) => matchesModules(x, showW ? w : null, showC ? c : null));
  if (limit) list = list.slice(0, limit);
  const active = !!(f || (showW && w) || (showC && c));

  if (!items.length) {
    return <p className="s-muted">{isModels ? t("Моделі скоро з'являться. Розкажіть про задачу — підберемо формат.") : t("Кейси скоро з'являться.")}</p>;
  }
  return (
    <>
      {(showArea || showW || showC) && (
        <div className="s-filters">
          {showArea && (
            <div className="s-chips" role="tablist">
              <button type="button" className={`s-chip${!f ? " on" : ""}`} onClick={() => setF("")}>{t("Усі")}</button>
              {present.map((k) => (
                <button key={k} type="button" className={`s-chip${f === k ? " on" : ""}`} onClick={() => setF(k)}>{t(labels[k])}</button>
              ))}
            </div>
          )}
          {(showW || showC) && (
            <div className="s-filters__row">
              {showW && (
                <div className="s-filter">
                  <span className="s-filter__label">{t("Ширина модуля")}</span>
                  <div className="s-chips s-chips--sm">
                    {mod.widths.map((v) => (
                      <button key={v} type="button" className={`s-chip${w === v ? " on" : ""}`} aria-pressed={w === v} onClick={() => setW(w === v ? null : v)}>{num(v, lang)} {t("м")}</button>
                    ))}
                  </div>
                </div>
              )}
              {showC && (
                <div className="s-filter">
                  <span className="s-filter__label">{t("Модулів")}</span>
                  <div className="s-chips s-chips--sm">
                    {mod.counts.map((v) => (
                      <button key={v} type="button" className={`s-chip${c === v ? " on" : ""}`} aria-pressed={c === v} onClick={() => setC(c === v ? null : v)}>{num(v, lang)}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {limit > 0 && list.length > 1 && <div className="s-rail-hint">{t("Гортайте вбік →")}</div>}
      {!list.length && active && (
        <p className="s-muted s-filters__empty">
          {t("За такими параметрами моделей немає.")}{" "}
          <button type="button" className="s-linkbtn" onClick={() => { setF(""); setW(null); setC(null); }}>{t("Скинути фільтри")}</button>
        </p>
      )}
      <div className={`s-grid ${isModels ? "s-grid--models" : "s-grid--cases"}${limit > 0 ? " s-rail" : ""}`}>
        {list.map((x) => (isModels ? <ModelCard key={x.id} m={x} base={base} swipe={!(limit > 0)} /> : <CaseCard key={x.id} c={x} base={base} />))}
      </div>
    </>
  );
}

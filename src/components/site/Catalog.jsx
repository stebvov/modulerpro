"use client";
// Сітка моделей або кейсів з фільтром-вкладками (площа / тип об'єкта).
import { useState } from "react";
import { CASE_KINDS, SIZE_GROUPS } from "@/lib/site/blocks";
import { CaseCard, ModelCard } from "./Cards";
import { caseKinds } from "@/lib/site/format";
import { useT } from "./I18n";

export default function Catalog({ kind, items, group, filters, limit, base }) {
  const isModels = kind === "models";
  const labels = isModels ? SIZE_GROUPS : CASE_KINDS;
  // модель — одна група площі; кейс може мати кілька типів (соціальний + містечко)
  const has = (x, k) => (isModels ? String(x.size_group) === String(k) : caseKinds(x).includes(String(k)));
  const [f, setF] = useState("");
  const { t } = useT();
  let list = group ? items.filter((x) => has(x, group)) : items;
  // популярні моделі — першими
  if (isModels) list = [...list].sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0));
  const present = Object.keys(labels).filter((k) => list.some((x) => has(x, k)));
  if (f) list = list.filter((x) => has(x, f));
  if (limit) list = list.slice(0, limit);

  if (!items.length) {
    return <p className="s-muted">{isModels ? t("Моделі скоро з'являться. Розкажіть про задачу — підберемо формат.") : t("Кейси скоро з'являться.")}</p>;
  }
  return (
    <>
      {filters && !group && present.length > 1 && (
        <div className="s-chips" role="tablist">
          <button type="button" className={`s-chip${!f ? " on" : ""}`} onClick={() => setF("")}>{t("Усі")}</button>
          {present.map((k) => (
            <button key={k} type="button" className={`s-chip${f === k ? " on" : ""}`} onClick={() => setF(k)}>{t(labels[k])}</button>
          ))}
        </div>
      )}
      {limit > 0 && list.length > 1 && <div className="s-rail-hint">{t("Гортайте вбік →")}</div>}
      <div className={`s-grid ${isModels ? "s-grid--models" : "s-grid--cases"}${limit > 0 ? " s-rail" : ""}`}>
        {list.map((x) => (isModels ? <ModelCard key={x.id} m={x} base={base} /> : <CaseCard key={x.id} c={x} base={base} />))}
      </div>
    </>
  );
}

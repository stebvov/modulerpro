"use client";
// Мова сайту для компонентів у браузері: <LangProvider lang> у макеті, useT() — у компоненті.
// Тут лише написи з коду (кнопки, підписи полів); тексти з конструктора перекладає сервер (lib/site/data.js).
import { createContext, useContext } from "react";
import { DEFAULT_LANG, i18nKey } from "@/lib/site/i18n";
import { UI } from "@/lib/site/i18n-ui";

const Ctx = createContext(DEFAULT_LANG);

export function LangProvider({ lang, children }) {
  return <Ctx.Provider value={lang || DEFAULT_LANG}>{children}</Ctx.Provider>;
}

export function useT() {
  const lang = useContext(Ctx);
  const dict = UI[lang];
  // t("напис") → переклад; tf("Фото {n}", { n: 2 }) → з підстановкою значень
  const t = (s) => (dict && typeof s === "string" ? dict[i18nKey(s)] ?? s : s);
  const tf = (s, vars) => String(t(s)).replace(/\{(\w+)\}/g, (_, k) => (vars?.[k] ?? ""));
  return { lang, t, tf };
}

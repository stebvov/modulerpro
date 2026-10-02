"use client";
// 🌐 Сайт → Налаштування: контакти, меню, калькулятор, заявки, бренд, Google, аналітика. Зберігається само й одразу на сайті.
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SETTINGS_SECTIONS } from "@/lib/site/schemas";
import { Fields, LinkOptions } from "./Fields";
import SiteSearch from "./SiteSearch";
import { revalidateSite } from "./SitePagesScreen";
import "./editor.css";

export default function SiteSettingsScreen() {
  const supabase = useMemo(() => createClient(), []);
  const [value, setValue] = useState(null);
  const [pages, setPages] = useState([]);
  const [open, setOpen] = useState("Контакти");
  const [status, setStatus] = useState("");
  const timer = useRef(null);

  useEffect(() => {
    supabase.from("site_settings").select("value").eq("key", "main").maybeSingle().then(({ data }) => setValue(data?.value || {}));
    supabase.from("site_pages").select("slug,title").order("sort").then(({ data }) => setPages(data || []));
  }, [supabase]);

  function change(next) {
    setValue(next);
    setStatus("Зберігаю…");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const { error } = await supabase.from("site_settings").upsert({ key: "main", value: next });
      setStatus(error ? "Не збережено: " + error.message : "Збережено · на сайті");
      if (!error) revalidateSite();
    }, 800);
  }

  if (!value) return <div className="full-loader"><div className="spinner" /></div>;

  const rates = value.calc?.rates || {};
  const noRates = !Object.values(rates).some((v) => Number(v) > 0);

  return (
    <div className="se-settings">
      <LinkOptions pages={pages} />
      <div className="toolbar">
        <p className="se-intro" style={{ margin: 0 }}>Загальне для всіх сторінок сайту. Зміни з&apos;являються на сайті одразу.</p>
        <SiteSearch />
        <span className="note">{status}</span>
      </div>
      {noRates && (
        <div className="se-tip se-tip--warn">💡 Калькулятор ще без ставок за м² — на сайті він не показує суму, лише збирає контакт. Заповніть «Калькулятор → Ставки за м²», щоб покупець одразу бачив орієнтовну ціну.</div>
      )}
      {!value.contacts?.telegram && <div className="se-tip">💡 Додайте Telegram у «Контакти» — на телефоні з’явиться кнопка Telegram у нижній панелі.</div>}
      {SETTINGS_SECTIONS.map((s) => {
        const sub = s.key ? value[s.key] || {} : value;
        return (
          <div key={s.title} className={`se-sec${open === s.title ? " open" : ""}`}>
            <button type="button" className="se-sec__head" onClick={() => setOpen(open === s.title ? "" : s.title)}>
              <span className="se-caret">{open === s.title ? "▾" : "▸"}</span> {s.title}
            </button>
            {open === s.title && (
              <div className="se-sec__body">
                {s.hint && <div className="se-tip">{s.hint}</div>}
                <Fields fields={s.fields} value={sub} onChange={(v) => change(s.key ? { ...value, [s.key]: v } : v)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

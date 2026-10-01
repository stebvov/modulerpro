"use client";

// Ціни з браузера. Сайти деяких магазинів (Leroy Merlin, Angio) не пускають програми, тож їхні сторінки надсилає людина:
// відкриває сторінку категорії у своєму браузері й натискає закладку «Ціни в Модулер». Закладка відкриває це вікно
// й передає йому сторінку; звідси вона йде на /api/price-parser/page, де з неї дістають ціни.
// Відкрите напряму (без закладки) це вікно показує інструкцію й список сторінок, які варто надсилати.
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { groupLabel, fmtPrice } from "@/lib/market";

// Зі сторінки лишаємо тільки потрібне для цін: без скриптів (крім JSON-LD), стилів і векторних картинок
function compact(html) {
  return html
    .replace(/<script(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/\s(?:srcset|sizes|style)="[^"]*"/gi, "");
}

const bookmarklet = (origin) =>
  `javascript:(()=>{const o='${origin}',w=window.open(o+'/capture','moduler_capture','width=520,height=720');` +
  `if(!w){alert('Дозволь спливні вікна для цього сайту і натисни ще раз');return}` +
  `const h=e=>{if(e.origin===o&&e.data==='moduler-ready')w.postMessage({type:'moduler-page',url:location.href,html:document.documentElement.outerHTML},o)};` +
  `addEventListener('message',h);setTimeout(()=>removeEventListener('message',h),60000)})()`;

const dateOnly = (ts) => new Date(ts).toLocaleDateString("uk-UA");

export default function CapturePage() {
  const supabase = useMemo(() => createClient(), []);
  const [phase, setPhase] = useState("start"); // start → wait | guide → sending → done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [stores, setStores] = useState([]);
  const [sources, setSources] = useState([]);
  const linkRef = useRef(null);
  const lastRef = useRef("");

  useEffect(() => {
    async function receive(e) {
      if (e.data?.type !== "moduler-page" || typeof e.data.html !== "string") return;
      const key = `${e.data.url}|${e.data.html.length}`; // та сама сторінка двічі поспіль — не надсилаємо вдруге
      if (lastRef.current === key) return;
      lastRef.current = key;
      setPhase("sending");
      try {
        const res = await fetch("/api/price-parser/page", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: e.data.url, html: compact(e.data.html) }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `помилка ${res.status}`);
        setResult({ ...json, url: e.data.url });
        setPhase("done");
      } catch (err) {
        setError(err.message);
        setPhase("error");
      }
    }
    window.addEventListener("message", receive);
    // вікно відкрила закладка зі сторінки магазину — кажемо їй, що готові приймати
    if (window.opener) {
      window.opener.postMessage("moduler-ready", "*");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("wait");
    } else {
      setPhase("guide");
    }
    return () => window.removeEventListener("message", receive);
  }, []);

  useEffect(() => {
    if (phase !== "guide") return;
    // React не дає поставити javascript:-адресу через href — ставимо напряму
    linkRef.current?.setAttribute("href", bookmarklet(window.location.origin));
    let on = true;
    (async () => {
      const { data: s } = await supabase.from("suppliers").select("id,name,website,parser_key,parser_enabled").not("parser_key", "is", null).eq("parser_enabled", false).order("name");
      const { data: p } = await supabase.from("price_sources").select("*").in("supplier_id", (s || []).map((x) => x.id));
      if (on) { setStores(s || []); setSources(p || []); }
    })();
    return () => { on = false; };
  }, [phase, supabase]);

  const priced = result?.offers?.filter((o) => o.unit_price != null).length || 0;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: 20 }}>
      <h2 style={{ fontSize: 18, margin: "0 0 12px" }}>Ціни з браузера → Модулер</h2>

      {phase === "wait" && (
        <>
          <p className="note">Чекаю сторінку магазину… Якщо нічого не відбувається кілька секунд — натисни закладку «Ціни в Модулер» на сторінці магазину ще раз.</p>
          <button className="btn" onClick={() => setPhase("guide")}>Показати інструкцію</button>
        </>
      )}
      {phase === "sending" && <p className="note">Розбираю сторінку…</p>}

      {phase === "error" && (
        <>
          <div className="auth-error">{error}</div>
          <button className="btn" onClick={() => window.close()}>Закрити</button>
        </>
      )}

      {phase === "done" && result && (
        <>
          <p style={{ margin: "0 0 8px" }}>
            <b>{result.store}</b>: на сторінці {result.items} товарів, до наших позицій підійшло {result.offers.length}
            {result.offers.length > priced ? ` (з ціною за одиницю — ${priced})` : ""}.
          </p>
          <p className="note" style={{ marginTop: 0, wordBreak: "break-all" }}>{result.url}</p>
          {!result.items && (
            <div className="auth-error">
              На цій сторінці не вдалося розпізнати товари. Її збережено як зразок — напиши Claude «подивись зразок сторінки {result.store}», він навчить систему читати цей сайт.
            </div>
          )}
          {!!result.items && !result.offers.length && <p className="note">Товари є, але жоден не відповідає позиціям зі списку відстеження.</p>}
          {!!result.offers.length && (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Позиція</th><th>Товар</th><th>Як продають, грн</th><th>За одиницю, грн</th></tr></thead>
                <tbody>
                  {result.offers.map((o, i) => (
                    <tr key={i}>
                      <td>{o.material}</td>
                      <td>{o.title}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtPrice(o.price)} <span className="note">/ {o.sale_unit || "?"}</span></td>
                      <td style={{ whiteSpace: "nowrap" }}>{o.unit_price != null ? <><b>{fmtPrice(o.unit_price)}</b> <span className="note">/ {o.unit}</span></> : <span className="stale">не перерахувати</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="note">Записано. Відкривай наступну сторінку магазину й тисни закладку знову — це вікно оновиться.</p>
          <button className="btn" onClick={() => window.close()}>Закрити</button>
        </>
      )}

      {phase === "guide" && (
        <>
          <p className="note" style={{ marginTop: 0 }}>
            Сайти деяких магазинів не пускають програми, тому їхні ціни система бере зі сторінок, які ти відкриваєш сам. Один раз додай закладку, далі — один клік на сторінку.
          </p>
          <ol style={{ fontSize: 13, lineHeight: 1.7, paddingLeft: 18 }}>
            <li>
              Перетягни цю кнопку на панель закладок браузера (Ctrl+Shift+B покаже панель):{" "}
              <a ref={linkRef} className="btn primary" onClick={(e) => e.preventDefault()} title="Перетягни на панель закладок">⇪ Ціни в Модулер</a>
            </li>
            <li>Відкрий сторінку категорії магазину зі списку нижче. Якщо товарів багато — натисни на сайті «Показати ще», доки не зʼявляться всі.</li>
            <li>Натисни закладку «⇪ Ціни в Модулер». Відкриється це вікно й покаже, що знайдено й записано.</li>
          </ol>

          {stores.map((s) => {
            const rows = sources.filter((x) => x.supplier_id === s.id).sort((a, b) => groupLabel(a.grp).localeCompare(groupLabel(b.grp), "uk") || a.url.localeCompare(b.url));
            return (
              <div key={s.id} style={{ marginTop: 16 }}>
                <h4 style={{ margin: "0 0 6px", fontSize: 14 }}>{s.name}</h4>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Що там</th><th>Сторінка</th><th>Надсилали</th><th>Товарів</th></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td>{groupLabel(r.grp)}</td>
                          <td style={{ wordBreak: "break-all" }}><a href={r.url} target="_blank" rel="noreferrer">{decodeURI(r.url).replace(/^https?:\/\/[^/]+/, "")}</a></td>
                          <td className={r.last_ok_at ? "fresh" : undefined}>{r.last_ok_at ? dateOnly(r.last_ok_at) : "ще ні"}</td>
                          <td>{r.last_items ?? "—"}</td>
                        </tr>
                      ))}
                      {!rows.length && <tr><td colSpan={4} className="empty">Сторінок ще не додано</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          <p className="note">Закладка працює й на сайтах інших магазинів зі списку постачальників — надіслати можна будь-яку сторінку з товарами.</p>
        </>
      )}
    </div>
  );
}

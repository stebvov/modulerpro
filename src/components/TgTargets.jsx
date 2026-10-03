"use client";
// Куди бот (Іван) надсилає заявки: засновнику особисто + групи, де бот уже є (+ інші чати вручну).
// Спільне для квізів (Інтеграції) і форм сайту (Сайт → Налаштування).
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const split = (s) => (s || "").split(/[,;\s]+/).filter(Boolean);

export default function TgTargets({ notifyOwner, chats, onChange }) {
  const supabase = useMemo(() => createClient(), []);
  const [groups, setGroups] = useState([]);
  useEffect(() => {
    let on = true;
    supabase.rpc("quiz_tg_groups").then(({ data }) => { if (on) setGroups(data || []); });
    return () => { on = false; };
  }, [supabase]);

  const ids = split(chats);
  const known = new Set(groups.map((g) => String(g.chat_id)));
  const other = ids.filter((x) => !known.has(x));
  const setChats = (list) => onChange({ tg_chats: [...new Set(list)].join(", ") });

  return (
    <div className="tg-targets">
      <label className="tg-targets__row"><input type="checkbox" checked={notifyOwner !== false} onChange={(e) => onChange({ notify_owner: e.target.checked })} /> 👤 Надсилати засновнику особисто</label>
      <div className="tg-targets__groups">
        {groups.map((g) => {
          const id = String(g.chat_id);
          return (
            <label key={id} className="tg-targets__row">
              <input type="checkbox" checked={ids.includes(id)} onChange={(e) => setChats(e.target.checked ? [...ids, id] : ids.filter((x) => x !== id))} /> 👥 {g.title}
            </label>
          );
        })}
        {!groups.length && <span className="note">Бот ще не доданий у жодну групу.</span>}
      </div>
      <div className="form-row" style={{ marginTop: 8 }}>
        <label>Інші чати чи канали (ID або @назва, через кому)</label>
        <input value={other.join(", ")} placeholder="@moduler_leads" onChange={(e) => setChats([...ids.filter((x) => known.has(x)), ...split(e.target.value)])} />
      </div>
      {notifyOwner === false && !ids.length && <p className="note" style={{ color: "var(--danger)" }}>Увага: особисте вимкнено і жодної групи не вибрано — у Telegram заявки не прийдуть (у CRM потраплять).</p>}
      <p className="note">Щоб група зʼявилась у списку — додайте в неї бота Івана, вона підтягнеться сама.</p>
    </div>
  );
}

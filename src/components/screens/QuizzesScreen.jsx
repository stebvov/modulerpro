"use client";

// 🧩 Квізи — конструктор квіз-воронок (аналог AdsQuiz) усередині системи.
// Список квізів зі статистикою → редактор: питання з логікою, стартовий екран, контакти, фінал, дизайн, публікація.
// Праворуч — живий попередній перегляд. Заявки йдуть у CRM (воронка квізу) і в Telegram, як із форми сайту.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import QuizPlayer from "@/components/quiz/QuizPlayer";
import { uploadSiteImage } from "@/lib/site/upload";
import { PIPELINES, QUESTION_TYPES, embedCode, newQuestion, quizUrl, slugify, templateQuiz, uid } from "@/lib/quiz";
import "./quizzes.css";

const PUBLIC_ORIGIN = "https://app.moduler.pro";
const PERIODS = [[7, "7 днів"], [30, "30 днів"], [90, "90 днів"]];
const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");
const since = (days) => new Date(Date.now() - days * 864e5).toISOString();

function copy(text, done) {
  try { navigator.clipboard.writeText(text).then(() => done?.()); } catch { /* */ }
}

export default function QuizzesScreen() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(null);
  const [stats, setStats] = useState({});
  const [days, setDays] = useState(30);
  const [openId, setOpenId] = useState(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [{ data, error }, { data: st }] = await Promise.all([
      supabase.from("quizzes").select("*").order("created_at", { ascending: false }),
      supabase.rpc("quiz_summary", { p_from: since(days) }),
    ]);
    if (error) { setMsg("Не вдалося завантажити: " + error.message); setRows([]); return; }
    setRows(data || []);
    setStats(Object.fromEntries((st || []).map((s) => [s.quiz_id, s])));
  }, [supabase, days]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function create(fromTemplate) {
    setMsg("");
    const base = fromTemplate ? templateQuiz() : { title: "Новий квіз", start: { enabled: true, title: "", button: "Почати" }, questions: [newQuestion("list")], contact: { title: "Залиште контакти", button: "Надіслати", ask_via: true }, thanks: { title: "Дякуємо!", text: "Звʼяжемося найближчим часом." }, design: { accent: "#2f6b4f" } };
    let slug = slugify(base.title);
    if ((rows || []).some((r) => r.slug === slug)) slug = `${slug}-${uid().slice(0, 4)}`;
    const { data, error } = await supabase.from("quizzes").insert({ ...base, slug }).select().single();
    if (error) { setMsg("Не створено: " + error.message); return; }
    setRows((rs) => [data, ...(rs || [])]);
    setOpenId(data.id);
  }

  async function duplicate(r) {
    const { id: _id, created_at: _c, updated_at: _u, created_by: _b, ...rest } = r;
    const { data, error } = await supabase.from("quizzes").insert({ ...rest, title: r.title + " (копія)", slug: `${r.slug}-${uid().slice(0, 4)}`.slice(0, 60), published: false }).select().single();
    if (error) { setMsg("Не скопійовано: " + error.message); return; }
    setRows((rs) => [data, ...(rs || [])]);
  }

  if (openId) {
    const quiz = rows?.find((r) => r.id === openId);
    if (quiz) return <QuizEditor key={openId} initial={quiz} onClose={() => { setOpenId(null); load(); }} onDeleted={() => { setRows((rs) => rs.filter((r) => r.id !== openId)); setOpenId(null); }} />;
  }

  return (
    <div className="qzs">
      <div className="toolbar">
        <div className="seg-row">
          {PERIODS.map(([d, l]) => <button key={d} className={`seg-btn${days === d ? " active" : ""}`} onClick={() => setDays(d)}>{l}</button>)}
        </div>
        <div className="seg-row">
          <button className="btn" onClick={() => create(false)}>+ Порожній квіз</button>
          <button className="btn primary" onClick={() => create(true)}>+ Квіз із шаблону «Підбір будинку»</button>
        </div>
      </div>
      {msg && <div className="qzs-msg">{msg}</div>}
      {rows === null ? <div className="empty">Завантаження…</div> : !rows.length ? (
        <div className="qzs-empty">
          <div style={{ fontSize: 40 }}>🧩</div>
          <h3>Ще немає жодного квізу</h3>
          <p>Квіз — це кілька простих питань перед формою заявки. Людина охочіше залишає контакти, а менеджер одразу бачить, що їй потрібно.</p>
          <button className="btn primary" onClick={() => create(true)}>Створити з готового шаблону</button>
        </div>
      ) : (
        <div className="qzs-list">
          {rows.map((r) => {
            const s = stats[r.id] || {};
            const url = quizUrl(PUBLIC_ORIGIN, r.slug);
            return (
              <div key={r.id} className="qzs-item">
                <div className="qzs-item__head" onClick={() => setOpenId(r.id)}>
                  <span className={`badge ${r.published ? "active" : "draft"}`}>{r.published ? "Опубліковано" : "Чернетка"}</span>
                  <h3>{r.title}</h3>
                  <div className="note">{(r.questions || []).length} питань · воронка «{PIPELINES.find(([k]) => k === r.pipeline)?.[1] || r.pipeline}»</div>
                </div>
                <div className="qzs-kpi">
                  <div><b>{s.views || 0}</b><span>переглядів</span></div>
                  <div><b>{s.starts || 0}</b><span>почали</span></div>
                  <div><b>{s.leads || 0}</b><span>заявок</span></div>
                  <div><b>{pct(s.leads || 0, s.views || 0)}</b><span>конверсія</span></div>
                </div>
                <div className="qzs-item__actions">
                  <button className="btn small primary" onClick={() => setOpenId(r.id)}>✎ Редагувати</button>
                  {r.published && <a className="btn small" href={url} target="_blank" rel="noreferrer">↗ Відкрити</a>}
                  {r.published && <button className="btn small" onClick={() => copy(url, () => setMsg("Посилання скопійовано: " + url))}>🔗 Посилання</button>}
                  <button className="btn small" onClick={() => duplicate(r)}>⧉ Копія</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Редактор ─────────────────────────
const TABS = [["questions", "Питання"], ["start", "Старт"], ["finish", "Контакти і фінал"], ["publish", "Дизайн і публікація"], ["stats", "Статистика"], ["answers", "Заявки"]];

function QuizEditor({ initial, onClose, onDeleted }) {
  const supabase = useMemo(() => createClient(), []);
  const [q, setQ] = useState(initial);
  const [tab, setTab] = useState("questions");
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);
  const [patch, setPatch] = useState({}); // незбережені зміни
  const latest = useRef({});
  const [confirmDel, setConfirmDel] = useState(false);

  const save = useCallback(async (p) => {
    if (!Object.keys(p).length) return true;
    const { error } = await supabase.from("quizzes").update(p).eq("id", initial.id);
    if (error) {
      setStatus("");
      setErr(error.code === "23505" ? "Така адреса вже зайнята іншим квізом — змініть її." : "Не збережено: " + error.message);
      return false;
    }
    setErr(""); setStatus("Збережено");
    return true;
  }, [supabase, initial.id]);

  // знімаємо збережене з черги, якщо його не змінили, поки йшов запит
  const settle = (p) => setPatch((s) => { const n = { ...s }; Object.keys(p).forEach((k) => { if (n[k] === p[k]) delete n[k]; }); return n; });

  // кілька правок поспіль зливаються в один запит: чекаємо 0,7 с тиші
  useEffect(() => {
    latest.current = patch;
    if (!Object.keys(patch).length) return;
    const t = setTimeout(() => { settle(patch); save(patch); }, 700);
    return () => clearTimeout(t);
  }, [patch, save]);
  // вихід із редактора — дозберегти незбережене
  useEffect(() => () => { save(latest.current); }, [save]);

  async function flush() {
    const p = patch;
    settle(p);
    latest.current = {};
    return save(p);
  }

  function set(p) {
    setQ((s) => ({ ...s, ...p }));
    setPatch((s) => ({ ...s, ...p }));
    setStatus("Зберігаю…");
  }
  const setPart = (key) => (p) => set({ [key]: { ...(q[key] || {}), ...p } });
  const setQuestions = (fn) => set({ questions: fn(q.questions || []) });

  async function togglePublish() {
    const ok = await flush();
    if (!ok) return;
    const valid = (q.questions || []).filter((x) => x.title?.trim()).length;
    if (!q.published && !valid) { setErr("Додайте хоча б одне питання з текстом, перш ніж публікувати."); return; }
    set({ published: !q.published });
  }

  async function remove() {
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 4000); return; }
    const { error } = await supabase.from("quizzes").delete().eq("id", initial.id);
    if (error) { setErr("Не видалено: " + error.message); return; }
    latest.current = {};
    setPatch({});
    onDeleted();
  }

  const url = quizUrl(PUBLIC_ORIGIN, q.slug);

  return (
    <div className="qze">
      <div className="qze-top">
        <button className="btn" onClick={async () => { await flush(); onClose(); }}>← Усі квізи</button>
        <input className="qze-title" value={q.title} onChange={(e) => set({ title: e.target.value })} placeholder="Назва квізу (бачите лише ви)" />
        <span className="note qze-status">{err ? <span style={{ color: "var(--danger)" }}>{err}</span> : status}</span>
        <button className="btn" onClick={() => setShowPreview((v) => !v)}>{showPreview ? "Сховати перегляд" : "👁 Перегляд"}</button>
        <button className={`btn${q.published ? "" : " primary"}`} onClick={togglePublish}>{q.published ? "⏸ Зняти з публікації" : "🚀 Опублікувати"}</button>
      </div>

      <div className="subtabs qze-tabs">
        {TABS.map(([id, l]) => <button key={id} className={`subtab${tab === id ? " active" : ""}`} onClick={() => setTab(id)}>{l}</button>)}
      </div>

      <div className={`qze-body${showPreview && !["stats", "answers"].includes(tab) ? " with-preview" : ""}`}>
        <div className="qze-panel">
          {tab === "questions" && <QuestionsEditor questions={q.questions || []} setQuestions={setQuestions} />}
          {tab === "start" && <StartEditor start={q.start || {}} set={setPart("start")} />}
          {tab === "finish" && <FinishEditor q={q} set={set} setPart={setPart} />}
          {tab === "publish" && (
            <PublishEditor q={q} set={set} setPart={setPart} url={url} onRemove={remove} confirmDel={confirmDel} />
          )}
          {tab === "stats" && <QuizStats quiz={q} />}
          {tab === "answers" && <QuizAnswers quiz={q} />}
        </div>
        {showPreview && !["stats", "answers"].includes(tab) && (
          <div className="qze-preview">
            <div className="qze-preview__bar"><span className="note">Попередній перегляд — заявки звідси не надсилаються</span><button className="btn small" onClick={() => setPreviewKey((k) => k + 1)}>↺ З початку</button></div>
            <QuizPlayer key={previewKey} quiz={q} preview />
          </div>
        )}
      </div>
    </div>
  );
}

function ImageField({ value, onChange, label = "Фото" }) {
  const [busy, setBusy] = useState(false);
  const [e, setE] = useState("");
  async function upload(file) {
    if (!file) return;
    setBusy(true); setE("");
    try { onChange(await uploadSiteImage(file)); } catch (x) { setE(x.message || "Не завантажено"); }
    setBusy(false);
  }
  return (
    <div className="qze-img">
      <span className="qze-img__thumb" style={value ? { backgroundImage: `url(${value})` } : undefined}>{!value && "🖼"}</span>
      <label className="btn small">{busy ? "Завантажую…" : value ? "Замінити" : label}<input type="file" accept="image/*" hidden onChange={(ev) => upload(ev.target.files?.[0])} /></label>
      {value && <button className="btn small" onClick={() => onChange("")}>✕</button>}
      {e && <span className="note" style={{ color: "var(--danger)" }}>{e}</span>}
    </div>
  );
}

function QuestionsEditor({ questions, setQuestions }) {
  const [openQ, setOpenQ] = useState(questions[0]?.id || null);
  const upd = (id, patch) => setQuestions((qs) => qs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const move = (i, d) => setQuestions((qs) => { const a = [...qs]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const add = (type) => { const nq = newQuestion(type); setQuestions((qs) => [...qs, nq]); setOpenQ(nq.id); };

  return (
    <div className="qze-qs">
      {questions.map((x, i) => {
        const open = openQ === x.id;
        const later = questions.slice(i + 1);
        const gotoOptions = [["", "Наступне питання"], ...later.map((y) => [y.id, `→ ${questions.indexOf(y) + 1}. ${y.title || "без назви"}`]), ["contact", "→ Одразу до контактів"]];
        const setType = (type) => {
          const patch = { type };
          if ((type === "list" || type === "cards") && !x.options?.length) patch.options = newQuestion(type).options;
          if (type === "slider" && x.min == null) Object.assign(patch, { min: 20, max: 150, step: 5, unit: "м²" });
          upd(x.id, patch);
        };
        return (
          <div key={x.id} className={`qze-q${open ? " open" : ""}`}>
            <div className="qze-q__head" onClick={() => setOpenQ(open ? null : x.id)}>
              <span className="qze-q__num">{i + 1}</span>
              <span className="qze-q__title">{x.title || <i className="note">Нове питання</i>}</span>
              <span className="note">{QUESTION_TYPES.find(([k]) => k === x.type)?.[1]}</span>
              <span className="qze-q__tools" onClick={(e) => e.stopPropagation()}>
                <button className="btn small" disabled={i === 0} onClick={() => move(i, -1)} title="Вище">↑</button>
                <button className="btn small" disabled={i === questions.length - 1} onClick={() => move(i, 1)} title="Нижче">↓</button>
                <button className="btn small" title="Копія" onClick={() => setQuestions((qs) => { const a = [...qs]; a.splice(i + 1, 0, { ...x, id: uid(), options: (x.options || []).map((o) => ({ ...o, id: uid() })) }); return a; })}>⧉</button>
                <button className="btn small danger" title="Видалити" onClick={() => setQuestions((qs) => qs.filter((y) => y.id !== x.id))}>✕</button>
              </span>
            </div>
            {open && (
              <div className="qze-q__body">
                <div className="form-row"><label>Питання</label><input value={x.title} onChange={(e) => upd(x.id, { title: e.target.value })} placeholder="Напр.: Для чого плануєте будинок?" autoFocus={!x.title} /></div>
                <div className="form-row"><label>Підказка під питанням (необовʼязково)</label><input value={x.hint || ""} onChange={(e) => upd(x.id, { hint: e.target.value })} /></div>
                <div className="qze-row">
                  <div className="form-row"><label>Тип відповіді</label>
                    <select value={x.type} onChange={(e) => setType(e.target.value)}>{QUESTION_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                  </div>
                  <label className="qze-check"><input type="checkbox" checked={!!x.required} onChange={(e) => upd(x.id, { required: e.target.checked })} /> Обовʼязкове</label>
                  {(x.type === "list" || x.type === "cards") && <label className="qze-check"><input type="checkbox" checked={!!x.multi} onChange={(e) => upd(x.id, { multi: e.target.checked })} /> Кілька варіантів</label>}
                </div>

                {(x.type === "list" || x.type === "cards") && (
                  <div className="qze-opts">
                    <label className="note">Варіанти відповіді{!x.multi && " · куди вести після вибору"}</label>
                    {x.options.map((o, oi) => (
                      <div key={o.id} className="qze-opt">
                        {x.type === "cards" && <ImageField value={o.image} onChange={(image) => upd(x.id, { options: x.options.map((y) => (y.id === o.id ? { ...y, image } : y)) })} label="+ Фото" />}
                        <input value={o.label} placeholder={`Варіант ${oi + 1}`} onChange={(e) => upd(x.id, { options: x.options.map((y) => (y.id === o.id ? { ...y, label: e.target.value } : y)) })} />
                        {!x.multi && (
                          <select value={o.goto || ""} onChange={(e) => upd(x.id, { options: x.options.map((y) => (y.id === o.id ? { ...y, goto: e.target.value } : y)) })} title="Логіка: куди вести після цього варіанта">
                            {gotoOptions.map(([k, l]) => <option key={k} value={k}>{k ? l : "↓ далі за порядком"}</option>)}
                          </select>
                        )}
                        <button className="btn small" onClick={() => upd(x.id, { options: x.options.filter((y) => y.id !== o.id) })}>✕</button>
                      </div>
                    ))}
                    <button className="btn small self-left" onClick={() => upd(x.id, { options: [...x.options, { id: uid(), label: "" }] })}>+ Варіант</button>
                  </div>
                )}

                {x.type === "slider" && (
                  <div className="qze-row">
                    {[["min", "Від"], ["max", "До"], ["step", "Крок"]].map(([k, l]) => (
                      <div key={k} className="form-row"><label>{l}</label><input type="number" value={x[k] ?? ""} onChange={(e) => upd(x.id, { [k]: e.target.value === "" ? "" : +e.target.value })} /></div>
                    ))}
                    <div className="form-row"><label>Одиниця</label><input value={x.unit || ""} onChange={(e) => upd(x.id, { unit: e.target.value })} placeholder="м², $, осіб" /></div>
                  </div>
                )}

                <div className="form-row"><label>Після цього питання</label>
                  <select value={x.goto || ""} onChange={(e) => upd(x.id, { goto: e.target.value })}>{gotoOptions.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div className="qze-add">
        <span className="note">Додати питання:</span>
        {QUESTION_TYPES.map(([k, l]) => <button key={k} className="btn small" onClick={() => add(k)}>+ {l}</button>)}
      </div>
      <p className="note">Порада: 4–6 питань — оптимально. Логіка: для кожного варіанта можна обрати, на яке питання перейти далі (лише вперед).</p>
    </div>
  );
}

function StartEditor({ start, set }) {
  return (
    <div>
      <label className="qze-check" style={{ marginBottom: 14 }}><input type="checkbox" checked={!!start.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Показувати стартовий екран</label>
      {start.enabled && (
        <>
          <div className="form-row"><label>Заголовок</label><input value={start.title || ""} onChange={(e) => set({ title: e.target.value })} placeholder="Підберіть модульний будинок за 1 хвилину" /></div>
          <div className="form-row"><label>Текст</label><textarea rows={3} value={start.text || ""} onChange={(e) => set({ text: e.target.value })} /></div>
          <div className="form-row"><label>Кнопка</label><input value={start.button || ""} onChange={(e) => set({ button: e.target.value })} placeholder="Почати" /></div>
          <div className="form-row"><label>Бонус за проходження (лід-магніт)</label><input value={start.bonus || ""} onChange={(e) => set({ bonus: e.target.value })} placeholder="🎁 Каталог планувань і розрахунок вартості" /></div>
          <div className="form-row"><label>Фонове фото</label><ImageField value={start.image} onChange={(image) => set({ image })} /></div>
        </>
      )}
    </div>
  );
}

function FinishEditor({ q, setPart }) {
  const c = q.contact || {}, t = q.thanks || {};
  return (
    <div>
      <h4 className="qze-h">Форма контактів</h4>
      <div className="form-row"><label>Заголовок</label><input value={c.title || ""} onChange={(e) => setPart("contact")({ title: e.target.value })} placeholder="Куди надіслати розрахунок?" /></div>
      <div className="form-row"><label>Текст</label><input value={c.text || ""} onChange={(e) => setPart("contact")({ text: e.target.value })} /></div>
      <div className="form-row"><label>Кнопка</label><input value={c.button || ""} onChange={(e) => setPart("contact")({ button: e.target.value })} placeholder="Отримати" /></div>
      <label className="qze-check"><input type="checkbox" checked={c.ask_via !== false} onChange={(e) => setPart("contact")({ ask_via: e.target.checked })} /> Питати, де зручніше спілкуватись (дзвінок / Viber / Telegram)</label>
      <p className="note">Імʼя й телефон обовʼязкові завжди — без них заявка не потрапить у CRM.</p>
      <h4 className="qze-h">Після заявки</h4>
      <div className="form-row"><label>Заголовок</label><input value={t.title || ""} onChange={(e) => setPart("thanks")({ title: e.target.value })} placeholder="Дякуємо!" /></div>
      <div className="form-row"><label>Текст</label><textarea rows={2} value={t.text || ""} onChange={(e) => setPart("thanks")({ text: e.target.value })} /></div>
      <div className="form-row"><label>Або перенаправити на сторінку (необовʼязково)</label><input value={t.redirect || ""} onChange={(e) => setPart("thanks")({ redirect: e.target.value })} placeholder="https://moduler.pro/modeli" /></div>
    </div>
  );
}

function PublishEditor({ q, set, setPart, url, onRemove, confirmDel }) {
  const d = q.design || {};
  const [copied, setCopied] = useState("");
  const code = embedCode(PUBLIC_ORIGIN, q.slug);
  return (
    <div>
      <h4 className="qze-h">Куди йдуть заявки</h4>
      <div className="form-row"><label>Воронка CRM</label>
        <select value={q.pipeline} onChange={(e) => set({ pipeline: e.target.value })}>{PIPELINES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>
      <p className="note">Кожна заявка → лід у «Продажах (CRM)» з усіма відповідями, угода в першому етапі воронки, сповіщення в Telegram.</p>

      <h4 className="qze-h">Дизайн</h4>
      <div className="qze-row">
        <div className="form-row"><label>Колір акценту</label><input type="color" value={d.accent || "#2f6b4f"} onChange={(e) => setPart("design")({ accent: e.target.value })} /></div>
        <div className="form-row"><label>Фото збоку від питань</label><ImageField value={d.image} onChange={(image) => setPart("design")({ image })} /></div>
      </div>

      <h4 className="qze-h">Адреса й вставка на сайт</h4>
      <div className="form-row"><label>Адреса квізу</label>
        <div className="qze-row"><span className="note">{PUBLIC_ORIGIN}/q/</span><input value={q.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} /></div>
      </div>
      {!q.published && <p className="note" style={{ color: "var(--amber)" }}>Квіз ще чернетка — посилання запрацює після «🚀 Опублікувати».</p>}
      <div className="qze-copy">
        <code>{url}</code>
        <button className="btn small" onClick={() => copy(url, () => setCopied("link"))}>{copied === "link" ? "✓ Скопійовано" : "Копіювати"}</button>
      </div>
      <p className="note">Для реклами додавайте UTM-мітки: <code>?utm_source=facebook&utm_campaign=…</code> — вони потраплять у лід.</p>
      <div className="form-row"><label>Код для вставки на сайт (iframe)</label><textarea rows={3} readOnly value={code} onFocus={(e) => e.target.select()} /></div>
      <button className="btn small" onClick={() => copy(code, () => setCopied("code"))}>{copied === "code" ? "✓ Скопійовано" : "Копіювати код"}</button>

      <h4 className="qze-h">Небезпечна зона</h4>
      <button className="btn danger" onClick={onRemove}>{confirmDel ? "Точно видалити? Натисніть ще раз" : "🗑 Видалити квіз"}</button>
      <p className="note">Разом із квізом зникнуть статистика й історія відповідей; самі ліди в CRM залишаться.</p>
    </div>
  );
}

function QuizStats({ quiz }) {
  const supabase = useMemo(() => createClient(), []);
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let on = true;
    supabase.rpc("quiz_funnel", { p_quiz: quiz.id, p_from: since(days) }).then(({ data }) => { if (on) setRows(data || []); });
    return () => { on = false; };
  }, [supabase, quiz.id, days]);
  const get = (kind, step = -1) => rows?.find((r) => r.kind === kind && r.step === step)?.sessions || 0;
  const views = get("view"), starts = get("start"), leads = get("lead");
  const qs = (quiz.questions || []).filter((x) => x.title);
  const bars = [
    ["Переглянули", views],
    ["Почали", starts],
    ...qs.map((x, i) => [`${i + 1}. ${x.title}`, get("step", i)]),
    ["Залишили заявку", leads],
  ];
  const max = Math.max(1, ...bars.map(([, v]) => v));
  return (
    <div>
      <div className="seg-row" style={{ marginBottom: 14 }}>
        {PERIODS.map(([d, l]) => <button key={d} className={`seg-btn${days === d ? " active" : ""}`} onClick={() => setDays(d)}>{l}</button>)}
      </div>
      {rows === null ? <div className="empty">Завантаження…</div> : (
        <>
          <div className="qzs-kpi qzs-kpi--big">
            <div><b>{views}</b><span>переглядів</span></div>
            <div><b>{pct(starts, views)}</b><span>почали</span></div>
            <div><b>{leads}</b><span>заявок</span></div>
            <div><b>{pct(leads, views)}</b><span>конверсія з перегляду</span></div>
            <div><b>{pct(leads, starts)}</b><span>з тих, хто почав</span></div>
          </div>
          <h4 className="qze-h">Воронка по кроках</h4>
          <div className="qze-funnel">
            {bars.map(([l, v], i) => {
              const prev = i ? bars[i - 1][1] : 0;
              const drop = i > 1 && prev ? Math.round(((prev - v) / prev) * 100) : null;
              return (
                <div key={i} className="qze-funnel__row">
                  <span className="qze-funnel__label" title={l}>{l}</span>
                  <span className="qze-funnel__bar"><span style={{ width: (v / max) * 100 + "%" }} /></span>
                  <span className="qze-funnel__val">{v}{drop > 0 && <small> −{drop}%</small>}</span>
                </div>
              );
            })}
          </div>
          <p className="note">Рахуються унікальні відвідування (одна людина в одній вкладці — один раз). Велике падіння на кроці — сигнал спростити або прибрати це питання.</p>
        </>
      )}
    </div>
  );
}

function QuizAnswers({ quiz }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let on = true;
    supabase.from("quiz_responses").select("id,created_at,answers,contact,lead_id").eq("quiz_id", quiz.id).order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => { if (on) setRows(data || []); });
    return () => { on = false; };
  }, [supabase, quiz.id]);
  if (rows === null) return <div className="empty">Завантаження…</div>;
  if (!rows.length) return <div className="empty">Заявок із цього квізу ще немає.</div>;
  return (
    <div className="qze-answers">
      {rows.map((r) => (
        <div key={r.id} className="qze-answer">
          <div className="qze-answer__head">
            <b>{r.contact?.name || "—"}</b>
            <a href={`tel:${r.contact?.phone || ""}`}>{r.contact?.phone}</a>
            {r.contact?.via && <span className="badge draft">{r.contact.via}</span>}
            <span className="note">{new Date(r.created_at).toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            <Link className="btn small" href="/?s=crm">У CRM →</Link>
          </div>
          <ul>{(r.answers || []).map((a, i) => <li key={i}><span className="note">{a.q}</span> {a.a}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

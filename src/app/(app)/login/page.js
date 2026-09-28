"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SIGNIN_ERRORS = {
  "Invalid login credentials": "Невірний email або пароль.",
  "Email not confirmed": "Email ще не підтверджено. Відкрийте лист і перейдіть за посиланням.",
};

function safeNext() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [signUp, setSignUp] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (signUp) {
        // перший вхід учасника команди: пароль створює сам, доступ дає запис у «Команді» пульта
        const { data, error: upError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (upError) throw upError;
        if (!data.session) {
          setInfo("Перевірте пошту: прийде лист із посиланням для підтвердження. Після цього увійдіть.");
          return;
        }
        window.location.assign(safeNext() || "/");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const next = safeNext();
      if (next) {
        window.location.assign(next);
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(SIGNIN_ERRORS[err.message] || err.message || "Сталася помилка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Модулер</h1>
        <p className="subtitle">{signUp ? "Перший вхід: створіть пароль" : "Вхід у систему управління"}</p>
        {error && <div className="auth-error">{error}</div>}
        {info && <div className="note" style={{ marginBottom: 12 }}>{info}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="form-row">
            <label>Пароль</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={signUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button className="btn primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: 8 }}>
            {busy ? "Зачекайте..." : signUp ? "Створити пароль" : "Увійти"}
          </button>
        </form>
        <button
          type="button"
          className="btn"
          style={{ width: "100%", marginTop: 8 }}
          onClick={() => { setSignUp(!signUp); setError(""); setInfo(""); }}
        >
          {signUp ? "Вже маю пароль" : "Перший вхід: створити пароль"}
        </button>
        <p className="note" style={{ marginTop: 14, textAlign: "center" }}>
          Доступ відкривається для email, доданих у «Команду» пульта або запрошених на вкладці «Користувачі».
        </p>
      </div>
    </div>
  );
}

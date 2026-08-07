"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push("/");
        router.refresh();
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setInfo(
            "Реєстрація успішна. Перевірте пошту, щоб підтвердити акаунт, потім увійдіть."
          );
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err.message || "Сталася помилка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Moduler Pro</h1>
        <p className="subtitle">
          {mode === "signin" ? "Вхід у систему" : "Реєстрація нового користувача"}
        </p>
        {error && <div className="auth-error">{error}</div>}
        {info && (
          <div className="auth-error" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
            {info}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="form-row">
              <label>Ім&apos;я</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ваше ім'я"
              />
            </div>
          )}
          <div className="form-row">
            <label>Email</label>
            <input
              type="email"
              required
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button className="btn primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: 8 }}>
            {busy ? "Зачекайте..." : mode === "signin" ? "Увійти" : "Зареєструватися"}
          </button>
        </form>
        <div className="auth-toggle">
          {mode === "signin" ? (
            <>
              Немає акаунта?{" "}
              <button onClick={() => { setMode("signup"); setError(""); setInfo(""); }}>
                Зареєструватися
              </button>
            </>
          ) : (
            <>
              Вже є акаунт?{" "}
              <button onClick={() => { setMode("signin"); setError(""); setInfo(""); }}>
                Увійти
              </button>
            </>
          )}
        </div>
        {mode === "signup" && (
          <p className="note" style={{ marginTop: 14, textAlign: "center" }}>
            Перший зареєстрований користувач стає адміністратором. Наступні
            отримують роль «Менеджер» — адмін може змінити роль на вкладці
            «Користувачі».
          </p>
        )}
      </div>
    </div>
  );
}

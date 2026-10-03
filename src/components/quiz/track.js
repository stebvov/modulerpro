// Події квізу для пікселів і аналітики (Facebook, TikTok, GA4, GTM). Тихо нічого не робить, якщо скриптів немає.
export function quizEvent(kind, data = {}) {
  if (typeof window === "undefined") return;
  const w = window;
  try {
    w.dataLayer?.push({ event: "quiz_" + kind, ...data });
    if (kind === "start") {
      w.fbq?.("trackCustom", "QuizStart", { content_name: data.quiz });
      w.ttq?.track?.("ClickButton", { content_name: data.quiz });
      w.gtag?.("event", "quiz_start", { quiz: data.quiz });
    } else if (kind === "step") {
      w.gtag?.("event", "quiz_step", { quiz: data.quiz, step: data.step });
    } else if (kind === "lead") {
      w.fbq?.("track", "Lead", { content_name: data.quiz, content_category: "quiz" }, { eventID: data.event_id });
      w.ttq?.track?.("SubmitForm", { content_name: data.quiz }, { event_id: data.event_id });
      w.gtag?.("event", "generate_lead", { quiz: data.quiz });
    }
  } catch { /* аналітика не обовʼязкова */ }
}

// cookies Facebook для Conversions API: _fbp і _fbc (або fbclid з адреси)
export function fbCookies() {
  if (typeof document === "undefined") return {};
  const get = (n) => document.cookie.split("; ").find((c) => c.startsWith(n + "="))?.split("=")[1] || "";
  let fbc = get("_fbc");
  if (!fbc) {
    try { const id = new URLSearchParams(location.search).get("fbclid"); if (id) fbc = `fb.1.${Date.now()}.${id}`; } catch { /* */ }
  }
  return { fbp: get("_fbp"), fbc };
}

export const newEventId = () => (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));

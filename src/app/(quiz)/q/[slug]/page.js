// Публічна сторінка квізу: читаємо опублікований квіз анонімним ключем (RLS: лише published).
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import QuizPlayer from "@/components/quiz/QuizPlayer";
import QuizPixels from "@/components/quiz/QuizPixels";

export const dynamic = "force-dynamic";

async function getQuiz(slug) {
  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug || "")) return null;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await sb.from("quizzes").select("*").eq("slug", slug).eq("published", true).maybeSingle();
  if (!data) return null;
  const { slug: s, title, start, questions, contact, thanks, design, tracking } = data; // лише публічне
  return { slug: s, title, start, questions, contact, thanks, design, tracking: tracking || {} };
}

// хтось із команди (увійшов у систему в цьому браузері) — тестовий режим. Анонімних відвідувачів не перевіряємо — сторінка швидша.
async function isTeamUser() {
  try {
    const store = await cookies();
    if (!store.getAll().some((c) => c.name.startsWith("sb-"))) return false;
    const sb = await createServerClient();
    const { data } = await sb.auth.getUser();
    return !!data?.user;
  } catch { return false; }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const q = await getQuiz(slug);
  if (!q) return { title: "Квіз не знайдено" };
  return {
    title: q.title,
    description: q.start?.text || undefined,
    openGraph: { title: q.start?.title || q.title, description: q.start?.text || undefined, images: q.start?.image ? [q.start.image] : undefined },
  };
}

export default async function QuizPage({ params, searchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const quiz = await getQuiz(slug);
  if (!quiz) notFound();
  const embed = sp?.embed === "1";
  const test = sp?.test === "1" || (await isTeamUser());
  return (
    <main style={{ padding: embed ? 0 : "clamp(12px, 4vw, 40px) 12px", minHeight: "100vh", display: "flex", alignItems: embed ? "stretch" : "center" }}>
      {!test && <QuizPixels tracking={quiz.tracking} />}
      <QuizPlayer quiz={quiz} embed={embed} test={test} />
    </main>
  );
}

// Онлайн-тест кандидата за особистим посиланням. Сторінка закрита від пошуковиків.
import SiteTest from "@/components/site/SiteTest";

export const metadata = { title: "Тест", robots: { index: false, follow: false } };

export default async function Page({ params }) {
  const { token } = await params;
  return <SiteTest token={String(token || "").slice(0, 64)} />;
}

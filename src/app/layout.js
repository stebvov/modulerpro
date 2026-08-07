import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata = {
  title: "Moduler Pro — Каталог і постачальники",
  description: "Система управління виробництвом модульних будинків",
};

// Every page needs a live Supabase session check, so there is nothing to
// prerender at build time — and prerendering would run the client with
// empty env vars in CI, which crashes the build. Force dynamic rendering
// so Supabase env vars are only read at request time.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

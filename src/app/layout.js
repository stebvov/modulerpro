import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata = {
  title: "Moduler Pro — Каталог і постачальники",
  description: "Система управління виробництвом модульних будинків",
};

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

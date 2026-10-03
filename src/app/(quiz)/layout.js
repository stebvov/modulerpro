// Публічні квізи /q/<slug> — окремий кореневий макет: без входу в систему, без меню сайту (зручно для реклами й вставки в iframe).
import { Manrope } from "next/font/google";

const body = Manrope({ subsets: ["latin", "cyrillic"], variable: "--f-quiz", display: "swap" });

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#2f6b4f" };

export default function QuizLayout({ children }) {
  return (
    <html lang="uk" className={body.variable}>
      <body style={{ margin: 0, background: "#f5f4f0" }}>{children}</body>
    </html>
  );
}

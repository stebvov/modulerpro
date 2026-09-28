// Фото для сайту: у браузері стискаємо в WebP трьох розмірів (640/1280/1920) і кладемо в публічний бакет "site".
// Повертаємо адресу версії 1280 — сайт сам підставляє меншу/більшу через srcset.
import { createClient } from "@/lib/supabase/client";

const SIZES = [640, 1280, 1920];

async function toWebp(bitmap, width) {
  const w = Math.min(width, bitmap.width);
  const h = Math.round((bitmap.height * w) / bitmap.width);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  return new Promise((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("Не вдалося стиснути фото"))), "image/webp", width > 1000 ? 0.8 : 0.76));
}

export async function uploadSiteImage(file) {
  const supabase = createClient();
  const id = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID().slice(0, 12)}`;
  // SVG і дрібні логотипи — як є
  if (file.type === "image/svg+xml") {
    const path = `img/${id}.svg`;
    const { error } = await supabase.storage.from("site").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (error) throw error;
    return supabase.storage.from("site").getPublicUrl(path).data.publicUrl;
  }
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  let main = "";
  for (const size of SIZES) {
    const blob = await toWebp(bitmap, size);
    const path = `img/${id}-${size}.webp`;
    const { error } = await supabase.storage.from("site").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
    if (error) throw new Error(error.message?.includes("row-level") ? "Немає прав на завантаження фото сайту" : error.message);
    if (size === 1280) main = supabase.storage.from("site").getPublicUrl(path).data.publicUrl;
  }
  bitmap.close?.();
  return main;
}

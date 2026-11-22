import { createClient } from "@libsql/client/web";

// 1. Ambil Timezone Device
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";

// 2. Ambil Locale Sistem
const userLocale = (navigator.language || navigator.userLanguage || "").toLowerCase();

// 3. Cek Jam System (Jepang: UTC+9 / offset -540 menit)
const isUTC9 = new Date().getTimezoneOffset() === -540;

// 4. Deteksi Region Jepang (Tokyo Server vs Singapore Server)
const isJapanRegion = 
  userTimezone === "Asia/Tokyo" || 
  userLocale.includes("jp") || 
  userLocale.includes("ja") || 
  isUTC9; 

const activeUrl = isJapanRegion
  ? import.meta.env.VITE_TURSO_DATABASE_URL_TOKYO
  : import.meta.env.VITE_TURSO_DATABASE_URL;

const activeToken = isJapanRegion
  ? import.meta.env.VITE_TURSO_AUTH_TOKEN_TOKYO
  : import.meta.env.VITE_TURSO_AUTH_TOKEN;

console.log(`[Turso DB] Timezone: "${userTimezone}" | Locale: "${userLocale}" | IsUTC+9: ${isUTC9}`);
console.log(`[Turso DB] Detected Region: ${isJapanRegion ? "Japan 🇯🇵" : "Outside Japan (Default Singapore) 🇸🇬"}`);

export const turso = createClient({
  url: activeUrl,
  authToken: activeToken,
});

/**
 * 🟢 Helper Function untuk menyimpan transaksi ke Turso SQLite (Wajib sertakan user_id)
 */
export async function addTransaction(transaction) {
  const { title, amount, type, category, payment_method, date, user_id } = transaction;

  const result = await turso.execute({
    sql: `INSERT INTO transactions (title, amount, type, category, payment_method, date, user_id) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      title,
      Number(amount) || 0,
      type || "expense",
      category || "Lainnya",
      payment_method || "Tunai",
      date || new Date().toISOString(),
      user_id || "guest" // Fallback jika user_id tidak ada
    ]
  });

  return result;
}
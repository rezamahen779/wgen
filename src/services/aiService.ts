export interface TransactionResult {
  title: string;
  amount: number;
  type: "expense" | "income";
  category: string;
  payment_method?: string;
  currency?: string;
  note?: string;
}

// 💡 URL Backend Online / Proxy
// Jika di local development, pastikan backend Express kamu jalan (misal port 3000)
// Atau jika via Vercel langsung, gunakan URL produksi.
const API_BASE_URL = (import.meta as ImportMeta & { env: { DEV: boolean } }).env.DEV 
  ? '' // Jika dev lokal, kosongkan agar request jadi /api/parse-chat (masuk Vite Proxy)
  : 'https://wgen-psi.vercel.app'; // Jika live/build, nembak ke Vercel
// Key Simpanan Antrean Offline
const OFFLINE_QUEUE_KEY = "wgen_sans_ai_offline_queue";

function enqueueOfflineAI(type: "chat" | "receipt", payload: any) {
  try {
    const rawQueue = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue = rawQueue ? JSON.parse(rawQueue) : [];
    queue.push({ type, payload, timestamp: Date.now() });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    console.log(`📥 [SANS AI] Transaksi disimpan di antrean offline. (${type})`);
  } catch (e) {
    console.error("Gagal menyimpan ke antrean offline:", e);
  }
}

/**
 * 🔄 Memproses seluruh antrean offline secara otomatis saat ONLINE kembali
 */
export async function processOfflineAIQueue() {
  if (!navigator.onLine) return;

  const rawQueue = localStorage.getItem(OFFLINE_QUEUE_KEY);
  if (!rawQueue) return;

  const queue = JSON.parse(rawQueue);
  if (!Array.isArray(queue) || queue.length === 0) return;

  console.log(`📡 [SANS AI Sync] Memproses ${queue.length} antrean offline...`);
  const failedItems = [];

  for (const item of queue) {
    try {
      let results: TransactionResult[] = [];
      if (item.type === "chat") {
        results = await sendChatToSANS(
          item.payload.message,
          item.payload.userId,
          item.payload.language,
          item.payload.categories,
          item.payload.currency
        );
      } else if (item.type === "receipt") {
        results = await sendReceiptToSANS(
          item.payload.base64Image,
          item.payload.userId,
          item.payload.language,
          item.payload.categories,
          item.payload.currency
        );
      }

      if (results && results.length > 0) {
        window.dispatchEvent(
          new CustomEvent("wgen_save_ai_transactions", { detail: results })
        );
      }
    } catch (err: any) {
      if (!err.message?.includes("OFFLINE_SAVED")) {
        console.warn("⚠️ [SANS AI Sync] Gagal memproses 1 item antrean, akan dicoba nanti:", err);
        failedItems.push(item);
      }
    }
  }

  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failedItems));
}

/**
 * Mengirim pesan teks / voice ke Server Backend
 */
export async function sendChatToSANS(
  message: string,
  userId?: string,
  language: string = "id",
  categories: string[] = [],
  currency: string = "JPY"
): Promise<TransactionResult[]> {
  // 🔴 1. Hanya lempar ke antrean offline jika internet BISA DIPASTIKAN mati
  if (!navigator.onLine) {
    enqueueOfflineAI("chat", { message, userId, language, categories, currency });
    throw new Error("OFFLINE_SAVED: Internet terputus. Pesan disimpan di antrean offline.");
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/parse-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, userId, language, categories, currency }),
    });

    // Jika HTTP response error dari Vercel / Express
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Server Error (${res.status})`);
    }

    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Gagal memproses transaksi.");
    
    return data.data;

  } catch (error: any) {
    // 🟢 HANYA simpan offline jika error murni jaringan (Failed to fetch saat offline), 
    // BUKAN memalsukan error CORS/Server sebagai offline!
    if (error.name === "TypeError" && error.message === "Failed to fetch" && !navigator.onLine) {
      enqueueOfflineAI("chat", { message, userId, language, categories, currency });
      throw new Error("OFFLINE_SAVED: Sinyal terganggu. Transaksi disimpan ke antrean offline.");
    }

    // Jika error server / CORS, lemparkan error asli agar terbaca di console/UI!
    throw error;
  }
}

/**
 * Mengirim gambar struk (base64) ke Server Backend
 */
export async function sendReceiptToSANS(
  base64Image: string,
  userId?: string,
  language: string = "id",
  categories: string[] = [],
  currency: string = "JPY"
): Promise<TransactionResult[]> {
  if (!navigator.onLine) {
    enqueueOfflineAI("receipt", { base64Image, userId, language, categories, currency });
    throw new Error("OFFLINE_SAVED: Internet terputus. Struk disimpan di antrean offline.");
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/parse-receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Image, userId, language, categories, currency }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Server Error (${res.status})`);
    }

    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Gagal membaca data struk.");
    
    return data.data;

  } catch (error: any) {
    if (error.name === "TypeError" && error.message === "Failed to fetch" && !navigator.onLine) {
      enqueueOfflineAI("receipt", { base64Image, userId, language, categories, currency });
      throw new Error("OFFLINE_SAVED: Sinyal terganggu. Gambar struk disimpan ke antrean offline.");
    }
    throw error;
  }
}
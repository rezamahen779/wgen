import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import { createClient } from "@libsql/client";
import { parseTransactionText, parseTransactionReceipt } from "./aiService";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Inisialisasi Client Turso DB
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "",
  authToken: process.env.TURSO_AUTH_TOKEN || "",
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));

/**
 * Helper untuk memastikan user_id selalu terisi secara sinkron dengan akun Turso DB aktif
 */
async function getActiveUserId(fallbackId?: string): Promise<string> {
  if (fallbackId && fallbackId.trim() && fallbackId !== "guest_user") {
    return fallbackId;
  }
  try {
    const result = await db.execute("SELECT user_id FROM transactions WHERE user_id IS NOT NULL LIMIT 1;");
    if (result.rows.length > 0 && result.rows[0].user_id) {
      return String(result.rows[0].user_id);
    }
  } catch (e) {
    console.warn("⚠️ Gagal mengambil user_id otomatis dari Turso:", e);
  }
  return "default_user";
}

// Endpoint API: Parse Chat & Voice Text -> Save to Turso DB
app.post("/api/parse-chat", async (req: Request, res: Response) => {
  try {
    const { message, userId, language, categories } = req.body;
    if (!message) return res.status(400).json({ success: false, error: "Pesan kosong" });

    // Teruskan parameter language dan array categories dinamis ke AI Parser
    const transactions = await parseTransactionText(message, language || "id", categories || []);
    if (!transactions || transactions.length === 0) {
      return res.status(422).json({ success: false, error: "Gagal memproses transaksi." });
    }

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.slice(0, 10);
    const targetUserId = await getActiveUserId(userId);

    const batchStatements = transactions.map((item) => ({
      sql: `INSERT INTO transactions (id, user_id, title, amount, type, category, payment_method, currency, date, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        targetUserId,
        item.title,
        item.amount,
        item.type,
        item.category,
        item.payment_method || "Tunai",
        "JPY",
        todayStr,
        nowIso,
        nowIso
      ]
    }));

    await db.batch(batchStatements, "write");
    return res.json({ success: true, data: transactions });
  } catch (error: any) {
    console.error("❌ ERROR ON /api/parse-chat:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint API: Scan Receipt (Base64) -> Save to Turso DB
app.post("/api/parse-receipt", async (req: Request, res: Response) => {
  try {
    const { base64Image, userId, language, categories } = req.body;
    if (!base64Image) return res.status(400).json({ success: false, error: "Gambar struk diperlukan" });

    const transactions = await parseTransactionReceipt(base64Image, language || "id", categories || []);
    if (!transactions || transactions.length === 0) {
      return res.status(422).json({ success: false, error: "Gagal membaca struk." });
    }

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.slice(0, 10);
    const targetUserId = await getActiveUserId(userId);

    const batchStatements = transactions.map((item) => ({
      sql: `INSERT INTO transactions (id, user_id, title, amount, type, category, payment_method, currency, date, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        targetUserId,
        item.title,
        item.amount,
        item.type,
        item.category,
        item.payment_method || "Tunai",
        "JPY",
        todayStr,
        nowIso,
        nowIso
      ]
    }));

    await db.batch(batchStatements, "write");
    return res.json({ success: true, data: transactions });
  } catch (error: any) {
    console.error("❌ ERROR ON /api/parse-receipt:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server backend SANS AI berjalan di http://localhost:${PORT}`);
});
// Tambahkan ini di paling bawah server/src/index.ts
export default app;
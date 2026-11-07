import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { parseTransactionText, parseTransactionReceipt } from "./aiService";

dotenv.config();

const app = express();

// Konfigurasi CORS agar bisa diakses dari browser localhost & APK Android (Capacitor)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));

// Route parsing teks / chat
app.post("/api/parse-chat", async (req, res) => {
  try {
    const { message, language, categories } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: "Pesan tidak boleh kosong." });
    }
    const data = await parseTransactionText(message, language, categories);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || "Gagal memproses transaksi." });
  }
});

// Route parsing foto struk
app.post("/api/parse-receipt", async (req, res) => {
  try {
    const { base64Image, language, categories } = req.body;
    if (!base64Image) {
      return res.status(400).json({ success: false, error: "Gambar struk tidak boleh kosong." });
    }
    const data = await parseTransactionReceipt(base64Image, language, categories);
    return res.json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || "Gagal memproses struk." });
  }
});

// Jalankan port jika di env lokal
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`🚀 Server WGen Backend berjalan di port ${PORT}`);
  });
}

// Export default wajib untuk Vercel Serverless Function
export default app;
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { parseTransactionText, parseTransactionReceipt } from "./aiService";

dotenv.config();

const app = express();

// 1. Izinkan CORS Semua Origin
app.use(cors());

// 2. Tangani HTTP OPTIONS Preflight secara eksplisit (PENTING BIAR GA ERROR 500)
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res.sendStatus(200);
});

app.use(express.json({ limit: "10mb" }));

// Route API
app.post("/api/parse-chat", async (req, res) => {
  try {
    const { message, language, categories } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: "Pesan tidak boleh kosong." });
    }
    const data = await parseTransactionText(message, language, categories);
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error("Error parse-chat:", error);
    return res.status(500).json({ success: false, error: error?.message || "Gagal memproses transaksi." });
  }
});

app.post("/api/parse-receipt", async (req, res) => {
  try {
    const { base64Image, language, categories } = req.body;
    if (!base64Image) {
      return res.status(400).json({ success: false, error: "Gambar struk tidak boleh kosong." });
    }
    const data = await parseTransactionReceipt(base64Image, language, categories);
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error("Error parse-receipt:", error);
    return res.status(500).json({ success: false, error: error?.message || "Gagal memproses struk." });
  }
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`🚀 Server berjalan di port ${PORT}`));
}

export default app;
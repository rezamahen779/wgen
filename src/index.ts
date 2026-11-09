import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { parseTransactionText, parseTransactionReceipt } from "./aiService";

dotenv.config();

const app = express();

// 🟢 1. Middleware CORS Paksa (Tembus Vercel Edge & Preflight OPTIONS)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  // Jika browser cuma ngecek preflight (OPTIONS), langsung jawab 200 OK!
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Test Root Endpoint
app.get("/", (req, res) => {
  res.send("WGen SANS AI Backend Serverless is Live!");
});

// Route Parse Chat
app.post("/api/parse-chat", async (req, res) => {
  try {
    const { message, language, categories, currency } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: "Pesan tidak boleh kosong." });
    }

    const data = await parseTransactionText(message, language, categories, currency);
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error("Error parse-chat:", error);
    return res.status(500).json({ success: false, error: error?.message || "Gagal memproses transaksi." });
  }
});

// Route Parse Struk
app.post("/api/parse-receipt", async (req, res) => {
  try {
    const { base64Image, language, categories, currency } = req.body;
    if (!base64Image) {
      return res.status(400).json({ success: false, error: "Gambar struk tidak boleh kosong." });
    }
    
    const data = await parseTransactionReceipt(base64Image, language, categories, currency);
    return res.json({ success: true, data });
  } catch (error: any) {
    console.error("Error parse-receipt:", error);
    return res.status(500).json({ success: false, error: error?.message || "Gagal memproses struk." });
  }
});

export default app;
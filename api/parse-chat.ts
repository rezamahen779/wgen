import { parseTransactionText } from "../src/aiService";

export default async function handler(req: any, res: any) {
  // Setup CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Tangani OPTIONS Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  try {
    const { message, language, categories } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, error: "Pesan tidak boleh kosong." });
    }
    const data = await parseTransactionText(message, language, categories);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("Error parse-chat:", error);
    return res.status(500).json({ success: false, error: error?.message || "Gagal memproses transaksi." });
  }
}
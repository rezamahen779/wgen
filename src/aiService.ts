import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:5173",
    "X-Title": "WGen Note SANS AI",
  },
});

export interface ParsedTransaction {
  title: string;
  amount: number;
  type: "expense" | "income";
  category: string;
  payment_method?: string;
}

/**
 * Membuat Prompt AI Dinamis berdasarkan Bahasa & Daftar Kategori dari Frontend
 */
function getSystemPrompt(lang: string = "id", availableCategories: string[] = []): string {
  const categoriesText = availableCategories.length > 0
    ? availableCategories.map(c => `"${c}"`).join(", ")
    : `"Makan & Minum", "Transportasi", "Belanja", "Tagihan", "Gaji", "Lainnya"`;
  
  return `
Nama kamu adalah SANS, asisten AI pencatat keuangan otomatis yang pintar dan fleksibel untuk aplikasi WGen Note.
Tugasmu adalah menganalisis teks chat, transkrip suara, atau foto struk lalu mengelompokkannya.

PENTING: Gunakan bahasa [${lang.toUpperCase()}] untuk 'title'. 
PILIH 'category' SANGAT WAJIB HANYA DARI DAFTAR PERSIS BERIKUT (jangan membuat nama kategori baru):
[${categoriesText}]

Aturan Nominal:
- Pahami bahasa informal & slang Indonesia, Jepang, Inggris, Arab, Mandarin.
- 'rb' / 'k' = ribuan (18rb -> 18000), 'jt' = jutaan.
- '3rb yen' -> amount: 3000.
- Tentukan 'type' ("expense" atau "income").

Balas HANYA dengan JSON murni dalam format berikut:
{
  "transactions": [
    {
      "title": "Nama barang/layanan dalam bahasa ${lang}",
      "amount": 18000,
      "type": "expense",
      "category": "PILIH_SALAH_SATU_DARI_LIST_DI_ATAS",
      "payment_method": "Tunai"
    }
  ]
}
`;
}

/**
 * Helper Pembersih JSON Respons AI
 */
function cleanJsonResponse(rawText: string): any {
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : rawText;
    const cleaned = jsonString.replace(/```json/gi, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("❌ Gagal parsing JSON:", rawText);
    return null;
  }
}

/**
 * Parse Transaksi Teks / Chat
 */
export async function parseTransactionText(
  userInput: string, 
  lang: string = "id", 
  categories: string[] = []
): Promise<ParsedTransaction[]> {
  const freeModels = ["openrouter/auto", "google/gemini-2.0-flash-exp:free"];
  const systemPrompt = getSystemPrompt(lang, categories);

  for (const model of freeModels) {
    try {
      console.log(`🤖 SANS AI dipanggil [lang: ${lang}] via model: ${model}...`);
      const response = await openrouter.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput }
        ]
      });

      const content = response.choices[0]?.message?.content;
      if (!content) continue;

      const parsed = cleanJsonResponse(content);
      if (parsed && Array.isArray(parsed.transactions) && parsed.transactions.length > 0) {
        return parsed.transactions;
      }
    } catch (error: any) {
      console.warn(`⚠️ Model ${model} gagal:`, error?.message || error);
    }
  }

  throw new Error("SANS gagal menguraikan transaksi.");
}

/**
 * Parse Transaksi Foto Struk
 */
export async function parseTransactionReceipt(
  base64Image: string, 
  lang: string = "id", 
  categories: string[] = []
): Promise<ParsedTransaction[]> {
  const visionModels = ["openrouter/auto", "google/gemini-2.0-flash-exp:free"];
  const systemPrompt = getSystemPrompt(lang, categories);

  for (const model of visionModels) {
    try {
      console.log(`📷 SANS AI Vision dipanggil [lang: ${lang}] via model: ${model}...`);
      const response = await openrouter.chat.completions.create({
        model: model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `${systemPrompt}\nEkstrak item belanja dari struk ini.` },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ]
      });

      const content = response.choices[0]?.message?.content;
      if (!content) continue;

      const parsed = cleanJsonResponse(content);
      if (parsed && Array.isArray(parsed.transactions) && parsed.transactions.length > 0) {
        return parsed.transactions;
      }
    } catch (error: any) {
      console.warn(`⚠️ Vision model ${model} gagal:`, error?.message || error);
    }
  }

  throw new Error("SANS gagal membaca data struk.");
}
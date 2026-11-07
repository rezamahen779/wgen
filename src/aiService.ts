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
 * Membuat Prompt AI Dinamis berdasarkan Bahasa, Mata Uang, & Kategori
 */
function getSystemPrompt(
  lang: string = "id",
  availableCategories: string[] = [],
  currency: string = "JPY"
): string {
  const categoriesText =
    availableCategories.length > 0
      ? availableCategories.map((c) => `"${c}"`).join(", ")
      : `"Makan & Minum", "Transportasi", "Belanja", "Tagihan", "Gaji", "Lainnya"`;

  return `
Nama kamu adalah SANS, asisten AI pencatat keuangan otomatis untuk aplikasi WGen Note.

STRICT RULE NOMINAL / AMOUNT:
1. DILARANG KERAS MENGONVERSI MATA UANG! Jangan pernah menghitung kurs (seperti mengubah IDR ke JPY).
2. Nilai 'amount' HARUS DALAM ANGKA MATEMATIK ASLI sesuai input user:
   - "30rb" / "30k" = 30000
   - "30 man" / "30万" = 300000 (1 man = 10.000)
   - "3 man" / "3万" = 30000
   - "1.5jt" = 1500000
   - "3000 yen" / "3000" = 3000
3. Apapun teksnya (30rb yen, 30k yen, 3万 yen), hitung angka matematikanya saja tanpa mengabaikan nol-nya.

METADATA:
- Bahasa judul ('title'): Gunakan bahasa [${lang.toUpperCase()}].
- Mata Uang Utama Aplikasi: [${currency}].
- Kategori wajib pilih persis dari daftar ini: [${categoriesText}].

Format Output HANYA JSON MURNI:
{
  "transactions": [
    {
      "title": "Nama item dalam bahasa ${lang}",
      "amount": 30000,
      "type": "expense",
      "category": "PILIH_SALAH_SATU_DARI_LIST",
      "payment_method": "Tunai"
    }
  ]
}
`;
}

/**
 * Pembersih angka murni anti-konversi kurs via Regex
 */
function parseRawAmount(inputMessage: string, aiAmount: number): number {
  // 1. Bersihkan teks: ubah ke lowercase & hapus sebutan mata uang biar ga bikin bingung regex
  const msg = inputMessage
    .toLowerCase()
    .replace(/(?:yen|jpy|rupiah|rp|usd|dirham|dollar|thb|won)/gi, "")
    .trim();

  // 2. Cek Man (万) khas Jepang (3 man -> 30000, 3万 -> 30000)
  const manMatch = msg.match(/(\d+(?:\.\d+)?)\s*(?:man|万)/);
  if (manMatch) {
    return Math.round(parseFloat(manMatch[1]) * 10000);
  }

  // 3. Cek Ribu / rb / k (30rb / 30k -> 30000)
  const rbMatch = msg.match(/(\d+(?:\.\d+)?)\s*(?:rb|k|ribu)/);
  if (rbMatch) {
    return Math.round(parseFloat(rbMatch[1]) * 1000);
  }

  // 4. Cek Juta / jt (1.5jt -> 1500000)
  const jtMatch = msg.match(/(\d+(?:\.\d+)?)\s*(?:jt|juta)/);
  if (jtMatch) {
    return Math.round(parseFloat(jtMatch[1]) * 1000000);
  }

  // 5. Cek jika user cuma nulis angka murni tanpa suffix (misal: "makan 30000")
  const plainNumMatch = msg.match(/(\d+)/);
  if (plainNumMatch && aiAmount < 1000 && parseFloat(plainNumMatch[1]) >= 1000) {
    return parseFloat(plainNumMatch[1]);
  }

  return aiAmount;
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
  categories: string[] = [],
  currency: string = "JPY"
): Promise<ParsedTransaction[]> {
  const freeModels = ["google/gemini-2.0-flash-exp:free", "openrouter/auto"];
  const systemPrompt = getSystemPrompt(lang, categories, currency);

  for (const model of freeModels) {
    try {
      console.log(`🤖 SANS AI dipanggil [lang: ${lang}, curr: ${currency}] via model: ${model}...`);
      const response = await openrouter.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userInput },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) continue;

      const parsed = cleanJsonResponse(content);
      if (parsed && Array.isArray(parsed.transactions) && parsed.transactions.length > 0) {
        return parsed.transactions.map((transaction: any) => ({
          ...transaction,
          amount: parseRawAmount(userInput, Number(transaction.amount) || 0),
        }));
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
  categories: string[] = [],
  currency: string = "JPY"
): Promise<ParsedTransaction[]> {
  const visionModels = ["google/gemini-2.0-flash-exp:free", "openrouter/auto"];
  const systemPrompt = getSystemPrompt(lang, categories, currency);

  for (const model of visionModels) {
    try {
      console.log(`📷 SANS AI Vision dipanggil [lang: ${lang}, curr: ${currency}] via model: ${model}...`);
      const response = await openrouter.chat.completions.create({
        model: model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `${systemPrompt}\nEkstrak item belanja dari struk ini.` },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            ],
          },
        ],
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
import OpenAI from "openai";
import dotenv from "dotenv";
import { CATEGORIES_BY_LANG, getStandardCategoryValue } from "./CategoryHelper";

dotenv.config();

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:5173",
    "X-Title": "WGen Note SANS AI",
  },
})

export interface ParsedTransaction {
  title: string;
  amount: number;
  type: "expense" | "income";
  category: string;
  payment_method?: string;
  currency?: string;
  note?: string;
}

function getLanguageName(langCode: string): string {
  const map: Record<string, string> = {
    id: "Indonesian",
    ja: "Japanese",
    jp: "Japanese",
    en: "English",
    ar: "Arabic",
    cn: "Chinese (Simplified)"
  };
  return map[langCode.toLowerCase()] || "Indonesian";
}

function getSystemPrompt(
  lang: string = "id",
  availableCategories: string[] = [],
  currency: string = "JPY"
): string {
  const targetLanguage = getLanguageName(lang);
  const categoriesText =
    availableCategories.length > 0
      ? availableCategories.map((c) => `"${c}"`).join(", ")
      : `"Makan dan minum", "Food & Drinks", "Belanja", "Shopping", "Transportasi", "Gaji", "Lainnya"`;

  return `
Nama kamu adalah SANS, asisten AI pencatat keuangan otomatis untuk aplikasi WGen Note.

STRICT RULE NOMINAL / AMOUNT:
1. DILARANG KERAS MENGONVERSI MATA UANG DALAM BENTUK APA PUN!
2. Ambil HANYA ANGKA NOMINAL MATEMATIKA ASLI yang ditulis user:
   - "30rb yen" -> amount = 30000
   - "30k idr" -> amount = 30000
   - "3 man yen" / "3万" -> amount = 30000
   - "3000 yen" -> amount = 3000
   - "1.5jt" -> amount = 1500000
3. Hitung perkalian matematika suffix (rb, k, man, 万, jt, m) secara murni.

STRICT RULE MATA UANG (CURRENCY DETECTION):
Daftar mata uang yang didukung: [AED, AUD, CNY, EUR, GBP, IDR, JPY, KRW, MYR, SAR, SGD, THB, USD].
1. Jika user menyebutkan kata 'rupiah' / 'idr' / 'rp' -> set "currency": "IDR"
2. Jika user menyebutkan kata 'yen' / 'jpy' / '円' -> set "currency": "JPY"
3. Jika user TIDAK menyebutkan mata uang -> WAJIB set "currency": "${currency}"

STRICT RULE KATEGORI (CATEGORY MATCHING):
Pilih kategori yang PALING COCOK dari daftar ini: [${categoriesText}].
- Pakaian/Baju/Celana/Sepatu/Tas -> Pilih kategori Belanja ("Shopping" / "Belanja" / "ショッピング").
- Makanan/Minuman/Restoran/Warung -> Pilih kategori Makan ("Food & Drinks" / "Makan dan minum" / "飲食").
- Kendaraan/Bensin/Tiket/Transport -> Pilih kategori Transportasi ("Transportation" / "Transportasi" / "交通費").

METADATA:
- Bahasa judul ('title') dan catatan ('note'): WAJIB menggunakan bahasa ${targetLanguage}.
- Mata Uang Utama Aplikasi: ${currency}.

Format Output HANYA JSON MURNI:
{
  "transactions": [
    {
      "title": "Judul item",
      "amount": 30000,
      "type": "expense",
      "category": "PILIH_PERSIS_DARI_DAFTAR_KATEGORI",
      "payment_method": "Cash",
      "currency": "KODE_CURRENCY_HASIL_DETEKSI",
      "note": ""
    }
  ]
}
`;
}

function parseRawAmount(inputMessage: string, aiAmount: number): number {
  const msg = inputMessage.toLowerCase().trim();

  // 1. Cek Man (万) khas Jepang (3 man -> 30000, 3万 -> 30000)
  const manMatch = msg.match(/(\d+(?:\.\d+)?)\s*(?:man|万)/);
  if (manMatch) {
    return Math.round(parseFloat(manMatch[1]) * 10000);
  }

  // 2. Cek Ribu / rb / k (30rb yen / 30k -> 30000)
  const rbMatch = msg.match(/(\d+(?:\.\d+)?)\s*(?:rb|k|ribu)/);
  if (rbMatch) {
    return Math.round(parseFloat(rbMatch[1]) * 1000);
  }

  // 3. Cek Juta / jt / m (1.5jt -> 1500000)
  const jtMatch = msg.match(/(\d+(?:\.\d+)?)\s*(?:jt|juta|m)/);
  if (jtMatch) {
    return Math.round(parseFloat(jtMatch[1]) * 1000000);
  }

  // 4. Jika user hanya menulis angka murni
  const plainNumMatch = msg.replace(/[^\d]/g, "");
  if (plainNumMatch && aiAmount === 0) {
    return parseFloat(plainNumMatch);
  }

  return aiAmount;
}

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

export async function parseTransactionText(
  userInput: string,
  lang: string = "id",
  categories: string[] = [],
  currency: string = "JPY"
): Promise<ParsedTransaction[]> {
  const freeModels = ["google/gemini-2.0-flash-exp:free", "meta-llama/llama-3.3-70b-instruct:free", "openrouter/auto"];
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
          currency: transaction.currency || currency,
          note: transaction.note || "",
        }));
      }
    } catch (error: any) {
      console.warn(`⚠️ Model ${model} gagal:`, error?.message || error);
    }
  }

  throw new Error("SANS gagal menguraikan transaksi.");
}

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
        return parsed.transactions.map((transaction: any) => ({
          ...transaction,
          currency: transaction.currency || currency,
          note: transaction.note || "",
        }));
      }
    } catch (error: any) {
      console.warn(`⚠️ Vision model ${model} gagal:`, error?.message || error);
    }
  }

  throw new Error("SANS gagal membaca data struk.");
}
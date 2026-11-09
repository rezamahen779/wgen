import OpenAI from "openai";
import dotenv from "dotenv";
import { CATEGORIES_BY_LANG, CATEGORY_MAP, getStandardCategoryValue } from "./CategoryHelper";

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
    cn: "Chinese (Simplified)",
  };
  return map[langCode.toLowerCase()] || "Indonesian";
}

/**
 * Prompt AI: Menyerahkan klasifikasi kata (pakaian, hiburan, makanan, dll) 
 * sepenuhnya ke LLM secara otomatis.
 */
function getSystemPrompt(
  lang: string = "id",
  availableCategories: string[] = [],
  currency: string = "JPY"
): string {
  const targetLanguage = getLanguageName(lang);
  const categoriesText =
    availableCategories.length > 0
      ? availableCategories.map((c) => `"${c}"`).join(", ")
      : `"Makan & Minum", "Belanja", "Shopping", "Food & Drinks", "Transportasi", "Gaji", "Lainnya"`;

  return `
Nama kamu adalah SANS, asisten AI pencatat keuangan otomatis untuk aplikasi WGen Note.

TUGAS UTAMA:
Analisis pesan/gambar transaksi pengguna dan ekstrak ke JSON.

STRICT RULE NOMINAL / AMOUNT:
1. DILARANG KERAS MENGONVERSI MATA UANG DALAM BENTUK APA PUN! (Jangan hitung kurs IDR, JPY, USD, dll).
2. Ambil ANGKA NOMINAL MATEMATIKA ASLI yang ditulis user:
   - "30rb yen" -> amount = 30000
   - "30k idr" -> amount = 30000
   - "3 man yen" / "3万" -> amount = 30000
   - "3000 yen" -> amount = 3000
   - "1.5jt" -> amount = 1500000
3. Hitung perkalian matematika suffix (rb, k, man, 万, jt, m) secara murni.

STRICT RULE MATA UANG (CURRENCY DETECTION):
Daftar mata uang yang didukung: [AED, AUD, CNY, EUR, GBP, IDR, JPY, KRW, MYR, SAR, SGD, THB, USD].
1. Jika user menyebutkan kata/simbol mata uang (misal: 'usd', '$', 'rupiah', 'idr', 'rp', 'yen', 'jpy', '万', '円', 'eur', 'sgd') -> WAJIB set "currency" sesuai kode standar ISO tersebut.
2. Jika user TIDAK menyebutkan mata uang -> WAJIB set "currency": "${currency}".

STRICT RULE PEMETAAN KATEGORI (CATEGORY MATCHING OTOMATIS):
Pilih SATU kategori yang PALING LOGIS dan SESUAI PERSIS dari daftar ini: [${categoriesText}].
- Gunakan pemahaman bahasa kamu secara alami:
  * Pakaian, sepatu, aksesoris, barang belanjaan, tas -> Pilih kategori Belanja / Shopping.
  * Makanan, minuman, kopi, kuliner, restoran -> Pilih kategori Makan & Minum / Food & Drinks.
  * Langganan digital, film, game, hiburan, musik (misal: Netflix, Spotify, Steam) -> Pilih kategori Entertainment / Hiburan / Tagihan.
  * Ongkos, bensin, tiket kendaraan, transportasi -> Pilih kategori Transportasi.
- String kategori yang kamu kembalikan HARUS SAMA PERSIS dengan salah satu pilihan di [${categoriesText}].

METADATA:
- Bahasa judul ('title') dan catatan ('note'): WAJIB menggunakan bahasa ${targetLanguage}.
- Mata Uang Utama Aplikasi: ${currency}.

Format Output HANYA JSON MURNI:
{
  "transactions": [
    {
      "title": "nama item",
      "amount": 30000,
      "type": "expense",
      "category": "NAMA_KATEGORI_EXACT_MATCH",
      "payment_method": "Cash",
      "currency": "KODE_CURRENCY",
      "note": ""
    }
  ]
}
`;
}

/**
 * Parsing Angka dan Suffix (rb, k, man, jt, dll)
 */
function parseRawAmount(inputMessage: string, aiAmount: number): number {
  const msg = inputMessage.toLowerCase().trim();

  // 1. Man / 万 (Jepang)
  const manMatch = msg.match(/(\d+(?:[\.,]\d+)?)\s*(?:man|万)/);
  if (manMatch) {
    return Math.round(parseFloat(manMatch[1].replace(',', '.')) * 10000);
  }

  // 2. Ribu / rb / k
  const rbMatch = msg.match(/(\d+(?:[\.,]\d+)?)\s*(?:rb|k|ribu)/);
  if (rbMatch) {
    return Math.round(parseFloat(rbMatch[1].replace(',', '.')) * 1000);
  }

  // 3. Juta / jt / m
  const jtMatch = msg.match(/(\d+(?:[\.,]\d+)?)\s*(?:jt|juta|m)/);
  if (jtMatch) {
    return Math.round(parseFloat(jtMatch[1].replace(',', '.')) * 1000000);
  }

  // 4. Fallback jika AI mengembalikan 0
  const plainNumMatch = msg.replace(/[^\d]/g, "");
  if (plainNumMatch && aiAmount === 0) {
    return parseFloat(plainNumMatch);
  }

  return aiAmount;
}

/**
 * Deteksi Currency dari Teks Input (Safety Net)
 */
function detectCurrencyFromInput(input: string, defaultCurr: string): string {
  const clean = input.toLowerCase();
  if (/\b(usd|\$|dollar|dolar)\b/i.test(clean)) return 'USD';
  if (/\b(yen|jpy|万|円)\b/i.test(clean)) return 'JPY';
  if (/\b(rupiah|idr|rp)\b/i.test(clean)) return 'IDR';
  if (/\b(eur|euro)\b/i.test(clean)) return 'EUR';
  if (/\b(sgd)\b/i.test(clean)) return 'SGD';
  if (/\b(gbp|pound)\b/i.test(clean)) return 'GBP';
  if (/\b(myr|rm|ringgit)\b/i.test(clean)) return 'MYR';
  return defaultCurr;
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
  const activeLangCategories =
    CATEGORIES_BY_LANG[lang as keyof typeof CATEGORIES_BY_LANG] || CATEGORIES_BY_LANG["id"];
  
  const finalCategories = categories.length > 0
    ? categories
    : [
        ...(activeLangCategories?.expenseRoutine || []),
        ...(activeLangCategories?.expenseAsset || []),
        ...(activeLangCategories?.incomeRoutine || []),
        ...(activeLangCategories?.incomeAsset || []),
      ];

  const freeModels = ["google/gemini-2.0-flash-exp:free", "meta-llama/llama-3.3-70b-instruct:free", "openrouter/auto"];
  const systemPrompt = getSystemPrompt(lang, finalCategories, currency);

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
        return parsed.transactions.map((transaction: any) => {
          // 1. Deteksi Currency
          const detectedCurrency = detectCurrencyFromInput(userInput, transaction.currency || currency);

          // 2. Pencocokan Kategori Otomatis:
          // Cari kategori yang eksak dari list UI. Jika AI mengembalikan key mentah, lewatkan ke CategoryHelper.
          // 🟢 PURE AUTOMATIC DICTIONARY MATCHING (TANPA 1 PUN KATA IF-ELSE MANUAL!)
// 🟢 PURE AUTOMATIC DICTIONARY MATCHING (DISAVE & TANPA IF-ELSE REGEX MANUAL)
const rawCatFromAI = (transaction.category || "").toLowerCase();
const inputLower = userInput.toLowerCase();

// 1. Match eksak dengan finalCategories UI
let matchedCategory = finalCategories.find(c => c.toLowerCase() === rawCatFromAI);

// 2. Cek lewat CATEGORY_MAP kamu (Mencakup kata kunci dari input DAN dari AI)
if (!matchedCategory && CATEGORY_MAP) {
  for (const [key, translations] of Object.entries(CATEGORY_MAP)) {
    const allPossibleNames = [key, ...Object.values(translations)].map(v => String(v).toLowerCase());

    // Cek apakah input mentah (misal: "cincin") atau balasan AI ada di kamus CATEGORY_MAP kamu
    const isMatch = allPossibleNames.some(name => 
      inputLower.includes(name) || rawCatFromAI.includes(name) || name.includes(rawCatFromAI)
    );

    if (isMatch) {
      const targetLangName = String((translations as any)[lang] || (translations as any)['id'] || key);
      matchedCategory = finalCategories.find(c => c.toLowerCase() === targetLangName.toLowerCase());
      if (matchedCategory) break;
    }
  }
}

// 3. Fallback: Kembalikan string AI (Jangan pernah fallback ke finalCategories[0]!)
matchedCategory = matchedCategory || transaction.category;

      return {
        ...transaction,
        amount: parseRawAmount(userInput, Number(transaction.amount) || 0),
        category: matchedCategory, // 👈 Hasil matching otomatis tanpa if-else
        currency: detectedCurrency,
        note: transaction.note || "",
      };
    });
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
  const activeLangCategories =
    CATEGORIES_BY_LANG[lang as keyof typeof CATEGORIES_BY_LANG] || CATEGORIES_BY_LANG["id"];
  
  const finalCategories = categories.length > 0
    ? categories
    : [
        ...(activeLangCategories?.expenseRoutine || []),
        ...(activeLangCategories?.expenseAsset || []),
      ];

  const visionModels = ["google/gemini-2.0-flash-exp:free", "openrouter/auto"];
  const systemPrompt = getSystemPrompt(lang, finalCategories, currency);

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
        return parsed.transactions.map((transaction: any) => {
          const rawCat = transaction.category || "";
          const exactMatch = finalCategories.find(
            (c) => c.toLowerCase() === rawCat.toLowerCase()
          );

          return {
            ...transaction,
            category: exactMatch || getStandardCategoryValue(rawCat) || rawCat,
            currency: transaction.currency || currency,
            note: transaction.note || "",
          };
        });
      }
    } catch (error: any) {
      console.warn(`⚠️ Vision model ${model} gagal:`, error?.message || error);
    }
  }

  throw new Error("SANS gagal membaca data struk.");
}
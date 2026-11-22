export async function translateText(text, targetLang) {
  if (!text) return text;
  
  // Normalisasi kode bahasa ke standar ISO (misal: 'jp' -> 'ja')
  const langMap = { id: 'id', en: 'en', jp: 'ja', ar: 'ar', cn: 'zh' };
  const target = langMap[targetLang] || 'en';

  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|${target}`
    );
    const data = await res.json();
    return data.responseData.translatedText || text;
  } catch (error) {
    console.error("Translation error:", error);
    return text; // Return teks asli jika koneksi offline/gagal
  }
}
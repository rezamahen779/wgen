// src/lib/currencyService.js

/**
 * Helper internal: Ambil cache kurs dari localStorage secara instan (sinkron)
 */
function getLocalCachedRates() {
  try {
    const cached = localStorage.getItem('wgen_cached_rates');
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Fetch Kurs Live Valas & Harga Emas Terbaru
 */
export async function fetchLiveExchangeRates() {
  const cachedRates = getLocalCachedRates() || {};
  const cachedTime = localStorage.getItem('wgen_rates_updated');
  
  // Refresh cache jika sudah lebih dari 1 jam
  const ONE_HOUR = 60 * 60 * 1000;
  if (cachedRates && cachedTime && (Date.now() - Number(cachedTime) < ONE_HOUR) && cachedRates.GOLD_IDR) {
    return cachedRates;
  }

  let liveRates = { ...cachedRates };

  // 1. Fetch Kurs Valas & XAU (USD Base)
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-cache' });
    const data = await response.json();
    if (data && data.result === 'success' && data.rates) {
      liveRates = { ...liveRates, ...data.rates };
    }
  } catch (error) {
    console.warn("⚠️ Gagal fetch kurs valas live:", error);
  }

  // 2. Fetch Live Harga Emas Antam khusus IDR (Logam Mulia)
  try {
    const goldRes = await fetch('https://logam-mulia-api.vercel.app/prices/hargaemas-org');
    const goldData = await goldRes.json();
    
    if (goldData && goldData.data && goldData.data[0] && goldData.data[0].harga) {
      const rawPrice = goldData.data[0].harga.replace(/[^0-9]/g, '');
      const antamGramPrice = parseFloat(rawPrice);
      if (antamGramPrice > 0) {
        liveRates.GOLD_IDR = antamGramPrice;
      }
    }
  } catch (gErr) {
    try {
      const backupRes = await fetch('https://indonesia-currency-api.vercel.app/api/gold');
      const backupData = await backupRes.json();
      if (backupData && backupData.price) {
        liveRates.GOLD_IDR = parseFloat(backupData.price);
      }
    } catch (err2) {
      console.warn("⚠️ Gagal fetch API Emas Antam live, memakai data spot fallback.");
    }
  }

  // Fallback IDR jika API Antam offline: Spot World USD * IDR * 1.12 (Premi Fisik Antam)
  if (!liveRates.GOLD_IDR && liveRates.XAU && liveRates.IDR) {
    const GRAM_PER_TROY_OUNCE = 31.1034768;
    const spotUSDPerGram = (1 / liveRates.XAU) / GRAM_PER_TROY_OUNCE;
    liveRates.GOLD_IDR = Math.round(spotUSDPerGram * liveRates.IDR * 1.12);
  }

  // Simpan ke storage
  localStorage.setItem('wgen_cached_rates', JSON.stringify(liveRates));
  localStorage.setItem('wgen_rates_updated', Date.now());

  return liveRates;
}

/**
 * Menghitung Harga Emas Real per Gram dalam Mata Uang Tujuan
 */
export function getGoldPricePerGram(targetCurrency = 'IDR', liveRates = null) {
  const activeRates = (liveRates && Object.keys(liveRates).length > 0) 
    ? liveRates 
    : getLocalCachedRates();

  if (!activeRates) return 0;

  const GRAM_PER_TROY_OUNCE = 31.1034768;

  // 1. KHUSUS IDR -> Emas Fisik Antam
  if (targetCurrency === 'IDR') {
    if (activeRates.GOLD_IDR && activeRates.GOLD_IDR > 0) {
      return Math.round(activeRates.GOLD_IDR);
    }
    if (activeRates.XAU && activeRates.IDR) {
      const spotUSDPerGram = (1 / activeRates.XAU) / GRAM_PER_TROY_OUNCE;
      return Math.round(spotUSDPerGram * activeRates.IDR * 1.12);
    }
    return 2545000;
  }

  // 2. JPY / USD / MATA UANG LAIN -> Spot Emas Murni Dunia
  if (activeRates.XAU && activeRates.XAU > 0) {
    const goldUSDPerOunce = 1 / activeRates.XAU;
    const goldUSDPerGram = goldUSDPerOunce / GRAM_PER_TROY_OUNCE;

    const targetRate = activeRates[targetCurrency] || 1;
    const localTaxMultiplier = (targetCurrency === 'JPY') ? 1.035 : 1.0; 

    const finalPrice = goldUSDPerGram * targetRate * localTaxMultiplier;
    return Math.round(finalPrice);
  }

  return 0;
}

/**
 * Konversi Nilai Mata Uang Dinamis (Valas, Emas, dan Crypto)
 */
export function convertCurrencyDynamic(amount, fromCurr = 'USD', toCurr = 'IDR', liveRates = null) {
  const amt = parseFloat(amount) || 0;
  if (amt === 0) return 0;

  // 🟢 PERBAIKAN 1: Sanitasi String & Early Return kalau dari & ke currency-nya SAMA
  const cleanFrom = (fromCurr || 'USD').toUpperCase();
  const cleanTo = (toCurr || 'USD').toUpperCase();
  if (cleanFrom === cleanTo) return amt;

  const activeRates = (liveRates && Object.keys(liveRates).length > 0)
    ? liveRates
    : getLocalCachedRates();

  if (!activeRates) return amt;

  const cryptoCodes = ['BTC', 'ETH', 'USDT'];

  // Konversi dari/ke Emas (XAU)
  if (cleanFrom === 'XAU') {
    const goldPriceUSD = getGoldPricePerGram('USD', activeRates);
    const totalUSD = amt * goldPriceUSD;
    if (cryptoCodes.includes(cleanTo)) {
      return activeRates[cleanTo] ? totalUSD * activeRates[cleanTo] : 0;
    }
    const toRate = cleanTo === 'USD' ? 1 : (activeRates[cleanTo] || 1);
    return totalUSD * toRate;
  }

  if (cleanTo === 'XAU') {
    let amtInUSD = 0;
    if (cryptoCodes.includes(cleanFrom)) {
      amtInUSD = activeRates[cleanFrom] ? amt / activeRates[cleanFrom] : 0;
    } else {
      const fromRate = cleanFrom === 'USD' ? 1 : (activeRates[cleanFrom] || 1);
      amtInUSD = amt / fromRate;
    }
    const goldPriceUSD = getGoldPricePerGram('USD', activeRates);
    return goldPriceUSD > 0 ? amtInUSD / goldPriceUSD : 0;
  }

  // 🟢 PERBAIKAN 2: Konversi Valas / Crypto biasa (Pastikan USD SELALU = 1)
  // Ini kunci biar gak kebagi 18.000 pas ganti setting ke USD!
  const rateFrom = cleanFrom === 'USD' ? 1 : (activeRates[cleanFrom] || 1);
  const rateTo = cleanTo === 'USD' ? 1 : (activeRates[cleanTo] || 1);

  const amountInUSD = amt / rateFrom;
  return amountInUSD * rateTo;
}

/**
 * Helper Simbol Mata Uang & Komoditas Dinamis
 */
export function getCurrencySymbolDynamic(code) {
  const symbols = {
    XAU: '🥇', BTC: '₿', ETH: 'Ξ', USDT: '₮',
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', IDR: 'Rp',
    SAR: '﷼', SGD: 'S$', MYR: 'RM', KRW: '₩', THB: '฿',
    AUD: 'A$', CNY: '¥', AED: 'DH', CAD: 'CA$', HKD: 'HK$',
    NZD: 'NZ$', INR: '₹', VND: '₫', PHP: '₱', TWD: 'NT$',
    CHF: 'CHF', QAR: 'QR'
  };
  return symbols[code] || code;
}

// 🚀 ALIAS EXPORT (Biar Dashboard & komponen lama yang memanggil convertCurrency tidak crash!)
export const convertCurrency = convertCurrencyDynamic;
export const getCurrencySymbol = getCurrencySymbolDynamic;
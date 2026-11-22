import { useState, useEffect } from 'react';
import { Calculator, RefreshCw, Plus, Trash2, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { getThemeStyles } from './Settings';

export default function CurrencyCalculator({ 
  twoToneTheme = 'emerald', 
  language = 'id',
  isDarkMode = false
}) {
  const [calcAmount, setCalcAmount] = useState(() => {
    return localStorage.getItem('wgen_calc_amount') || '1';
  });
  const [fromCurr, setFromCurr] = useState(() => {
    return localStorage.getItem('wgen_calc_from') || 'JPY';
  });
  const [targetCurrencies, setTargetCurrencies] = useState(() => {
    try {
      const saved = localStorage.getItem('wgen_calc_targets');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : ['IDR', 'USD'];
    } catch {
      return ['IDR', 'USD'];
    }
  });
  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem('wgen_calc_minimized') === 'true';
  });

  const [rawRates, setRawRates] = useState(() => {
    try {
      const cached = localStorage.getItem('wgen_cached_rates');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [activePickerIndex, setActivePickerIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const currentTheme = getThemeStyles(twoToneTheme);
  const isRTL = language === 'ar';

  // Simpan otomatis ke localStorage setiap ada perubahan
  useEffect(() => {
    localStorage.setItem('wgen_calc_amount', calcAmount);
  }, [calcAmount]);

  useEffect(() => {
    localStorage.setItem('wgen_calc_from', fromCurr);
  }, [fromCurr]);

  useEffect(() => {
    localStorage.setItem('wgen_calc_targets', JSON.stringify(targetCurrencies));
  }, [targetCurrencies]);

  useEffect(() => {
    localStorage.setItem('wgen_calc_minimized', String(isMinimized));
  }, [isMinimized]);

  const currencies = [
    { code: 'XAU', label: 'Emas (Gold / Gram)', symbol: '🥇' },
    { code: 'BTC', label: 'Bitcoin', symbol: '₿' },
    { code: 'ETH', label: 'Ethereum', symbol: 'Ξ' },
    { code: 'USDT', label: 'Tether', symbol: '₮' },
    { code: 'USD', label: 'US Dollar', symbol: '$' },
    { code: 'EUR', label: 'Euro', symbol: '€' },
    { code: 'GBP', label: 'British Pound', symbol: '£' },
    { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
    { code: 'IDR', label: 'Rupiah', symbol: 'Rp' },
    { code: 'SAR', label: 'Saudi Riyal', symbol: '﷼' },
    { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
    { code: 'MYR', label: 'Malaysian Ringgit', symbol: 'RM' },
    { code: 'KRW', label: 'South Korean Won', symbol: '₩' },
    { code: 'THB', label: 'Thai Baht', symbol: '฿' },
    { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
    { code: 'CNY', label: 'Chinese Yuan', symbol: '¥' },
    { code: 'AED', label: 'UAE Dirham', symbol: 'DH' },
    { code: 'CAD', label: 'Canadian Dollar', symbol: 'CA$' },
    { code: 'HKD', label: 'Hong Kong Dollar', symbol: 'HK$' },
    { code: 'NZD', label: 'New Zealand Dollar', symbol: 'NZ$' },
    { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
    { code: 'VND', label: 'Vietnamese Dong', symbol: '₫' },
    { code: 'PHP', label: 'Philippine Peso', symbol: '₱' },
    { code: 'TWD', label: 'New Taiwan Dollar', symbol: 'NT$' },
    { code: 'CHF', label: 'Swiss Franc', symbol: 'CHF' },
    { code: 'QAR', label: 'Qatari Riyal', symbol: 'QR' },
  ];

  const getCurrencySymbol = (code) => {
    const found = currencies.find(c => c.code === code);
    return found ? found.symbol : code;
  };

  const i18n = {
    id: { title: 'Kalkulator Kurs & Emas', updated: 'Diperbarui:', placeholder: 'Nominal...', result: 'Hasil Konversi', addRow: 'Tambah Mata Uang', maxAlert: 'Maksimal 10 mata uang!', updateBtn: 'Update Kurs', selectCurr: 'Pilih Mata Uang / Emas', search: 'Cari mata uang...' },
    jp: { title: '為替・金計算機', updated: '更新日時:', placeholder: '金額...', result: '換算結果', addRow: '通貨を追加', maxAlert: '最大10個の通貨まで追加できます！', updateBtn: 'レート更新', selectCurr: '通貨・金を選択', search: '通貨を検索...' },
    en: { title: 'Rate & Gold Calculator', updated: 'Updated:', placeholder: 'Amount...', result: 'Converted Amount', addRow: 'Add Currency', maxAlert: 'Maximum 10 currencies allowed!', updateBtn: 'Update Rates', selectCurr: 'Select Currency / Gold', search: 'Search currency...' },
    ar: { title: 'حاسبة أسعار الصرف والذهب', updated: 'تم التحديث:', placeholder: 'المبلغ...', result: 'نتيجة التحويل', addRow: 'إضافة عملة', maxAlert: 'الحد الأقصى 10 عملات فقط!', updateBtn: 'تحديث الأسعار', selectCurr: 'اختر العملة أو الذهب', search: 'بحث عن عملة...' },
    cn: { title: '汇率与黄金计算器', updated: '更新时间:', placeholder: '金额...', result: '转换结果', addRow: '添加货币', maxAlert: '最多可添加 10 种货币！', updateBtn: '更新汇率', selectCurr: '选择货币或黄金', search: '搜索货币...' }
  };

  const t = i18n[language] || i18n.id;

  const loadLiveRates = async () => {
    setIsLoadingRates(true);
    try {
      const resRates = await fetch('https://open.er-api.com/v6/latest/USD');
      const dataRates = await resRates.json();
      let rates = dataRates?.rates || {};

      try {
        const [resBtc, resEth] = await Promise.all([
          fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT').then(r => r.json()),
          fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT').then(r => r.json())
        ]);
        if (resBtc?.price) rates['BTC'] = 1 / parseFloat(resBtc.price);
        if (resEth?.price) rates['ETH'] = 1 / parseFloat(resEth.price);
        rates['USDT'] = 1;
      } catch (cErr) {
        console.warn('Crypto fetch fallback:', cErr);
      }

      if (rates && Object.keys(rates).length > 0) {
        setRawRates(rates);
        setLastUpdated(new Date().toLocaleTimeString());
        localStorage.setItem('wgen_cached_rates', JSON.stringify(rates));
      }
    } catch (error) {
      console.error('Gagal memperbarui kurs live:', error);
    } finally {
      setIsLoadingRates(false);
    }
  };

  useEffect(() => {
    loadLiveRates();
  }, []);

  const handleCalcAmountChange = (e) => {
    const rawValue = e.target.value.replace(/,/g, '');
    if (rawValue === '' || !isNaN(rawValue)) {
      if (rawValue === '') {
        setCalcAmount('');
      } else {
        const parts = rawValue.split('.');
        parts[0] = Number(parts[0]).toLocaleString('en-US');
        setCalcAmount(parts.join('.'));
      }
    }
  };

  const calculateResult = (toCurr) => {
    const cleanAmount = calcAmount.toString().replace(/,/g, '');
    const amt = parseFloat(cleanAmount) || 0;
    if (amt === 0) return '0';

    const cryptoCodes = ['BTC', 'ETH', 'USDT'];

    let goldPriceUSD = 0;
    if (rawRates['XAU'] && rawRates['XAU'] > 0) {
      const rawXau = rawRates['XAU'];
      if (rawXau < 1) {
        goldPriceUSD = (1 / rawXau) / 31.1034768;
      } else {
        goldPriceUSD = rawXau / 31.1034768;
      }
    } else if (rawRates['GOLD'] && rawRates['GOLD'] > 0) {
      goldPriceUSD = rawRates['GOLD'];
    } else {
      goldPriceUSD = 130.72;
    }

    // A. DARI EMAS (XAU) KE LAINNYA
    if (fromCurr === 'XAU') {
      if (toCurr === 'XAU') return amt.toLocaleString('en-US');

      if (cryptoCodes.includes(toCurr)) {
        const cryptoRate = rawRates[toCurr];
        if (!cryptoRate) return '0';
        const totalUSD = amt * goldPriceUSD;
        return (totalUSD * cryptoRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
      }

      if (toCurr === 'USD') {
        return (amt * goldPriceUSD).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      }

      const targetRate = rawRates[toCurr] || 1;
      const totalValue = amt * goldPriceUSD * targetRate;
      return Math.round(totalValue).toLocaleString('en-US');
    }

    // B. DARI LAINNYA KE EMAS (XAU)
    if (toCurr === 'XAU') {
      let amtInUSD = 0;
      if (cryptoCodes.includes(fromCurr)) {
        if (!rawRates[fromCurr]) return '0';
        amtInUSD = amt / rawRates[fromCurr];
      } else if (fromCurr === 'USD') {
        amtInUSD = amt;
      } else {
        const fromRate = rawRates[fromCurr] || 1;
        amtInUSD = amt / fromRate;
      }

      const grams = amtInUSD / goldPriceUSD;
      return grams.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + ' Gram';
    }

    // C. KONVERSI BIASA (FIAT <-> FIAT / CRYPTO)
    const getRateInUSD = (code) => {
      if (code === 'USD') return 1;
      return rawRates[code] || null;
    };

    const fromRate = getRateInUSD(fromCurr);
    const toRate = getRateInUSD(toCurr);

    if (!fromRate || !toRate) return '0';

    const amountInUSD = amt / fromRate;
    const finalAmount = amountInUSD * toRate;

    if (finalAmount === 0) return '0';

    if (cryptoCodes.includes(toCurr)) {
      return finalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    }

    if (finalAmount < 1) {
      return finalAmount.toLocaleString('en-US', { maximumSignificantDigits: 4 });
    }

    return finalAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const handleAddTargetCurrency = () => {
    if (targetCurrencies.length >= 10) {
      alert(t.maxAlert);
      return;
    }
    const available = currencies.find(c => c.code !== fromCurr && !targetCurrencies.includes(c.code));
    const nextCode = available ? available.code : 'USD';
    setTargetCurrencies([...targetCurrencies, nextCode]);
  };

  const handleRemoveTargetCurrency = (index) => {
    if (targetCurrencies.length <= 1) return;
    setTargetCurrencies(targetCurrencies.filter((_, i) => i !== index));
  };

  const handleSelectCurrency = (code) => {
    if (activePickerIndex === 'from') {
      setFromCurr(code);
    } else if (typeof activePickerIndex === 'number') {
      const updated = [...targetCurrencies];
      updated[activePickerIndex] = code;
      setTargetCurrencies(updated);
    }
    setActivePickerIndex(null);
    setSearchQuery('');
  };

  const filteredCurrencies = currencies.filter(c => 
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const cardStyles = "bg-gray-200/85 dark:bg-gray-950 border border-gray-300 dark:border-gray-900 p-4 sm:p-5 rounded-3xl shadow-sm flex flex-col gap-3.5 max-w-md mx-auto w-full transition-all duration-300 box-border relative overflow-hidden";
  const controlStyles = "bg-gray-100/70 dark:bg-gray-900/70 p-2.5 sm:p-3 rounded-xl border border-gray-300 dark:border-gray-800 text-xs sm:text-sm font-semibold flex items-center justify-between cursor-pointer hover:bg-gray-200/50 dark:hover:bg-gray-800/50 transition";

  return (
    <div className={`${cardStyles} ${isDarkMode ? 'dark' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* HEADER & TOGGLE MINIMIZE */}
      <div className="flex justify-between items-center">
        <div className={`flex items-center gap-2 text-sm font-bold ${currentTheme.icon}`}>
          <Calculator className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span className={`bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent text-sm sm:text-base truncate`}>
            {t.title}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 shrink-0">
          <button 
            onClick={loadLiveRates} 
            disabled={isLoadingRates}
            className="p-2 rounded-xl bg-gray-300/60 dark:bg-gray-800 hover:opacity-80 transition"
            title={t.updateBtn}
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoadingRates ? 'animate-spin' : ''}`} />
          </button>
          
          {targetCurrencies.length > 2 && (
            <button 
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 rounded-xl bg-gray-300/60 dark:bg-gray-800 hover:opacity-80 transition text-gray-700 dark:text-gray-300"
            >
              {isMinimized ? <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 animate-fadeIn">
        {lastUpdated && (
          <span className="text-[10px] opacity-60 text-right -mt-1 dir-ltr">
            {t.updated} {lastUpdated}
          </span>
        )}

        {/* SOURCE CURRENCY INPUT */}
        <div className="flex gap-2 items-center w-full">
          <input 
            type="text" 
            value={calcAmount} 
            onChange={handleCalcAmountChange} 
            className={`flex-1 bg-gray-100/50 dark:bg-gray-900/50 p-2.5 sm:p-3 rounded-xl border border-gray-300 dark:border-gray-800 text-xs sm:text-sm font-semibold focus:outline-none min-w-0`} 
            placeholder={t.placeholder} 
          />
          <div 
            onClick={() => setActivePickerIndex('from')}
            className={`${controlStyles} w-[95px] sm:w-[110px] shrink-0`}
          >
            <span className="truncate">{fromCurr}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0 ml-1" />
          </div>
        </div>
        
        {/* DYNAMIC TARGET CURRENCIES (Jika minimize, tampilkan 2 teratas saja) */}
        <div className="flex flex-col gap-2">
          {(isMinimized ? targetCurrencies.slice(0, 2) : targetCurrencies).map((toCurr, idx) => (
            <div key={idx} className="flex gap-2 items-stretch w-full">
              <div className={`flex-1 p-2.5 sm:p-3 rounded-xl border flex flex-col justify-center min-w-0 overflow-hidden ${currentTheme.activeRing}`}>
                <span className="text-[9px] sm:text-[10px] opacity-70 uppercase tracking-wider mb-0.5">{t.result} #{idx + 1}</span>
                <p className={`text-xs sm:text-sm font-extrabold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent leading-tight truncate`}>
                  {toCurr !== 'XAU' && `${getCurrencySymbol(toCurr)} `}{calculateResult(toCurr)}
                </p>
              </div>
              
              <div 
                onClick={() => setActivePickerIndex(idx)}
                className={`${controlStyles} w-[95px] sm:w-[110px] shrink-0`}
              >
                <span className="truncate">{toCurr}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0 ml-1" />
              </div>

              {targetCurrencies.length > 1 && (
                <button 
                  onClick={() => handleRemoveTargetCurrency(idx)}
                  className="p-2.5 sm:p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition flex items-center justify-center border border-red-500/20 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Tombol Add Currency */}
        {!isMinimized && targetCurrencies.length < 10 && (
          <button 
            onClick={handleAddTargetCurrency}
            className={`flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-bold bg-gray-300/50 dark:bg-gray-900/50 hover:bg-gray-300 dark:hover:bg-gray-800 transition border border-gray-300 dark:border-gray-800`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.addRow} ({targetCurrencies.length}/10)</span>
          </button>
        )}
      </div>

      {/* MODAL PICKER */}
      {activePickerIndex !== null && (
        <div className="absolute inset-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-3xl p-4 flex flex-col gap-3 animate-fadeIn border border-gray-200 dark:border-gray-800 shadow-2xl">
          <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-2.5">
            <h3 className={`text-xs sm:text-sm font-bold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>
              {t.selectCurr}
            </h3>
            <button 
              onClick={() => { setActivePickerIndex(null); setSearchQuery(''); }}
              className="p-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-gray-400" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.search}
              className="w-full bg-gray-100 dark:bg-gray-950 border border-gray-300 dark:border-gray-800 rounded-xl py-2 pl-9 pr-3 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1 max-h-[220px]">
            {filteredCurrencies.map((c) => (
              <button
                key={c.code}
                onClick={() => handleSelectCurrency(c.code)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/90 hover:bg-gray-200 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 transition text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-7 h-7 rounded-lg bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-xs font-black ${currentTheme.icon} transition`}>
                    {c.symbol}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{c.code}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">{c.label}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
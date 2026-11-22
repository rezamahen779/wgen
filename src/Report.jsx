import { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, Info, ArrowRight, X, 
  Landmark, Banknote, CreditCard, Building2, Wallet, Zap,
  FileText
} from 'lucide-react';

// Turso Client & Firebase Auth
import { turso } from './lib/turso';
import { auth } from './lib/firebase';

// Helper Fetch Offline Fallback
import { fetchWithOfflineFallback } from './lib/dbService';

import { getThemeStyles } from './Settings';

// Import Helper Kategori Terpusat
import { 
  getStandardCategoryValue, 
  getTranslatedCategory,
  normalizeCategoryString
} from './categoryHelper';

import { fetchLiveExchangeRates, convertCurrencyDynamic, getCurrencySymbolDynamic } from './lib/currencyService';

// Preset Kategori Non-Operasional & Non-Rutin - SINKRON DENGAN TRANSACTIONFORM
const NON_OPERATIONAL_CATEGORIES = {
  id: ['Properti', 'Elektronik', 'Saham', 'Gold', 'Bisnis', 'Traveling', 'Kendaraan'],
  jp: ['不動産', '電子機器', '株式', '金・ゴールド', 'ビジネス', '旅行', '乗り物'],
  en: ['Property', 'Electronics', 'Stocks', 'Gold', 'Business', 'Traveling', 'Vehicles'],
  ar: ['عقارات', 'إلكترونيات', 'أسهم', 'ذهب', 'أعمال', 'سفر', 'مركبات'],
  cn: ['房产', '电子产品', '股票', '黄金', '商业', '旅游', '车辆']
};

const NON_ROUTINE_INCOME_CATEGORIES = {
  id: ['Bonus', 'Freelance', 'Investasi', 'Gold', 'Hutang', 'Hadiah'],
  jp: ['ボーナス', 'フリーランス', '投資', '金・ゴールド', '借入', 'ギフト'],
  en: ['Bonus', 'Freelance', 'Investment', 'Gold', 'Loan', 'Gift'],
  ar: ['مكافأة', 'عمل حر', 'استثمار', 'ذهب', 'قرض', 'هدية'],
  cn: ['奖金', '自由职业', '投资', '黄金', '借款', '礼物']
};

// 🟢 HELPER KHUSUS: MENENTUKAN UKURAN FONT DINAMIS BERDASARKAN PANJANG NOMINAL
const getDynamicFontSize = (textLength) => {
  if (textLength > 16) return 'text-[8px] sm:text-[9px]';
  if (textLength > 13) return 'text-[9px] sm:text-[10px]';
  if (textLength > 10) return 'text-[10px] sm:text-xs';
  return 'text-xs sm:text-sm';
};

export default function Report({ mainCurrency, language, twoToneTheme }) {
  const [transactions, setTransactions] = useState([]);
  const [liveRates, setLiveRates] = useState({});

  useEffect(() => {   
    fetchLiveExchangeRates().then(rates => {
      if (rates) setLiveRates(rates);
    });
  }, []);

  // SWITCH MODE REPORT: 'operational' (Rutin) | 'asset' (Aset / Non-Operasional)
  const [reportNature, setReportNature] = useState('operational');

  // Filter tanggal default KOSONG agar tidak membatasi data
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [activeExpCat, setActiveExpCat] = useState(null);
  const [activeIncCat, setActiveIncCat] = useState(null);
  const [activeMonth, setActiveMonth] = useState(null);

  // State Pop-up Full Screen untuk Semua Bulan Arus Kas
  const [showAllSavingsModal, setShowAllSavingsModal] = useState(false);

  // State Pop-up Full Screen Laporan Gabungan 1 Tahun Full (Tanpa Pemisahan)
  const [showFullYearModal, setShowFullYearModal] = useState(false);

  // STATE & REF UNTUK BALON DRAGGABLE (SUPER SMOOTH HARMONIK)
  const [isHovered, setIsHovered] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const balloonRef = useRef(null);
  const posRef = useRef({ x: 20, y: 120 });
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const hideTimerRef = useRef(null);
  const rafIdRef = useRef(null);

  const activeThemeId = twoToneTheme || 'emerald';
  const currentTheme = getThemeStyles(activeThemeId);

  // Kamus terjemahan UI Report & Switch Bahasa Dinamis Terlengkap
  const tReport = {
    id: {
      title: 'Laporan', 
      modeOperational: 'Operasional Bulanan',
      modeAsset: 'Aset / Non-Operasional',
      monthly: 'Pemasukan vs Pengeluaran', 
      expCat: 'Pengeluaran — Kategori', 
      incCat: 'Pemasukan — Kategori', 
      savMonth: 'Arus Kas — Bulanan', 
      savYear: 'Ringkasan Sisa Saldo', 
      totalExp: 'Total Pengeluaran', 
      totalInc: 'Total Pemasukan', 
      noExp: 'Belum ada pengeluaran.', 
      noInc: 'Belum ada pemasukan.', 
      income: 'Pemasukan', 
      expense: 'Pengeluaran', 
      from: 'Dari', 
      to: 'Sampai', 
      clickDetail: 'Klik bar untuk detail', 
      clickCat: 'Klik kategori untuk detail', 
      seeAll: 'Lihat Semua', 
      currentYearMonths: 'Riwayat Arus Kas Tahun Ini',
      paymentExpenseSummary: 'Metode Pembayaran — Pengeluaran',
      paymentIncomeSummary: 'Metode Pembayaran — Pemasukan',
      payMethods: { Cash: 'Cash (Tunai)', CreditCard: 'Credit Card', BankTransfer: 'Bank Transfer', EWallet: 'E-Wallet' },
      billText: 'Tagihan',
      floatingBtnText: '1 Tahun',
      fullReportTitle: 'Laporan Tahunan Lengkap (Tanpa Pemisahan)',
      fullReportSub: 'Gabungan Transaksi Operasional & Aset Selama 1 Tahun',
      totalNetSavings: 'Total Sisa Saldo Bersih',
      status: { 
        luarBiasa: 'Luar Biasa 🚀', 
        sangatBaik: 'Sangat Baik ✨', 
        hemat: 'Hemat 💡', 
        cukupHemat: 'Cukup Hemat 👍', 
        boros: 'Boros ⚠️', 
        sangatBoros: 'Sangat Boros 🚨', 
        defisit: 'Defisit ❌' 
      }
    },
    jp: {
      title: 'レポート', 
      modeOperational: '月間運用費（日常）',
      modeAsset: '資産・非運用費',
      monthly: '収入対支出', 
      expCat: '支出 — カテゴリ別', 
      incCat: '収入 — カテゴリ別', 
      savMonth: 'キャッシュフロー — 月別', 
      savYear: '残高サマリー', 
      totalExp: '総支出', 
      totalInc: '総収入', 
      noExp: '支出の記録がありません。', 
      noInc: '収入の記録がありません。', 
      income: '収入', 
      expense: '支出', 
      from: '開始', 
      to: '終了', 
      clickDetail: 'バーをクリックして詳細表示', 
      clickCat: 'カテゴリをクリックして詳細表示', 
      seeAll: 'すべて見る', 
      currentYearMonths: '今年のキャッシュフロー履歴',
      paymentExpenseSummary: '支払い方法別 — 支出',
      paymentIncomeSummary: '支払い方法別 — 収入',
      payMethods: { Cash: '現金', CreditCard: 'クレジットカード', BankTransfer: '銀行振込', EWallet: '電子マネー' },
      billText: '請求書',
      floatingBtnText: '1年間',
      fullReportTitle: '年間全取引総合レポート（無分離）',
      fullReportSub: '運用費および資産の1年間すべての統合データ',
      totalNetSavings: '年間純残高合計',
      status: { 
        luarBiasa: '素晴らしい 🚀', 
        sangatBaik: 'とても良い ✨', 
        hemat: '節約 💡', 
        cukupHemat: 'まあまあ節約 👍', 
        boros: 'やや浪費 ⚠️', 
        sangatBoros: 'かなりの浪費 🚨', 
        defisit: '赤字 ❌' 
      }
    },
    en: {
      title: 'Reports', 
      modeOperational: 'Monthly Operational',
      modeAsset: 'Asset / Non-Operational',
      monthly: 'Income vs Expense', 
      expCat: 'Expense — By category', 
      incCat: 'Income — By category', 
      savMonth: 'Cash Flow — Monthly', 
      savYear: 'Net Balance Summary', 
      totalExp: 'Total Exp', 
      totalInc: 'Total Inc', 
      noExp: 'No expenses recorded.', 
      noInc: 'No income recorded.', 
      income: 'Income', 
      expense: 'Expense', 
      from: 'From', 
      to: 'To', 
      clickDetail: 'Click bar for detail', 
      clickCat: 'Click category for detail', 
      seeAll: 'See All', 
      currentYearMonths: 'Cash Flow History This Year',
      paymentExpenseSummary: 'Payment Methods — Expense',
      paymentIncomeSummary: 'Payment Methods — Income',
      payMethods: { Cash: 'Cash', CreditCard: 'Credit Card', BankTransfer: 'Bank Transfer', EWallet: 'E-Wallet' },
      billText: 'Bill',
      floatingBtnText: '1 Year',
      fullReportTitle: 'Full 1-Year Unfiltered Report',
      fullReportSub: 'Combined Operational & Asset Data for 1 Full Year',
      totalNetSavings: 'Total Net Annual Balance',
      status: { 
        luarBiasa: 'Excellent 🚀', 
        sangatBaik: 'Very Good ✨', 
        hemat: 'Thrifty 💡', 
        cukupHemat: 'Moderate 👍', 
        boros: 'High Spending ⚠️', 
        sangatBoros: 'Critical 🚨', 
        defisit: 'Deficit ❌' 
      }
    },
    ar: {
      title: 'التقارير', 
      modeOperational: 'التشغيلي الشهري',
      modeAsset: 'الأصول / غير تشغيلي',
      monthly: 'الدخل مقابل المصروفات', 
      expCat: 'المصروفات — حسب الفئة', 
      incCat: 'الدخل — حسب الفئة', 
      savMonth: 'الحديث النقدي — شهرياً', 
      savYear: 'ملخص صافي الرصيد', 
      totalExp: 'إجمالي المصروف', 
      totalInc: 'إجمالي الدخل', 
      noExp: 'لا توجد مصروفات مسجلة.', 
      noInc: 'لا يوجد دخل مسجل.', 
      income: 'الدخل', 
      expense: 'المصروفات', 
      from: 'من', 
      to: 'إلى', 
      clickDetail: 'انقر على العمود للتفاصيل', 
      clickCat: 'انقر على الفئة للتفاصيل', 
      seeAll: 'عرض الكل', 
      currentYearMonths: 'سجل التدفق النقدي لهذا العام',
      paymentExpenseSummary: 'طرق الدفع — المصروفات',
      paymentIncomeSummary: 'طرق الدفع — الدخل',
      payMethods: { Cash: 'نقداً', CreditCard: 'بطاقة ائتمان', BankTransfer: 'تحويل بنكي', EWallet: 'محفظة إلكترونية' },
      billText: 'فاتورة',
      floatingBtnText: 'سنة واحدة',
      fullReportTitle: 'تقرير سنوي شامل (بدون فصل)',
      fullReportSub: 'دمج المعاملات التشغيلية والأصول لمدة سنة كاملة',
      totalNetSavings: 'إجمالي صافي الرصيد السنوي',
      status: { 
        luarBiasa: 'ممتاز جداً 🚀', 
        sangatBaik: 'جيد جداً ✨', 
        hemat: 'مقتصد 💡', 
        cukupHemat: 'معتدل 👍', 
        boros: 'إنفاق مرتفع ⚠️', 
        sangatBoros: 'إنفاق حرج 🚨', 
        defisit: 'عجز ❌' 
      }
    },
    cn: {
      title: '报告', 
      modeOperational: '每月运营支出',
      modeAsset: '资产 / 非运营',
      monthly: '收入与支出', 
      expCat: '支出 — 按类别', 
      incCat: '收入 — 按类别', 
      savMonth: '现金流 — 每月', 
      savYear: '净余额汇总', 
      totalExp: '总支出', 
      totalInc: '总收入', 
      noExp: '暂无支出记录。', 
      noInc: '暂无收入记录。', 
      income: '收入', 
      expense: '支出', 
      from: '从', 
      to: '至', 
      clickDetail: '点击柱状图查看详情', 
      clickCat: '点击类别查看详情', 
      seeAll: '查看所有', 
      currentYearMonths: '今年现金流历史',
      paymentExpenseSummary: '支付方式 — 支出',
      paymentIncomeSummary: '支付方式 — 收入',
      payMethods: { Cash: '现金', CreditCard: '信用卡', BankTransfer: '银行转账', EWallet: '电子钱包' },
      billText: '账单',
      floatingBtnText: '1年',
      fullReportTitle: '年度全额综合报告（无拆分）',
      fullReportSub: '包含1年内运营与资产的所有交易数据',
      totalNetSavings: '年度净余额总计',
      status: { 
        luarBiasa: '极佳 🚀', 
        sangatBaik: '很好 ✨', 
        hemat: '节约 💡', 
        cukupHemat: '适度 👍', 
        boros: '开支偏高 ⚠️', 
        sangatBoros: '严重超支 🚨', 
        defisit: '赤字 ❌' 
      }
    }
  };
  const t = tReport[language] || tReport['id'];

  const billKeys = ['listrik', 'air', 'gas', 'internet', 'electricity', 'water'];
  
  // Penerjemah Kategori Dinamis menggunakan Helper Terpusat
  const translateCategoryForList = (catVal, typeTrx) => {
    if (!catVal) return '';
    const translated = getTranslatedCategory(catVal, language);
    const expectedType = (typeTrx === 'income' || typeTrx === 'pemasukan') ? 'income' : 'expense';
    const stdKey = normalizeCategoryString(getStandardCategoryValue(catVal, expectedType));

    if (expectedType === 'expense' && billKeys.includes(stdKey)) {
      const cleanBase = translated.replace(/\s*-\s*(Bill|Tagihan|請求書|账单|فاتورة)/gi, '').trim();
      return `${cleanBase} - ${t.billText}`;
    }
    return translated;
  };

  const formatDateByLang = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const localeMap = { id: 'id-ID', jp: 'ja-JP', en: 'en-US', ar: 'ar-SA', cn: 'zh-CN' };
    const locale = localeMap[language] || 'id-ID';
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(dateObj);
  };

  const formatMonthYearByLang = (monthKey) => {
    if (!monthKey) return '';
    const [y, m] = monthKey.split('-').map(Number);
    const dateObj = new Date(y, m - 1, 1);
    const localeMap = { id: 'id-ID', jp: 'ja-JP', en: 'en-US', ar: 'ar-SA', cn: 'zh-CN' };
    const locale = localeMap[language] || 'id-ID';
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short' }).format(dateObj);
  };

  const formatYearByLang = (yearVal) => {
    if (!yearVal) return '';
    const dateObj = new Date(Number(yearVal), 0, 1);
    const localeMap = { id: 'id-ID', jp: 'ja-JP', en: 'en-US', ar: 'ar-SA', cn: 'zh-CN' };
    const locale = localeMap[language] || 'id-ID';
    return new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(dateObj);
  };

  const convertCurrency = (amount, fromCurr, toCurr) => {
    return convertCurrencyDynamic(amount, fromCurr, toCurr, liveRates);
  };

  const fetchTransactions = async () => {
    try {
      const userId = auth.currentUser?.uid || localStorage.getItem('wgen_last_uid') || "wgen_user";

      const rows = await fetchWithOfflineFallback('transactions', {
        sql: `SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC`,
        args: [userId]
      }, userId);

      const sortedRows = [...rows].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      const resultData = sortedRows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        type: row.type,
        category: row.category,
        amount: row.amount,
        currency: row.currency || mainCurrency,
        payment_method: row.payment_method,
        note: row.note,
        date: row.date,
        is_asset: row.is_asset,
        expense_nature: row.expense_nature,
        income_nature: row.income_nature
      }));

      setTransactions(resultData);
    } catch (error) {
      console.error('Gagal memuat report:', error.message);
    }
  };

  useEffect(() => {
    fetchTransactions();
    
    window.addEventListener('transaction-added', fetchTransactions);
    window.addEventListener('wgen-data-synced', fetchTransactions);

    return () => {
      window.removeEventListener('transaction-added', fetchTransactions);
      window.removeEventListener('wgen-data-synced', fetchTransactions);
    };
  }, []);

  const startHideTimer = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 1000);
  };

  useEffect(() => {
    startHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const handleInteractionStart = () => {
    setIsHovered(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  };

  const handleInteractionEnd = () => {
    startHideTimer();
  };

  const currencySymbol = getCurrencySymbolDynamic(mainCurrency);

  const isTransactionAsset = (trx) => {
    const isIncome = trx.type === 'income' || trx.type === 'pemasukan';
    
    if (isIncome && trx.income_nature) {
      return trx.income_nature === 'asset' || trx.income_nature === 'non_routine';
    }
    if (!isIncome && trx.expense_nature) {
      return trx.expense_nature === 'asset' || trx.expense_nature === 'non_routine';
    }
    if (trx.is_asset === 1) return true;

    const stdKey = normalizeCategoryString(getStandardCategoryValue(trx.category, trx.type));
    if (isIncome) {
      const allNonRoutine = Object.values(NON_ROUTINE_INCOME_CATEGORIES).flat().map(normalizeCategoryString);
      return allNonRoutine.includes(stdKey) || stdKey.includes('investasi') || stdKey.includes('investment');
    } else {
      const allNonOp = Object.values(NON_OPERATIONAL_CATEGORIES).flat().map(normalizeCategoryString);
      return allNonOp.includes(stdKey) || stdKey.includes('investasi') || stdKey.includes('investment');
    }
  };

  const handleTouchStart = (e) => {
    handleInteractionStart();
    isDraggingRef.current = true;
    setIsDragging(true);
    hasMovedRef.current = false;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    dragStartPosRef.current = {
      x: clientX - posRef.current.x,
      y: clientY - posRef.current.y
    };
  };

  const handleTouchMove = (e) => {
    if (!isDraggingRef.current) return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const newX = clientX - dragStartPosRef.current.x;
    const newY = clientY - dragStartPosRef.current.y;

    if (Math.abs(newX - posRef.current.x) > 2 || Math.abs(newY - posRef.current.y) > 2) {
      hasMovedRef.current = true;
    }

    const maxX = window.innerWidth - 70;
    const maxY = window.innerHeight - 70;
    
    const clampedX = Math.min(Math.max(10, newX), maxX);
    const clampedY = Math.min(Math.max(10, newY), maxY);
    
    posRef.current = { x: clampedX, y: clampedY };

    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      if (balloonRef.current) {
        balloonRef.current.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
      }
    });
  };

  const handleTouchEnd = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      handleInteractionEnd();
    }
  };

  const handleBalloonClick = () => {
    if (!hasMovedRef.current) {
      setShowFullYearModal(true);
    }
  };

  useEffect(() => {
    if (balloonRef.current) {
      balloonRef.current.style.transform = `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`;
    }

    const onMove = (e) => handleTouchMove(e);
    const onEnd = () => handleTouchEnd();

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const filteredTransactions = transactions.filter(trx => {
    if (!trx.date) return false;
    const pureDate = trx.date.split(' ')[0];
    if (startDate && pureDate < startDate) return false;
    if (endDate && pureDate > endDate) return false;

    const trxIsAsset = isTransactionAsset(trx);
    if (reportNature === 'asset') {
      return trxIsAsset;
    } else {
      return !trxIsAsset;
    }
  });

  let totalIncome = 0;
  let totalExpense = 0;
  const monthlyData = {};
  const expenseByCategory = {};
  const incomeByCategory = {};

  const paymentExpenseSummary = { Cash: 0, CreditCard: 0, BankTransfer: 0, EWallet: 0 };
  const paymentIncomeSummary = { Cash: 0, CreditCard: 0, BankTransfer: 0, EWallet: 0 };

  const currentYear = new Date().getFullYear();

  for (let i = 1; i <= 12; i++) {
    const mStr = String(i).padStart(2, '0');
    const key = `${currentYear}-${mStr}`;
    monthlyData[key] = { income: 0, expense: 0, rawMonth: mStr, hasTransaction: false };
  }

  filteredTransactions.forEach(trx => {
    const amount = Number(trx.amount) || 0;
    const trxCurr = trx.currency || mainCurrency;
    const converted = convertCurrency(amount, trxCurr, mainCurrency);
    const isIncome = trx.type === 'income' || trx.type === 'pemasukan';
    const pureDate = trx.date ? trx.date.split(' ')[0] : '';
    const monthKey = pureDate ? pureDate.slice(0, 7) : '';
    
    const translatedCat = translateCategoryForList(trx.category, trx.type);

    const pmRaw = String(trx.payment_method || trx.paymentMethod || '').toLowerCase();
    let pmKey = 'Cash';
    if (pmRaw.includes('credit') || pmRaw.includes('kartu kredit')) pmKey = 'CreditCard';
    else if (pmRaw.includes('bank') || pmRaw.includes('transfer')) pmKey = 'BankTransfer';
    else if (pmRaw.includes('e-wallet') || pmRaw.includes('ewallet') || pmRaw.includes('dompet')) pmKey = 'EWallet';

    if (monthKey && monthlyData[monthKey]) {
      monthlyData[monthKey].hasTransaction = true;
    }

    if (isIncome) {
      totalIncome += converted;
      if (monthKey && monthlyData[monthKey]) monthlyData[monthKey].income += converted;
      incomeByCategory[translatedCat] = (incomeByCategory[translatedCat] || 0) + converted;
      paymentIncomeSummary[pmKey] = (paymentIncomeSummary[pmKey] || 0) + converted;
    } else {
      totalExpense += converted;
      if (monthKey && monthlyData[monthKey]) monthlyData[monthKey].expense += converted;
      expenseByCategory[translatedCat] = (expenseByCategory[translatedCat] || 0) + converted;
      paymentExpenseSummary[pmKey] = (paymentExpenseSummary[pmKey] || 0) + converted;
    }
  });

  const totalSavings = totalIncome - totalExpense;

  const fullYearTransactions = transactions.filter(trx => {
    if (!trx.date) return false;
    const pureDate = trx.date.split(' ')[0];
    return pureDate.startsWith(String(currentYear));
  });

  let fullYearIncome = 0;
  let fullYearExpense = 0;
  const fullYearMonthlyData = {};
  const fullYearExpenseCat = {};
  const fullYearIncomeCat = {};

  for (let i = 1; i <= 12; i++) {
    const mStr = String(i).padStart(2, '0');
    const key = `${currentYear}-${mStr}`;
    fullYearMonthlyData[key] = { income: 0, expense: 0, rawMonth: mStr, hasTransaction: false };
  }

  fullYearTransactions.forEach(trx => {
    const amount = Number(trx.amount) || 0;
    const trxCurr = trx.currency || mainCurrency;
    const converted = convertCurrency(amount, trxCurr, mainCurrency);
    const isIncome = trx.type === 'income' || trx.type === 'pemasukan';
    const pureDate = trx.date ? trx.date.split(' ')[0] : '';
    const monthKey = pureDate ? pureDate.slice(0, 7) : '';
    const translatedCat = translateCategoryForList(trx.category, trx.type);

    if (monthKey && fullYearMonthlyData[monthKey]) {
      fullYearMonthlyData[monthKey].hasTransaction = true;
    }

    if (isIncome) {
      fullYearIncome += converted;
      if (monthKey && fullYearMonthlyData[monthKey]) fullYearMonthlyData[monthKey].income += converted;
      fullYearIncomeCat[translatedCat] = (fullYearIncomeCat[translatedCat] || 0) + converted;
    } else {
      fullYearExpense += converted;
      if (monthKey && fullYearMonthlyData[monthKey]) fullYearMonthlyData[monthKey].expense += converted;
      fullYearExpenseCat[translatedCat] = (fullYearExpenseCat[translatedCat] || 0) + converted;
    }
  });

  const fullYearSavings = fullYearIncome - fullYearExpense;
  
  const expenseColors = ['#f43f5e', '#e11d48', '#f97316', '#d97706', '#a855f7', '#ec4899', '#fb923c', '#8b5cf6'];
  const incomeColors = ['#10b981', '#059669', '#06b6d4', '#0284c7', '#14b8a6', '#3b82f6', '#10b981', '#0d9488'];

  const activeMonthsList = Object.entries(monthlyData)
    .filter(([_, data]) => data.hasTransaction)
    .reverse();

  const recentFourMonths = activeMonthsList.slice(0, 4);

  const fullYearActiveMonthsList = Object.entries(fullYearMonthlyData)
    .filter(([_, data]) => data.hasTransaction)
    .reverse();

  // MENGHITUNG STRINGS LENGKAP PADA DONUT UNTUK SKALA OTOMATIS
  const totalExpFormatted = `-${currencySymbol}${totalExpense.toLocaleString()}`;
  const totalIncFormatted = `+${currencySymbol}${totalIncome.toLocaleString()}`;

  const renderSavingsRow = ([mKey, data]) => {
    const inc = data.income;
    const exp = data.expense;
    const savings = inc - exp;
    
    const savingsPercentage = inc > 0 ? Math.round((savings / inc) * 100) : (savings > 0 ? 100 : 0);

    let statusKey = 'defisit';
    let badgeStyle = 'bg-rose-500/20 text-rose-500 border border-rose-500/30';

    if (savings <= 0 || savingsPercentage <= 0) {
      statusKey = 'defisit';
      badgeStyle = 'bg-rose-500/20 text-rose-500 border border-rose-500/30';
    } else if (savingsPercentage >= 1 && savingsPercentage <= 8) {
      statusKey = 'sangatBoros';
      badgeStyle = 'bg-orange-500/20 text-orange-500 border border-orange-500/30';
    } else if (savingsPercentage >= 9 && savingsPercentage <= 19) {
      statusKey = 'boros';
      badgeStyle = 'bg-amber-500/20 text-amber-500 border border-amber-500/30';
    } else if (savingsPercentage >= 20 && savingsPercentage <= 26) {
      statusKey = 'cukupHemat';
      badgeStyle = 'bg-cyan-500/20 text-cyan-500 border border-cyan-500/30';
    } else if (savingsPercentage >= 27 && savingsPercentage <= 35) {
      statusKey = 'hemat';
      badgeStyle = 'bg-sky-500/20 text-sky-400 border border-sky-500/30';
    } else if (savingsPercentage >= 36 && savingsPercentage <= 49) {
      statusKey = 'sangatBaik';
      badgeStyle = 'bg-teal-500/20 text-teal-400 border border-teal-500/30';
    } else if (savingsPercentage >= 50) {
      statusKey = 'luarBiasa';
      badgeStyle = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    }

    const statusText = t.status[statusKey];

    return (
      <div key={mKey} className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/60 p-3 rounded-2xl text-xs border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition">
        <span className="font-semibold text-gray-700 dark:text-gray-300 capitalize">
          {formatMonthYearByLang(mKey)}
        </span>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className={savings >= 0 ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
            {currencySymbol}{savings.toLocaleString()} <span className="text-[10px] opacity-75">({savingsPercentage}%)</span>
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeStyle}`}>
            {statusText}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto w-full pb-16 text-gray-800 dark:text-gray-200 relative">
      
      {/* BALON LAPORAN DRAGGABLE */}
      <div 
        ref={balloonRef}
        onMouseDown={handleTouchStart}
        onTouchStart={handleTouchStart}
        onMouseEnter={handleInteractionStart}
        onMouseLeave={handleInteractionEnd}
        onClick={handleBalloonClick}
        className={`fixed top-0 left-0 z-[90] cursor-grab active:cursor-grabbing select-none touch-none will-change-transform ${
          isDragging ? '' : 'transition-opacity duration-300'
        } ${
          isHovered || isDragging ? 'opacity-100 scale-100' : 'opacity-35 hover:opacity-100 scale-95'
        }`}
      >
        <div className={`flex items-center gap-1.5 px-3 py-2 rounded-full shadow-2xl bg-gradient-to-r ${currentTheme.btn} text-white font-extrabold text-xs border-2 border-white/40 dark:border-gray-800/60 backdrop-blur-md`}>
          <FileText className={`w-4 h-4 shrink-0 ${isDragging ? '' : 'animate-bounce'}`} />
          <span className="whitespace-nowrap tracking-tight">{t.floatingBtnText}</span>
        </div>
      </div>

      {/* HEADER & SWITCH MODE REPORT */}
      <div className="flex flex-col gap-3">
        <h2 className={`text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>
          {t.title}
        </h2>

        {/* SWITCH MODE LAPORAN */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
          <button
            type="button"
            onClick={() => {
              setReportNature('operational');
              setActiveExpCat(null);
              setActiveIncCat(null);
              setActiveMonth(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              reportNature === 'operational'
                ? 'bg-amber-500 text-white shadow-md'
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t.modeOperational}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setReportNature('asset');
              setActiveExpCat(null);
              setActiveIncCat(null);
              setActiveMonth(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              reportNature === 'asset'
                ? `bg-gradient-to-r ${currentTheme.btn} text-white shadow-md`
                : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <Landmark className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t.modeAsset}</span>
          </button>
        </div>
        
        {/* FILTER TANGGAL */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-2.5 rounded-2xl flex items-center justify-between gap-2 shadow-sm text-xs">
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-[10px] font-bold text-gray-400">{t.from}:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-xl border border-gray-200 dark:border-gray-700 font-semibold text-[11px] w-full focus:outline-none cursor-pointer"
            />
          </div>
          <span className="text-gray-300 dark:text-gray-700">~</span>
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-[10px] font-bold text-gray-400">{t.to}:</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-xl border border-gray-200 dark:border-gray-700 font-semibold text-[11px] w-full focus:outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* METODE PEMBAYARAN */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-3xl shadow-sm flex flex-col gap-5">
        
        {/* Sub-Section 1: Pengeluaran */}
        <div className="flex flex-col gap-2.5">
          <h3 className={`font-extrabold text-xs bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>
            {t.paymentExpenseSummary}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 p-3 rounded-2xl flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-rose-500">
                <Banknote className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 truncate">{t.payMethods.Cash}</span>
              </div>
              <span className="text-xs font-extrabold text-rose-500 truncate">
                -{currencySymbol}{paymentExpenseSummary.Cash.toLocaleString()}
              </span>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 p-3 rounded-2xl flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-rose-500">
                <CreditCard className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 truncate">{t.payMethods.CreditCard}</span>
              </div>
              <span className="text-xs font-extrabold text-rose-500 truncate">
                -{currencySymbol}{paymentExpenseSummary.CreditCard.toLocaleString()}
              </span>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 p-3 rounded-2xl flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-rose-500">
                <Building2 className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 truncate">{t.payMethods.BankTransfer}</span>
              </div>
              <span className="text-xs font-extrabold text-rose-500 truncate">
                -{currencySymbol}{paymentExpenseSummary.BankTransfer.toLocaleString()}
              </span>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 p-3 rounded-2xl flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-rose-500">
                <Wallet className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 truncate">{t.payMethods.EWallet}</span>
              </div>
              <span className="text-xs font-extrabold text-rose-500 truncate">
                -{currencySymbol}{paymentExpenseSummary.EWallet.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-800"></div>

        {/* Sub-Section 2: Pemasukan */}
        <div className="flex flex-col gap-2.5">
          <h3 className={`font-extrabold text-xs bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>
            {t.paymentIncomeSummary}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 p-3 rounded-2xl flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-emerald-500">
                <Banknote className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 truncate">{t.payMethods.Cash}</span>
              </div>
              <span className="text-xs font-extrabold text-emerald-500 truncate">
                +{currencySymbol}{paymentIncomeSummary.Cash.toLocaleString()}
              </span>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 p-3 rounded-2xl flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-emerald-500">
                <CreditCard className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 truncate">{t.payMethods.CreditCard}</span>
              </div>
              <span className="text-xs font-extrabold text-emerald-500 truncate">
                +{currencySymbol}{paymentIncomeSummary.CreditCard.toLocaleString()}
              </span>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 p-3 rounded-2xl flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-emerald-500">
                <Building2 className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 truncate">{t.payMethods.BankTransfer}</span>
              </div>
              <span className="text-xs font-extrabold text-emerald-500 truncate">
                +{currencySymbol}{paymentIncomeSummary.BankTransfer.toLocaleString()}
              </span>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 p-3 rounded-2xl flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-emerald-500">
                <Wallet className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 truncate">{t.payMethods.EWallet}</span>
              </div>
              <span className="text-xs font-extrabold text-emerald-500 truncate">
                +{currencySymbol}{paymentIncomeSummary.EWallet.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* DIAGRAM BATANG PEMASUKAN VS PENGELUARAN */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-3xl shadow-sm flex flex-col gap-4">
        <div className="flex justify-between items-center min-h-[32px]">
          <h3 className={`font-extrabold text-xs bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{t.monthly}</h3>
          
          {activeMonth ? (
            <div className="flex items-center gap-2 text-[10px] bg-gray-50 dark:bg-gray-800/80 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm animate-fadeIn">
              <span className="text-emerald-500 font-extrabold flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3"/> +{currencySymbol}{activeMonth.income.toLocaleString()}
              </span>
              <span className="text-rose-500 font-extrabold flex items-center gap-0.5">
                <TrendingDown className="w-3 h-3"/> -{currencySymbol}{activeMonth.expense.toLocaleString()}
              </span>
            </div>
          ) : (
            <span className="text-[10px] flex items-center gap-1 text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
              <Info className="w-3 h-3"/> {t.clickDetail}
            </span>
          )}
        </div>

        <div className="h-32 flex items-end justify-between gap-1.5 pt-4 px-2 border-b border-gray-200 dark:border-gray-800 pb-2">
          {Object.entries(monthlyData).map(([mKey, data]) => {
            const maxVal = Math.max(...Object.values(monthlyData).map(d => Math.max(d.income, d.expense)), 1000);
            const incHeight = Math.min(Math.round((data.income / maxVal) * 100), 100);
            const expHeight = Math.min(Math.round((data.expense / maxVal) * 100), 100);
            const isSelected = activeMonth && activeMonth.mKey === mKey;

            return (
              <div 
                key={mKey} 
                onClick={() => setActiveMonth({ mKey, income: data.income, expense: data.expense })}
                className={`flex-1 flex flex-col items-center gap-1 h-full justify-end group relative cursor-pointer rounded-t-md transition-all ${isSelected ? 'bg-gray-100 dark:bg-gray-800/80 scale-105' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
              >
                <div className="w-full flex items-end justify-center gap-[2px] h-full px-0.5">
                  <div style={{ height: `${incHeight}%` }} className="w-full max-w-[10px] bg-emerald-500 rounded-t-sm transition-all shadow-sm"></div>
                  <div style={{ height: `${expHeight}%` }} className="w-full max-w-[10px] bg-rose-500 rounded-t-sm transition-all shadow-sm"></div>
                </div>
                <span className={`text-[9px] mt-1 ${isSelected ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500'}`}>{data.rawMonth}</span>
              </div>
            );
          })}
        </div>

        <div className="flex justify-center gap-6 text-[11px] pt-1 font-medium">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span> {t.income}</div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-500 rounded-sm"></span> {t.expense}</div>
        </div>
      </div>

      {/* DONUT CHART PENGELUARAN */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-3xl shadow-sm flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className={`font-extrabold text-xs bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{t.expCat}</h3>
          {activeExpCat ? (
            <span className="text-xs bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900 shadow-sm transition-all animate-fadeIn">
              <span className="capitalize">{activeExpCat.cat}</span>: <strong className="font-extrabold">-{currencySymbol}{activeExpCat.amt.toLocaleString()}</strong>
            </span>
          ) : (
            <span className="text-[9px] flex items-center gap-1 text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
              <Info className="w-3 h-3"/> {t.clickCat}
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-center gap-6 py-2">
          <div className="relative w-36 h-36 flex items-center justify-center flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9155" className="text-gray-100 dark:text-gray-800" strokeWidth="4" stroke="currentColor" fill="none" />
              {(() => {
                let accumulated = 0;
                const total = totalExpense || 1;
                return Object.entries(expenseByCategory).map(([cat, amt], idx) => {
                  const percentage = (amt / total) * 100;
                  const dashArray = `${percentage} ${100 - percentage}`;
                  const offset = -accumulated;
                  accumulated += percentage;
                  return (
                    <circle
                      key={cat} cx="18" cy="18" r="15.9155"
                      stroke={expenseColors[idx % expenseColors.length]}
                      strokeWidth="4.5"
                      strokeDasharray={dashArray}
                      strokeDashoffset={offset}
                      fill="none"
                      className="cursor-pointer transition-all hover:opacity-80 hover:stroke-[5.5]"
                      onClick={() => setActiveExpCat({ cat, amt })}
                    />
                  );
                });
              })()}
            </svg>
            
            {/* 🟢 TEKS DINAMIS SESUAI PANJANG ANGKA NOMINAL */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
              <span className="text-[10px] text-gray-400">{t.totalExp}</span>
              <span className={`font-bold text-rose-500 tracking-tight block max-w-full truncate ${getDynamicFontSize(totalExpFormatted.length)}`}>
                {totalExpFormatted}
              </span>
            </div>
          </div>

          <div className="flex-1 w-full max-h-52 overflow-y-auto pr-1">
            {Object.keys(expenseByCategory).length === 0 ? (
              <p className="text-xs text-gray-500">{t.noExp}</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {Object.entries(expenseByCategory).map(([cat, amt], idx) => {
                  const pct = Math.round((amt / (totalExpense || 1)) * 100);
                  const isSelected = activeExpCat?.cat === cat;
                  return (
                    <button 
                      key={cat} 
                      onClick={() => setActiveExpCat({ cat, amt })} 
                      className={`w-full flex items-center justify-between text-xs py-2 px-3 rounded-xl cursor-pointer border transition-all ${
                        isSelected 
                          ? 'border-rose-400 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 font-bold shadow-sm' 
                          : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: expenseColors[idx % expenseColors.length] }}></span>
                        <span className="capitalize truncate">{cat}</span>
                      </div>
                      <span className="text-[11px] font-extrabold flex-shrink-0 opacity-80">({pct}%)</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KATEGORI PEMASUKAN */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-3xl shadow-sm flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className={`font-extrabold text-xs bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{t.incCat}</h3>
          {activeIncCat ? (
            <span className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 shadow-sm transition-all animate-fadeIn">
              <span className="capitalize">{activeIncCat.cat}</span>: <strong className="font-extrabold">+{currencySymbol}{activeIncCat.amt.toLocaleString()}</strong>
            </span>
          ) : (
            <span className="text-[10px] flex items-center gap-1 text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
              <Info className="w-3 h-3"/> {t.clickCat}
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-center gap-6 py-2">
          <div className="relative w-36 h-36 flex items-center justify-center flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9155" className="text-gray-100 dark:text-gray-800" strokeWidth="4" stroke="currentColor" fill="none" />
              {(() => {
                let accumulated = 0;
                const total = totalIncome || 1;
                return Object.entries(incomeByCategory).map(([cat, amt], idx) => {
                  const percentage = (amt / total) * 100;
                  const dashArray = `${percentage} ${100 - percentage}`;
                  const offset = -accumulated;
                  accumulated += percentage;
                  return (
                    <circle
                      key={cat} cx="18" cy="18" r="15.9155"
                      stroke={incomeColors[idx % incomeColors.length]}
                      strokeWidth="4.5"
                      strokeDasharray={dashArray}
                      strokeDashoffset={offset}
                      fill="none"
                      className="cursor-pointer transition-all hover:opacity-80 hover:stroke-[5.5]"
                      onClick={() => setActiveIncCat({ cat, amt })}
                    />
                  );
                });
              })()}
            </svg>

            {/* 🟢 TEKS DINAMIS SESUAI PANJANG ANGKA NOMINAL */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
              <span className="text-[10px] text-gray-400">{t.totalInc}</span>
              <span className={`font-bold text-emerald-500 tracking-tight block max-w-full truncate ${getDynamicFontSize(totalIncFormatted.length)}`}>
                {totalIncFormatted}
              </span>
            </div>
          </div>

          <div className="flex-1 w-full max-h-52 overflow-y-auto pr-1">
            {Object.keys(incomeByCategory).length === 0 ? (
              <p className="text-xs text-gray-500">{t.noInc}</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {Object.entries(incomeByCategory).map(([cat, amt], idx) => {
                  const pct = Math.round((amt / (totalIncome || 1)) * 100);
                  const isSelected = activeIncCat?.cat === cat;
                  return (
                    <button 
                      key={cat} 
                      onClick={() => setActiveIncCat({ cat, amt })} 
                      className={`w-full flex items-center justify-between text-xs py-2 px-3 rounded-xl cursor-pointer border transition-all ${
                        isSelected 
                          ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 font-bold shadow-sm' 
                          : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: incomeColors[idx % incomeColors.length] }}></span>
                        <span className="capitalize truncate">{cat}</span>
                      </div>
                      <span className="text-[11px] font-extrabold flex-shrink-0 opacity-80">({pct}%)</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ARUS KAS BULANAN */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-3xl shadow-sm flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className={`font-extrabold text-xs bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{t.savMonth}</h3>
          
          {activeMonthsList.length > 0 && (
            <button 
              onClick={() => setShowAllSavingsModal(true)}
              className={`text-[11px] font-bold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent hover:opacity-80 transition flex items-center gap-1 cursor-pointer`}
            >
              {t.seeAll} <ArrowRight className={`w-3.5 h-3.5 ${currentTheme.icon}`} />
            </button>
          )}
        </div>

        <div className="space-y-2 pt-1">
          {recentFourMonths.length === 0 ? (
            <p className="text-xs text-gray-500 py-2">{t.noExp}</p>
          ) : (
            recentFourMonths.map(renderSavingsRow)
          )}
        </div>
      </div>

      {/* RINGKASAN SISA SALDO */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-3xl shadow-sm flex flex-col gap-2">
        <h3 className={`font-extrabold text-xs bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{t.savYear}</h3>
        <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col gap-1 mt-1">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            {startDate && endDate 
              ? `${formatDateByLang(startDate)} ~ ${formatDateByLang(endDate)}` 
              : formatYearByLang(currentYear)}
          </span>
          
          <span className={`text-xl font-extrabold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>
            {currencySymbol}{totalSavings.toLocaleString()}
          </span>
          <span className="text-[11px] text-gray-500 pt-1">{t.income} {currencySymbol}{totalIncome.toLocaleString()} · {t.expense} {currencySymbol}{totalExpense.toLocaleString()}</span>
        </div>
      </div>

      {/* POP-UP FULL SCREEN ARUS KAS TAHUN INI */}
      {showAllSavingsModal && (
        <div className="fixed inset-0 z-[100] bg-gray-50 dark:bg-gray-950 w-full h-screen overflow-y-auto m-0 p-0">
          <div className="sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md p-3 px-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-800 z-10 shadow-sm">
            <div className="flex items-center gap-2">
              <Landmark className={`w-4 h-4 ${currentTheme.icon}`} />
              <span className={`text-xs sm:text-sm font-extrabold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>
                {t.currentYearMonths}
              </span>
            </div>
            <button 
              onClick={() => setShowAllSavingsModal(false)} 
              className="p-1.5 bg-gray-200 dark:bg-gray-800 rounded-full hover:bg-rose-100 hover:text-rose-500 text-gray-600 dark:text-gray-300 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 max-w-xl mx-auto space-y-2 mt-2 pb-12">
            {activeMonthsList.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">{t.noExp}</p>
            ) : (
              activeMonthsList.map(renderSavingsRow)
            )}
          </div>
        </div>
      )}

      {/* POP-UP LAPORAN 1 TAHUN FULL */}
      {showFullYearModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex flex-col justify-end touch-none overscroll-none">
          <div className="w-full max-w-2xl mx-auto bg-white dark:bg-gray-950 rounded-t-2xl flex flex-col overflow-hidden shadow-2xl h-[calc(100vh-3.5rem)] mt-auto text-gray-800 dark:text-gray-200 touch-auto">
            
            {/* Header Sticky */}
            <div className="sticky top-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-3.5 px-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-800 z-10 shadow-sm shrink-0">
              <div className="flex items-center gap-2">
                <FileText className={`w-5 h-5 ${currentTheme.icon}`} />
                <div className="flex flex-col">
                  <span className={`text-xs sm:text-sm font-extrabold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>
                    {t.fullReportTitle}
                  </span>
                  <span className="text-[10px] text-gray-400">{t.fullReportSub}</span>
                </div>
              </div>
              <button 
                onClick={() => setShowFullYearModal(false)} 
                className="p-1.5 bg-gray-200 dark:bg-gray-800 rounded-full hover:bg-rose-100 hover:text-rose-500 text-gray-600 dark:text-gray-300 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Content */}
            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar overscroll-contain">
              <div className="p-4 max-w-xl mx-auto space-y-6 mt-2 pb-20">
                
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-3xl shadow-sm flex flex-col gap-2">
                  <span className="text-xs font-extrabold text-gray-400">{t.totalNetSavings} ({formatYearByLang(currentYear)})</span>
                  <span className={`text-2xl sm:text-3xl font-black bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>
                    {currencySymbol}{fullYearSavings.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-4 text-xs font-bold pt-2 border-t border-gray-100 dark:border-gray-800 mt-2">
                    <span className="text-emerald-500">{t.income}: +{currencySymbol}{fullYearIncome.toLocaleString()}</span>
                    <span className="text-rose-500">{t.expense}: -{currencySymbol}{fullYearExpense.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-3xl shadow-sm flex flex-col gap-4">
                  <h3 className={`font-extrabold text-xs bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{t.monthly} ({formatYearByLang(currentYear)})</h3>
                  <div className="h-32 flex items-end justify-between gap-1.5 pt-4 px-2 border-b border-gray-200 dark:border-gray-800 pb-2">
                    {Object.entries(fullYearMonthlyData).map(([mKey, data]) => {
                      const maxVal = Math.max(...Object.values(fullYearMonthlyData).map(d => Math.max(d.income, d.expense)), 1000);
                      const incHeight = Math.min(Math.round((data.income / maxVal) * 100), 100);
                      const expHeight = Math.min(Math.round((data.expense / maxVal) * 100), 100);

                      return (
                        <div key={mKey} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                          <div className="w-full flex items-end justify-center gap-[2px] h-full px-0.5">
                            <div style={{ height: `${incHeight}%` }} className="w-full max-w-[10px] bg-emerald-500 rounded-t-sm"></div>
                            <div style={{ height: `${expHeight}%` }} className="w-full max-w-[10px] bg-rose-500 rounded-t-sm"></div>
                          </div>
                          <span className="text-[9px] mt-1 text-gray-500">{data.rawMonth}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-3xl shadow-sm flex flex-col gap-3">
                  <h3 className={`font-extrabold text-xs bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{t.expCat} ({formatYearByLang(currentYear)})</h3>
                  <div className="space-y-2">
                    {Object.keys(fullYearExpenseCat).length === 0 ? (
                      <p className="text-xs text-gray-500 py-2">{t.noExp}</p>
                    ) : (
                      Object.entries(fullYearExpenseCat).map(([cat, amt], idx) => {
                        const pct = Math.round((amt / (fullYearExpense || 1)) * 100);
                        return (
                          <div key={cat} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/60 p-2.5 px-3 rounded-2xl text-xs border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: expenseColors[idx % expenseColors.length] }}></span>
                              <span className="font-semibold capitalize text-gray-700 dark:text-gray-300">{cat}</span>
                            </div>
                            <span className="font-extrabold text-rose-500">-{currencySymbol}{amt.toLocaleString()} <span className="text-[10px] opacity-75">({pct}%)</span></span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-3xl shadow-sm flex flex-col gap-3">
                  <h3 className={`font-extrabold text-xs bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{t.incCat} ({formatYearByLang(currentYear)})</h3>
                  <div className="space-y-2">
                    {Object.keys(fullYearIncomeCat).length === 0 ? (
                      <p className="text-xs text-gray-500 py-2">{t.noInc}</p>
                    ) : (
                      Object.entries(fullYearIncomeCat).map(([cat, amt], idx) => {
                        const pct = Math.round((amt / (fullYearIncome || 1)) * 100);
                        return (
                          <div key={cat} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/60 p-2.5 px-3 rounded-2xl text-xs border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: incomeColors[idx % incomeColors.length] }}></span>
                              <span className="font-semibold capitalize text-gray-700 dark:text-gray-300">{cat}</span>
                            </div>
                            <span className="font-extrabold text-emerald-500">+{currencySymbol}{amt.toLocaleString()} <span className="text-[10px] opacity-75">({pct}%)</span></span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-3xl shadow-sm flex flex-col gap-3">
                  <h3 className={`font-extrabold text-xs bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{t.savMonth} ({formatYearByLang(currentYear)})</h3>
                  <div className="space-y-2">
                    {fullYearActiveMonthsList.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-4">{t.noExp}</p>
                    ) : (
                      fullYearActiveMonthsList.map(renderSavingsRow)
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
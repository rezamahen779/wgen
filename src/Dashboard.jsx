import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Wallet, TrendingUp, TrendingDown, Calendar, PieChart, History, 
  ArrowRight, ChevronLeft, ChevronRight, Sparkles, Plus, Trash2, 
  RotateCcw, X, Check, Activity, ShieldCheck, Edit3,
  Zap, Landmark, ChevronDown, ChevronUp, Eye, EyeOff
} from 'lucide-react';

import { initDB } from './lib/db';
import { getBudgets } from './lib/dbService';
import { auth } from './lib/firebase';
import { getThemeStyles } from './Settings';

import { 
  getCategoryIcon, 
  getStandardCategoryValue, 
  getTranslatedCategory,
  normalizeCategoryString,
  isAssetCategory
} from './categoryHelper';

import { fetchLiveExchangeRates, convertCurrencyDynamic, getCurrencySymbolDynamic } from './lib/currencyService';

// Fast parsing helper agar tidak memicu bottleneck Intl Date Time saat beda jam/zona waktu
const parsePureDate = (dateStr) => {
  if (!dateStr) return '';
  return String(dateStr).trim().split(' ')[0];
};

export default function Dashboard({ userName, mainCurrency, language, twoToneTheme, onNavigateTab }) {
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
    
  const [allDbTransactions, setAllDbTransactions] = useState([]); 
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);

  // 1. BACA CACHE KURS DARI LOCALSTORAGE SECARA INSTAN (0ms)
  const [liveRates, setLiveRates] = useState(() => {
    try {
      const cached = localStorage.getItem('wgen_cached_rates');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });

  // 2. FETCH KURS DENGAN TIMEOUT 3.5 DETIK (ANTI GANTUNG SAAT SINYAL LEMOT)
  useEffect(() => {
    if (!navigator.onLine) return;

    let isMounted = true;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Rates fetch timeout')), 3500)
    );

    Promise.race([fetchLiveExchangeRates(), timeoutPromise])
      .then((rates) => {
        if (isMounted && rates && Object.keys(rates).length > 0) {
          setLiveRates(rates);
          localStorage.setItem('wgen_cached_rates', JSON.stringify(rates));
        }
      })
      .catch(() => {
        // Diamkan saja jika timeout/offline, aplikasi tetap pakai cache localStorage
      });

    return () => { isMounted = false; };
  }, []);
    
  const [dashboardExpenseMode, setDashboardExpenseMode] = useState('operational');
  const [selectedWarrantyTrx, setSelectedWarrantyTrx] = useState(null);

  const [showBalance, setShowBalance] = useState(() => {
    const saved = localStorage.getItem('wgen_show_balance');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const toggleShowBalance = (e) => {
    e.stopPropagation();
    setShowBalance(prev => {
      const nextState = !prev;
      localStorage.setItem('wgen_show_balance', JSON.stringify(nextState));
      return nextState;
    });
  };

  const [isCalendarMinimized, setIsCalendarMinimized] = useState(false);
  const [isBudgetMinimized, setIsBudgetMinimized] = useState(false);
  const calendarTimerRef = useRef(null);
  const budgetTimerRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsCalendarMinimized(true);
      setIsBudgetMinimized(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleMouseEnterCalendar = () => {
    if (calendarTimerRef.current) clearTimeout(calendarTimerRef.current);
    setIsCalendarMinimized(false);
  };

  const handleMouseLeaveCalendar = () => {
    calendarTimerRef.current = setTimeout(() => {
      setIsCalendarMinimized(true);
    }, 2000);
  };

  const handleMouseEnterBudget = () => {
    if (budgetTimerRef.current) clearTimeout(budgetTimerRef.current);
    setIsBudgetMinimized(false);
  };

  const handleMouseLeaveBudget = () => {
    budgetTimerRef.current = setTimeout(() => {
      setIsBudgetMinimized(true);
    }, 2000);
  };

  const [ratioDate, setRatioDate] = useState(new Date());
  const [calendarDate, setCalendarDate] = useState(new Date());

  const [showGreetingModal, setShowGreetingModal] = useState(false);
  const [customGreetingsMap, setCustomGreetingsMap] = useState({});
  const [isSparkleLit, setIsSparkleLit] = useState(false);
  const [activeGreeting, setActiveGreeting] = useState('');
  const [newGreetingInput, setNewGreetingInput] = useState('');

  const clickTimeoutRef = useRef(null);
  const clickCountRef = useRef(0);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [budgetDate, setBudgetDate] = useState(new Date());
  const budgetYearStr = budgetDate.getFullYear();
  const budgetMonthStr = String(budgetDate.getMonth() + 1).padStart(2, '0');
  const formattedBudgetMonthKey = `${budgetYearStr}-${budgetMonthStr}`;

  const activeThemeId = twoToneTheme || 'emerald';
  const currentTheme = getThemeStyles(activeThemeId);

  // CACHE INTL DATE TIME FORMATTER UNTUK MENCEGAH LAG SAAT PERUBAHAN WAKTU / GMT
  const dateFormatter = useMemo(() => {
    const localeMap = { id: 'id-ID', jp: 'ja-JP', en: 'en-US', ar: 'ar-SA', cn: 'zh-CN' };
    const locale = localeMap[language] || 'id-ID';
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  }, [language]);

  const formatDateByLang = useCallback((dateStr) => {
    if (!dateStr) return '';
    const parts = String(dateStr).trim().split(' ');
    const pureDate = parts[0];
    const timePart = parts[1] ? parts[1].slice(0, 5) : '';
    const [y, m, d] = pureDate.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dateObj = new Date(y, m - 1, d);
    const formattedDateOnly = dateFormatter.format(dateObj);
    return timePart ? `${formattedDateOnly}, ${timePart}` : formattedDateOnly;
  }, [dateFormatter]);

  const formatSimpleDate = useCallback((dateStr) => {
    if (!dateStr) return '';
    const pureDate = String(dateStr).split(' ')[0];
    const [y, m, d] = pureDate.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dateObj = new Date(y, m - 1, d);
    return dateFormatter.format(dateObj);
  }, [dateFormatter]);

  const calculateWarrantyExpiry = (startDateStr, monthsCount) => {
    if (!startDateStr || !monthsCount || isNaN(monthsCount) || Number(monthsCount) <= 0) return null;
    const pureDate = parsePureDate(startDateStr);
    const [y, m, d] = pureDate.split('-').map(Number);
    if (!y || !m || !d) return null;
    const expDate = new Date(y, m - 1, d);
    expDate.setMonth(expDate.getMonth() + parseInt(monthsCount));
    return `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}-${String(expDate.getDate()).padStart(2, '0')}`;
  };

  const sym = getCurrencySymbolDynamic(mainCurrency);

  const convertCurrency = useCallback((amount, fromCurr, toCurr) => {
    return convertCurrencyDynamic(amount, fromCurr, toCurr, liveRates);
  }, [liveRates]);
    
  const normalizeType = (rawType) => {
    const t = String(rawType || '').toLowerCase();
    return (t === 'income' || t === 'pemasukan') ? 'income' : 'expense';
  };

  const getEffectiveNature = (trx) => {
    const isIncome = normalizeType(trx.type) === 'income';

    if (isIncome && trx.income_nature) {
      if (trx.income_nature === 'asset' || trx.income_nature === 'non_routine') return 'non_routine';
      if (trx.income_nature === 'routine' || trx.income_nature === 'salary') return 'routine';
      return trx.income_nature;
    }
      
    if (!isIncome && trx.expense_nature) {
      if (trx.expense_nature === 'non_routine' || trx.expense_nature === 'asset') return 'asset';
      if (trx.expense_nature === 'operational' || trx.expense_nature === 'routine') return 'operational';
      return trx.expense_nature;
    }

    const stdCatKey = getStandardCategoryValue(trx.category, isIncome ? 'income' : 'expense');
    const isAsset = isAssetCategory(stdCatKey) || isAssetCategory(trx.category);

    if (isIncome) {
      return isAsset ? 'non_routine' : 'routine';
    } else {
      return isAsset ? 'asset' : 'operational';
    }
  };

  const translateCategoryForList = (catVal) => {
    if (!catVal) return '';
    return getTranslatedCategory(catVal, language);
  };

  const renderCategoryIcon = (catVal, typeTrx = 'expense', natureTrx = 'operational') => {
    const stdCat = getStandardCategoryValue(catVal, normalizeType(typeTrx));
    const IconComponent = getCategoryIcon(stdCat || catVal, typeTrx);
    const isIncome = normalizeType(typeTrx) === 'income';
    const colorClass = isIncome ? "text-emerald-500" : "text-rose-500";
    return <IconComponent className={`w-4 h-4 flex-shrink-0 ${colorClass}`} />;
  };

  const paymentMethodsMap = {
    id: { "Cash": "Cash (Tunai)", "Credit Card": "Credit Card", "Bank Transfer": "Bank Transfer", "E-Wallet": "E-Wallet" },
    jp: { "Cash": "現金", "Credit Card": "クレジットカード", "Bank Transfer": "銀行振込", "E-Wallet": "電子マネー" },
    en: { "Cash": "Cash", "Credit Card": "Credit Card", "Bank Transfer": "Bank Transfer", "E-Wallet": "E-Wallet" },
    ar: { "Cash": "نقداً", "Credit Card": "بطاقة ائتمان", "Bank Transfer": "تحويل بنكي", "E-Wallet": "محفظة إلكترونية" },
    cn: { "Cash": "现金", "Credit Card": "信用卡", "Bank Transfer": "银行转账", "E-Wallet": "电子钱包" }
  };

  const getPaymentMethodLabel = (pmKey, lang) => {
    const pmMap = paymentMethodsMap[lang] || paymentMethodsMap['id'];
    return pmMap[pmKey] || pmKey || 'Cash';
  };

  const defaultGreetingsMap = {
    id: ['Hai, Bae kan? 😆 ', 'Hai, catat cuan dulu! 🤙', 'Mantap jiwa 🔥', 'Sanss... 🍵', 'Welcome back ✌️'],
    jp: ['久しぶりじゃん 👋🏻', 'ようこそ！戻ってきて 🍵', 'おかえり！待ってたよ 😆', 'やぁ！また会えたね 😆', 'お疲れー！ 🍵'],
    en: ['Yo, what\'s good 🚀', 'Step right in 🤙', 'Keep your head up 🤙', 'Vibes ✨'],
    ar: ['يا هلا والله 🌙', 'حيّاك يا بطل 🦅', 'أهلاً بالزين ✨', 'مراحب مليون ✌️', 'يا هلا ومسهلا ☕'],
    cn: ['你来啦！ 🚀', '你来啦！ ✌️', '你来啦！ 🔥', '你来啦！ ✨', '你来啦！ 🌟']
  };

  const activeLangKey = language || 'id';
  const defaultList = defaultGreetingsMap[activeLangKey] || defaultGreetingsMap['id'];
  const userCustomList = customGreetingsMap[activeLangKey] || [];
  const currentGreetingsList = [...defaultList, ...userCustomList];

  useEffect(() => {
    try {
      const savedCustom = localStorage.getItem('wgen_custom_greetings');
      if (savedCustom) setCustomGreetingsMap(JSON.parse(savedCustom));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const pinned = localStorage.getItem(`wgen_pinned_greeting_${activeLangKey}`);
    if (pinned && currentGreetingsList.includes(pinned)) {
      setActiveGreeting(pinned);
    } else {
      const randomDefault = currentGreetingsList[Math.floor(Math.random() * currentGreetingsList.length)] || 'Halo 🤙';
      setActiveGreeting(randomDefault);
    }
  }, [activeLangKey, customGreetingsMap]);

  const handleSelectAndPinGreeting = (greetingText) => {
    setActiveGreeting(greetingText);
    localStorage.setItem(`wgen_pinned_greeting_${activeLangKey}`, greetingText);
  };

  const handleAddCustomGreeting = () => {
    if (!newGreetingInput.trim()) return;
    const trimmed = newGreetingInput.trim();
    const updatedCustomList = [...userCustomList, trimmed];
    const updatedMap = { ...customGreetingsMap, [activeLangKey]: updatedCustomList };
      
    setCustomGreetingsMap(updatedMap);
    localStorage.setItem('wgen_custom_greetings', JSON.stringify(updatedMap));
      
    handleSelectAndPinGreeting(trimmed);
    setNewGreetingInput('');
  };

  const handleDeleteCustomGreeting = (itemToDelete) => {
    const updatedCustomList = userCustomList.filter(item => item !== itemToDelete);
    const updatedMap = { ...customGreetingsMap, [activeLangKey]: updatedCustomList };
      
    setCustomGreetingsMap(updatedMap);
    localStorage.setItem('wgen_custom_greetings', JSON.stringify(updatedMap));

    if (activeGreeting === itemToDelete) {
      const fallback = defaultList[0] || 'Halo 🤙';
      handleSelectAndPinGreeting(fallback);
    }
  };

  const handleResetPinGreeting = () => {
    localStorage.removeItem(`wgen_pinned_greeting_${activeLangKey}`);
    const randomDefault = defaultList[Math.floor(Math.random() * defaultList.length)] || 'Halo 🤙';
    setActiveGreeting(randomDefault);
  };

  const tDash = {
    id: {
      balance: 'Total Saldo', income: 'Pemasukan', expense: 'Pengeluaran', saving: 'Sisa Saldo', recent: 'Transaksi Terbaru',
      budgetTitle: 'Budget', noData: 'Belum ada transaksi tercatat di rentang tanggal ini.', noBudget: 'Belum ada budget diatur untuk bulan ini.',
      viewAll: 'Lihat Semua', from: 'Dari:', to: 'Sampai:', defaultBudget: 'Anggaran', defaultTx: 'Transaksi', billText: 'Tagihan',
      warrantyBadge: 'Garansi', warrantyDetailTitle: 'Detail Garansi', purchaseDateLabel: 'Tanggal Pembelian', warrantyDuration: 'Masa Garansi:',
      warrantyValidUntil: 'Garansi Berlaku Hingga', warrantyExpired: '⚠️ Masa Garansi Telah Habis', warrantyRemaining: '⏳ Sisa Waktu:',
      daysLeftUnit: 'Hari Lagi', editWarrantyBtn: 'Ubah di Tab Transaksi', warrantyMonthUnit: 'Bulan', catLabel: 'Kategori',
      over: 'Over Budget!', near: 'Mendekati Batas Limit!', warningActive: 'Pengeluaran Cukup Tinggi!', spent: 'Spent', remaining: 'Sisa',
      ratioTitle: 'Rasio Arus Kas Bulan Ini', calendarTitle: 'Kalender Harian', quickAdd: 'Baru', addTitle: 'Transaksi Baru',
      operationalMode: 'Operasional Bulanan', assetMode: 'Aset / Non-Operasional',
      days: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
      status: { luarBiasa: 'Luar Biasa 🚀', sangatBaik: 'Sangat Baik ✨', hemat: 'Hemat 💡', cukupHemat: 'Cukup Hemat 👍', boros: 'Boros ⚠️', sangatBoros: 'Sangat Boros 🚨', defisit: 'Defisit ❌' },
      editGreetingsTitle: 'Edit Secret Greetings', editGreetingsDesc: 'Pilih salam favorit untuk di-pin atau buat salam custom baru.',
      addGreetingBtn: 'Tambah Salam', saveGreetingsBtn: 'Gunakan Salam Ini', resetGreetingsBtn: 'Acak / Reset Pin', customInputPlaceholder: 'Ketik salam custom baru...',
      lockedDefaultTag: 'Preset (Terkunci)', customTag: 'Custom', activeTag: 'Aktif saat ini',
      months: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    },
    jp: {
      balance: '総残高', income: '収入', expense: '支出', saving: '残高サマリー', recent: '最近の取引', budgetTitle: '予算',
      noData: 'この期間の取引記録はありません。', noBudget: '今月の予算は設定されていません。', viewAll: 'すべて見る', from: '開始:', to: '終了:', billText: '請求書',
      warrantyBadge: '保証', warrantyDetailTitle: '保証詳細', purchaseDateLabel: '購入日', warrantyDuration: '保証期間:',
      warrantyValidUntil: '保証有効期限', warrantyExpired: '⚠️ 保証期間が終了しました', warrantyRemaining: '⏳ 残り時間:',
      daysLeftUnit: '日', editWarrantyBtn: '取引タブで編集', warrantyMonthUnit: 'ヶ月', catLabel: 'カテゴリー',
      defaultBudget: '予算', defaultTx: '取引', over: '予算オーバー!', near: '上限間近！', warningActive: '支出がやや高めです！', spent: '支出済', remaining: '残高',
      ratioTitle: '今月のキャッシュフロー比率', calendarTitle: 'デイリーカレンダー', quickAdd: '新規', addTitle: '新規取引',
      operationalMode: '日常の定期支出', assetMode: '貯金・資産の使用',
      days: ['日', '月', '火', '水', '木', '金', '土'],
      status: { luarBiasa: '素晴らしい 🚀', sangatBaik: 'とても良い ✨', hemat: '節約 💡', cukupHemat: 'まあまあ節約 👍', boros: 'やや浪費 ⚠️', sangatBoros: 'かなりの浪費 🚨', defisit: '赤字 ❌' },
      editGreetingsTitle: '挨拶の編集', editGreetingsDesc: '挨拶を選択するか、新しいカスタム挨拶を追加します。',
      addGreetingBtn: '挨拶を追加', saveGreetingsBtn: '適用する', resetGreetingsBtn: 'リセット', customInputPlaceholder: '新しいカスタム挨拶...',
      lockedDefaultTag: 'プリセット', customTag: 'カスタム', activeTag: '現在アクティブ',
      months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    },
    en: {
      balance: 'Total Balance', income: 'Income', expense: 'Expense', saving: 'Net Balance', recent: 'Recent Transactions',
      budgetTitle: 'Budget', noData: 'No transactions recorded in this date range.', noBudget: 'No budgets set for this month.',
      viewAll: 'View All', from: 'From:', to: 'To:', defaultBudget: 'Budget', defaultTx: 'Transaction', billText: 'Bill',
      warrantyBadge: 'Warranty', warrantyDetailTitle: 'Warranty Details', purchaseDateLabel: 'Purchase Date', warrantyDuration: 'Warranty Period:',
      warrantyValidUntil: 'Warranty Valid Until', warrantyExpired: '⚠️ Warranty Has Expired', warrantyRemaining: '⏳ Time Remaining:',
      daysLeftUnit: 'Days Left', editWarrantyBtn: 'Edit in Transactions Tab', warrantyMonthUnit: 'Mos', catLabel: 'Category',
      over: 'Over Budget!', near: 'Near Limit!', warningActive: 'Spending is Getting High!', spent: 'Spent', remaining: 'Remaining',
      ratioTitle: 'Monthly Cash Flow Ratio', calendarTitle: 'Daily Calendar', quickAdd: 'New', addTitle: 'New Transaction',
      operationalMode: 'Routine Operational', assetMode: 'Asset / Savings',
      days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      status: { luarBiasa: 'Excellent 🚀', sangatBaik: 'Very Good ✨', hemat: 'Thrifty 💡', cukupHemat: 'Moderate 👍', boros: 'High Spending ⚠️', sangatBoros: 'Critical 🚨', defisit: 'Deficit ❌' },
      editGreetingsTitle: 'Edit Secret Greetings', editGreetingsDesc: 'Pin favorite greeting or add a custom greeting.',
      addGreetingBtn: 'Add Greeting', saveGreetingsBtn: 'Use This Greeting', resetGreetingsBtn: 'Random / Reset Pin', customInputPlaceholder: 'Type new greeting...',
      lockedDefaultTag: 'Preset (Locked)', customTag: 'Custom', activeTag: 'Currently Active',
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    },
    ar: {
      balance: 'إجمالي الرصيد', income: 'الدخل', expense: 'المصروفات', saving: 'صافي الرصيد', recent: 'المعاملات الأخيرة',
      budgetTitle: 'الميزانية', noData: 'لا توجد معاملات مسجلة في هذا النطاق.', noBudget: 'لا توجد ميزانيات محددة لهذا الشهر.',
      viewAll: 'عرض الكل', from: 'من:', to: 'إلى:', defaultBudget: 'ميزانية', defaultTx: 'معاملة', billText: 'فاتورة',
      warrantyBadge: 'ضمان', warrantyDetailTitle: 'تفاصيل الضمان', purchaseDateLabel: 'تاريخ الشراء', warrantyDuration: 'مدة الضمان:',
      warrantyValidUntil: 'الضمان ساري حتى', warrantyExpired: '⚠️ انتهت فترة الضمان', warrantyRemaining: '⏳ الوقت المتبقي:',
      daysLeftUnit: 'أيام متبقية', editWarrantyBtn: 'تعديل في تبويب المعاملات', warrantyMonthUnit: 'أشهر', catLabel: 'الفئة',
      over: 'تجاوز الميزانية!', near: 'اقترب الحد!', warningActive: 'الإنفاق في ارتفاع!', spent: 'المصروف', remaining: 'المتبقي',
      ratioTitle: 'نسبة التدفق النقدي الشهري', calendarTitle: 'التقويم اليومي', quickAdd: 'جديد', addTitle: 'معاملة جديدة',
      operationalMode: 'تشغيلي روتيني', assetMode: 'أصول / مدخرات',
      days: ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
      status: { luarBiasa: 'ممتاز جداً 🚀', sangatBaik: 'جيد جداً ✨', hemat: 'مقتصد 💡', cukupHemat: 'معتدل 👍', boros: 'إنفاق مرتفع ⚠️', sangatBoros: 'إنفاق حرج 🚨', defisit: 'عجز ❌' },
      editGreetingsTitle: 'تعديل عبارات الترحيب', editGreetingsDesc: 'اختر الترحيب المفضل أو أضف عبارة جديدة.',
      addGreetingBtn: 'إضافة ترحيب', saveGreetingsBtn: 'استخدام', resetGreetingsBtn: 'إعادة ضبط', customInputPlaceholder: 'اكتب ترحيباً جديداً...',
      lockedDefaultTag: 'مسبق', customTag: 'مخصص', activeTag: 'نشط حالياً',
      months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
    },
    cn: {
      balance: '总余额', income: '收入', expense: '支出', saving: '净余额', recent: '近期交易', budgetTitle: '预算',
      noData: '此日期范围内暂无交易记录。', noBudget: '本月暂未设置预算。', viewAll: '查看全部', from: '从:', to: '到:', billText: '账单',
      warrantyBadge: '保修', warrantyDetailTitle: '保修详情', purchaseDateLabel: '购买日期', warrantyDuration: '保修期限:',
      warrantyValidUntil: '保修有效期至', warrantyExpired: '⚠️ 保修已到期', warrantyRemaining: '⏳ 剩余时间:',
      daysLeftUnit: '天', editWarrantyBtn: '在交易标签中编辑', warrantyMonthUnit: '个月', catLabel: '类别',
      defaultBudget: '预算', defaultTx: '交易', over: '超出预算！', near: '接近上限！', warningActive: '支出较高！', spent: '已支出', remaining: '剩余',
      ratioTitle: '本月现金流比例', calendarTitle: '每日日历', quickAdd: '新增', addTitle: '新增交易',
      operationalMode: '日常运营支出', assetMode: '资产 / 储蓄支出',
      days: ['日', '一', '二', '三', '四', '五', '六'],
      status: { luarBiasa: '极佳 🚀', sangatBaik: '很好 ✨', hemat: '节约 💡', cukupHemat: '适度 👍', boros: '开支偏高 ⚠️', sangatBoros: '严重超支 🚨', defisit: '赤字 ❌' },
      editGreetingsTitle: '编辑问候语', editGreetingsDesc: '选择问候语或添加新的自定义问候语。',
      addGreetingBtn: '添加问候语', saveGreetingsBtn: '应用', resetGreetingsBtn: '重置', customInputPlaceholder: '输入新的问候语...',
      lockedDefaultTag: '预设', customTag: '自定义', activeTag: '当前使用',
      months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    }
  };

  const t = tDash[language] || tDash['id'];

  const handleSparkleClick = () => {
    clickCountRef.current += 1;
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    if (clickCountRef.current === 3) {
      setShowGreetingModal(true);
      clickCountRef.current = 0;
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        if (clickCountRef.current === 1) setIsSparkleLit(prev => !prev);
        else if (clickCountRef.current === 2) {
          setIsSparkleLit(true);
          const currentIndex = currentGreetingsList.indexOf(activeGreeting);
          const nextIndex = (currentIndex + 1) % currentGreetingsList.length;
          handleSelectAndPinGreeting(currentGreetingsList[nextIndex]);
        }
        clickCountRef.current = 0;
      }, 300);
    }
  };

  const monthList = t.months;
  const displayBudgetMonthYear = language === 'jp' || language === 'cn' ? `${budgetYearStr}年 ${monthList[budgetDate.getMonth()]}` : `${monthList[budgetDate.getMonth()]} ${budgetYearStr}`;
  const handlePrevBudgetMonth = () => setBudgetDate(new Date(budgetDate.getFullYear(), budgetDate.getMonth() - 1, 1));
  const handleNextBudgetMonth = () => setBudgetDate(new Date(budgetDate.getFullYear(), budgetDate.getMonth() + 1, 1));

  const ratioYearStr = ratioDate.getFullYear();
  const ratioMonthStr = String(ratioDate.getMonth() + 1).padStart(2, '0');
  const formattedRatioMonthKey = `${ratioYearStr}-${ratioMonthStr}`;
  const displayRatioMonthYear = language === 'jp' || language === 'cn' ? `${ratioYearStr}年 ${monthList[ratioDate.getMonth()]}` : `${monthList[ratioDate.getMonth()]} ${ratioYearStr}`;
  const handlePrevRatioMonth = () => setRatioDate(new Date(ratioDate.getFullYear(), ratioDate.getMonth() - 1, 1));
  const handleNextRatioMonth = () => setRatioDate(new Date(ratioDate.getFullYear(), ratioDate.getMonth() + 1, 1));

  const calendarYearStr = calendarDate.getFullYear();
  const calendarMonthStr = String(calendarDate.getMonth() + 1).padStart(2, '0');
  const formattedCalendarMonthKey = `${calendarYearStr}-${calendarMonthStr}`;
  const displayCalendarMonthYear = language === 'jp' || language === 'cn' ? `${calendarYearStr}年 ${monthList[calendarDate.getMonth()]}` : `${monthList[calendarDate.getMonth()]} ${calendarYearStr}`;
  const handlePrevCalendarMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  const handleNextCalendarMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));

  // 3. OPTIMASI LOAD DATA LOKAL MURNI (OFFLINE-FIRST & NON-BLOCKING)
  const fetchDashboardData = useCallback(async () => {
    try {
      let userId = auth.currentUser?.uid || localStorage.getItem('wgen_last_uid');
      if (!userId) {
        const storedUser = localStorage.getItem('wgen_user') || localStorage.getItem('user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            userId = parsed.uid || parsed.id;
          } catch (e) {}
        }
      }

      if (!userId) return;

      const db = await initDB();

      // Baca transaksi & budget secara paralel langsung dari IndexedDB lokal
      const [localData, localBudgetsRaw] = await Promise.all([
        db.getAllFromIndex('transactions', 'user_id', userId).catch(() => db.getAll('transactions').catch(() => [])),
        db.getAll('budgets').catch(() => [])
      ]);

      const userOnlyLocal = (localData || []).filter(item => item && String(item.user_id) === String(userId));
      
      if (userOnlyLocal.length > 0) {
        const sortedLocal = userOnlyLocal.sort((a, b) => {
          const dateA = a.date || a.full_date || '';
          const dateB = b.date || b.full_date || '';
          return dateB.localeCompare(dateA);
        });
        setAllDbTransactions(sortedLocal);
      } else {
        setAllDbTransactions([]);
      }

      // Filter budget lokal untuk user dan bulan aktif
      const filteredLocalBudgets = (localBudgetsRaw || []).filter(
        b => b && String(b.user_id) === String(userId) && b.month === formattedBudgetMonthKey
      );
      setBudgets(filteredLocalBudgets);

      // Sinkronisasi background (hanya jika online, tidak memblokir render awal)
      if (navigator.onLine) {
        getBudgets(userId, formattedBudgetMonthKey)
          .then(freshBudgets => {
            if (freshBudgets && freshBudgets.length > 0) setBudgets(freshBudgets);
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error('🔴 Gagal membaca data lokal Dashboard:', err);
    }
  }, [formattedBudgetMonthKey]);

  useEffect(() => {
    fetchDashboardData();

    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const prevUid = localStorage.getItem('wgen_last_uid');
        localStorage.setItem('wgen_last_uid', user.uid);
        if (prevUid !== user.uid) fetchDashboardData();
      }
    });

    const handleDataChange = () => fetchDashboardData();

    window.addEventListener('transaction-added', handleDataChange);
    window.addEventListener('sync-completed', handleDataChange);

    return () => {
      unsubscribeAuth();
      window.removeEventListener('transaction-added', handleDataChange);
      window.removeEventListener('sync-completed', handleDataChange);
    };
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!allDbTransactions || allDbTransactions.length === 0) {
      setTotalIncome(0);
      setTotalExpense(0);
      setTotalBalance(0);
      setRecentTransactions([]);
      return;
    }

    const filteredDbData = allDbTransactions.filter(trx => {
      const pureTrxDate = parsePureDate(trx.date || trx.full_date || '');
      if (!pureTrxDate) return false;

      if (fromDate && pureTrxDate < fromDate) return false;
      if (toDate && pureTrxDate > toDate) return false;

      const effectiveNature = getEffectiveNature(trx);

      if (dashboardExpenseMode === 'operational') {
        return effectiveNature === 'operational' || effectiveNature === 'routine' || effectiveNature === 'salary';
      } else {
        return effectiveNature === 'asset' || effectiveNature === 'non_routine';
      }
    });

    let income = 0;
    let expense = 0;

    filteredDbData.forEach((item) => {
      const rawAmount = parseFloat(item.amount || item.nominal || item.total) || 0;
      const convertedAmt = convertCurrency(rawAmount, item.currency || mainCurrency, mainCurrency);
      if (normalizeType(item.type) === 'income') income += convertedAmt;
      else expense += convertedAmt;
    });

    setTotalIncome(income);
    setTotalExpense(expense);
    setTotalBalance(income - expense);
    setRecentTransactions(filteredDbData.slice(0, 5));
  }, [allDbTransactions, fromDate, toDate, mainCurrency, dashboardExpenseMode, convertCurrency]);

  // =========================================================================
  // OPTIMASI: HITUNG SPENT PER KATEGORI BUDGET & RASIO HANYA DALAM 1 PASS (O(N))
  // =========================================================================
  const { categorySpentMap, ratioIncomeMonth, ratioExpenseMonth } = useMemo(() => {
    const map = {};
    let incMonth = 0;
    let expMonth = 0;

    allDbTransactions.forEach((trx) => {
      if (!trx.date) return;
      const pureDate = parsePureDate(trx.date);
      if (!pureDate) return;
      const trxMonth = pureDate.slice(0, 7);

      const rawAmt = parseFloat(trx.amount || trx.nominal || trx.total) || 0;
      const convertedAmt = convertCurrency(rawAmt, trx.currency || mainCurrency, mainCurrency);
      const effectiveNature = getEffectiveNature(trx);
      const isIncome = normalizeType(trx.type) === 'income';

      // Hitung Rasio Bulanan
      if (trxMonth === formattedRatioMonthKey) {
        if (isIncome && effectiveNature !== 'asset' && effectiveNature !== 'non_routine') {
          incMonth += convertedAmt;
        } else if (!isIncome && effectiveNature === 'operational') {
          expMonth += convertedAmt;
        }
      }

      // Hitung Spent per Budget Category
      if (trxMonth === formattedBudgetMonthKey && !isIncome) {
        const isCorrectNature = dashboardExpenseMode === 'asset' 
          ? (effectiveNature === 'asset' || effectiveNature === 'non_routine')
          : effectiveNature === 'operational';

        if (isCorrectNature) {
          const stdTrxKey = normalizeCategoryString(getStandardCategoryValue(trx.category, 'expense'));
          map[stdTrxKey] = (map[stdTrxKey] || 0) + convertedAmt;
        }
      }
    });

    return { categorySpentMap: map, ratioIncomeMonth: incMonth, ratioExpenseMonth: expMonth };
  }, [allDbTransactions, formattedRatioMonthKey, formattedBudgetMonthKey, mainCurrency, dashboardExpenseMode, convertCurrency]);

  const ratioSavingsMonth = ratioIncomeMonth - ratioExpenseMonth;
  const ratioSavingsPercentage = ratioIncomeMonth > 0 ? Math.round((ratioSavingsMonth / ratioIncomeMonth) * 100) : (ratioSavingsMonth > 0 ? 100 : 0);

  let ratioStatusKey = 'defisit';
  let ratioColor = 'bg-rose-500';

  if (ratioSavingsMonth <= 0 || ratioSavingsPercentage <= 0) { ratioStatusKey = 'defisit'; ratioColor = 'bg-rose-500'; }
  else if (ratioSavingsPercentage <= 5) { ratioStatusKey = 'sangatBoros'; ratioColor = 'bg-orange-500'; }
  else if (ratioSavingsPercentage <= 15) { ratioStatusKey = 'boros'; ratioColor = 'bg-amber-500'; }
  else if (ratioSavingsPercentage <= 24) { ratioStatusKey = 'cukupHemat'; ratioColor = 'bg-cyan-500'; }
  else if (ratioSavingsPercentage <= 35) { ratioStatusKey = 'hemat'; ratioColor = 'bg-sky-500'; }
  else if (ratioSavingsPercentage <= 49) { ratioStatusKey = 'sangatBaik'; ratioColor = 'bg-teal-500'; }
  else { ratioStatusKey = 'luarBiasa'; ratioColor = `bg-gradient-to-r ${currentTheme.btn}`; }

  const ratioStatusText = t.status[ratioStatusKey];

  // OPTIMASI: LOOKUP O(1) DARI HASHMAP SPENT BUKAN LAGI LOOPING DB
  const getSpentForCategory = useCallback((catBudget) => {
    const stdBudgetKey = normalizeCategoryString(getStandardCategoryValue(catBudget, 'expense'));
    return categorySpentMap[stdBudgetKey] || 0;
  }, [categorySpentMap]);

  const filteredBudgets = budgets.filter(b => {
    const isAsset = isAssetCategory(b.category);
    return dashboardExpenseMode === 'asset' ? isAsset : !isAsset;
  });

  const cardStyles = "bg-gray-200/80 dark:bg-gray-950 border border-gray-300 dark:border-gray-900 p-5 rounded-3xl shadow-sm flex flex-col gap-3 transition-all duration-300 ease-in-out overflow-hidden";
    
  let greetingTextOnly = activeGreeting;
  let greetingEmojiOnly = '';
  const greetingParts = activeGreeting.trim().split(' ');
  if (greetingParts.length > 1) {
    const lastPart = greetingParts[greetingParts.length - 1];
    if (!/\p{L}|\p{N}/u.test(lastPart)) {
      greetingEmojiOnly = lastPart;
      greetingTextOnly = greetingParts.slice(0, -1).join(' ');
    }
  }

  const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
  const firstDayIndex = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();
  
  const transactionsByDate = useMemo(() => {
    const map = {};
    allDbTransactions.forEach(trx => {
      if (!trx.date) return;
      const pDate = parsePureDate(trx.date);
      if (pDate.startsWith(formattedCalendarMonthKey)) {
        if (!map[pDate]) map[pDate] = { hasIncome: false, hasExpense: false };
        if (normalizeType(trx.type) === 'income') map[pDate].hasIncome = true;
        else map[pDate].hasExpense = true;
      }
    });
    return map;
  }, [allDbTransactions, formattedCalendarMonthKey]);

  const handleCalendarDayClick = (dayNum) => {
    const formattedDay = String(dayNum).padStart(2, '0');
    const clickedDateStr = `${formattedCalendarMonthKey}-${formattedDay}`;
    const newDate = fromDate === clickedDateStr && toDate === clickedDateStr ? '' : clickedDateStr;
    setFromDate(newDate); 
    setToDate(newDate);
  };

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto w-full pb-10 text-gray-800 dark:text-gray-200 relative">
        
      {/* HEADER GREETING */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2 flex-wrap">
            <span className={`bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{greetingTextOnly} {userName || 'User'}!</span>
            {greetingEmojiOnly && <span className="not-italic">{greetingEmojiOnly}</span>}
          </h2>
          <button onClick={handleSparkleClick} title={t.editGreetingsTitle} className={`p-1.5 rounded-xl border-2 transition-all duration-300 flex items-center justify-center cursor-pointer select-none ${currentTheme.icon} border-current ${isSparkleLit ? 'opacity-100 shadow-sm bg-gray-100 dark:bg-gray-800' : 'opacity-40 hover:opacity-70 bg-transparent'}`}>
            <Sparkles className="w-4 h-4"/> 
          </button>
        </div>
      </div>

      {/* MODE SWITCHER (OPERASIONAL vs ASET) */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-200/90 dark:bg-gray-950 border border-gray-300 dark:border-gray-900 rounded-2xl shadow-sm">
        <button type="button" onClick={() => setDashboardExpenseMode('operational')} className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${dashboardExpenseMode === 'operational' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'}`}>
          <Zap className="w-3.5 h-3.5 shrink-0"/>
          <span className="truncate">{t.operationalMode}</span>
        </button>
        <button type="button" onClick={() => setDashboardExpenseMode('asset')} className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${dashboardExpenseMode === 'asset' ? `bg-gradient-to-r ${currentTheme.btn} text-white shadow-sm` : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'}`}>
          <Landmark className="w-3.5 h-3.5 shrink-0"/>
          <span className="truncate">{t.assetMode}</span>
        </button>
      </div>

      {/* FILTER TANGGAL */}
      <div className="flex items-center gap-2 bg-gray-200/80 dark:bg-gray-950 border border-gray-300 dark:border-gray-900 p-3 rounded-2xl shadow-sm">
        <Calendar className={`w-4 h-4 flex-shrink-0 ${currentTheme.icon}`} />
        <div className="flex items-center gap-1.5 flex-1 text-[11px]">
          <span className="opacity-70 font-medium">{t.from}</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded-xl border border-gray-300 dark:border-gray-800 font-semibold focus:outline-none flex-1 text-xs cursor-pointer" />
        </div>
        <div className="flex items-center gap-1.5 flex-1 text-[11px]">
          <span className="opacity-70 font-medium">{t.to}</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded-xl border border-gray-300 dark:border-gray-800 font-semibold focus:outline-none flex-1 text-xs cursor-pointer" />
        </div>
      </div>

      {/* KARTU SALDO UTAMA */}
      <div className={`p-5 rounded-3xl bg-gradient-to-br ${currentTheme.btn} text-white shadow-xl flex flex-col gap-2.5 relative overflow-hidden transition-all duration-300 active:scale-[0.98] cursor-pointer group`}>
        <div className="absolute inset-0 bg-black/35 dark:bg-black/55 group-hover:bg-black/20 group-active:bg-black/50 transition-colors pointer-events-none" />
        <div className="absolute -right-6 -bottom-6 opacity-20 group-hover:opacity-35 transition-opacity pointer-events-none">
          <Wallet className="w-36 h-36 text-white"/>
        </div>
          
        <button 
          type="button" 
          onClick={toggleShowBalance}
          className="absolute top-3.5 right-5 z-20 p-2 rounded-2xl bg-black/20 hover:bg-black/40 text-amber-300 transition cursor-pointer"
        >
          {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>

        <div className="flex flex-col gap-2 relative z-10 pr-10">
          {/* 1. EXPENSE */}
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] flex items-center gap-1 font-bold text-rose-400 uppercase tracking-wider">
              <TrendingDown className="w-3 h-3 shrink-0"/> {t.expense}
            </span>
            <span className="text-sm sm:text-base font-black text-rose-400 truncate">
              {showBalance ? `-${sym} ${Math.round(totalExpense).toLocaleString()}` : '••••••••'}
            </span>
          </div>

          {/* 2. INCOME */}
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] flex items-center gap-1 font-bold text-emerald-400 uppercase tracking-wider">
              <TrendingUp className="w-3 h-3 shrink-0"/> {t.income}
            </span>
            <span className="text-sm sm:text-base font-black text-emerald-400 truncate">
              {showBalance ? `+${sym} ${Math.round(totalIncome).toLocaleString()}` : '••••••••'}
            </span>
          </div>

          {/* SEPARATING LINE */}
          <div className="border-b border-white/20 my-0.5" />

          {/* 3. TOTAL BALANCE */}
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">{t.balance}</span>
            <h3 className="text-sm sm:text-xl font-black tracking-tight text-amber-300 truncate">
              {showBalance ? `${sym} ${Math.round(totalBalance).toLocaleString()}` : '••••••••'}
            </h3>
          </div>
        </div>
      </div>

      {/* KARTU RASIO ARUS KAS */}
      <div className={cardStyles}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${currentTheme.icon}`} />
            <h3 className={`text-sm font-bold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{t.ratioTitle}</h3>
          </div>
        </div>
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-2 rounded-xl shadow-sm mt-1">
          <button onClick={handlePrevRatioMonth} className="p-1 rounded-lg bg-gray-100 dark:bg-gray-800 theme-text transition hover:opacity-80 cursor-pointer"><ChevronLeft className="w-3.5 h-3.5"/></button>
          <span className="font-bold text-xs theme-text">{displayRatioMonthYear}</span>
          <button onClick={handleNextRatioMonth} className="p-1 rounded-lg bg-gray-100 dark:bg-gray-800 theme-text transition hover:opacity-80 cursor-pointer"><ChevronRight className="w-3.5 h-3.5"/></button>
        </div>
        <div className="flex flex-col gap-2.5 mt-1">
          <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-gray-100/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-800 transition-all">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-gray-900 dark:text-gray-100">{ratioStatusText}</span>
              <span className={`font-extrabold ${ratioStatusKey === 'defisit' ? 'text-rose-500' : 'bg-gradient-to-r ' + currentTheme.gradText + ' bg-clip-text text-transparent'}`}>{ratioSavingsPercentage}%</span>
            </div>
            <div className="w-full bg-gray-300 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
              <div className={`h-full ${ratioColor} transition-all duration-500`} style={{ width: `${Math.min(Math.max(ratioSavingsPercentage, 0), 100)}%` }}></div>
            </div>
              
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-[10px] sm:text-[11px] pt-1 font-medium gap-1">
              <span className="text-emerald-500 font-bold truncate">
                {t.saving}: {sym}{ratioSavingsMonth.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
              <span className="text-gray-500 dark:text-gray-400 font-bold truncate">
                {t.income}: +{sym}{ratioIncomeMonth.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KARTU KALENDER HARIAN */}
      <div 
        onMouseEnter={handleMouseEnterCalendar}
        onMouseLeave={handleMouseLeaveCalendar}
        className={cardStyles}
      >
        <div 
          className="flex justify-between items-center cursor-pointer select-none"
          onClick={() => setIsCalendarMinimized(!isCalendarMinimized)}
        >
          <div className="flex items-center gap-2">
            <Calendar className={`w-4 h-4 ${currentTheme.icon}`} />
            <h3 className={`text-sm font-bold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{t.calendarTitle}</h3>
          </div>
          <button className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            {isCalendarMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!isCalendarMinimized && (
          <div className="flex flex-col gap-3 animate-fadeIn">
            <div className="flex items-center justify-between bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-2 rounded-xl shadow-sm mt-1">
              <button onClick={handlePrevCalendarMonth} className="p-1 rounded-lg bg-gray-100 dark:bg-gray-800 theme-text transition hover:opacity-80 cursor-pointer"><ChevronLeft className="w-3.5 h-3.5"/></button>
              <span className="font-bold text-xs theme-text">{displayCalendarMonthYear}</span>
              <button onClick={handleNextCalendarMonth} className="p-1 rounded-lg bg-gray-100 dark:bg-gray-800 theme-text transition hover:opacity-80 cursor-pointer"><ChevronRight className="w-3.5 h-3.5"/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 mt-1 text-center">
              {t.days.map((dName, dIdx) => (<span key={dIdx} className="text-[10px] font-extrabold opacity-60 py-1">{dName}</span>))}
              {Array.from({ length: daysInMonth }).map((_, dayIdx) => {
                const dayNum = dayIdx + 1;
                const formattedDay = String(dayNum).padStart(2, '0');
                const currentDayStr = `${formattedCalendarMonthKey}-${formattedDay}`;
                const trxInfo = transactionsByDate[currentDayStr];
                const isSelected = fromDate === currentDayStr && toDate === currentDayStr;

                // Cek otomatis apakah tanggal ini adalah HARI INI
                const now = new Date();
                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const isToday = currentDayStr === todayStr;

                return (
                  <button
                    key={`day-${dayNum}`}
                    onClick={() => handleCalendarDayClick(dayNum)}
                    className={`h-9 rounded-xl flex flex-col items-center justify-center text-xs font-bold transition-all relative cursor-pointer border ${
                      isSelected
                        ? `bg-gradient-to-r ${currentTheme.btn} text-white border-transparent shadow-md`
                        : isToday
                          ? `bg-white dark:bg-gray-900 ${currentTheme.activeRing} ring-2 ${currentTheme.text} font-black shadow-sm`
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600'
                    }`}
                  >
                    <span>{dayNum}</span>
                    {trxInfo && (
                      <div className="absolute bottom-1 flex items-center gap-0.5">
                        {trxInfo.hasIncome && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                        {trxInfo.hasExpense && <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>}
                      </div>
                    )}
                  </button>
                );
              })}          
                </div>
          </div>
        )}
      </div>

      {/* KARTU BUDGET */}
      <div 
        onMouseEnter={handleMouseEnterBudget}
        onMouseLeave={handleMouseLeaveBudget}
        className={cardStyles}
      >
        <div className="flex justify-between items-center select-none">
          <div 
            className="flex items-center gap-2 cursor-pointer flex-1"
            onClick={() => setIsBudgetMinimized(!isBudgetMinimized)}
          >
            <PieChart className={`w-4 h-4 ${currentTheme.icon}`} />
            <h3 className={`text-sm font-bold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{t.budgetTitle}</h3>
            {isBudgetMinimized ? <ChevronDown className="w-4 h-4 text-gray-400 ml-1" /> : <ChevronUp className="w-4 h-4 text-gray-400 ml-1" />}
          </div>
          <button onClick={() => onNavigateTab('budgeting')} className={`text-xs font-extrabold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent hover:opacity-80 transition flex items-center gap-1 cursor-pointer shrink-0`}>
            {t.viewAll} <ArrowRight className={`w-3 h-3 ${currentTheme.text}`} />
          </button>
        </div>

        {!isBudgetMinimized && (
          <div className="flex flex-col gap-3 animate-fadeIn">
            <div className="flex items-center justify-between bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-2 rounded-xl shadow-sm mt-1">
              <button onClick={handlePrevBudgetMonth} className="p-1 rounded-lg bg-gray-100 dark:bg-gray-800 theme-text transition hover:opacity-80 cursor-pointer"><ChevronLeft className="w-3.5 h-3.5"/></button>
              <span className="font-bold text-xs theme-text">{displayBudgetMonthYear}</span>
              <button onClick={handleNextBudgetMonth} className="p-1 rounded-lg bg-gray-100 dark:bg-gray-800 theme-text transition hover:opacity-80 cursor-pointer"><ChevronRight className="w-3.5 h-3.5"/></button>
            </div>
            <div className="flex flex-col gap-2.5 mt-1">
              {filteredBudgets.length === 0 ? (
                <p className="text-xs text-center py-4 opacity-50">{t.noBudget}</p>
              ) : (
                filteredBudgets.slice(0, 10).map((b, idx) => {
                  const convertedLimit = convertCurrency(Number(b.amount) || 0, b.currency || mainCurrency, mainCurrency);
                  const spent = getSpentForCategory(b.category);
                  const remaining = convertedLimit - spent;
                  const percentage = Math.round((spent / (convertedLimit || 1)) * 100) || 0;
                  const isOverBudget = spent > convertedLimit;
                  const isNearLimit = percentage >= 50 && percentage <= 80 && !isOverBudget;
                  const isWarningHigh = percentage > 80 && !isOverBudget;
                  let progressColor = `bg-gradient-to-r ${currentTheme.btn}`;
                  if (isOverBudget || isWarningHigh) progressColor = 'bg-rose-500';
                  else if (isNearLimit) progressColor = 'bg-amber-400';
                  const cardBorder = isOverBudget || isWarningHigh ? 'border-rose-500/50' : isNearLimit ? 'border-amber-500/50' : 'border-gray-300 dark:border-gray-800';
                  const activeNature = dashboardExpenseMode === 'asset' ? 'asset' : 'operational';

                  return (
                    <div key={idx} className={`flex flex-col gap-2 p-3.5 rounded-2xl bg-gray-100/50 dark:bg-gray-900/50 border ${cardBorder} transition-all`}>
                      <div className="flex justify-between items-center text-xs font-bold">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="p-1.5 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center">
                            {renderCategoryIcon(b.category, 'expense', activeNature)}
                          </div>
                          <span className="capitalize text-gray-900 dark:text-gray-100">
                            {translateCategoryForList(b.category) || t.defaultBudget}
                          </span>
                          {isOverBudget && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-500 border border-rose-500/30">{t.over}</span>}
                          {isWarningHigh && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-500 border border-rose-500/30">{t.warningActive}</span>}
                          {isNearLimit && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">{t.near}</span>}
                        </div>
                      </div>

                      <div className="w-full bg-gray-300 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
                        <div className={`h-full ${progressColor} transition-all duration-500`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                      </div>

                      <div className="flex flex-col text-[10px] sm:text-[11px] pt-1 font-medium gap-1">
                        <span className="text-gray-500 dark:text-gray-400 font-bold truncate">
                          {t.remaining}: <strong className={remaining >= 0 ? `bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent font-bold` : 'text-rose-400'}>{sym}{remaining.toLocaleString()}</strong>
                        </span>
                        <span className="text-rose-400 font-bold truncate">
                          {t.spent}: -{sym}{spent.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

     {/* KARTU TRANSAKSI TERBARU */}
      <div className={cardStyles}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <History className={`w-4 h-4 ${currentTheme.icon}`} />
            <h3 className={`text-sm font-bold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{t.recent}</h3>
          </div>
          <button onClick={() => onNavigateTab('transaksi')} className={`text-xs font-extrabold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent hover:opacity-80 transition flex items-center gap-1 cursor-pointer`}>
            {t.viewAll} <ArrowRight className={`w-3 h-3 ${currentTheme.text}`} />
          </button>
        </div>
        <div className="flex flex-col gap-2.5 mt-1">
          {recentTransactions.length === 0 ? <p className="text-xs text-center py-6 opacity-50">{t.noData}</p> : (
            recentTransactions.map((tx, idx) => {
              const txConvertedAmount = convertCurrency(parseFloat(tx.amount || 0), tx.currency || mainCurrency, mainCurrency);
              const isIncome = normalizeType(tx.type) === 'income';
              const activeNature = getEffectiveNature(tx);
              const rawFullDate = String(tx.full_date || tx.date || '').trim();
              const dateOnlyPart = rawFullDate.split(' ')[0];
              const timeOnlyPart = rawFullDate.split(' ')[1]?.slice(0, 5) || '';

              return (
                <div key={idx} className="flex items-start p-3 bg-white dark:bg-gray-900/70 rounded-2xl border border-gray-200 dark:border-gray-800 gap-3 shadow-xs">
                  {/* Kotak Icon Kiri */}
                  <div className={`p-2.5 rounded-xl flex-shrink-0 mt-0.5 ${isIncome ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'}`}>
                    {renderCategoryIcon(tx.category || tx.title, tx.type, activeNature)}
                  </div>

                  {/* Detail Kanan (3 Baris Vertikal) */}
                  <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                    {/* Baris 1: Nama Kategori & Garansi */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold text-xs sm:text-sm capitalize text-gray-900 dark:text-gray-100">
                        {translateCategoryForList(tx.category || tx.title) || t.defaultTx}
                      </p>
                      {tx.has_warranty === 1 && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedWarrantyTrx(tx); }} className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20 transition cursor-pointer">
                          <ShieldCheck className="w-3 h-3"/><span>{t.warrantyBadge}</span>
                        </button>
                      )}
                    </div>

                    {/* Baris 2: Nominal */}
                    <span className={`font-extrabold text-xs sm:text-sm ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isIncome ? '+' : '-'}{sym}{txConvertedAmount.toLocaleString()}
                    </span>

                    {/* Baris 3: Tanggal • Jam • Metode Pembayaran */}
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 flex-wrap mt-0.5">
                      <span>{formatSimpleDate(dateOnlyPart)}</span>
                      {timeOnlyPart && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-0.5">⏰ {timeOnlyPart}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className={`font-bold ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {getPaymentMethodLabel(tx.payment_method || tx.paymentMethod, language)}
                      </span>
                      {tx.note && (<><span>•</span><span className="line-clamp-1">{tx.note}</span></>)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      {/* MODAL DETAIL GARANSI */}
      {selectedWarrantyTrx && (() => {
        const purchaseDate = selectedWarrantyTrx.date ? parsePureDate(selectedWarrantyTrx.date) : '-';
        const expiryDate = selectedWarrantyTrx.warranty_expiry || calculateWarrantyExpiry(purchaseDate, selectedWarrantyTrx.warranty_months);
        const today = new Date();
        const diffDays = Math.ceil((new Date(expiryDate) - today) / (1000 * 60 * 60 * 24));
        const isExpired = diffDays < 0;
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-xs w-full p-4 relative flex flex-col gap-3 shadow-2xl border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in duration-150">
              <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 text-emerald-500"><ShieldCheck className="w-5 h-5"/><h3 className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-white">{t.warrantyDetailTitle}</h3></div>
                <button onClick={() => setSelectedWarrantyTrx(null)} className="p-1 text-gray-400 hover:text-rose-500 transition cursor-pointer"><X className="w-4 h-4"/></button>
              </div>
              <div className="space-y-2 text-xs">
                <div><span className="text-gray-400 font-medium block text-[10px]">{t.catLabel}</span><p className="font-bold text-gray-800 dark:text-gray-200 capitalize">{translateCategoryForList(selectedWarrantyTrx.category)}</p></div>
                <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-200/60 dark:border-gray-700/50">
                  <div><span className="text-gray-400 font-medium block text-[10px]">{t.purchaseDateLabel}</span><p className="font-bold">{formatSimpleDate(purchaseDate)}</p></div>
                  <div><span className="text-gray-400 font-medium block text-[10px]">{t.warrantyDuration}</span><p className="font-bold">{selectedWarrantyTrx.warranty_months} {t.warrantyMonthUnit}</p></div>
                </div>
                <div className="p-2.5 rounded-xl border flex flex-col gap-1 text-center justify-center bg-emerald-500/5 border-emerald-500/20">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t.warrantyValidUntil}</span>
                  <p className="text-sm font-black text-emerald-500">{formatSimpleDate(expiryDate)}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit mx-auto mt-1 ${isExpired ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                    {isExpired ? t.warrantyExpired : `${t.warrantyRemaining} ${diffDays} ${t.daysLeftUnit}`}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => { setSelectedWarrantyTrx(null); onNavigateTab('transaksi'); }} className={`w-full py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r ${currentTheme.btn} shadow-md hover:opacity-90 transition cursor-pointer flex items-center justify-center gap-1.5`}>
                  <Edit3 className="w-3.5 h-3.5"/> {t.editWarrantyBtn}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL EDIT SECRET GREETINGS */}
      {showGreetingModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-5 relative flex flex-col gap-4 shadow-2xl border border-gray-200 dark:border-gray-800 my-auto">
            <div className="flex justify-between items-start border-b border-gray-200 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl bg-gray-100 dark:bg-gray-800 ${currentTheme.icon}`}><Sparkles className="w-5 h-5"/></div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">{t.editGreetingsTitle}</h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{t.editGreetingsDesc}</p>
                </div>
              </div>
              <button onClick={() => setShowGreetingModal(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition cursor-pointer"><X className="w-4 h-4"/></button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newGreetingInput}
                onChange={(e) => setNewGreetingInput(e.target.value)}
                placeholder={t.customInputPlaceholder}
                className="flex-1 p-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddCustomGreeting}
                disabled={!newGreetingInput.trim()}
                className={`px-3 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-1 ${newGreetingInput.trim() ? `bg-gradient-to-r ${currentTheme.btn} cursor-pointer hover:opacity-90` : 'bg-gray-300 dark:bg-gray-800 text-gray-400 cursor-not-allowed'}`}
              >
                <Plus className="w-3.5 h-3.5"/>
                <span>{t.addGreetingBtn}</span>
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-1">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">{t.lockedDefaultTag}</span>
                {defaultList.map((item, idx) => {
                  const isSelected = activeGreeting === item;
                  return (
                    <div
                      key={`def-${idx}`}
                      onClick={() => handleSelectAndPinGreeting(item)}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border transition cursor-pointer ${isSelected ? `bg-gradient-to-r ${currentTheme.btn} text-white border-transparent shadow-sm` : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 hover:border-gray-400'}`}
                    >
                      <span className="text-xs font-bold truncate">{item}</span>
                      {isSelected && <Check className="w-4 h-4 shrink-0 text-white"/>}
                    </div>
                  );
                })}
              </div>

              {userCustomList.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-200 dark:border-gray-800">
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider px-1">{t.customTag}</span>
                  {userCustomList.map((item, idx) => {
                    const isSelected = activeGreeting === item;
                    return (
                      <div
                        key={`cust-${idx}`}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border transition ${isSelected ? `bg-gradient-to-r ${currentTheme.btn} text-white border-transparent shadow-sm` : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-800 hover:border-gray-400'}`}
                      >
                        <div onClick={() => handleSelectAndPinGreeting(item)} className="flex-1 cursor-pointer truncate mr-2">
                          <span className="text-xs font-bold truncate">{item}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isSelected && <Check className="w-4 h-4 text-white"/>}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteCustomGreeting(item); }}
                            className="p-1 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition cursor-pointer"
                            title="Hapus Salam"
                          >
                            <Trash2 className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={handleResetPinGreeting}
                className="flex-1 py-2 px-3 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5"/>
                <span>{t.resetGreetingsBtn}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowGreetingModal(false)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r ${currentTheme.btn} shadow-md hover:opacity-90 transition cursor-pointer flex items-center justify-center gap-1.5`}
              >
                <Check className="w-3.5 h-3.5"/>
                <span>OK</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
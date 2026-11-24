import { useState, useEffect, useRef } from 'react';
import { 
  Trash2, Edit3, ChevronLeft, ChevronRight, Copy, ChevronDown, X,
  Zap, Landmark, Building2, Laptop, TrendingUp as TrendingUpIcon,
  Coins, Briefcase, Plane, Car, Gift, Award, CreditCard
} from 'lucide-react';

// Turso Client & Firebase Auth
import { turso } from './lib/turso';
import { auth } from './lib/firebase';

// Database Offline & Sync Helper
import { saveLocalItem, deleteLocalItem, getLocalData } from './lib/db';
import { fetchWithOfflineFallback } from './lib/dbService';

import { getThemeStyles } from './Settings';

// Import Helper Kategori Terpusat
import { 
  getCategoryIcon,
  getStandardCategoryValue, 
  getTranslatedCategory,
  CATEGORIES_BY_LANG,
  normalizeCategoryString
} from './categoryHelper';

import { fetchLiveExchangeRates, convertCurrencyDynamic, getCurrencySymbolDynamic } from './lib/currencyService';
import { showConfirm } from './lib/dialog';

// Preset Kategori Non-Operasional (Aset / Non-Operasional)
const NON_OPERATIONAL_CATEGORIES = {
  id: ['Properti', 'Elektronik', 'Saham', 'Gold', 'Bisnis', 'Traveling', 'Kendaraan', 'Bonus', 'Freelance', 'Investasi', 'Hutang', 'Hadiah'],
  jp: ['不動産', '電子機器', '株式', '金', 'ビジネス', '旅行', '乗り物', 'ボーナス', 'フリーランス', '投資', '借入', 'ギフト'],
  en: ['Property', 'Electronics', 'Stocks', 'Gold', 'Business', 'Traveling', 'Vehicle', 'Bonus', 'Freelance', 'Investment', 'Loan', 'Gift'],
  ar: ['عقارات', 'إلكترونيات', 'أسهم', 'ذهب', 'أعمال', 'سفر', 'مركبات', 'مكافأة', 'عمل حر', 'استثمار', 'قرض', 'هدية'],
  cn: ['房产', '电子产品', '股票', '黄金', '商业', '旅游', '车辆', '奖金', '自由职业', '投资', '借款', '礼物']
};

// Map Icon khusus kategori Non-Operasional
const NON_OPERATIONAL_ICONS = {
  'properti': Building2, 'property': Building2, '不動産': Building2, 'عقارات': Building2, '房产': Building2,
  'elektronik': Laptop, 'electronics': Laptop, '電子機器': Laptop, 'إلكترونيات': Laptop, '电子产品': Laptop,
  'saham': TrendingUpIcon, 'stocks': TrendingUpIcon, '株式': TrendingUpIcon, 'أسهم': TrendingUpIcon, '股票': TrendingUpIcon,
  'gold': Coins, '金': Coins, '金・ゴールド': Coins, 'ذهب': Coins, '黄金': Coins,
  'bisnis': Briefcase, 'business': Briefcase, '事業': Briefcase, 'ビジネス': Briefcase, 'أعمال': Briefcase, '商业': Briefcase,
  'traveling': Plane, '旅行': Plane, 'سفر': Plane, '旅游': Plane,
  'kendaraan': Car, 'vehicle': Car, 'vehicles': Car, '乗り物': Car, 'مركبات': Car, '车辆': Car,
  'bonus': Award, 'ボーナス': Award, 'مكافأة': Award, '奖金': Award,
  'freelance': Briefcase, 'フリーランス': Briefcase, 'عمل حر': Briefcase, '自由职业': Briefcase,
  'investasi': TrendingUpIcon, 'investment': TrendingUpIcon, '投資': TrendingUpIcon, 'استثمار': TrendingUpIcon, '投资': TrendingUpIcon,
  'hutang': CreditCard, 'loan': CreditCard, '借入': CreditCard, 'قرض': CreditCard, '借款': CreditCard,
  'hadiah': Gift, 'gift': Gift, 'ギフト': Gift, 'هدية': Gift, '礼物': Gift
};

export default function Budgeting({ mainCurrency, language, twoToneTheme }) {
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [liveRates, setLiveRates] = useState({});
        useEffect(() => {
        fetchLiveExchangeRates().then(rates => {
        if (rates) setLiveRates(rates);
      });
    }, []);

  const [currentDate, setCurrentDate] = useState(new Date());

  // TOGGLE OPERASIONAL VS TABUNGAN / ASET
  const [expenseNature, setExpenseNature] = useState('operational'); // 'operational' | 'asset'
  
  // Daftar kategori rutin & aset sesuai bahasa aktif
  const standardExpenseList = (CATEGORIES_BY_LANG[language] || CATEGORIES_BY_LANG['id'])?.expenseRoutine || [];
  const activeNonOpCategories = NON_OPERATIONAL_CATEGORIES[language] || NON_OPERATIONAL_CATEGORIES['id'];

  // Kategori aktif berdasarkan toggle
  const activeDropdownList = expenseNature === 'operational' ? standardExpenseList : activeNonOpCategories;

  const defaultCategory = activeDropdownList[0] || 'Makan dan minum';
  const [selectedCategoryKey, setSelectedCategoryKey] = useState(defaultCategory);
  const [limitAmount, setLimitAmount] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [editingBudget, setEditingBudget] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeThemeId = twoToneTheme || 'emerald';
  const currentTheme = getThemeStyles(activeThemeId);

  // Helper Format Angka dengan Pemisah Ribuan (Titik)
  const formatNumberWithSeparator = (value) => {
    if (value === undefined || value === null || value === '') return '';
    const cleanValue = String(value).replace(/\D/g, '');
    return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const tBudget = {
    id: { 
      title: 'Anggaran', empty: 'Belum ada Anggaran untuk kategori ini.', saveBtn: 'Simpan Anggaran', updateBtn: 'Perbarui Anggaran', cancelEdit: 'Batal', saving: 'Menyimpan...', copyBtn: 'Salin dari bulan lalu', spent: 'Pengeluaran', remaining: 'Sisa', confirmDel: 'Yakin ingin menghapus anggaran ini?', over: 'Anggaran Melebihi!', near: 'Mendekati Batas Limit!', warningActive: 'Pengeluaran Cukup Tinggi!', limit: 'Limit', billText: 'Tagihan',
      alertNoLimit: 'Masukkan nominal limit anggaran terlebih dahulu!', alertSuccessCopy: 'Berhasil menyalin anggaran dari bulan lalu!', alertNoPrev: 'Tidak ada data anggaran di bulan lalu.', alertFail: 'Gagal:',
      deleteAll: 'Hapus Semua', confirmDelAll: 'Yakin ingin menghapus semua anggaran bulan ini?', alertSuccessDeleteAll: 'Berhasil menghapus semua anggaran bulan ini!',
      months: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
      catLabel: 'Pilih Kategori',
      expenseNatureLabel: 'Tipe Pengeluaran',
      operationalExpense: 'Pengeluaran Rutin (Operasional)',
      operationalSub: 'Makan, tagihan, & kebutuhan harian',
      assetExpense: 'Penggunaan Tabungan / Aset (Non-Operasional)',
      assetSub: 'Beli HP, laptop, kendaraan, emas, investasi, dll.'
    },
    jp: { 
      title: '予算', empty: 'このカテゴリーの予算は設定されていません。', saveBtn: '予算を保存', updateBtn: '予算を更新', cancelEdit: 'キャンセル', saving: '保存中...', copyBtn: '先月からコピー', spent: '支出済', remaining: '残高', confirmDel: 'この予算を削除してもよろしいですか？', over: '予算オーバー!', near: '上限間近！', warningActive: '支出がやや高めです！', limit: '上限', billText: '請求書',
      alertNoLimit: '予算の上限金額を入力してください！', alertSuccessCopy: '先月の予算を正常にコピーしました！', alertNoPrev: '先月の予算データはありません。', alertFail: '失敗しました:',
      deleteAll: 'すべて削除', confirmDelAll: '今月のすべての予算を削除してもよろしいですか？', alertSuccessDeleteAll: '今月のすべての予算を正常に削除しました！',
      months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      catLabel: 'カテゴリーを選択',
      expenseNatureLabel: '支出の性質',
      operationalExpense: '日常の定期支出（運用コスト）',
      operationalSub: '食費、光熱費、日用品など',
      assetExpense: '貯金・資産の使用（非運用コスト）',
      assetSub: 'スマホ、PC、車両、金、投資など'
    },
    en: { 
      title: 'Budgets', empty: 'No budgets set for this category.', saveBtn: 'Save Budget', updateBtn: 'Update Budget', cancelEdit: 'Cancel', saving: 'Saving...', copyBtn: 'Copy from last month', spent: 'Spent', remaining: 'Remaining', confirmDel: 'Are you sure you want to delete this budget?', over: 'Over Budget!', near: 'Near Limit!', warningActive: 'Spending is Getting High!', limit: 'Limit', billText: 'Bill',
      alertNoLimit: 'Please enter a budget limit amount!', alertSuccessCopy: 'Successfully copied budgets from last month!', alertNoPrev: 'No budget data found from last month.', alertFail: 'Failed:',
      deleteAll: 'Delete All', confirmDelAll: 'Are you sure you want to delete all budgets for this month?', alertSuccessDeleteAll: 'Successfully deleted all budgets for this month!',
      months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      catLabel: 'Select Category',
      expenseNatureLabel: 'Expense Type',
      operationalExpense: 'Routine Expense (Operational)',
      operationalSub: 'Food, bills, & daily needs',
      assetExpense: 'Savings / Asset Spending (Non-Operational)',
      assetSub: 'Gadgets, laptop, vehicles, gold, investments, etc.'
    }
  };
  const t = tBudget[language] || tBudget['id'];

  const yearStr = currentDate.getFullYear();
  const monthStr = String(currentDate.getMonth() + 1).padStart(2, '0');
  const formattedMonthKey = `${yearStr}-${monthStr}`;

  const displayMonthYear = language === 'jp' || language === 'cn' 
    ? `${yearStr}年 ${t.months[currentDate.getMonth()]}` 
    : `${t.months[currentDate.getMonth()]} ${yearStr}`;

  const billKeys = ['listrik', 'air', 'gas', 'internet', 'electricity', 'water', 'tagihan listrik', 'tagihan air', 'tagihan gas', 'tagihan internet'];

  const isAssetCategory = (catKey) => {
    if (!catKey) return false;
    const clean = normalizeCategoryString(catKey);
    return Object.values(NON_OPERATIONAL_CATEGORIES)
      .flat()
      .some(cat => normalizeCategoryString(cat) === clean);
  };

  const renderCategoryIcon = (catKey) => {
    if (!catKey) return <Zap className="w-4 h-4 shrink-0 text-emerald-500" />;

    const normKey = normalizeCategoryString(catKey);

    if (NON_OPERATIONAL_ICONS[normKey]) {
      const SpecificIcon = NON_OPERATIONAL_ICONS[normKey];
      return <SpecificIcon className="w-4 h-4 shrink-0 text-sky-400" />;
    }

    if (isAssetCategory(normKey)) {
      return <Landmark className="w-4 h-4 shrink-0 text-sky-400" />;
    }

    const IconComp = getCategoryIcon(catKey, 'expense');
    return <IconComp className="w-4 h-4 shrink-0 text-emerald-500" />;
  };

  const formatCategoryWithBill = (catName) => {
    if (!catName) return '';
    const stdKey = getStandardCategoryValue(catName, 'expense');
    const cleanStd = normalizeCategoryString(stdKey);

    if (billKeys.includes(cleanStd)) {
      const cleanBase = catName.replace(/\s*-\s*(Bill|Tagihan|請求書|账单|فاتورة)/gi, '').trim();
      return `${cleanBase}\n${t.billText}`;
    }
    return catName;
  };

  const translateCategory = (rawCat) => {
    if (!rawCat) return '';
    const translatedName = getTranslatedCategory(rawCat, language);
    return formatCategoryWithBill(translatedName);
  };

  // fungsi convertCurrency:
  const convertCurrency = (amount, fromCurr, toCurr) => {
  return convertCurrencyDynamic(amount, fromCurr, toCurr, liveRates);
  };

  // 🟢 FETCH DATA DENGAN FALLBACK OFFLINE (dbService.js)
  const fetchData = async () => {
    try {
      const userId = auth.currentUser?.uid || localStorage.getItem('wgen_last_uid') || "wgen_user";

      // 1. Fetch Budgets dari Turso DB / IndexedDB Fallback
      const budgetRows = await fetchWithOfflineFallback('budgets', {
        sql: `SELECT * FROM budgets WHERE user_id = ? AND month = ?`,
        args: [userId, formattedMonthKey]
      }, userId);

      // Filter khusus bulan aktif untuk tampilan lokal jika fallback
      const budgetData = budgetRows
        .filter(row => row.month === formattedMonthKey)
        .map(row => ({
          id: row.id,
          user_id: row.user_id,
          category: row.category,
          amount: row.amount,
          currency: row.currency || mainCurrency,
          month: row.month
        }));

      setBudgets(budgetData);

      // 2. Fetch Transactions dari Turso DB / IndexedDB Fallback
      const trxRows = await fetchWithOfflineFallback('transactions', {
        sql: `SELECT id, type, category, amount, currency, date FROM transactions WHERE user_id = ?`,
        args: [userId]
      }, userId);

      const trxData = trxRows.map(row => ({
        id: row.id,
        type: row.type,
        category: row.category,
        amount: row.amount,
        currency: row.currency || mainCurrency,
        date: row.date
      }));
      setTransactions(trxData);

    } catch (err) {
      console.error('Gagal memuat budgeting:', err.message);
    }
  };

  useEffect(() => {
    fetchData();

    const handleTransactionAdded = () => fetchData();
    const handleDataSynced = () => fetchData();

    window.addEventListener('transaction-added', handleTransactionAdded);
    window.addEventListener('wgen-data-synced', handleDataSynced);

    return () => {
      window.removeEventListener('transaction-added', handleTransactionAdded);
      window.removeEventListener('wgen-data-synced', handleDataSynced);
    };
  }, [formattedMonthKey]);

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const resetForm = () => {
    setLimitAmount('');
    setEditingBudget(null);
    setSelectedCategoryKey(expenseNature === 'asset' ? activeNonOpCategories[0] : standardExpenseList[0]);
  };

  // 🟢 SIMPAN/UPDATE BUDGET DENGAN SYNC QUEUE OFFLINE
  const handleSaveBudget = async (e) => {
    e.preventDefault();
    if (!limitAmount) {
      alert(t.alertNoLimit);
      return;
    }

    setLoading(true);
    const userId = auth.currentUser?.uid || localStorage.getItem('wgen_last_uid') || "wgen_user";
    const isOnline = navigator.onLine;

    try {
      const nowIso = new Date().toISOString();
      const stdCategory = getStandardCategoryValue(selectedCategoryKey, 'expense');
      const targetId = editingBudget ? editingBudget.id : crypto.randomUUID();
      let isSyncedToTurso = false;

      // 1. Eksekusi Cloud jika Online
      if (isOnline) {
        try {
          if (editingBudget) {
            await turso.execute({
              sql: `UPDATE budgets SET category = ?, amount = ?, currency = ?, updated_at = ? WHERE id = ?`,
              args: [stdCategory, parseFloat(limitAmount), mainCurrency, nowIso, targetId]
            });
          } else {
            await turso.execute({
              sql: `INSERT INTO budgets (id, user_id, category, amount, currency, month, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [targetId, userId, stdCategory, parseFloat(limitAmount), mainCurrency, formattedMonthKey, nowIso, nowIso]
            });
          }
          isSyncedToTurso = true;
        } catch (err) {
          console.warn('📱 Turso Cloud Gagal/Offline. Menyiapkan simpan lokal...', err.message);
        }
      }

      // 2. Simpan ke Store IndexedDB & Antrean Sync
      const budgetObj = {
        id: targetId,
        user_id: userId,
        category: stdCategory,
        amount: parseFloat(limitAmount),
        currency: mainCurrency,
        month: formattedMonthKey,
        created_at: editingBudget ? (editingBudget.created_at || nowIso) : nowIso,
        updated_at: nowIso
      };

      await saveLocalItem('budgets', budgetObj, editingBudget ? 'UPDATE' : 'INSERT', isSyncedToTurso);

      resetForm();
      fetchData();
    } catch (error) {
      alert(`${t.alertFail} ` + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (b) => {
    setEditingBudget(b);
    const stdCat = getStandardCategoryValue(b.category, 'expense');
    
    if (isAssetCategory(stdCat)) {
      setExpenseNature('asset');
    } else {
      setExpenseNature('operational');
    }
    
    setSelectedCategoryKey(stdCat);
    setLimitAmount(b.amount);
  };

  // 🟢 HAPUS 1 BUDGET DENGAN OFFLINE FALLBACK
  const handleDeleteBudget = async (id) => {
    if (!(await showConfirm(t.confirmDel))) return;
    const isOnline = navigator.onLine;

    try {
      if (isOnline) {
        try {
          await turso.execute({
            sql: `DELETE FROM budgets WHERE id = ?`,
            args: [id]
          });
        } catch (err) {
          console.warn('📱 Turso Gagal saat Hapus Budget:', err.message);
        }
      }

      await deleteLocalItem('budgets', id, isOnline);

      if (editingBudget && editingBudget.id === id) {
        resetForm();
      }
      fetchData();
    } catch (error) {
      alert(`${t.alertFail} ` + error.message);
    }
  };

  // 🟢 HAPUS SEMUA BUDGET DENGAN OFFLINE FALLBACK
  const handleDeleteAllBudgets = async () => {
    if (budgets.length === 0) return;
    if (!(await showConfirm(t.confirmDelAll))) return;
    const userId = auth.currentUser?.uid || localStorage.getItem('wgen_last_uid') || "wgen_user";
    const isOnline = navigator.onLine;

    try {
      if (isOnline) {
        try {
          await turso.execute({
            sql: `DELETE FROM budgets WHERE user_id = ? AND month = ?`,
            args: [userId, formattedMonthKey]
          });
        } catch (err) {
          console.warn('📱 Turso Gagal Delete All:', err.message);
        }
      }

      // Hapus dari IndexedDB lokal
      for (const b of budgets) {
        await deleteLocalItem('budgets', b.id, isOnline);
      }

      alert(t.alertSuccessDeleteAll);
      resetForm();
      fetchData();
    } catch (error) {
      alert(`${t.alertFail} ` + error.message);
    }
  };

  // 🟢 SALIN BUDGET BULAN LALU DENGAN FALLBACK OFFLINE
  const handleCopyFromLastMonth = async () => {
    const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const userId = auth.currentUser?.uid || localStorage.getItem('wgen_last_uid') || "wgen_user";
    const isOnline = navigator.onLine;

    try {
      // Ambil data bulan lalu dari IndexedDB/Cloud
      const allLocalBudgets = await getLocalData('budgets', userId);
      const prevRows = allLocalBudgets.filter(b => b.month === prevKey);

      if (prevRows.length === 0) return alert(t.alertNoPrev);

      const nowIso = new Date().toISOString();

      for (const b of prevRows) {
        const newId = crypto.randomUUID();
        let isSynced = false;

        if (isOnline) {
          try {
            await turso.execute({
              sql: `INSERT INTO budgets (id, user_id, category, amount, currency, month, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [newId, userId, b.category, b.amount, b.currency, formattedMonthKey, nowIso, nowIso]
            });
            isSynced = true;
          } catch (e) {
            console.warn('📱 Turso Gagal salin:', e.message);
          }
        }

        const newObj = {
          id: newId,
          user_id: userId,
          category: b.category,
          amount: b.amount,
          currency: b.currency,
          month: formattedMonthKey,
          created_at: nowIso,
          updated_at: nowIso
        };

        await saveLocalItem('budgets', newObj, 'INSERT', isSynced);
      }

      alert(t.alertSuccessCopy);
      fetchData();
    } catch (err) {
      alert(`${t.alertFail} ` + err.message);
    }
  };

  const getSpentForCategory = (catBudget) => {
    let total = 0;
    const targetKey = getStandardCategoryValue(catBudget, 'expense');

    transactions.forEach(trx => {
      if (!trx.date) return;
      const trxMonth = String(trx.date).substring(0, 7);
      const rawType = String(trx.type || '').toLowerCase();
      const isIncome = (rawType === 'income' || rawType === 'pemasukan');

      if (trxMonth === formattedMonthKey && !isIncome) {
        const trxKey = getStandardCategoryValue(trx.category, 'expense');
        if (normalizeCategoryString(trxKey) === normalizeCategoryString(targetKey)) {
          const trxCurr = trx.currency || mainCurrency;
          total += convertCurrency(Number(trx.amount), trxCurr, mainCurrency);
        }
      }
    });
    return total;
  };

  const currencySymbol = getCurrencySymbolDynamic(mainCurrency);

  const selectedLabelTranslation = translateCategory(selectedCategoryKey);

  const filteredBudgets = budgets.filter(b => {
    const isAsset = isAssetCategory(b.category);
    return expenseNature === 'asset' ? isAsset : !isAsset;
  });

  return (
    <div className="flex flex-col gap-5 max-w-md mx-auto w-full pb-10 text-gray-800 dark:text-gray-200">
      
      {/* Header & Navigasi Bulan */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-extrabold tracking-tight">
          <span className={`bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>
            {t.title}
          </span>
        </h2>
        
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3 py-2 rounded-2xl shadow-sm">
          <button onClick={handlePrevMonth} className="p-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition hover:opacity-80 cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-sm text-gray-900 dark:text-white">{displayMonthYear}</span>
          <button onClick={handleNextMonth} className="p-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition hover:opacity-80 cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Form Input Budgeting */}
      <form onSubmit={handleSaveBudget} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3.5 rounded-2xl shadow-sm flex flex-col gap-2.5">
        
        {/* TOGGLE SIFAT PENGELUARAN */}
        <div className="flex flex-col gap-1.5 p-2 bg-gray-100/90 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700">
          <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{t.expenseNatureLabel}</label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setExpenseNature('operational');
                setSelectedCategoryKey(standardExpenseList[0] || 'Makan dan minum');
              }}
              className={`p-1.5 rounded-lg border text-[10px] font-bold transition flex flex-col items-start gap-0.5 text-left cursor-pointer ${
                expenseNature === 'operational'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              <div className="flex items-center gap-1 font-extrabold">
                <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                <span>{t.operationalExpense}</span>
              </div>
              <span className="text-[8.5px] font-medium opacity-80 line-clamp-1">{t.operationalSub}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setExpenseNature('asset');
                setSelectedCategoryKey(activeNonOpCategories[0] || 'Properti');
              }}
              className={`p-1.5 rounded-lg border text-[10px] font-bold transition flex flex-col items-start gap-0.5 text-left cursor-pointer ${
                expenseNature === 'asset'
                  ? `bg-gradient-to-r ${currentTheme.btn} text-white border-transparent shadow-xs`
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              <div className="flex items-center gap-1 font-extrabold">
                <Landmark className="w-3 h-3 text-sky-300 shrink-0" />
                <span>{t.assetExpense}</span>
              </div>
              <span className="text-[8.5px] font-medium opacity-80 line-clamp-1">{t.assetSub}</span>
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full py-2.5 px-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold focus:outline-none cursor-pointer flex items-center justify-between text-left text-gray-900 dark:text-white shadow-sm"
            >
              <div className="flex items-center gap-2 truncate">
                {renderCategoryIcon(selectedCategoryKey)}
                <span className="truncate">{selectedLabelTranslation}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 left-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 p-2 max-h-56 overflow-y-auto">
                <div className="pb-1.5 mb-1.5 border-b border-gray-100 dark:border-gray-800 px-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.catLabel}</span>
                </div>
                <div className="space-y-1">
                  {activeDropdownList.map((catKey) => {
                    const labelText = translateCategory(catKey);
                    const isSelected = selectedCategoryKey.toLowerCase() === catKey.toLowerCase();
                    return (
                      <div
                        key={catKey}
                        onClick={() => {
                          setSelectedCategoryKey(catKey);
                          setIsDropdownOpen(false);
                        }}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition capitalize ${
                          isSelected 
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {renderCategoryIcon(catKey)}
                        <span className="truncate">{labelText}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="w-32 flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 px-2.5">
            <span className="text-[10px] text-gray-400 mr-1">{t.limit}</span>
            <input
              type="text"
              inputMode="numeric"
              value={formatNumberWithSeparator(limitAmount)}
              onChange={(e) => {
                const rawValue = e.target.value.replace(/\D/g, '');
                setLimitAmount(rawValue);
              }}
              placeholder="0"
              className="w-full bg-transparent text-xs font-bold focus:outline-none py-1.5 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={loading} className={`flex-1 bg-gradient-to-r ${currentTheme.btn} text-white font-extrabold py-2 rounded-xl text-xs transition shadow-md cursor-pointer`}>
            {loading ? t.saving : `${editingBudget ? t.updateBtn : t.saveBtn} (${mainCurrency})`}
          </button>
          
          {editingBudget && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-xl text-xs flex items-center justify-center hover:opacity-80 transition cursor-pointer"
              title={t.cancelEdit}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action Bar (Copy & Delete All) */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleCopyFromLastMonth} className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 py-2 rounded-xl text-[11px] font-bold transition hover:opacity-80 cursor-pointer">
            <Copy className="w-3.5 h-3.5" /> {t.copyBtn}
          </button>

          <button
            type="button"
            onClick={handleDeleteAllBudgets}
            disabled={budgets.length === 0}
            title={t.deleteAll}
            className={`p-2 rounded-xl transition border flex items-center justify-center ${
              budgets.length > 0 
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-500 border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 cursor-pointer' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* DAFTAR KARTU ANGGARAN */}
      <div className="flex flex-col gap-3">
        {filteredBudgets.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl text-center text-gray-500 dark:text-gray-400 text-xs">
            {t.empty}
          </div>
        ) : (
          filteredBudgets.map((b) => {
            const convertedLimit = convertCurrency(Number(b.amount) || 0, b.currency || mainCurrency, mainCurrency);
            const spent = getSpentForCategory(b.category);
            const remaining = convertedLimit - spent;
            const percentage = Math.round((spent / convertedLimit) * 100) || 0;

            const isOverBudget = spent > convertedLimit;
            const isNearLimit = percentage >= 50 && percentage <= 80 && !isOverBudget;
            const isWarningHigh = percentage > 80 && !isOverBudget;
            
            let progressColor = `bg-gradient-to-r ${currentTheme.btn}`; 
            if (isOverBudget || isWarningHigh) {
              progressColor = 'bg-rose-500';
            } else if (isNearLimit) {
              progressColor = 'bg-amber-400';
            }

            const cardBorder = isOverBudget || isWarningHigh ? 'border-rose-500/50' : isNearLimit ? 'border-amber-500/50' : 'border-gray-200 dark:border-gray-800';

            return (
              <div key={b.id} className={`bg-white dark:bg-gray-900 border p-4 rounded-2xl shadow-sm flex flex-col gap-2.5 transition-all ${cardBorder}`}>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center flex-shrink-0">
                      {renderCategoryIcon(b.category)}
                    </div>
                    <h3 className="font-bold text-sm capitalize text-gray-900 dark:text-white">
                      {translateCategory(b.category)}
                    </h3>
                    {isOverBudget && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-500 border border-rose-500/30">{t.over}</span>}
                    {isWarningHigh && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-500 border border-rose-500/30">{t.warningActive}</span>}
                    {isNearLimit && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">{t.near}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEditClick(b)} className="text-gray-400 hover:text-emerald-500 transition p-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 cursor-pointer" title="Edit Budget">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteBudget(b.id)} className="text-gray-400 hover:text-rose-500 transition p-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 cursor-pointer" title="Delete Budget">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* PROGRESS BAR */}
<div className="w-full bg-gray-200 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
  <div 
    className={`${progressColor} h-full rounded-full transition-all duration-500`} 
    style={{ width: `${Math.min(percentage, 100)}%` }}
  ></div>
</div>

{/* TAMPILAN ATAS BAWAH (VERTICAL) */}
<div className="flex flex-col text-[10px] sm:text-[11px] pt-1 font-medium gap-1">
  <span className="text-gray-500 dark:text-gray-400 font-bold truncate">
    {t.remaining}:{' '}
    <strong className={remaining < 0 ? 'text-rose-500 font-bold' : `bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent font-bold`}>
      {currencySymbol}{remaining.toLocaleString()}
    </strong>{' '}
    / {currencySymbol}{convertedLimit.toLocaleString()}
  </span>
  <span className="text-rose-500 font-bold truncate">
    {t.spent}: -{currencySymbol}{spent.toLocaleString()}
  </span>
</div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
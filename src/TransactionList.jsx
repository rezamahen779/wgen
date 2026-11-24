import { useEffect, useState, useRef, useMemo } from 'react';
import { 
  ArrowDownRight, ArrowUpRight, Trash2, Edit3, ReceiptText, FileText, 
  FileSpreadsheet, Download, X, Filter, Camera, Image as ImageIcon, 
  AlertTriangle, ArrowRight, Lock, FileDown, CheckSquare, Square, ChevronDown, 
  Search, Copy, Calendar, ShieldCheck, Zap, Landmark, Building2, Laptop, 
  TrendingUp as TrendingUpIcon, Coins, Briefcase, Plane, Car, Gift, Award, CreditCard, Banknote, Info
} from 'lucide-react';

// Import Capacitor Filesystem untuk fitur Download
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

// Turso Client & Firebase Auth
import { turso } from './lib/turso';
import { auth } from './lib/firebase';
// Database Offline & Sync Helper
import { initDB, addToSyncQueue } from './lib/db';
import { processSyncQueue } from './services/syncEngine';

import { getThemeStyles } from './Settings';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType } from 'docx';

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

// Map Icon khusus kategori Non-Operasional / Non-Rutin
const NON_OPERATIONAL_ICONS = {
  'properti': Building2, 'property': Building2, '不動産': Building2, 'عقارات': Building2, '房产': Building2,
  'elektronik': Laptop, 'electronics': Laptop, '電子機器': Laptop, 'إلكترونيات': Laptop, '电子产品': Laptop,
  'saham': TrendingUpIcon, 'stocks': TrendingUpIcon, '株式': TrendingUpIcon, 'أسهم': TrendingUpIcon, '股票': TrendingUpIcon,
  'gold': Coins, '金': Coins, 'ذهب': Coins, '黄金': Coins,
  'bisnis': Briefcase, 'business': Briefcase, '事業': Briefcase, 'أعمال': Briefcase, '商业': Briefcase,
  'traveling': Plane, '旅行': Plane, 'سفر': Plane, '旅游': Plane,
  'kendaraan': Car, 'vehicle': Car, 'vehicles': Car, '乗り物': Car, 'مركبات': Car, '车辆': Car,
  'bonus': Award, 'ボーナス': Award, 'مكافأة': Award, '奖金': Award,
  'freelance': Briefcase, 'フリーランス': Briefcase, 'عمل حر': Briefcase, '自由职业': Briefcase,
  'investasi': TrendingUpIcon,"investment": TrendingUpIcon ,'投資': TrendingUpIcon, 'استثمار': TrendingUpIcon, '投资': TrendingUpIcon,
  'hutang': CreditCard, '借入': CreditCard, 'قرض': CreditCard, '借款': CreditCard,
  'hadiah': Gift, 'ギフト': Gift, 'هدية': Gift, '礼物': Gift
};

// Helper Icon dengan dukungan kamus Non-Operasional / Non-Rutin
const getDynamicCategoryIcon = (catName, trxType) => {
  const normKey = normalizeCategoryString(catName);
  if (NON_OPERATIONAL_ICONS[normKey]) {
    return NON_OPERATIONAL_ICONS[normKey];
  }
  return getCategoryIcon(catName, trxType);
};

export default function TransactionList({ allowEdit, mainCurrency, language, twoToneTheme }) {
  const [transactions, setTransactions] = useState([]);
  const [editingTrx, setEditingTrx] = useState(null);
  const [liveRates, setLiveRates] = useState({});
  
  useEffect(() => {
    fetchLiveExchangeRates().then(rates => {
      if (rates) setLiveRates(rates);
    });
  }, []);
  
  const [showSeeAllModal, setShowSeeAllModal] = useState(false);
  const [isRecentMinimized, setIsRecentMinimized] = useState(false);

  const [showToastWarning, setShowToastWarning] = useState(false);
  const [showExportLockedToast, setShowExportLockedToast] = useState(false);
  const [show96ToastSuggestion, setShow96ToastSuggestion] = useState(false);
 
  // State untuk mengontrol Pop-up Opsi Penghapusan
  const [showDeleteChoiceModal, setShowDeleteChoiceModal] = useState(false);
  // State untuk mengunci UI dalam Mode Filter Hapus
  const [isFilterDeleteLocked, setIsFilterDeleteLocked] = useState(false);

  // State Pop-Up Detail Garansi (Interaktif)
  const [selectedWarrantyTrx, setSelectedWarrantyTrx] = useState(null);

  // State untuk Quick Clone Modal
  const [cloningTrx, setCloningTrx] = useState(null);
  const [cloneTargetDate, setCloneTargetDate] = useState('');

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState([]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const activeThemeId = twoToneTheme || 'emerald';
  const currentTheme = getThemeStyles(activeThemeId);
  const editFileInputRef = useRef(null);
  const categoryDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  
  // FUNGSI UTAMA DOWNLOAD FILE (Hybrid Capacitor & Web)
const downloadFileBlob = async (blob, filename) => {
  try {
    if (Capacitor.isNativePlatform()) {
      // 1. Konversi Blob ke Pure Base64 (tanpa prefix data:...;base64,)
      const base64data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          const pureBase64 = typeof result === 'string' && result.includes(',')
            ? result.split(',')[1]
            : result;
          resolve(pureBase64);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(blob);
      });

      // 2. Simpan langsung ke folder internal: Download/WGen Note/
      await Filesystem.writeFile({
        path: `Download/WGen Note/${filename}`,
        data: base64data,
        directory: Directory.ExternalStorage,
        recursive: true, // Otomatis bikin folder "WGen Note" kalau belum ada
      });
    } else {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  } catch (error) {
    console.error('Error pada downloadFileBlob:', error);
    alert(`Detail Error: ${error.message || JSON.stringify(error)}`);
    throw error;
  }
};

  // 1. Helper untuk menghitung tanggal bulan depan (+1 bulan)
  const getNextMonthDate = (dateStr) => {
    const baseDate = dateStr ? dateStr.split(' ')[0] : new Date().toISOString().slice(0, 10);
    const [y, m, d] = baseDate.split('-').map(Number);
    if (!y || !m || !d) return new Date().toISOString().slice(0, 10);
    
    const targetDate = new Date(y, m - 1, 1);
    targetDate.setMonth(targetDate.getMonth() + 1);
    
    const maxDays = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
    targetDate.setDate(Math.min(d, maxDays));
    
    const expY = targetDate.getFullYear();
    const expM = String(targetDate.getMonth() + 1).padStart(2, '0');
    const expD = String(targetDate.getDate()).padStart(2, '0');
    return `${expY}-${expM}-${expD}`;
  };

  // 2. Fungsi Pembuka Modal Duplikat
  const openCloneModal = (trx) => {
    setCloningTrx(trx);
    setCloneTargetDate(new Date().toISOString().slice(0, 10));
  };

  // 3. Eksekusi Simpan Duplikat ke Database Turso (Full Dynamic)
  const handleExecuteClone = async () => {
    if (!cloningTrx || !cloneTargetDate) return;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      let timePart = '12:00:00';
      if (cloningTrx.date && cloningTrx.date.includes(' ')) {
        const rawTime = cloningTrx.date.split(' ')[1];
        timePart = rawTime.length === 5 ? `${rawTime}:00` : rawTime;
      } else {
        const now = new Date();
        timePart = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      }
      
      const newDateTime = `${cloneTargetDate} ${timePart}`;

      const isExp = (cloningTrx.type || '').toLowerCase() === 'expense';
      const hasWarranty = (cloningTrx.has_warranty === 1 || cloningTrx.has_warranty === true) && isExp;
      const warrantyMonths = hasWarranty ? (parseInt(cloningTrx.warranty_months) || 0) : 0;
      
      let newWarrantyExpiry = null;
      if (hasWarranty && warrantyMonths > 0) {
        newWarrantyExpiry = calculateWarrantyExpiry(cloneTargetDate, warrantyMonths);
      }

      const isAssetVal = cloningTrx.expense_nature === 'asset' || cloningTrx.is_asset === 1 ? 1 : 0;
      const expenseNatureVal = cloningTrx.expense_nature || (cloningTrx.type === 'income' ? 'salary' : 'operational');

      await turso.execute({
        sql: `INSERT INTO transactions 
              (user_id, type, expense_nature, category, amount, currency, payment_method, note, date, receipt_image, has_warranty, warranty_months, warranty_expiry, is_asset, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        args: [
          currentUser.uid,
          cloningTrx.type,
          expenseNatureVal,
          cloningTrx.category,
          parseFloat(cloningTrx.amount) || 0,
          cloningTrx.currency || mainCurrency,
          cloningTrx.payment_method || 'Cash',
          cloningTrx.note ? `${cloningTrx.note} (Copy)` : '',
          newDateTime,
          cloningTrx.receipt_image || null,
          hasWarranty ? 1 : 0,
          warrantyMonths,
          newWarrantyExpiry,
          isAssetVal
        ]
      });

      alert(t.successClone);
      setCloningTrx(null);
      setCloneTargetDate('');
      fetchTransactions(); 
    } catch (error) {
      console.error('Gagal menduplikat transaksi:', error);
      alert(t.failClone + error.message);
    }
  };

  const formatNumberWithSeparator = (value) => {
    if (value === undefined || value === null || value === '') return '';
    const cleanValue = String(value).replace(/\D/g, '');
    return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const formatDateByLang = (dateStr) => {
    if (!dateStr) return '';
    const pureDate = dateStr.split(' ')[0];
    const [y, m, d] = pureDate.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const dateObj = new Date(y, m - 1, d);
    const localeMap = { id: 'id-ID', jp: 'ja-JP', en: 'en-US', ar: 'ar-SA', cn: 'zh-CN' };
    const locale = localeMap[language] || 'id-ID';

    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(dateObj);
  };

  const formatTimeByLang = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split(' ');
    if (parts.length < 2) return '';
    const [h, m] = parts[1].split(':');
    if (h === undefined || m === undefined) return '';
    return `${h}:${m}`;
  };

  const calculateWarrantyExpiry = (startDateStr, monthsCount) => {
    if (!startDateStr || !monthsCount || isNaN(monthsCount) || Number(monthsCount) <= 0) return null;
    const pureDate = startDateStr.split(' ')[0];
    const [y, m, d] = pureDate.split('-').map(Number);
    if (!y || !m || !d) return null;
      
    const expDate = new Date(y, m - 1, d);
    expDate.setMonth(expDate.getMonth() + parseInt(monthsCount));
      
    const expY = expDate.getFullYear();
    const expM = String(expDate.getMonth() + 1).padStart(2, '0');
    const expD = String(expDate.getDate()).padStart(2, '0');
    return `${expY}-${expM}-${expD}`;
  };

  const currentLangCategories = CATEGORIES_BY_LANG[language] || CATEGORIES_BY_LANG['id'];
    
  const expenseRoutineCategories = currentLangCategories.expenseRoutine || [];
  const expenseAssetCategories = currentLangCategories.expenseAsset || [];
  const incomeRoutineCategories = currentLangCategories.incomeRoutine || [];
  const incomeAssetCategories = currentLangCategories.incomeAsset || [];

  const filterCategoriesList = useMemo(() => {
    return filterType === 'income' 
      ? [...new Set([...incomeRoutineCategories, ...incomeAssetCategories])] 
      : filterType === 'expense' 
        ? [...new Set([...expenseRoutineCategories, ...expenseAssetCategories])] 
        : [...new Set([...incomeRoutineCategories, ...incomeAssetCategories, ...expenseRoutineCategories, ...expenseAssetCategories])];
  }, [filterType, incomeRoutineCategories, incomeAssetCategories, expenseRoutineCategories, expenseAssetCategories]);

  const normalizeType = (rawType) => {
    const normalizedType = String(rawType || '').toLowerCase();
    return (normalizedType === 'income' || normalizedType === 'pemasukan') ? 'income' : 'expense';
  };

  const tList = {
    id: {
      title: 'Riwayat Transaksi', subtitle: 'Kelola catatan Anda.', empty: 'Belum ada transaksi tercatat.', confirmDel: 'Yakin ingin menghapus transaksi ini?', editTitle: 'Edit Transaksi', saveBtn: 'Simpan', cancelBtn: 'Batal', note: 'Catatan', nominalLabel: 'Nominal', payLabel: 'Metode Pembayaran', catLabel: 'Pilih Kategori', customToggle: '+ Ketik Kategori Lain', selectToggle: '« Pilih dari Daftar', customPlaceholder: 'Nama kategori baru...', warningMsg: '⚠️ Pilih atau ketik kategori terlebih dahulu.', addBtn: 'Baru', btnReceipt: 'Struk', filterAllType: 'Semua Tipe', filterInc: 'Pemasukan', filterExp: 'Pengeluaran', filterAllCat: 'Semua Kategori', selectedCats: 'kategori dipilih', labelFrom: 'Dari', labelTo: 'Sampai', dateLabel: 'Tanggal', timeLabel: 'Waktu', seeAll: 'Lihat Semua', allTxTitle: 'Semua Transaksi', uploadReceipt: ' ', removeReceipt: 'Hapus Struk', receipt: 'Bukti Struk', recent: 'Terbaru', billText: 'Tagihan',
      filterLockBanner: 'Mode Filter Hapus Aktif! Silakan pilih filter di bawah.',
      expenseNatureLabel: 'Sifat Pengeluaran',
      opCostTitle: 'Pengeluaran Rutin (Operasional)', opCostDesc: 'Makanan, listrik, kebutuhan harian, dll.',
      assetCostTitle: 'Penggunaan Tabungan/Aset (Non-Operasional)', assetCostDesc: 'HP, laptop, kendaraan, emas, investasi, dll.',
      incomeNatureLabel: 'Sifat Pemasukan',
      salaryIncome: 'Pemasukan Rutin / Gaji', salarySub: 'Gaji utama, tunjangan tetap',
      assetIncome: 'Pemasukan Non-Rutin / Aset', assetIncomeSub: 'Bonus, freelance, investasi, emas, hutang, hadiah',
      warrantyBadge: 'Garansi', warrantyLabel: 'Barang Bergaransi?', warrantyDuration: 'Masa Garansi:',
      warrantyDetailTitle: 'Detail Garansi', purchaseDateLabel: 'Tanggal Pembelian', warrantyValidUntil: 'Garansi Berlaku Hingga',
      warrantyExpired: '⚠️ Masa Garansi Telah Habis', warrantyRemaining: '⏳ Sisa Waktu:', daysLeftUnit: 'Hari Lagi', editWarrantyBtn: 'Ubah Tanggal / Durasi',
      warrantyCustomToggle: '+ Custom Bulan', warrantySelectToggle: '« Pilih Preset', warrantyMonthUnit: 'Bulan',
      warrantyOptions: { 1: '1 Bulan', 3: '3 Bulan', 6: '6 Bulan', 12: '1 Tahun (12 Bln)', 24: '2 Tahun (24 Bln)', 36: '3 Tahun (36 Bln)' },
      exportWarnDesc: 'Transaksi melebihi batas tampilan, disarankan Export/Download all data to Word/Spreadsheet/PDF', exportLockedHint: 'Minimal 12 transaksi/tahun untuk membuka fitur Export',
      exportLockedToast: '🔒 Fitur Export Terkunci! Anda memerlukan minimal 12 transaksi per tahun untuk membuka fitur ini.',
      suggest96Toast: '💡 Saran: Transaksi Anda sudah mencapai 96+. Disarankan untuk Export/Download cadangan data Anda!',
      limit720WarnDesc: '⚠️ Transaksi dalam 1 tahun sudah mencapai 720. Transaksi lama telah terkunci, silakan Export/Download data Anda!',
      deleteFiltered: 'Hapus Transaksi Terfilter', confirmDelFiltered: 'Yakin ingin menghapus transaksi terfilter ini? transaksi yang terhapus tidak dapat dikembalikan!',
      countToDelete: 'Jumlah yang akan dihapus',
      activeFiltersLabel: 'Filter Aktif',
      noFilterLabel: '(Semua transaksi tanpa filter)',
      filterTypeLabel: 'Tipe',
      filterCatLabel: 'Kategori',
      filterPeriodLabel: 'Periode',
      filterSearchLabel: 'Kata kunci',
      deleteChoiceTitle: 'Opsi Penghapusan Data',
      deleteChoiceDesc: 'Pilih metode penghapusan data transaksi yang Anda inginkan:',
      deleteFilteredOpt: 'Hapus Berdasarkan Filter',
      deleteFilteredDesc: 'Hanya menghapus transaksi yang saat ini tampil berdasarkan pencarian/filter aktif.',
      deleteAllOpt: 'Hapus Seluruh Transaksi',
      deleteAllDesc: 'Menghapus TOTAL seluruh riwayat transaksi tanpa memedulikan filter.',
      confirmDelEverything: '⚠️ PERINGATAN KERAS!\nApakah Anda benar-benar yakin ingin MENGHAPUS SELURUH TRANSACTION DATA?\n\nData yang terhapus TIDAK DAPAT DIKEMBALIKAN!',
      successUpdate: 'Berhasil diperbarui!', successDelete: 'Berhasil dihapus.', failDelete: 'Gagal menghapus: ', failUpdate: 'Gagal memperbarui transaksi: ',
      searchPlaceholder: 'Cari transaksi (kategori, catatan, metode)...',
      cloneBtn: 'Duplikat', cloneTitle: 'Duplikat Transaksi', cloneToday: 'Hari Ini', cloneNextMonth: 'Bulan Depan', cloneCustom: 'Tanggal Lain', cloneSubmit: 'Duplikat Sekarang', successClone: 'Transaksi berhasil diduplikat!', failClone: 'Gagal menduplikat transaksi: ',
      clearAllCats: 'Hapus Semua', resetFilter: 'Reset Filter',
      successExport: '✅ Berhasil diunduh! File tersimpan di folder Download/WGen Note.',
      failPdf: 'Terjadi kesalahan saat mencetak PDF.',
      failDetailPdf: 'Terjadi kesalahan saat mencetak PDF Detail Struk.',
      failDocs: 'Terjadi kesalahan saat mengunduh dokumen Word.',
      failExcel: 'Terjadi kesalahan saat mengunduh Spreadsheet.'
    },
    jp: { 
      title: '取引履歴', subtitle: '記録を管理します。', empty: '取引がありません。', confirmDel: '削除しますか？', editTitle: '取引の編集', saveBtn: '保存', cancelBtn: 'キャンセル', note: 'メモ', nominalLabel: '金額', payLabel: '支払い', catLabel: 'カテゴリーを選択', customToggle: '+ カスタム入力', selectToggle: '« リストから選択', customPlaceholder: '新しいカテゴリー名...', warningMsg: '⚠️ カテゴリーを選択または入力してください。', addBtn: '新規', btnReceipt: 'レシート', filterAllType: 'すべてのタイプ', filterInc: '収入', filterExp: '支出', filterAllCat: 'すべてのカテゴリー', selectedCats: '件選択中', labelFrom: '開始', labelTo: '終了', dateLabel: '日付', timeLabel: '時間', seeAll: 'すべて見る', allTxTitle: '全取引', uploadReceipt: ' ', removeReceipt: '削除', receipt: 'レシート', recent: '最新', billText: '請求書',
      filterLockBanner: '削除フィルターモード有効！下のフィルターを選択してください。',
      expenseNatureLabel: '支出の性質',
      opCostTitle: '日常の定期支出 (運用コスト)', opCostDesc: '食費、光熱費、日用品など',
      assetCostTitle: '貯金・資産の使用 (非運用コスト)', assetCostDesc: 'スマホ、PC、車両、金、投資など',
      incomeNatureLabel: '収入の性質',
      salaryIncome: '給与・定期収入', salarySub: '基本給、手当など',
      assetIncome: '臨時収入・資産運用', assetIncomeSub: 'ボーナス、副業、投資、金、借入、ギフト',
      warrantyBadge: '保証', warrantyLabel: '保証対象の商品？', warrantyDuration: '保証期間:',
      warrantyDetailTitle: '保証詳細', purchaseDateLabel: '購入日', warrantyValidUntil: '保証有効期限',
      warrantyExpired: '⚠️ 保証期間が終了しました', warrantyRemaining: '⏳ 残り時間:', daysLeftUnit: '日', editWarrantyBtn: '日付・期間を変更',
      warrantyCustomToggle: '+ カスタム月数', warrantySelectToggle: '« リストから選択', warrantyMonthUnit: 'ヶ月',
      warrantyOptions: { 1: '1ヶ月', 3: '3ヶ月', 6: '6ヶ月', 12: '1年 (12ヶ月)', 24: '2年 (24ヶ月)', 36: '3年 (36ヶ月)' },
      exportWarnDesc: '表示上限を超えました。データを Word/Spreadsheet/PDF にエクスポートしてください。', exportLockedHint: 'エクスポート機能を解放するには年間12件以上の取引が必要です',
      exportLockedToast: '🔒 エクスポート機能はロックされています！解放するには年間12件以上の取引が必要です。',
      suggest96Toast: '💡 ヒント: 取引数が96件を超えました。バックアップとしてデータのエクスポートをお勧めします！',
      limit720WarnDesc: '⚠️ 年間取引数が720件に達しました。古い取引はロックされました。データをエクスポートしてください！',
      deleteFiltered: '絞り込まれた取引を削除', confirmDelFiltered: 'このフィルターされた取引を削除してもよろしいですか？削除された取引は復元できません!',
      countToDelete: '削除される件数',
      activeFiltersLabel: '適用中のフィルター',
      noFilterLabel: '(フィルターなしの全取引)',
      filterTypeLabel: 'タイプ',
      filterCatLabel: 'カテゴリー',
      filterPeriodLabel: '期間',
      filterSearchLabel: 'キーワード',
      deleteChoiceTitle: '削除オプションの選択',
      deleteChoiceDesc: '取引データの削除方法を選択してください：',
      deleteFilteredOpt: 'フィルターされた取引を削除',
      deleteFilteredDesc: '現在表示されている検索・フィルター条件の取引のみを削除します。',
      deleteAllOpt: '全取引データを削除',
      deleteAllDesc: 'フィルターに関係なく、すべての取引履歴を完全に削除します。',
      confirmDelEverything: '⚠️ 警告！\nすべての取引データを本当に削除しますか？\n\n削除されたデータは復元できません！',
      successUpdate: '正常に更新されました！', successDelete: '削除しました。', failDelete: '削除に失敗しました: ', failUpdate: '取引の更新に失敗しました: ',
      searchPlaceholder: '取引を検索 (カテゴリー、メモ、支払い方法)...',
      cloneBtn: '複製', cloneTitle: '取引の複製', cloneToday: '本日', cloneNextMonth: '来月', cloneCustom: '他の日付', cloneSubmit: '今すぐ複製', successClone: '取引を複製しました！', failClone: '取引の複製に失敗しました: ',
      clearAllCats: 'すべて解除', resetFilter: 'フィルター解除',
      successExport: '✅ ダウンロード完了！ファイルは Download/WGen Note フォルダに保存されました。',
      failPdf: 'PDFの作成中にエラーが発生しました。',
      failDetailPdf: 'レシート詳細PDFの作成中にエラーが発生しました。',
      failDocs: 'Wordドキュメントのダウンロード中にエラーが発生しました。',
      failExcel: 'スプレッドシートのダウンロード中にエラーが発生しました。'
    },
    en: { 
      title: 'Transaction History', subtitle: 'Manage your records.', empty: 'No transactions yet.', confirmDel: 'Delete this transaction?', editTitle: 'Edit Transaction', saveBtn: 'Save', cancelBtn: 'Cancel', note: 'Note', nominalLabel: 'Amount', payLabel: 'Payment', catLabel: 'Select Category', customToggle: '+ Custom Category', selectToggle: '« Select from list', customPlaceholder: 'New category name...', warningMsg: '⚠️ Select or type a category first.', addBtn: 'New', btnReceipt: 'Receipt', filterAllType: 'All Types', filterInc: 'Income', filterExp: 'Expense', filterAllCat: 'All Categories', selectedCats: 'categories selected', labelFrom: 'From', labelTo: 'To', dateLabel: 'Date', timeLabel: 'Time', seeAll: 'See All', allTxTitle: 'All Transactions', uploadReceipt: ' ', removeReceipt: 'Remove Receipt', receipt: 'Receipt', recent: 'Recent', billText: 'Bill',
      filterLockBanner: 'Delete Filter Mode Active! Please select a filter below.',
      expenseNatureLabel: 'Expense Nature',
      opCostTitle: 'Operational Expenses', opCostDesc: 'Food, electricity, daily needs, etc.',
      assetCostTitle: 'Savings / Asset Usage', assetCostDesc: 'Phones, laptops, vehicles, gold, investments, etc.',
      incomeNatureLabel: 'Income Type',
      salaryIncome: 'Salary / Routine Income', salarySub: 'Main salary, allowances',
      assetIncome: 'Non-Routine Income / Assets', assetIncomeSub: 'Bonus, freelance, investment, gold, loan, gift',
      warrantyBadge: 'Warranty', warrantyLabel: 'Item Has Warranty?', warrantyDuration: 'Warranty Period:',
      warrantyDetailTitle: 'Warranty Details', purchaseDateLabel: 'Purchase Date', warrantyValidUntil: 'Warranty Valid Until',
      warrantyExpired: '⚠️ Warranty Has Expired', warrantyRemaining: '⏳ Time Remaining:', daysLeftUnit: 'Days Left', editWarrantyBtn: 'Edit Date / Duration',
      warrantyCustomToggle: '+ Custom Months', warrantySelectToggle: '« Select Preset', warrantyMonthUnit: 'Mos',
      warrantyOptions: { 1: '1 Month', 3: '3 Months', 6: '6 Months', 12: '1 Year (12 Mos)', 24: '2 Years (24 Mos)', 36: '3 Years (36 Mos)' },
      exportWarnDesc: 'Transactions exceed display limit, please Export/Download all data to Word/Spreadsheet/PDF', exportLockedHint: 'Min 12 transactions/year to unlock Export feature',
      exportLockedToast: '🔒 Export Feature Locked! You need at least 12 transactions per year to unlock this feature.',
      suggest96Toast: '💡 Suggestion: You have 96+ transactions. It is recommended to Export/Download a backup of your data!',
      limit720WarnDesc: '⚠️ Transactions have reached 720 this year. Older transactions are locked, please export/download your data!',
      deleteFiltered: 'Delete Filtered Transactions', confirmDelFiltered: 'Are you sure you want to delete these filtered transactions? Deleted transactions cannot be restored!',
      countToDelete: 'Amount to delete',
      activeFiltersLabel: 'Active Filters',
      noFilterLabel: '(All transactions without filter)',
      filterTypeLabel: 'Type',
      filterCatLabel: 'Category',
      filterPeriodLabel: 'Period',
      filterSearchLabel: 'Keyword',
      deleteChoiceTitle: 'Data Deletion Options',
      deleteChoiceDesc: 'Choose your preferred transaction deletion method:',
      deleteFilteredOpt: 'Delete Filtered Transactions',
      deleteFilteredDesc: 'Only delete transactions currently displayed based on active search/filter.',
      deleteAllOpt: 'Delete All Transactions',
      deleteAllDesc: 'Wipe ALL transaction history completely regardless of filters.',
      confirmDelEverything: '⚠️ CRITICAL WARNING!\nAre you sure you want to DELETE ALL TRANSACTION DATA?\n\nDeleted data CANNOT be restored!',
      successUpdate: 'Successfully updated!', successDelete: 'Successfully deleted.', failDelete: 'Failed to delete: ', failUpdate: 'Failed to update transaction: ',
      searchPlaceholder: 'Search transactions (category, note, method)...',
      cloneBtn: 'Duplicate', cloneTitle: 'Duplicate Transaction', cloneToday: 'Today', cloneNextMonth: 'Next Month', cloneCustom: 'Other Date', cloneSubmit: 'Duplicate Now', successClone: 'Transaction duplicated successfully!', failClone: 'Failed to duplicate transaction: ',
      clearAllCats: 'Clear All', resetFilter: 'Reset Filter',
      successExport: '✅ Downloaded successfully! File saved to Download/WGen Note folder.',
      failPdf: 'An error occurred while generating the PDF.',
      failDetailPdf: 'An error occurred while generating the Detailed Receipt PDF.',
      failDocs: 'An error occurred while downloading the Word document.',
      failExcel: 'An error occurred while downloading the Spreadsheet.'
    },
    ar: { 
      title: 'سجل المعاملات', subtitle: 'إدارة سجلاتك.', empty: 'لا توجد معاملات.', confirmDel: 'حذف هذه المعاملة؟', editTitle: 'تعديل المعاملة', saveBtn: 'حفظ', cancelBtn: 'إلغاء', note: 'ملاحظة', nominalLabel: 'المبلغ', payLabel: 'الدفع', catLabel: 'اختر الفئة', customToggle: '+ فئة مخصصة', selectToggle: '« اختر من القائمة', customPlaceholder: 'اسم الفئة الجديدة...', warningMsg: '⚠️ اختر أو اكتب الفئة أولاً.', addBtn: 'جديد', btnReceipt: 'إيصال', filterAllType: 'كل الأنواع', filterInc: 'دخل', filterExp: 'مصروف', filterAllCat: 'جميع الفئات', selectedCats: 'فئات محددة', labelFrom: 'من', labelTo: 'إلى', dateLabel: 'التاريخ', timeLabel: 'الوقت', seeAll: 'عرض الكل', allTxTitle: 'كل المعاملات', uploadReceipt: ' ', removeReceipt: 'حذف', receipt: 'إيصال', recent: 'الأخيرة', billText: 'فاتورة',
      filterLockBanner: 'وضع تصفية الحذف نشط! يرجى تحديد التصفية أدناه.',
      expenseNatureLabel: 'طبيعة المصروفات',
      opCostTitle: 'المصروفات التشغيلية اليومية', opCostDesc: 'الطعام، الكهرباء، الاحتياجات اليومية، إلخ.',
      assetCostTitle: 'استخدام المدخرات/الأصول', assetCostDesc: 'الهواتف، أجهزة الكمبيوتر، السيارات، الذهب، الاستثمار، إلخ.',
      incomeNatureLabel: 'نوع الدخل',
      salaryIncome: 'دخل روتيني / راتب', salarySub: 'الراتب الأساسي',
      assetIncome: 'دخل غير روتيني / أصول', assetIncomeSub: 'مكافأة، عمل حر، استثمار، ذهب، قرض، هدية',
      warrantyBadge: 'ضمان', warrantyLabel: 'منتج مع ضمان؟', warrantyDuration: 'مدة الضمان:',
      warrantyDetailTitle: 'تفاصيل الضمان', purchaseDateLabel: 'تاريخ الشراء', warrantyValidUntil: 'الضمان ساري حتى',
      warrantyExpired: '⚠️ انتهت فترة الضمان', warrantyRemaining: '⏳ الوقت المتبقي:', daysLeftUnit: 'أيام متبقية', editWarrantyBtn: 'تعديل التاريخ / المدة',
      warrantyCustomToggle: '+ أشهر مخصصة', warrantySelectToggle: '« اختر المسبق', warrantyMonthUnit: 'أشهر',
      warrantyOptions: { 1: 'شهر واحد', 3: '3 أشهر', 6: '6 أشهر', 12: 'سنة واحدة (12 شهر)', 24: 'سنتان (24 شهر)', 36: '3 سنوات (36 شهر)' },
      exportWarnDesc: 'تجاوزت المعاملات الحد الأقصى للعرض، يرجى تصدير/تحميل جميع البيانات إلى Word/Spreadsheet/PDF', exportLockedHint: 'الحد الأدنى 12 معاملة/سنة لفتح ميزة التصدير',
      exportLockedToast: '🔒 ميزة التصدير مقفولة! تحتاج إلى 12 معاملة على الأقل سنوياً لفتح هذه الميزة.',
      suggest96Toast: '💡 اقتراح: وصلت معاملاتك إلى +96. يوصى بتصدير/تنزيل نسخة احتياطية من بياناتك!',
      limit720WarnDesc: '⚠️ وصلت المعاملات إلى 720 هذا العام. تم قفل المعاملات القديمة، يرجى تصدير بياناتك!',
      deleteFiltered: 'حذف المعاملات المفلترة', confirmDelFiltered: 'هل أنت متأكد أنك تريد حذف هذه المعاملات المفلترة؟ المعاملات المحذوفة لا يمكن استعادتها!',
      countToDelete: 'العدد المراد حذفه',
      activeFiltersLabel: 'التصفيات النشطة',
      noFilterLabel: '(جميع المعاملات بدون تصفية)',
      filterTypeLabel: 'النوع',
      filterCatLabel: 'الفئة',
      filterPeriodLabel: 'الفترة',
      filterSearchLabel: 'الكلمة المفتاحية',
      deleteChoiceTitle: 'خيارات حذف البيانات',
      deleteChoiceDesc: 'اختر طريقة حذف البيانات المفضلة لديك:',
      deleteFilteredOpt: 'حذف المعاملات المفلترة',
      deleteFilteredDesc: 'حذف المعاملات المعروضة حالياً فقط بناءً على التصفية النشطة.',
      deleteAllOpt: 'حذف جميع المعاملات',
      deleteAllDesc: 'مسح كامل سجل المعاملات بغض النظر عن التصفيات.',
      confirmDelEverything: '⚠️ تحذير شديد!\nهل أنت متأكد من رغبتك في حذف جميع بيانات المعاملات؟\n\nلا يمكن استعادة البيانات المحذوفة!',
      successUpdate: 'تم التحديث بنجاح!', successDelete: 'تم الحذف بنجاح.', failDelete: 'فشل الحذف: ', failUpdate: 'فشل تحديث المعاملة: ',
      searchPlaceholder: 'بحث في المعاملات (الفئة، الملاحظة، الطريقة)...',
      cloneBtn: 'نسخ', cloneTitle: 'تكرار المعاملة', cloneToday: 'اليوم', cloneNextMonth: 'الشهر القادم', cloneCustom: 'تاريخ آخر', cloneSubmit: 'تكرار الآن', successClone: 'تم تكرار المعاملة بنجاح!', failClone: 'فشل تكرار المعاملة: ',
      clearAllCats: 'مسح الكل', resetFilter: 'إعادة ضبط',
      successExport: '✅ تم التنزيل بنجاح! تم حفظ الملف في مجلد Download/WGen Note.',
      failPdf: 'حدث خطأ أثناء إنشاء ملف PDF.',
      failDetailPdf: 'حدث خطأ أثناء إنشاء ملف PDF لتفاصيل الإيصال.',
      failDocs: 'حدث خطأ أثناء تنزيل مستند Word.',
      failExcel: 'حدث خطأ أثناء تنزيل جدول البيانات.'
    },
    cn: { 
      title: '交易记录', subtitle: '管理您的记录。', empty: '暂无交易。', confirmDel: '确定删除？', editTitle: '编辑交易', saveBtn: '保存', cancelBtn: '取消', note: '备注', nominalLabel: '金额', payLabel: '支付方式', catLabel: '选择类别', customToggle: '+ 自定义类别', selectToggle: '« 从列表中选择', customPlaceholder: '新类别名称...', warningMsg: '⚠️ 请先选择或输入类别。', addBtn: '新增', btnReceipt: '收据', filterAllType: '所有类型', filterInc: '收入', filterExp: '支出', filterAllCat: '所有类别', selectedCats: '个已选择类别', labelFrom: '开始', labelTo: '结束', dateLabel: '日期', timeLabel: '时间', seeAll: '查看所有', allTxTitle: '所有交易', uploadReceipt: ' ', removeReceipt: '删除收据', receipt: '收据', recent: '最新', billText: '账单',
      filterLockBanner: '删除筛选模式已激活！请在下方选择筛选条件。',
      expenseNatureLabel: '支出性质',
      opCostTitle: '日常定期支出 (运营成本)', opCostDesc: '餐饮、水电费、日用品等',
      assetCostTitle: '储蓄/资产使用 (非运营成本)', assetCostDesc: '手机、电脑、车辆、黄金、投资等',
      incomeNatureLabel: '收入性质',
      salaryIncome: '工资 / 常规收入', salarySub: '基本工资、津贴',
      assetIncome: '非常规收入 / 资产', assetIncomeSub: '奖金、自由职业、投资、黄金、借款、礼物',
      warrantyBadge: '保修', warrantyLabel: '商品包含保修？', warrantyDuration: '保修期限:',
      warrantyDetailTitle: '保修详情', purchaseDateLabel: '购买日期', warrantyValidUntil: '保修有效期至',
      warrantyExpired: '⚠️ 保修已到期', warrantyRemaining: '⏳ 剩余时间:', daysLeftUnit: '天', editWarrantyBtn: '修改日期 / 期限',
      warrantyCustomToggle: '+ 自定义月数', warrantySelectToggle: '« 从预设中选择', warrantyMonthUnit: '个月',
      warrantyOptions: { 1: '1个月', 3: '3个月', 6: '6个月', 12: '1年 (12个月)', 24: '2年 (24个月)', 36: '3年 (36个月)' },
      exportWarnDesc: '交易超出显示限制，请将所有数据导出/下载为 Word/Spreadsheet/PDF', exportLockedHint: '每年最少 12 笔交易即可解锁导出功能',
      exportLockedToast: '🔒 导出功能已锁定！您每年需要至少 12 笔交易才能解锁此功能。',
      suggest96Toast: '💡 建议：您的交易已达 96+ 笔。建议导出/下载备份您的数据！',
      limit720WarnDesc: '⚠️ 今年的交易已达 720 笔。旧交易已被锁定，请导出/下载您的数据！',
      deleteFiltered: '删除筛选出的交易', confirmDelFiltered: '您确定要删除这些已筛选的交易吗？已删除的交易无法恢复！',
      countToDelete: '待删除数量',
      activeFiltersLabel: '已启用的筛选',
      noFilterLabel: '(无筛选的所有交易)',
      filterTypeLabel: '类型',
      filterCatLabel: '类别',
      filterPeriodLabel: '时间段',
      filterSearchLabel: '关键词',
      deleteChoiceTitle: '数据删除选项',
      deleteChoiceDesc: '请选择您需要的交易数据删除方式：',
      deleteFilteredOpt: '删除已筛选交易',
      deleteFilteredDesc: '仅删除当前根据搜索/筛选条件显示的交易。',
      deleteAllOpt: '删除所有交易',
      deleteAllDesc: '无论是否筛选，彻底清空所有历史交易记录。',
      confirmDelEverything: '⚠️ 严重警告！\n您确定要删除所有交易数据吗？\n\n删除的数据无法恢复！',
      successUpdate: '更新成功！', successDelete: '删除成功。', failDelete: '删除失败: ', failUpdate: '更新交易失败: ',
      searchPlaceholder: '搜索交易（类别、备注、支付方式）...',
      cloneBtn: '复制', cloneTitle: '复制交易', cloneToday: '今天', cloneNextMonth: '下个月', cloneCustom: '其他日期', cloneSubmit: '立即复制', successClone: '交易复制成功！', failClone: '复制交易失败: ',
      clearAllCats: '清除全部', resetFilter: '重置筛选',
      successExport: '✅ 下载成功！文件已保存至 Download/WGen Note 文件夹。',
      failPdf: '生成 PDF 时发生错误。',
      failDetailPdf: '生成收据明细 PDF 时发生错误。',
      failDocs: '下载 Word 文档时发生错误。',
      failExcel: '下载电子表格时发生错误。'
    }
  };
  const t = tList[language] || tList['id'];

  const billKeys = ['listrik', 'air', 'gas', 'internet', 'electricity', 'water', 'tagihan listrik', 'tagihan air', 'tagihan gas', 'tagihan internet'];

  const formatCategoryWithBill = (catName, typeTrx) => {
    if (!catName) return '';
    return getTranslatedCategory(catName, language); 
    
    return catName;
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

  const tExportMap = {
  id: { 
    reportTitle: 'Laporan Transaksi', 
    detailSubtitle: '(Detail Struk)', 
    date: 'Tanggal', 
    type: 'Tipe', 
    category: 'Kategori', 
    amount: 'Nominal', 
    method: 'Metode', 
    note: 'Catatan', 
    income: 'Pemasukan', 
    expense: 'Pengeluaran', 
    totalSummary: 'Total Ringkasan', 
    remaining: 'Sisa', 
    receiptTitle: 'Bukti Struk Transaksi',
    printedBy: 'Dicetak otomatis oleh © 2026 WGen Note'
  },
  jp: { 
    reportTitle: '取引レポート', 
    detailSubtitle: '(レシート詳細)', 
    date: '日付', 
    type: 'タイプ', 
    category: 'カテゴリー', 
    amount: '金額', 
    method: '支払い方法', 
    note: 'メモ', 
    income: '収入', 
    expense: '支出', 
    totalSummary: '合計概要', 
    remaining: '残高', 
    receiptTitle: 'レシート・証憑',
    printedBy: '© 2026 WGen Note により自動発行'
  },
  en: { 
    reportTitle: 'Transaction Report', 
    detailSubtitle: '(Receipt Detail)', 
    date: 'Date', 
    type: 'Type', 
    category: 'Category', 
    amount: 'Amount', 
    method: 'Method', 
    note: 'Note', 
    income: 'Income', 
    expense: 'Expense', 
    totalSummary: 'Total Summary', 
    remaining: 'Remaining', 
    receiptTitle: 'Receipt Proof',
    printedBy: 'Automatically printed by © 2026 WGen Note'
  },
  ar: { 
    reportTitle: 'تقرير معاملات', 
    detailSubtitle: '(تفاصيل الإيصال)', 
    date: 'التاريخ', 
    type: 'النوع', 
    category: 'الفئة', 
    amount: 'المبلغ', 
    method: 'طريقة الدفع', 
    note: 'ملاحظة', 
    income: 'دخل', 
    expense: 'مصروف', 
    totalSummary: 'ملخص إجمالي', 
    remaining: 'المتبقي', 
    receiptTitle: 'إيصال الدفع',
    printedBy: 'تم الطباعة تلقائيًا بواسطة © 2026 WGen Note'
  },
  cn: { 
    reportTitle: '交易报告', 
    detailSubtitle: '(收据详情)', 
    date: '日期', 
    type: '类型', 
    category: '类别', 
    amount: '金额', 
    method: '支付方式', 
    note: '备注', 
    income: '收入', 
    expense: '支出', 
    totalSummary: '总计摘要', 
    remaining: '结余', 
    receiptTitle: '收据凭证',
    printedBy: '由 © 2026 WGen Note 自动打印'
  }
};
  const expT = tExportMap[language] || tExportMap['id'];
  
  const convertCurrency = (amount, fromCurr, toCurr) => {
    return convertCurrencyDynamic(amount, fromCurr, toCurr, liveRates);
  };

 const fetchTransactions = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const db = await initDB();

      // 1. BACA LOKAL INDEXEDDB
      const localData = await db.getAllFromIndex('transactions', 'user_id', currentUser.uid).catch(() => []);
      const rawLocal = (localData && localData.length > 0) 
        ? localData 
        : await db.getAll('transactions').catch(() => []);

      const userOnlyLocal = rawLocal.filter(item => item.user_id === currentUser.uid);

      if (userOnlyLocal && userOnlyLocal.length > 0) {
        // Hilangkan duplikat berdasarkan ID
        const uniqueLocalMap = new Map();
        userOnlyLocal.forEach(item => {
          if (item && item.id) uniqueLocalMap.set(String(item.id), item);
        });

        const sortedLocal = Array.from(uniqueLocalMap.values()).sort((a, b) => {
          const timeA = new Date(a.date ? a.date.replace(' ', 'T') : a.created_at || 0).getTime();
          const timeB = new Date(b.date ? b.date.replace(' ', 'T') : b.created_at || 0).getTime();
          return timeB - timeA;
        });
        
        setTransactions(sortedLocal);
      }

      // 2. FETCH TURSO LATAR BELAKANG
      if (navigator.onLine) {
        turso.execute({
          sql: `SELECT rowid, * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC`,
          args: [currentUser.uid]
        }).then(async (res) => {
          const resultData = res.rows.map((row, index) => {
            // FIX UNIQUE KEY: Utamakan row.id (UUID), baru fallback ke string unik
            const realId = String(row.id || (row.rowid ? `turso-row-${row.rowid}` : `trx-${Date.now()}-${index}`));
            return {
              id: realId,
              user_id: row.user_id,
              type: row.type,
              expense_nature: row.expense_nature || (row.is_asset ? 'asset' : 'operational'),
              category: row.category,
              amount: row.amount,
              currency: row.currency || mainCurrency,
              payment_method: row.payment_method,
              note: row.note,
              date: row.date,
              receipt_image: row.receipt_image,
              has_warranty: row.has_warranty || 0,
              warranty_months: row.warranty_months || 0,
              warranty_expiry: row.warranty_expiry || null,
              is_pending: 0
            };
          });

          // Simpan ke IndexedDB lokal
          for (const item of resultData) {
            if (item && item.id) {
              await db.put('transactions', item);
            }
          }

          setTransactions(resultData);
        }).catch((err) => {
          console.warn('Turso bg fetch warning:', err.message);
        });
      }
    } catch (error) {
      console.error('Gagal memuat transaksi:', error.message);
    }
  };
   
  useEffect(() => {
    // Jalankan sync queue jika online
    if (navigator.onLine && typeof processSyncQueue === 'function') {
      processSyncQueue().catch(console.error);
    }

    // Dengarkan perubahan auth Firebase (mencegah data 0 saat pertama kali mount)
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchTransactions();
      }
    });

    window.addEventListener('transaction-added', fetchTransactions);
    return () => {
      unsubscribe();
      window.removeEventListener('transaction-added', fetchTransactions);
    };
  }, []);

  // 1. Hitung jumlah transaksi per tahun
  const currentYear = new Date().getFullYear();
  const yearlyTransactions = transactions.filter(tr => {
    if (!tr.date) return false;
    const pureYear = tr.date.split(' ')[0];
    return new Date(pureYear).getFullYear() === currentYear;
  });
  const yearlyCount = yearlyTransactions.length;

  // Syarat Export Terbuka Otomatis: Minimal 12 Transaksi per Tahun
  const isExportUnlocked = yearlyCount >= 12;

  // 2. Batas maksimal 720 untuk search/filter
  const searchableTransactions = yearlyCount > 720 ? transactions.slice(0, 720) : transactions;
  
  // 3. Logika Toast Automatic Timers
  useEffect(() => {
    if (yearlyCount > 720) {
      setShowToastWarning(true);
      const timer = setTimeout(() => setShowToastWarning(false), 2000);
      return () => clearTimeout(timer);
    } else if (yearlyCount >= 96 && yearlyCount < 720) {
      setShow96ToastSuggestion(true);
      const timer = setTimeout(() => setShow96ToastSuggestion(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [yearlyCount]);

  const triggerLockedExportToast = () => {
    setShowExportLockedToast(true);
    setTimeout(() => {
      setShowExportLockedToast(false);
    }, 2000);
  };

  // 4. Proses Search & Filter pada data
  const filteredTransactions = searchableTransactions.filter(trx => {
    const isIncome = normalizeType(trx.type) === 'income';
    if (filterType === 'income' && !isIncome) return false;
    if (filterType === 'expense' && isIncome) return false;
      
    if (filterCategory.length > 0) {
      const translatedCat = getTranslatedCategory(trx.category, language);
      const isMatch = filterCategory.some(
        selectedCat => selectedCat.toLowerCase() === translatedCat.toLowerCase()
      );
      if (!isMatch) return false;
    }
      
    const pureTrxDate = trx.date ? trx.date.split(' ')[0] : '';
    if (dateFrom && pureTrxDate < dateFrom) return false;
    if (dateTo && pureTrxDate > dateTo) return false;

    if (searchQuery.trim() !== '') {
      const queryClean = searchQuery.toLowerCase().trim();
      const translatedCat = getTranslatedCategory(trx.category, language).toLowerCase();
      const origCat = String(trx.category || '').toLowerCase();
      const noteStr = String(trx.note || '').toLowerCase();
      const payMethodStr = String(getPaymentMethodLabel(trx.payment_method, language)).toLowerCase();

      const matchesSearch = translatedCat.includes(queryClean) || 
                            origCat.includes(queryClean) || 
                            noteStr.includes(queryClean) || 
                            payMethodStr.includes(queryClean);
      if (!matchesSearch) return false;
    }

    return true;
  });

  // 5. Batasan tampilan
  const limitedTransactions = filteredTransactions.slice(0, 96);
  const displayRecentTransactions = limitedTransactions.slice(0, isRecentMinimized ? 3 : 8);

  // ============================================================================
  // LOGIKA PENGHAPUSAN TRANSAKSI (SINGLE & MASSAL)
  // ============================================================================

  // 🟢 1. EKSEKUSI HAPUS SATUAN / SINGLE ITEM (Offline-First Ready)
  const handleDelete = async (targetId) => {
    if (targetId === undefined || targetId === null || targetId === '') {
      console.error('ID Transaksi tidak ditemukan / undefined', targetId);
      return;
    }

   if (!(await showConfirm(t.confirmDel))) return;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      // Jika ID merupakan ID fallback buatan, hapus langsung dari state & IndexedDB lokal
      if (String(targetId).startsWith('trx-fallback-')) {
        const db = await initDB();
        await db.delete('transactions', targetId);
        setTransactions((prev) => prev.filter((tr) => String(tr.id) !== String(targetId)));
        alert(t.successDelete);
        return;
      }

      // 🚀 1. HAPUS DARI DATABASE LOKAL DULU (IndexedDB)
      const db = await initDB();
      await db.delete('transactions', targetId);

      // Update UI lokal instan tanpa nunggu server
      setTransactions((prev) => prev.filter((tr) => String(tr.id) !== String(targetId)));

      // 🚀 2. COBA HAPUS DI TURSO (DENGAN SAFE FALLBACK)
      let isSyncedToTurso = false;
      if (navigator.onLine) {
        try {
          await turso.execute({
            sql: `DELETE FROM transactions WHERE id = ? AND user_id = ?`,
          args: [targetId, currentUser.uid]
        });
          isSyncedToTurso = true;
        } catch (tursoErr) {
          console.warn('📱 Turso delete gagal / koneksi offline. Masukkan ke Sync Queue:', tursoErr.message);
        }
      }

      // 🚀 3. JIKA OFFLINE ATAU TURSO GAGAL -> MASUKKAN KE QUEUE
      if (!isSyncedToTurso) {
        await addToSyncQueue('DELETE', 'transactions', { id: targetId });
      }

      alert(t.successDelete);
      fetchTransactions(); // Refresh UI dari DB lokal
    } catch (error) {
      console.error('Gagal menghapus transaksi:', error);
      alert(t.failDelete + error.message);
    }
  };
  
  // 🟡 A. Pembuka Modal Pilihan Hapus Massal
  const handleOpenDeleteModal = () => {
    setShowDeleteChoiceModal(true);
  };

  // 🔴 B. Eksekusi Hapus TOTAL (Reset Seluruh Transaksi User di Turso)
  const handleConfirmDeleteEverything = async () => {
    const confirmMsg = `${t.confirmDelEverything}\n\n${t.countToDelete}: ${transactions.length}`;
    if (!(await showConfirm(confirmMsg))) return;
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      await turso.execute({
        sql: `DELETE FROM transactions WHERE user_id = ?`,
        args: [currentUser.uid]
      });

      setTransactions([]);
      setShowDeleteChoiceModal(false);
      alert(t.successDelete);
    } catch (error) {
      alert(t.failDelete + error.message);
    }
  };

  // 🟠 C. Eksekusi Hapus Sesuai Filter Aktif
 // 🟠 C. Eksekusi Hapus Sesuai Filter Aktif
  const handleConfirmDeleteFiltered = async () => {
    const hasActiveFilter = filterType !== 'all' || filterCategory.length > 0 || dateFrom !== '' || dateTo !== '' || searchQuery !== '';

    // Jika BELUM ada filter aktif:
    if (!hasActiveFilter) {
      setShowDeleteChoiceModal(false); // Tutup modal pilihan agar kotak "Cancel" & "Pilih Filter Dulu" hilang!
      setIsFilterDeleteLocked(true);   // Aktifkan banner oranye & lock screen
      setIsCategoryDropdownOpen(true); // Bukain dropdown kategori
      return;
    }

    // Jika SUDAH ada filter aktif:
    let filterDetails = [];
    if (filterType !== 'all') {
      const typeText = filterType === 'income' ? t.filterInc : t.filterExp;
      filterDetails.push(`${t.filterTypeLabel}: ${typeText}`);
    }
    if (filterCategory.length > 0) {
      filterDetails.push(`${t.filterCatLabel}: ${filterCategory.join(', ')}`);
    }
    if (dateFrom || dateTo) {
      filterDetails.push(`${t.filterPeriodLabel}: ${dateFrom || '...'} ${t.labelTo || 's/d'} ${dateTo || '...'}`);
    }
    if (searchQuery) {
      filterDetails.push(`${t.filterSearchLabel}: "${searchQuery}"`);
    }

    const filterText = `\n\n${t.activeFiltersLabel}:\n• ${filterDetails.join('\n• ')}`;
    const mainConfirmText = t.confirmDelFiltered || t.confirmDel || '';
    const confirmMsg = `${mainConfirmText}\n${t.countToDelete}: ${filteredTransactions.length}.${filterText}`;

    if (!(await showConfirm(confirmMsg))) return;

    try {
      const idsToDelete = filteredTransactions.map(tr => tr.id);
      const statements = idsToDelete.map(id => ({
        sql: `DELETE FROM transactions WHERE id = ?`,
        args: [id]
      }));

      await turso.batch(statements, "write");

      setTransactions(prev => prev.filter(tr => !idsToDelete.includes(tr.id)));
      setShowDeleteChoiceModal(false);
      setIsFilterDeleteLocked(false);
      alert(t.successDelete);
    } catch (error) {
      alert(t.failDelete + error.message);
    }
  };
     
  const compressImage = (file, maxWidth = 800, quality = 0.7) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      try {
        const compressedDataUrl = await compressImage(file, 1200, 0.8);
        setEditingTrx({ ...editingTrx, receipt_image: compressedDataUrl });
      } catch (err) {
        console.error('Gagal mengompresi gambar:', err);
        alert('Gagal memproses gambar struk.');
      }
    }
  };

  const handleRemoveReceipt = () => {
    setEditingTrx({ ...editingTrx, receipt_image: null });
    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
  };
    
  const handleSaveEdit = async () => {
    if (!editingTrx) return;

    // 1. Ambil nilai kategori secara presisi & aman dari mode custom/preset
    const finalCatValue = editingTrx.isCustom
      ? (editingTrx.customCategory || editingTrx.category)
      : (editingTrx.category || editingTrx.customCategory);

    if (!finalCatValue || String(finalCatValue).trim() === '') {
      alert(t.warningMsg);
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const standardCategory = getStandardCategoryValue(finalCatValue, editingTrx.type, editingTrx.isCustom);

      // 2. Normalisasi Format Tanggal & Jam (YYYY-MM-DD HH:mm:ss)
      const rawDateOnly = editingTrx.dateOnly ? editingTrx.dateOnly.split(' ')[0] : new Date().toISOString().split('T')[0];
      const editTimePart = editingTrx.timeOnly
        ? (editingTrx.timeOnly.length === 5 ? `${editingTrx.timeOnly}:00` : editingTrx.timeOnly)
        : '12:00:00';
      const fullDateTime = `${rawDateOnly} ${editTimePart}`;

      let editWarrantyExpiry = null;
      const isExp = normalizeType(editingTrx.type) === 'expense';
      const activeMonths = editingTrx.isCustomWarrantyMonths
        ? (parseInt(editingTrx.customWarrantyInput) || 0)
        : parseInt(editingTrx.warranty_months || 12);

      if (editingTrx.has_warranty && isExp) {
        editWarrantyExpiry = calculateWarrantyExpiry(rawDateOnly, activeMonths);
      }

      const isAssetVal = (editingTrx.type === 'expense' && editingTrx.expense_nature === 'asset') ? 1 : 0;
      const expenseNatureVal = editingTrx.type === 'income'
        ? (editingTrx.expense_nature || 'salary')
        : (editingTrx.expense_nature || 'operational');

      // 3. Clean Nominal
      const cleanAmount = parseFloat(String(editingTrx.amount).replace(/[^0-9.]/g, '')) || 0;

      // 4. FIX ID: Ambil target ID (UUID String)
      const targetId = editingTrx.id;
      if (!targetId || String(targetId).startsWith('trx-fallback-')) {
        alert('Gagal update: ID Transaksi tidak valid / tidak ditemukan.');
        return;
      }

      // Buat objek data terbarui
      const updatedData = {
        id: String(targetId),
        user_id: currentUser.uid,
        type: editingTrx.type,
        expense_nature: expenseNatureVal,
        category: standardCategory,
        amount: cleanAmount,
        currency: editingTrx.currency || mainCurrency,
        payment_method: editingTrx.payment_method || 'Cash',
        note: editingTrx.note || '',
        date: fullDateTime,
        receipt_image: editingTrx.receipt_image || null,
        has_warranty: editingTrx.has_warranty && isExp ? 1 : 0,
        warranty_months: editingTrx.has_warranty && isExp ? activeMonths : 0,
        warranty_expiry: editWarrantyExpiry,
        is_asset: isAssetVal
      };

      // 🚀 1. UPDATE DB LOKAL DULU (Instan & Berhasil Offline/Online)
      const db = await initDB();
      await db.put('transactions', updatedData);

      // 🚀 2. COBA KIRIM KE TURSO (SAFE FALLBACK)
      let isSyncedToTurso = false;
      if (navigator.onLine) {
        try {
          // QUERY LEBIH BERSIH & PRESISI (Langsung pakai WHERE id = ?)
          const updateRes = await turso.execute({
            sql: `UPDATE transactions 
                  SET type = ?, expense_nature = ?, category = ?, amount = ?, currency = ?, payment_method = ?, note = ?, date = ?, receipt_image = ?,
                      has_warranty = ?, warranty_months = ?, warranty_expiry = ?, is_asset = ?
                  WHERE id = ? AND user_id = ?`,
            args: [
              updatedData.type,
              updatedData.expense_nature,
              updatedData.category,
              updatedData.amount,
              updatedData.currency,
              updatedData.payment_method,
              updatedData.note,
              updatedData.date,
              updatedData.receipt_image,
              updatedData.has_warranty,
              updatedData.warranty_months,
              updatedData.warranty_expiry,
              updatedData.is_asset,
              updatedData.id,
              currentUser.uid
            ]
          });

          if (updateRes.rowsAffected > 0) {
            console.log('Update Result Affected Rows:', updateRes.rowsAffected);
          }
          isSyncedToTurso = true;
        } catch (tursoErr) {
          console.warn('📱 Turso edit gagal / koneksi terputus. Masukkan ke Sync Queue:', tursoErr.message);
        }
      }

      // 🚀 3. JIKA OFFLINE ATAU TURSO GAGAL -> MASUKKAN KE QUEUE
      if (!isSyncedToTurso) {
        await addToSyncQueue('UPDATE', 'transactions', updatedData);
      }

      alert(t.successUpdate);
      setEditingTrx(null);
      await fetchTransactions(); // Refresh data dari DB lokal
    } catch (error) {
      console.error('Gagal memperbarui transaksi:', error);
      alert(t.failUpdate + error.message);
    }
  };
  
   const currencySymbol = getCurrencySymbolDynamic(mainCurrency);

  // Toggle Filter Kategori (Multi-select)
  const toggleCategoryFilter = (cat) => {
    setFilterCategory((prev) =>
      prev.includes(cat) ? prev.filter((item) => item !== cat) : [...prev, cat]
    );
  };

  // Calculation: totalIncome, totalExpense, totalRemaining
  const { totalIncome, totalExpense, totalRemaining } = useMemo(() => {
    let inc = 0;
    let exp = 0;

    filteredTransactions.forEach((trx) => {
      const isInc = normalizeType(trx.type) === 'income';
      const amt = convertCurrency(trx.amount, trx.currency, mainCurrency);
      if (isInc) {
        inc += amt;
      } else {
        exp += amt;
      }
    });

    return {
      totalIncome: inc,
      totalExpense: exp,
      totalRemaining: inc - exp
    };
  }, [filteredTransactions, mainCurrency]);

  const exportToPDF = async () => {
    if (!isExportUnlocked) {
      triggerLockedExportToast();
      return;
    }
    try {
      let rowsHtml = '';
      filteredTransactions.forEach(tr => {
        const isInc = normalizeType(tr.type) === 'income';
        const amt = convertCurrency(tr.amount, tr.currency, mainCurrency);
        const amtText = `${isInc ? '+' : '-'}${currencySymbol}${amt.toLocaleString()}`;
        const timeStr = formatTimeByLang(tr.date);
        const fullDateDisplay = timeStr ? `${formatDateByLang(tr.date)} ${timeStr}` : formatDateByLang(tr.date);

        rowsHtml += `
          <tr>
            <td>${fullDateDisplay}</td>
            <td>${isInc ? expT.income : expT.expense}</td>
            <td>${getTranslatedCategory(tr.category, language)}</td>
            <td style="text-align: right; color: ${isInc ? '#10b981' : '#f43f5e'}; font-weight: bold;">${amtText}</td>
            <td>${getPaymentMethodLabel(tr.payment_method, language)}</td>
            <td>${tr.note || ''}</td>
          </tr>
        `;
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="${language}">
        <head>
          <meta charset="UTF-8">
          <title>${expT.reportTitle}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #111; }
            h2 { margin-bottom: 5px; text-align: center; }
            .summary { text-align: center; margin-bottom: 15px; font-size: 13px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ccc; padding: 8px 10px; font-size: 12px; }
            th { background-color: #f2f2f2; font-weight: bold; text-align: left; }
            .footer-watermark { text-align: center; margin-top: 25px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; font-weight: 600; }
          </style>
        </head>
        <body>
          <h2>${expT.reportTitle}</h2>
          <div class="summary">
            ${expT.income}: +${currencySymbol}${totalIncome.toLocaleString()} | 
            ${expT.expense}: -${currencySymbol}${totalExpense.toLocaleString()} | 
            ${expT.remaining}: ${totalRemaining < 0 ? '-' : '+'}${currencySymbol}${Math.abs(totalRemaining).toLocaleString()}
          </div>
          <table>
            <thead>
              <tr>
                <th>${expT.date}</th>
                <th>${expT.type}</th>
                <th>${expT.category}</th>
                <th style="text-align: right;">${expT.amount}</th>
                <th>${expT.method}</th>
                <th>${expT.note}</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="footer-watermark">
            ${expT.printedBy}
          </div>
        </body>
        </html>
      `;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      await downloadFileBlob(blob, `WGen_Transaksi_${new Date().toISOString().slice(0, 10)}.html`);
      alert(t.successExport);
    } catch (err) { 
      console.error("Error PDF:", err); 
      alert(t.failPdf); 
    }
  };

  const exportDetailedReceiptsPDF = async () => {
    if (!isExportUnlocked) {
      triggerLockedExportToast();
      return;
    }
    try {
      let cardsHtml = '';
      filteredTransactions.forEach(tr => {
        const isInc = normalizeType(tr.type) === 'income';
        const amt = convertCurrency(tr.amount, tr.currency, mainCurrency);
        const amtText = `${isInc ? '+' : '-'}${currencySymbol}${amt.toLocaleString()}`;
        const paymentLabel = getPaymentMethodLabel(tr.payment_method, language);
        const categoryLabel = getTranslatedCategory(tr.category, language);
        const typeLabel = isInc ? expT.income : expT.expense;
        const colorStyle = isInc ? '#10b981' : '#f43f5e';
        const timeStr = formatTimeByLang(tr.date);
        const fullDateDisplay = timeStr ? `${formatDateByLang(tr.date)} ${timeStr}` : formatDateByLang(tr.date);

        cardsHtml += `
          <div class="receipt-card">
            <div class="card-header">
              <span class="badge" style="background-color: ${colorStyle};">${typeLabel}</span>
              <span class="date">${fullDateDisplay}</span>
            </div>
            <div class="card-body">
              <div class="row">
                <span class="label">${expT.category}:</span>
                <span class="value font-bold">${categoryLabel}</span>
              </div>
              <div class="row">
                <span class="label">${expT.amount}:</span>
                <span class="value amount" style="color: ${colorStyle};">${amtText}</span>
              </div>
              <div class="row">
                <span class="label">${expT.method}:</span>
                <span class="value">${paymentLabel}</span>
              </div>
              ${tr.note ? `
              <div class="row">
                <span class="label">${expT.note}:</span>
                <span class="value">${tr.note}</span>
              </div>` : ''}
              ${tr.has_warranty ? `
              <div class="row">
                <span class="label">${t.warrantyBadge}:</span>
                <span class="value" style="color: #10b981;">🛡️ ${tr.warranty_months} ${t.warrantyMonthUnit} (${tr.warranty_expiry || '-'})</span>
              </div>` : ''}
            </div>
            ${tr.receipt_image ? `
              <div class="receipt-image-container">
                <p class="image-title">${expT.receiptTitle}:</p>
                <img src="${tr.receipt_image}" alt="Receipt" />
              </div>
            ` : ''}
          </div>
        `;
      });

      const fullHtml = `
        <!DOCTYPE html>
        <html lang="${language}">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${expT.reportTitle} Detail Struk</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background-color: #f8fafc; color: #1e293b; }
            h2 { text-align: center; margin-bottom: 5px; color: #0f172a; font-size: 18px; }
            .summary-box { text-align: center; background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 25px; font-size: 13px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
            .receipt-card { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); page-break-inside: avoid; }
            .card-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 12px; }
            .badge { color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
            .date { font-size: 12px; color: #64748b; font-weight: 600; }
            .card-body { display: flex; flex-direction: column; gap: 8px; }
            .row { display: flex; justify-content: space-between; font-size: 13px; }
            .label { color: #64748b; font-weight: 500; }
            .value { font-weight: 600; color: #0f172a; text-align: right; }
            .amount { font-size: 15px; font-weight: 800; }
            .receipt-image-container { margin-top: 14px; border-top: 1px dashed #cbd5e1; padding-top: 12px; text-align: center; }
            .image-title { font-size: 11px; font-weight: bold; color: #64748b; margin-bottom: 8px; text-align: left; }
            .receipt-image-container img { max-width: 100%; max-height: 350px; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; background: #f1f5f9; }
            .footer-watermark { text-align: center; margin-top: 30px; padding-top: 12px; border-top: 1px solid #cbd5e1; font-size: 10px; color: #94a3b8; font-weight: 600; }
          </style>
        </head>
        <body>
          <h2>${expT.reportTitle} ${expT.detailSubtitle}</h2>
          <div class="summary-box">
            ${expT.income}: +${currencySymbol}${totalIncome.toLocaleString()} &nbsp;|&nbsp; 
            ${expT.expense}: -${currencySymbol}${totalExpense.toLocaleString()} &nbsp;|&nbsp; 
            ${expT.remaining}: ${totalRemaining < 0 ? '-' : '+'}${currencySymbol}${Math.abs(totalRemaining).toLocaleString()}
          </div>
          <div class="cards-wrapper">
            ${cardsHtml}
          </div>
          <div class="footer-watermark">
            ${expT.printedBy}
          </div>
        </body>
        </html>
      `;

      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      await downloadFileBlob(blob, `WGen_Detail_Struk_${new Date().toISOString().slice(0, 10)}.html`);
      alert(t.successExport);
    } catch (err) { 
      console.error("Error Detail PDF:", err); 
      alert(t.failDetailPdf); 
    }
  };

  const exportToDocs = async () => {
    if (!isExportUnlocked) {
      triggerLockedExportToast();
      return;
    }
    try {
      const tableHeader = new TableRow({
        tableHeader: true,
        children: [expT.date, expT.type, expT.category, expT.amount, expT.method, expT.note].map(headerText =>
          new TableCell({
            shading: { fill: "F2F2F2" },
            children: [new Paragraph({ children: [new TextRun({ text: headerText, bold: true, size: 20 })] })],
          })
        ),
      });

      const tableRows = filteredTransactions.map(tr => {
        const isInc = normalizeType(tr.type) === 'income';
        const amt = convertCurrency(tr.amount, tr.currency, mainCurrency);
        const amtText = `${isInc ? '+' : '-'}${currencySymbol}${amt.toLocaleString()}`;
        const timeStr = formatTimeByLang(tr.date);
        const fullDateDisplay = timeStr ? `${formatDateByLang(tr.date)} ${timeStr}` : formatDateByLang(tr.date);

        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: fullDateDisplay, size: 18 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: isInc ? expT.income : expT.expense, size: 18 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getTranslatedCategory(tr.category, language), size: 18 })] })] }),
            new TableCell({
              children: [new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: amtText, bold: true, color: isInc ? "10B981" : "F43F5E", size: 18 })]
              })]
            }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getPaymentMethodLabel(tr.payment_method, language), size: 18 })] })] }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tr.note || '-', size: 18 })] })] }),
          ],
        });
      });

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
              children: [new TextRun({ text: expT.reportTitle, bold: true, size: 32 })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
              children: [
                new TextRun({ text: `${expT.income}: +${currencySymbol}${totalIncome.toLocaleString()}  |  `, bold: true, size: 20 }),
                new TextRun({ text: `${expT.expense}: -${currencySymbol}${totalExpense.toLocaleString()}  |  `, bold: true, size: 20 }),
                new TextRun({ text: `${expT.remaining}: ${totalRemaining < 0 ? '-' : '+'}${currencySymbol}${Math.abs(totalRemaining).toLocaleString()}`, bold: true, size: 20 }),
              ],
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [tableHeader, ...tableRows],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 400 },
              children: [new TextRun({ text: expT.printedBy, color: "94A3B8", size: 18 })],
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      await downloadFileBlob(blob, `WGen_Transaksi_${new Date().toISOString().slice(0, 10)}.docx`);
      alert(t.successExport);
    } catch (err) { 
      console.error("Error Docs:", err); 
      alert(t.failDocs); 
    }
  };

  const exportToSpreadsheet = async () => {
    if (!isExportUnlocked) {
      triggerLockedExportToast();
      return;
    }
    try {
      const dataForExcel = filteredTransactions.map(tr => {
        const isInc = normalizeType(tr.type) === 'income';
        const amt = convertCurrency(tr.amount, tr.currency, mainCurrency);
        const finalAmt = isInc ? amt : -amt;
        const timeStr = formatTimeByLang(tr.date);
        const fullDateDisplay = timeStr ? `${formatDateByLang(tr.date)} ${timeStr}` : formatDateByLang(tr.date);

        return {
          [expT.date]: fullDateDisplay,
          [expT.type]: isInc ? expT.income : expT.expense,
          [expT.category]: getTranslatedCategory(tr.category, language),
          [expT.amount]: finalAmt,
          [expT.method]: getPaymentMethodLabel(tr.payment_method, language),
          [expT.note]: tr.note || ''
        };
      });

      dataForExcel.push({});
      dataForExcel.push({
        [expT.date]: `${expT.totalSummary}:`,
        [expT.type]: `${expT.income}: +${currencySymbol}${totalIncome.toLocaleString()} | ${expT.expense}: -${currencySymbol}${totalExpense.toLocaleString()} | ${expT.remaining}: ${totalRemaining < 0 ? '-' : '+'}${currencySymbol}${Math.abs(totalRemaining).toLocaleString()}`
      });

      dataForExcel.push({});
      dataForExcel.push({
        [expT.date]: expT.printedBy
      });

      const ws = XLSX.utils.json_to_sheet(dataForExcel);
      const range = XLSX.utils.decode_range(ws['!ref']);
      const headerKeys = Object.keys(dataForExcel[0]);
      const amountColIndex = headerKeys.indexOf(expT.amount);

      if (amountColIndex !== -1) {
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: amountColIndex });
          const cell = ws[cellRef];
          if (cell && typeof cell.v === 'number') {
            cell.z = `"${currencySymbol.trim()} "#,##0;[Red]-"${currencySymbol.trim()} "#,##0`;
          }
        }
      }

      ws['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 15 }, { wch: 18 }, { wch: 25 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transaksi");

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      await downloadFileBlob(blob, 'WGen_Transaksi.xlsx');
      alert(t.successExport);
    } catch (err) { 
      console.error("Error Excel:", err); 
      alert(t.failExcel); 
    }
  };
  // 🟢 RENDER KARTU TRANSAKSI (VERSION COMPACT / LEBIH TIPIS)
const renderTransactionCard = (trx, index) => {
  const isIncome = normalizeType(trx.type) === 'income';
  const baseAmount = Number(trx.amount) || 0;
  const baseCurr = trx.currency || mainCurrency;
  const convertedAmount = convertCurrency(baseAmount, baseCurr, mainCurrency);
    
  const CategoryIcon = getDynamicCategoryIcon(trx.category, trx.type);
  const translatedCategoryLabel = getTranslatedCategory(trx.category, language);
  const timeFormatted = formatTimeByLang(trx.date);

  return (
    <div key={`${trx.id}-${index}`} className="flex items-start justify-between p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-800 gap-2.5">
      {/* SISI KIRI: ICON + DETAIL */}
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        {/* ICON KATEGORI */}
        <div className={`p-1.5 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5 ${isIncome ? 'bg-emerald-400/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
          <CategoryIcon className="w-4 h-4 shrink-0" />
        </div>

        {/* DETAIL TRANSAKSI */}
        <div className="flex flex-col min-w-0 flex-1">
          {/* BARIS 1: NAMA KATEGORI & BADGE GARANSI */}
          <div className="flex items-center gap-1.5 flex-wrap leading-tight">
            <span className="font-bold text-xs sm:text-sm capitalize truncate text-gray-900 dark:text-white">
              {translatedCategoryLabel}
            </span>
            {trx.receipt_image && <ImageIcon className="w-3 h-3 text-gray-400 shrink-0" title={t.receipt} />}
            
            {trx.has_warranty === 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedWarrantyTrx(trx);
                }}
                className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20 transition cursor-pointer"
                title="Klik untuk lihat detail garansi"
              >
                <ShieldCheck className="w-2.5 h-2.5" />
                <span>{t.warrantyBadge}</span>
              </button>
            )}
          </div>

          {/* BARIS 2: NOMINAL */}
          <div className="leading-snug">
            <span className={`font-black text-xs sm:text-sm tracking-tight ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isIncome ? '+' : '-'}{currencySymbol}{convertedAmount.toLocaleString()}
            </span>
          </div>

          {/* BARIS 3: TANGGAL, JAM & METODE (DABUNG DALAM 1 BARIS COMPACT) */}
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate mt-0.5">
            <span>{formatDateByLang(trx.date)}</span>
            {timeFormatted && (
              <>
                <span>•</span>
                <span>⏰ {timeFormatted}</span>
              </>
            )}
            <span>•</span>
            <span className={`font-semibold ${isIncome ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
              {getPaymentMethodLabel(trx.payment_method, language)}
            </span>
          </div>

          {/* BARIS 4: CATATAN (JIKA ADA) */}
          {trx.note && (
            <p className="text-[10px] text-gray-400 italic line-clamp-1 mt-0.5">
              "{trx.note}"
            </p>
          )}
        </div>
      </div>

      {/* SISI KANAN: TOMBOL AKSI */}
      <div className="flex items-center gap-0.5 flex-shrink-0 self-center pl-1 border-l border-gray-200 dark:border-gray-700/60">
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openCloneModal(trx);
          }} 
          title={t.cloneBtn}
          className="p-1 text-gray-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        {allowEdit && (
          <button 
            type="button"
            onClick={(e) => { 
              e.stopPropagation();
              const currentId = trx.id ?? trx.rowid;
              const expectedType = normalizeType(trx.type);
              const translatedActiveCat = getTranslatedCategory(trx.category, language);
              const isInc = expectedType === 'income';

              let nature = trx.expense_nature;
              if (!nature) {
                if (isInc) {
                  const isNonRoutine = incomeAssetCategories.some(c => normalizeCategoryString(c) === normalizeCategoryString(translatedActiveCat));
                  nature = isNonRoutine ? 'asset' : 'salary';
                } else {
                  const isNonOp = expenseAssetCategories.some(c => normalizeCategoryString(c) === normalizeCategoryString(translatedActiveCat));
                  nature = isNonOp ? 'asset' : 'operational';
                }
              }

              const currentActiveList = isInc
                ? (nature === 'salary' ? incomeRoutineCategories : incomeAssetCategories)
                : (nature === 'asset' ? expenseAssetCategories : expenseRoutineCategories);

              const isStandard = currentActiveList.some(cat => normalizeCategoryString(cat) === normalizeCategoryString(translatedActiveCat));
              const pureDateOnly = trx.date ? trx.date.split(' ')[0] : new Date().toISOString().split('T')[0];
              const pureTimeOnly = (trx.date && trx.date.includes(' ')) ? trx.date.split(' ')[1].substring(0, 5) : '12:00';
              const presetKeys = ['1', '3', '6', '12', '24', '36'];
              const isCustomMonths = trx.warranty_months && !presetKeys.includes(String(trx.warranty_months));

              setEditingTrx({ 
                ...trx,
                id: currentId,
                expense_nature: nature,
                category: isStandard ? translatedActiveCat : '',
                customCategory: isStandard ? '' : trx.category,
                isCustom: !isStandard,
                dateOnly: pureDateOnly,
                timeOnly: pureTimeOnly,
                has_warranty: trx.has_warranty === 1,
                warranty_months: isCustomMonths ? '12' : (String(trx.warranty_months) || '12'),
                isCustomWarrantyMonths: isCustomMonths,
                customWarrantyInput: isCustomMonths ? String(trx.warranty_months) : ''
              }); 
            }}
            className="p-1 text-gray-400 hover:text-emerald-500 transition cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}

        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(trx.id);
          }} 
          title={t.confirmDel}
          className="p-1 text-gray-400 hover:text-rose-500 transition cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
  return (
    <div className="w-full flex flex-col gap-4 relative">
        
      {/* TOAST PERINGATAN 720 TRANSAKSI */}
      {showToastWarning && (
        <div className="fixed top-40 left-4 right-4 max-w-sm mx-auto z-[250] bg-amber-500 text-white p-2.5 sm:p-3 rounded-2xl shadow-xl border border-amber-400 flex items-center gap-2 animate-bounce">
          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-white" />
          <p className="text-[11px] sm:text-xs font-bold leading-snug flex-1">{t.limit720WarnDesc}</p>
          <button onClick={() => setShowToastWarning(false)} className="p-1 rounded-full hover:bg-amber-600 transition cursor-pointer">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {/* TOAST SARAN 96 TRANSAKSI */}
      {show96ToastSuggestion && (
        <div className="fixed top-40 left-4 right-4 max-w-sm mx-auto z-[250] bg-blue-600 text-white p-2.5 sm:p-3 rounded-2xl shadow-xl border border-blue-500 flex items-center gap-2 animate-bounce">
          <Info className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-white" />
          <p className="text-[11px] sm:text-xs font-bold leading-snug flex-1">{t.suggest96Toast}</p>
          <button onClick={() => setShow96ToastSuggestion(false)} className="p-1 rounded-full hover:bg-blue-700 transition cursor-pointer">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {/* TOAST PERINGATAN FITUR EXPORT TERKUNCI */}
      {showExportLockedToast && (
        <div className="fixed top-40 left-4 right-4 max-w-sm mx-auto z-[250] bg-rose-600 text-white p-2.5 sm:p-3 rounded-2xl shadow-xl border border-rose-500 flex items-center gap-2 animate-bounce">
          <Lock className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-white" />
          <p className="text-[11px] sm:text-xs font-bold leading-snug flex-1">{t.exportLockedToast}</p>
          <button onClick={() => setShowExportLockedToast(false)} className="p-1 rounded-full hover:bg-rose-700 transition cursor-pointer">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {!isFilterDeleteLocked && (
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-9 pr-10 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-semibold focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-rose-500 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {!isFilterDeleteLocked && (
          <div className="bg-white dark:bg-gray-900 p-3 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 w-full flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-gray-500">
                <Filter className="w-4 h-4" />
              </div>
              {(filterType !== 'all' || filterCategory.length > 0 || dateFrom !== '' || dateTo !== '' || searchQuery !== '') && (
                <button 
                  onClick={() => { setFilterType('all'); setFilterCategory([]); setDateFrom(''); setDateTo(''); setSearchQuery(''); }}
                  className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" /> {t.resetFilter}
                </button>
              )}
            </div>
              
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{t.labelFrom}:</span>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full bg-transparent text-[10px] sm:text-xs font-semibold focus:outline-none cursor-pointer"/>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{t.labelTo}:</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full bg-transparent text-[10px] sm:text-xs font-semibold focus:outline-none cursor-pointer"/>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select 
                value={filterType} 
                onChange={(e) => { 
                  setFilterType(e.target.value); 
                  setFilterCategory([]); 
                }} 
                className="w-full py-1.5 px-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[11px] sm:text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all">{t.filterAllType}</option>
                <option value="income">{t.filterInc}</option>
                <option value="expense">{t.filterExp}</option>
              </select>

              <div className="relative" ref={categoryDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                  className="w-full py-1.5 px-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[11px] sm:text-xs font-semibold focus:outline-none cursor-pointer flex items-center justify-between text-left"
                >
                  <span className="truncate">
                    {filterCategory.length === 0 
                      ? t.filterAllCat 
                      : filterCategory.length === 1 
                        ? filterCategory[0] 
                        : `${filterCategory.length} ${t.selectedCats}`}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isCategoryDropdownOpen && (
                  <div className="absolute right-0 left-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 p-2 max-h-56 overflow-y-auto">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-100 dark:border-gray-800 px-1">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.catLabel}</span>
                      {filterCategory.length > 0 && (
                        <button
                          onClick={() => setFilterCategory([])}
                          className="text-[10px] text-rose-500 font-bold hover:underline cursor-pointer"
                        >
                          {t.clearAllCats}
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {filterCategoriesList.map((cat) => {
                        const isSelected = filterCategory.includes(cat);
                        const CatIconComp = getDynamicCategoryIcon(cat, filterType);
                        const formattedCatLabel = formatCategoryWithBill(cat, filterType);
                        return (
                          <div
                            key={cat}
                            onClick={() => toggleCategoryFilter(cat)}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition capitalize ${
                              isSelected 
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold' 
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            )}
                            <CatIconComp className="w-3.5 h-3.5 shrink-0 text-gray-500" />
                            <span className="truncate">{formattedCatLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* NEW POSITION: ACTION BUTTONS (DOWNLOAD & DELETE ALL) */}
        {/* ============================================================== */}
        {!isFilterDeleteLocked && (
          <div className="flex justify-end w-full px-1">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button onClick={exportToDocs} title={isExportUnlocked ? "Export Word" : t.exportLockedHint} className={`p-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center cursor-pointer ${isExportUnlocked ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100' : 'bg-gray-200/50 dark:bg-gray-800 text-gray-400 opacity-70 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                {!isExportUnlocked ? <Lock className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5"/>}
              </button>

              <button onClick={exportToSpreadsheet} title={isExportUnlocked ? "Export Spreadsheet" : t.exportLockedHint} className={`p-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center cursor-pointer ${isExportUnlocked ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100' : 'bg-gray-200/50 dark:bg-gray-800 text-gray-400 opacity-70 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                {!isExportUnlocked ? <Lock className="w-3.5 h-3.5" /> : <FileSpreadsheet className="w-3.5 h-3.5"/>}
              </button>

              <button onClick={exportToPDF} title={isExportUnlocked ? "Export PDF Tabel Rekap" : t.exportLockedHint} className={`p-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center cursor-pointer ${isExportUnlocked ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100' : 'bg-gray-200/50 dark:bg-gray-800 text-gray-400 opacity-70 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                {!isExportUnlocked ? <Lock className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5"/>}
              </button>

              <button 
                onClick={exportDetailedReceiptsPDF} 
                title={isExportUnlocked ? "Export PDF Detail Struk Bergambar" : t.exportLockedHint} 
                className={`p-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  isExportUnlocked 
                    ? `bg-gradient-to-br ${currentTheme.btn} text-white shadow-sm hover:opacity-90 px-2` 
                    : 'bg-gray-200/50 dark:bg-gray-800 text-gray-400 opacity-70 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {!isExportUnlocked ? <Lock className="w-3.5 h-3.5" /> : <><FileDown className="w-3.5 h-3.5" /> <span className="text-[9px]">{t.btnReceipt}</span></>}
              </button>
              
              <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-0.5 sm:mx-1"></div>

              {/* TOMBOL SAMPAH HEADER (UNTUK PENGHAPUSAN MASSAL/FILTERED/EVERYTHING) */}
              <button 
                onClick={handleOpenDeleteModal} 
                disabled={transactions.length === 0} 
                title={t.deleteChoiceTitle} 
                className={`p-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center ${
                  transactions.length > 0 
                    ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 cursor-pointer' 
                    : 'bg-gray-200/50 dark:bg-gray-800 text-gray-400 opacity-50 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* NEW POSITION: HEADER UTAMA TRANSAKSI */}
      {/* ============================================================== */}
      <div className="flex items-baseline gap-1.5 px-1 mt-1">
        <h3 className={`text-sm sm:text-base font-extrabold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>
          {t.title}
        </h3>
        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
          ({filteredTransactions.length})
        </span>
      </div>

      {/* SUMMARY TOTAL */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-start gap-1 sm:gap-6 py-2 px-3 w-full my-0.5 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{expT.income}:</span>
          <span className="text-xs sm:text-sm font-extrabold text-emerald-500 truncate">
            +{currencySymbol}{totalIncome.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </span>
        </div>
          
        <div className="hidden sm:block w-px h-4 bg-gray-300 dark:bg-gray-700"></div>
          
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{expT.expense}:</span>
          <span className="text-xs sm:text-sm font-extrabold text-rose-500 truncate">
            -{currencySymbol}{totalExpense.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* DAFTAR TRANSAKSI (RECENT) */}
      <div className="bg-white dark:bg-gray-900 p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 w-full flex flex-col gap-3">
        <div className="flex items-center justify-between pb-1 border-b border-gray-100 dark:border-gray-800">
          
          {/* SISI KIRI: Tombol Toggle Panah + Judul Recent */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRecentMinimized(!isRecentMinimized)}
              className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer flex items-center justify-center text-gray-500 dark:text-gray-400"
              title={isRecentMinimized ? "Maximize (Tampilkan 8)" : "Minimize (Tampilkan 3)"}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isRecentMinimized ? '-rotate-90' : 'rotate-0'}`} />
            </button>

            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.recent}</span>
          </div>

          {/* SISI KANAN: Tombol See All */}
          {filteredTransactions.length > (isRecentMinimized ? 3 : 8) && (
            <button 
              type="button"
              onClick={() => setShowSeeAllModal(true)} 
              className={`text-[11px] sm:text-xs font-extrabold bg-gradient-to-r ${currentTheme?.gradText || 'from-emerald-500 to-teal-500'} bg-clip-text text-transparent hover:opacity-80 transition flex items-center gap-1 cursor-pointer`}
            >
              {t.seeAll} <ArrowRight className={`w-3.5 h-3.5 ${currentTheme?.icon || 'text-emerald-500'}`} />
            </button>
          )}
        </div>

        {displayRecentTransactions.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-3">{t.empty}</p>
        ) : (
          <div className="space-y-2">{displayRecentTransactions.map((trx, index) => renderTransactionCard(trx, index))}</div>
        )}
      </div>
        
      {/* POP-UP DETAIL GARANSI INTERAKTIF */}
      {selectedWarrantyTrx && (() => {
        const purchaseDate = selectedWarrantyTrx.date ? selectedWarrantyTrx.date.split(' ')[0] : '-';
        const expiryDate = selectedWarrantyTrx.warranty_expiry || calculateWarrantyExpiry(purchaseDate, selectedWarrantyTrx.warranty_months);
          
        const today = new Date();
        const expDateObj = new Date(expiryDate);
        const diffTime = expDateObj - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const isExpired = diffDays < 0;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-xs w-full p-4 relative flex flex-col gap-3 shadow-2xl border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in duration-150">
              <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 text-emerald-500">
                  <ShieldCheck className="w-5 h-5" />
                  <h3 className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-white">{t.warrantyDetailTitle}</h3>
                </div>
                <button onClick={() => setSelectedWarrantyTrx(null)} className="p-1 text-gray-400 hover:text-rose-500 transition cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-gray-400 font-medium block text-[10px]">{t.catLabel}</span>
                  <p className="font-bold text-gray-800 dark:text-gray-200 capitalize">
                    {getTranslatedCategory(selectedWarrantyTrx.category, language)} {selectedWarrantyTrx.note ? `(${selectedWarrantyTrx.note})` : ''}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-200/60 dark:border-gray-700/50">
                  <div>
                    <span className="text-gray-400 font-medium block text-[10px]">{t.purchaseDateLabel}</span>
                    <p className="font-bold">{formatDateByLang(purchaseDate)}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 font-medium block text-[10px]">{t.warrantyDuration}</span>
                    <p className="font-bold">{selectedWarrantyTrx.warranty_months} {t.warrantyMonthUnit}</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl border flex flex-col gap-1 text-center justify-center bg-emerald-500/5 border-emerald-500/20">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t.warrantyValidUntil}</span>
                  <p className="text-sm font-black text-emerald-500">{formatDateByLang(expiryDate)}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit mx-auto mt-1 ${isExpired ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                    {isExpired ? t.warrantyExpired : `${t.warrantyRemaining} ${diffDays} ${t.daysLeftUnit}`}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    const tr = selectedWarrantyTrx;
                    setSelectedWarrantyTrx(null);
                      
                    const translatedActiveCat = getTranslatedCategory(tr.category, language);
                    const dateParts = tr.date ? tr.date.split(' ') : ['', ''];
                      
                    const presetKeys = ['1', '3', '6', '12', '24', '36'];
                    const isCustomMonths = tr.warranty_months && !presetKeys.includes(String(tr.warranty_months));

                    setEditingTrx({
                      ...tr,
                      expense_nature: tr.expense_nature || (expenseAssetCategories.includes(translatedActiveCat) ? 'asset' : 'operational'),
                      category: translatedActiveCat,
                      customCategory: '',
                      isCustom: false,
                      dateOnly: dateParts[0],
                      timeOnly: dateParts[1] ? dateParts[1].substring(0, 5) : '12:00',
                      has_warranty: true,
                      warranty_months: isCustomMonths ? '12' : (String(tr.warranty_months) || '12'),
                      isCustomWarrantyMonths: isCustomMonths,
                      customWarrantyInput: isCustomMonths ? String(tr.warranty_months) : ''
                    });
                  }}
                  className={`w-full py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r ${currentTheme.btn} shadow-md hover:opacity-90 transition cursor-pointer flex items-center justify-center gap-1.5`}
                >
                  <Edit3 className="w-3.5 h-3.5" /> {t.editWarrantyBtn}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* POP-UP SEE ALL TRANSACTIONS */}
      {showSeeAllModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex flex-col justify-end">
          <div className="w-full max-w-3xl mx-auto bg-gray-50 dark:bg-gray-950 rounded-t-2xl flex flex-col overflow-hidden shadow-2xl h-[calc(100vh-3.5rem)] mt-3.5">
            <div className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-3.5 px-4 flex items-start justify-between border-b border-gray-200 dark:border-gray-800 z-10 shadow-sm shrink-0 gap-3">
              {/* SISI KIRI: Judul & Rincian Total Berurutan */}
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                {/* Baris Judul */}
                <div className="flex items-center gap-2">
                  <ReceiptText className={`w-4 h-4 ${currentTheme.icon} shrink-0`} />
                  <span className={`text-xs sm:text-sm font-extrabold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent truncate`}>
                    {t.allTxTitle} ({filteredTransactions.length})
                  </span>
                </div>

                {/* Baris Angka: Masing-masing dapat baris sendiri (Vertikal Rapi & Lega) */}
                <div className="flex flex-col gap-0.5 text-[10px] sm:text-xs font-extrabold pl-6">
                  {totalIncome > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400 font-semibold">{expT.income}:</span>
                      <span className="text-emerald-500 truncate">
                        +{currencySymbol}{totalIncome.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {totalExpense > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400 font-semibold">{expT.expense}:</span>
                      <span className="text-rose-500 truncate">
                        -{currencySymbol}{totalExpense.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* SISI KANAN: Tombol Silang (Tetap di Pojok Kanan Atas) */}
              <button
                type="button"
                onClick={() => setShowSeeAllModal(false)}
                className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-rose-100 hover:text-rose-500 text-gray-500 dark:text-gray-400 transition shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain">
              {filteredTransactions.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-3">{t.empty}</p>
              ) : (
                filteredTransactions.map((trx, index) => renderTransactionCard(trx, index))
              )}
            </div>
          </div>
        </div>
      )}

      {/* POP-UP PILIHAN DUPLIKAT TRANSAKSI */}
      {cloningTrx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[160] flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-xl max-w-xs w-full p-4 relative flex flex-col gap-3 shadow-xl border border-gray-200 dark:border-gray-800 my-auto">
            <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-gray-800">
              <h3 className="font-extrabold text-xs sm:text-sm flex items-center gap-1.5 text-gray-900 dark:text-white">
                <Copy className={`w-4 h-4 ${currentTheme.icon}`} />
                {t.cloneTitle}
              </h3>
              <button onClick={() => setCloningTrx(null)} className="p-1 text-gray-400 hover:text-rose-500 transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              {getTranslatedCategory(cloningTrx.category, language)} • {currencySymbol}{convertCurrency(cloningTrx.amount, cloningTrx.currency, mainCurrency).toLocaleString()}
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">{t.dateLabel}</label>
                
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setCloneTargetDate(new Date().toISOString().slice(0, 10))}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                    cloneTargetDate === new Date().toISOString().slice(0, 10)
                      ? `bg-gradient-to-br ${currentTheme.btn} text-white border-transparent`
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {t.cloneToday}
                </button>

                <button
                  type="button"
                  onClick={() => setCloneTargetDate(getNextMonthDate(cloningTrx.date))}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                    cloneTargetDate === getNextMonthDate(cloningTrx.date)
                      ? `bg-gradient-to-br ${currentTheme.btn} text-white border-transparent`
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {t.cloneNextMonth}
                </button>
              </div>

              <div className="pt-1">
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <input
                    type="date"
                    value={cloneTargetDate}
                    onChange={(e) => setCloneTargetDate(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-gray-900 dark:text-white focus:outline-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={handleExecuteClone}
                disabled={!cloneTargetDate}
                className={`flex-1 font-bold py-2 rounded-lg transition text-xs shadow-sm cursor-pointer ${
                  cloneTargetDate 
                    ? `bg-gradient-to-br ${currentTheme.btn} text-white` 
                    : 'bg-gray-300 dark:bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
              >
                {t.cloneSubmit}
              </button>
              <button
                type="button"
                onClick={() => setCloningTrx(null)}
                className="px-3 bg-gray-200 dark:bg-gray-700 font-bold py-2 rounded-lg transition text-xs text-gray-700 dark:text-gray-200 hover:opacity-80 cursor-pointer"
              >
                {t.cancelBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP EDIT TRANSAKSI */}
      {editingTrx && (() => {
        const selectedEditCategoryValue = editingTrx.isCustom ? editingTrx.customCategory : editingTrx.category;
        const isCatSelected = selectedEditCategoryValue && String(selectedEditCategoryValue).trim() !== '';
        const isExpense = normalizeType(editingTrx.type) === 'expense';
        const isIncome = normalizeType(editingTrx.type) === 'income';

        const activeEditCategories = isIncome
          ? ((editingTrx.expense_nature || 'salary') === 'salary' ? incomeRoutineCategories : incomeAssetCategories)
          : ((editingTrx.expense_nature || 'operational') === 'asset' ? expenseAssetCategories : expenseRoutineCategories);
          
        const activeEditWarrantyMonths = editingTrx.isCustomWarrantyMonths ? (parseInt(editingTrx.customWarrantyInput) || 0) : parseInt(editingTrx.warranty_months || 12);
        const calculatedEditExpiry = editingTrx.has_warranty && isExpense ? calculateWarrantyExpiry(editingTrx.dateOnly, activeEditWarrantyMonths) : null;

        return (
          // <-- DIUBAH: Pembungkus utama dibuat full screen (w-full h-full, tanpa padding luar & tanpa rounded)
          <div className="fixed inset-0 bg-white dark:bg-gray-900 z-[150] flex flex-col w-full h-full overflow-hidden">
            
            {/* <-- DIUBAH: Header Sticky di bagian atas layar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-900">
              <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white">{t.editTitle}</h3>
              
            </div>

            {/* <-- DIUBAH: Area konten form dibuat scrollable penuh ke bawah */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 max-w-2xl w-full mx-auto">
                
              {/* BLOK SIFAT PENGELUARAN */}
              {isExpense && (
                <div className="flex flex-col gap-1.5 p-2 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700/50">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{t.expenseNatureLabel}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingTrx({ ...editingTrx, expense_nature: 'operational', category: '', customCategory: '', isCustom: false })}
                      className={`p-2 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                        (editingTrx.expense_nature || 'operational') === 'operational'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold shadow-sm'
                          : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="text-[10px] font-bold flex items-center gap-1">
                        <Zap className="w-3 h-3 flex-shrink-0" />
                        {t.opCostTitle}
                      </span>
                      <span className="text-[8px] opacity-75 mt-0.5 leading-tight">{t.opCostDesc}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingTrx({ ...editingTrx, expense_nature: 'asset', category: '', customCategory: '', isCustom: false })}
                      className={`p-2 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                        editingTrx.expense_nature === 'asset'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold shadow-sm'
                          : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="text-[10px] font-bold flex items-center gap-1">
                        <Landmark className="w-3 h-3 flex-shrink-0" />
                        {t.assetCostTitle}
                      </span>
                      <span className="text-[8px] opacity-75 mt-0.5 leading-tight">{t.assetCostDesc}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* BLOK SIFAT PEMASUKAN */}
              {isIncome && (
                <div className="flex flex-col gap-1.5 p-2 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700/50">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{t.incomeNatureLabel}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingTrx({ ...editingTrx, expense_nature: 'salary', category: '', customCategory: '', isCustom: false })}
                      className={`p-2 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                        (editingTrx.expense_nature || 'salary') === 'salary'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm'
                          : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="text-[10px] font-bold flex items-center gap-1">
                        <TrendingUpIcon className="w-3 h-3 flex-shrink-0 text-emerald-500" />
                        {t.salaryIncome}
                      </span>
                      <span className="text-[8px] opacity-75 mt-0.5 leading-tight">{t.salarySub}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingTrx({ ...editingTrx, expense_nature: 'asset', category: '', customCategory: '', isCustom: false })}
                      className={`p-2 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                        editingTrx.expense_nature === 'asset'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm'
                          : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="text-[10px] font-bold flex items-center gap-1">
                        <Coins className="w-3 h-3 flex-shrink-0 text-amber-300" />
                        {t.assetIncome}
                      </span>
                      <span className="text-[8px] opacity-75 mt-0.5 leading-tight">{t.assetIncomeSub}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Grid Tanggal & Waktu Edit */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 block">{t.dateLabel}</label>
                  <input type="date" value={editingTrx.dateOnly || ''} onChange={(e) => setEditingTrx({ ...editingTrx, dateOnly: e.target.value })} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-medium focus:outline-none cursor-pointer" required />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 block">{t.timeLabel}</label>
                  <input type="time" value={editingTrx.timeOnly || ''} onChange={(e) => setEditingTrx({ ...editingTrx, timeOnly: e.target.value })} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-medium focus:outline-none cursor-pointer" required />
                </div>
              </div>

              {/* Kategori dengan Toggle Custom Presisi */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{t.catLabel}</label>
                  <button
                    type="button"
                    onClick={() => setEditingTrx({ ...editingTrx, isCustom: !editingTrx.isCustom, category: '', customCategory: '' })}
                    className={`text-[10px] font-bold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent hover:opacity-80 transition cursor-pointer`}
                  >
                    {editingTrx.isCustom ? t.selectToggle : t.customToggle}
                  </button>
                </div>

               {editingTrx.isCustom ? (
                 <input
                  type="text"
                  value={editingTrx.customCategory || ''}
                  onChange={(e) => setEditingTrx({ 
                    ...editingTrx, 
                    customCategory: e.target.value,
                    category: e.target.value
                  })}
                  placeholder={t.customPlaceholder}
                  className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-bold focus:outline-none"
                  autoFocus
                  required
                />
                ) : (
                  // <-- DIUBAH: max-h-28 dihapus agar daftar kategori tampil penuh tanpa terpotong di layar penuh
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {activeEditCategories.map((catItem) => {
                      const CatIconComp = getDynamicCategoryIcon(catItem, editingTrx.type);
                      const formattedDisplayLabel = formatCategoryWithBill(catItem, editingTrx.type);
                      const isSelected = normalizeCategoryString(editingTrx.category) === normalizeCategoryString(catItem);
                      return (
                        <button 
                          key={catItem} 
                          type="button" 
                          onClick={() => setEditingTrx({ 
                            ...editingTrx, 
                            category: catItem, 
                            customCategory: '', 
                            isCustom: false 
                          })} 
                          className={`py-2 px-2.5 rounded-lg text-[10px] font-bold border transition text-left capitalize flex items-center gap-1.5 cursor-pointer ${isSelected ? `bg-gradient-to-br ${currentTheme.btn} text-white border-transparent` : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'}`}
                        >     
                          <CatIconComp className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{formattedDisplayLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 block">
                  {t.nominalLabel} ({mainCurrency})
                </label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={formatNumberWithSeparator(editingTrx.amount)} 
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/\D/g, '');
                    setEditingTrx({ ...editingTrx, amount: rawValue });
                  }} 
                  disabled={!isCatSelected} 
                  placeholder={isCatSelected ? "0" : "Pilih kategori..."} 
                  className={`w-full p-2 rounded-lg border text-xs font-bold focus:outline-none transition ${
                    isCatSelected 
                      ? 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white' 
                      : 'border-gray-200 dark:border-gray-800 bg-gray-200/50 dark:bg-gray-900/50 text-gray-400 cursor-not-allowed'
                  }`} 
                />
                {!isCatSelected && (
                  <p className="text-[9px] text-amber-500 mt-0.5 font-medium">
                    {t.warningMsg}
                  </p>
                )}
              </div>

              {/* OPTION GARANSI DI POPUP EDIT */}
              {isExpense && (
                <div className="flex flex-col gap-1.5 p-2 bg-gray-100/80 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50">
                  <label className="flex items-center justify-between cursor-pointer text-[10px] font-bold text-gray-700 dark:text-gray-300">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className={`w-3.5 h-3.5 ${editingTrx.has_warranty ? 'text-emerald-500' : 'text-gray-400'}`} />
                      {t.warrantyLabel}
                    </span>
                    <input
                      type="checkbox"
                      checked={!!editingTrx.has_warranty}
                      onChange={(e) => setEditingTrx({ ...editingTrx, has_warranty: e.target.checked })}
                      className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
                    />
                  </label>

                  {editingTrx.has_warranty && (
                    <div className="flex flex-col gap-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-700/60">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">{t.warrantyDuration}</span>
                        <button
                          type="button"
                          onClick={() => setEditingTrx({ ...editingTrx, isCustomWarrantyMonths: !editingTrx.isCustomWarrantyMonths })}
                          className={`text-[9px] font-bold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent hover:opacity-80 transition cursor-pointer`}
                        >
                          {editingTrx.isCustomWarrantyMonths ? t.warrantySelectToggle : t.warrantyCustomToggle}
                        </button>
                      </div>

                      {editingTrx.isCustomWarrantyMonths ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            value={editingTrx.customWarrantyInput || ''}
                            onChange={(e) => setEditingTrx({ 
                              ...editingTrx, 
                              customWarrantyInput: e.target.value // <-- PERBAIKAN BUG: sebelumnya salah menulis customCategory & category
                            })}
                            placeholder="18"
                            className="w-full p-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-[10px] font-bold focus:outline-none"
                            autoFocus
                          />
                          <span className="text-[10px] font-bold text-gray-500 whitespace-nowrap">{t.warrantyMonthUnit}</span>
                        </div>
                      ) : (
                        <select
                          value={editingTrx.warranty_months || 12}
                          onChange={(e) => setEditingTrx({ ...editingTrx, warranty_months: e.target.value })}
                          className="w-full p-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-[10px] font-bold focus:outline-none cursor-pointer"
                        >
                          {Object.entries(t.warrantyOptions).map(([m, label]) => (
                            <option key={m} value={m}>{label}</option>
                          ))}
                        </select>
                      )}

                      {calculatedEditExpiry && (
                        <div className="flex items-center justify-between text-[9px] font-bold pt-1 px-1 text-emerald-600 dark:text-emerald-400">
                          <span>{t.warrantyValidUntil}:</span>
                          <span className="bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                            🛡️ {calculatedEditExpiry} ({activeEditWarrantyMonths} {t.warrantyMonthUnit})
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 block">{t.payLabel}</label>
                <select value={editingTrx.payment_method || 'Cash'} onChange={(e) => setEditingTrx({ ...editingTrx, payment_method: e.target.value })} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold focus:outline-none cursor-pointer">
                  {["Cash", "Credit Card", "Bank Transfer", "E-Wallet"].map(pm => (
                    <option key={pm} value={pm}>{paymentMethodsMap[language]?.[pm] || pm}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 block">{t.note}</label>
                <input type="text" value={editingTrx.note || ''} onChange={(e) => setEditingTrx({ ...editingTrx, note: e.target.value })} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 block">{t.receipt}</label>
                {editingTrx.receipt_image ? (
                  <div className="relative w-full h-24 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden flex items-center justify-center">
                    <img src={editingTrx.receipt_image} alt="Struk" className="object-contain w-full h-full" />
                    <button type="button" onClick={handleRemoveReceipt} className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-md hover:bg-rose-600 transition cursor-pointer" title={t.removeReceipt}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current && editFileInputRef.current.click()} 
                      className="w-full p-2 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                    >
                      <Camera className="w-5 h-5 text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{t.uploadReceipt}</span>
                    </button>
                    <input 
                      type="file" 
                      accept="image/*" 
                      ref={editFileInputRef} 
                      className="hidden" 
                      onChange={handleImageChange}
                    />
                  </div>
                )}
              </div>

            </div> {/* <-- DIUBAH: Penutup area scroll */}

            {/* <-- DIUBAH: Footer Sticky di bagian paling bawah layar */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
              <div className="flex gap-2 max-w-2xl w-full mx-auto">
                <button 
                  type="button" 
                  onClick={handleSaveEdit} 
                  disabled={!isCatSelected} 
                  className={`flex-1 font-bold py-2.5 rounded-xl transition text-xs sm:text-sm shadow-sm cursor-pointer ${isCatSelected ? `bg-gradient-to-br ${currentTheme.btn} text-white` : 'bg-gray-300 dark:bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                >
                  {t.saveBtn}
                </button>
                <button 
                  type="button" 
                  onClick={() => setEditingTrx(null)} 
                 className="px-5 bg-rose-500/15 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/30 font-bold py-2.5 rounded-xl transition text-xs sm:text-sm cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
              </div>
            </div>

          </div>
        );
      })()}

      {/* POP-UP PILIHAN OPSIONAL HAPUS DATA */}
      {showDeleteChoiceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[180] flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-xs w-full p-4 relative flex flex-col gap-3 shadow-2xl border border-gray-200 dark:border-gray-800 my-auto animate-in fade-in zoom-in duration-150">
            
            <div className="flex items-center justify-between border-b pb-2 border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 text-rose-500">
                <Trash2 className="w-4 h-4" />
                <h3 className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-white">
                  {t.deleteChoiceTitle}
                </h3>
              </div>
              <button 
                onClick={() => setShowDeleteChoiceModal(false)} 
                className="p-1 text-gray-400 hover:text-rose-500 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              {t.deleteChoiceDesc}
            </p>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleConfirmDeleteFiltered}
                className="p-2.5 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-left flex flex-col gap-1 transition cursor-pointer"
              >
                <span className="text-[11px] font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1">🔍 {t.deleteFilteredOpt}</span>
                  <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-full font-mono">
                    {filteredTransactions.length}
                  </span>
                </span>
                <span className="text-[9px] opacity-80 leading-tight">
                  {t.deleteFilteredDesc}
                </span>
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteEverything}
                className="p-2.5 rounded-xl border border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 text-left flex flex-col gap-1 transition cursor-pointer"
              >
                <span className="text-[11px] font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1">⚠️ {t.deleteAllOpt}</span>
                  <span className="text-[10px] bg-rose-500/20 px-2 py-0.5 rounded-full font-mono">
                    {transactions.length}
                  </span>
                </span>
                <span className="text-[9px] opacity-80 leading-tight">
                  {t.deleteAllDesc}
                </span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* OVERLAY KUNCI FILTER */}
      {isFilterDeleteLocked && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[190] flex flex-col items-center justify-start pt-14 sm:pt-16 px-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="max-w-md w-full flex flex-col gap-3">
            
            <div className="bg-amber-500 text-white p-3.5 rounded-2xl shadow-2xl border border-amber-400 flex items-center justify-between gap-2 animate-bounce">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Filter className="w-5 h-5 flex-shrink-0 text-white" />
                <p className="text-[11px] sm:text-xs font-extrabold leading-snug">
                  {t.filterLockBanner}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setFilterType('all');
                  setFilterCategory([]);
                  setDateFrom('');
                  setDateTo('');
                  setSearchQuery('');

                  setIsFilterDeleteLocked(false);
                  setIsCategoryDropdownOpen(false);
                }}
                className="px-3 py-1.5 bg-black/25 hover:bg-black/40 text-white font-extrabold rounded-xl text-xs transition cursor-pointer shrink-0 flex items-center gap-1 border border-white/20"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t.cancelBtn}</span>
              </button>
            </div>

            <div className="relative w-full shadow-2xl ring-4 ring-amber-500 rounded-xl bg-white dark:bg-gray-900">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-xs font-semibold focus:outline-none"
              />
            </div>

            <div className="bg-white dark:bg-gray-900 p-3 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full flex flex-col gap-2 ring-4 ring-amber-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Filter className="w-4 h-4" />
                </div>
                {(filterType !== 'all' || filterCategory.length > 0 || dateFrom !== '' || dateTo !== '' || searchQuery !== '') && (
                  <button 
                    onClick={() => { setFilterType('all'); setFilterCategory([]); setDateFrom(''); setDateTo(''); setSearchQuery(''); }}
                    className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" /> {t.resetFilter}
                  </button>
                )}
              </div>
                
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{t.labelFrom}:</span>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full bg-transparent text-[10px] sm:text-xs font-semibold focus:outline-none cursor-pointer"/>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{t.labelTo}:</span>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full bg-transparent text-[10px] sm:text-xs font-semibold focus:outline-none cursor-pointer"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select 
                  value={filterType} 
                  onChange={(e) => { 
                    setFilterType(e.target.value); 
                    setFilterCategory([]); 
                  }} 
                  className="w-full py-1.5 px-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[11px] sm:text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all">{t.filterAllType}</option>
                  <option value="income">{t.filterInc}</option>
                  <option value="expense">{t.filterExp}</option>
                </select>

                <div className="relative" ref={categoryDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                    className="w-full py-1.5 px-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[11px] sm:text-xs font-semibold focus:outline-none cursor-pointer flex items-center justify-between text-left"
                  >
                    <span className="truncate">
                      {filterCategory.length === 0 
                        ? t.filterAllCat 
                        : filterCategory.length === 1 
                          ? filterCategory[0] 
                          : `${filterCategory.length} ${t.selectedCats}`}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isCategoryDropdownOpen && (
                    <div className="absolute right-0 left-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 p-2 max-h-56 overflow-y-auto">
                      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-100 dark:border-gray-800 px-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.catLabel}</span>
                        {filterCategory.length > 0 && (
                          <button
                            onClick={() => setFilterCategory([])}
                            className="text-[10px] text-rose-500 font-bold hover:underline cursor-pointer"
                          >
                            {t.clearAllCats}
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        {filterCategoriesList.map((cat) => {
                          const isSelected = filterCategory.includes(cat);
                          const CatIconComp = getDynamicCategoryIcon(cat, filterType);
                          const formattedCatLabel = formatCategoryWithBill(cat, filterType);
                          return (
                            <div
                              key={cat}
                              onClick={() => toggleCategoryFilter(cat)}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition capitalize ${
                                isSelected 
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold' 
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {isSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              )}
                              <CatIconComp className="w-3.5 h-3.5 shrink-0 text-gray-500" />
                              <span className="truncate">{formattedCatLabel}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={handleConfirmDeleteFiltered}
                disabled={filteredTransactions.length === 0}
                className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 disabled:bg-gray-100 dark:disabled:bg-gray-800 text-rose-600 dark:text-rose-500 font-extrabold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:cursor-not-allowed border border-rose-200 dark:border-rose-900"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.deleteFilteredOpt} ({filteredTransactions.length})</span>
              </button>
            </div>

          </div>
        </div>
      )}
   
    </div>
  );
}
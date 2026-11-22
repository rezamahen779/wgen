import { useState, useEffect } from 'react';
import { 
  Vault, Coins, Plus, Trash2, Target, Calendar, Check, X, Edit3, 
  ArrowDownLeft, Car, Home, Plane, Laptop, ShieldAlert, Heart, GraduationCap, Briefcase, TrendingUp, TrendingDown, Lock, BarChart3, Settings2, Clock, Users, RefreshCw, Landmark, PieChart, LineChart
} from 'lucide-react';

// Client Turso & Firebase Auth
import { turso } from './lib/turso';
import { auth } from './lib/firebase';

// Helper Fetch Offline Fallback
import { fetchWithOfflineFallback } from './lib/dbService';
// Currency Service
import { fetchLiveExchangeRates, convertCurrencyDynamic } from './lib/currencyService';


export default function Savings({ mainCurrency, language, twoToneTheme }) {
  const [goals, setGoals] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedGoalForDeposit, setSelectedGoalForDeposit] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');

  // State Harga Emas per Gram
  const [goldPricePerGramInMainCurrency, setGoldPricePerGramInMainCurrency] = useState(20550);
  const [customGoldPriceInput, setCustomGoldPriceInput] = useState('20550');

  // State Inflasi & Forecast Settings
  const [annualInflationRate, setAnnualInflationRate] = useState('3.0'); // Default 3%

  // State Sumber Saldo Fleksibel
  const [allTimeSavings, setAllTimeSavings] = useState(0);
  const [selectedMonthSavings, setSelectedMonthSavings] = useState(0);
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [copyMode, setCopyMode] = useState('allTime');

  // Form State Utama ('cash' | 'gold' | 'stock' | 'asset')
  const [title, setTitle] = useState('');
  const [goalType, setGoalType] = useState('cash'); 
  const [categoryIcon, setCategoryIcon] = useState('general');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  
  // State Khusus Saham, Aset Fisik & Tanggal
  const [initialCapital, setInitialCapital] = useState(''); 
  const [performanceType, setPerformanceType] = useState('profit'); // 'profit' | 'loss'
  const [performancePercent, setPerformancePercent] = useState('0');
  const [assetMarketValue, setAssetMarketValue] = useState(''); // Untuk Tipe Aset Fisik
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [isFrozen, setIsFrozen] = useState(false);

  const activeThemeId = twoToneTheme || 'emerald';
  const [liveRates, setLiveRates] = useState({});
       useEffect(() => {
        fetchLiveExchangeRates().then(rates => {
        if (rates) setLiveRates(rates);
       });
  }, []);


  // Definisi tema agar tidak error reference
  const themeMap = {
    emerald: {
      icon: 'text-emerald-500',
      gradText: 'from-emerald-500 to-teal-500',
      btn: 'from-emerald-500 to-teal-600'
    },
    blue: {
      icon: 'text-blue-500',
      gradText: 'from-blue-500 to-cyan-500',
      btn: 'from-blue-500 to-cyan-600'
    },
    amber: {
      icon: 'text-amber-500',
      gradText: 'from-amber-500 to-orange-500',
      btn: 'from-amber-500 to-orange-600'
    },
    rose: {
      icon: 'text-rose-500',
      gradText: 'from-rose-500 to-pink-500',
      btn: 'from-rose-500 to-pink-600'
    },
    purple: {
      icon: 'text-purple-500',
      gradText: 'from-purple-500 to-indigo-500',
      btn: 'from-purple-500 to-indigo-600'
    }
  };

  const currentTheme = themeMap[activeThemeId] || themeMap.emerald;

  // Tabel Nilai Tukar Kurs
  const convertCurrency = (amount, fromCurr, toCurr) => {
    return convertCurrencyDynamic(amount, fromCurr, toCurr, liveRates);
  };

  const getCurrencySymbol = (code) => {
    const symbols = { JPY: '¥', IDR: 'Rp', USD: '$', EUR: '€', GBP: '£', SGD: 'S$', MYR: 'RM', KRW: '₩', THB: '฿', AUD: 'A$', CNY: '¥', AED: 'DH' };
    return symbols[code] || code;
  };
  const sym = getCurrencySymbol(mainCurrency);

  const formatNumberWithSeparator = (value) => {
    if (value === undefined || value === null || value === '') return '';
    const cleanValue = String(value).replace(/\D/g, '');
    return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  useEffect(() => {
    const baseJpyGoldPrice = 20550;
    const adjustedGoldPrice = convertCurrency(baseJpyGoldPrice, 'JPY', mainCurrency);
    setGoldPricePerGramInMainCurrency(adjustedGoldPrice);
    setCustomGoldPriceInput(adjustedGoldPrice.toString());
  }, [mainCurrency]);

  const tSavings = {
    id: {
      title: 'Target Tabungan & Aset',
      subtitle: 'Kelola alokasi dana tunai, tabungan emas, portofolio saham, dan aset fisik.',
      addBtn: 'Tambah Aset / Target',
      noGoals: 'Belum ada data tabungan atau aset. Yuk atur portofoliomu sekarang!',
      remaining: 'Sisa Target',
      startDateLabel: 'Mulai',
      deadline: 'Batas Waktu',
      addGoalTitle: 'Tambah Tabungan / Aset',
      editGoalTitle: 'Edit Tabungan / Aset',
      inputTitle: 'Nama Target / Aset',
      placeholderTitle: 'mis: Dana Darurat, Mobil Baru',
      placeholderStockTitle: 'mis: Saham BBCA, S&P 500, Apple',
      placeholderAssetTitle: 'mis: Tanah Ciherang, Rumah, Ruko',
      inputTypeLabel: 'Jenis Aset',
      typeCash: '💵 Tunai',
      typeGold: '🥇 Emas',
      typeStock: '📈 Saham',
      typeAsset: '🏡 Aset Fisik',
      goldDefaultName: 'Emas Murni',
      stockDefaultName: 'Investasi Saham',
      assetDefaultName: 'Aset Fisik / Properti',
      inputCategory: 'Kategori Ikon',
      inputTarget: 'Target Nominal',
      inputTargetOptional: 'Target Nominal (Opsional untuk Dana Darurat)',
      inputTargetGold: 'Target Gram Emas (Opsional)',
      inputCurrent: 'Nominal Terkumpul Saat Ini',
      inputCurrentGold: 'Emas Terkumpul Saat Ini (Gram)',
      inputInitialCapital: 'Modal Awal / Harga Perolehan',
      inputMarketValue: 'Estimasi Nilai Pasar Saat Ini',
      inputPerformancePercent: 'Performa Return (%)',
      inputStartDateLabel: 'Tanggal Mulai Nabung / Investasi',
      optProfit: '📈 Untung (+)',
      optLoss: '📉 Rugi (-)',
      totalBalance: 'Total Balance:',
      initialCapitalLabel: 'Modal Awal:',
      marketValueLabel: 'Nilai Pasar:',
      performanceStatus: 'Status Performa:',
      investmentDuration: 'Durasi Kepemilikan:',
      totalAccumulated: 'Total Terkumpul:',
      lastUpdated: 'Diperbarui:',
      unitDays: 'Hari',
      unitMonths: 'Bulan',
      unitYears: 'Tahun',
      useAllTimeBtn: 'Salin Total Saldo (Kumulatif)',
      useMonthBtn: 'Salin Sisa Saldo Bulan Ini/Pilihan',
      inputDate: 'Target Tanggal Selesai',
      freezeLabel: 'Kunci Aset Ini (Proteksi Ekstra)',
      freezeDesc: 'Aset dikunci dengan konfirmasi ganda saat ingin mengurangi/menghapus.',
      goldRateSettingLabel: 'Set Acuan Harga Emas / Gram Hari Ini',
      saveBtn: 'Simpan',
      cancelBtn: 'Batal',
      deleteConfirm: 'Apakah kamu yakin ingin menghapus data ini?',
      frozenDeleteWarning: '⚠️ ASET INI TERKUNCI! Yakin ingin menghapus data penting ini?',
      frozenReduceWarning: '⚠️ Aset ini dalam status TERKUNCI! Yakin ingin mengurangi nilainya?',
      completedBadge: 'Target Tercapai! 🎉',
      frozenBadge: 'Terkunci',
      goldValueEst: 'Estimasi Nilai Pasar',
      goldLivePriceRate: 'Harga Emas / Gram:',
      stockPortfolioBadge: 'Portofolio Saham',
      assetTrackerBadge: 'Aset & Properti',
      copyOptAllTime: 'Total Saldo Akumulasi',
      copyOptMonth: 'Sisa Saldo Per Bulan',
      recommendMonthly: 'Saran Tabungan / Bulan',
      recommendMonthlyGold: 'Saran Tabungan Emas / Bulan',
      monthsLeft: 'bulan lagi',
      depositBtn: '+ Setor',
      depositTitle: 'Tambah Setoran / Nilai Aset',
      depositAmountLabel: 'Nominal Setoran Tambahan',
      depositAmountGoldLabel: 'Jumlah Gram Emas Tambahan',
      depositAmountStockLabel: 'Penambahan Modal Beli Saham',
      depositAmountAssetLabel: 'Penambahan Nilai / Renovasi Aset',
      saveDepositBtn: 'Tambahkan',
      forecastTitle: 'Proyeksi Inflasi & Daya Beli Tabungan',
      forecastSubtitle: 'Analisis estimasi nilai tabungan tunai Anda dalam 1, 3, dan 5 tahun ke depan dengan asumsi tingkat inflasi.',
      inflationRateLabel: 'Asumsi Inflasi Tahunan (%)',
      totalCashSavings: 'Total Tabungan Tunai Saat Ini:',
      year1Forecast: 'Proyeksi 1 Tahun:',
      year3Forecast: 'Proyeksi 3 Tahun:',
      year5Forecast: 'Proyeksi 5 Tahun:',
      inflationNote: '💡 Nilai di atas mencerminkan daya beli riil setelah tergerus inflasi tahunan.',
      catOptions: {
        general: 'Tabungan Umum', car: 'Kendaraan / Mobil', home: 'Rumah / Properti', plane: 'Liburan / Travel',
        laptop: 'Gadget / Elektronik', shield: 'Dana Darurat (Opsional Target)', wedding: 'Pernikahan', family: 'Keluarga', grad: 'Edukasi / Pendidikan', business: 'Usaha / Bisnis'
      }
    },
    en: {
      title: 'Savings & Assets',
      subtitle: 'Manage cash, gold savings, stock portfolios, and physical assets.',
      addBtn: 'Add Asset / Goal',
      noGoals: 'No savings or asset data yet. Set your portfolio today!',
      remaining: 'Remaining',
      startDateLabel: 'Start',
      deadline: 'Deadline',
      addGoalTitle: 'Add Savings / Asset',
      editGoalTitle: 'Edit Savings / Asset',
      inputTitle: 'Goal / Asset Name',
      placeholderTitle: 'e.g. Emergency Fund, New Car',
      placeholderStockTitle: 'e.g. BBCA Stock, S&P 500, Apple',
      placeholderAssetTitle: 'e.g. Land, House, Commercial Property',
      inputTypeLabel: 'Asset Type',
      typeCash: '💵 Cash',
      typeGold: '🥇 Gold',
      typeStock: '📈 Stocks',
      typeAsset: '🏡 Physical Asset',
      goldDefaultName: 'Gold',
      stockDefaultName: 'Stock Asset',
      assetDefaultName: 'Physical Property',
      inputCategory: 'Category Icon',
      inputTarget: 'Target Amount',
      inputTargetOptional: 'Target Amount (Optional for Emergency Fund)',
      inputTargetGold: 'Target Gold Grams (Optional)',
      inputCurrent: 'Current Savings',
      inputCurrentGold: 'Current Gold Grams',
      inputInitialCapital: 'Initial Capital / Cost Basis',
      inputMarketValue: 'Estimated Current Market Value',
      inputPerformancePercent: 'Performance Return (%)',
      inputStartDateLabel: 'Start Date (Savings / Invest)',
      optProfit: '📈 Profit (+)',
      optLoss: '📉 Loss (-)',
      totalBalance: 'Total Balance:',
      initialCapitalLabel: 'Initial Cost:',
      marketValueLabel: 'Market Value:',
      performanceStatus: 'Performance Status:',
      investmentDuration: 'Holding Duration:',
      totalAccumulated: 'Total Accumulated:',
      lastUpdated: 'Last Updated:',
      unitDays: 'Days',
      unitMonths: 'Months',
      unitYears: 'Years',
      useAllTimeBtn: 'Copy Total Cumulative Balance',
      useMonthBtn: 'Copy Selected Month Balance',
      inputDate: 'Target Completion Date',
      freezeLabel: 'Freeze This Asset (Protected)',
      freezeDesc: 'Adds extra confirmation protection when attempting to reduce or delete.',
      goldRateSettingLabel: 'Set Today Gold Rate / Gram',
      saveBtn: 'Save',
      cancelBtn: 'Cancel',
      deleteConfirm: 'Are you sure you want to delete this data?',
      frozenDeleteWarning: '⚠️ THIS ASSET IS FROZEN! Are you sure you want to delete it?',
      frozenReduceWarning: '⚠️ This asset is FROZEN! Are you sure you want to reduce its value?',
      completedBadge: 'Goal Achieved! 🎉',
      frozenBadge: 'Protected',
      goldValueEst: 'Market Value Estimate',
      goldLivePriceRate: 'Gold Rate / Gram:',
      stockPortfolioBadge: 'Stock Portfolio',
      assetTrackerBadge: 'Assets & Property',
      copyOptAllTime: 'Total Cumulative Net Balance',
      copyOptMonth: 'Monthly Net Balance',
      recommendMonthly: 'Recommended / Month',
      recommendMonthlyGold: 'Recommended Gold / Month',
      monthsLeft: 'months left',
      depositBtn: '+ Deposit',
      depositTitle: 'Add Deposit / Value',
      depositAmountLabel: 'Additional Contribution Amount',
      depositAmountGoldLabel: 'Additional Gold Weight (g)',
      depositAmountStockLabel: 'Additional Stock Capital',
      depositAmountAssetLabel: 'Additional Asset Value / Renovation',
      saveDepositBtn: 'Add Value',
      forecastTitle: 'Inflation & Savings Purchasing Power Forecast',
      forecastSubtitle: 'Analyze estimated cash savings purchasing power over 1, 3, and 5 years based on inflation assumptions.',
      inflationRateLabel: 'Annual Inflation Assumption (%)',
      totalCashSavings: 'Total Cash Savings:',
      year1Forecast: '1-Year Forecast:',
      year3Forecast: '3-Year Forecast:',
      year5Forecast: '5-Year Forecast:',
      inflationNote: '💡 Values above reflect real purchasing power after accounting for annual inflation.',
      catOptions: {
        general: 'General Savings', car: 'Vehicle / Car', home: 'Home / Property', plane: 'Vacation / Travel',
        laptop: 'Gadgets / Tech', shield: 'Emergency Fund (Optional Target)', wedding: 'Wedding', family: 'Family', grad: 'Education', business: 'Business / Capital'
      }
    },
    jp: {
      title: '貯金 & 資産目標',
      subtitle: '現金、金（ゴールド）、株式投資、物理的資産を一元管理しましょう。',
      addBtn: '資産・目標を追加',
      noGoals: '貯金や資産データがありません。最初の目標を設定してみましょう！',
      remaining: '残り目標額',
      startDateLabel: '開始日',
      deadline: '達成予定日',
      addGoalTitle: '貯金・資産の追加',
      editGoalTitle: '貯金・資産の編集',
      inputTitle: '目標・資産名',
      placeholderTitle: '例: 緊急資金、新車',
      placeholderStockTitle: '例: トヨタ自動車、S&P 500、Apple',
      placeholderAssetTitle: '例: 土地、不動産、店舗',
      inputTypeLabel: '資産タイプ',
      typeCash: '💵 現金',
      typeGold: '🥇 金積立',
      typeStock: '📈 株式',
      typeAsset: '🏡 物理的資産',
      goldDefaultName: '純金',
      stockDefaultName: '株式投資',
      assetDefaultName: '不動産・物理資産',
      inputCategory: 'アイコンカテゴリー',
      inputTarget: '目標金額',
      inputTargetOptional: '目標金額 (緊急資金は任意)',
      inputTargetGold: '目標金重量 (g) (任意)',
      inputCurrent: '現在の貯金額',
      inputCurrentGold: '現在の保有金重量 (g)',
      inputInitialCapital: '初期取得原価 / 投資元本',
      inputMarketValue: '現在の推定市場価値',
      inputPerformancePercent: '運用リターン (%)',
      inputStartDateLabel: '貯金・投資開始日',
      optProfit: '📈 利益 (+)',
      optLoss: '📉 損失 (-)',
      totalBalance: 'トータル評価額:',
      initialCapitalLabel: '取得原価:',
      marketValueLabel: '時価評価:',
      performanceStatus: '運用パフォーマンス:',
      investmentDuration: '保有期間:',
      totalAccumulated: '累計貯金額:',
      lastUpdated: '最終更新:',
      unitDays: '日',
      unitMonths: 'ヶ月',
      unitYears: '年',
      useAllTimeBtn: '全期間の総残高をコピー',
      useMonthBtn: '選択した月の残高をコピー',
      inputDate: '達成予定日',
      freezeLabel: 'この資産をロックする (変更保護)',
      freezeDesc: '減額や削除時に追加の確認保護が適用されます。',
      goldRateSettingLabel: '本日の金相場 (1gあたり)',
      saveBtn: '保存',
      cancelBtn: 'キャンセル',
      deleteConfirm: 'このデータを削除してもよろしいですか？',
      frozenDeleteWarning: '⚠️ この資産はロックされています！本当に削除しますか？',
      frozenReduceWarning: '⚠️ この資産はロックされています！金額を減らしてもよろしいですか？',
      completedBadge: '目標達成！ 🎉',
      frozenBadge: 'ロック中',
      goldValueEst: '市場推定評価額',
      goldLivePriceRate: '金相場 / グラム:',
      stockPortfolioBadge: '株式ポートフォリオ',
      assetTrackerBadge: '実物資産・不動産',
      copyOptAllTime: '全期間累計残高',
      copyOptMonth: '月別残高',
      recommendMonthly: '月々の推奨貯金額',
      recommendMonthlyGold: '月々の推奨金購入量',
      monthsLeft: 'か月残り',
      depositBtn: '+ 入金',
      depositTitle: '資産・入金の追加',
      depositAmountLabel: '追加入金額',
      depositAmountGoldLabel: '追加購入金重量 (g)',
      depositAmountStockLabel: '追加投資元本',
      depositAmountAssetLabel: '資産価値追加・リフォーム費',
      saveDepositBtn: '反映',
      forecastTitle: 'インフレ & 貯蓄購買力予測',
      forecastSubtitle: '想定インフレ率に基づき、1年、3年、5年後の現金貯蓄の実質購買力を予測します。',
      inflationRateLabel: '年間想定インフレ率 (%)',
      totalCashSavings: '現在の現金貯蓄総額:',
      year1Forecast: '1年後予測:',
      year3Forecast: '3年後予測:',
      year5Forecast: '5年後予測:',
      inflationNote: '💡 上記の数値は、年間インフレによる価値低下を考慮した実質購買力を表しています。',
      catOptions: {
        general: '一般貯金', car: '車 / 乗り物', home: '住宅 / 不動産', plane: '旅行 / 観光',
        laptop: '家電 / パソコン', shield: '緊急資金 (目標任意)', wedding: '結婚', family: '家族', grad: '教育 / 学費', business: '副業 / ビジネス'
      }
    },
    ar: {
      title: 'الادخار والأصول',
      subtitle: 'إدارة النقدية، ادخار الذهب، محفظة الأسهم، والأصول المادية.',
      addBtn: 'إضافة أصل / هدف',
      noGoals: 'لا توجد بيانات ادخار أو أصول بعد. أضف محفظتك اليوم!',
      remaining: 'المتبقي',
      startDateLabel: 'تاريخ البدء',
      deadline: 'الموعد النهائي',
      addGoalTitle: 'إضافة ادخار / أصل',
      editGoalTitle: 'تعديل ادخار / أصل',
      inputTitle: 'اسم الهدف / الأصل',
      placeholderTitle: 'مثال: صندوق الطوارئ، سيارة جديدة',
      placeholderStockTitle: 'مثال: أسهم أبل، مؤشر S&P 500',
      placeholderAssetTitle: 'مثال: أرض، منزل، عقار تجاري',
      inputTypeLabel: 'نوع الأصول',
      typeCash: '💵 نقدي',
      typeGold: '🥇 ذهب',
      typeStock: '📈 أسهم',
      typeAsset: '🏡 أصل مادي',
      goldDefaultName: 'الذهب الخالص',
      stockDefaultName: 'استثمار الأسهم',
      assetDefaultName: 'أصل مادي / عقار',
      inputCategory: 'فئة الأيقونة',
      inputTarget: 'المبلغ المستهدف',
      inputTargetOptional: 'المبلغ المستهدف (اختياري لصندوق الطوارئ)',
      inputTargetGold: 'مستهدف الذهب (جرام) (اختياري)',
      inputCurrent: 'المدخرات الحالية',
      inputCurrentGold: 'الذهب الحالي (جرام)',
      inputInitialCapital: 'التكلفة الأولية / سعر الشراء',
      inputMarketValue: 'القيمة السوقية الحالية التقديرية',
      inputPerformancePercent: 'نسبة الأداء (%)',
      inputStartDateLabel: 'تاريخ بدء الادخار / الاستثمار',
      optProfit: '📈 ربح (+)',
      optLoss: '📉 خسارة (-)',
      totalBalance: 'إجمالي الرصيد:',
      initialCapitalLabel: 'التكلفة الأولية:',
      marketValueLabel: 'القيمة السوقية:',
      performanceStatus: 'حالة الأداء:',
      investmentDuration: 'مدة الاستحواذ:',
      totalAccumulated: 'الإجمالي المتراكم:',
      lastUpdated: 'آخر تحديث:',
      unitDays: 'أيام',
      unitMonths: 'أشهر',
      unitYears: 'سنوات',
      useAllTimeBtn: 'نسخ إجمالي الرصيد التراكمي',
      useMonthBtn: 'نسخ رصيد الشهر المحدد',
      inputDate: 'تاريخ الإنجاز المستهدف',
      freezeLabel: 'تجميد هذا الأصل (محمي)',
      freezeDesc: 'يضيف تأكيدًا إضافيًا عند محاولة تقليل المبلغ أو الحذف.',
      goldRateSettingLabel: 'تحديد سعر الذهب اليوم / جرام',
      saveBtn: 'حفظ',
      cancelBtn: 'إلغاء',
      deleteConfirm: 'هل أنت تأكد من حذف هذه البيانات؟',
      frozenDeleteWarning: '⚠️ هذا الأصل مجمد! هل أنت تأكد من حذفه؟',
      frozenReduceWarning: '⚠️ هذا الأصل مجمد! هل أنت تأكد من تقليل قيمته؟',
      completedBadge: 'تم تحقيق الهدف! 🎉',
      frozenBadge: 'محمي',
      goldValueEst: 'القيمة التقديرية بالسوق',
      goldLivePriceRate: 'سعر الذهب / جرام:',
      stockPortfolioBadge: 'محفظة الأسهم',
      assetTrackerBadge: 'الأصول والعقارات',
      copyOptAllTime: 'إجمالي الرصيد التراكمي',
      copyOptMonth: 'الرصيد الشهري',
      recommendMonthly: 'الادخار الشهري المقترح',
      recommendMonthlyGold: 'الذهب المقترح شهرياً',
      monthsLeft: 'أشهر متبقية',
      depositBtn: '+ إيداع',
      depositTitle: 'إضافة إيداع / قيمة',
      depositAmountLabel: 'مبلغ المساهمة الإضافي',
      depositAmountGoldLabel: 'وزن الذهب الإضافي (جرام)',
      depositAmountStockLabel: 'رأس مال إضافي للأسهم',
      depositAmountAssetLabel: 'قيمة إضافية / تكلفة تجديد للأصل',
      saveDepositBtn: 'تأكيد',
      forecastTitle: 'توقعات التضخم والقوة الشرائية للادخار',
      forecastSubtitle: 'تحليل القوة الشرائية المقدرة لمدخراتك النقدية خلال 1 و 3 و 5 سنوات بناءً على معدلات التضخم.',
      inflationRateLabel: 'افتراض التضخم السنوي (%)',
      totalCashSavings: 'إجمالي المدخرات النقدية الحالية:',
      year1Forecast: 'توقعات سنة واحدة:',
      year3Forecast: 'توقعات 3 سنوات:',
      year5Forecast: 'توقعات 5 سنوات:',
      inflationNote: '💡 القيم أعلاه تعكس القوة الشرائية الحقيقية بعد احتساب التضخم السنوي.',
      catOptions: {
        general: 'ادخار عام', car: 'مركبة / سيارة', home: 'منزل / عقار', plane: 'سفر / رحلات',
        laptop: 'أجهزة / إلكترونيات', shield: 'صندوق الطوارئ (هدف اختياري)', wedding: 'زواج', family: 'عائلة', grad: 'تعليم / دراسة', business: 'مشروع / تجارة'
      }
    },
    cn: {
      title: '储蓄与资产',
      subtitle: '管理现金、黄金储备、股票投资组合及实物资产。',
      addBtn: '添加资产/目标',
      noGoals: '暂无储蓄或资产数据。立即建立您的资产组合吧！',
      remaining: '剩余目标',
      startDateLabel: '起始日期',
      deadline: '截止日期',
      addGoalTitle: '添加储蓄/资产',
      editGoalTitle: '编辑储蓄/资产',
      inputTitle: '目标/资产名称',
      placeholderTitle: '例如：应急资金、买车',
      placeholderStockTitle: '例如：腾讯股票、标普500、苹果',
      placeholderAssetTitle: '例如：土地、房屋、商业地产',
      inputTypeLabel: '资产类型',
      typeCash: '💵 现金',
      typeGold: '🥇 黄金',
      typeStock: '📈 股票',
      typeAsset: '🏡 实物资产',
      goldDefaultName: '黄金',
      stockDefaultName: '股票资产',
      assetDefaultName: '实物房地产',
      inputCategory: '图标分类',
      inputTarget: '目标金额',
      inputTargetOptional: '目标金额 (备用金可选填)',
      inputTargetGold: '目标金重 (克) (选填)',
      inputCurrent: '当前已存',
      inputCurrentGold: '当前已存金重 (克)',
      inputInitialCapital: '初始成本 / 购入价',
      inputMarketValue: '当前估算市值',
      inputPerformancePercent: '投资收益率 (%)',
      inputStartDateLabel: '开始储蓄/投资日期',
      optProfit: '📈 盈利 (+)',
      optLoss: '📉 亏损 (-)',
      totalBalance: '总资产评估:',
      initialCapitalLabel: '初始成本:',
      marketValueLabel: '当前市值:',
      performanceStatus: '收益状态:',
      investmentDuration: '持有时间:',
      totalAccumulated: '已存总额:',
      lastUpdated: '最后更新:',
      unitDays: '天',
      unitMonths: '个月',
      unitYears: '年',
      useAllTimeBtn: '复制累计总余额',
      useMonthBtn: '复制所选月份余额',
      inputDate: '预计完成日期',
      freezeLabel: '锁定此资产 (受保护)',
      freezeDesc: '尝试减少或删除时将需要额外确认。',
      goldRateSettingLabel: '设置今日金价 / 克',
      saveBtn: '保存',
      cancelBtn: '取消',
      deleteConfirm: '您确定要删除此数据吗？',
      frozenDeleteWarning: '⚠️ 该资产处于锁定状态！确定要删除吗？',
      frozenReduceWarning: '⚠️ 该资产处于锁定状态！确定要减少其金额吗？',
      completedBadge: '目标已达成！ 🎉',
      frozenBadge: '已锁定',
      goldValueEst: '市场预估价值',
      goldLivePriceRate: '金价 / 克:',
      stockPortfolioBadge: '股票持仓',
      assetTrackerBadge: '资产与房产',
      copyOptAllTime: '累计总余额',
      copyOptMonth: '按月净余额',
      recommendMonthly: '每月建议储蓄',
      recommendMonthlyGold: '每月建议存金',
      monthsLeft: '个月剩余',
      depositBtn: '+ 存入',
      depositTitle: '追加/更新资产市值',
      depositAmountLabel: '追加金额',
      depositAmountGoldLabel: '追加金重 (克)',
      depositAmountStockLabel: '追加股票本金',
      depositAmountAssetLabel: '追加资产价值/翻新投入',
      saveDepositBtn: '确认追加',
      forecastTitle: '通货膨胀与储蓄购买力预测',
      forecastSubtitle: '基于通胀假设，分析未来 1 年、3 年和 5 年内现金储蓄的实际购买力。',
      inflationRateLabel: '年度通货膨胀率假设 (%)',
      totalCashSavings: '当前现金储蓄总额:',
      year1Forecast: '1 年后预测:',
      year3Forecast: '3 年后预测:',
      year5Forecast: '5 年后预测:',
      inflationNote: '💡 以上数值反映了扣除年度通胀后的实际购买力。',
      catOptions: {
        general: '通用储蓄', car: '车辆 / 购车', home: '房屋 / 不动产', plane: '旅游 / 出行',
        laptop: '数码 / 电子产品', shield: '备用金 (目标可选)', wedding: '婚礼', family: '家庭', grad: '教育 / 培训', business: '创业 / 商业'
      }
    }
  };

  const t = tSavings[language] || tSavings['id'];

  const formatDateOnlyByLang = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const [y, m, d] = parts.map(Number);
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return dateStr;

    const langLocales = { id: 'id-ID', en: 'en-US', jp: 'ja-JP', ar: 'ar-EG', cn: 'zh-CN' };
    const locale = langLocales[language] || 'id-ID';

    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  };

  const formatDateTimeByLang = (isoStr) => {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return '';

    const langLocales = { id: 'id-ID', en: 'en-US', jp: 'ja-JP', ar: 'ar-EG', cn: 'zh-CN' };
    const locale = langLocales[language] || 'id-ID';

    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  };

  const fetchGoals = async () => {
    try {
      // 🟢 Fallback UID agar aman saat offline
      const userId = auth?.currentUser?.uid || localStorage.getItem('wgen_last_uid') || "wgen_user";

      // 🟢 Ambil data lewat dbService (Otomatis IndexedDB saat offline)
      const rows = await fetchWithOfflineFallback('savings_goals', {
        sql: `SELECT * FROM savings_goals WHERE user_id = ? ORDER BY created_at DESC`,
        args: [userId]
      }, userId);

      const data = rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        goalType: row.goal_type || 'cash',
        categoryIcon: row.category_icon || 'general',
        targetAmount: row.target_amount || 0,
        currentAmount: row.current_amount || 0,
        initialCapital: row.initial_capital || 0,
        performanceType: row.performance_type || 'profit',
        performancePercent: row.performance_percent || 0,
        startDate: row.start_date || '',
        targetDate: row.target_date || '',
        isFrozen: Boolean(row.is_frozen),
        currency: row.currency || mainCurrency,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      setGoals(data);
    } catch (err) {
      console.error('Gagal mengambil data savings goals:', err.message);
      setGoals([]);
    }
  };

  const calculateFlexibleSavings = async () => {
    try {
      // 🟢 Fallback UID
      const userId = auth?.currentUser?.uid || localStorage.getItem('wgen_last_uid') || "wgen_user";

      // 🟢 Ambil transaksi via offline fallback
      const rows = await fetchWithOfflineFallback('transactions', {
        sql: `SELECT * FROM transactions WHERE user_id = ?`,
        args: [userId]
      }, userId);

      let allIncome = 0, allExpense = 0;
      let monthIncome = 0, monthExpense = 0;

      rows.forEach((row) => {
        const amt = parseFloat(row.amount) || 0;
        const convertedAmt = convertCurrency(amt, row.currency || mainCurrency, mainCurrency);
        const isInc = row.type === 'income' || row.type === 'pemasukan';
        const isExp = row.type === 'expense' || row.type === 'pengeluaran';

        if (isInc) allIncome += convertedAmt;
        if (isExp) allExpense += convertedAmt;

        if (row.date && row.date.slice(0, 7) === filterMonth) {
          if (isInc) monthIncome += convertedAmt;
          if (isExp) monthExpense += convertedAmt;
        }
      });

      setAllTimeSavings(Math.max(allIncome - allExpense, 0));
      setSelectedMonthSavings(Math.max(monthIncome - monthExpense, 0));
    } catch (err) {
      console.error('Gagal menghitung saldo fleksibel:', err.message);
    }
  };

  useEffect(() => {
    fetchGoals();
    calculateFlexibleSavings();

    // 🟢 Listener auto-sync ketika koneksi kembali online
    const handleSync = () => {
      fetchGoals();
      calculateFlexibleSavings();
    };

    window.addEventListener('wgen-data-synced', handleSync);
    window.addEventListener('transaction-added', calculateFlexibleSavings);

    return () => {
      window.removeEventListener('wgen-data-synced', handleSync);
      window.removeEventListener('transaction-added', calculateFlexibleSavings);
    };
  }, [mainCurrency, filterMonth]);

  const handleOpenModal = (goal = null) => {
    if (goal) {
      const origCurr = goal.currency || mainCurrency;
      setEditingId(goal.id);
      setGoalType(goal.goalType || 'cash');
      
      if (goal.goalType === 'gold') {
        setTitle(t.goldDefaultName);
        setCategoryIcon('gold');
        setTargetAmount(goal.targetAmount || '');
        setCurrentAmount(goal.currentAmount || '');
      } else if (goal.goalType === 'stock') {
        setTitle(goal.title || t.stockDefaultName);
        setCategoryIcon('stock');
        setTargetAmount('');
        setInitialCapital(convertCurrency(goal.initialCapital || 0, origCurr, mainCurrency));
        setPerformanceType(goal.performanceType || 'profit');
        setPerformancePercent(goal.performancePercent !== undefined ? goal.performancePercent.toString() : '0');
      } else if (goal.goalType === 'asset') {
        setTitle(goal.title || t.assetDefaultName);
        setCategoryIcon('home');
        setTargetAmount('');
        setInitialCapital(convertCurrency(goal.initialCapital || 0, origCurr, mainCurrency));
        setAssetMarketValue(convertCurrency(goal.currentAmount || 0, origCurr, mainCurrency));
      } else {
        setTitle(goal.title || '');
        let mappedIcon = goal.categoryIcon;
        if (mappedIcon === 'target') mappedIcon = 'general';
        if (mappedIcon === 'heart') mappedIcon = 'wedding';
        setCategoryIcon(mappedIcon || 'general');
        setTargetAmount(goal.targetAmount ? convertCurrency(goal.targetAmount, origCurr, mainCurrency) : '');
        setCurrentAmount(convertCurrency(goal.currentAmount || 0, origCurr, mainCurrency));
      }

      setStartDate(goal.startDate || '');
      setTargetDate(goal.targetDate || '');
      setIsFrozen(!!goal.isFrozen);
    } else {
      setEditingId(null);
      setTitle('');
      setGoalType('cash');
      setCategoryIcon('general');
      setTargetAmount('');
      setCurrentAmount('');
      setInitialCapital('');
      setPerformanceType('profit');
      setPerformancePercent('0');
      setAssetMarketValue('');
      setStartDate(new Date().toISOString().slice(0, 10));
      setTargetDate('');
      setIsFrozen(false);
    }
    setShowModal(true);
  };

  const handleApplyCopySavings = () => {
    if (goalType !== 'cash') return;
    if (copyMode === 'allTime') {
      setCurrentAmount(allTimeSavings.toString());
    } else {
      setCurrentAmount(selectedMonthSavings.toString());
    }
  };

  const handleSaveGoal = async (e) => {
    e.preventDefault();

    let finalTitle = title;
    if (goalType === 'gold') finalTitle = t.goldDefaultName;
    if (goalType === 'stock' && !finalTitle.trim()) finalTitle = t.stockDefaultName;
    if (goalType === 'asset' && !finalTitle.trim()) finalTitle = t.assetDefaultName;

    if (!finalTitle) return;

    if (editingId) {
      const currentGoalObj = goals.find(g => g.id === editingId);
      if (currentGoalObj && currentGoalObj.isFrozen) {
        let prevAmt = Number(currentGoalObj.currentAmount) || 0;
        if (currentGoalObj.goalType === 'cash') {
          const origCurr = currentGoalObj.currency || mainCurrency;
          prevAmt = convertCurrency(prevAmt, origCurr, mainCurrency);
        }
        const newAmt = Number(currentAmount) || 0;

        if (goalType === 'cash' && newAmt < prevAmt) {
          const confirmReduce = window.confirm(t.frozenReduceWarning);
          if (!confirmReduce) return;
        }
      }
    }

    try {
      // 🟢 Fallback UID
      const userId = auth?.currentUser?.uid || localStorage.getItem('wgen_last_uid') || "wgen_user";

      let calculatedCurrentAmount = 0;
      let calculatedInitialCapital = 0;

      if (goalType === 'stock') {
        const cap = Number(initialCapital) || 0;
        const pct = parseFloat(performancePercent) || 0;
        const multiplier = performanceType === 'profit' ? (1 + pct / 100) : (1 - pct / 100);
        calculatedCurrentAmount = Math.round(cap * multiplier);
        calculatedInitialCapital = cap;
      } else if (goalType === 'asset') {
        calculatedInitialCapital = Number(initialCapital) || 0;
        calculatedCurrentAmount = Number(assetMarketValue) || 0;
      } else {
        calculatedCurrentAmount = Number(currentAmount) || 0;
        calculatedInitialCapital = 0;
      }

      const finalTargetAmount = (goalType === 'stock' || goalType === 'asset' || !targetAmount) ? 0 : Number(targetAmount);
      const finalCategoryIcon = goalType === 'gold' ? 'gold' : goalType === 'stock' ? 'stock' : goalType === 'asset' ? 'home' : categoryIcon;
      const finalPerfType = goalType === 'stock' ? performanceType : 'profit';
      const finalPerfPct = goalType === 'stock' ? (parseFloat(performancePercent) || 0) : 0;
      const finalStartDate = startDate || new Date().toISOString().slice(0, 10);
      const finalTargetDate = (goalType === 'stock' || goalType === 'asset') ? '' : targetDate;
      const frozenVal = isFrozen ? 1 : 0;
      const nowIso = new Date().toISOString();

      if (editingId) {
        await turso.execute({
          sql: `UPDATE savings_goals 
                SET title = ?, goal_type = ?, category_icon = ?, target_amount = ?, current_amount = ?, 
                    initial_capital = ?, performance_type = ?, performance_percent = ?, start_date = ?, 
                    target_date = ?, is_frozen = ?, currency = ?, updated_at = ?
                WHERE id = ? AND user_id = ?`,
          args: [
            finalTitle, goalType, finalCategoryIcon, finalTargetAmount, calculatedCurrentAmount,
            calculatedInitialCapital, finalPerfType, finalPerfPct, finalStartDate,
            finalTargetDate, frozenVal, mainCurrency, nowIso,
            editingId, userId
          ]
        });
      } else {
        const newId = `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await turso.execute({
          sql: `INSERT INTO savings_goals 
                (id, user_id, title, goal_type, category_icon, target_amount, current_amount, 
                 initial_capital, performance_type, performance_percent, start_date, target_date, 
                 is_frozen, currency, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            newId, userId, finalTitle, goalType, finalCategoryIcon, finalTargetAmount, calculatedCurrentAmount,
            calculatedInitialCapital, finalPerfType, finalPerfPct, finalStartDate, finalTargetDate,
            frozenVal, mainCurrency, nowIso, nowIso
          ]
        });
      }

      setShowModal(false);
      fetchGoals();
    } catch (err) {
      console.error('Gagal menyimpan target tabungan:', err.message);
    }
  };
  
  const handleDeleteGoal = async (id, isGoalFrozen) => {
    const confirmMsg = isGoalFrozen ? t.frozenDeleteWarning : t.deleteConfirm;
    if (window.confirm(confirmMsg)) {
      try {
        // 🟢 Fallback UID agar aman saat offline
        const userId = auth?.currentUser?.uid || localStorage.getItem('wgen_last_uid') || "wgen_user";

        await turso.execute({
          sql: `DELETE FROM savings_goals WHERE id = ? AND user_id = ?`,
          args: [id, userId]
        });

        fetchGoals();
      } catch (err) {
        console.error('Gagal menghapus target:', err.message);
      }
    }
  };

  const handleOpenDeposit = (e, goal) => {
    e.stopPropagation();
    setSelectedGoalForDeposit(goal);
    setDepositAmount('');
    setShowDepositModal(true);
  };

  const handleSaveDeposit = async (e) => {
    e.preventDefault();
    if (!selectedGoalForDeposit || !depositAmount) return;

    try {
      // 🟢 Fallback UID agar aman saat offline
      const userId = auth?.currentUser?.uid || localStorage.getItem('wgen_last_uid') || "wgen_user";

      let addVal = Number(depositAmount) || 0;
      const origCurr = selectedGoalForDeposit.currency || mainCurrency;
      const nowIso = new Date().toISOString();

      if (selectedGoalForDeposit.goalType === 'cash') {
        addVal = convertCurrency(addVal, mainCurrency, origCurr);
        const newTotal = (Number(selectedGoalForDeposit.currentAmount) || 0) + addVal;

        await turso.execute({
          sql: `UPDATE savings_goals SET current_amount = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
          args: [newTotal, nowIso, selectedGoalForDeposit.id, userId]
        });
      } else if (selectedGoalForDeposit.goalType === 'stock') {
        addVal = convertCurrency(addVal, mainCurrency, origCurr);
        const newInitial = (Number(selectedGoalForDeposit.initialCapital) || 0) + addVal;
        const pct = selectedGoalForDeposit.performancePercent || 0;
        const isProf = selectedGoalForDeposit.performanceType !== 'loss';
        const multiplier = isProf ? (1 + pct / 100) : (1 - pct / 100);
        const newCurrent = Math.round(newInitial * multiplier);

        await turso.execute({
          sql: `UPDATE savings_goals SET initial_capital = ?, current_amount = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
          args: [newInitial, newCurrent, nowIso, selectedGoalForDeposit.id, userId]
        });
      } else if (selectedGoalForDeposit.goalType === 'asset') {
        addVal = convertCurrency(addVal, mainCurrency, origCurr);
        const newCurrentMarket = (Number(selectedGoalForDeposit.currentAmount) || 0) + addVal;
        await turso.execute({
          sql: `UPDATE savings_goals SET current_amount = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
          args: [newCurrentMarket, nowIso, selectedGoalForDeposit.id, userId]
        });
      } else if (selectedGoalForDeposit.goalType === 'gold') {
        const newTotalGold = (Number(selectedGoalForDeposit.currentAmount) || 0) + addVal;
        await turso.execute({
          sql: `UPDATE savings_goals SET current_amount = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
          args: [newTotalGold, nowIso, selectedGoalForDeposit.id, userId]
        });
      }

      setShowDepositModal(false);
      fetchGoals();
    } catch (err) {
      console.error('Gagal menambahkan setoran:', err.message);
    }
  };

  const renderGoalIcon = (iconKey) => {
    const classStr = "w-5 h-5";
    switch (iconKey) {
      case 'gold': return <Coins className={`${classStr} text-amber-500`} />;
      case 'stock': return <BarChart3 className={`${classStr} text-sky-400`} />;
      case 'asset': case 'home': return <Home className={`${classStr} text-indigo-400`} />;
      case 'car': return <Car className={classStr} />;
      case 'plane': return <Plane className={classStr} />;
      case 'laptop': return <Laptop className={classStr} />;
      case 'shield': return <ShieldAlert className={classStr} />;
      case 'wedding': case 'heart': return <Heart className={`${classStr} text-rose-400`} />;
      case 'family': return <Users className={`${classStr} text-blue-400`} />;
      case 'grad': return <GraduationCap className={classStr} />;
      case 'business': return <Briefcase className={classStr} />;
      case 'general': case 'target': default: return <Vault className={classStr} />;
    }
  };

  const calculateMonthlyRecommendation = (remaining, targetDateStr) => {
    if (!targetDateStr || remaining <= 0) return null;
    const now = new Date();
    const [y, m, d] = targetDateStr.split('-').map(Number);
    const tDate = new Date(y, m - 1, d);

    const monthDiff = (tDate.getFullYear() - now.getFullYear()) * 12 + (tDate.getMonth() - now.getMonth());
    const months = Math.max(monthDiff, 1);

    const recPerMonth = Math.ceil((remaining / months) * 10) / 10;
    return { recPerMonth, months };
  };

  const calculateStockDisplay = (item) => {
    const origCurr = item.currency || mainCurrency;
    const initCap = convertCurrency(item.initialCapital || 0, origCurr, mainCurrency);
    const pct = item.performancePercent || 0;
    const isProfit = item.performanceType !== 'loss';

    const diffNominal = Math.round(initCap * (pct / 100));
    const totalBalance = isProfit ? (initCap + diffNominal) : (initCap - diffNominal);

    let durationText = '';
    if (item.startDate) {
      const start = new Date(item.startDate);
      const now = new Date();
      const diffTime = Math.abs(now - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const months = Math.floor(diffDays / 30);
      const years = (diffDays / 365).toFixed(1);

      if (diffDays < 30) {
        durationText = `${diffDays} ${t.unitDays}`;
      } else if (months < 12) {
        durationText = `${months} ${t.unitMonths}`;
      } else {
        durationText = `${years} ${t.unitYears}`;
      }
    }

    return { initCap, totalBalance, diffNominal, pct, isProfit, durationText };
  };

  const calculateAssetDisplay = (item) => {
    const origCurr = item.currency || mainCurrency;
    const initCost = convertCurrency(item.initialCapital || 0, origCurr, mainCurrency);
    const marketVal = convertCurrency(item.currentAmount || 0, origCurr, mainCurrency);
    const diffVal = marketVal - initCost;
    const pctGain = initCost > 0 ? Number(((diffVal / initCost) * 100).toFixed(2)) : 0;
    const isGain = diffVal >= 0;

    let durationText = '';
    if (item.startDate) {
      const start = new Date(item.startDate);
      const now = new Date();
      const diffTime = Math.abs(now - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const months = Math.floor(diffDays / 30);
      const years = (diffDays / 365).toFixed(1);

      if (diffDays < 30) {
        durationText = `${diffDays} ${t.unitDays}`;
      } else if (months < 12) {
        durationText = `${months} ${t.unitMonths}`;
      } else {
        durationText = `${years} ${t.unitYears}`;
      }
    }

    return { initCost, marketVal, diffVal, pctGain, isGain, durationText };
  };

  const totalCashSavingsAmount = goals
    .filter(item => item.goalType === 'cash')
    .reduce((acc, item) => {
      const origCurr = item.currency || mainCurrency;
      return acc + convertCurrency(item.currentAmount || 0, origCurr, mainCurrency);
    }, 0);

  const inflationRateNum = parseFloat(annualInflationRate) || 0;
  const forecastYear1 = Math.round(totalCashSavingsAmount / Math.pow(1 + inflationRateNum / 100, 1));
  const forecastYear3 = Math.round(totalCashSavingsAmount / Math.pow(1 + inflationRateNum / 100, 3));
  const forecastYear5 = Math.round(totalCashSavingsAmount / Math.pow(1 + inflationRateNum / 100, 5));

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto w-full pb-10 text-gray-800 dark:text-gray-200">
      
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Vault className={`w-6 h-6 ${currentTheme.icon}`} />
            <span className={`bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>
              {t.title}
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.subtitle}</p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r ${currentTheme.btn} shadow-md flex items-center gap-1.5 transition hover:opacity-90 cursor-pointer`}
        >
          <Plus className="w-4 h-4" /> {t.addBtn}
        </button>
      </div>

      {/* INFLATION & SAVINGS RATE FORECAST WIDGET */}
      <div className="bg-gray-200/80 dark:bg-gray-950 border border-gray-300 dark:border-gray-900 p-4 rounded-3xl shadow-sm flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <LineChart className="w-4 h-4 text-amber-500" />
            {t.forecastTitle}
          </h3>
          <div className="flex items-center gap-1.5 bg-white dark:bg-gray-900 px-2.5 py-1 rounded-xl border border-gray-300 dark:border-gray-800">
            <span className="text-[10px] font-bold text-gray-500">Inflasi:</span>
            <input
              type="number"
              step="0.1"
              value={annualInflationRate}
              onChange={(e) => setAnnualInflationRate(e.target.value)}
              className="w-12 text-xs font-extrabold bg-transparent text-amber-500 focus:outline-none text-right"
            />
            <span className="text-[10px] font-bold text-amber-500">%</span>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{t.forecastSubtitle}</p>

        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-300/50 dark:border-gray-900">
          <div className="p-2.5 rounded-2xl bg-white/70 dark:bg-gray-900/70 border border-gray-300 dark:border-gray-800 text-center flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-500">{t.year1Forecast}</span>
            <span className="text-xs sm:text-sm font-extrabold text-rose-500 mt-1">{sym} {forecastYear1.toLocaleString()}</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-white/70 dark:bg-gray-900/70 border border-gray-300 dark:border-gray-800 text-center flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-500">{t.year3Forecast}</span>
            <span className="text-xs sm:text-sm font-extrabold text-rose-500 mt-1">{sym} {forecastYear3.toLocaleString()}</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-white/70 dark:bg-gray-900/70 border border-gray-300 dark:border-gray-800 text-center flex flex-col justify-between">
            <span className="text-[10px] font-bold text-gray-500">{t.year5Forecast}</span>
            <span className="text-xs sm:text-sm font-extrabold text-rose-500 mt-1">{sym} {forecastYear5.toLocaleString()}</span>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 dark:text-gray-500 italic mt-0.5">{t.inflationNote}</p>
      </div>

      {/* LIST GOALS & ASSETS */}
      <div className="flex flex-col gap-4 mt-1">
        {goals.length === 0 ? (
          <div className="bg-gray-200/80 dark:bg-gray-950 border border-gray-300 dark:border-gray-900 p-8 rounded-3xl text-center flex flex-col items-center justify-center gap-2 shadow-sm">
            <Vault className="w-12 h-12 opacity-30 text-gray-500" />
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t.noGoals}</p>
          </div>
        ) : (
          goals.map((item) => {
            const isGold = item.goalType === 'gold';
            const isStock = item.goalType === 'stock';
            const isAsset = item.goalType === 'asset';
            const origCurr = item.currency || mainCurrency;

            let convertedTarget = Number(item.targetAmount) || 0;
            let convertedCurrent = Number(item.currentAmount) || 0;

            if (!isGold && !isStock && !isAsset) {
              convertedTarget = convertCurrency(item.targetAmount || 0, origCurr, mainCurrency);
              convertedCurrent = convertCurrency(item.currentAmount || 0, origCurr, mainCurrency);
            }
            
            const hasTarget = convertedTarget > 0;
            const percentage = hasTarget ? Math.min(Math.round((convertedCurrent / convertedTarget) * 100), 100) : 0;
            const remaining = hasTarget ? Math.max(convertedTarget - convertedCurrent, 0) : 0;
            const isCompleted = hasTarget && percentage >= 100;

            const recData = (!isStock && !isAsset && hasTarget) ? calculateMonthlyRecommendation(remaining, item.targetDate) : null;

            const goldCurrentValueInMainCurrency = isGold ? Math.round(convertedCurrent * goldPricePerGramInMainCurrency) : 0;
            const goldTargetValueInMainCurrency = isGold && hasTarget ? Math.round(convertedTarget * goldPricePerGramInMainCurrency) : 0;

            const stockDisp = isStock ? calculateStockDisplay(item) : null;
            const assetDisp = isAsset ? calculateAssetDisplay(item) : null;

            const displayTitle = isGold ? t.goldDefaultName : isAsset ? (item.title || t.assetDefaultName) : item.title;
            const lastUpdatedText = formatDateTimeByLang(item.updatedAt || item.createdAt);

            return (
              <div
                key={item.id}
                onClick={() => handleOpenModal(item)}
                className={`bg-gray-200/80 dark:bg-gray-950 border ${item.isFrozen ? 'border-amber-500/40 dark:border-amber-500/30' : 'border-gray-300 dark:border-gray-900'} p-5 rounded-3xl shadow-sm flex flex-col gap-3 cursor-pointer hover:border-gray-400 dark:hover:border-gray-800 transition-all group relative overflow-hidden`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2.5 rounded-2xl ${isGold ? 'bg-amber-500/10 text-amber-500' : isStock ? 'bg-sky-500/10 text-sky-400' : isAsset ? 'bg-indigo-500/10 text-indigo-400' : 'bg-gray-100 dark:bg-gray-900 ' + currentTheme.icon}`}>
                      {renderGoalIcon(item.categoryIcon)}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base text-gray-900 dark:text-white flex items-center gap-2">
                        {displayTitle}

                        {isGold && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 font-bold">
                            🥇 {item.currentAmount || 0}g
                          </span>
                        )}

                        {isStock && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 font-bold">
                            {t.stockPortfolioBadge}
                          </span>
                        )}

                        {isAsset && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold">
                            {t.assetTrackerBadge}
                          </span>
                        )}

                        {item.isFrozen && (
                          <Lock className="w-3.5 h-3.5 text-amber-500" title={t.frozenBadge} />
                        )}
                        <Edit3 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-65 transition-opacity text-gray-400" />
                      </h3>

                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        {item.startDate && (
                          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-500" /> {t.startDateLabel}: {formatDateOnlyByLang(item.startDate)}
                          </p>
                        )}

                        {!isStock && !isAsset && item.targetDate && (
                          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-amber-500" /> {t.deadline}: {formatDateOnlyByLang(item.targetDate)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.isFrozen && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> {t.frozenBadge}
                      </span>
                    )}

                    <button
                      onClick={(e) => handleOpenDeposit(e, item)}
                      className="px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 text-[10px] font-bold transition flex items-center gap-1"
                    >
                      <TrendingUp className="w-3 h-3" /> {t.depositBtn}
                    </button>

                    {isCompleted && (
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {t.completedBadge}
                      </span>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGoal(item.id, item.isFrozen);
                      }}
                      className="p-1.5 text-gray-400 hover:text-rose-500 transition rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isAsset ? (
                  <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col gap-2.5 mt-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                        <Home className="w-4 h-4" /> {t.marketValueLabel}
                      </span>
                      <span className="text-base font-extrabold text-indigo-400">
                        {sym} {assetDisp.marketVal.toLocaleString()}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-indigo-500/20 grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block text-[10px]">{t.initialCapitalLabel}</span>
                        <span className="font-extrabold text-gray-700 dark:text-gray-300">{sym} {assetDisp.initCost.toLocaleString()}</span>
                      </div>

                      <div className="text-right">
                        <span className="text-gray-500 dark:text-gray-400 block text-[10px]">{t.performanceStatus}</span>
                        <span className={`font-extrabold flex items-center justify-end gap-1 ${assetDisp.isGain ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {assetDisp.isGain ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                          {assetDisp.isGain ? '+' : '-'}{sym} {Math.abs(assetDisp.diffVal).toLocaleString()} ({assetDisp.isGain ? '+' : '-'}{assetDisp.pctGain}%)
                        </span>
                      </div>
                    </div>

                    {assetDisp.durationText && (
                      <div className="flex items-center justify-between text-[10px] opacity-80 pt-1 border-t border-indigo-500/10 text-indigo-300">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {t.investmentDuration}</span>
                        <span className="font-bold">{assetDisp.durationText}</span>
                      </div>
                    )}
                  </div>
                ) : isStock ? (
                  <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex flex-col gap-2.5 mt-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                        <BarChart3 className="w-4 h-4" /> {t.totalBalance}
                      </span>
                      <span className="text-base font-extrabold text-sky-400">
                        {sym} {stockDisp.totalBalance.toLocaleString()}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-sky-500/20 grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block text-[10px]">{t.initialCapitalLabel}</span>
                        <span className="font-extrabold text-gray-700 dark:text-gray-300">{sym} {stockDisp.initCap.toLocaleString()}</span>
                      </div>

                      <div className="text-right">
                        <span className="text-gray-500 dark:text-gray-400 block text-[10px]">{t.performanceStatus}</span>
                        <span className={`font-extrabold flex items-center justify-end gap-1 ${stockDisp.isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {stockDisp.isProfit ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                          {stockDisp.isProfit ? '+' : '-'}{sym} {stockDisp.diffNominal.toLocaleString()} ({stockDisp.isProfit ? '+' : '-'}{stockDisp.pct}%)
                        </span>
                      </div>
                    </div>

                    {stockDisp.durationText && (
                      <div className="flex items-center justify-between text-[10px] opacity-80 pt-1 border-t border-sky-500/10 text-sky-300">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {t.investmentDuration}</span>
                        <span className="font-bold">{stockDisp.durationText}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {hasTarget ? (
                      <>
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-gray-500 dark:text-gray-400">{percentage}%</span>
                          <span className={`bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>
                            {isGold ? `${convertedCurrent}g / ${convertedTarget}g` : `${sym} ${convertedCurrent.toLocaleString()} / ${sym} ${convertedTarget.toLocaleString()}`}
                          </span>
                        </div>

                        <div className="w-full bg-gray-300 dark:bg-gray-800 h-3 rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${isGold ? 'from-amber-400 to-yellow-500' : currentTheme.btn} transition-all duration-500 rounded-full`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between items-center text-xs font-bold py-1">
                        <span className="text-gray-500 dark:text-gray-400">{t.totalAccumulated}</span>
                        <span className={`bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent font-extrabold text-sm`}>
                          {isGold ? `${convertedCurrent} g` : `${sym} ${convertedCurrent.toLocaleString()}`}
                        </span>
                      </div>
                    )}

                    {isGold && (
                      <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-600 dark:text-amber-400 flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1">
                            <Coins className="w-3 h-3 text-amber-500" /> {t.goldValueEst}:
                          </span>
                          <span>
                            {sym} {goldCurrentValueInMainCurrency.toLocaleString()}
                            {hasTarget && ` / ${sym} ${goldTargetValueInMainCurrency.toLocaleString()}`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] opacity-80 pt-0.5 border-t border-amber-500/10">
                          <span>{t.goldLivePriceRate}</span>
                          <span>{sym} {goldPricePerGramInMainCurrency.toLocaleString()} / g</span>
                        </div>
                      </div>
                    )}

                    {hasTarget && (
                      <div className="flex justify-between items-center text-[11px] font-medium text-gray-500 dark:text-gray-400 pt-0.5 flex-wrap gap-1">
                        <span className="font-semibold">
                          {t.remaining}: <strong className={`bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent font-bold`}>
                            {isGold ? `${remaining} g` : `${sym} ${remaining.toLocaleString()}`}
                        </strong>
                        </span>

                        {recData && !isCompleted && (
                          <span className="text-[10px] font-semibold bg-gray-100 dark:bg-gray-900 px-2 py-0.5 rounded-lg border border-gray-300 dark:border-gray-800 text-gray-600 dark:text-gray-300">
                            💡 {isGold ? t.recommendMonthlyGold : t.recommendMonthly}: <strong className="text-emerald-500 font-bold">{isGold ? `${recData.recPerMonth} g` : `${sym} ${recData.recPerMonth.toLocaleString()}`}</strong> ({recData.months} {t.monthsLeft})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {lastUpdatedText && (
                  <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-300/50 dark:border-gray-900">
                    <RefreshCw className="w-3 h-3 opacity-70" />
                    <span>{t.lastUpdated}</span>
                    <span className="font-semibold">{lastUpdatedText}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL EDIT / TAMBAH TARGET & ASSET */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveGoal}
            className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-5 flex flex-col gap-4 shadow-2xl border border-gray-200 dark:border-gray-800"
          >
            <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-3">
              <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Coins className={`w-4 h-4 ${currentTheme.icon}`} />
                {editingId ? t.editGoalTitle : t.addGoalTitle}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 max-h-[65vh] overflow-y-auto pr-1">
              <div>
                <label className="text-[11px] font-bold text-gray-500 mb-1 block">{t.inputTypeLabel}</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGoalType('cash');
                      if (['gold', 'stock', 'asset'].includes(categoryIcon)) setCategoryIcon('general');
                    }}
                    className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center cursor-pointer ${goalType === 'cash' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-500'}`}
                  >
                    {t.typeCash}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGoalType('gold');
                      setTitle(t.goldDefaultName);
                      setCategoryIcon('gold');
                    }}
                    className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center cursor-pointer ${goalType === 'gold' ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-500'}`}
                  >
                    {t.typeGold}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGoalType('stock');
                      if (title === t.goldDefaultName || title === t.assetDefaultName) setTitle('');
                      setCategoryIcon('stock');
                    }}
                    className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center cursor-pointer ${goalType === 'stock' ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-500'}`}
                  >
                    {t.typeStock}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGoalType('asset');
                      if (!title.trim() || title === t.goldDefaultName) setTitle(t.assetDefaultName);
                      setCategoryIcon('home');
                    }}
                    className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center cursor-pointer ${goalType === 'asset' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-500'}`}
                  >
                    {t.typeAsset}
                  </button>
                </div>
              </div>

              {goalType === 'gold' && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Settings2 className="w-3.5 h-3.5" /> {t.goldRateSettingLabel} ({sym})
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberWithSeparator(customGoldPriceInput)}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/\D/g, '');
                      setCustomGoldPriceInput(rawValue);
                      if (Number(rawValue) > 0) {
                        setGoldPricePerGramInMainCurrency(Number(rawValue));
                      }
                    }}
                    className="w-full p-2 rounded-xl border border-amber-500/30 bg-white dark:bg-gray-900 text-xs font-bold text-amber-600 dark:text-amber-400 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-gray-500 mb-1 block">{t.inputTitle}</label>
                <input
                  type="text"
                  required
                  disabled={goalType === 'gold'}
                  value={goalType === 'gold' ? t.goldDefaultName : title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={goalType === 'stock' ? t.placeholderStockTitle : goalType === 'asset' ? t.placeholderAssetTitle : t.placeholderTitle}
                  className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-current disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              {goalType === 'cash' && (
                <div>
                  <label className="text-[11px] font-bold text-gray-500 mb-1 block">{t.inputCategory}</label>
                  <select
                    value={categoryIcon}
                    onChange={(e) => setCategoryIcon(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-current cursor-pointer"
                  >
                    <option value="general">🏦 {t.catOptions.general}</option>
                    <option value="car">🚗 {t.catOptions.car}</option>
                    <option value="home">🏠 {t.catOptions.home}</option>
                    <option value="plane">✈️ {t.catOptions.plane}</option>
                    <option value="laptop">💻 {t.catOptions.laptop}</option>
                    <option value="shield">🛡️ {t.catOptions.shield}</option>
                    <option value="wedding">💍 {t.catOptions.wedding}</option>
                    <option value="family">👨‍👩‍👧‍👦 {t.catOptions.family}</option>
                    <option value="grad">🎓 {t.catOptions.grad}</option>
                    <option value="business">💼 {t.catOptions.business}</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-gray-500 mb-1 block">
                  {t.inputStartDateLabel}
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-current cursor-pointer"
                />
              </div>

              {goalType !== 'stock' && goalType !== 'asset' && (
                <div>
                  <label className="text-[11px] font-bold text-gray-500 mb-1 block">
                    {goalType === 'gold' 
                      ? t.inputTargetGold 
                      : categoryIcon === 'shield' 
                      ? t.inputTargetOptional 
                      : `${t.inputTarget} (${sym})`}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required={goalType === 'cash' && categoryIcon !== 'shield'}
                    value={formatNumberWithSeparator(targetAmount)}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/\D/g, '');
                      setTargetAmount(rawValue);
                    }}
                    placeholder="1.000.000"
                    className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-current"
                  />
                </div>
              )}

              {goalType === 'stock' && (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 mb-1 block">
                      {t.inputInitialCapital} ({sym})
                    </label>
                    <input
                      type="text"
                    inputMode="numeric"
                      required
                      value={formatNumberWithSeparator(initialCapital)}
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/\D/g, '');
                        setInitialCapital(rawValue);
                      }}
                      placeholder="10.000"
                      className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-current"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-500 mb-1 block">
                      {t.inputPerformancePercent}
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={performanceType}
                        onChange={(e) => setPerformanceType(e.target.value)}
                        className={`p-2.5 rounded-xl border text-xs font-bold focus:outline-none cursor-pointer ${
                          performanceType === 'profit' 
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' 
                            : 'bg-rose-500/10 border-rose-500 text-rose-500'
                        }`}
                      >
                        <option value="profit">{t.optProfit}</option>
                        <option value="loss">{t.optLoss}</option>
                      </select>

                      <div className="relative flex-1">
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={performancePercent}
                          onChange={(e) => setPerformancePercent(e.target.value)}
                          placeholder="2.55"
                          className="w-full p-2.5 pr-8 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-current"
                        />
                        <span className="absolute right-3 top-2.5 text-xs font-bold text-gray-400">%</span>
                      </div>
                  </div>
                </div>
                </>
            )}

            {goalType === 'asset' && (
              <>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 mb-1 block">
                    {t.inputInitialCapital} ({sym})
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={formatNumberWithSeparator(initialCapital)}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/\D/g, '');
                      setInitialCapital(rawValue);
                    }}
                    placeholder="100.000.000"
                    className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-current"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-500 mb-1 block">
                    {t.inputMarketValue} ({sym})
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={formatNumberWithSeparator(assetMarketValue)}
                    onChange={(e) => {
                      const rawValue = e.target.value.replace(/\D/g, '');
                      setAssetMarketValue(rawValue);
                    }}
                    placeholder="120.000.000"
                    className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-current"
                  />
                </div>
              </>
            )}

            {goalType !== 'stock' && goalType !== 'asset' && (
              <div>
                <label className="text-[11px] font-bold text-gray-500 mb-1 block">
                  {goalType === 'gold' ? t.inputCurrentGold : `${t.inputCurrent} (${sym})`}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumberWithSeparator(currentAmount)}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/\D/g, '');
                    setCurrentAmount(rawValue);
                  }}
                  placeholder="0"
                  className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-current"
                />
                
                {goalType === 'cash' && (
                  <div className="mt-2.5 p-2.5 rounded-2xl bg-gray-100/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700/80 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="radio" 
                          id="optAllTime" 
                          name="copyMode" 
                          checked={copyMode === 'allTime'} 
                          onChange={() => setCopyMode('allTime')} 
                          className="cursor-pointer"
                        />
                        <label htmlFor="optAllTime" className="cursor-pointer">{t.copyOptAllTime}</label>
                      </div>
                      <span className="font-extrabold text-emerald-500">{sym} {allTimeSavings.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="radio" 
                          id="optMonth" 
                          name="copyMode" 
                          checked={copyMode === 'month'} 
                          onChange={() => setCopyMode('month')} 
                          className="cursor-pointer"
                        />
                        <label htmlFor="optMonth" className="cursor-pointer">{t.copyOptMonth}</label>
                      </div>

                      {copyMode === 'month' && (
                        <input 
                          type="month" 
                          value={filterMonth} 
                          onChange={(e) => setFilterMonth(e.target.value)} 
                          className="bg-white dark:bg-gray-900 px-1.5 py-0.5 rounded-lg border border-gray-300 dark:border-gray-700 text-[9px] font-bold cursor-pointer"
                        />
                      )}

                      <span className="font-extrabold text-emerald-500">{sym} {selectedMonthSavings.toLocaleString()}</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleApplyCopySavings}
                      className="mt-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-bold transition border border-emerald-500/20 cursor-pointer"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      {copyMode === 'allTime' ? t.useAllTimeBtn : t.useMonthBtn}
                    </button>
                  </div>
                )}
              </div>
            )}

            {goalType !== 'stock' && goalType !== 'asset' && (
              <div>
                <label className="text-[11px] font-bold text-gray-500 mb-1 block">{t.inputDate}</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-current cursor-pointer"
                />
              </div>
            )}

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col gap-1 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFrozen}
                  onChange={(e) => setIsFrozen(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> {t.freezeLabel}
                </span>
              </label>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 pl-6">
                {t.freezeDesc}
              </p>
            </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="flex-1 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            {t.cancelBtn}
          </button>
          <button
            type="submit"
            className={`flex-1 py-2 text-xs font-bold text-white bg-gradient-to-r ${currentTheme.btn} rounded-xl shadow-md transition hover:opacity-90 flex items-center justify-center gap-1`}
          >
            <Check className="w-4 h-4" /> {t.saveBtn}
          </button>
        </div>
      </form>
    </div>
  )}

  {/* MODAL DEPOSIT / TAMBAH NILAI ASET */}
  {showDepositModal && selectedGoalForDeposit && (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[210] flex items-center justify-center p-4">
      <form
        onSubmit={handleSaveDeposit}
        className="bg-white dark:bg-gray-900 rounded-3xl max-w-sm w-full p-5 flex flex-col gap-4 shadow-2xl border border-gray-200 dark:border-gray-800"
      >
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-3">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            {t.depositTitle}
          </h3>
          <button
            type="button"
            onClick={() => setShowDepositModal(false)}
            className="p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
            {selectedGoalForDeposit.goalType === 'gold' ? t.goldDefaultName : selectedGoalForDeposit.title}
            {selectedGoalForDeposit.goalType === 'gold' && <span className="text-amber-500 font-bold">(🥇 Gram)</span>}
            {selectedGoalForDeposit.goalType === 'stock' && <span className="text-sky-400 font-bold">(📈 Saham)</span>}
            {selectedGoalForDeposit.goalType === 'asset' && <span className="text-indigo-400 font-bold">(🏡 Aset)</span>}
            {selectedGoalForDeposit.isFrozen && <Lock className="w-3.5 h-3.5 text-amber-500" />}
          </span>

          <label className="text-[11px] font-bold text-gray-500 mt-1 block">
            {selectedGoalForDeposit.goalType === 'gold' 
              ? t.depositAmountGoldLabel 
              : selectedGoalForDeposit.goalType === 'stock'
              ? `${t.depositAmountStockLabel} (${sym})`
              : selectedGoalForDeposit.tag === 'asset' || selectedGoalForDeposit.goalType === 'asset'
              ? `${t.depositAmountAssetLabel} (${sym})`
              : `${t.depositAmountLabel} (${sym})`}
          </label>
          <input
            type="text"
            inputMode="numeric"
            required
            autoFocus
            value={formatNumberWithSeparator(depositAmount)}
            onChange={(e) => {
              const rawValue = e.target.value.replace(/\D/g, '');
              setDepositAmount(rawValue);
            }}
            placeholder={selectedGoalForDeposit.goalType === 'gold' ? "1" : "50.000"}
            className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-current"
          />
        </div>

        <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setShowDepositModal(false)}
            className="flex-1 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            {t.cancelBtn}
          </button>
          <button
            type="submit"
            className={`flex-1 py-2 text-xs font-bold text-white bg-gradient-to-r ${currentTheme.btn} rounded-xl shadow-md transition hover:opacity-90 flex items-center justify-center gap-1`}
          >
            <Check className="w-4 h-4" /> {t.saveDepositBtn}
          </button>
        </div>
      </form>
    </div>
  )}
    </div>
  );
}
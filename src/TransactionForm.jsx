  import { useState, useRef, useMemo } from 'react';
  import { 
    Camera, Trash2, PlusCircle, Loader2, ShieldCheck,
    Zap, Building2, Laptop, TrendingUp as TrendingUpIcon,
    Coins, Landmark, Briefcase, Plane, Car, Gift, Award, CreditCard, Banknote, X,
    Sliders
  } from 'lucide-react';

  // Turso Client & Firebase Auth
  import { turso } from './lib/turso';
  import { auth } from './lib/firebase';
  // Database Offline & Sync Helper
  import { initDB, saveLocalItem, addToSyncQueue } from './lib/db';
  

  import { getThemeStyles } from './Settings';

  // Import Helper Kategori Terpusat
  import { 
    getCategoryIcon, 
    getStandardCategoryValue, 
    CATEGORIES_BY_LANG, 
    normalizeCategoryString
  } from './categoryHelper';

  // Map Icon khusus kategori Non-Operasional / Non-Rutin
  const NON_OPERATIONAL_ICONS = {
    'properti': Building2, 'property': Building2, '不動産': Building2, 'عقارات': Building2, '房产': Building2,
    'elektronik': Laptop, 'electronics': Laptop, '電子機器': Laptop, 'إلكترونيات': Laptop, '电子产品': Laptop,
    'saham': TrendingUpIcon, 'stocks': TrendingUpIcon, '株式': TrendingUpIcon, 'أسهم': TrendingUpIcon, '股票': TrendingUpIcon,
    'gold': Coins, '金': Coins, 'ذهب': Coins, '黄金': Coins,
    'bisnis': Briefcase, 'business': Briefcase, '事業': Briefcase, 'أعمال': Briefcase, '商业': Briefcase,
    'traveling': Plane, '旅行': Plane, 'سفر': Plane, '旅游': Plane,
    'kendaraan': Car, 'vehicle': Car, 'vehicles': Car, '乗り物': Car, 'مركبات': Car, '车辆': Car, // <-- Tambahkan 'vehicle' di sini!
    'bonus': Award, 'ボーナス': Award, 'مكافأة': Award, '奖金': Award,
    'freelance': Briefcase, 'フリーランス': Briefcase, 'عمل حر': Briefcase, '自由职业': Briefcase,
    'investasi': TrendingUpIcon, "investement" : TrendingUpIcon ,'投資': TrendingUpIcon, 'استثمار': TrendingUpIcon, '投资': TrendingUpIcon,
    'hutang': CreditCard, '借入': CreditCard, 'قرض': CreditCard, '借款': CreditCard,
    'hadiah': Gift, 'ギフト': Gift, 'هدية': Gift, '礼物': Gift
  };

  export default function TransactionForm({ onSuccess, mainCurrency, language, twoToneTheme }) {
    // Helper Waktu Saat Ini (HH:mm)
    const getCurrentTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    };

// --- TAMBAHKAN INI (Helper Format Angka dengan Titik Ribuan) ---
  const formatNumberWithSeparator = (value) => {
    if (!value) return '';
    const cleanValue = String(value).replace(/\D/g, '');
    return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handleAmountChange = (e) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    setAmount(rawValue);
  };


    const [type, setType] = useState('expense');
    const [expenseNature, setExpenseNature] = useState('operational'); // 'operational' | 'asset'
    const [incomeNature, setIncomeNature] = useState('salary'); // 'salary' | 'asset' (Rutin vs Non-Rutin)
    
    const [category, setCategory] = useState('');
    const [customCategory, setCustomCategory] = useState('');
    const [isCustom, setIsCustom] = useState(false);
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [note, setNote] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState(getCurrentTime());
    const [receiptImage, setReceiptImage] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- STATE GARANSI BARANG ---
    const [hasWarranty, setHasWarranty] = useState(false);
    const [warrantyMonths, setWarrantyMonths] = useState('12');
    const [isCustomWarrantyMonths, setIsCustomWarrantyMonths] = useState(false);
    const [customWarrantyInput, setCustomWarrantyInput] = useState('');

    const fileInputRef = useRef(null);
    const activeThemeId = twoToneTheme || 'emerald';
    const currentTheme = getThemeStyles(activeThemeId);

    const tForm = {
      id: {
        income: 'Pemasukan', expense: 'Pengeluaran', catLabel: 'Kategori',
        expenseNatureLabel: 'Tipe Pengeluaran',
        operationalExpense: 'Pengeluaran Rutin (Operasional)',
        operationalSub: '',
        assetExpense: 'Pengeluaran Tabungan / Aset (Non-Operasional)',
        assetSub: '',
        incomeNatureLabel: 'Tipe Pemasukan',
        salaryIncome: 'Pendapatan Rutin',
        salarySub: '',
        assetIncome: 'Pendapatan Pasif / Aset (Tidak Rutin)',
        assetIncomeSub: '',
        customToggle: '+ Ketik Kategori Lain', selectToggle: '« Pilih dari Daftar', customPlaceholder: 'Nama kategori baru...',
        amtLabel: 'Nominal', amtPlaceholder: '', payLabel: 'Metode Pembayaran',
        dateLabel: 'Tanggal Beli / Transaksi', timeLabel: 'Waktu', noteLabel: 'Catatan (Opsional)', submitBtn: '', saving: 'Menyimpan...',
        alertCat: 'Silakan pilih atau ketik kategori terlebih dahulu!', alertAmt: 'Masukkan nominal transaksi!', warningMsg: '⚠️ Pilih kategori terlebih dahulu.',
        receipt: 'Bukti Struk', upload: '', remove: 'Hapus', billText: 'Tagihan',
        warrantyLabel: 'Barang Bergaransi?', warrantyDuration: 'Masa Garansi:',
        warrantyCustomToggle: '+ Custom Bulan', warrantySelectToggle: '« Pilih Preset',
        warrantyCustomPlaceholder: 'Contoh: 18', warrantyMonthUnit: 'Bulan',
        warrantyOptions: { '1': '1 Bulan', '3': '3 Bulan', '6': '6 Bulan', '12': '1 Tahun (12 Bln)', '24': '2 Tahun (24 Bln)', '36': '3 Tahun (36 Bln)' },
        warrantyExpiryPreview: 'Garansi Berlaku S/d:',
        paymentMethods: { "Cash": "Cash (Tunai)", "Credit Card": "Credit Card", "Bank Transfer": "Bank Transfer", "E-Wallet": "E-Wallet" }
      },
      jp: {
        income: '収入', expense: '支出', catLabel: 'カテゴリー',
        expenseNatureLabel: '支出の性質',
        operationalExpense: '定期支出（運用コスト）',
        operationalSub: '',
        assetExpense: '貯蓄 / 資産支出（非運用コスト）',
        assetSub: '',
        incomeNatureLabel: '収入の性質',  
        salaryIncome: '定期収入',
        salarySub: '',
        assetIncome: '不労所得 / 資産収入 (不定期)',
        assetIncomeSub: '',
        customToggle: '+ カスタム入力', selectToggle: '« リストから選択', customPlaceholder: '新しいカテゴリー名...',
        amtLabel: '金額', amtPlaceholder: '', payLabel: '支払い方法',
        dateLabel: '購入日 / 取引日', timeLabel: '時間', noteLabel: 'メモ (任意)', submitBtn: '', saving: '保存中...',
        alertCat: '先にカテゴリーを選択または入力してください！', alertAmt: '金額を入力してください！', warningMsg: '⚠️ カテゴリーを選択してください。',
        receipt: 'レシート', upload: '', remove: '削除', billText: '請求書',
        warrantyLabel: '保証対象の商品？', warrantyDuration: '保証期間:',
        warrantyCustomToggle: '+ カスタム月数', warrantySelectToggle: '« リストから選択',
        warrantyCustomPlaceholder: '例: 18', warrantyMonthUnit: 'ヶ月',
        warrantyOptions: { '1': '1ヶ月', '3': '3ヶ月', '6': '6ヶ月', '12': '1年 (12ヶ月)', '24': '2年 (24ヶ月)', '36': '3年 (36ヶ月)' },
        warrantyExpiryPreview: '保証有効期限:',
        paymentMethods: { "Cash": "現金 (Cash)", "Credit Card": "クレジットカード", "Bank Transfer": "銀行振込", "E-Wallet": "電子マネー" }
      },
      en: {
        income: 'Income', expense: 'Expense', catLabel: 'Category',
        expenseNatureLabel: 'Expense Type',
        operationalExpense: 'Routine Expense (Operational)',
        operationalSub: '',
        assetExpense: 'Savings / Asset Expenses (Non-Operational)',
        assetSub: '',
        incomeNatureLabel: 'Income Type',
        salaryIncome: 'Routine Income',
        salarySub: '',
        assetIncome: 'Passive / Asset Income (Non-Routine)',
        assetIncomeSub: '',
        customToggle: '+ Custom Category', selectToggle: '« Select from list', customPlaceholder: 'New category name...',
        amtLabel: 'Amount', amtPlaceholder: '', payLabel: 'Payment Method',
        dateLabel: 'Purchase / Transaction Date', timeLabel: 'Time', noteLabel: 'Note (Optional)', submitBtn: '', saving: 'Saving...',
        alertCat: 'Please select or type a category first!', alertAmt: 'Please enter the transaction amount!', warningMsg: '⚠️ Select category first.',
        receipt: 'Receipt', upload: '', remove: 'Remove', billText: 'Bill',
        warrantyLabel: 'Item Has Warranty?', warrantyDuration: 'Warranty Period:',
        warrantyCustomToggle: '+ Custom Months', warrantySelectToggle: '« Select Preset',
        warrantyCustomPlaceholder: 'e.g. 18', warrantyMonthUnit: 'Mos',
        warrantyOptions: { '1': '1 Month', '3': '3 Months', '6': '6 Months', '12': '1 Year (12 Mos)', '24': '2 Years (24 Mos)', '36': '3 Years (36 Mos)' },
        warrantyExpiryPreview: 'Warranty Valid Until:',
        paymentMethods: { "Cash": "Cash", "Credit Card": "Credit Card", "Bank Transfer": "Bank Transfer", "E-Wallet": "E-Wallet" }
      },
      ar: {
        income: 'دخل', expense: 'مصروف', catLabel: 'الفئة',
        expenseNatureLabel: 'نوع المصروف',
        operationalExpense: 'النفقات الروتينية (التشغيلية)',
        operationalSub: '',
        assetExpense: 'نفقات الادخار / الأصول (غير التشغيلية)',
        assetSub:'',
        incomeNatureLabel: 'نوع الدخل',
        salaryIncome: 'الدخل الروتيني',
        salarySub: '',
        assetIncome: 'الدخل السلبي / دخل الأصول (غير روتيني)',
        assetIncomeSub: '',
        customToggle: '+ فئة مخصصة', selectToggle: '« اختر من القائمة', customPlaceholder: 'اسم الفئة الجديدة...',
        amtLabel: 'المبلغ', amtPlaceholder: '', payLabel: 'طريقة الدفع',
        dateLabel: 'تاريخ الشراء / المعاملة', timeLabel: 'الوقت', noteLabel: 'ملاحظة (اختياري)', submitBtn: '', saving: 'جاري الحفظ...',
        alertCat: 'الرجاء اختيار أو كتابة الفئة أولاً!', alertAmt: 'الرجاء إدخال المبلغ!', warningMsg: '⚠️ اختر الفئة أولاً.',
        receipt: 'إيصال', upload: '', remove: 'حذف', billText: 'فاتورة',
        warrantyLabel: 'منتج مع ضمان؟', warrantyDuration: 'مدة الضمان:',
        warrantyCustomToggle: '+ أشهر مخصصة', warrantySelectToggle: '« اختر المسبق',
        warrantyCustomPlaceholder: 'مثال: 18', warrantyMonthUnit: 'أشهر',
        warrantyOptions: { '1': 'شهر واحد', '3': '3 أشهر', '6': '6 أشهر', '12': 'سنة واحدة (12 شهر)', '24': '24 شهر', '36': '3 سنوات (36 شهر)' },
        warrantyExpiryPreview: 'الضمان ساري حتى:',
        paymentMethods: { "Cash": "نقداً", "Credit Card": "بطاقة ائتمان", "Bank Transfer": "تحويل بنكي", "E-Wallet": "محفظة إلكترونية" }
      },
      cn: {
        income: '收入', expense: '支出', catLabel: '类别',
        expenseNatureLabel: '支出性质',
        operationalExpense: '日常支出 (运营)',
        operationalSub: '',
        assetExpense: '储蓄 / 资产支出 (非运营)',
        assetSub: '',
        incomeNatureLabel: '收入性质',
        salaryIncome: '日常收入',
        salarySub: '',
        assetIncome: '被动收入 / 资产收入 (非经常性)',
        assetIncomeSub: '',
        customToggle: '+ 自定义类别', selectToggle: '« 从列表中选择', customPlaceholder: '新类别名称...',
        amtLabel: '金额', amtPlaceholder: '', payLabel: '支付方式',
        dateLabel: '购买 / 交易日期', timeLabel: '时间', noteLabel: '备注 (可选)', submitBtn: '', saving: '保存中...',
        alertCat: '请先选择或输入类别！', alertAmt: '请先输入金额！', warningMsg: '⚠️ 请先选择类别。',
        receipt: '收据', upload: '', remove: '删除', billText: '账单',
        warrantyLabel: '商品包含保修？', warrantyDuration: '保修期限:',
        warrantyCustomToggle: '+ 自定义月数', warrantySelectToggle: '« 从预设中选择',
        warrantyCustomPlaceholder: '例: 18', warrantyMonthUnit: '个月',
        warrantyOptions: { '1': '1个月', '3': '3个月', '6': '6个月', '12': '1年 (12个月)', '24': '2年 (24个月)', '36': '3年 (36个月)' },
        warrantyExpiryPreview: '保修有效期至:',
        paymentMethods: { "Cash": "现金", "Credit Card": "信用卡", "Bank Transfer": "银行转账", "E-Wallet": "电子钱包" }
      }
    };

    const t = tForm[language] || tForm['id'];
    const langCategories = CATEGORIES_BY_LANG[language] || CATEGORIES_BY_LANG['id'];

    // Penentuan List Kategori sesuai Type dan Nature (Murni tersinkronisasi dengan 4 Array categoryHelper.js baru)
    const activeCategories = useMemo(() => {
      if (type === 'income') {
        return incomeNature === 'salary' ? (langCategories.incomeRoutine || []) : (langCategories.incomeAsset || []);
      }
      return expenseNature === 'asset' ? (langCategories.expenseAsset || []) : (langCategories.expenseRoutine || []);
    }, [type, incomeNature, expenseNature, langCategories]);

    const rawPaymentMethods = ["Cash", "Credit Card", "Bank Transfer", "E-Wallet"];

    const selectedCategoryValue = isCustom ? customCategory : category;
    const isCategorySelected = selectedCategoryValue.trim() !== '';

    const formatDisplayCategory = (catItem) => {
    if (!catItem) return '';
    
    return catItem;
  };

    // Helper Icon khusus kategori Non-Operasional / Non-Rutin yang benar & konsisten
  const renderCategoryIcon = (catItem) => {
  const IconComp = getCategoryIcon(catItem, type);
  return <IconComp className="w-3 h-3 shrink-0" />;
};
    // Helper Hitung Otomatis Tanggal Kadaluarsa Garansi (YYYY-MM-DD)
    const calculateWarrantyExpiry = (startDateStr, monthsCount) => {
      if (!startDateStr || !monthsCount || isNaN(monthsCount) || Number(monthsCount) <= 0) return null;
      const [y, m, d] = startDateStr.split('-').map(Number);
      if (!y || !m || !d) return null;
      
      const expDate = new Date(y, m - 1, d);
      expDate.setMonth(expDate.getMonth() + parseInt(monthsCount));
      
      const expY = expDate.getFullYear();
      const expM = String(expDate.getMonth() + 1).padStart(2, '0');
      const expD = String(expDate.getDate()).padStart(2, '0');
      return `${expY}-${expM}-${expD}`;
    };

    const activeWarrantyMonths = isCustomWarrantyMonths ? (parseInt(customWarrantyInput) || 0) : parseInt(warrantyMonths || 12);
    const calculatedExpiryDate = hasWarranty && type === 'expense' ? calculateWarrantyExpiry(date, activeWarrantyMonths) : null;

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
          setReceiptImage(compressedDataUrl);
        } catch (err) {
          console.error('Gagal mengompresi gambar:', err);
          alert('Gagal memproses gambar struk.');
        }
      }
    };

    const handleRemoveReceipt = () => {
      setReceiptImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

  const handleSubmit = async (e) => {
  e.preventDefault();
  if (!isCategorySelected) {
    alert(t.alertCat);
    return;
  }
  if (!amount) {
    alert(t.alertAmt);
    return;
  }

  setIsSubmitting(true);
  const finalCategory = getStandardCategoryValue(selectedCategoryValue.trim(), type, isCustom);
  const fullDateTime = `${date} ${time}:00`;

  let warrantyExpiryDate = null;
  let finalWarrantyMonths = 0;

  if (hasWarranty && type === 'expense') {
    finalWarrantyMonths = activeWarrantyMonths;
    warrantyExpiryDate = calculatedExpiryDate;
  }

  try {
    // Fallback UID jika sedang offline
    const userId = auth.currentUser?.uid || localStorage.getItem('wgen_last_uid') || "wgen_user";

    const id = crypto.randomUUID();
    const isAssetVal = (type === 'expense' && expenseNature === 'asset') ? 1 : 0;
    const finalExpenseNature = type === 'expense' ? expenseNature : null;
    const finalIncomeNature = type === 'income' ? incomeNature : null;

    const isOnline = navigator.onLine;
    let isSyncedToTurso = false;

    // 1. Kirim ke Turso Cloud jika Online
    if (isOnline) {
      try {
        await turso.execute({
          sql: `INSERT INTO transactions (
                  id, user_id, type, amount, currency, category, payment_method, note, receipt_image, date,
                  has_warranty, warranty_months, warranty_expiry, is_asset, expense_nature, income_nature
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            id,
            userId,
            type,
            parseFloat(amount),
            mainCurrency,
            finalCategory,
            paymentMethod,
            note || '',
            receiptImage || null,
            fullDateTime,
            hasWarranty && type === 'expense' ? 1 : 0,
            finalWarrantyMonths,
            warrantyExpiryDate,
            isAssetVal,
            finalExpenseNature,
            finalIncomeNature
          ]
        });
        isSyncedToTurso = true;
      } catch (tursoErr) {
        console.warn('📱 Turso Gagal / Network error. Menyiapkan Antrean Sync...', tursoErr.message);
      }
    }

    // 2. Buat Objek Transaksi
    const newTrxData = {
      id,
      user_id: userId,
      type,
      amount: parseFloat(amount),
      currency: mainCurrency,
      category: finalCategory,
      payment_method: paymentMethod,
      note: note || '',
      receipt_image: receiptImage || null,
      date: fullDateTime,
      has_warranty: hasWarranty && type === 'expense' ? 1 : 0,
      warranty_months: finalWarrantyMonths,
      warranty_expiry: warrantyExpiryDate,
      is_asset: isAssetVal,
      expense_nature: finalExpenseNature,
      income_nature: finalIncomeNature,
      created_at: new Date().toISOString()
    };

    // 3. Simpan ke IndexedDB Lokal (Otomatis masuk Sync Queue jika offline)
    await saveLocalItem('transactions', newTrxData, 'INSERT', isSyncedToTurso);

    // 4. Trigger UI Update Instan
    window.dispatchEvent(new Event('transaction-added'));

    // Reset Form
    setAmount(''); setCategory(''); setCustomCategory(''); setNote(''); setReceiptImage(null);
    setHasWarranty(false); setWarrantyMonths('12'); setIsCustomWarrantyMonths(false); setCustomWarrantyInput('');
    setTime(getCurrentTime());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (onSuccess) onSuccess();
  } catch (error) {
    console.error('Gagal menyimpan transaksi:', error);
    alert('Gagal menyimpan transaksi: ' + error.message);
  } finally {
    setIsSubmitting(false);
  }
};
    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        
        {/* Pilihan Type (Income / Expense) */}
        <div className="grid grid-cols-2 gap-1  p-1 bg-gray-100 dark:bg-gray-800 rounded-x2">
          <button
            type="button"
            onClick={() => { setType('expense'); setCategory(''); setCustomCategory(''); setIsCustom(false); }}
            className={`py-1 rounded-1g text-[11px] font-bold transition cursor-pointer ${type === 'expense' ? 'bg-rose-500 text-white shadow-sm' : 'text-gray-500'}`}
          >
            {t.expense}
          </button>
          <button
            type="button"
            onClick={() => { setType('income'); setCategory(''); setCustomCategory(''); setIsCustom(false); setHasWarranty(false); }}
            className={`py-1 rounded-1g text-[11px] font-bold transition cursor-pointer ${type === 'income' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500'}`}
          >
            {t.income}
          </button>
        </div>

        {/* TOGGLE SIFAT PENGELUARAN (OPERASIONAL VS TABUNGAN / ASET) */}
        {type === 'expense' && (
          <div className="flex flex-col gap-1.5 p-2 bg-gray-100/90 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700">
            <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{t.expenseNatureLabel}</label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => { setExpenseNature('operational'); setCategory(''); setCustomCategory(''); setIsCustom(false); }}
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
                onClick={() => { setExpenseNature('asset'); setCategory(''); setCustomCategory(''); setIsCustom(false); }}
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
        )}

        {/* --- TOGGLE SIFAT PEMASUKAN (RUTIN VS NON-RUTIN / ASET) --- */}
        {type === 'income' && (
          <div className="flex flex-col gap-1.5 p-2 bg-gray-100/90 dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700">
            <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{t.incomeNatureLabel}</label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => { setIncomeNature('salary'); setCategory(''); setCustomCategory(''); setIsCustom(false); }}
                className={`p-1.5 rounded-lg border text-[10px] font-bold transition flex flex-col items-start gap-0.5 text-left cursor-pointer ${
                  incomeNature === 'salary'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <div className="flex items-center gap-1 font-extrabold">
                  <TrendingUpIcon className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span>{t.salaryIncome}</span>
                </div>
                <span className="text-[8.5px] font-medium opacity-80 line-clamp-1">{t.salarySub}</span>
              </button>

              <button
                type="button"
                onClick={() => { setIncomeNature('asset'); setCategory(''); setCustomCategory(''); setIsCustom(false); }}
                className={`p-1.5 rounded-lg border text-[10px] font-bold transition flex flex-col items-start gap-0.5 text-left cursor-pointer ${
                  incomeNature === 'asset'
                    ? `bg-gradient-to-r ${currentTheme.btn} text-white border-transparent shadow-xs`
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <div className="flex items-center gap-1 font-extrabold">
                  <Coins className="w-3 h-3 text-amber-300 shrink-0" />
                  <span>{t.assetIncome}</span>
                </div>
                <span className="text-[8.5px] font-medium opacity-80 line-clamp-1">{t.assetIncomeSub}</span>
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-0.5 block">{t.dateLabel}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[11px] font-medium focus:outline-none cursor-pointer"
              required
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-0.5 block">{t.timeLabel}</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[11px] font-medium focus:outline-none cursor-pointer"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-0.5 block">{t.payLabel}</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[11px] font-semibold focus:outline-none cursor-pointer"
          >
            {rawPaymentMethods.map(pm => (
              <option key={pm} value={pm}>{t.paymentMethods[pm] || pm}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{t.catLabel}</label>
            <button
              type="button"
              onClick={() => { setIsCustom(!isCustom); setCategory(''); setCustomCategory(''); }}
              className={`text-[12px] font-bold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent hover:opacity-80 transition cursor-pointer`}
            >
              {isCustom ? t.selectToggle : t.customToggle}
            </button>
          </div>

          {isCustom ? (
            <input
              type="text"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder={t.customPlaceholder}
              className="w-full p-3 rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-bold focus:outline-none"
              required
            />
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {activeCategories.map((catItem) => {
                const labelWithBill = formatDisplayCategory(catItem);
                const isSelected = category === catItem;
                return (
                  <button
                    key={catItem}
                    type="button"
                    onClick={() => setCategory(catItem)}
                    className={`py-2.5 px-3 rounded-3xl text-[12px] font-bold border transition flex items-center justify-start gap-2 leading-tight cursor-pointer ${
                      isSelected 
                        ? `bg-gradient-to-br ${currentTheme.btn} text-white border-transparent shadow-sm` 
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    {renderCategoryIcon(catItem)}
                    <span className="truncate">{labelWithBill}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="text-[12px] font-bold text-gray-500 dark:text-gray-400 mb-1 block">
            {t.amtLabel} ({mainCurrency})
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={formatNumberWithSeparator(amount)}
            onChange={handleAmountChange}
            placeholder={isCategorySelected ? "0" : t.amtPlaceholder}
            disabled={!isCategorySelected}
            className={`w-full p-2 rounded-2xl border text-sm font-bold focus:outline-none transition ${
              isCategorySelected 
                ? 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white' 
                : 'border-gray-200 dark:border-gray-800 bg-gray-200/50 dark:bg-gray-900/50 text-gray-400 cursor-not-allowed'
            }`}
            required
          />
          {!isCategorySelected && (
            <p className="text-[9px] text-amber-500 mt-0.5 font-medium">{t.warningMsg}</p>
          )}
        </div>

        {type === 'expense' && (
          <div className="flex flex-col gap-1.5 p-2 bg-gray-100/80 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/50">
            <label className="flex items-center justify-between cursor-pointer text-[10px] font-bold text-gray-700 dark:text-gray-300">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className={`w-3.5 h-3.5 ${hasWarranty ? 'text-emerald-500' : 'text-gray-400'}`} />
                {t.warrantyLabel}
              </span>
              <input
                type="checkbox"
                checked={hasWarranty}
                onChange={(e) => setHasWarranty(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
              />
            </label>

            {hasWarranty && (
              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-700/60">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">{t.warrantyDuration}</span>
                  <button
                    type="button"
                    onClick={() => setIsCustomWarrantyMonths(!isCustomWarrantyMonths)}
                    className={`text-[9px] font-bold bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent hover:opacity-80 transition cursor-pointer`}
                  >
                    {isCustomWarrantyMonths ? t.warrantySelectToggle : t.warrantyCustomToggle}
                  </button>
                </div>

                {isCustomWarrantyMonths ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      value={customWarrantyInput}
                      onChange={(e) => setCustomWarrantyInput(e.target.value)}
                      placeholder={t.warrantyCustomPlaceholder}
                      className="w-full p-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-[10px] font-bold focus:outline-none"
                      autoFocus
                    />
                    <span className="text-[10px] font-bold text-gray-500 whitespace-nowrap">{t.warrantyMonthUnit}</span>
                  </div>
                ) : (
                  <select
                    value={warrantyMonths}
                    onChange={(e) => setWarrantyMonths(e.target.value)}
                    className="w-full p-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-[10px] font-bold focus:outline-none cursor-pointer"
                  >
                    {Object.entries(t.warrantyOptions).map(([m, label]) => (
                      <option key={m} value={m}>{label}</option>
                    ))}
                  </select>
                )}

                {calculatedExpiryDate && (
                  <div className="flex items-center justify-between text-[9px] font-bold pt-1 px-1 text-emerald-600 dark:text-emerald-400">
                    <span>{t.warrantyExpiryPreview}</span>
                    <span className="bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                      🛡️ {calculatedExpiryDate} ({activeWarrantyMonths} {t.warrantyMonthUnit})
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-0.5 block">{t.noteLabel}</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="..."
            className="w-full p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-0.5 block">{t.receipt}</label>
          {receiptImage ? (
            <div className="relative w-full h-16 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden flex items-center justify-center">
              <img src={receiptImage} alt="Struk" className="object-contain w-full h-full" />
              <button
                type="button"
                onClick={handleRemoveReceipt}
                className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-md hover:bg-rose-600 transition cursor-pointer"
                title={t.remove}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current && fileInputRef.current.click()} 
                className="w-full p-2 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                <Camera className="w-4 h-4 text-gray-400" />
                <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">{t.upload}</span>
              </button>
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleImageChange} 
              />
            </div>
          )}
        </div>

        {/* Tombol Aksi (Simpan & Tombol Batal berikon X Merah) */}
        <div className="flex items-center gap-2 mt-1.5">
          {/* Tombol X Merah untuk Keluar / Batal */}
          {onSuccess && (
            <button
              type="button"
              onClick={onSuccess} // Atau fungsi untuk menutup modal
              className="px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/30 transition flex items-center justify-center cursor-pointer shadow-sm"
              title="Batal / Tutup"
            >
              <X className="w-5 h-5 font-bold" />
            </button>
          )}

          {/* Tombol Submit / Simpan Transaksi */}
          <button
            type="submit"
            disabled={!isCategorySelected || isSubmitting}
            className={`flex-1 font-bold py-2 rounded-lg transition text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
              isCategorySelected 
                ? `bg-gradient-to-br ${currentTheme.btn} text-white hover:opacity-90` 
                : 'bg-gray-300 dark:bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
            {isSubmitting ? t.saving : t.submitBtn}
          </button>
        </div>
      </form>
    );
  }
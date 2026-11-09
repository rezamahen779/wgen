import { 
  Utensils, Bus, Users, Home, Zap, Droplets, Flame, Wifi, 
  HeartPulse, GraduationCap, TrendingUp, Plane, Gamepad2, 
  ShoppingBag, Shield, Receipt, Briefcase, Gift, DollarSign, HelpCircle,
  Laptop, Building2, Coins, Car, Award, CreditCard, Landmark
} from 'lucide-react';

// 1. DICTIONARY UTAMA: Pemetaan Key Standar Netral (English Canonical Key)
export const CATEGORY_MAP = {
  // --- EXPENSE / PENGELUARAN ROUTINE (Operasional) ---
  'food': { id: "Makan dan minum", jp: "飲食", en: "Food & Drinks", ar: "طعام وشراب", cn: "餐饮" },
  'transport': { id: "Transportasi", jp: "交通費", en: "Transportation", ar: "مواصلات", cn: "交通" },
  'family': { id: "Keluarga", jp: "家族", en: "Family", ar: "عائلة", cn: "家庭" },
  'home': { id: "Rumah", jp: "住まい", en: "Home", ar: "منزل", cn: "住房" },
  'electricity': { id: "Tagihan Listrik", jp: "電気代", en: "Electricity-Bill", ar: "فاتورة الكهرباء", cn: "电费账单" },
  'water': { id: "Tagihan Air", jp: "水道代", en: "Water-Bill", ar: "فاتورة المياه", cn: "水费账单" },
  'gas': { id: "Tagihan Gas", jp: "ガス代", en: "Gas-Bill", ar: "فاتورة الغاز", cn: "燃气账单" },
  'internet': { id: "Tagihan Internet", jp: "インターネット代", en: "Internet-Bill", ar: "فاتورة الإنترنت", cn: "网络账单" },
  'health': { id: "Kesehatan", jp: "医療", en: "Health", ar: "صحة", cn: "医疗" },
  'education': { id: "Edukasi", jp: "教育", en: "Education", ar: "تعليم", cn: "教育" },
  'entertainment': { id: "Hiburan", jp: "エンタメ", en: "Entertainment", ar: "ترفيه", cn: "娱乐" },
  'shopping': { id: "Belanja", jp: "ショッピング", en: "Shopping", ar: "تسوق", cn: "购物" },
  'insurance': { id: "Asuransi", jp: "保険", en: "Insurance", ar: "تأمين", cn: "保险" },
  'tax': { id: "Pajak", jp: "税金", en: "Tax", ar: "ضرائب", cn: "税" },

  // --- OVERLAP (Bisa Rutin & Asset) ---
  'investment': { id: "Investasi", jp: "投資", en: "Investment", ar: "استثمار", cn: "投资" },
  'traveling': { id: "Traveling", jp: "旅行", en: "Traveling", ar: "سفر", cn: "旅游" },
  'electronics': { id: "Elektronik", jp: "家電・電子機器", en: "Electronics", ar: "إلكترونيات", cn: "电子产品" },
  'business': { id: "Bisnis", jp: "事業", en: "Business", ar: "أعمال", cn: "商业" },

  // --- EXPENSE ASSET / NON-OPERATIONAL ---
  'property': { id: "Properti", jp: "不動産", en: "Property", ar: "عقارات", cn: "房产" },
  'gold': { id: "Gold", jp: "金", en: "Gold", ar: "ذهب", cn: "黄金" },
  'vehicles': { id: "Kendaraan", jp: "乗り物", en: "Vehicle", ar: "مركبات", cn: "车辆" },

  // --- INCOME / PEMASUKAN ROUTINE ---
  'salary': { id: "Gaji", jp: "給与", en: "Salary", ar: "راتب", cn: "薪水" },
  
  // --- OVERLAP (Income Rutin & Non-Rutin) ---
  'freelance': { id: "Freelance", jp: "フリーランス", en: "Freelance", ar: "عمل حُر", cn: "兼职" },

  // --- INCOME NON-ROUTINE / ASSET ---
  'bonus': { id: "Bonus", jp: "ボーナス", en: "Bonus", ar: "مكافأة", cn: "奖金" },
  'loan': { id: "Hutang", jp: "借入", en: "Loan", ar: "قرض", cn: "借款" },
  'gift': { id: "Hadiah", jp: "ギフト", en: "Gift", ar: "هدية", cn: "礼物" }
};

// Daftar Opsi Kategori Berdasarkan 4 Klasifikasi Baru
export const CATEGORIES_BY_LANG = {
  id: {
    expenseRoutine: ["Makan dan minum", "Transportasi", "Keluarga", "Rumah", "Tagihan Listrik", "Tagihan Air", "Tagihan Gas", "Tagihan Internet", "Kesehatan", "Edukasi", "Investasi", "Traveling", "Hiburan", "Belanja", "Elektronik", "Asuransi", "Pajak"],
    expenseAsset: ["Properti", "Elektronik", "Investasi", "Gold", "Bisnis", "Traveling", "Kendaraan"],
    incomeRoutine: ["Gaji", "Bisnis", "Investasi", "Freelance"],
    incomeAsset: ["Bonus", "Freelance", "Investasi", "Gold", "Hutang", "Hadiah"]
  },
  jp: {
    expenseRoutine: ["飲食", "交通費", "家族", "住まい", "電気代", "水道代", "ガス代", "インターネット代", "医療", "教育", "投資", "旅行", "エンタメ", "ショッピング", "家電・電子機器", "保険", "税金"],
    expenseAsset: ["不動産", "家電・電子機器", "投資", "金", "事業", "旅行", "乗り物"],
    incomeRoutine: ["給与", "事業", "投資", "フリーランス"],
    incomeAsset: ["ボーナス", "フリーランス", "投資", "金", "借入", "ギフト"]
  },
  en: {
    expenseRoutine: ["Food & Drinks", "Transportation", "Family", "Home", "Electricity-Bill", "Water-Bill", "Gas-Bill", "Internet-Bill", "Health", "Education", "Investment", "Traveling", "Entertainment", "Shopping", "Electronics", "Insurance", "Tax"],
    expenseAsset: ["Property", "Electronics", "Investment", "Gold", "Business", "Traveling", "Vehicle"],
    incomeRoutine: ["Salary", "Business", "Investment", "Freelance"],
    incomeAsset: ["Bonus", "Freelance", "Investment", "Gold", "Loan", "Gift"]
  },
  ar: {
    expenseRoutine: ["طعام وشراب", "مواصلات", "عائلة", "منزل", "فاتورة الكهرباء", "فاتورة المياه", "فاتورة الغاز", "فاتورة الإنترنت", "صحة", "تعليم", "استثمار", "سفر", "ترفيه", "تسوق", "إلكترونيات", "تأمين", "ضرائب"],
    expenseAsset: ["عقارات", "إلكترونيات", "استثمار", "ذهب", "أعمال", "سفر", "مركبات"],
    incomeRoutine: ["راتب", "أعمال", "استثمار", "عمل حُر"],
    incomeAsset: ["مكافأة", "عمل حُر", "استثمار", "ذهب", "قرض", "هدية"]
  },
  cn: {
    expenseRoutine: ["餐饮", "交通", "家庭", "住房", "电费账单", "水费账单", "燃气账单", "网络账单", "医疗", "教育", "投资", "旅游", "娱乐", "购物", "电子产品", "保险", "税"],
    expenseAsset: ["房产", "电子产品", "投资", "黄金", "商业", "旅游", "车辆"],
    incomeRoutine: ["薪水", "商业", "投资", "兼职"],
    incomeAsset: ["奖金", "兼职", "投资", "黄金", "借款", "礼物"]
  }
};

// Mapping Ikon Lengkap (Termasuk variasi "Bill" dan terjemahannya untuk fallback yang aman)
const CATEGORY_ICONS = {
  // Routine Expenses
  "makan dan minum": Utensils, "food & drinks": Utensils, "飲食": Utensils, "طعام وشراب": Utensils, "餐饮": Utensils, "food": Utensils,
  "transportasi": Bus, "transportation": Bus, "交通費": Bus, "交通": Bus, "مواصلات": Bus, "transport": Bus,
  "keluarga": Users, "family": Users, "家族": Users, "عائلة": Users, "家庭": Users,
  "rumah": Home, "home": Home, "住まい": Home, "منزل": Home, "住房": Home,
  
  // Bills (Diperluas agar langsung map dari string exact)
  "listrik": Zap, "electricity": Zap, "電気": Zap, "كهرباء": Zap, "电费": Zap,
  "tagihan listrik": Zap, "electricity-bill": Zap, "電気代": Zap, "فاتورة الكهرباء": Zap, "电费账单": Zap,
  
  "air": Droplets, "water": Droplets, "水道": Droplets, "ماء": Droplets, "水费": Droplets,
  "tagihan air": Droplets, "water-bill": Droplets, "水道代": Droplets, "فاتورة المياه": Droplets, "水费账单": Droplets,
  
  "gas": Flame, "ガス": Flame, "غاز": Flame, "燃气": Flame,
  "tagihan gas": Flame, "gas-bill": Flame, "ガス代": Flame, "فاتورة الغاز": Flame, "燃气账单": Flame,
  
  "internet": Wifi, "インターネット": Wifi, "إنترنت": Wifi, "网络": Wifi,
  "tagihan internet": Wifi, "internet-bill": Wifi, "インターネット代": Wifi, "فاتورة الإنترنت": Wifi, "网络账单": Wifi,
  
  "kesehatan": HeartPulse, "health": HeartPulse, "医療": HeartPulse, "صحة": HeartPulse, "医疗": HeartPulse,
  "edukasi": GraduationCap, "education": GraduationCap, "教育": GraduationCap, "تعليم": GraduationCap,
  "investasi": TrendingUp, "investment": TrendingUp, "投資": TrendingUp, "استثمار": TrendingUp, "投资": TrendingUp,
  "traveling": Plane, "旅行": Plane, "سفر": Plane, "旅游": Plane,
  "hiburan": Gamepad2, "entertainment": Gamepad2, "エンタメ": Gamepad2, "ترفيه": Gamepad2, "娱乐": Gamepad2,
  "belanja": ShoppingBag, "shopping": ShoppingBag, "ショッピング": ShoppingBag, "تسوق": ShoppingBag, "购物": ShoppingBag,
  "asuransi": Shield, "insurance": Shield, "保険": Shield, "تأمين": Shield, "保险": Shield,
  "pajak": Receipt, "tax": Receipt, "税金": Receipt, "ضرائب": Receipt, "税": Receipt,
  "elektronik": Laptop, "electronics": Laptop, "家電・電子機器": Laptop, "إلكترونيات": Laptop, "电子产品": Laptop,

  // Non-Operational / Asset Expenses
  "properti": Building2, "property": Building2, "不動産": Building2, "عقارات": Building2, "房产": Building2,
  "gold": Coins, "金": Coins, "ذهب": Coins, "黄金": Coins,
  "bisnis": Briefcase, "business": Briefcase, "事業": Briefcase, "أعمال": Briefcase, "商业": Briefcase,
  "kendaraan": Car, "vehicle": Car, "乗り物": Car, "مركبات": Car, "车辆": Car,

  // Income
  "gaji": DollarSign, "salary": DollarSign, "給与": DollarSign, "راتب": DollarSign, "薪水": DollarSign,
  "freelance": Briefcase, "フリーランス": Briefcase, "عمل حُر": Briefcase, "兼职": Briefcase,
  "bonus": Award, "ボーナス": Award, "مكافأة": Award, "奖金": Award,
  "hutang": CreditCard, "loan": CreditCard, "借入": CreditCard, "قرض": CreditCard, "借款": CreditCard,
  "hadiah": Gift, "gift": Gift, "ギフト": Gift, "هدية": Gift, "礼物": Gift
};

export const normalizeCategoryString = (str) => {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/\s*-\s*(bill|tagihan|請求書|账单|فاتورة)/gi, '');
};

/**
 * Menerjemahkan kategori tersimpan di DB ke Bahasa Aktif secara DINAMIS
 * Digunakan di Recent Transactions / Transaction List
 */
export const getTranslatedCategory = (savedCat, currentLang = 'id') => {
  if (!savedCat) return '';
  const clean = normalizeCategoryString(savedCat);

  // 1. Cari apakah savedCat cocok dengan Key atau Value di CATEGORY_MAP
  for (const key of Object.keys(CATEGORY_MAP)) {
    const translations = CATEGORY_MAP[key];
    
    // Cek jika savedCat sama dengan Key atau salah satu terjemahan di bahasa manapun
    const isMatch = key === clean || Object.values(translations).some(val => normalizeCategoryString(val) === clean);
    
    if (isMatch) {
      return translations[currentLang] || translations['id'] || savedCat;
    }
  }

  // 2. Jika Kategori Custom buatan user sendiri, kembalikan string aslinya
  return savedCat;
};

/**
 * Mencari Standard Canonical Key untuk disimpan ke DB (misal "food", "salary", "gold")
 */
export const getStandardCategoryValue = (catVal, typeTrx = 'expense', isCustom = false) => {
  if (!catVal || isCustom) return catVal;
  const clean = normalizeCategoryString(catVal);

  for (const key of Object.keys(CATEGORY_MAP)) {
    const translations = CATEGORY_MAP[key];
    const isMatch = key === clean || Object.values(translations).some(val => normalizeCategoryString(val) === clean);
    if (isMatch) {
      // Mengembalikan English Canonical Key sebagai standard simpan di DB
      return key; 
    }
  }

  return catVal;
};

export const getCategoryIcon = (catVal, typeTrx = 'expense') => {
  const cleanStr = String(catVal).trim().toLowerCase(); // Cek string exact terlebih dulu (misal "electricity-bill")
  if (CATEGORY_ICONS[cleanStr]) {
    return CATEGORY_ICONS[cleanStr];
  }

  const clean = normalizeCategoryString(catVal);
  if (CATEGORY_ICONS[clean]) {
    return CATEGORY_ICONS[clean];
  }
  
  // Jika tersimpan sebagai Key standar, cari terjemahan indonesianya untuk matching icon
  const stdKey = getStandardCategoryValue(catVal, typeTrx);
  const cleanStd = normalizeCategoryString(stdKey);
  
  return CATEGORY_ICONS[cleanStd] || HelpCircle;
};

export const isAssetCategory = (catKey) => {
  if (!catKey) return false;
  const clean = normalizeCategoryString(catKey);
  
  // Mengambil definisi list dari file Dashboard atau pendukung terkait jika ada,
  // atau menggunakan pengecekan string yang konsisten
  return clean.includes('investasi') || clean.includes('investment') || 
         clean.includes('properti') || clean.includes('property') || 
         clean.includes('gold') || clean.includes('saham') || clean.includes('stocks');
};
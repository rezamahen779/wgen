import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Home,
  ReceiptText,
  Settings as SettingsIcon,
  PieChart,
  BarChart3,
  Vault,
  CreditCard,
  ShieldCheck,
  Calculator,
  ArrowRight
} from 'lucide-react';
import { App as CapApp } from '@capacitor/app';

// Firebase Auth & Biometric Helper
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { authenticateAndroidBiometric } from './lib/biometric';

// Import Assets & Components
import logoWGen from './assets/logo-wgen.png';
import logoW from './assets/logo-w.png';
import logoPlus from './assets/logo-plus.png';
import SplitBillFloatingBubble from './SplitBillFloatingBubble';
import TransactionForm from './TransactionForm';
import Settings, { getThemeStyles } from './Settings';
import LoanApplyPage from './LoanApplyPage';

// Dynamic Import (Lazy Loading)
const Dashboard = lazy(() => import('./Dashboard'));
const TransactionList = lazy(() => import('./TransactionList'));
const Budgeting = lazy(() => import('./Budgeting'));
const Savings = lazy(() => import('./Savings'));
const SavingsPinGate = lazy(() => import('./SavingsPinGate'));
const Report = lazy(() => import('./Report'));
const DebtManager = lazy(() => import('./DebtManager'));
const CurrencyCalculator = lazy(() => import('./CurrencyCalculator'));

const macSpring = { type: 'spring', stiffness: 450, damping: 25 };
const MAIN_TABS = ['home', 'transaksi', 'calculator', 'settings'];
const SUB_TABS = ['none', 'budgeting', 'report', 'savings', 'debtmanager'];

const pageVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.98
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 350, damping: 25 }
  },
  exit: (direction) => ({
    x: direction < 0 ? 80 : -80,
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.15 }
  })
};

const TRANSLATIONS = {
  id: {
    home: 'Utama', transaksi: 'Transaksi', calculator: 'Kalkulator', settings: 'Pengaturan',
    subDebt: 'Hutang / Piutang', subBudget: 'Anggaran', subReport: 'Laporan', subSavings: 'Tabungan',
    pleaseLogin: 'Harap Login', accessLocked: 'Akses Terkunci',
    lockedDesc: 'Kamu harus login dan mengisi Username terlebih dahulu di menu Settings.',
    goToSettings: 'Atur Profil & Login',
    journalTag: 'Jurnal Keuangan Modern',
    bioLockedTitle: 'WGen Note Terkunci',
    bioLockedDesc: 'Verifikasi sidik jari kamu untuk membuka aplikasi',
    bioUnlockBtn: 'Scan Sidik Jari / Unlock',
    addTitle: 'Transaksi Baru',
    welcomeTitle: 'Selamat Datang!',
    welcomeDesc: 'Silakan login terlebih dahulu untuk mengakses jurnal keuangan kamu.'
  },
  jp: {
    home: 'ホーム', transaksi: '取引', calculator: '計算機', settings: '設定',
    subDebt: '借入・貸付', subBudget: '予算', subReport: 'レポート', subSavings: '貯金',
    pleaseLogin: 'ログインしてください', accessLocked: 'アクセスロック',
    lockedDesc: '設定メニューでログインし、ユーザー名を入力してください。',
    goToSettings: '設定へ移動',
    journalTag: 'モダン金融ジャーナル',
    bioLockedTitle: 'WGen Note ロック中',
    bioLockedDesc: 'アプリを開くには指紋認証を行ってください',
    bioUnlockBtn: '指紋認証を行う',
    addTitle: '新規取引',
    welcomeTitle: 'ようこそ！',
    welcomeDesc: '財務ジャーナルにアクセスするには、まずログインしてください。'
  },
  en: {
    home: 'Home', transaksi: 'Transactions', calculator: 'Calculator', settings: 'Settings',
    subDebt: 'Debts', subBudget: 'Budget', subReport: 'Report', subSavings: 'Savings',
    pleaseLogin: 'Please Login', accessLocked: 'Access Locked',
    lockedDesc: 'You must log in and set your Username first in the Settings menu.',
    goToSettings: 'Go to Settings',
    journalTag: 'Modern Finance Journal',
    bioLockedTitle: 'WGen Note Locked',
    bioLockedDesc: 'Verify your fingerprint to unlock the app',
    bioUnlockBtn: 'Scan Fingerprint / Unlock',
    addTitle: 'New Transaction',
    welcomeTitle: 'Welcome!',
    welcomeDesc: 'Please log in first to access your financial journal.'
  },
  ar: {
    home: 'الرئيسية', transaksi: 'المعاملات', calculator: 'الحاسبة', settings: 'الإعدادات',
    subDebt: 'الديون', subBudget: 'الميزانية', subReport: 'التقارير', subSavings: 'المدخرات',
    pleaseLogin: 'الرجاء تسجيل الدخول', accessLocked: 'Access Locked',
    lockedDesc: 'يجب عليك تسجيل الدخول وتعيين اسم المستخدم في إعدادات.',
    goToSettings: 'الذهاب إلى الإعدادات',
    journalTag: 'مجلة المالية الحديثة',
    bioLockedTitle: 'WGen Note مقفل',
    bioLockedDesc: 'تحقق من بصمة الإصبع لفتح التطبيق',
    bioUnlockBtn: 'مسح البصمة / فتح',
    addTitle: 'معاملة جديدة',
    welcomeTitle: 'أهلاً بك!',
    welcomeDesc: 'يرجى تسجيل الدخول أولاً للوصول إلى السجل المالي الخاص بك.'
  },
  cn: {
    home: '首页', transaksi: '交易', calculator: '计算器', settings: '设置',
    subDebt: '债务', subBudget: '预算', subReport: '报告', subSavings: '储蓄',
    pleaseLogin: '请登录', accessLocked: '访问被锁定',
    lockedDesc: '您必须先在“设置”菜单中登录并设置用户名。',
    goToSettings: '前往设置',
    journalTag: '现代财务日志',
    bioLockedTitle: 'WGen Note 已锁定',
    bioLockedDesc: '验证指纹解锁应用',
    bioUnlockBtn: '扫描指纹 / 解锁',
    addTitle: '新增交易',
    welcomeTitle: '欢迎！',
    welcomeDesc: '请先登录以访问您的财务日志。'
  }
};

function getDeviceSystemLanguage() {
  const sysLang = (navigator.language || navigator.userLanguage || 'id').toLowerCase();
  if (sysLang.startsWith('ja')) return 'jp';
  if (sysLang.startsWith('en')) return 'en';
  if (sysLang.startsWith('ar')) return 'ar';
  if (sysLang.startsWith('zh') || sysLang.startsWith('cn')) return 'cn';
  return 'id';
}

export function MacDockIcon({ mouseX, icon: Icon, label, isActive, onClick, currentTheme, isSubMenu = false }) {
  const ref = useRef(null);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const minSize = isSubMenu ? 42 : 44;
  const maxSize = isSubMenu ? 56 : 64;

  const widthSync = useTransform(distance, [-100, 0, 100], [minSize, maxSize, minSize]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 400, damping: 18 });

  return (
    <motion.button
      ref={ref}
      style={{ width, height: width }}
      onClick={onClick}
      whileTap={{ scale: 0.82, rotate: -4 }}
      whileHover={{ y: -6 }}
      transition={macSpring}
      className={`group relative flex flex-col items-center justify-center rounded-2xl transition-colors cursor-pointer ${
        isActive
          ? `bg-gradient-to-r ${currentTheme.btn} text-white shadow-lg border border-white/30`
          : 'bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/20'
      }`}
    >
      <span className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-gray-900/90 dark:bg-gray-100/90 border border-white/20 dark:border-gray-800 text-white dark:text-gray-900 text-[9px] font-bold px-2.5 py-1 rounded-lg shadow-2xl pointer-events-none whitespace-nowrap z-50">
        {label}
      </span>

      <Icon className={`${isSubMenu ? 'w-4 h-4' : 'w-5 h-5'} shrink-0`} />

      {isActive && (
        <motion.span
          layoutId={isSubMenu ? 'activeSubDot' : 'activeMainDot'}
          className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
        />
      )}
    </motion.button>
  );
}

export function DockAddIcon({ mouseX, onClick, label }) {
  const ref = useRef(null);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthSync = useTransform(distance, [-100, 0, 100], [44, 64, 44]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 400, damping: 18 });

  return (
    <motion.button
      ref={ref}
      style={{ width, height: width }}
      onClick={onClick}
      whileTap={{ scale: 0.82, rotate: 180 }}
      whileHover={{ y: -6 }}
      transition={macSpring}
      className="group relative flex items-center justify-center rounded-2xl cursor-pointer bg-transparent border-0 p-0 shrink-0"
    >
      <span className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-gray-900/90 dark:bg-gray-100/90 border border-white/20 dark:border-gray-800 text-white dark:text-gray-900 text-[9px] font-bold px-2.5 py-1 rounded-lg shadow-2xl pointer-events-none whitespace-nowrap z-50">
        {label}
      </span>

      <motion.img
        src={logoPlus}
        alt="Tambah Transaksi"
        initial={{ scale: 1.7 }}
        animate={{ y: [0, -2, 0], scale: 1.7 }}
        transition={{ repeat: Infinity, duration: 0.8, ease: 'easeInOut' }}
        className="w-full h-full object-contain relative z-10 drop-shadow-sm group-hover:rotate-90 transition-transform duration-300"
      />
    </motion.button>
  );
}

export default function App() {
  // Deteksi rute publik QR Loan Application (baik lewat /apply, ?token=, ?ticket=, atau domain formadd)
  const isFormOnlySite = import.meta.env.VITE_PUBLIC_PORTAL_ONLY === 'true';
  const isPublicApplyRoute =
    isFormOnlySite ||
    window.location.pathname.replace(/\/+$/, '') === '/apply' ||
    Boolean(new URLSearchParams(window.location.search).get('token')) ||
    Boolean(new URLSearchParams(window.location.search).get('ticket'));
  const mainMouseX = useMotionValue(Infinity);
  const subMouseX = useMotionValue(Infinity);

  const [activeTab, setActiveTab] = useState('home');


  const [transactionSubTab, setTransactionSubTab] = useState('none');
  const [slideDirection, setSlideDirection] = useState(0);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const subTouchStartX = useRef(0);
  const subTouchStartY = useRef(0);

  // --- STATE BIOMETRIK LOCKSCREEN ---
  const [isBiometricLocked, setIsBiometricLocked] = useState(() => {
    if (isPublicApplyRoute) return false;
    return localStorage.getItem('wgen_use_biometric') === 'true';
  });

  const isPromptingBio = useRef(false);
  const backgroundTime = useRef(0);
  const hasAutoOpened = useRef(false);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('wgen_dark_mode');
    return savedMode !== null ? JSON.parse(savedMode) : true;
  });

  const [isInitializing, setIsInitializing] = useState(!isPublicApplyRoute);
  const [isResetMode, setIsResetMode] = useState(false);

  const [userName, setUserName] = useState(() => localStorage.getItem('wgen_username') || '');
  const [devBrandName, setDevBrandName] = useState(() => localStorage.getItem('wgen_dev_brand') || 'Z.D Dev');
  const [mainCurrency, setMainCurrency] = useState(() => localStorage.getItem('wgen_main_currency') || 'JPY');
  const [twoToneTheme, setTwoToneTheme] = useState(() => localStorage.getItem('wgen_theme') || 'emerald');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [showDebtManager, setShowDebtManager] = useState(() => {
    return localStorage.getItem('wgen_show_debt_manager') === 'true';
  });

  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('wgen_lang') || getDeviceSystemLanguage();
  });

  const [session, setSession] = useState(null);

  const currentTheme = getThemeStyles(twoToneTheme);
  const currentUserName = userName || localStorage.getItem('wgen_username') || '';
  const isLocked = (!session || (session && !currentUserName.trim())) && !isResetMode;
  const t = TRANSLATIONS[language] || TRANSLATIONS.id;

  const handleUnlockBiometric = async () => {
    if (isPromptingBio.current) return;
    isPromptingBio.current = true;
    try {
      const success = await authenticateAndroidBiometric();
      if (success) setIsBiometricLocked(false);
    } catch (error) {
      console.error('Biometric error:', error);
    } finally {
      isPromptingBio.current = false;
    }
  };

  // Biometric Startup & Background Resume Listener
  useEffect(() => {
    if (isPublicApplyRoute) return;

    let isMounted = true;
    let appStateListener;

    const isBioActive = localStorage.getItem('wgen_use_biometric') === 'true';
    if (isBioActive) {
      setIsBiometricLocked(true);
      setTimeout(() => {
        if (isMounted) handleUnlockBiometric();
      }, 500);
    }

    const setupAppStateListener = async () => {
      appStateListener = await CapApp.addListener('appStateChange', (state) => {
        if (!state.isActive) {
          backgroundTime.current = Date.now();
        } else {
          const isBioEnabled = localStorage.getItem('wgen_use_biometric') === 'true';
          const timeDiff = Date.now() - backgroundTime.current;
          if (isBioEnabled && backgroundTime.current > 0 && timeDiff > 2000) {
            setIsBiometricLocked(true);
            setTimeout(() => {
              if (isMounted) handleUnlockBiometric();
            }, 400);
          }
        }
      });
    };

    setupAppStateListener();

    return () => {
      isMounted = false;
      if (appStateListener && typeof appStateListener.remove === 'function') {
        appStateListener.remove();
      }
    };
  }, [isPublicApplyRoute]);

  // Firebase Auth & Splash Timer
  useEffect(() => {
    if (isPublicApplyRoute) return;

    let isMounted = true;
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!isMounted) return;
      setSession(currentUser);
      let savedUser = localStorage.getItem('wgen_username');

      if (currentUser && !savedUser && currentUser.displayName) {
        savedUser = currentUser.displayName;
        localStorage.setItem('wgen_username', savedUser);
        setUserName(savedUser);
      }
    });

    const timer = setTimeout(() => {
      if (isMounted) setIsInitializing(false);
    }, 800);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      unsubscribeAuth();
    };
  }, [isPublicApplyRoute]);

  // Auto-open Quick Add Modal setelah login siap
  useEffect(() => {
    if (!isPublicApplyRoute && !isInitializing && session && currentUserName.trim() && !hasAutoOpened.current) {
      setShowQuickAddModal(true);
      hasAutoOpened.current = true;
    }
  }, [isPublicApplyRoute, isInitializing, session, currentUserName]);

  // Redirect ke Settings jika akun belum login / username kosong
  useEffect(() => {
    if (!isPublicApplyRoute && !isInitializing && isLocked && activeTab !== 'settings') {
      const autoRedirect = setTimeout(() => {
        setActiveTab('settings');
      }, 350);
      return () => clearTimeout(autoRedirect);
    }
  }, [isPublicApplyRoute, isInitializing, isLocked, activeTab]);

  // Sinkronisasi Dark Mode & Tema ke <html>
  useEffect(() => {
    const root = document.documentElement;
    root.className = '';
    if (isDarkMode) root.classList.add('dark');
    root.classList.add(`theme-${twoToneTheme}`);
    localStorage.setItem('wgen_dark_mode', JSON.stringify(isDarkMode));
  }, [isDarkMode, twoToneTheme]);

  // Render halaman formulir pengajuan pinjaman publik (tanpa login)
  if (isPublicApplyRoute) {
    return <LoanApplyPage />;
  }

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    localStorage.setItem('wgen_lang', newLang);
  };

  const handleTabChange = (tab, subTab = 'none') => {
    const isProfileIncomplete = session && !currentUserName.trim();
    if ((!session || isProfileIncomplete) && tab !== 'settings' && !isResetMode) {
      setActiveTab('settings');
      return;
    }

    const oldIndex = MAIN_TABS.indexOf(activeTab);
    const newIndex = MAIN_TABS.indexOf(tab);
    setSlideDirection(newIndex > oldIndex ? 1 : -1);

    setActiveTab(tab);
    setTransactionSubTab(subTab);
  };

  const handleOpenQuickAdd = () => {
    if (isLocked) {
      setActiveTab('settings');
    } else {
      setShowQuickAddModal(true);
    }
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const diffX = touchStartX.current - e.changedTouches[0].clientX;
    const diffY = touchStartY.current - e.changedTouches[0].clientY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 70) {
      const currentIndex = MAIN_TABS.indexOf(activeTab);
      if (diffX > 0 && currentIndex < MAIN_TABS.length - 1) {
        handleTabChange(MAIN_TABS[currentIndex + 1]);
      } else if (diffX < 0 && currentIndex > 0) {
        handleTabChange(MAIN_TABS[currentIndex - 1]);
      }
    }
  };

  const handleSubTouchStart = (e) => {
    subTouchStartX.current = e.touches[0].clientX;
    subTouchStartY.current = e.touches[0].clientY;
  };

  const handleSubTouchEnd = (e) => {
    const diffX = subTouchStartX.current - e.changedTouches[0].clientX;
    const diffY = subTouchStartY.current - e.changedTouches[0].clientY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      const currentIndex = SUB_TABS.indexOf(transactionSubTab);
      if (diffX > 0 && currentIndex < SUB_TABS.length - 1) {
        setTransactionSubTab(SUB_TABS[currentIndex + 1]);
      } else if (diffX < 0 && currentIndex > 0) {
        setTransactionSubTab(SUB_TABS[currentIndex - 1]);
      }
    }
  };

  if (isInitializing) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center z-[999]">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.95, 1.05, 1], opacity: 1 }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          className="flex flex-col items-center"
        >
          <img src={logoWGen} alt="WGen Note Logo" className="w-40 h-40 sm:w-48 sm:h-48 object-contain rounded-3xl shadow-2xl" />
        </motion.div>
      </div>
    );
  }

  if (isBiometricLocked) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 text-center gap-6 z-[999]">
        <motion.div
          whileHover={{ y: -6, scale: 1.08 }}
          transition={macSpring}
          className={`p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 ${currentTheme.icon} shadow-2xl backdrop-blur-xl cursor-pointer`}
          onClick={handleUnlockBiometric}
        >
          <ShieldCheck className="w-16 h-16" />
        </motion.div>
        <div>
          <h2 className="text-xl font-black tracking-wide">{t.bioLockedTitle}</h2>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">{t.bioLockedDesc}</p>
        </div>
        <motion.button
          whileHover={{ y: -4, scale: 1.05, boxShadow: '0px 15px 30px rgba(16, 185, 129, 0.3)' }}
          whileTap={{ scale: 0.95 }}
          transition={macSpring}
          onClick={handleUnlockBiometric}
          className={`px-6 py-3.5 bg-gradient-to-r ${currentTheme.btn} text-white font-extrabold rounded-2xl text-xs shadow-lg cursor-pointer`}
        >
          {t.bioUnlockBtn}
        </motion.button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 pb-28 sm:pb-20 relative transition-colors duration-300 overflow-x-hidden select-none">
      <SplitBillFloatingBubble mainCurrency={mainCurrency} language={language} twoToneTheme={twoToneTheme} />

      {!isLocked && showQuickAddModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex flex-col justify-end touch-none overscroll-none">
          <div className="w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-t-l flex flex-col overflow-hidden shadow-2xl h-[calc(100vh)] mt-auto touch-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 p-3 px-4 flex justify-between items-center z-10 shrink-0" />
            <div className="p-4 overflow-y-auto flex-1 custom-scrollbar overscroll-contain">
              <TransactionForm
                onSuccess={() => {
                  setShowQuickAddModal(false);
                  setRefreshTrigger((prev) => prev + 1);
                  window.dispatchEvent(new Event('transaction-added'));
                }}
                mainCurrency={mainCurrency}
                language={language}
                twoToneTheme={twoToneTheme}
              />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-4 max-w-7xl mx-auto w-full flex justify-between items-center z-10">
        <motion.div
          whileHover={{ y: -3, scale: 1.05 }}
          transition={macSpring}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <img src={logoWGen} alt="WGen Note Logo" className="w-10 h-10 object-contain rounded-xl shadow-md" />
        </motion.div>
        {isLocked && (
          <span className="text-xs bg-amber-500/10 text-amber-500 font-medium px-3 py-1 rounded-full border border-amber-500/20">
            {!session ? t.pleaseLogin : 'Atur Username'}
          </span>
        )}
      </div>

      {/* Main Content */}
      <main
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 p-4 max-w-7xl mx-auto w-full mt-1 flex flex-col gap-6 relative"
      >
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center p-12">
              <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${currentTheme.icon}`} />
            </div>
          }
        >
          {isLocked && activeTab !== 'settings' ? (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl my-auto gap-4"
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                  className="relative flex items-center justify-center"
                >
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl scale-125" />
                  <img src={logoW} alt="Welcome Logo W" className="w-24 h-24 sm:w-28 sm:h-28 object-contain relative z-10 drop-shadow-lg" />
                </motion.div>

                <div className="max-w-xs">
                  <h2 className={`text-2xl font-black bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>
                    {t.welcomeTitle}
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 mt-2 text-xs leading-relaxed font-medium">
                    {t.welcomeDesc}
                  </p>
                </div>

                <motion.button
                  whileHover={{ y: -4, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={macSpring}
                  onClick={() => setActiveTab('settings')}
                  className={`mt-2 px-6 py-3 rounded-2xl bg-gradient-to-r ${currentTheme.btn} text-white font-bold text-xs shadow-lg flex items-center gap-2 cursor-pointer`}
                >
                  <span>{t.goToSettings}</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </motion.div>
            </AnimatePresence>
          ) : (
            <AnimatePresence mode="wait" custom={slideDirection}>
              <motion.div
                key={activeTab}
                custom={slideDirection}
                variants={pageVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="w-full flex-1 flex flex-col"
              >
                {activeTab === 'home' && (
                  <Dashboard
                    key={refreshTrigger}
                    onNavigateTab={(targetTab) => {
                      if (['budgeting', 'report', 'savings', 'debtmanager'].includes(targetTab)) {
                        handleTabChange('transaksi', targetTab);
                      } else {
                        handleTabChange(targetTab);
                      }
                    }}
                    userName={currentUserName}
                    mainCurrency={mainCurrency}
                    language={language}
                    twoToneTheme={twoToneTheme}
                  />
                )}

                {activeTab === 'transaksi' && (
                  <div className="flex flex-col gap-4 max-w-xl mx-auto w-full">
                    <div
                      onMouseMove={(e) => subMouseX.set(e.pageX)}
                      onMouseLeave={() => subMouseX.set(Infinity)}
                      className="flex items-center justify-center gap-3 p-2 bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl border border-gray-200/80 dark:border-gray-800/80 rounded-3xl shadow-lg dark:shadow-[0_20px_40px_rgba(0,0,0,0.5)] w-fit mx-auto transition-colors duration-300"
                    >
                      {[
                        { key: 'budgeting', label: t.subBudget, Icon: PieChart },
                        { key: 'report', label: t.subReport, Icon: BarChart3 },
                        { key: 'savings', label: t.subSavings, Icon: Vault },
                        { key: 'debtmanager', label: t.subDebt, Icon: CreditCard }
                      ].map(({ key, label, Icon }) => (
                        <MacDockIcon
                          key={key}
                          mouseX={subMouseX}
                          icon={Icon}
                          label={label}
                          isActive={transactionSubTab === key}
                          onClick={() => setTransactionSubTab(transactionSubTab === key ? 'none' : key)}
                          currentTheme={currentTheme}
                          isSubMenu={true}
                        />
                      ))}
                    </div>

                    <div
                      onTouchStart={handleSubTouchStart}
                      onTouchEnd={handleSubTouchEnd}
                      className="w-full flex flex-col"
                    >
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={transactionSubTab}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          {transactionSubTab === 'none' && (
                            <TransactionList
                              key={refreshTrigger}
                              allowEdit={true}
                              mainCurrency={mainCurrency}
                              language={language}
                              twoToneTheme={twoToneTheme}
                            />
                          )}

                          {transactionSubTab === 'budgeting' && (
                            <Budgeting
                              mainCurrency={mainCurrency}
                              language={language}
                              twoToneTheme={twoToneTheme}
                            />
                          )}

                          {transactionSubTab === 'report' && (
                            <Report
                              mainCurrency={mainCurrency}
                              language={language}
                              twoToneTheme={twoToneTheme}
                            />
                          )}

                          {transactionSubTab === 'savings' && (
                            <SavingsPinGate language={language} twoToneTheme={twoToneTheme}>
                              <Savings mainCurrency={mainCurrency} language={language} twoToneTheme={twoToneTheme} />
                            </SavingsPinGate>
                          )}

                          {transactionSubTab === 'debtmanager' && (
                            <DebtManager
                              language={language}
                              mainCurrency={mainCurrency}
                              currentUser={session}
                            />
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {activeTab === 'calculator' && (
                  <CurrencyCalculator
                    twoToneTheme={twoToneTheme}
                    language={language}
                    isDarkMode={isDarkMode}
                  />
                )}

                {activeTab === 'settings' && (
                  <Settings
                    userName={currentUserName}
                    setUserName={setUserName}
                    devBrandName={devBrandName}
                    setDevBrandName={setDevBrandName}
                    isDarkMode={isDarkMode}
                    setIsDarkMode={setIsDarkMode}
                    mainCurrency={mainCurrency}
                    setMainCurrency={setMainCurrency}
                    twoToneTheme={twoToneTheme}
                    setTwoToneTheme={setTwoToneTheme}
                    language={language}
                    setLanguage={handleLanguageChange}
                    session={session}
                    isResetMode={isResetMode}
                    setIsResetMode={setIsResetMode}
                    showDebtManager={showDebtManager}
                    setShowDebtManager={setShowDebtManager}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </Suspense>
      </main>

      {/* Footer */}
      <div className="w-full flex flex-col justify-center items-center py-2 text-center gap-0.5">
        <p className={`text-[10px] font-semibold ${currentTheme.icon} flex items-center justify-center gap-1`}>
          © 2026 WGen Note<sup className="text-[5px] mt-0.5 -ml-0.5">ZD</sup> — <span className={`font-bold ${currentTheme.icon}`}>{devBrandName}</span>
        </p>
        <p className={`text-[8px] font-medium tracking-widest ${currentTheme.icon}`}>
          {t.journalTag}
        </p>
      </div>

      {/* Bottom Dock Navigation */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center z-50">
        <nav
          onMouseMove={(e) => mainMouseX.set(e.pageX)}
          onMouseLeave={() => mainMouseX.set(Infinity)}
          className="bg-white/70 dark:bg-gray-950/80 backdrop-blur-2xl border border-gray-200/80 dark:border-white/10 py-2 px-3 rounded-3xl shadow-[0_15px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] transition-colors duration-300"
        >
          <div className="flex items-end gap-2.5 h-12">
            <MacDockIcon
              mouseX={mainMouseX}
              icon={Home}
              label={t.home}
              isActive={activeTab === 'home'}
              onClick={() => handleTabChange('home')}
              currentTheme={currentTheme}
            />
            <MacDockIcon
              mouseX={mainMouseX}
              icon={ReceiptText}
              label={t.transaksi}
              isActive={activeTab === 'transaksi'}
              onClick={() => handleTabChange('transaksi')}
              currentTheme={currentTheme}
            />

            <DockAddIcon
              mouseX={mainMouseX}
              onClick={handleOpenQuickAdd}
              label={t.addTitle}
            />

            <MacDockIcon
              mouseX={mainMouseX}
              icon={Calculator}
              label={t.calculator}
              isActive={activeTab === 'calculator'}
              onClick={() => handleTabChange('calculator')}
              currentTheme={currentTheme}
            />
            <MacDockIcon
              mouseX={mainMouseX}
              icon={SettingsIcon}
              label={t.settings}
              isActive={activeTab === 'settings'}
              onClick={() => handleTabChange('settings')}
              currentTheme={currentTheme}
            />
          </div>
        </nav>
      </div>
    </div>
  );
}
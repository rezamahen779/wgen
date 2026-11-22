import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { sendChatToSANS, sendReceiptToSANS } from "./services/aiService";
import { CATEGORIES_BY_LANG } from "./categoryHelper";
import { getThemeStyles } from "./Settings";
import { auth } from "./lib/firebase";
import logoSans from "./assets/logo-sans.png";

export default function AIChatModal({ 
  isOpen, 
  onClose, 
  onAddTransactions, 
  onOpenQuickAdd,
  language = "id", 
  currency = "JPY",
  twoToneTheme = "emerald",
  onGoToSettings
}) {
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoggedOut, setIsLoggedOut] = useState(false);

  useEffect(() => {
    const checkLoginStatus = () => {
      const currentUser = auth.currentUser;
      const savedUser = localStorage.getItem("wgen_username") || "";
      const isUnauthenticated = !currentUser || !savedUser.trim();
      setIsLoggedOut(isUnauthenticated);
    };

    checkLoginStatus();
  }, [isOpen]);

  const currentTheme = getThemeStyles(twoToneTheme);

  const getDeviceLang = () => {
    const sysLang = (navigator.language || navigator.userLanguage || "id").toLowerCase();
    if (sysLang.startsWith("ja")) return "ja";
    if (sysLang.startsWith("en")) return "en";
    if (sysLang.startsWith("ar")) return "ar";
    if (sysLang.startsWith("zh") || sysLang.startsWith("cn")) return "cn";
    return "id";
  };

  const deviceLang = getDeviceLang();

  const translations = {
    id: {
      title: "SANS AI Assistant",
      welcomeHeading: "Selamat Datang!",
      welcomeBody: "Catat transaksi & kelola keuangan otomatis. Login dulu di Pengaturan ya!",
      btnLogin: "Login Sekarang",
      placeholder: `Contoh: Beli makan ${currency === 'JPY' ? '3000 yen' : '50rb'} cash...`,
      send: "Kirim",
      uploadReceipt: "Upload Struk",
      standardCurr: "Standard Curr",
      detectionResult: "📌 Hasil Deteksi SANS AI:",
      saveTrx: "Simpan Transaksi",
      category: "Kategori",
      cash: "Tunai",
      errText: "Gagal terhubung ke SANS AI. Periksa jaringan/server.",
      errReceipt: "Gagal memproses gambar."
    },
    jp: {
      title: "SANS AI アシスタント",
      welcomeHeading: "ようこそ！",
      welcomeBody: "取引記録と資金管理を自動化。まずは設定からログインしてください！",
      btnLogin: "今すぐログイン",
      placeholder: `例：昼食 ${currency === 'JPY' ? '3000円' : '5000'} 現金...`,
      send: "送信",
      uploadReceipt: "レシートをアップロード",
      standardCurr: "標準通貨",
      detectionResult: "📌 SANS AI 検出結果:",
      saveTrx: "取引を保存",
      category: "カテゴリー",
      cash: "現金",
      errText: "SANS AI への接続に失敗しました。",
      errReceipt: "読み取りに失敗しました。"
    },
    en: {
      title: "SANS AI Assistant",
      welcomeHeading: "Welcome!",
      welcomeBody: "Track transactions & manage cash flow automatically. Please log in first!",
      btnLogin: "Log In Now",
      placeholder: `Example: Lunch ${currency === 'JPY' ? '3000 yen' : '50'} cash...`,
      send: "Send",
      uploadReceipt: "Upload Receipt",
      standardCurr: "Standard Curr",
      detectionResult: "📌 SANS AI Detection Result:",
      saveTrx: "Save Transactions",
      category: "Category",
      cash: "Cash",
      errText: "Failed to connect to SANS AI. Check your server/network.",
      errReceipt: "Failed to process image."
    }
  };

  const t = translations[language] || translations["id"];
  const tWelcome = translations[deviceLang] || translations["id"];

  if (!isOpen) return null;

  const activeLangCategories = CATEGORIES_BY_LANG[language] || CATEGORIES_BY_LANG["id"];
  const idCategories = CATEGORIES_BY_LANG["id"];
  const enCategories = CATEGORIES_BY_LANG["en"];

  const categoryList = Array.from(new Set([
    ...(activeLangCategories?.expenseRoutine || []),
    ...(activeLangCategories?.expenseAsset || []),
    ...(idCategories?.expenseRoutine || []),
    ...(enCategories?.expenseRoutine || [])
  ]));

  // 🟢 PURE ONLINE HANDLER: Kirim langsung ke SANS AI (aiService.ts)
  const handleSendText = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const results = await sendChatToSANS(inputText, language, categoryList, currency);
      setParsedData(results);
    } catch (err) {
      console.error("❌ SANS AI Error:", err);
      setErrorMsg(t.errText);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result.split(",")[1];
      
      setLoading(true);
      setErrorMsg("");
      try {
        const results = await sendReceiptToSANS(base64String, language, categoryList, currency);
        setParsedData(results);
      } catch (err) {
        setErrorMsg(err?.message || t.errReceipt);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmSave = () => {
    if (parsedData.length > 0 && onAddTransactions) {
      const fixedTransactions = parsedData.map(item => ({
        ...item,
        currency: item.currency || currency,
        note: item.note || ""
      }));

      onAddTransactions(fixedTransactions);
      setParsedData([]);
      setInputText("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 z-[9999]">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 w-full max-w-sm sm:max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl text-gray-900 dark:text-gray-100 flex flex-col gap-5">
        
        {isLoggedOut ? (
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
              <img 
                src={logoSans} 
                alt="SANS AI" 
                className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <h4 className="text-xl font-black text-emerald-500 dark:text-emerald-400 tracking-wide">
                {tWelcome.welcomeHeading}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-relaxed max-w-xs">
                {tWelcome.welcomeBody}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                if (onGoToSettings) onGoToSettings();
              }}
              className={`w-full py-3 px-4 rounded-2xl bg-gradient-to-r ${currentTheme.btn} text-white font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-95 transition-all cursor-pointer mt-2`}
            >
              {tWelcome.btnLogin}
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <img 
                  src={logoSans} 
                  alt="SANS AI Logo" 
                  className="w-8 h-8 object-cover rounded-xl shadow-sm mix-blend-multiply dark:mix-blend-normal" 
                />

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenQuickAdd) onOpenQuickAdd();
                  }}
                  className={`p-1.5 rounded-full bg-gradient-to-r ${currentTheme.btn} text-white shadow-md hover:scale-115 active:scale-90 transition-all cursor-pointer flex items-center justify-center`}
                  title="Tambah Transaksi Manual"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                </button>

                <h3 className="text-base font-bold ml-1">{t.title}</h3>
              </div>

              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendText} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 w-full">
                <input
                  type="text"
                  placeholder={t.placeholder}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={loading}
                  className={`flex-1 px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 ${currentTheme.ring || 'focus:ring-emerald-500'} transition-all`}
                />
                <button 
                  type="submit" 
                  disabled={loading || !inputText.trim()} 
                  className={`px-5 py-3 rounded-2xl bg-gradient-to-r ${currentTheme.btn} text-white font-bold text-sm disabled:opacity-50 transition-all shadow-md shrink-0`}
                >
                  {loading ? "..." : t.send}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                <label className={`cursor-pointer ${currentTheme.icon} hover:underline font-semibold flex items-center gap-1`}>
                  <span>📷 {t.uploadReceipt}</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} disabled={loading} className="hidden" />
                </label>
                <span>{t.standardCurr}: <strong>{currency}</strong> ({deviceLang.toUpperCase()})</span>
              </div>
            </form>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold">
                ⚠️ {errorMsg}
              </div>
            )}

            {parsedData.length > 0 && (
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 flex flex-col gap-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t.detectionResult}</h4>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  {parsedData.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-white dark:bg-gray-900 shadow-sm border border-gray-100 dark:border-gray-800 text-xs">
                      <div>
                        <p className="font-bold">{item.title}</p>
                        <p className="text-[10px] text-gray-400">{t.category}: {item.category} | {item.payment_method || t.cash}</p>
                        {item.note && <p className="text-[10px] text-gray-400 italic">Catatan: {item.note}</p>}
                      </div>

                      <span className={`font-bold ${item.type === 'expense' ? 'text-red-500' : 'text-emerald-500'}`}>
                        {item.type === 'expense' ? '-' : '+'}{item.currency || currency} {Number(item.amount).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleConfirmSave}
                  className={`w-full py-3 bg-gradient-to-r ${currentTheme.btn} text-white font-bold rounded-xl text-xs shadow-lg transition-all`}
                >
                  {t.saveTrx}
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
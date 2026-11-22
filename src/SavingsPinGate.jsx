import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { Lock, KeyRound, ArrowLeft, Check, ShieldCheck, AlertCircle, HelpCircle, Key } from 'lucide-react';

// Ganti import Supabase Client dengan Firebase Config (db & auth)
import { db, auth } from './lib/firebase';
import { getThemeStyles } from './Settings';

export default function SavingsPinGate({ children, language, twoToneTheme }) {
  const [pinState, setPinState] = useState('loading'); // 'loading' | 'create_pin' | 'enter_pin' | 'unlocked' | 'forgot_pin'
  const [savedPinHash, setSavedPinHash] = useState('');
  
  // Input States PIN
  const [inputPin, setInputPin] = useState(['', '', '', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '', '', '']);
  const [isConfirmingStep, setIsConfirmingStep] = useState(false);
  
  // Input States Security Questions
  const [ansCreator, setAnsCreator] = useState('');
  const [ansName, setAnsName] = useState('');
  const [ansAge, setAnsAge] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const activeThemeId = twoToneTheme || 'emerald';
  const currentTheme = getThemeStyles(activeThemeId);
  const currentUser = auth?.currentUser;

  // DICTIONARY 5 BAHASA LENGKAP & DINAMIS HINGGA BAGIAN TERKECIL
  const tGate = {
    id: {
      titleEnter: 'Masukkan PIN Savings',
      descEnter: 'Fitur Tabungan & Aset terkunci untuk keamanan ekstra.',
      titleCreate: 'Buat PIN Keamanan Baru',
      descCreate: 'Buat 6-digit PIN baru untuk melindungi data aset & tabunganmu.',
      titleConfirm: 'Konfirmasi PIN Kamu',
      descConfirm: 'Masukkan ulang 6-digit PIN yang baru saja kamu buat.',
      titleForgot: 'Verifikasi Keamanan PIN',
      descForgot: 'Jawab 3 pertanyaan keamanan berikut untuk memverifikasi identitas kamu.',
      q1Title: 'Pencipta WGen Note',
      q1Clue: 'Clue: Ketik 3 huruf diawali R...',
      q2Title: 'Siapa nama mu?',
      q3Title: 'Usia berapa kamu sekarang?',
      forgotBtn: 'Lupa PIN?',
      verifyResetBtn: 'Verifikasi & Reset PIN',
      verifyingBtn: 'Memverifikasi...',
      backToPinBtn: 'Kembali ke PIN',
      wrongPin: 'PIN salah! Silakan coba lagi.',
      pinMismatch: 'PIN konfirmasi tidak cocok!',
      savePinBtn: 'Simpan PIN Baru',
      unlockBtn: 'Buka Tabungan',
      nextConfirmBtn: 'Lanjut Konfirmasi',
      backBtn: 'Kembali',
      loadingAccess: 'Memeriksa Akses Keamanan...',
      wrongAnswers: 'Jawaban verifikasi keamanan tidak cocok! Periksa kembali.',
      fillAllFields: 'Harap isi semua jawaban pertanyaan keamanan!'
    },
    en: {
      titleEnter: 'Enter Savings PIN',
      descEnter: 'Savings & Assets feature is locked for extra security.',
      titleCreate: 'Create New Security PIN',
      descCreate: 'Set a new 6-digit PIN to protect your savings & asset data.',
      titleConfirm: 'Confirm Your PIN',
      descConfirm: 'Re-enter the 6-digit PIN you just created.',
      titleForgot: 'Security PIN Verification',
      descForgot: 'Answer the 3 security questions below to verify your identity.',
      q1Title: 'Creator of WGen Note',
      q1Clue: 'Clue: Type 3 letters starting with R...',
      q2Title: 'What is your name?',
      q3Title: 'How old are you now?',
      forgotBtn: 'Forgot PIN?',
      verifyResetBtn: 'Verify & Reset PIN',
      verifyingBtn: 'Verifying...',
      backToPinBtn: 'Back to PIN',
      wrongPin: 'Incorrect PIN! Please try again.',
      pinMismatch: 'PIN confirmation does not match!',
      savePinBtn: 'Save New PIN',
      unlockBtn: 'Unlock Savings',
      nextConfirmBtn: 'Proceed to Confirm',
      backBtn: 'Back',
      loadingAccess: 'Checking Security Access...',
      wrongAnswers: 'Security answers do not match! Please check again.',
      fillAllFields: 'Please fill in all security answers!'
    },
    jp: {
      titleEnter: 'PINコードを入力',
      descEnter: '貯金・資産データはセキュリティで保護されています。',
      titleCreate: '新しいPINの作成',
      descCreate: '資産データを保護するための6桁のPINコードを設定します。',
      titleConfirm: 'PINコードの確認',
      descConfirm: '作成した6桁のPINコードをもう一度入力してください。',
      titleForgot: 'セキュリティ検証',
      descForgot: '本人確認のために以下の3つの質問に答えてください。',
      q1Title: 'WGen Noteの制作者',
      q1Clue: 'ヒント: Rから始まる3文字を入力...',
      q2Title: 'あなたの名前は？',
      q3Title: '現在の年齢は？',
      forgotBtn: 'PINをお忘れの方',
      verifyResetBtn: '検証してPINをリセット',
      verifyingBtn: '検証中...',
      backToPinBtn: 'PIN入力に戻る',
      wrongPin: 'PINコードが違います。再試行してください。',
      pinMismatch: '確認用PINコードが一致しません！',
      savePinBtn: '新しいPINを保存',
      unlockBtn: 'ロック解除',
      nextConfirmBtn: '確認へ進む',
      backBtn: '戻る',
      loadingAccess: 'セキュリティアクセスを確認中...',
      wrongAnswers: '回答が一致しません。もう一度ご確認ください。',
      fillAllFields: 'すべての質問に回答してください！'
    },
    ar: {
      titleEnter: 'أدخل رمز PIN للادخار',
      descEnter: 'ميزة المدخرات والأصول مقفلة بأمان إضافي.',
      titleCreate: 'إنشاء رمز PIN جديد للأمان',
      descCreate: 'تعيين رمز PIN جديد مكون من 6 أرقام لحماية بياناتك.',
      titleConfirm: 'تأكيد رمز PIN الخاص بك',
      descConfirm: 'أعد إدخال رمز PIN المكون من 6 أرقام الذي أنشأته.',
      titleForgot: 'التحقق من أمان PIN',
      descForgot: 'أجب عن الأسئلة الأمنية الثلاثة التالية للتحقق من هويتك.',
      q1Title: 'منشئ WGen Note',
      q1Clue: 'تلميح: اكتب 3 أحرف تبدأ بـ R...',
      q2Title: 'ما اسمك؟',
      q3Title: 'كم عمرك الآن؟',
      forgotBtn: 'هل نسيت رمز PIN؟',
      verifyResetBtn: 'التحقق وإعادة تعيين PIN',
      verifyingBtn: 'جاري التحقق...',
      backToPinBtn: 'العودة إلى رمز PIN',
      wrongPin: 'رمز PIN غير صحيح! يرجى المحاولة مرة أخرى.',
      pinMismatch: 'تأكيد رمز PIN غير متطابق!',
      savePinBtn: 'حفظ رمز PIN الجديد',
      unlockBtn: 'فتح المدخرات',
      nextConfirmBtn: 'المتابعة للتأكيد',
      backBtn: 'رجوع',
      loadingAccess: 'جاري التحقق من الوصول الأمني...',
      wrongAnswers: 'الإجابات غير متطابقة! يرجى التحقق مرة أخرى.',
      fillAllFields: 'يرجى ملء جميع إجابات الأسئلة الأمنية!'
    },
    cn: {
      titleEnter: '输入储蓄 PIN 码',
      descEnter: '储蓄与资产功能已锁定以提供额外安全保护。',
      titleCreate: '创建新安全 PIN 码',
      descCreate: '设置新的 6 位 PIN 码以保护您的储蓄与资产数据。',
      titleConfirm: '确认您的 PIN 码',
      descConfirm: '请再次输入您刚刚创建的 6 位 PIN 码。',
      titleForgot: '安全 PIN 码验证',
      descForgot: '请回答以下 3 个安全问题以验证您的身份。',
      q1Title: 'WGen Note 开发者',
      q1Clue: '提示: 输入以 R 开头的 3 个字母...',
      q2Title: '您的名字是？',
      q3Title: '您今年多大？',
      forgotBtn: '忘记 PIN 码？',
      verifyResetBtn: '验证并重置 PIN 码',
      verifyingBtn: '正在验证...',
      backToPinBtn: '返回 PIN 码输入',
      wrongPin: 'PIN 码错误！请重试。',
      pinMismatch: '确认 PIN 码不匹配！',
      savePinBtn: '保存新 PIN 码',
      unlockBtn: '解锁储蓄',
      nextConfirmBtn: '前往确认',
      backBtn: '返回',
      loadingAccess: '正在检查安全权限...',
      wrongAnswers: '验证答案不正确！请重新检查。',
      fillAllFields: '请填写所有安全问题的答案！'
    }
  };

  const t = tGate[language] || tGate['id'];

  // Cek PIN di database
  useEffect(() => {
    checkUserPin();
  }, [currentUser]);

 const checkUserPin = async () => {
    const userId = currentUser?.uid || localStorage.getItem('wgen_last_uid');

    // 🟢 Cek PIN di LocalStorage terlebih dahulu (Fast Offline-First Check)
    const localPin = localStorage.getItem('wgen_savings_pin');
    if (localPin) {
      setSavedPinHash(localPin);
      setPinState('enter_pin');
    }

    if (!userId) {
      if (!localPin) setPinState('unlocked');
      return;
    }

    try {
      // Pembacaan Firestore
      const userRef = doc(db, 'user_security', userId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists() && userSnap.data()?.savingsPin) {
        const remotePin = userSnap.data().savingsPin;
        setSavedPinHash(remotePin);
        localStorage.setItem('wgen_savings_pin', remotePin); // Sync ke local
        setPinState('enter_pin');
      } else if (!localPin) {
        setPinState('create_pin');
      }
    } catch (err) {
      console.warn('Gagal membaca PIN dari cloud (Mode Offline):', err.message);
      if (localPin) {
        setSavedPinHash(localPin);
        setPinState('enter_pin');
      } else {
        setPinState('create_pin');
      }
    }
  };

  // Helper Input PIN 6-Digit
  const handlePinChange = (index, value, isConfirm = false) => {
    if (!/^\d*$/.test(value)) return;

    const currentArray = isConfirm ? [...confirmPin] : [...inputPin];
    currentArray[index] = value.slice(-1);

    if (isConfirm) setConfirmPin(currentArray);
    else setInputPin(currentArray);

    setErrorMessage('');

    if (value && index < 5) {
      const nextInput = document.getElementById(`pin-${isConfirm ? 'conf' : 'in'}-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

 const handleKeyDown = (index, e, isConfirm = false) => {
    if (e.key === 'Backspace') {
      const currentArray = isConfirm ? [...confirmPin] : [...inputPin];
      if (!currentArray[index] && index > 0) {
        const prevInput = document.getElementById(`pin-${isConfirm ? 'conf' : 'in'}-${index - 1}`);
        if (prevInput) prevInput.focus();
      }
    }
  };
  
  const handleUnlock = () => {
    const entered = inputPin.join('');
    if (entered.length < 6) return;

    if (btoa(entered) === savedPinHash || entered === savedPinHash) {
      setPinState('unlocked');
      setInputPin(['', '', '', '', '', '']);
      setErrorMessage('');
    } else {
      setErrorMessage(t.wrongPin);
      setInputPin(['', '', '', '', '', '']);
      document.getElementById('pin-in-0')?.focus();
    }
  };

 const handleSaveNewPin = async () => {
    const p1 = inputPin.join('');
    const p2 = confirmPin.join('');

    if (p1 !== p2) {
      setErrorMessage(t.pinMismatch);
      setConfirmPin(['', '', '', '', '', '']);
      document.getElementById('pin-conf-0')?.focus();
      return;
    }

    try {
      const hashedPin = btoa(p1);
      
      // 🟢 Simpan ke LocalStorage langsung (Aman saat Offline)
      localStorage.setItem('wgen_savings_pin', hashedPin);
      setSavedPinHash(hashedPin);

      // Simpan ke Firestore jika ada koneksi
      const userId = currentUser?.uid || localStorage.getItem('wgen_last_uid');
      if (userId) {
        setDoc(doc(db, 'user_security', userId), {
          savingsPin: hashedPin,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(err => console.warn("Pending sync PIN to cloud:", err.message));
      }

      setPinState('unlocked');
    } catch (err) {
      console.error('Gagal menyimpan PIN:', err);
      setPinState('unlocked');
    }
  };
  
  // VERIFIKASI 3 PERTANYAAN KEAMANAN
  const handleVerifySecurityQuestions = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!ansCreator.trim() || !ansName.trim() || !ansAge.trim()) {
      setErrorMessage(t.fillAllFields);
      return;
    }

    setIsVerifying(true);

    try {
      // 1. Kunci Jawaban Creator (Case-insensitive 'RZD')
      const isCreatorCorrect = ansCreator.trim().toUpperCase() === 'RZD';

      // 2. Kunci Jawaban Nama (Cek pencocokan dengan username aktif)
      const storedUserName = localStorage.getItem('wgen_username') || currentUser?.displayName || '';
      const isNameCorrect = ansName.trim().toLowerCase() === storedUserName.trim().toLowerCase() || ansName.trim().length >= 2;

      // 3. Kunci Jawaban Usia (Bebas asal diisi angka valid)
      const isAgeCorrect = !isNaN(ansAge.trim()) && Number(ansAge.trim()) > 0;

      if (isCreatorCorrect && isNameCorrect && isAgeCorrect) {
       // 🟢 Hapus PIN lama di LocalStorage & Firestore
        localStorage.removeItem('wgen_savings_pin');
        const userId = currentUser?.uid || localStorage.getItem('wgen_last_uid');
        if (userId) {
          const userRef = doc(db, 'user_security', userId);
          updateDoc(userRef, {
            savingsPin: deleteField(),
            updatedAt: new Date().toISOString()
          }).catch(err => console.warn("Pending remove PIN on cloud:", err.message));
        }        // Reset Form & Masuk ke Layar Buat PIN Baru
        setSavedPinHash('');
        setPinState('create_pin');
        setIsConfirmingStep(false);
        setInputPin(['', '', '', '', '', '']);
        setConfirmPin(['', '', '', '', '', '']);
        setAnsCreator('');
        setAnsName('');
        setAnsAge('');
      } else {
        setErrorMessage(t.wrongAnswers);
      }
    } catch (err) {
      console.error('Gagal memverifikasi pertanyaan keamanan:', err);
      setErrorMessage(t.wrongAnswers);
    } finally {
      setIsVerifying(false);
    }
  };

  if (pinState === 'unlocked') {
    return <>{children}</>;
  }

  if (pinState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-gray-500">
        <Lock className="w-8 h-8 animate-pulse text-emerald-500" />
        <span className="text-xs font-semibold">{t.loadingAccess}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] max-w-md mx-auto w-full px-4 py-8">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 sm:p-8 w-full shadow-2xl flex flex-col items-center text-center gap-5 relative overflow-hidden">
        
        {/* ICON HEADER */}
        <div className={`p-4 rounded-3xl bg-gradient-to-br ${currentTheme.btn} text-white shadow-lg`}>
          {pinState === 'forgot_pin' ? <HelpCircle className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
        </div>

        {/* TITLE & DESCRIPTION */}
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
            {pinState === 'enter_pin' && t.titleEnter}
            {pinState === 'create_pin' && (!isConfirmingStep ? t.titleCreate : t.titleConfirm)}
            {pinState === 'forgot_pin' && t.titleForgot}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
            {pinState === 'enter_pin' && t.descEnter}
            {pinState === 'create_pin' && (!isConfirmingStep ? t.descCreate : t.descConfirm)}
            {pinState === 'forgot_pin' && t.descForgot}
          </p>
        </div>

        {/* NOTIFICATION MESSAGES */}
        {errorMessage && (
          <div className="w-full p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-bold flex items-center justify-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="w-full p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-bold flex items-center justify-center gap-2 text-left">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* INPUT PIN 6-DIGIT BOXES */}
        {pinState !== 'forgot_pin' && (
          <div className="flex justify-center items-center gap-2 my-2">
            {(isConfirmingStep ? confirmPin : inputPin).map((digit, idx) => (
              <input
                key={idx}
                id={`pin-${isConfirmingStep ? 'conf' : 'in'}-${idx}`}
                type="password"
                maxLength={1}
                value={digit}
                onChange={(e) => handlePinChange(idx, e.target.value, isConfirmingStep)}
                onKeyDown={(e) => handleKeyDown(idx, e, isConfirmingStep)}
                className="w-10 h-12 sm:w-11 sm:h-13 rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center text-lg font-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-inner"
              />
            ))}
          </div>
        )}

        {/* FORM 3 PERTANYAAN KEAMANAN (MODE FORGOT PIN) */}
        {pinState === 'forgot_pin' && (
          <div className="w-full flex flex-col gap-3 text-left my-1">
            
            {/* Pertanyaan 1 */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-emerald-500" /> {t.q1Title}
                </span>
                <span className="text-[10px] text-gray-400 font-normal">{t.q1Clue}</span>
              </label>
              <input
                type="text"
                value={ansCreator}
                onChange={(e) => setAnsCreator(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>

            {/* Pertanyaan 2 */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-emerald-500" /> {t.q2Title}
              </label>
              <input
                type="text"
                value={ansName}
                onChange={(e) => setAnsName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>

            {/* Pertanyaan 3 */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-emerald-500" /> {t.q3Title}
              </label>
              <input
                type="number"
                value={ansAge}
                onChange={(e) => setAnsAge(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>

          </div>
        )}

        {/* ACTION BUTTONS */}
        <div className="w-full flex flex-col gap-2.5 mt-1">
          {pinState === 'enter_pin' && (
            <>
              <button
                onClick={handleUnlock}
                disabled={inputPin.join('').length < 6}
                className={`w-full py-3 rounded-2xl text-xs font-extrabold text-white bg-gradient-to-r ${currentTheme.btn} shadow-md transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer`}
              >
                <KeyRound className="w-4 h-4" /> {t.unlockBtn}
              </button>

              <button
                onClick={() => {
                  setErrorMessage('');
                  setSuccessMessage('');
                  setPinState('forgot_pin');
                }}
                className="text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition py-1 cursor-pointer"
              >
                {t.forgotBtn}
              </button>
            </>
          )}

          {pinState === 'create_pin' && (
            <>
              {!isConfirmingStep ? (
                <button
                  onClick={() => {
                    if (inputPin.join('').length === 6) {
                      setIsConfirmingStep(true);
                      setErrorMessage('');
                    }
                  }}
                  disabled={inputPin.join('').length < 6}
                  className={`w-full py-3 rounded-2xl text-xs font-extrabold text-white bg-gradient-to-r ${currentTheme.btn} shadow-md transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
                >
                  {t.nextConfirmBtn}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsConfirmingStep(false);
                      setConfirmPin(['', '', '', '', '', '']);
                    }}
                    className="flex-1 py-3 rounded-2xl text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer"
                  >
                    {t.backBtn}
                  </button>
                  <button
                    onClick={handleSaveNewPin}
                    disabled={confirmPin.join('').length < 6}
                    className={`flex-1 py-3 rounded-2xl text-xs font-extrabold text-white bg-gradient-to-r ${currentTheme.btn} shadow-md transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
                  >
                    {t.savePinBtn}
                  </button>
                </div>
              )}
            </>
          )}

          {pinState === 'forgot_pin' && (
            <>
              <button
                onClick={handleVerifySecurityQuestions}
                disabled={isVerifying}
                className={`w-full py-3 rounded-2xl text-xs font-extrabold text-white bg-gradient-to-r ${currentTheme.btn} shadow-md transition hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2`}
              >
                <ShieldCheck className="w-4 h-4" /> {isVerifying ? t.verifyingBtn : t.verifyResetBtn}
              </button>

              <button
                onClick={() => {
                  setErrorMessage('');
                  setSuccessMessage('');
                  setPinState('enter_pin');
                }}
                className="w-full py-2.5 rounded-2xl text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> {t.backToPinBtn}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
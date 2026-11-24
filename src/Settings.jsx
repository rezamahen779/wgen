import { useState, useEffect } from 'react';
import { auth } from './lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  updatePassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  applyActionCode
} from 'firebase/auth';
import { 
  User, 
  Lock, 
  LogOut, 
  Moon, 
  Sun, 
  Palette, 
  ArrowRightLeft, 
  Globe, 
  Code2, 
  X, 
  Eye, 
  EyeOff, 
  HelpCircle,
  Calculator,
} from 'lucide-react';
import { authenticateAndroidBiometric, isBiometricSupported, registerAndroidBiometric } from './lib/biometric';

export const getThemeStyles = (themeId) => {
  const styles = {
    emerald: { gradText: 'from-emerald-500 to-teal-500', icon: 'text-emerald-500', btn: 'from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700', activeRing: 'ring-emerald-500/50 border-emerald-400 dark:border-emerald-600 bg-emerald-100/50 dark:bg-emerald-900/20' },
    tosca: { gradText: 'from-teal-400 to-cyan-600', icon: 'text-teal-400', btn: 'from-teal-400 to-cyan-600 hover:from-teal-500 hover:to-cyan-700', activeRing: 'ring-teal-400/50 border-teal-400 dark:border-teal-600 bg-teal-100/50 dark:bg-teal-900/20' },
    blue: { gradText: 'from-blue-500 to-indigo-500', icon: 'text-blue-500', btn: 'from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700', activeRing: 'ring-blue-500/50 border-blue-400 dark:border-blue-600 bg-blue-100/50 dark:bg-blue-900/20' },
    violet: { gradText: 'from-violet-500 to-purple-500', icon: 'text-violet-500', btn: 'from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700', activeRing: 'ring-violet-500/50 border-violet-400 dark:border-violet-600 bg-violet-100/50 dark:bg-violet-900/20' },
    amber: { gradText: 'from-amber-500 to-orange-500', icon: 'text-amber-500', btn: 'from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700', activeRing: 'ring-amber-500/50 border-amber-400 dark:border-amber-600 bg-amber-100/50 dark:bg-amber-900/20' },
    pinkpeach: { gradText: 'from-pink-500 to-rose-500', icon: 'text-pink-500', btn: 'from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700', activeRing: 'ring-pink-500/50 border-pink-400 dark:border-pink-600 bg-pink-100/50 dark:bg-pink-900/20' }
  };
  return styles[themeId] || styles.emerald;
};

export default function Settings({ 
  userName, setUserName, 
  devBrandName, setDevBrandName, 
  isDarkMode, setIsDarkMode, 
  mainCurrency, setMainCurrency, 
  twoToneTheme, setTwoToneTheme, 
  language, setLanguage,
  session,
  isResetMode, 
  setIsResetMode
}) {
  // --- STATE AKUN & PROFILE ---
  const [inputName, setInputName] = useState(userName || '');

  useEffect(() => {
    setInputName(userName || '');
  }, [userName]);

  const [isDevModalOpen, setIsDevModalOpen] = useState(false);
  const [inputDevName, setInputDevName] = useState(devBrandName || 'Z.D Dev');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [manualLink, setManualLink] = useState('');



  // --- STATE SAKELAR SPLIT BILL FLOATING BUBBLE ---
  const [showSplitBill, setShowSplitBill] = useState(() => {
    return localStorage.getItem('wgen_show_split_bill') === 'true';
  });
// 🟢 STATE BIOMETRIK
  const [useBiometric, setUseBiometric] = useState(() => {
   return localStorage.getItem('wgen_use_biometric') === 'true';
  });  

  const handleToggleSplitBill = (e) => {
    const isChecked = e.target.checked;
    setShowSplitBill(isChecked);
    localStorage.setItem('wgen_show_split_bill', isChecked ? 'true' : 'false');
    window.dispatchEvent(new Event('split-bill-setting-changed'));
  };

  // --- STATE & HANDLER PROTEKSI BIOMETRIK ANDROID ---
// --- STATE & HANDLER PROTEKSI BIOMETRIK ANDROID ---
  const handleToggleBiometric = async (e) => {
    const isChecked = e.target.checked;

    if (isChecked) {
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        alert("Biometrik Android WAJIB menggunakan koneksi HTTPS aman (atau localhost)!");
        setUseBiometric(false);
        return;
      }

      const supported = await isBiometricSupported();
      if (!supported) {
        alert("Perangkat ini tidak mendukung atau belum mendaftarkan Sidik Jari/PIN Layar di Pengaturan HP.");
        setUseBiometric(false);
        return;
      }

      const success = await registerAndroidBiometric(auth.currentUser?.uid || "wgen_user");
      if (success) {
        setUseBiometric(true);
        localStorage.setItem("wgen_use_biometric", "true");
        window.dispatchEvent(new Event('biometric-setting-changed'));
        alert(t.bioAlertActive);
      } else {
        setUseBiometric(false);
        localStorage.setItem("wgen_use_biometric", "false");
        alert(t.bioAlertCancel);
      }
    } else {
      setUseBiometric(false);
      localStorage.setItem("wgen_use_biometric", "false");
      localStorage.removeItem("wgen_biometric_credential_id");
      window.dispatchEvent(new Event('biometric-setting-changed'));
    }
  };
   
  // --- HANDLER FORMAT INPUT NOMINAL DENGAN PEMISAH RIBUAN ---
  const handleCalcAmountChange = (e) => {
    const rawValue = e.target.value.replace(/,/g, '');
    if (rawValue === '' || !isNaN(rawValue)) {
      if (rawValue === '') {
        setCalcAmount('');
      } else {
        const parts = rawValue.split('.');
        parts[0] = Number(parts[0]).toLocaleString('en-US');
        setCalcAmount(parts.join('.'));
      }
    }
  };

  const calculateResult = () => {
    const cleanAmount = calcAmount.toString().replace(/,/g, '');
    const amt = parseFloat(cleanAmount) || 0;
    if (!rawRates[fromCurr] || !rawRates[toCurr]) return '0';

    const amountInUSD = amt / rawRates[fromCurr];
    const finalAmount = amountInUSD * rawRates[toCurr];

    if (finalAmount === 0) return '0';
    if (finalAmount < 1) {
      return finalAmount.toLocaleString('en-US', { maximumSignificantDigits: 3 });
    }

    return finalAmount.toLocaleString('en-US', { 
      minimumFractionDigits: 1, 
      maximumFractionDigits: 3 
    });
  };

  // --- OPSI & LOKALISASI BHS ---
  const tSettings = {
    id: { 
      title: 'Pengaturan', profile: 'Nama Pengguna', save: 'Simpan', cancel: 'Batal', 
      langTitle: 'Bahasa', currTitle: 'Mata Uang utama', 
      splitBillTitle: 'Split Bill Floating Bubble', splitBillDesc: 'Tampilkan balon kalkulator bagi tagihan melayang di aplikasi',
      bioTitle: 'Sidik Jari / Lockscreen Android', bioDesc: 'Amankan aplikasi menggunakan biometrik HP',
      bioAlertActive: '🔒 Proteksi Biometrik Android berhasil diaktifkan!', bioAlertCancel: '❌ Dibatalkan atau verifikasi Fingerprint gagal.',
      themeTitle: 'Tema & Two-Tone', modeTitle: 'Mode Tampilan', dark: 'Dark Mode', light: 'Light Mode', 
      themeChoose: 'Pilih Warna Gradasi:', authTitle: 'Autentikasi Akun', loggedInAs: 'Login sebagai:', 
      logout: 'Keluar', loginDesc: 'Masuk dengan Email & Password atau Google untuk sinkronisasi data.', 
      loginBtn: 'Masuk (Login)', registerBtn: 'Daftar Akun', googleBtn: 'Masuk dengan Google',
      forgotTitle: 'Lupa Password?', emailLabel: 'Email Akun', forgotBtn: 'Kirim Link Reset',
      result: 'Hasil Konversi', updateBtn: 'Update Kurs', updatedText: 'Diperbarui:', 
      lockedMsg: 'Login & isi User Name terlebih dahulu untuk membuka pengaturan',
      namePlaceholder: 'Nama kamu...', emailPlaceholder: 'Email...', passPlaceholder: 'Password...', 
      newPassPlaceholder: 'Password Baru...', devModalTitle: 'Edit Developer Name', devNameLabel: 'Nama Developer',
      newPassMode: 'Buat Password Baru', recoveryActive: 'Mode Pemulihan Aktif', 
      recoveryDesc: 'Masukkan password baru untuk akun Anda.', saveNewPass: 'Simpan Password Baru',
      themeActive: 'Aktif', calcPlaceholder: 'Nominal...', 
      manualLinkBtnBtnText: 'Petunjuk jika verifikasi link email gagal diklik',
      manualLinkPlaceholder: 'Paste link dari email di sini jika gagal diklik...', manualLinkBtn: 'Proses Link',
      helpTitle: 'Cara Reset Password',
      helpStep1: '1. Klik ikon 🔐 Autentikasi Akun, masukkan email kamu lalu klik "Kirim Link Reset".',
      helpStep2: '2. Buka inbox/spam email dari Firebase dan klik link verifikasi secara langsung.',
      helpStep3: '3. Jika link di email tidak dapat diklik langsung, tekan lama (copy link), lalu tempelkan (paste) pada kolom "Proses Link" di bawah.',
      helpClose: 'Mengerti',
      alerts: {
        emptyFields: 'Email dan password wajib diisi!', loginSuccess: 'Berhasil Masuk!', loginFailed: 'Gagal Login: Email belum terdaftar atau password salah.',
        regSuccess: 'Pendaftaran berhasil! Silakan langsung klik Login.', regFailed: 'Gagal Daftar: ', emptyResetFields: 'Email wajib diisi!',
        resetSuccess: 'Link reset password berhasil dikirim! Silakan cek inbox/spam email Anda.', resetFailed: 'Gagal mengirim link reset: ',
        nameEmpty: 'User Name tidak boleh kosong! Menu aplikasi akan dikunci.', nameSuccess: 'User Name berhasil diperbarui!',
        newPassEmpty: 'Password baru tidak boleh kosong!', newPassSuccess: 'Password berhasil diubah! Silakan login ulang.',
        updatePassFailed: 'Gagal memperbarui password: ',
        emptyLink: 'Harap masukkan link dari email terlebih dahulu!',
        validLink: '✅ Link valid! Silakan buat Password Baru Anda.',
        invalidToken: '❌ Gagal memverifikasi token: ',
        noToken: '❌ oobCode / Token tidak ditemukan di dalam link tersebut.',
        systemError: '❌ Terjadi kesalahan: ',
        googleFailed: 'Gagal Login Google: '
      }
    },
    jp: { 
      title: '設定', profile: 'ユーザー名', save: '保存', cancel: 'キャンセル', 
      langTitle: '言語', currTitle: '主要通貨',
      splitBillTitle: '割り勘フローティングボタン', splitBillDesc: 'アプリ上に割り勘計算機のフローティングボタンを表示',
      bioTitle: '指紋認証 / Android画面ロック', bioDesc: '端末の生体認証でアプリを保護',
      bioAlertActive: '🔒 生体認証が有効になりました！', bioAlertCancel: '❌ キャンセルされたか認証に失敗しました。',
      themeTitle: 'テーマとツートン', modeTitle: '表示モード', dark: 'ダーク', light: 'ライト', 
      themeChoose: 'グラデーションを選択:', authTitle: 'アカウント認証', loggedInAs: 'ログイン中:', 
      logout: 'ログアウト', loginDesc: 'メール/パスワードまたはGoogleでログインします。', 
      loginBtn: 'ログイン', registerBtn: '新規登録', googleBtn: 'Googleでログイン',
      forgotTitle: 'パスワードを忘れたか？', emailLabel: 'アカウントメール', forgotBtn: 'リセットリンクを送信',
      result: '換算結果', updateBtn: 'レート更新', updatedText: '更新時刻:', 
      lockedMsg: '設定を変更するにはログインとユーザー名が必要です',
      namePlaceholder: 'あなたの名前...', emailPlaceholder: 'メールアドレス...', passPlaceholder: 'パスワード...', 
      newPassPlaceholder: '新しいパスワード...', devModalTitle: '開発者名の編集', devNameLabel: '開発者名',
      newPassMode: '新しいパスワードを作成', recoveryActive: 'リカバリモード有効', 
      recoveryDesc: 'アカウントの新しいパスワードを入力してください。', saveNewPass: '新しいパスワードを保存',
      themeActive: 'アクティブ', calcPlaceholder: '金額...', 
      manualLinkBtnBtnText: 'メールリンクが直接開かない場合の手順',
      manualLinkPlaceholder: '直接開かない場合はメールのリンクを貼り付け...', manualLinkBtn: '処理する',
      helpTitle: 'パスワード再設定手順',
      helpStep1: '1. 🔐アイコンをタップしてメールアドレスを入力し、「リセットリンクを送信」を押します。',
      helpStep2: '2. 届いたメールを確認し、記載されているリンクを直接タップします。',
      helpStep3: '3. リンクが開かない場合は長押ししてコピーし、下の「処理する」欄に貼り付けて送信してください。',
      helpClose: '了解',
      alerts: {
        emptyFields: 'メールアドレスとパスワードを入力してください！', loginSuccess: 'ログインしました！', loginFailed: 'ログイン失敗：メールアドレスが登録されていないか、パスワードが間違っています。',
        regSuccess: '登録が完了しました！ログインしてください。', regFailed: '登録失敗：', emptyResetFields: 'メールアドレスを入力してください！',
        resetSuccess: 'リセットリンクが送信されました！受信トレイまたは迷惑メールを確認してください。', resetFailed: 'リンクの送信に失敗しました：',
        nameEmpty: 'ユーザー名を空にすることはできません！アプリメニューがロックされます。', nameSuccess: 'ユーザー名が更新されました！',
        newPassEmpty: '新しいパスワードを空にすることはできません！', newPassSuccess: 'パスワードが変更されました！再度ログインしてください。',
        updatePassFailed: 'パスワードの更新に失敗しました：',
        emptyLink: '最初にメールのリンクを入力してください！',
        validLink: '✅ 有効なリンクです！新しいパスワードを作成してください。',
        invalidToken: '❌ トークンの検証に失敗しました：',
        noToken: '❌ リンク内にトークンが見つかりません。',
        systemError: '❌ エラーが発生しました：',
        googleFailed: 'Googleログイン失敗：'
      }
    },
    en: { 
      title: 'Settings', profile: 'User Name', save: 'Save', cancel: 'Cancel', 
      langTitle: 'Language', currTitle: 'Main Currency', 
      splitBillTitle: 'Split Bill Floating Bubble', splitBillDesc: 'Show floating split bill calculator bubble across app',
      bioTitle: 'Fingerprint / Android Lockscreen', bioDesc: 'Secure app with device biometric',
      bioAlertActive: '🔒 Android Biometric Protection successfully enabled!', bioAlertCancel: '❌ Cancelled or Fingerprint verification failed.',
      themeTitle: 'Theme & Two-Tone', modeTitle: 'Display Mode', dark: 'Dark Mode', light: 'Light Mode', 
      themeChoose: 'Choose Gradient:', authTitle: 'Authentication', loggedInAs: 'Logged in as:', 
      logout: 'Logout', loginDesc: 'Sign in with Email & Password or Google to sync data.', 
      loginBtn: 'Login', registerBtn: 'Register', googleBtn: 'Sign in with Google',
      forgotTitle: 'Forgot Password?', emailLabel: 'Account Email', forgotBtn: 'Send Reset Link',
      result: 'Converted Amount', updateBtn: 'Update Rates', updatedText: 'Rates updated at:', 
      lockedMsg: 'Login and User Name required to modify settings',
      namePlaceholder: 'Your name...', emailPlaceholder: 'Email...', passPlaceholder: 'Password...', 
      newPassPlaceholder: 'New Password...', devModalTitle: 'Edit Developer Name', devNameLabel: 'Developer Name',
      newPassMode: 'Create New Password', recoveryActive: 'Recovery Mode Active', 
      recoveryDesc: 'Enter a new password for your account.', saveNewPass: 'Save New Password',
      themeActive: 'Active', calcPlaceholder: 'Amount...', 
      manualLinkBtnBtnText: 'Instructions if email verification link fails to open',
      manualLinkPlaceholder: 'Paste link from email here if direct click fails...', manualLinkBtn: 'Process Link',
      helpTitle: 'How to Reset Password',
      helpStep1: '1. Click the 🔐 icon, enter your email, and click "Send Reset Link".',
      helpStep2: '2. Check your inbox/spam folder and click the verification link directly.',
      helpStep3: '3. If clicking directly fails, copy the link and paste it into the "Process Link" box below.',
      helpClose: 'Got it',
      alerts: {
        emptyFields: 'Email and password are required!', loginSuccess: 'Successfully Logged In!', loginFailed: 'Login Failed: Email not registered or incorrect password.',
        regSuccess: 'Registration successful! Please click Login now.', regFailed: 'Registration Failed: ', emptyResetFields: 'Email is required!',
        resetSuccess: 'Password reset link sent! Please check your inbox or spam folder.', resetFailed: 'Failed to send reset link: ',
        nameEmpty: 'User Name cannot be empty! App menus will be locked.', nameSuccess: 'User Name updated successfully!',
        newPassEmpty: 'New password cannot be empty!', newPassSuccess: 'Password successfully changed! Please log in again.',
        updatePassFailed: 'Failed to update password: ',
        emptyLink: 'Please enter the email link first!',
        validLink: '✅ Valid link! Please create your new password.',
        invalidToken: '❌ Failed to verify token: ',
        noToken: '❌ Token not found inside the provided link.',
        systemError: '❌ An error occurred: ',
        googleFailed: 'Google Login Failed: '
      }
    },
    ar: { 
      title: 'الإعدادات', profile: 'اسم المستخدم', save: 'حفظ', cancel: 'إلغاء', 
      langTitle: 'اللغة', currTitle: 'العملة الرئيسية',
      splitBillTitle: 'حاسبة تقسيم الفاتورة العائمة', splitBillDesc: 'إظهار زر حاسبة تقسيم الفاتورة العائم في التطبيق',
      bioTitle: 'البصمة / قفل شاشة أندرويد', bioDesc: 'تأمين التطبيق باستخدام البصمة',
      bioAlertActive: '🔒 تم تفعيل الحماية الحيوية بنجاح!', bioAlertCancel: '❌ تم الإلغاء أو فشل التحقق.',  
      themeTitle: 'السمة وتدرج اللون', modeTitle: 'وضع العرض', dark: 'ليلي', light: 'نهاري', 
      themeChoose: 'اختر التدرج:', authTitle: 'المصادقة', loggedInAs: 'تسجيل دخول باسم:', 
      logout: 'تسجيل خروج', loginDesc: 'تسجيل الدخول بالبريد الإلكتروني أو جوجل.', 
      loginBtn: 'تسجيل الدخول', registerBtn: 'إنشاء حساب', googleBtn: 'تسجيل الدخول باستخدام Google',
      forgotTitle: 'هل نسيت كلمة المرور؟', emailLabel: 'البريد الإلكتروني', forgotBtn: 'إرسال رابط',
      result: 'النتيجة', updateBtn: 'تحديث الأسعار', updatedText: 'آخر تحديث:', 
      lockedMsg: 'يجب تسجيل الدخول لتعديل الإعدادات',
      namePlaceholder: 'اسمك...', emailPlaceholder: 'البريد الإلكتروني...', passPlaceholder: 'كلمة المرور...', 
      newPassPlaceholder: 'كلمة المرور الجديدة...', devModalTitle: 'تعديل اسم المطور', devNameLabel: 'اسم المطور',
      newPassMode: 'إنشاء كلمة مرور جديدة', recoveryActive: 'وضع الاسترداد نشط', 
      recoveryDesc: 'أدخل كلمة مرور جديدة لحسابك.', saveNewPass: 'حفظ كلمة المرور الجديدة',
      themeActive: 'نشط', calcPlaceholder: 'المبلغ...', 
      manualLinkBtnBtnText: 'تعليمات إذا تعذر النقر على رابط البريد الإلكتروني',
      manualLinkPlaceholder: 'الصق الرابط من البريد الإلكتروني هنا إذا فشل النقر المباشر...', manualLinkBtn: 'معالجة الرابط',
      helpTitle: 'كيفية إعادة تعيين كلمة المرور',
      helpStep1: 'انقر على رمز 🔐، وأدخل بريدك الإلكتروني ثم اضغط على "إرسال رابط".',
      helpStep2: '2. تحقق من بريدك الإلكتروني وانقر مباشرة على رابط التحقق.',
      helpStep3: '3. إذا تعذر النقر المباشر، انسخ الرابط والصقه في حقل "معالجة الرابط" أدناه.',
      helpClose: 'فهمت',
      alerts: {
        emptyFields: 'البريد الإلكتروني وكلمة المرور مطلوبان!', loginSuccess: 'تم تسجيل الدخول بنجاح!', loginFailed: 'فشل تسجيل الدخول: البريد الإلكتروني غير مسجل أو كلمة المرور غير صحيحة.',
        regSuccess: 'تم التسجيل بنجاح! يرجى النقر فوق تسجيل الدخول.', regFailed: 'فشل التسجيل: ', emptyResetFields: 'البريد الإلكتروني مطلوب!',
        resetSuccess: 'تم إرسال رابط إعادة التعيين! يرجى التحقق من بريدك الإلكتروني.', resetFailed: 'فشل إرسال الرابط: ',
        nameEmpty: 'اسم المستخدم لا يمكن أن يكون فارغاً! سيتم قفل القوائم.', nameSuccess: 'تم تحديث اسم المستخدم بنجاح!',
        newPassEmpty: 'كلمة المرور الجديدة لا يمكن أن تكون فارغة!', newPassSuccess: 'تم تغيير كلمة المرور بنجاح! يرجى تسجيل الدخول مرة أخرى.',
        updatePassFailed: 'فشل تحديث كلمة المرور: ',
        emptyLink: 'يرجى إدخال الرابط من البريد الإلكتروني أولاً!',
        validLink: '✅ رابط صالح! يرجى إنشاء كلمة المرور الجديدة.',
        invalidToken: '❌ فشل التحقق من الرمز: ',
        noToken: '❌ لم يتم العثور على الرمز داخل الرابط.',
        systemError: '❌ حدث خطأ: ',
        googleFailed: 'فشل تسجيل الدخول باستخدام Google: '
      }
    },
    cn: { 
      title: '设置', profile: '用户名', save: '保存', cancel: '取消', 
      langTitle: '语言', currTitle: '主要货币', 
      splitBillTitle: 'AA分摊悬浮按钮', splitBillDesc: '在应用中显示AA制计算器悬浮按钮',
      bioTitle: '指纹 / 安卓屏幕锁', bioDesc: '使用设备生物识别保护应用',
      bioAlertActive: '🔒 生物识别保护已激活！', bioAlertCancel: '❌ 已取消或指纹验证失败。',      
      themeTitle: '主题与双色', modeTitle: '显示模式', dark: '深色', light: '浅色', 
      themeChoose: '选择渐变色:', authTitle: '账户认证', loggedInAs: '登录为:', 
      logout: '退出', loginDesc: '使用邮箱和密码或Google登录以同步数据。', 
      loginBtn: '登录', registerBtn: '注册', googleBtn: '使用 Google 登录',
      forgotTitle: '忘记密码？', emailLabel: '账户邮箱', forgotBtn: '发送重置链接',
      result: '转换结果', updateBtn: '更新汇率', updatedText: '更新时间:', 
      lockedMsg: '登录后才能修改设置',
      namePlaceholder: '你的名字...', emailPlaceholder: '电子邮箱...', passPlaceholder: '密码...', 
      newPassPlaceholder: '新密码...', devModalTitle: '编辑开发者名称', devNameLabel: '开发者名称',
      newPassMode: '创建新密码', recoveryActive: '恢复模式已激活', 
      recoveryDesc: '请输入您账户的新密码。', saveNewPass: '保存新密码',
      themeActive: '活跃', calcPlaceholder: '金额...', 
      manualLinkBtnBtnText: '无法直接点击邮件链接时的说明',
      manualLinkPlaceholder: '如果无法直接点击，请在此粘贴邮件中的链接...', manualLinkBtn: '处理链接',
      helpTitle: '如何重置密码',
      helpStep1: '1. 点击 🔐 图标，输入您的邮箱，然后点击“发送重置链接”。',
      helpStep2: '2. 检查您的收件箱/垃圾邮件，直接点击验证链接。',
      helpStep3: '3. 如果无法直接点击，请复制链接并将其粘贴到下方的“处理链接”框中。',
      helpClose: '明白了',
      alerts: {
        emptyFields: '电子邮件和密码不能为空！', loginSuccess: '登录成功！', loginFailed: '登录失败：邮箱未注册或密码错误。',
        regSuccess: '注册成功！请直接点击登录。', regFailed: '注册失败：', emptyResetFields: '电子邮件不能为空！',
        resetSuccess: '密码重置链接已发送！请检查您的收件箱或垃圾邮件。', resetFailed: '发送重置链接失败：',
        nameEmpty: '用户名不能为空！菜单将被锁定。', nameSuccess: '用户名更新成功！',
        newPassEmpty: '新密码不能为空！', newPassSuccess: '密码修改成功！请重新登录。',
        updatePassFailed: '更新密码失败：',
        emptyLink: '请先输入邮件中的链接！',
        validLink: '✅ 链接有效！请创建新密码。',
        invalidToken: '❌ 验证 Token 失败：',
        noToken: '❌ 链接中未找到 Token。',
        systemError: '❌ 发生错误：',
        googleFailed: 'Google 登录失败：'
      }
    }
  };

  const t = tSettings[language] || tSettings['id'];
  const a = t.alerts;

  const getThemeNames = (lang) => {
    const names = {
      id: ['Tosca Modern', 'Biru Samudra', 'Ungu Royal', 'Kuning Senja', 'Pink Peach'],
      jp: ['モダンツスカ', 'オーシャンブルー', 'ロイヤルバイオレット', 'サンセットアンバー', 'ピンクピーチ'],
      en: ['Modern Tosca', 'Ocean Blue', 'Royal Violet', 'Sunset Amber', 'Pink Peach'],
      ar: ['توسكا حديث', 'أزرق محيطي', 'بنفسجي ملكي', 'عنبر الغروب', 'خوخي وردي'],
      cn: ['现代托斯卡', '海洋蓝', '皇家紫', '日落琥珀', '粉桃色']
    };
    return names[lang] || names.id;
  };
  const tNames = getThemeNames(language);

  const activeThemeId = twoToneTheme || 'emerald';
  const currentTheme = getThemeStyles(activeThemeId);

  const themes = [
    { id: 'tosca', name: tNames[0], gradBg: 'from-teal-400 to-cyan-600' },
    { id: 'blue', name: tNames[1], gradBg: 'from-blue-400 to-indigo-600' },
    { id: 'violet', name: tNames[2], gradBg: 'from-violet-400 to-purple-600' },
    { id: 'amber', name: tNames[3], gradBg: 'from-amber-400 to-orange-600' },
    { id: 'pinkpeach', name: tNames[4], gradBg: 'from-pink-500 to-rose-500' },
  ];

  // --- ACTIONS HANDLERS ---
  const handleUpdateName = (e) => {
    e.preventDefault();
    const trimmed = inputName.trim();
    
    if (!trimmed) {
      setUserName('');
      localStorage.removeItem('wgen_username');
      alert(a.nameEmpty);
      return;
    }
    
    setUserName(trimmed);
    localStorage.setItem('wgen_username', trimmed);
    alert(a.nameSuccess);
  };

  const handleSaveDevName = (e) => {
    e.preventDefault();
    const finalName = inputDevName.trim() === '' ? 'Z.D Dev' : inputDevName;
    setDevBrandName(finalName);
    localStorage.setItem('wgen_dev_brand', finalName);
    setIsDevModalOpen(false);
  };

  const handleCurrencyChange = (newCurr) => {
    setMainCurrency(newCurr);
    localStorage.setItem('wgen_main_currency', newCurr);
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert(a.emptyFields);
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert(a.loginSuccess);
    } catch (error) {
      alert(a.loginFailed);
    }
  };

  const handleEmailRegister = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert(a.emptyFields);
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert(a.regSuccess);
    } catch (error) {
      alert(a.regFailed + error.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      alert(a.loginSuccess);
    } catch (error) {
      console.error('Google Login Error:', error);
      alert(a.googleFailed + error.message);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!resetEmail) {
      alert(a.emptyResetFields);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      alert(a.resetSuccess);
      setIsForgotModalOpen(false);
      setResetEmail('');
    } catch (error) {
      alert(a.resetFailed + error.message);
    }
  };

  const handleUpdateNewPassword = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      alert(a.newPassEmpty);
      return;
    }

    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        alert(a.newPassSuccess);
        setIsResetMode(false);
        await signOut(auth);
      } else {
        alert(a.updatePassFailed + "User tidak ditemukan.");
      }
    } catch (error) {
      alert(a.updatePassFailed + error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleProcessManualLink = async (e) => {
    e.preventDefault();
    if (!manualLink.trim()) {
      alert(a.emptyLink);
      return;
    }

    try {
      let oobCode = '';
      if (manualLink.includes('oobCode=')) {
        const match = manualLink.match(/oobCode=([^&]*)/);
        if (match) oobCode = decodeURIComponent(match[1]);
      }

      if (oobCode) {
        await applyActionCode(auth, oobCode);
        alert(a.validLink);
        setIsResetMode(true);
        setManualLink('');
      } else {
        alert(a.noToken);
      }
    } catch (error) {
      alert(a.systemError + error.message);
    }
  };

  const handleSelectTheme = (thId) => {
    if (activeThemeId === thId) {
      setTwoToneTheme('emerald');
      localStorage.setItem('wgen_theme', 'emerald');
    } else {
      setTwoToneTheme(thId);
      localStorage.setItem('wgen_theme', thId);
    }
  };

    const currencies = [
      { code: 'AED', label: 'AED (DH - UAE Dirham)' },
      { code: 'AUD', label: 'AUD (A$ - Australian)' },
      { code: 'CNY', label: 'CNY (¥ - Chinese Yuan)' },
      { code: 'EUR', label: 'EUR (€ - Euro)' },
      { code: 'GBP', label: 'GBP (£ - British Pound)' },
      { code: 'IDR', label: 'IDR (Rp - Rupiah)' },
      { code: 'JPY', label: 'JPY (¥ - Japanese Yen)' },
      { code: 'KRW', label: 'KRW (₩ - South Korean)' },
      { code: 'MYR', label: 'MYR (RM - Malaysian)' },
      { code: 'SAR', label: 'SAR (﷼ - Saudi Riyal)' },
      { code: 'SGD', label: 'SGD (S$ - Singapore)' },
      { code: 'THB', label: 'THB (฿ - Thai Baht)' },
      { code: 'USD', label: 'USD ($ - US Dollar)' },
    ];
    const languages = [
      { code: 'id', label: 'Bahasa Indonesia' }, { code: 'jp', label: '日本語 (Japanese)' }, { code: 'en', label: 'English (US)' }, { code: 'ar', label: 'العربية (Arabic)' }, { code: 'cn', label: '中文 (Chinese)' },
    ];

  const cardStyles = "bg-gray-200/80 dark:bg-gray-950 border border-gray-300 dark:border-gray-900 p-5 rounded-3xl shadow-sm flex flex-col gap-4";
  const inputStyles = "bg-gray-100/50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-300 dark:border-gray-800 text-sm font-semibold focus:outline-none";

  const isUnlocked = Boolean(session && userName && userName.trim());

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto w-full pb-10 text-gray-800 dark:text-gray-200 relative">
      <h2 className={`text-2xl font-extrabold tracking-tight bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>
        {t.title}
      </h2>

      {/* AUTH CARD */}
      <div className={cardStyles}>
        <div className="flex justify-between items-center">
          <div className={`flex items-center gap-2 font-bold ${currentTheme.icon}`}>
            <button
              type="button"
              onClick={() => {
                if (!session) setIsForgotModalOpen(true);
              }}
              disabled={Boolean(session)}
              className={`flex items-center gap-1.5 focus:outline-none transition ${
                !session ? 'hover:scale-105 cursor-pointer' : 'cursor-default'
              }`}
              title={session ? t.authTitle : t.forgotTitle}
            >
              <span className="text-xl">🔐</span>
              <span className={`bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>
                {isResetMode ? t.newPassMode : t.authTitle}
              </span>
            </button>
          </div>
        </div>

        {isResetMode ? (
          <form onSubmit={handleUpdateNewPassword} className="flex flex-col gap-3">
            <p className="text-xs opacity-80 mb-1 font-bold text-amber-500">
              {t.recoveryActive}
            </p>
            <p className="text-xs opacity-80">
              {t.recoveryDesc}
            </p>
            
            <div className="relative flex items-center">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder={t.newPassPlaceholder} 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                className={`${inputStyles} w-full pr-10`} 
                autoFocus
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="submit"
              className={`bg-gradient-to-r ${currentTheme.btn} text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md mt-1`}
            >
              {t.saveNewPass}
            </button>
          </form>
        ) : session ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs opacity-80">{t.loggedInAs} <strong className="text-gray-900 dark:text-white">{session.email || (session.user && session.user.email)}</strong></p>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-md"
            >
              <LogOut className="w-4 h-4" /> {t.logout}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <form onSubmit={handleEmailLogin} className="flex flex-col gap-3 border-b border-gray-300 dark:border-gray-800 pb-5">
              <p className="text-xs opacity-80">{t.loginDesc}</p>
              
              <input 
                type="email" 
                placeholder={t.emailPlaceholder} 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className={inputStyles} 
              />

              <div className="relative flex items-center">
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder={t.passPlaceholder} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className={`${inputStyles} w-full pr-10`} 
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleEmailRegister}
                  className="flex-1 bg-gray-300 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold py-2.5 rounded-xl text-xs transition hover:opacity-80"
                >
                  {t.registerBtn}
                </button>
                <button
                  type="submit"
                  className={`flex-1 bg-gradient-to-r ${currentTheme.btn} text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md`}
                >
                  {t.loginBtn}
                </button>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold py-2.5 rounded-xl text-xs border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                {t.googleBtn}
              </button>
            </form>

            <form onSubmit={handleProcessManualLink} className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setIsHelpModalOpen(true)}
                className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 flex items-center gap-1.5 transition text-left w-fit focus:outline-none"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                <span className="underline decoration-dotted">{t.manualLinkBtnBtnText}</span>
              </button>
              
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder={t.manualLinkPlaceholder} 
                  value={manualLink} 
                  onChange={(e) => setManualLink(e.target.value)} 
                  className={`flex-1 ${inputStyles} text-xs`} 
                />
                <button
                  type="submit"
                  className={`px-3 py-2 rounded-xl text-xs font-bold text-white transition bg-gradient-to-r ${currentTheme.btn}`}
                >
                  {t.manualLinkBtn}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* SAKELAR SPLIT BILL FLOATING BUBBLE */}
      <div className={cardStyles}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl bg-gray-300/60 dark:bg-gray-900 ${currentTheme.icon}`}>
              <Calculator className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-gray-900 dark:text-white">{t.splitBillTitle}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{t.splitBillDesc}</span>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={showSplitBill} 
              onChange={handleToggleSplitBill} 
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>
      </div>

      {/* CARD PROTECTION BIOMETRIC ANDROID */}
      <div className={cardStyles}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl bg-gray-300/60 dark:bg-gray-900 ${currentTheme.icon}`}>
              <Lock className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              {/* 🟢 SUDAH DINAMIS SESUAI BAHASA */}
              <span className="text-sm font-bold text-gray-900 dark:text-white">{t.bioTitle}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{t.bioDesc}</span>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={useBiometric} 
              onChange={handleToggleBiometric} 
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>
      </div>

      {/* LANGUAGE CARD */}
      <div className={cardStyles}>
        <div className={`flex items-center gap-2 font-bold ${currentTheme.icon}`}>
          <Globe className="w-5 h-5" />
          <span className={`bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{t.langTitle}</span>
        </div>
        <select value={language} onChange={(e) => { setLanguage(e.target.value); localStorage.setItem('wgen_lang', e.target.value); }} className={`${inputStyles} cursor-pointer w-full`}>
          {languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
      </div>

      {/* USER NAME CARD */}
      <div className={cardStyles}>
        <div className="flex justify-between items-center">
          <div className={`flex items-center gap-2 font-bold ${currentTheme.icon}`}>
            <User className="w-5 h-5" /> 
            <span className={`bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{t.profile}</span>
          </div>
        </div>
        
        <form onSubmit={handleUpdateName} className="flex gap-2 mt-1">
          <input
            type="text" 
            value={inputName} 
            onChange={(e) => setInputName(e.target.value)}
            className={`flex-1 ${inputStyles}`} 
            placeholder={t.namePlaceholder}
          />
          <button type="submit" className={`bg-gradient-to-r ${currentTheme.btn} text-white font-extrabold px-5 py-2.5 rounded-xl text-sm transition shadow-md`}>
            {t.save}
          </button>
        </form>
      </div>

      <div className={`flex flex-col gap-6 relative transition ${!isUnlocked ? 'opacity-50 pointer-events-none select-none' : ''}`}>
        
        {!isUnlocked && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
            <div className="bg-amber-500/90 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold pointer-events-auto backdrop-blur-md">
              <Lock className="w-4 h-4" />
              {t.lockedMsg}
            </div>
          </div>
        )}

        {/* MAIN CURRENCY CARD */}
      <div className={cardStyles}>
        <div className="flex justify-between items-center">
          <div className={`flex items-center gap-2 font-bold ${currentTheme.icon}`}>
            <ArrowRightLeft className="w-5 h-5" />
            <span className={`bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>
              {t.currTitle || 'Mata Uang Utama'}
            </span>
          </div>
        </div>

        <select 
          value={mainCurrency} 
          onChange={(e) => handleCurrencyChange(e.target.value)} 
          className={`${inputStyles} cursor-pointer w-full`}
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </div>

        {/* THEME CARD */}
        <div className={cardStyles}>
          <div className={`flex items-center gap-2 font-bold ${currentTheme.icon}`}>
            <Palette className="w-5 h-5" />
            <span className={`bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{t.themeTitle}</span>
          </div>
          
          <div className="flex justify-between items-center bg-gray-100/50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-300 dark:border-gray-800">
            <span className="text-sm font-medium">{t.modeTitle}</span>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 rounded-xl bg-gray-300 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:opacity-80 transition flex items-center justify-center">
              {isDarkMode ? <Moon className="w-4 h-4 text-cyan-400" /> : <Sun className="w-4 h-4 text-yellow-600" />}
            </button>
          </div>

          <div className="flex flex-col gap-2 mt-1">
            <span className="text-xs font-semibold opacity-70">{t.themeChoose}</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {themes.map((th) => {
                const isActive = activeThemeId === th.id;
                return (
                  <button
                    key={th.id}
                    onClick={() => handleSelectTheme(th.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isActive ? `${currentTheme.activeRing} ring-2` : 'border-gray-300 dark:border-gray-800 bg-gray-100/30 dark:bg-gray-900/30 hover:bg-gray-200 dark:hover:bg-gray-800'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-4 h-4 rounded-full bg-gradient-to-br ${th.gradBg} shadow-sm`}></span>
                      <span className={`text-xs font-bold ${isActive ? 'opacity-100' : 'opacity-70'}`}>{th.name}</span>
                    </div>
                    {isActive && <span className={`text-[10px] font-extrabold uppercase tracking-wide bg-gradient-to-r ${currentTheme.gradText} bg-clip-text text-transparent`}>{t.themeActive}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* TOMBOL DEVELOPER BRAND */}
        <div className="flex justify-center mt-2">
          <button 
            type="button"
            onDoubleClick={() => { setInputDevName(devBrandName || 'Z.D Dev'); setIsDevModalOpen(true); }}
            className="opacity-40 hover:opacity-90 transition cursor-pointer p-1 focus:outline-none"
            title="Edit Developer Name"
          >
            <Code2 className={`w-6 h-6 ${currentTheme.icon}`} />
          </button>
        </div>

      </div>

      {/* POPUP MODAL CARA LUPA PASSWORD */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 w-full max-w-sm p-6 rounded-3xl shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold">{t.helpTitle}</h3>
              </div>
              <button 
                onClick={() => setIsHelpModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs opacity-90 leading-relaxed py-1">
              <p>{t.helpStep1}</p>
              <p>{t.helpStep2}</p>
              <p>{t.helpStep3}</p>
            </div>

            <button 
              type="button"
              onClick={() => setIsHelpModalOpen(false)}
              className={`w-full mt-2 bg-gradient-to-r ${currentTheme.btn} text-white font-bold py-2.5 rounded-xl text-xs shadow-md`}
            >
              {t.helpClose}
            </button>
          </div>
        </div>
      )}

      {/* FORGOT PASSWORD MODAL */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 w-full max-w-sm p-6 rounded-3xl shadow-2xl flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800">
                  <span className="text-xl">🔐</span>
                </div>
                <h3 className="text-lg font-bold">{t.forgotTitle}</h3>
              </div>
              <button 
                onClick={() => setIsForgotModalOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">{t.emailLabel}</label>
                <input 
                  type="email" 
                  value={resetEmail} 
                  onChange={(e) => setResetEmail(e.target.value)}
                  className={inputStyles}
                  placeholder="email@domain.com"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  {t.cancel}
                </button>
                <button 
                  type="submit"
                  disabled={!resetEmail}
                  className={`bg-gradient-to-r ${currentTheme.btn} text-white font-extrabold px-5 py-2.5 rounded-xl text-sm transition shadow-md ${!resetEmail ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {t.forgotBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEVELOPER BRAND EDIT MODAL */}
      {isDevModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 w-full max-w-sm p-6 rounded-3xl shadow-2xl flex flex-col gap-5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl bg-gray-100 dark:bg-gray-800 ${currentTheme.icon}`}>
                  <Code2 className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold">{t.devModalTitle}</h3>
              </div>
              <button 
                onClick={() => setIsDevModalOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDevName} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">{t.devNameLabel}</label>
                <input 
                  type="text" 
                  value={inputDevName} 
                  onChange={(e) => setInputDevName(e.target.value)}
                  className={inputStyles}
                  placeholder="Z.D Dev"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button 
                  type="button"
                  onClick={() => setIsDevModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  {t.cancel}
                </button>
                <button 
                  type="submit"
                  className={`bg-gradient-to-r ${currentTheme.btn} text-white font-extrabold px-5 py-2.5 rounded-xl text-sm transition shadow-md`}
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
// src/lib/biometric.js
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

// Fungsi internal untuk mendapatkan bahasa Sistem OS HP
const getOSLanguage = () => {
  // Mengambil bahasa dari perangkat (contoh: 'id-ID', 'en-US', 'ja-JP')
  const sysLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
  
  if (sysLang.startsWith('id')) return 'id';
  if (sysLang.startsWith('ja')) return 'ja';
  if (sysLang.startsWith('zh')) return 'cn';
  if (sysLang.startsWith('ar')) return 'ar';
  
  // Jika OS HP menggunakan bahasa selain di atas (misal Spanyol, Korea, dsb), default ke English
  return 'en'; 
};

// Objek kamus untuk string biometrik Native
const getPromptStrings = (action) => {
  const lang = getOSLanguage();

  const locales = {
    id: {
      regTitle: "Autentikasi Biometrik", regSubtitle: "Gunakan Sidik Jari / Lockscreen", regDesc: "Pindai jari kamu pada sensor", regReason: "Verifikasi Sidik Jari untuk mengaktifkan keamanan WGen Note",
      authTitle: "Masuk WGen Note", authSubtitle: "Verifikasi Sidik Jari", authReason: "Buka kunci aplikasi WGen Note"
    },
    en: {
      regTitle: "Biometric Authentication", regSubtitle: "Use Fingerprint / Lockscreen", regDesc: "Scan your finger on the sensor", regReason: "Verify Fingerprint to secure WGen Note",
      authTitle: "Unlock WGen Note", authSubtitle: "Verify Fingerprint", authReason: "Unlock WGen Note app"
    },
    ja: {
      regTitle: "生体認証", regSubtitle: "指紋 / 画面ロックを使用", regDesc: "センサーに指をスキャンしてください", regReason: "WGen Noteのセキュリティのために指紋を認証します",
      authTitle: "WGen Noteを開く", authSubtitle: "指紋の確認", authReason: "WGen Noteアプリのロックを解除"
    },
    cn: {
      regTitle: "生物识别认证", regSubtitle: "使用指纹 / 屏幕锁", regDesc: "在传感器上扫描您的手指", regReason: "验证指纹以保护 WGen Note",
      authTitle: "进入 WGen Note", authSubtitle: "验证指纹", authReason: "解锁 WGen Note 应用"
    },
    ar: {
      regTitle: "المصادقة البيومترية", regSubtitle: "استخدم البصمة / قفل الشاشة", regDesc: "امسح إصبعك على المستشعر", regReason: "تحقق من البصمة لتأمين WGen Note",
      authTitle: "فتح WGen Note", authSubtitle: "التحقق من البصمة", authReason: "فتح تطبيق WGen Note"
    }
  };

  const selected = locales[lang] || locales['en'];

  if (action === 'register') {
    return {
      title: selected.regTitle,
      subtitle: selected.regSubtitle,
      description: selected.regDesc,
      reason: selected.regReason,
    };
  } else {
    return {
      title: selected.authTitle,
      subtitle: selected.authSubtitle,
      reason: selected.authReason,
    };
  }
};

// 1. Cek dukungan Biometrik (Fingerprint In-Display / PIN Native Android)
export const isBiometricSupported = async () => {
  try {
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch (e) {
    console.warn("Biometric not available:", e);
    return false;
  }
};

// 2. Registrasi / Verifikasi Biometrik saat Switch Toggle di-ON-kan
export const registerAndroidBiometric = async (userId = "wgen_user") => {
  try {
    const available = await isBiometricSupported();
    if (!available) {
      alert("Perangkat ini tidak mendukung atau belum mendaftarkan Sidik Jari/PIN Layar di Pengaturan HP.");
      return false;
    }

    const promptText = getPromptStrings('register');

    // Panggil Native Prompt In-Display Fingerprint Android
    await NativeBiometric.verifyIdentity({
      title: promptText.title,
      subtitle: promptText.subtitle,
      description: promptText.description,
      reason: promptText.reason,
      useFallback: true, // Biarkan fallback ke PIN/Pola HP jika jari gagal
    });

    // Simpan penanda bahwa biometrik native aktif
    localStorage.setItem("wgen_biometric_credential_id", "native_active");
    return true;
  } catch (err) {
    console.error("Biometric Registration Error:", err);
    return false;
  }
};

// 3. Verifikasi saat Unlock / Masuk Aplikasi
export const authenticateAndroidBiometric = async () => {
  try {
    const available = await isBiometricSupported();
    if (!available) return false;

    const promptText = getPromptStrings('auth');

    await NativeBiometric.verifyIdentity({
      title: promptText.title,
      subtitle: promptText.subtitle,
      reason: promptText.reason,
      useFallback: true
    });
    return true;
  } catch (err) {
    console.error("Biometric Auth Error:", err);
    return false;
  }
};
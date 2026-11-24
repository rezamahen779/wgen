import React, { useState, useEffect, useMemo } from 'react';
import { Download, ShieldCheck, RefreshCw, CheckCircle2 } from 'lucide-react';
import logoWGen from './assets/logo-w.png';

const GITHUB_API_URL = 'https://api.github.com/repos/zd-devp-w/wgen/releases/latest';
const FALLBACK_DOWNLOAD_URL = 'https://github.com/zd-devp-w/wgen/releases/latest/download/WGen.Note.apk';

const TRANSLATIONS = {
  id: {
    badge: 'Rilis Resmi Android',
    desc: 'Jurnal keuangan modern dengan akses offline, keamanan biometrik sidik jari, dan pencatatan cepat.',
    versionLabel: 'Versi',
    sizeLabel: 'Ukuran File',
    downloadBtn: 'Download APK (Android)',
    feat1: 'Akses Offline & Auto-Sync: Catat tanpa sinyal, otomatis sinkron saat online',
    feat2: 'Kunci aplikasi aman dengan Fingerprint / Biometrik',
    feat3: 'Bebas iklan & ringan di perangkat Android',
  },
  jp: {
    badge: 'Android 公式リリース',
    desc: 'オフライン記録、指紋認証セキュリティ、スピーディーな家計管理を備えたモダンな財務ジャーナル。',
    versionLabel: 'バージョン',
    sizeLabel: 'ファイルサイズ',
    downloadBtn: 'APKをダウンロード (Android)',
    feat1: 'オフライン対応＆自動同期：圏外でも記録でき、オンライン時に自動バックアップ',
    feat2: '指紋・生体認証による安全なアプリロック',
    feat3: '広告なし＆Android端末で軽快に動作',
  },
  en: {
    badge: 'Official Android Release',
    desc: 'Modern finance journal featuring offline access, fingerprint biometric security, and fast expense tracking.',
    versionLabel: 'Version',
    sizeLabel: 'File Size',
    downloadBtn: 'Download APK (Android)',
    feat1: 'Offline Access & Auto-Sync: Track expenses offline, syncs automatically online',
    feat2: 'Secure app lock with Fingerprint / Biometrics',
    feat3: 'Ad-free & lightweight on Android devices',
  },
  ar: {
    badge: 'إصدار أندرويد الرسمي',
    desc: 'مجلة مالية حديثة توفر العمل بدون إنترنت، وأمان البصمة الحيوية، وتسجيل المعاملات بسرعة.',
    versionLabel: 'الإصدار',
    sizeLabel: 'حجم الملف',
    downloadBtn: 'تحميل APK (أندرويد)',
    feat1: 'عمل بدون إنترنت ومزامنة تلقائية: سجل مصاريفك في أي وقت وتُحفظ تلقائياً عند الاتصال',
    feat2: 'قفل آمن للتطبيق ببصمة الإصبع / القياسات الحيوية',
    feat3: 'بدون إعلانات وخفيف على أجهزة أندرويد',
  },
  cn: {
    badge: 'Android 官方发布',
    desc: '支持离线记账、指纹生物识别安全以及快速账单管理的现代财务日志应用。',
    versionLabel: '版本',
    sizeLabel: '文件大小',
    downloadBtn: '下载 APK (Android)',
    feat1: '离线记账与自动同步：无网络也能随时记账，联网后自动同步云端',
    feat2: '支持指纹 / 生物识别安全应用锁',
    feat3: '无广告，在 Android 设备上流畅运行',
  },
};

function detectSystemLanguage() {
  const sysLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
  if (sysLang.startsWith('id') || sysLang.startsWith('ms')) return 'id';
  if (sysLang.startsWith('ja')) return 'jp';
  if (sysLang.startsWith('ar')) return 'ar';
  if (sysLang.startsWith('zh')) return 'cn';
  return 'en';
}

export default function ApkPortalPage() {
  const lang = useMemo(() => detectSystemLanguage(), []);
  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
  const isRTL = lang === 'ar';

  // State dinamis dengan nilai default (fallback)
  const [releaseInfo, setReleaseInfo] = useState({
    version: 'v1.0.0',
    size: '23 MB',
    downloadUrl: FALLBACK_DOWNLOAD_URL,
  });

  useEffect(() => {
    async function fetchLatestRelease() {
      try {
        const response = await fetch(GITHUB_API_URL);
        if (!response.ok) return;

        const data = await response.json();
        // Cari file yang berakhiran .apk di dalam daftar assets release
        const apkAsset = data.assets?.find((asset) => asset.name.endsWith('.apk'));

        if (apkAsset) {
          // Konversi ukuran dari Bytes ke Megabytes (MB)
          const sizeInMB = (apkAsset.size / (1000 * 1000)).toFixed(1) + ' MB';

          setReleaseInfo({
            version: data.tag_name || 'v1.0.0',
            size: sizeInMB,
            downloadUrl: apkAsset.browser_download_url || FALLBACK_DOWNLOAD_URL,
          });
        }
      } catch (error) {
        console.error('Gagal mengambil data rilis GitHub:', error);
      }
    }

    fetchLatestRelease();
  }, []);

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 font-sans"
    >
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-2xl text-center flex flex-col items-center gap-6">
        
        <img
          src={logoWGen}
          alt="WGen Note"
          className="w-24 h-24 object-contain rounded-2xl shadow-lg"
        />

        <div>
          <span className="text-[10px] uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">
            {t.badge}
          </span>
          <h1 className="text-2xl font-black mt-3">WGen Note</h1>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
            {t.desc}
          </p>
        </div>

        {/* Info Versi & Ukuran Otomatis */}
        <div className="w-full bg-gray-950/60 border border-gray-800 rounded-2xl p-4 flex justify-around text-xs">
          <div>
            <p className="text-gray-500">{t.versionLabel}</p>
            <p className="font-bold text-gray-200 mt-0.5">{releaseInfo.version}</p>
          </div>
          <div className="border-l border-gray-800" />
          <div>
            <p className="text-gray-500">{t.sizeLabel}</p>
            <p className="font-bold text-gray-200 mt-0.5">{releaseInfo.size}</p>
          </div>
        </div>

        {/* Tombol Download Langsung */}
        <a
          href={releaseInfo.downloadUrl}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2.5 transition-all"
        >
          <Download className="w-5 h-5" />
          <span>{t.downloadBtn}</span>
        </a>

        {/* Fitur Keunggulan */}
        <div className={`w-full ${isRTL ? 'text-right' : 'text-left'} space-y-2.5 pt-2 border-t border-gray-800/80 text-xs text-gray-400`}>
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{t.feat1}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{t.feat2}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{t.feat3}</span>
          </div>
        </div>
      </div>

      <p dir="ltr" className="text-[10px] text-gray-600 mt-6">© 2026 WGen Note — Z.D WGen Dev</p>
    </div>
  );
}
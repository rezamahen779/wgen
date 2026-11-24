import React from 'react';
import { Download, ShieldCheck, Smartphone, CheckCircle2 } from 'lucide-react';
import logoWGen from './assets/logo-wgen.png';

// Link otomatis mengarah ke rilis terbaru di GitHub kamu
const APK_DOWNLOAD_URL = 'https://github.com/zd-devp-w/wgen/releases/latest/download/WGen.Note.apk';
const APP_VERSION = 'v1.0.0';
const APP_SIZE = '23 MB';

export default function ApkPortalPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-2xl text-center flex flex-col items-center gap-6">
        
        <img
          src={logoWGen}
          alt="WGen Note"
          className="w-24 h-24 object-contain rounded-2xl shadow-lg"
        />

        <div>
          <span className="text-[10px] uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">
            Official Android Release
          </span>
          <h1 className="text-2xl font-black mt-3">WGen Note</h1>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
            Jurnal keuangan modern dengan dukungan mode offline penuh, keamanan biometrik sidik jari, dan pencatatan cepat.
          </p>
        </div>

        {/* Info Versi & Ukuran */}
        <div className="w-full bg-gray-950/60 border border-gray-800 rounded-2xl p-4 flex justify-around text-xs">
          <div>
            <p className="text-gray-500">Versi</p>
            <p className="font-bold text-gray-200 mt-0.5">{APP_VERSION}</p>
          </div>
          <div className="border-l border-gray-800" />
          <div>
            <p className="text-gray-500">Ukuran File</p>
            <p className="font-bold text-gray-200 mt-0.5">{APP_SIZE}</p>
          </div>
        </div>

        {/* Tombol Download Langsung */}
        <a
          href={APK_DOWNLOAD_URL}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2.5 transition-all"
        >
          <Download className="w-5 h-5" />
          <span>Download APK (Android)</span>
        </a>

        {/* Fitur Keunggulan */}
        <div className="w-full text-left space-y-2.5 pt-2 border-t border-gray-800/80 text-xs text-gray-400">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>100% Berjalan Offline tanpa koneksi internet</span>
          </div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Kunci aplikasi dengan Fingerprint / Biometrik</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Bebas iklan & ringan di perangkat Android</span>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-600 mt-6">© 2026 WGen Note — Z.D WGen Dev</p>
    </div>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Search, Trash2, Edit2, Download,
  CheckSquare, Square, User, Landmark, Calendar, AlertCircle, CreditCard, Wallet, Banknote, Shuffle, Coins, Phone, Clock, History, Gift, ChevronDown, ChevronUp, IdCard, UserCheck, AlertTriangle, Bell, Copy, Check, MapPin
} from 'lucide-react';

import { turso } from './lib/turso';
import { auth } from './lib/firebase';
import { convertCurrencyDynamic, fetchLiveExchangeRates, getCurrencySymbolDynamic } from './lib/currencyService';

import QrLoanHub from './QrLoanHub';
import DebtFormModal from './DebtFormModal';
import { buildAdjustedContractHtml } from './utils/contractParser';

export default function DebtManager({ language = 'id', themeProp, isDarkModeProp }) {
  // 1. Sinkronisasi Otomatis Tema Warna & Display Mode (Dark/Light) dari Sistem
  const [activeTheme, setActiveTheme] = useState(() => {
    return themeProp || localStorage.getItem('wgen_theme') || 'amber';
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof isDarkModeProp === 'boolean') return isDarkModeProp;
    const savedMode = localStorage.getItem('wgen_display_mode');
    if (savedMode) return savedMode === 'dark';
    return document.documentElement.classList.contains('dark');
  });

  const [liveRates, setLiveRates] = useState(null);
  const [minimizedCards, setMinimizedCards] = useState({});
  const [copiedDebtId, setCopiedDebtId] = useState(null);

  const toggleMinimize = (id) => {
    setMinimizedCards(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  useEffect(() => {
    const handleStorageChange = () => {
      const savedTheme = localStorage.getItem('wgen_theme');
      if (savedTheme) setActiveTheme(savedTheme);
      const savedMode = localStorage.getItem('wgen_display_mode');
      if (savedMode) setIsDarkMode(savedMode === 'dark');
    };

    window.addEventListener('storage', handleStorageChange);
    const observer = new MutationObserver(() => {
      if (typeof isDarkModeProp !== 'boolean' && !localStorage.getItem('wgen_display_mode')) {
        setIsDarkMode(document.documentElement.classList.contains('dark'));
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      observer.disconnect();
    };
  }, [isDarkModeProp]);

  const [managerCurrency, setManagerCurrency] = useState(() => {
    return localStorage.getItem('wgen_debt_manager_currency') || 'JPY';
  });

  useEffect(() => {
    localStorage.setItem('wgen_debt_manager_currency', managerCurrency);
  }, [managerCurrency]);

  const formatNumberWithSeparator = (value) => {
    if (value === undefined || value === null || value === '') return '';
    const cleanValue = String(value).replace(/\D/g, '');
    return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const getThemeClasses = (themeName) => {
    const tName = String(themeName).toLowerCase();

    if (tName.includes('emerald') || tName.includes('hijau') || tName.includes('green') || tName.includes('cyan')) {
      return {
        textAccent: 'text-emerald-400',
        bgAccent: 'bg-emerald-600 hover:bg-emerald-500',
        borderAccent: 'border-emerald-500/50',
        badgeBg: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
        gradientBtn: 'from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500',
        progressBar: 'bg-emerald-500'
      };
    }

    if (tName.includes('purple') || tName.includes('ungu') || tName.includes('violet')) {
      return {
        textAccent: 'text-purple-400',
        bgAccent: 'bg-purple-600 hover:bg-purple-500',
        borderAccent: 'border-purple-500/50',
        badgeBg: 'bg-purple-950/80 text-purple-300 border-purple-800',
        gradientBtn: 'from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500',
        progressBar: 'bg-purple-500'
      };
    }

    if (tName.includes('blue') || tName.includes('biru') || tName.includes('ocean')) {
      return {
        textAccent: 'text-blue-400',
        bgAccent: 'bg-blue-600 hover:bg-blue-500',
        borderAccent: 'border-blue-500/50',
        badgeBg: 'bg-blue-950/80 text-blue-300 border-blue-800',
        gradientBtn: 'from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500',
        progressBar: 'bg-blue-500'
      };
    }

    if (tName.includes('pink') || tName.includes('peach') || tName.includes('rose')) {
      return {
        textAccent: 'text-pink-400',
        bgAccent: 'bg-pink-600 hover:bg-pink-500',
        borderAccent: 'border-pink-500/50',
        badgeBg: 'bg-pink-950/80 text-pink-300 border-pink-800',
        gradientBtn: 'from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500',
        progressBar: 'bg-pink-500'
      };
    }

    if (tName.includes('tosca') || tName.includes('teal')) {
      return {
        textAccent: 'text-teal-400',
        bgAccent: 'bg-teal-600 hover:bg-teal-500',
        borderAccent: 'border-teal-500/50',
        badgeBg: 'bg-teal-950/80 text-teal-300 border-teal-800',
        gradientBtn: 'from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500',
        progressBar: 'bg-teal-500'
      };
    }

    return {
      textAccent: 'text-amber-500',
      bgAccent: 'bg-amber-600 hover:bg-amber-500',
      borderAccent: 'border-amber-500/50',
      badgeBg: 'bg-amber-950/80 text-amber-400 border-amber-800',
      gradientBtn: 'from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500',
      progressBar: 'bg-amber-500'
    };
  };

  const themeStyle = getThemeClasses(activeTheme);

  // Kamus Bahasa Lengkap (Termasuk Pasal Perjanjian Kondisional & Lampiran 4 Halaman - 7 Slot Foto)
  const translations = {
    id: {
      title: 'WGen Manager Pinjaman',
      subtitle: 'Kelola pinjaman, kategori, jaminan, cicilan, kontak peminjam, dan riwayat pembayaran.',
      manageCat: 'Atur Kategori',
      loanTypes: 'Jenis Pinjaman',
      addDebt: 'Tambah Pinjaman',
      searchPlaceholder: 'Cari nama peminjam, pemberi pinjaman, alamat, atau jenis pinjaman...',
      allCategories: 'Semua Kategori',
      categoryLabel: 'Kategori Peminjam',
      noData: 'Tidak ada data pinjaman ditemukan.',
      noPhotoProof: 'Tidak ada foto lampiran',
      loanAmount: 'Nominal Pinjaman Pokok',
      totalWithBonus: 'Total + Hadiah/Bunga',
      totalPlusLabel: 'Total +',
      bonusPercentage: 'Persentase Hadiah / Bunga (%)',
      bonusText: 'Hadiah',
      interestText: 'Bunga',
      selectRewardType: 'Jenis Tambahan:',
      lastPaidText: 'Terakhir',
      undoLastPay: 'Batalkan',
      undoLastPayTitle: 'Batalkan pembayaran terakhir',
      initialPaidNote: 'Pembayaran Awal',
      termText: 'Termin',
      dueDateShort: 'Jatuh Tempo',
      principalShort: 'Cicilan',
      loanType: 'Jenis Pinjaman',
      status: 'Status Pinjaman',
      collateral: 'Jaminan (Collateral)',
      tenor: 'Tenor / Tempo',
      progress: 'Progress Pelunasan',
      proof: 'Bukti / Foto Lampiran:',
      proofAltText: 'Bukti Lampiran',
      downloadDetail: 'Download Detail (HTML)',
      edit: 'Edit Pinjaman',
      delete: 'Hapus',
      modalTitleAdd: 'Tambah Pinjaman Baru',
      modalTitleEdit: 'Edit Catatan Pinjaman',
      nameLabel: 'Nama Peminjam (Debitur)',
      lenderNameLabel: 'Nama Pemberi Pinjaman (Kreditur)',
      debtorIdLabel: 'No. Identitas Peminjam (Debitur)',
      creditorIdLabel: 'No. Identitas Pemberi Pinjaman (Kreditur)',
      debtorAddressLabel: 'Alamat Lengkap Peminjam (Debitur)',
      debtorAddressPlaceholder: 'Masukkan alamat lengkap domisili / KTP peminjam...',
      borrowerPhone: 'No. HP Peminjam',
      emergencyPhone: 'No. HP Kontak Darurat',
      datePinjam: 'Tanggal Pinjam',
      dateTempo: 'Tanggal Pelunasan (Tenor)',
      hasCollateral: 'Ada Jaminan / Agunan',
      collateralTemplateHintWith: 'Template surat otomatis menggunakan format: "Perjanjian Pinjaman Pribadi dan Jaminan" (Dengan Jaminan).',
      collateralTemplateHintWithout: 'Template surat otomatis menggunakan format: "Perjanjian Pinjaman Pribadi" (Tanpa Jaminan).',
      collateralDesc: 'Keterangan Jaminan',
      noCollateralText: 'Tanpa Jaminan',
      cameraLabel: 'Kamera / Lampirkan Bukti Foto',
      takePhoto: 'Ambil / Pilih Foto',
      cancel: 'Batal',
      save: 'Simpan ke Database',
      catManagerTitle: 'Kelola Kategori Peminjam',
      typeManagerTitle: 'Kelola Jenis Pinjaman',
      newCatPlaceholder: 'Nama kategori baru...',
      newTypePlaceholder: 'Jenis pinjaman baru...',
      close: 'Tutup',
      add: 'Tambah',
      installmentMode: 'Mode Cicilan / Angsuran',
      installmentCount: 'Jumlah Cicilan (Bulan/Term)',
      paidInstallments: 'Cicilan Terbayar',
      installmentAmount: 'Nilai per Cicilan',
      payMethod: 'Metode Pembayaran',
      payAccountLabel: 'No. Rekening / Nomor E-Wallet / Keterangan Akun',
      payAccountPlaceholder: 'Contoh: BCA 1234567890 a.n Budi / Dana 0812xxx...',
      lateFeeModeLabel: 'Skema Denda Keterlambatan',
      lateFeeModeAuto: 'Otomatis Berjenjang (Standar)',
      lateFeeModeManual: 'Persentase Manual (% / 28 Hari)',
      lateFeeTierADesc: 'Tier A (300rb–10,99jt): Hari 1–28 = 5%, Hari 29+ = +2,5%/28hr (Maks 32,5%/thn)',
      lateFeeTierBDesc: 'Tier B (11jt–50jt): +2,71% tiap 28 hari (Maks 32,5%)',
      microLoanToggleLabel: 'Paket Pinjaman Mikro Khusus (Rp100rb – Rp500rb • Tanpa Jaminan)',
      microLoanToggleHint: 'Otomatis tanpa jaminan & Pasal 2 hanya menampilkan 1 skema denda tunggal (sama dengan aturan Tier A).',
      lateFeeLabel: 'Denda Keterlambatan (% / 28 Hari)',
      lateFeeSub: 'Berlaku setelah Grace Period 1 hari',
      penaltyShort: 'Denda',
      lateStatusBadge: 'Terlambat',
      gracePeriodInfo: 'Grace Period 1 Hari',
      lateFeeAmountLabel: 'Denda Keterlambatan',
      daysLateText: 'hari telat',
      totalBillWithLate: 'Total Tagihan Akhir',
      authAssetsTitle: 'Lampiran Tanda Tangan & Cap Sidik Jari (Untuk Dokumen Cetak)',
      creditorFingerprintLabel: 'Cap Sidik Jari Kreditur',
      creditorSignatureLabel: 'Tanda Tangan Kreditur',
      debtorFingerprintLabel: 'Cap Sidik Jari Debitur',
      debtorSignatureLabel: 'Tanda Tangan Debitur',
      uploadImgBtn: 'Pilih Gambar',
      uploadedShort: '✓ Terpasang',
      quickPay: 'Bayar / Cicil',
      paidOff: 'Lunas',
      currLabel: 'Mata Uang',
      receiptTitle: 'Detail Pinjaman',
      transId: 'ID Transaksi',
      borrowerName: 'Peminjam (Debitur)',
      lenderNameText: 'Pemberi Pinjaman (Kreditur)',
      hasNoCollateral: 'TIDAK ADA',
      hasCollateralText: 'ADA',
      sigDebtor: 'Tanda Tangan Peminjam (Debitur)',
      sigCreditor: 'Tanda Tangan Pemberi Pinjaman (Kreditur)',
      fingerprintText: 'CAP / JARI',
      tableNoLabel: 'No',
      legalDisclaimerTitle: 'PEMBERITAHUAN & DISCLAIMER HUKUM:',
      legalDisclaimerText: 'Halaman ini merupakan lampiran rincian transaksi, bukti pendukung, dan riwayat pembayaran yang menjadi satu kesatuan tidak terpisahkan dari Perjanjian Pinjaman Pribadi pada Halaman 1. Dokumen ini dicetak melalui aplikasi WGen Note yang berfungsi murni sebagai alat pencatat administrasi pribadi (bukan lembaga keuangan maupun layanan P2P Lending), sehingga seluruh isi kesepakatan sepenuhnya menjadi tanggung jawab kedua belah pihak sesuai ketentuan hukum perdata yang berlaku.',
      footerText: 'Dicetak otomatis dari WGen Note - Debt Manager System © 2026',
      until: 's/d',
      flexible: 'Fleksibel',
      photoAttached: '✓ Foto Terlampir',
      confirmDelete: 'Yakin ingin menghapus catatan pinjaman ini?',
      fillRequired: 'Nama Peminjam dan Nominal wajib diisi!',
      payModalTitle: 'Pencatatan Pembayaran / Angsuran',
      payAmountLabel: 'Nominal Pembayaran',
      payMethodTxLabel: 'Metode Pembayaran Transaksi',
      payDateLabel: 'Tanggal Pembayaran',
      payTimeLabel: 'Jam Pembayaran',
      payOneTerm: '+1 Termin Otomatis',
      submitPay: 'Simpan Pembayaran',
      totalPaidSoFar: 'Total Terbayar',
      remaining: 'Sisa Pinjaman',
      paymentHistoryTitle: 'Riwayat Pembayaran & Stempel Waktu',
      noHistoryYet: 'Belum ada riwayat pembayaran tercatat.',
      dateAndTime: 'Tanggal & Jam',
      amountPaid: 'Jumlah Dibayar',
      minimize: 'Kecilkan',
      expand: 'Buka Detail',
      showingLimitInfo: 'Menampilkan maksimal 5 data terbaru. Gunakan pencarian/filter untuk melihat data lainnya.',
      reminderBadgePrefix: 'Pengingat Jatuh Tempo',
      reminderDaysLeft: 'hari lagi',
      reminderToday: 'Hari Ini Jatuh Tempo!',
      copyReminderBtn: 'Salin Pesan',
      copiedReminderBtn: 'Tersalin!',
      reminderMsgIntro: 'Halo',
      reminderMsgUpcoming: 'sekadar mengingatkan bahwa tagihan pinjaman Anda akan jatuh tempo dalam',
      reminderMsgToday: 'sekadar mengingatkan bahwa tagihan pinjaman Anda jatuh tempo HARI INI',
      reminderMsgOverdue: 'menginformasikan bahwa tagihan pinjaman Anda telah melewati jatuh tempo selama',
      reminderMsgDueDate: 'Tanggal Jatuh Tempo',
      reminderMsgRemaining: 'Sisa Tagihan',
      reminderMsgMethod: 'Metode Pembayaran',
      reminderMsgAccount: 'Tujuan Pembayaran',
      reminderMsgClosing: 'Terima kasih atas kerja samanya.',
      statusOptions: { active: 'Aktif', dueSoon: 'Mendekati Jatuh Tempo', paid: 'Lunas' },
      methods: { transfer: 'Bank Transfer', ewallet: 'Digital Wallet', cash: 'Cash (Tunai)', flexible: 'Fleksibel' },
      contract: {
        docTitleWithCollateral: 'PERJANJIAN PINJAMAN PRIBADI DAN JAMINAN',
        docTitleNoCollateral: 'PERJANJIAN PINJAMAN PRIBADI',
        introPrefix: 'Pada hari',
        introDateWord: 'tanggal',
        introTxLabel: 'ID Transaksi',
        introSuffix: 'disepakati perjanjian pinjaman pribadi antara:',
        party1Title: 'PIHAK PERTAMA (PEMBERI PINJAMAN / KREDITUR)',
        party2Title: 'PIHAK KEDUA (PEMINJAM / DEBITUR)',
        fieldName: 'Nama Lengkap',
        fieldId: 'NIK / No. Identitas',
        fieldAddress: 'Alamat Lengkap',
        fieldPhone: 'No. HP / Darurat',
        pasal1Title: 'PASAL 1 - POKOK PINJAMAN & IMBALAN JASA',
        p1_1: 'Jumlah pinjaman pokok:',
        p1_2: 'Tanggal pencairan dana:',
        p1_3: 'Tanggal jatuh tempo pelunasan akhir:',
        p1_4: 'Jangka waktu / tenor pinjaman:',
        p1_4_installment: 'bulan / termin angsuran sejak tanggal pencairan.',
        p1_4_single: '1 (satu) periode kalender sejak tanggal pencairan sampai dengan tanggal jatuh tempo.',
        p1_5: 'Toleransi pembayaran (Grace Period): 1 (satu) hari kalender setelah tanggal jatuh tempo.',
        p1_6: 'Denda keterlambatan mulai berlaku pada hari berikutnya (H+2) setelah masa toleransi berakhir.',
        p1_7: 'Imbalan jasa / hadiah pinjaman yang disepakati:',
        p1_8: 'Imbalan jasa (hadiah) yang telah disepakati merupakan kewajiban Pihak Kedua untuk dibayarkan kepada Pihak Pertama sesuai nominal atau persentase dan jadwal yang telah disetujui bersama.',
        pasal2Title: 'PASAL 2 - DENDA KETERLAMBATAN',
        p2_intro: 'Denda dihitung berdasarkan pokok pinjaman awal, bukan berdasarkan sisa angsuran, dan tidak menggunakan sistem bunga majemuk.',
        p2_tierA_title: 'A. Pinjaman Rp300.000 – Rp10.999.999 (Tier A)',
        p2_tierA_1: 'Keterlambatan hari ke-1 s.d. ke-28 (setelah grace period): denda tetap sebesar 5% dari pokok pinjaman.',
        p2_tierA_2: 'Mulai hari ke-29: tambahan denda sebesar 2,5% untuk setiap periode 28 hari berikutnya.',
        p2_tierA_3: 'Akumulasi denda maksimal adalah 32,5% dari pokok pinjaman.',
        p2_tierB_title: 'B. Pinjaman Rp11.000.000 – Rp50.000.000 (Tier B)',
        p2_tierB_1: 'Denda dihitung sebesar 2,71% dari pokok pinjaman untuk setiap periode 28 hari keterlambatan.',
        p2_tierB_2: 'Perhitungan mengacu pada 32,5% dibagi maksimal 12 periode.',
        p2_tierB_3: 'Akumulasi denda maksimal adalah 32,5% dari pokok pinjaman.',
        p2_micro_title: 'Ketentuan Denda Pinjaman Mikro (Rp100.000 – Rp500.000)',
        p2_micro_1: 'Keterlambatan hari ke-1 s.d. ke-28 (setelah grace period): denda tetap sebesar 5% dari pokok pinjaman.',
        p2_micro_2: 'Mulai hari ke-29: tambahan denda sebesar 2,5% untuk setiap periode 28 hari berikutnya.',
        p2_micro_3: 'Akumulasi denda maksimal adalah 32,5% dari pokok pinjaman.',
        p2_schemeNote: 'Skema denda aktif pada perjanjian ini:',
        p2_schemeAuto: 'Otomatis Berjenjang (Standar Kontrak)',
        p2_schemeManual: 'Persentase Manual',
        p2_schemeMicro: 'Skema Khusus Pinjaman Mikro (Rp100rb – Rp500rb)',
        pasal3TitleWith: 'PASAL 3 - JAMINAN / AGUNAN',
        p3_with_1: 'Pinjaman ini disertai jaminan/agunan yang nilai wajar dan jenisnya telah disepakati bersama oleh kedua belah pihak.',
        p3_with_2: 'Rincian jaminan yang diserahkan:',
        p3_with_3: 'Pihak Kedua menjamin sepenuhnya bahwa barang/aset jaminan tersebut merupakan milik sahnya atau telah memperoleh persetujuan tertulis dari pemilik sah serta tidak sedang dalam sengketa.',
        p3_with_4: 'Foto dan dokumentasi fisik jaminan terlampir pada Halaman 2 dan Halaman 4 sebagai bagian tidak terpisahkan dari perjanjian ini.',
        pasal3TitleWithout: 'PASAL 3 - STATUS PINJAMAN TANPA JAMINAN',
        p3_without_1: 'Pinjaman ini diberikan atas dasar kepercayaan pribadi antara Pihak Pertama dan Pihak Kedua tanpa penyerahan barang jaminan atau agunan fisik (Unsecured Personal Loan).',
        p3_without_2: 'Pihak Kedua bertanggung jawab penuh secara pribadi atas pelunasan seluruh pokok pinjaman, imbalan jasa yang disepakati, serta denda keterlambatan (apabila ada) tepat pada waktunya.',
        p3_without_3: 'Seluruh harta kekayaan Pihak Kedua menjadi tanggungan pemenuhan perikatan sesuai ketentuan hukum perdata yang berlaku.',
        pasal4TitleWith: 'PASAL 4 - WANPRESTASI & PENYELESAIAN JAMINAN',
        p4_with_1: 'Apabila Pihak Kedua terlambat melakukan pembayaran melewati masa toleransi, Pihak Pertama berhak menyampaikan peringatan penagihan secara lisan maupun tertulis.',
        p4_with_2: 'Pihak Kedua tetap berkewajiban menyelesaikan seluruh kewajiban pembayaran yang telah jatuh tempo, termasuk sisa pokok pinjaman, imbalan jasa yang disepakati, serta denda keterlambatan sesuai ketentuan Pasal 2.',
        p4_with_3: 'Khusus pinjaman dengan tenor 1 (satu) bulan, apabila Pihak Kedua tidak melakukan pelunasan setelah melewati tanggal jatuh tempo dan masa toleransi, kewajiban pembayaran tetap berlaku dan penyelesaian dapat dilakukan melalui musyawarah atau mekanisme hukum yang berlaku.',
        p4_with_4: 'Apabila tunggakan berlangsung selama 2 (dua) bulan berturut-turut, para pihak sepakat mengupayakan penyelesaian melalui musyawarah dan penjualan barang jaminan sesuai mekanisme hukum yang berlaku.',
        p4_with_5: 'Hasil penjualan barang jaminan digunakan untuk melunasi sisa pokok pinjaman, imbalan jasa yang disepakati, denda keterlambatan yang sah, serta biaya penjualan yang wajar.',
        p4_with_6: 'Apabila terdapat kelebihan hasil penjualan setelah seluruh kewajiban dilunasi, selisihnya wajib dikembalikan kepada Pihak Kedua. Sebaliknya, apabila hasil penjualan belum mencukupi, sisa kewajiban tetap menjadi tanggung jawab Pihak Kedua.',
        p4_with_7: 'Barang jaminan tidak otomatis menjadi hak milik Pihak Pertama tanpa kesepakatan pelepasan hak atau proses eksekusi yang sah sesuai peraturan perundang-undangan.',
        pasal4TitleWithout: 'PASAL 4 - WANPRESTASI & PENYELESAIAN KEWAJIBAN',
        p4_without_1: 'Apabila Pihak Kedua terlambat melakukan pembayaran melewati masa toleransi, Pihak Pertama berhak menyampaikan peringatan penagihan secara lisan maupun tertulis.',
        p4_without_2: 'Pihak Kedua wajib menyelesaikan seluruh kewajiban pembayaran yang telah jatuh tempo, termasuk sisa pokok pinjaman dan denda keterlambatan yang timbul sesuai ketentuan Pasal 2.',
        p4_without_3: 'Khusus pinjaman dengan tenor 1 (satu) bulan, apabila Pihak Kedua tidak melakukan pelunasan setelah melewati tanggal jatuh tempo dan masa toleransi, Pihak Kedua tetap berkewajiban melunasi seluruh sisa pokok pinjaman beserta denda keterlambatan sesuai ketentuan perjanjian ini.',
        p4_without_4: 'Apabila tunggakan berlangsung selama 2 (dua) bulan berturut-turut, para pihak wajib bermusyawarah untuk menyusun jadwal pelunasan tertulis (restrukturisasi) atau penyelesaian kewajiban secara kekeluargaan.',
        p4_without_5: 'Apabila musyawarah tidak mencapai kesepakatan, Pihak Pertama berhak menempuh upaya penyelesaian hukum secara perdata sesuai peraturan perundang-undangan yang berlaku, dengan menggunakan dokumen perjanjian dan lampiran bukti ini sebagai alat bukti.',
        pasal5Title: 'PASAL 5 - PENUTUP & PERSETUJUAN',
        p5_1: 'Kedua belah pihak menyatakan telah membaca, memahami, dan menyetujui seluruh isi perjanjian ini dalam keadaan sadar dan tanpa paksaan dari pihak mana pun.',
        p5_2: 'Perjanjian ini sah ditandatangani secara elektronik maupun dicetak fisik dengan tanda tangan basah, cap sidik jari, dan Bea Meterai sesuai ketentuan hukum yang berlaku.',
        p5_3: 'Seluruh lampiran rincian transaksi, riwayat pembayaran, simulasi tenor, dan dokumentasi foto merupakan satu kesatuan yang tidak terpisahkan dari perjanjian ini.',
        placeDateLabel: 'Tempat / Tanggal Kesepakatan:',
        signParty1: 'PIHAK PERTAMA\n(Pemberi Pinjaman)',
        signParty2: 'PIHAK KEDUA\n(Peminjam)',
        page3Header: 'LAMPIRAN SIMULASI TENOR 1 – 12 BULAN & ACUAN DENDA',
        page3PrincipalBadge: 'POKOK',
        page3StampTitle: 'STAMP HISTORI AKTUAL & STATUS KETERLAMBATAN TRANSAKSI',
        page3PenaltyRefTitle: 'ACUAN DENDA KONTRAK (PASAL 2) — GRACE PERIOD 1 HARI',
        page3NoHistoryNote: 'Belum ada histori stamp pembayaran tercatat. Denda dihitung dari Pokok Awal tanpa bunga majemuk mulai hari ke-2 setelah jatuh tempo.',
        page3NoteTitle: 'CATATAN PERHITUNGAN TENOR & DENDA:',
        page3NoteBody: 'Simulasi di atas dihitung menggunakan persentase imbalan/bonus aktual kontrak dari pokok awal. Simulasi denda mengacu langsung pada Pasal 2 kontrak (berlaku setelah 1 hari toleransi/grace period).',
        tenorLabel: 'TENOR',
        monthShort: 'BLN',
        activeTag: 'AKTIF',
        tenorPrincipal: 'Pokok Pinjaman',
        tenorTotal: 'Total Pelunasan',
        tenorInstallment: 'Cicilan / Bulan',
        tenorPenaltyHint: 'Denda Telat (H+2 s.d. H+28):',
        tenorMaxHint: 'Maks Kontrak:',
        tenorNoPenaltyHint: 'Skema Denda: Bebas denda otomatis (Pokok di bawah batas minimal / Manual 0%)',
        page4Header: 'LAMPIRAN DOKUMENTASI VERIFIKASI DEBITUR & BUKTI PENDUKUNG',
        page4SubBadge: 'FORMAT CETAK 4x6 & 2R (7 SLOT)',
        page4Sec1Title: 'I. DOKUMENTASI VERIFIKASI IDENTITAS DEBITUR (PAS FOTO 4x6)',
        page4Sec2Title: 'II. DOKUMENTASI JAMINAN / AGUNAN (UKURAN FOTO 2R)',
        page4Sec3Title: 'III. DOKUMENTASI PENDUKUNG TAMBAHAN / ETC (UKURAN FOTO 2R)',
        photoSlotIdDebtor: 'Foto KTP / Identitas Debitur (4x6)',
        photoSlotSelfieDebtor: 'Foto Wajah / Selfie Debitur (4x6)',
        photoSlotSelfieIdDebtor: 'Foto Selfie + KTP Debitur (4x6)',
        photoSlotCollateral1: 'Foto Jaminan / Agunan 1 (2R)',
        photoSlotCollateral2: 'Foto Jaminan / Agunan 2 (2R)',
        photoSlotHandover1: 'Foto Bukti Penyerahan / Transaksi 1 (2R)',
        photoSlotHandover2: 'Foto Bukti Penyerahan / Kwitansi 2 (2R)',
        photoSlotEtc1: 'Bukti Pendukung / Etc 1 (2R)',
        photoSlotEtc2: 'Bukti Pendukung / Etc 2 (2R)',
        photoEmptyHint: 'Tempel / Lampirkan Foto Fisik'
      }
    },
    jp: {
      title: 'WGen 貸付管理',
      subtitle: '借入、カテゴリ、担保、分割払い、連絡先および返済履歴を管理します。',
      manageCat: 'カテゴリ管理',
      loanTypes: '借入種類',
      addDebt: '借入を追加',
      searchPlaceholder: '借入人名、貸付人名、住所または種類で検索...',
      allCategories: 'すべてのカテゴリ',
      categoryLabel: '借入人カテゴリ',
      noData: '借入データが見つかりません。',
      noPhotoProof: '添付写真なし',
      loanAmount: '元金借入額',
      totalWithBonus: '合計 (謝礼/利息込)',
      totalPlusLabel: '合計 +',
      bonusPercentage: '謝礼・利息割合 (%)',
      bonusText: '謝礼',
      interestText: '利息',
      selectRewardType: '追加種別:',
      lastPaidText: '最終返済',
      undoLastPay: '取消',
      undoLastPayTitle: '直前の返済を取り消す',
      initialPaidNote: '初回返済',
      termText: '回分',
      dueDateShort: '期日',
      principalShort: '元金分',
      loanType: '借入種類',
      status: 'ステータス',
      collateral: '担保 (Collateral)',
      tenor: '期間 / 期限',
      progress: '返済進捗',
      proof: '証明・添付写真:',
      proofAltText: '添付証明写真',
      downloadDetail: '詳細ダウンロード (HTML)',
      edit: '編集',
      delete: '削除',
      modalTitleAdd: '新規借入追加',
      modalTitleEdit: '借入記録編集',
      nameLabel: '借入人名 (債務者)',
      lenderNameLabel: '貸付人名 (債権者)',
      debtorIdLabel: '債務者身分証明番号 (KTP/ID)',
      creditorIdLabel: '債権者身分証明番号 (KTP/ID)',
      debtorAddressLabel: '債務者住所',
      debtorAddressPlaceholder: '借入人の現住所を入力してください...',
      borrowerPhone: '借入人本人の電話番号',
      emergencyPhone: '緊急連絡先電話番号',
      datePinjam: '借入日',
      dateTempo: '返済期日',
      hasCollateral: '担保あり',
      collateralTemplateHintWith: '契約書テンプレートは自動的に「個人間金銭消費貸借および担保契約書（担保あり）」を使用します。',
      collateralTemplateHintWithout: '契約書テンプレートは自動的に「個人間金銭消費貸借契約書（無担保）」を使用します。',
      collateralDesc: '担保説明',
      noCollateralText: '担保なし',
      cameraLabel: 'カメラ / 写真添付',
      takePhoto: '写真を選択',
      cancel: 'キャンセル',
      save: 'データベースに保存',
      catManagerTitle: 'カテゴリ管理',
      typeManagerTitle: '借入種類管理',
      newCatPlaceholder: '新しいカテゴリ名...',
      newTypePlaceholder: '新しい借入種類...',
      close: '閉じる',
      add: '追加',
      installmentMode: '分割払いモード',
      installmentCount: '分割回数 (月)',
      paidInstallments: '支払済回数',
      installmentAmount: '1回あたりの金額',
      payMethod: '支払方法',
      payAccountLabel: '口座番号 / 電子マネーID / 支払先詳細',
      payAccountPlaceholder: '例: 三菱UFJ 1234567 / PayPay ID...',
      lateFeeModeLabel: '延滞損害金計算方式',
      lateFeeModeAuto: '自動段階制 (標準ルール)',
      lateFeeModeManual: '手動パーセント指定 (28日毎の%)',
      lateFeeTierADesc: '区分A (30万〜1,099万): 1〜28日=5%、29日以降=+2.5%/28日 (年上限32.5%)',
      lateFeeTierBDesc: '区分B (1,100万〜5,000万): 28日毎に+2.71% (上限32.5%)',
      microLoanToggleLabel: '少額マイクロローン特別枠 (10万〜50万相当 • 無担保)',
      microLoanToggleHint: '自動的に無担保となり、第2条は単一の延滞基準のみを表示します。',
      lateFeeLabel: '延滞損害金率 (28日毎の%)',
      lateFeeSub: '期日から1日の猶予期間後に適用',
      penaltyShort: '延滞金',
      lateStatusBadge: '延滞中',
      gracePeriodInfo: '猶予期間1日',
      lateFeeAmountLabel: '延滞損害金',
      daysLateText: '日延滞',
      totalBillWithLate: '最終請求合計',
      authAssetsTitle: '署名・指紋画像の登録 (印刷用書類に自動反映)',
      creditorFingerprintLabel: '債権者 指紋画像',
      creditorSignatureLabel: '債権者 署名画像',
      debtorFingerprintLabel: '債務者 指紋画像',
      debtorSignatureLabel: '債務者 署名画像',
      uploadImgBtn: '画像を選択',
      uploadedShort: '✓ 登録済',
      quickPay: '返済実行',
      paidOff: '完済',
      currLabel: '通貨',
      receiptTitle: '借入詳細',
      transId: '取引ID',
      borrowerName: '借入人 (債務者)',
      lenderNameText: '貸付人 (債権者)',
      hasNoCollateral: 'なし',
      hasCollateralText: 'あり',
      sigDebtor: '債務者署名',
      sigCreditor: '債権者署名',
      fingerprintText: '指紋',
      tableNoLabel: '番号',
      legalDisclaimerTitle: '添付書類に関する注記および法的免責事項：',
      legalDisclaimerText: '本ページは、取引明細、証拠資料、および返済履歴を記載した添付書類であり、第1ページの「個人間金銭消費貸借契約書」と不可分一体の構成要素を成すものです。本書は個人の管理記録ツール「WGen Note」を通じて出力されたものであり、すべての合意内容および法的責任は適用される民法の規定に基づき当事者双方が負うものとします。',
      footerText: 'WGen Note 貸付管理システムより自動印刷 © 2026',
      until: '〜',
      flexible: '柔軟・未定',
      photoAttached: '✓ 写真添付済み',
      confirmDelete: 'この借入記録を削除してもよろしいですか？',
      fillRequired: '名前と金額は必須項目です！',
      payModalTitle: '返済・分割支払いの登録',
      payAmountLabel: '返済金額',
      payMethodTxLabel: '今回の支払方法',
      payDateLabel: '返済日',
      payTimeLabel: '返済時刻',
      payOneTerm: '+1回分を自動返済',
      submitPay: '返済を登録',
      totalPaidSoFar: '返済済み合計',
      remaining: '残高',
      paymentHistoryTitle: '返済履歴・タイムスタンプ',
      noHistoryYet: 'まだ返済履歴が登録されていません。',
      dateAndTime: '日時',
      amountPaid: '返済額',
      minimize: '折りたたむ',
      expand: '詳細表示',
      showingLimitInfo: '最新5件まで表示中。他のデータは検索またはフィルターで確認できます。',
      reminderBadgePrefix: '期日リマインダー',
      reminderDaysLeft: '日後',
      reminderToday: '本日が返済期日です！',
      copyReminderBtn: '通知文をコピー',
      copiedReminderBtn: 'コピー完了！',
      reminderMsgIntro: 'お世話になっております、',
      reminderMsgUpcoming: '様。お借入れの返済期日まであと',
      reminderMsgToday: '様。本日がお借入れの返済期日となっております',
      reminderMsgOverdue: '様。お借入れの返済期日を過ぎております（延滞：',
      reminderMsgDueDate: '返済期日',
      reminderMsgRemaining: '残高合計',
      reminderMsgMethod: 'お支払方法',
      reminderMsgAccount: 'お振込先・送金先',
      reminderMsgClosing: 'ご確認のほどよろしくお願いいたします。',
      statusOptions: { active: '進行中', dueSoon: '期日近し', paid: '完済' },
      methods: { transfer: '銀行振込', ewallet: '電子マネー', cash: '現金', flexible: 'その他' },
      contract: {
        docTitleWithCollateral: '個人間金銭消費貸借および担保契約書',
        docTitleNoCollateral: '個人間金銭消費貸借契約書',
        introPrefix: '契約締結曜日：',
        introDateWord: '契約日：',
        introTxLabel: '取引ID',
        introSuffix: '以下の当事者間において、本個人間金銭消費貸借契約を締結する。',
        party1Title: '甲（貸付人・債権者）',
        party2Title: '乙（借入人・債務者）',
        fieldName: '氏名',
        fieldId: '身分証明書番号',
        fieldAddress: '現住所',
        fieldPhone: '電話番号 / 緊急連絡先',
        pasal1Title: '第1条（貸付元本および謝礼・利息）',
        p1_1: '貸付元本金額：',
        p1_2: '資金交付日（借入日）：',
        p1_3: '最終返済期日：',
        p1_4: '返済期間・回数：',
        p1_4_installment: 'ヶ月（分割払い回数）',
        p1_4_single: '資金交付日から最終返済期日までの1期間一括払い。',
        p1_5: '支払猶予期間（グレースピリオド）：返済期日の翌日から1暦日間。',
        p1_6: '延滞損害金は、支払猶予期間終了後の翌日（期日後2日目）より発生する。',
        p1_7: '合意された謝礼・利息割合：',
        p1_8: '当事者間で合意された謝礼・利息は、定められた金額・割合および期日に従い、乙が甲に対して支払う義務を負う。',
        pasal2Title: '第2条（延滞損害金）',
        p2_intro: '延滞損害金は残債ではなく当初の貸付元本を基準として算出され、複利計算は行わない。',
        p2_tierA_title: 'A. 元本 30万〜1,099万9,999相当（区分A）',
        p2_tierA_1: '延滞1日目〜28日目（猶予期間後）：貸付元本の5%を固定延滞金とする。',
        p2_tierA_2: '延滞29日目以降：28日経過するごとに貸付元本の2.5%を加算する。',
        p2_tierA_3: '延滞損害金の累積上限は貸付元本の32.5%とする。',
        p2_tierB_title: 'B. 元本 1,100万〜5,000万相当（区分B）',
        p2_tierB_1: '延滞28日ごとに貸付元本の2.71%を延滞損害金として算出する。',
        p2_tierB_2: '上記は年上限32.5%を12期間で按分した基準に基づく。',
        p2_tierB_3: '延滞損害金の累積上限は貸付元本の32.5%とする。',
        p2_micro_title: '少額マイクロローン延滞損害金規定 (10万〜50万相当)',
        p2_micro_1: '延滞1日目〜28日目（猶予期間後）：貸付元本の5%を固定延滞金とする。',
        p2_micro_2: '延滞29日目以降：28日経過するごとに貸付元本の2.5%を加算する。',
        p2_micro_3: '延滞損害金の累積上限は貸付元本の32.5%とする。',
        p2_schemeNote: '本契約の適用延滞方式：',
        p2_schemeAuto: '自動段階制（標準契約ルール）',
        p2_schemeManual: '手動パーセント指定',
        p2_schemeMicro: '少額マイクロローン特別延滞方式 (10万〜50万相当)',
        pasal3TitleWith: '第3条（担保の提供）',
        p3_with_1: '本貸付には、甲乙双方が適正評価額および内容に合意した担保物件が付帯する。',
        p3_with_2: '提供される担保の詳細：',
        p3_with_3: '乙は、当該担保物件が乙の正当な所有物であること、または正当な所有者の書面による同意を得ており、第三者の権利侵害や紛争が存在しないことを保証する。',
        p3_with_4: '担保の写真および明細は第2ページおよび第4ページに添付され、本契約の一部を構成する。',
        pasal3TitleWithout: '第3条（無担保貸付の確認）',
        p3_without_1: '本貸付は甲乙間の個人的な信頼関係に基づき、物的担保や保証物件の提供を伴わない無担保個人間貸付として実行される。',
        p3_without_2: '乙は、貸付元本、合意された謝礼・利息、および発生した延滞損害金の全額を期日通りに返済する個人としての完全な責任を負う。',
        p3_without_3: '乙が債務を履行しない場合、適用される民法の規定に基づき乙の一般財産をもって弁済責任を負うものとする。',
        pasal4TitleWith: '第4条（債務不履行および担保の処分）',
        p4_with_1: '乙が支払猶予期間を過ぎて支払いを遅延した場合、甲は口頭または書面にて支払催告を行う権利を有する。',
        p4_with_2: '乙は、期日が到来した残元本、合意された謝礼・利息、および第2条に基づく延滞損害金を含むすべての支払義務を履行しなければならない。',
        p4_with_3: '特に借入期間が1ヶ月の貸付において、乙が返済期日および支払猶予期間を経過しても完済しない場合、支払義務は引き続き有効とし、協議または適用される法的手続きにより解決を図るものとする。',
        p4_with_4: '滞納が2ヶ月連続で継続した場合、甲乙双方は誠実な協議および適用法令の手続きに基づく担保物件の売却により解決を図ることに合意する。',
        p4_with_5: '担保物件の売却代金は、残元本、合意された謝礼・利息、正当な延滞損害金、および合理的な売却諸費用の弁済に充当される。',
        p4_with_6: 'すべての債務を弁済した後に売却代金の余剰が生じた場合、その差額は乙に返還されなければならない。反対に売却代金が不足する場合、残債務は引き続き乙の責任とする。',
        p4_with_7: '担保物件は、権利放棄に関する合意または適用法令に基づく正当な強制執行手続きを経ることなく、自動的に甲の所有物となるものではない。',
        pasal4TitleWithout: '第4条（債務不履行および返済義務の履行）',
        p4_without_1: '乙が支払猶予期間を過ぎて支払いを遅延した場合、甲は口頭または書面にて支払催告を行う権利を有する。',
        p4_without_2: '乙は、期日が到来した残元本および第2条の規定に基づき発生する延滞損害金を含むすべての支払義務を完了しなければならない。',
        p4_without_3: '特に借入期間が1ヶ月の貸付において、乙が返済期日および支払猶予期間を経過しても完済しない場合、乙は本契約の定めに従い残元本全額および延滞損害金を完済する義務を引き続き負うものとする。',
        p4_without_4: '滞納が2ヶ月連続で継続した場合、甲乙双方は協議を行い、書面による返済計画（リスケジュール）の作成または円満な債務解決方法を取り決めるものとする。',
        p4_without_5: '協議が整わない場合、甲は本契約書および添付の証拠資料を証拠として用い、適用される法令に従い民事上の法的手続きを取ることができる。',
        pasal5Title: '第5条（合意および署名）',
        p5_1: '甲および乙は、本契約の全条項を十分に読み理解した上で、自由意思に基づき何らの強制もなく本契約に同意する。',
        p5_2: '本契約は、アプリ上の電子署名または印刷書面への自署・押印（指印）により法的に有効に成立する。',
        p5_3: '添付された取引明細、返済履歴、分割シミュレーションおよび写真資料はすべて本契約と不可分一体の効力を有する。',
        placeDateLabel: '締結地 / 締結日：',
        signParty1: '甲（貸付人・債権者）',
        signParty2: '乙（借入人・債務者）',
        page3Header: '別紙：分割返済シミュレーション（1〜12ヶ月）および延滞基準',
        page3PrincipalBadge: '元本',
        page3StampTitle: '実際の返済タイムスタンプおよび延滞ステータス記録',
        page3PenaltyRefTitle: '契約延滞基準（第2条）— 猶予期間1日',
        page3NoHistoryNote: '返済履歴はまだ登録されていません。延滞損害金は期日後2日目より当初元本に対して単利で計算されます。',
        page3NoteTitle: '分割計算および延滞金に関する注記：',
        page3NoteBody: '上記シミュレーションは契約上の実際の謝礼・利息率を当初元本に適用して算出しています。延滞損害金は第2条に基づき1日の猶予期間経過後に適用されます。',
        tenorLabel: '期間',
        monthShort: 'ヶ月',
        activeTag: '適用中',
        tenorPrincipal: '貸付元本',
        tenorTotal: '返済総額',
        tenorInstallment: '月額返済額',
        tenorPenaltyHint: '延滞金（2〜28日目）：',
        tenorMaxHint: '契約上限：',
        tenorNoPenaltyHint: '延滞基準：自動延滞金なし（元本下限未満または手動0%）',
        page4Header: '別紙：債務者本人確認および証拠写真台帳',
        page4SubBadge: '印刷規格 4x6 & 2R (7枠)',
        page4Sec1Title: 'I. 債務者（借入人）本人確認写真（証明写真サイズ 4cm × 6cm）',
        page4Sec2Title: 'II. 担保物件・受渡証拠写真（2Rサイズ 6cm × 9cm）',
        page4Sec3Title: 'III. その他補足証拠写真 / ETC（2Rサイズ 6cm × 9cm）',
        photoSlotIdDebtor: '債務者 身分証明書写真 (4x6)',
        photoSlotSelfieDebtor: '債務者 顔写真・セルフ撮影 (4x6)',
        photoSlotSelfieIdDebtor: '債務者 身分証持参セルフ写真 (4x6)',
        photoSlotCollateral1: '担保物件写真 1 (2R)',
        photoSlotCollateral2: '担保物件写真 2 (2R)',
        photoSlotHandover1: '資金交付・振込証明 1 (2R)',
        photoSlotHandover2: '受領書・資金受渡証明 2 (2R)',
        photoSlotEtc1: '補足証拠資料 / Etc 1 (2R)',
        photoSlotEtc2: '補足証拠資料 / Etc 2 (2R)',
        photoEmptyHint: '写真を貼付・添付してください'
      }
    },
    en: {
      title: 'WGen Debt Manager',
      subtitle: 'Manage loans, categories, collateral, installments, borrower contact, and payment history.',
      manageCat: 'Manage Categories',
      loanTypes: 'Loan Types',
      addDebt: 'Add Loan',
      searchPlaceholder: 'Search borrower, lender name, address or loan type...',
      allCategories: 'All Categories',
      categoryLabel: 'Borrower Category',
      noData: 'No loan data found.',
      noPhotoProof: 'No photo attachment',
      loanAmount: 'Principal Loan Amount',
      totalWithBonus: 'Total + Bonus/Interest',
      totalPlusLabel: 'Total +',
      bonusPercentage: 'Bonus / Interest Rate (%)',
      bonusText: 'Bonus',
      interestText: 'Interest',
      selectRewardType: 'Type:',
      lastPaidText: 'Last',
      undoLastPay: 'Undo',
      undoLastPayTitle: 'Undo last payment',
      initialPaidNote: 'Initial Payment',
      termText: 'Term',
      dueDateShort: 'Due',
      principalShort: 'Installment',
      loanType: 'Loan Type',
      status: 'Loan Status',
      collateral: 'Collateral',
      tenor: 'Tenor / Due Date',
      progress: 'Repayment Progress',
      proof: 'Attachment Proof:',
      proofAltText: 'Attachment Proof',
      downloadDetail: 'Download Detail (HTML)',
      edit: 'Edit Loan',
      delete: 'Delete',
      modalTitleAdd: 'Add New Loan',
      modalTitleEdit: 'Edit Loan Record',
      nameLabel: 'Borrower Name (Debtor)',
      lenderNameLabel: 'Lender Name (Creditor)',
      debtorIdLabel: 'Debtor ID / National No.',
      creditorIdLabel: 'Creditor ID / National No.',
      debtorAddressLabel: 'Debtor Full Address',
      debtorAddressPlaceholder: 'Enter borrower residential / ID address...',
      borrowerPhone: 'Borrower Phone',
      emergencyPhone: 'Emergency Phone',
      datePinjam: 'Start Date',
      dateTempo: 'Due Date',
      hasCollateral: 'Has Collateral',
      collateralTemplateHintWith: 'Agreement template will automatically use: "Personal Loan and Collateral Agreement" (With Collateral).',
      collateralTemplateHintWithout: 'Agreement template will automatically use: "Personal Loan Agreement" (Unsecured / No Collateral).',
      collateralDesc: 'Collateral Description',
      noCollateralText: 'No Collateral',
      cameraLabel: 'Camera / Attach Photo Proof',
      takePhoto: 'Take / Choose Photo',
      cancel: 'Cancel',
      save: 'Save to Database',
      catManagerTitle: 'Manage Borrower Categories',
      typeManagerTitle: 'Manage Loan Types',
      newCatPlaceholder: 'New category name...',
      newTypePlaceholder: 'New loan type...',
      close: 'Close',
      add: 'Add',
      installmentMode: 'Installment Mode',
      installmentCount: 'Total Installments (Months)',
      paidInstallments: 'Paid Installments',
      installmentAmount: 'Amount per Installment',
      payMethod: 'Payment Method',
      payAccountLabel: 'Account Number / Wallet ID / Payment Details',
      payAccountPlaceholder: 'e.g., Bank Acc 123456789 / PayPal...',
      lateFeeModeLabel: 'Late Penalty Calculation Scheme',
      lateFeeModeAuto: 'Auto Tiered (Standard Schedule)',
      lateFeeModeManual: 'Manual Percentage (% / 28 Days)',
      lateFeeTierADesc: 'Tier A (300k–10.99M): Days 1–28 = 5%, Day 29+ = +2.5%/28d (Max 32.5%/yr)',
      lateFeeTierBDesc: 'Tier B (11M–50M): +2.71% every 28 days (Max 32.5%)',
      microLoanToggleLabel: 'Special Micro Loan Package (100k – 500k IDR eq. • Unsecured)',
      microLoanToggleHint: 'Automatically sets Unsecured & displays a single penalty clause in Article 2.',
      lateFeeLabel: 'Late Penalty Fee (% / 28 Days)',
      lateFeeSub: 'Applies after 1-day Grace Period',
      penaltyShort: 'Penalty',
      lateStatusBadge: 'Overdue',
      gracePeriodInfo: '1-Day Grace Period',
      lateFeeAmountLabel: 'Late Penalty Fee',
      daysLateText: 'days late',
      totalBillWithLate: 'Final Total Bill',
      authAssetsTitle: 'Signatures & Fingerprints (Auto-Inserted on Print Document)',
      creditorFingerprintLabel: 'Creditor Fingerprint',
      creditorSignatureLabel: 'Creditor Signature',
      debtorFingerprintLabel: 'Debtor Fingerprint',
      debtorSignatureLabel: 'Debtor Signature',
      uploadImgBtn: 'Choose Image',
      uploadedShort: '✓ Attached',
      quickPay: 'Pay / Installment',
      paidOff: 'Paid Off',
      currLabel: 'Currency',
      receiptTitle: 'Loan Details',
      transId: 'Transaction ID',
      borrowerName: 'Borrower (Debtor)',
      lenderNameText: 'Lender (Creditor)',
      hasNoCollateral: 'NONE',
      hasCollateralText: 'YES',
      sigDebtor: 'Debtor Signature',
      sigCreditor: 'Creditor Signature',
      fingerprintText: 'FINGER',
      tableNoLabel: 'No',
      legalDisclaimerTitle: 'ATTACHMENT NOTICE & LEGAL DISCLAIMER:',
      legalDisclaimerText: 'This page serves as an attachment detailing transaction records, supporting proof, and payment history, forming an integral part of the Personal Loan Agreement on Page 1. Generated via WGen Note strictly as a personal administrative record-keeping tool (neither a financial institution nor a P2P lending service); all agreed terms remain the sole responsibility of both parties under applicable civil laws.',
      footerText: 'Auto-generated from WGen Note - Debt Manager System © 2026',
      until: 'to',
      flexible: 'Flexible',
      photoAttached: '✓ Photo Attached',
      confirmDelete: 'Are you sure you want to delete this loan record?',
      fillRequired: 'Name and Amount are required!',
      payModalTitle: 'Record Payment / Installment',
      payAmountLabel: 'Payment Amount',
      payMethodTxLabel: 'Transaction Payment Method',
      payDateLabel: 'Payment Date',
      payTimeLabel: 'Payment Time',
      payOneTerm: '+1 Automatic Term',
      submitPay: 'Record Payment',
      totalPaidSoFar: 'Total Paid So Far',
      remaining: 'Remaining Debt',
      paymentHistoryTitle: 'Payment History & Timestamps',
      noHistoryYet: 'No payment records recorded yet.',
      dateAndTime: 'Date & Time',
      amountPaid: 'Amount Paid',
      minimize: 'Minimize',
      expand: 'Expand Detail',
      showingLimitInfo: 'Showing max 5 latest items. Use search or filter to find other records.',
      reminderBadgePrefix: 'Due Reminder',
      reminderDaysLeft: 'days left',
      reminderToday: 'Due Today!',
      copyReminderBtn: 'Copy Reminder',
      copiedReminderBtn: 'Copied!',
      reminderMsgIntro: 'Hello',
      reminderMsgUpcoming: 'this is a friendly reminder that your loan payment is due in',
      reminderMsgToday: 'this is a friendly reminder that your loan payment is due TODAY',
      reminderMsgOverdue: 'this is a notice that your loan payment is overdue by',
      reminderMsgDueDate: 'Due Date',
      reminderMsgRemaining: 'Remaining Balance',
      reminderMsgMethod: 'Payment Method',
      reminderMsgAccount: 'Payment Destination',
      reminderMsgClosing: 'Thank you for your prompt attention.',
      statusOptions: { active: 'Active', dueSoon: 'Due Soon', paid: 'Paid Off' },
      methods: { transfer: 'Bank Transfer', ewallet: 'Digital Wallet', cash: 'Cash', flexible: 'Flexible' },
      contract: {
        docTitleWithCollateral: 'PERSONAL LOAN AND COLLATERAL AGREEMENT',
        docTitleNoCollateral: 'PERSONAL LOAN AGREEMENT',
        introPrefix: 'On',
        introDateWord: 'dated',
        introTxLabel: 'Transaction ID',
        introSuffix: 'this personal loan agreement is entered into between:',
        party1Title: 'FIRST PARTY (LENDER / CREDITOR)',
        party2Title: 'SECOND PARTY (BORROWER / DEBTOR)',
        fieldName: 'Full Name',
        fieldId: 'ID / Passport No.',
        fieldAddress: 'Full Address',
        fieldPhone: 'Phone / Emergency',
        pasal1Title: 'ARTICLE 1 - PRINCIPAL LOAN & REWARD / INTEREST',
        p1_1: 'Principal loan amount:',
        p1_2: 'Disbursement / start date:',
        p1_3: 'Final maturity / due date:',
        p1_4: 'Loan tenor / duration:',
        p1_4_installment: 'monthly installment terms from the disbursement date.',
        p1_4_single: '1 (one) single calendar period from disbursement date until the final due date.',
        p1_5: 'Payment grace period: 1 (one) calendar day following the due date.',
        p1_6: 'Late penalty charges apply starting the day after the grace period expires (Day +2).',
        p1_7: 'Agreed reward / interest rate:',
        p1_8: 'The agreed reward or interest constitutes a binding obligation of the Second Party payable to the First Party in accordance with the agreed schedule.',
        pasal2Title: 'ARTICLE 2 - LATE PAYMENT PENALTIES',
        p2_intro: 'Penalties are calculated strictly on the initial principal amount (not the remaining balance) without compounding interest.',
        p2_tierA_title: 'A. Tier A Loans (300,000 – 10,999,999 IDR eq.)',
        p2_tierA_1: 'Days 1 to 28 overdue (after grace period): flat penalty of 5% of initial principal.',
        p2_tierA_2: 'From Day 29 onward: additional 2.5% penalty for every subsequent 28-day period.',
        p2_tierA_3: 'Maximum cumulative penalty is capped at 32.5% of the initial principal.',
        p2_tierB_title: 'B. Tier B Loans (11,000,000 – 50,000,000 IDR eq.)',
        p2_tierB_1: 'Penalty of 2.71% of initial principal for every 28-day overdue period.',
        p2_tierB_2: 'Calculated as 32.5% divided across a maximum of 12 periods.',
        p2_tierB_3: 'Maximum cumulative penalty is capped at 32.5% of the initial principal.',
        p2_micro_title: 'Micro Loan Late Penalty Terms (100,000 – 500,000 IDR eq.)',
        p2_micro_1: 'Days 1 to 28 overdue (after grace period): flat penalty of 5% of initial principal.',
        p2_micro_2: 'From Day 29 onward: additional 2.5% penalty for every subsequent 28-day period.',
        p2_micro_3: 'Maximum cumulative penalty is capped at 32.5% of the initial principal.',
        p2_schemeNote: 'Active penalty scheme for this agreement:',
        p2_schemeAuto: 'Auto Tiered (Standard Schedule)',
        p2_schemeManual: 'Manual Percentage',
        p2_schemeMicro: 'Special Micro Loan Scheme (100k – 500k IDR eq.)',
        pasal3TitleWith: 'ARTICLE 3 - COLLATERAL / SECURITY',
        p3_with_1: 'This loan is secured by collateral whose fair value and specification have been mutually agreed upon by both parties.',
        p3_with_2: 'Recorded collateral details:',
        p3_with_3: 'The Second Party warrants that the collateral is lawfully owned by the Second Party (or pledged with written owner consent) and free from any third-party dispute.',
        p3_with_4: 'Photographic proof and specifications of the collateral are attached on Page 2 and Page 4 as an integral part of this agreement.',
        pasal3TitleWithout: 'ARTICLE 3 - UNSECURED PERSONAL LOAN TERMS',
        p3_without_1: 'This loan is granted based on personal trust between the First Party and the Second Party without physical collateral or asset pledge (Unsecured Personal Loan).',
        p3_without_2: 'The Second Party assumes full personal liability for the timely repayment of the entire principal, agreed reward/interest, and any applicable late penalties.',
        p3_without_3: 'In the event of default, the Second Party remains personally liable under applicable civil law provisions.',
        pasal4TitleWith: 'ARTICLE 4 - DEFAULT & COLLATERAL SETTLEMENT',
        p4_with_1: 'Should the Second Party delay payment beyond the grace period, the First Party reserves the right to issue verbal or written payment reminders.',
        p4_with_2: 'The Second Party remains obligated to settle all matured payment obligations, including remaining principal, agreed reward/interest, and late penalties under Article 2.',
        p4_with_3: 'Specifically for loans with a 1 (one) month tenor, if the Second Party fails to make full repayment after the due date and grace period expire, the payment obligation remains binding and resolution may be pursued through mutual deliberation or applicable legal mechanisms.',
        p4_with_4: 'Should arrears persist for 2 (two) consecutive months, both parties agree to pursue resolution through deliberation and sale of the collateral in accordance with applicable legal mechanisms.',
        p4_with_5: 'Proceeds from the sale of collateral shall be applied toward settling the remaining principal, agreed reward/interest, valid late penalties, and reasonable selling expenses.',
        p4_with_6: 'Any surplus proceeds remaining after full settlement of all obligations shall be returned to the Second Party. Conversely, if the sale proceeds are insufficient, the remaining balance remains the liability of the Second Party.',
        p4_with_7: 'Collateral shall not automatically become the property of the First Party without a lawful transfer-of-rights agreement or valid legal execution procedures under applicable laws.',
        pasal4TitleWithout: 'ARTICLE 4 - DEFAULT & OBLIGATION SETTLEMENT',
        p4_without_1: 'Should the Second Party delay payment beyond the grace period, the First Party reserves the right to issue verbal or written payment reminders.',
        p4_without_2: 'The Second Party is obligated to settle all matured payment obligations, including the remaining principal and any late penalties accrued under Article 2.',
        p4_without_3: 'Specifically for loans with a 1 (one) month tenor, if the Second Party fails to make full repayment after the due date and grace period expire, the Second Party remains obligated to pay off the entire remaining principal along with late penalties in accordance with this agreement.',
        p4_without_4: 'Should arrears persist for 2 (two) consecutive months, both parties shall deliberate to establish a written repayment schedule (restructuring) or an amicable settlement.',
        p4_without_5: 'Should deliberation fail to reach an agreement, the First Party reserves the right to pursue civil legal remedies under applicable laws, utilizing this agreement and its attached supporting documents as valid evidence.',
        pasal5Title: 'ARTICLE 5 - EXECUTION & CONSENT',
        p5_1: 'Both parties confirm that they have read, understood, and voluntarily agreed to all terms of this agreement without coercion.',
        p5_2: 'This agreement is validly executed electronically via the application or in printed form with wet signatures, fingerprints, and applicable stamp duty.',
        p5_3: 'All attached transaction summaries, payment histories, installment schedules, and photo sheets form an inseparable part of this agreement.',
        placeDateLabel: 'Place / Date of Execution:',
        signParty1: 'FIRST PARTY\n(Lender / Creditor)',
        signParty2: 'SECOND PARTY\n(Borrower / Debtor)',
        page3Header: 'APPENDIX: 1–12 MONTH TENOR SIMULATION & PENALTY REFERENCE',
        page3PrincipalBadge: 'PRINCIPAL',
        page3StampTitle: 'ACTUAL PAYMENT STAMPS & OVERDUE AUDIT LOG',
        page3PenaltyRefTitle: 'CONTRACT PENALTY REFERENCE (ARTICLE 2) — 1-DAY GRACE PERIOD',
        page3NoHistoryNote: 'No payment timestamps recorded yet. Penalties accrue on initial principal without compounding starting Day +2 after due date.',
        page3NoteTitle: 'TENOR & PENALTY CALCULATION NOTE:',
        page3NoteBody: 'Simulations above apply the contract’s actual reward/interest rate to the initial principal. Late penalties follow Article 2 after the 1-day grace period.',
        tenorLabel: 'TENOR',
        monthShort: 'MO',
        activeTag: 'ACTIVE',
        tenorPrincipal: 'Principal',
        tenorTotal: 'Total Payoff',
        tenorInstallment: 'Monthly Installment',
        tenorPenaltyHint: 'Late Fee (Day +2 to +28):',
        tenorMaxHint: 'Contract Max:',
        tenorNoPenaltyHint: 'Penalty Scheme: No automatic penalty (Principal below threshold / Manual 0%)',
        page4Header: 'APPENDIX: DEBTOR VERIFICATION & SUPPORTING PHOTO DOCUMENTATION',
        page4SubBadge: 'PRINT SIZE 4x6 & 2R (7 SLOTS)',
        page4Sec1Title: 'I. DEBTOR IDENTITY VERIFICATION PHOTOS (PASSPORT 4x6 CM)',
        page4Sec2Title: 'II. COLLATERAL / SECURITY DOCUMENTATION (2R FORMAT)',
        page4Sec3Title: 'III. ADDITIONAL SUPPORTING EVIDENCE / ETC (2R FORMAT)',
        photoSlotIdDebtor: 'Debtor ID Card Photo (4x6)',
        photoSlotSelfieDebtor: 'Debtor Portrait / Selfie (4x6)',
        photoSlotSelfieIdDebtor: 'Debtor Selfie Holding ID (4x6)',
        photoSlotCollateral1: 'Collateral / Asset Photo 1 (2R)',
        photoSlotCollateral2: 'Collateral / Asset Photo 2 (2R)',
        photoSlotHandover1: 'Disbursement / Handover Proof 1 (2R)',
        photoSlotHandover2: 'Receipt / Handover Proof 2 (2R)',
        photoSlotEtc1: 'Supporting Proof / Etc 1 (2R)',
        photoSlotEtc2: 'Supporting Proof / Etc 2 (2R)',
        photoEmptyHint: 'Attach / Paste Physical Photo'
      }
    },
    ar: {
      title: 'WGen مدير الديون',
      subtitle: 'إدارة القروض، الفئات، الضمانات، والأقساط.',
      manageCat: 'إدارة الفئات',
      loanTypes: 'أنواع القروض',
      addDebt: 'إضافة قرض',
      searchPlaceholder: 'ابحث عن اسم المقترض أو المقرض أو العنوان...',
      allCategories: 'جميع الفئات',
      categoryLabel: 'فئة المقترض',
      noData: 'لا توجد بيانات.',
      noPhotoProof: 'لا توجد صورة مرفقة',
      loanAmount: 'المبلغ الأصلي',
      totalWithBonus: 'الإجمالي + الفائدة/المكافأة',
      totalPlusLabel: 'الإجمالي +',
      bonusPercentage: 'نسبة المكافأة / الفائدة (%)',
      bonusText: 'مكافأة',
      interestText: 'فائدة',
      selectRewardType: 'النوع:',
      lastPaidText: 'آخر دفعة',
      undoLastPay: 'تراجع',
      undoLastPayTitle: 'إلغاء آخر دفعة',
      initialPaidNote: 'دفعة أولية',
      termText: 'قسط',
      dueDateShort: 'الاستحقاق',
      principalShort: 'القسط',
      loanType: 'نوع القرض',
      status: 'الحالة',
      collateral: 'الضمان',
      tenor: 'المدة / الاستحقاق',
      progress: 'نسبة السداد',
      proof: 'الإثبات:',
      proofAltText: 'صورة الإثبات',
      downloadDetail: 'تحميل التفاصيل (HTML)',
      edit: 'تعديل',
      delete: 'حذف',
      modalTitleAdd: 'إضافة قرض جديد',
      modalTitleEdit: 'تعديل القرض',
      nameLabel: 'اسم المقترض (المدين)',
      lenderNameLabel: 'اسم المقرض (الدائن)',
      debtorIdLabel: 'رقم هوية المدين',
      creditorIdLabel: 'رقم هوية الدائن',
      debtorAddressLabel: 'عنوان المقترض (المدين)',
      debtorAddressPlaceholder: 'أدخل عنوان سكن المقترض بالتفصيل...',
      borrowerPhone: 'هاتف المقترض',
      emergencyPhone: 'رقم الطوارئ',
      datePinjam: 'تاريخ البدء',
      dateTempo: 'تاريخ الاستحقاق',
      hasCollateral: 'يوجد ضمان',
      collateralTemplateHintWith: 'سيستخدم قالب العقد تلقائياً صيغة: "اتفاقية قرض شخصي بضمان".',
      collateralTemplateHintWithout: 'سيستخدم قالب العقد تلقائياً صيغة: "اتفاقية قرض شخصي" (بدون ضمان).',
      collateralDesc: 'وصف الضمان',
      noCollateralText: 'بدون ضمان',
      cameraLabel: 'صورة الإثبات',
      takePhoto: 'التقاط صورة',
      cancel: 'إلغاء',
      save: 'حفظ',
      catManagerTitle: 'إدارة الفئات',
      typeManagerTitle: 'إدارة الأنواع',
      newCatPlaceholder: 'فئة جديدة...',
      newTypePlaceholder: 'نوع جديد...',
      close: 'إغلاق',
      add: 'إضافة',
      installmentMode: 'نظام الأقساط',
      installmentCount: 'عدد الأقساط',
      paidInstallments: 'الأقساط المدفوعة',
      installmentAmount: 'قيمة القسط',
      payMethod: 'طريقة الدفع',
      payAccountLabel: 'رقم الحساب / المحفظة الإلكترونية',
      payAccountPlaceholder: 'أدخل رقم الحساب أو المحفظة...',
      lateFeeModeLabel: 'نظام حساب غرامة التأخير',
      lateFeeModeAuto: 'تلقائي متدرج (النظام القياسي)',
      lateFeeModeManual: 'نسبة يدوية (% لكل 28 يوم)',
      lateFeeTierADesc: 'الفئة أ (300 ألف–10.99 مليون): 1–28 يوم = 5%، +2.5% كل 28 يوم (الحد الأقصى 32.5% سنوياً)',
      lateFeeTierBDesc: 'الفئة ب (11 مليون–50 مليون): +2.71% كل 28 يوم (الحد الأقصى 32.5%)',
      microLoanToggleLabel: 'باقة القرض الصغير الخاص (100 ألف – 500 ألف • بدون ضمان)',
      microLoanToggleHint: 'يُضبط تلقائياً بدون ضمان ويعرض نظام غرامة موحد في المادة 2.',
      lateFeeLabel: 'غرامة التأخير (% لكل 28 يوم)',
      lateFeeSub: 'تطبق بعد فترة سماح يوم واحد',
      penaltyShort: 'غرامة',
      lateStatusBadge: 'متأخر',
      gracePeriodInfo: 'فترة سماح يوم واحد',
      lateFeeAmountLabel: 'غرامة التأخير',
      daysLateText: 'أيام تأخير',
      totalBillWithLate: 'إجمالي الفاتورة النهائية',
      authAssetsTitle: 'مرفقات التوقيع وبصمة الإصبع (تظهر تلقائياً في مستند الطباعة)',
      creditorFingerprintLabel: 'بصمة الدائن',
      creditorSignatureLabel: 'توقيع الدائن',
      debtorFingerprintLabel: 'بصمة المدين',
      debtorSignatureLabel: 'توقيع المدين',
      uploadImgBtn: 'اختر صورة',
      uploadedShort: '✓ تم الإرفاق',
      quickPay: 'دفع قسط',
      paidOff: 'مدفوع بالكامل',
      currLabel: 'العملة',
      receiptTitle: 'تفاصيل القرض',
      transId: 'معرف المعاملة',
      borrowerName: 'المقترض (المدين)',
      lenderNameText: 'المقرض (الدائن)',
      hasNoCollateral: 'لا يوجد',
      hasCollateralText: 'نعم',
      sigDebtor: 'توقيع المدين',
      sigCreditor: 'توقيع الدائن',
      fingerprintText: 'بصمة',
      tableNoLabel: 'م',
      legalDisclaimerTitle: 'إشعار المرفقات وإخلاء المسؤولية القانونية:',
      legalDisclaimerText: 'تُعد هذه الصفحة ملحقاً يتضمن تفاصيل المعاملات، والمستندات الداعمة، وسجل المدفوعات، وتشكل جزءاً لا يتجزأ من اتفاقية القرض الشخصي الواردة في الصفحة الأولى. تم إصدار هذا المستند عبر تطبيق WGen Note كأداة لتسجيل الإدارة الشخصية فقط، وتقع كافة الالتزامات القانونية على عاتق الطرفين وفقاً لأحكام القانون المدني المعمول به.',
      footerText: 'تم الإنشاء تلقائياً من نظام WGen © 2026',
      until: 'إلى',
      flexible: 'مرن',
      photoAttached: '✓ تم إرفاق الصورة',
      confirmDelete: 'هل أنت متأكد من حذف هذا السجل؟',
      fillRequired: 'الاسم والمبلغ مطلوبان!',
      payModalTitle: 'تسجيل الدفع / القسط',
      payAmountLabel: 'مبلغ الدفع',
      payMethodTxLabel: 'طريقة الدفع للمعاملة',
      payDateLabel: 'تاريخ الدفع',
      payTimeLabel: 'وقت الدفع',
      payOneTerm: '+1 قسط تلقائي',
      submitPay: 'تسجيل الدفع',
      totalPaidSoFar: 'إجمالي المدفوع',
      remaining: 'المبلغ المتبقي',
      paymentHistoryTitle: 'سجل المدفوعات والطابع الزمني',
      noHistoryYet: 'لا توجد سجلات مدفوعات.',
      dateAndTime: 'التاريخ والوقت',
      amountPaid: 'المبلغ المدفوع',
      minimize: 'تصغير',
      expand: 'توسيع التفاصيل',
      showingLimitInfo: 'عرض بحد أقصى 5 سجلات. استخدم البحث لعرض البقية.',
      reminderBadgePrefix: 'تذكير بالاستحقاق',
      reminderDaysLeft: 'أيام متبقية',
      reminderToday: 'يستحق اليوم!',
      copyReminderBtn: 'نسخ التذكير',
      copiedReminderBtn: 'تم النسخ!',
      reminderMsgIntro: 'مرحباً',
      reminderMsgUpcoming: 'نود تذكيرك بأن موعد سداد القرض الخاص بك يحين خلال',
      reminderMsgToday: 'نود تذكيرك بأن موعد سداد القرض الخاص بك يحين اليوم',
      reminderMsgOverdue: 'نود إشعارك بأن سداد القرض الخاص بك قد تأخر بمقدار',
      reminderMsgDueDate: 'تاريخ الاستحقاق',
      reminderMsgRemaining: 'المبلغ المتبقي',
      reminderMsgMethod: 'طريقة الدفع',
      reminderMsgAccount: 'بيانات التحويل',
      reminderMsgClosing: 'شكراً لتعاونكم.',
      statusOptions: { active: 'نشط', dueSoon: 'قريب الاستحقاق', paid: 'مكتمل' },
      methods: { transfer: 'تحويل بنكي', ewallet: 'محفظة إلكترونية', cash: 'نقداً', flexible: 'مرن' },
      contract: {
        docTitleWithCollateral: 'اتفاقية قرض شخصي وضمان',
        docTitleNoCollateral: 'اتفاقية قرض شخصي',
        introPrefix: 'في يوم',
        introDateWord: 'الموافق',
        introTxLabel: 'رقم المعاملة',
        introSuffix: 'تم الاتفاق والتعاقد بين كل من:',
        party1Title: 'الطرف الأول (المقرض / الدائن)',
        party2Title: 'الطرف الثاني (المقترض / المدين)',
        fieldName: 'الاسم الكامل',
        fieldId: 'رقم الهوية / الجواز',
        fieldAddress: 'العنوان الكامل',
        fieldPhone: 'رقم الهاتف / الطوارئ',
        pasal1Title: 'المادة 1 - أصل القرض والمكافأة / الفائدة',
        p1_1: 'مبلغ أصل القرض:',
        p1_2: 'تاريخ صرف القرض:',
        p1_3: 'تاريخ الاستحقاق النهائي:',
        p1_4: 'مدة القرض / الأقساط:',
        p1_4_installment: 'أشهر / أقساط شهرية من تاريخ الصرف.',
        p1_4_single: 'فترة تقويمية واحدة من تاريخ الصرف حتى تاريخ الاستحقاق النهائي.',
        p1_5: 'فترة السماح للسداد: يوم تقويمي واحد (1) بعد تاريخ الاستحقاق.',
        p1_6: 'تبدأ غرامة التأخير في السريان في اليوم التالي لانتهاء فترة السماح (اليوم +2).',
        p1_7: 'المكافأة / الفائدة المتفق عليها:',
        p1_8: 'تُعد المكافأة أو الفائدة المتفق عليها التزاماً واجب السداد من الطرف الثاني إلى الطرف الأول وفقاً للمواعيد المحددة.',
        pasal2Title: 'المادة 2 - غرامات التأخير',
        p2_intro: 'تُحسب الغرامة على أساس أصل القرض الأولي وليس على الرصيد المتبقي، وبدون فائدة مركبة.',
        p2_tierA_title: 'أ. القروض من 300,000 إلى 10,999,999 (الفئة أ)',
        p2_tierA_1: 'التأخير من اليوم 1 إلى 28 (بعد فترة السماح): غرامة ثابتة 5% من أصل القرض.',
        p2_tierA_2: 'ابتداءً من اليوم 29: غرامة إضافية 2.5% عن كل فترة 28 يوماً تالية.',
        p2_tierA_3: 'الحد الأقصى لتراكم الغرامة هو 32.5% من أصل القرض.',
        p2_tierB_title: 'ب. القروض من 11,000,000 إلى 50,000,000 (الفئة ب)',
        p2_tierB_1: 'تُحسب الغرامة بنسبة 2.71% من أصل القرض عن كل فترة تأخير مدتها 28 يوماً.',
        p2_tierB_2: 'يستند الحساب إلى 32.5% مقسومة على 12 فترة كحد أقصى.',
        p2_tierB_3: 'الحد الأقصى لتراكم الغرامة هو 32.5% من أصل القرض.',
        p2_micro_title: 'شروط غرامة القرض الصغير (100,000 – 500,000)',
        p2_micro_1: 'التأخير من اليوم 1 إلى 28 (بعد فترة السماح): غرامة ثابتة 5% من أصل القرض.',
        p2_micro_2: 'ابتداءً من اليوم 29: غرامة إضافية 2.5% عن كل فترة 28 يوماً تالية.',
        p2_micro_3: 'الحد الأقصى لتراكم الغرامة هو 32.5% من أصل القرض.',
        p2_schemeNote: 'نظام الغرامة المطبق في هذا العقد:',
        p2_schemeAuto: 'تلقائي متدرج (النظام القياسي)',
        p2_schemeManual: 'نسبة يدوية',
        p2_schemeMicro: 'نظام القرض الصغير الخاص (100 ألف – 500 ألف)',
        pasal3TitleWith: 'المادة 3 - الضمان / الرهن',
        p3_with_1: 'هذا القرض مضمون بأصل/ضمان تم الاتفاق على قيمته العادلة ونوعه بين الطرفين.',
        p3_with_2: 'تفاصيل الضمان المسجل:',
        p3_with_3: 'يقر الطرف الثاني ويضمن أن الضمان مملوك له ملكية قانونية خالصة أو بموافقة خطية من مالكه وخالٍ من أي نزاع.',
        p3_with_4: 'تُرفق صور ومستندات الضمان في الصفحتين 2 و4 كجزء لا يتجزأ من هذه الاتفاقية.',
        pasal3TitleWithout: 'المادة 3 - قرض شخصي بدون ضمان',
        p3_without_1: 'يُمنح هذا القرض بناءً على الثقة الشخصية المتبادلة بين الطرف الأول والطرف الثاني دون تقديم أي ضمان عيني أو رهن.',
        p3_without_2: 'يتحمل الطرف الثاني المسؤولية الشخصية الكاملة عن سداد كامل أصل القرض والمكافأة المتفق عليها وأي غرامات تأخير في مواعيدها.',
        p3_without_3: 'في حال الإخلال بالسداد، تظل الذمة المالية للطرف الثاني ضامنة للوفاء بالالتزام وفقاً لأحكام القانون المدني.',
        pasal4TitleWith: 'المادة 4 - الإخلال بالسداد وتسوية الضمان',
        p4_with_1: 'في حال تأخر الطرف الثاني عن السداد بعد تجاوز فترة السماح، يحق للطرف الأول توجيه إشعارات وتذكيرات بالمطالبة بالسداد شفهياً أو خطياً.',
        p4_with_2: 'يظل الطرف الثاني ملزماً بسداد جميع الالتزامات المالية المستحقة، بما في ذلك المتبقي من أصل القرض، والمكافأة/الفائدة المتفق عليها، وغرامات التأخير وفقاً لأحكام المادة 2.',
        p4_with_3: 'فيما يخص القروض التي تبلغ مدتها شهراً واحداً (1) على وجه الخصوص، إذا لم يقم الطرف الثاني بالسداد الكامل بعد تجاوز تاريخ الاستحقاق وفترة السماح، يظل التزام السداد سارياً ويمكن تسويته عبر التفاوض الودي أو الآليات القانونية المعمول بها.',
        p4_with_4: 'إذا استمر التأخير لمدة شهرين (2) متتاليين، يتفق الطرفان على السعي للتسوية عبر التفاوض وبيع العين المرهونة (الضمان) وفقاً للآليات القانونية المعمول بها.',
        p4_with_5: 'تُستخدم حصيلة بيع الضمان لسداد المتبقي من أصل القرض، والمكافأة/الفائدة المتفق عليها، وغرامات التأخير المستحقة نظاماً، بالإضافة إلى مصاريف البيع المعقولة.',
        p4_with_6: 'في حال وجود فائض من حصيلة البيع بعد سداد كافة الالتزامات، يجب رد الفرق إلى الطرف الثاني. وعلى العكس، إذا لم تكن حصيلة البيع كافية، يظل المبلغ المتبقي مسؤولية الطرف الثاني.',
        p4_with_7: 'لا تنتقل ملكية الضمان تلقائياً إلى الطرف الأول دون اتفاق قانوني بالتنازل عن الحق أو إجراءات تنفيذ رسمية وفقاً للأنظمة والقوانين المعمول بها.',
        pasal4TitleWithout: 'المادة 4 - الإخلال بالسداد وتسوية الالتزامات',
        p4_without_1: 'في حال تأخر الطرف الثاني عن السداد بعد تجاوز فترة السماح، يحق للطرف الأول توجيه إشعارات وتذكيرات بالمطالبة بالسداد شفهياً أو خطياً.',
        p4_without_2: 'يلتزم الطرف الثاني بسداد جميع الالتزامات المالية التي حل موعد استحقاقها، بما في ذلك المتبقي من أصل القرض وغرامات التأخير المترتبة وفقاً لأحكام المادة 2.',
        p4_without_3: 'فيما يخص القروض التي تبلغ مدتها شهراً واحداً (1) على وجه الخصوص، إذا لم يقم الطرف الثاني بالسداد الكامل بعد تجاوز تاريخ الاستحقاق وفترة السماح، يظل الطرف الثاني ملزماً بسداد كامل المتبقي من أصل القرض مع غرامات التأخير وفقاً لأحكام هذه الاتفاقية.',
        p4_without_4: 'إذا استمر التأخير لمدة شهرين (2) متتاليين، يلتزم الطرفان بالتفاوض لوضع جدول سداد خطي (إعادة هيكلة) أو تسوية الالتزامات بشكل ودي.',
        p4_without_5: 'في حال عدم توصل التفاوض إلى اتفاق، يحق للطرف الأول اتخاذ الإجراءات القانونية المدنية وفقاً للقوانين والأنظمة المعمول بها، مع استخدام وثيقة الاتفاقية هذه والمستندات المرفقة بها كدليل إثبات.',
        pasal5Title: 'المادة 5 - الإقرار والموافقة',
        p5_1: 'يقر الطرفان بأنهما قد قرأا وفهما ووافقا على جميع بنود هذه الاتفاقية بكامل الأهلية ودون أي إكراه.',
        p5_2: 'تُعد هذه الاتفاقية سارية المفعول بالتوقيع الإلكتروني عبر التطبيق أو بالتوقيع الخطي والبصمة على النسخة المطبوعة.',
        p5_3: 'تُعتبر جميع المرفقات وسجل المدفوعات وجدول الأقساط والصور جزءاً لا يتجزأ من هذه الاتفاقية.',
        placeDateLabel: 'مكان وتاريخ التوقيع:',
        signParty1: 'الطرف الأول\n(المقرض / الدائن)',
        signParty2: 'الطرف الثاني\n(المقترض / المدين)',
        page3Header: 'ملحق: محاكاة الأقساط (1 – 12 شهراً) ومرجع الغرامات',
        page3PrincipalBadge: 'الأصل',
        page3StampTitle: 'سجل الطوابع الزمنية الفعلية وحالة التأخير',
        page3PenaltyRefTitle: 'مرجع غرامات العقد (المادة 2) — فترة سماح يوم واحد',
        page3NoHistoryNote: 'لا توجد سجلات دفع مسجلة حتى الآن. تُحسب الغرامة على أصل القرض الأولي بدون فائدة مركبة بدءاً من اليوم +2.',
        page3NoteTitle: 'ملاحظة حساب الأقساط والغرامات:',
        page3NoteBody: 'تم حساب المحاكاة أعلاه باستخدام نسبة المكافأة/الفائدة الفعلية للعقد على أصل القرض الأولي، وتطبق الغرامات وفق المادة 2.',
        tenorLabel: 'المدة',
        monthShort: 'شهر',
        activeTag: 'نشط',
        tenorPrincipal: 'أصل القرض',
        tenorTotal: 'إجمالي السداد',
        tenorInstallment: 'القسط الشهري',
        tenorPenaltyHint: 'غرامة التأخير (يوم +2 إلى +28):',
        tenorMaxHint: 'الحد الأقصى للعقد:',
        tenorNoPenaltyHint: 'نظام الغرامة: بدون غرامة تلقائية (الأصل أقل من الحد الأدنى أو يدوي 0%)',
        page4Header: 'ملحق: صور التحقق من هوية المدين والمستندات الداعمة',
        page4SubBadge: 'مقاس الطباعة 4x6 & 2R (7 خانات)',
        page4Sec1Title: 'أولاً: صور التحقق من هوية المدين (مقاس صورة شخصية 4×6 سم)',
        page4Sec2Title: 'ثانياً: صور الضمان / الرهن (مقاس 2R)',
        page4Sec3Title: 'ثالثاً: مستندات وصور داعمة إضافية / ETC (مقاس 2R)',
        photoSlotIdDebtor: 'صورة هوية المدين (4x6)',
        photoSlotSelfieDebtor: 'صورة شخصية للمدين (4x6)',
        photoSlotSelfieIdDebtor: 'صورة سيلفي للمدين مع الهوية (4x6)',
        photoSlotCollateral1: 'صورة الضمان / الرهن 1 (2R)',
        photoSlotCollateral2: 'صورة الضمان / الرهن 2 (2R)',
        photoSlotHandover1: 'إثبات التسليم / التحويل 1 (2R)',
        photoSlotHandover2: 'إيصال الاستلام 2 (2R)',
        photoSlotEtc1: 'مستند داعم إضافي / Etc 1 (2R)',
        photoSlotEtc2: 'مستند داعم إضافي / Etc 2 (2R)',
        photoEmptyHint: 'ألصق / أرفق الصورة هنا'
      }
    },
    cn: {
      title: 'WGen 债务管理',
      subtitle: '管理贷款、类别、抵押品和分期付款。',
      manageCat: '管理类别',
      loanTypes: '贷款类型',
      addDebt: '添加贷款',
      searchPlaceholder: '搜索借款人、出借人姓名、地址...',
      allCategories: '所有类别',
      categoryLabel: '借款人类别',
      noData: '未找到贷款数据。',
      noPhotoProof: '无照片附件',
      loanAmount: '本金金额',
      totalWithBonus: '总计 (含利息/奖励)',
      totalPlusLabel: '总计 +',
      bonusPercentage: '奖励/利息比例 (%)',
      bonusText: '奖励',
      interestText: '利息',
      selectRewardType: '类型:',
      lastPaidText: '最近还款',
      undoLastPay: '撤销',
      undoLastPayTitle: '撤销最近一笔还款',
      initialPaidNote: '初始还款',
      termText: '期',
      dueDateShort: '到期日',
      principalShort: '本金',
      loanType: '贷款类型',
      status: '状态',
      collateral: '抵押品',
      tenor: '期限 / 到期日',
      progress: '还款进度',
      proof: '附件证明:',
      proofAltText: '附件证明照片',
      downloadDetail: '下载详情 (HTML)',
      edit: '编辑',
      delete: '删除',
      modalTitleAdd: '添加新贷款',
      modalTitleEdit: '编辑贷款记录',
      nameLabel: '借款人姓名 (债务人)',
      lenderNameLabel: '出借人姓名 (债权人)',
      debtorIdLabel: '债务人身份证件号',
      creditorIdLabel: '债权人身份证件号',
      debtorAddressLabel: '债务人详细地址',
      debtorAddressPlaceholder: '请输入借款人居住或证件地址...',
      borrowerPhone: '借款人电话',
      emergencyPhone: '紧急联系电话',
      datePinjam: '借款日期',
      dateTempo: '到期日期',
      hasCollateral: '有抵押品',
      collateralTemplateHintWith: '协议模板将自动采用：《个人借款及担保协议》（有抵押担保）。',
      collateralTemplateHintWithout: '协议模板将自动采用：《个人借款协议》（无抵押信用借款）。',
      collateralDesc: '抵押品描述',
      noCollateralText: '无抵押品',
      cameraLabel: '拍照/上传凭证',
      takePhoto: '拍照/选择照片',
      cancel: '取消',
      save: '保存',
      catManagerTitle: '管理借款人类别',
      typeManagerTitle: '管理贷款类型',
      newCatPlaceholder: '新类别名称...',
      newTypePlaceholder: '新贷款类型...',
      close: '关闭',
      add: '添加',
      installmentMode: '分期模式',
      installmentCount: '总分期数',
      paidInstallments: '已付期数',
      installmentAmount: '每期金额',
      payMethod: '支付方式',
      payAccountLabel: '银行账号 / 电子钱包号码',
      payAccountPlaceholder: '输入账号或钱包信息...',
      lateFeeModeLabel: '逾期滞纳金计算方式',
      lateFeeModeAuto: '自动阶梯制 (标准规则)',
      lateFeeModeManual: '手动百分比 (每28天%)',
      lateFeeTierADesc: 'A档 (30万–1099万): 第1–28天=5%，第29天起每28天+2.5% (年上限32.5%)',
      lateFeeTierBDesc: 'B档 (1100万–5000万): 每28天+2.71% (上限32.5%)',
      microLoanToggleLabel: '小额微型借款专享方案 (10万–50万等值 • 无抵押)',
      microLoanToggleHint: '自动设为无抵押借款，且第二条仅显示单一滞纳金规则。',
      lateFeeLabel: '逾期滞纳金 (每28天%)',
      lateFeeSub: '到期日1天宽限期后生效',
      penaltyShort: '滞纳金',
      lateStatusBadge: '已逾期',
      gracePeriodInfo: '1天宽限期',
      lateFeeAmountLabel: '逾期滞纳金',
      daysLateText: '天逾期',
      totalBillWithLate: '最终账单总额',
      authAssetsTitle: '签名与指纹图片上传 (自动嵌入打印合同)',
      creditorFingerprintLabel: '债权人指纹图片',
      creditorSignatureLabel: '债权人签名图片',
      debtorFingerprintLabel: '债务人指纹图片',
      debtorSignatureLabel: '债务人签名图片',
      uploadImgBtn: '选择图片',
      uploadedShort: '✓ 已上传',
      quickPay: '偿还分期',
      paidOff: '已结清',
      currLabel: '货币',
      receiptTitle: '借款详情',
      transId: '交易ID',
      borrowerName: '借款人 (债务人)',
      lenderNameText: '出借人 (债权人)',
      hasNoCollateral: '无',
      hasCollateralText: '有',
      sigDebtor: '债务人签字',
      sigCreditor: '债权人签字',
      fingerprintText: '指纹',
      tableNoLabel: '序号',
      legalDisclaimerTitle: '附件说明及法律免责声明：',
      legalDisclaimerText: '本页为交易明细、佐证材料及还款记录附件，与第1页《个人借款协议》构成不可分割的整体。本文档由个人行政记录工具 WGen Note 生成（非金融机构或 P2P 平台），双方依据现行民法各自承担全部约定责任。',
      footerText: '由 WGen Note 系统自动生成 © 2026',
      until: '至',
      flexible: '灵活',
      photoAttached: '✓ 已附加照片',
      confirmDelete: '确定要删除此贷款记录吗？',
      fillRequired: '姓名和金额为必填项！',
      payModalTitle: '进行分期还款',
      payAmountLabel: '还款金额',
      payMethodTxLabel: '本次支付方式',
      payDateLabel: '还款日期',
      payTimeLabel: '还款时间',
      payOneTerm: '+1 期自动还款',
      submitPay: '提交还款',
      totalPaidSoFar: '已还总额',
      remaining: '剩余债务',
      paymentHistoryTitle: '付款历史与时间戳',
      noHistoryYet: '尚无付款记录。',
      dateAndTime: '日期与时间',
      amountPaid: '付款金额',
      minimize: '折叠',
      expand: '展开详情',
      showingLimitInfo: '最多显示5条最新记录，请使用搜索或筛选查看其他记录。',
      reminderBadgePrefix: '到期提醒',
      reminderDaysLeft: '天后到期',
      reminderToday: '今天到期！',
      copyReminderBtn: '复制提醒',
      copiedReminderBtn: '已复制！',
      reminderMsgIntro: '您好',
      reminderMsgUpcoming: '温馨提醒您，您的贷款账单将在以下时间后到期：',
      reminderMsgToday: '温馨提醒您，您的贷款账单将于今天到期',
      reminderMsgOverdue: '通知您，您的贷款账单已逾期：',
      reminderMsgDueDate: '到期日期',
      reminderMsgRemaining: '剩余金额',
      reminderMsgMethod: '支付方式',
      reminderMsgAccount: '收款账户',
      reminderMsgClosing: '感谢您的配合。',
      statusOptions: { active: '进行中', dueSoon: '即将到期', paid: '已结清' },
      methods: { transfer: '银行转账', ewallet: '电子钱包', cash: '现金', flexible: '灵活' },
      contract: {
        docTitleWithCollateral: '个人借款及担保协议',
        docTitleNoCollateral: '个人借款协议',
        introPrefix: '签约星期：',
        introDateWord: '签约日期：',
        introTxLabel: '交易编号',
        introSuffix: '甲乙双方经友好协商，达成如下个人借款协议：',
        party1Title: '甲方（出借人 / 债权人）',
        party2Title: '乙方（借款人 / 债务人）',
        fieldName: '姓名',
        fieldId: '身份证件号',
        fieldAddress: '详细地址',
        fieldPhone: '联系电话 / 紧急联系',
        pasal1Title: '第一条 借款本金与报酬/利息',
        p1_1: '借款本金金额：',
        p1_2: '资金发放日期：',
        p1_3: '最终到期还款日：',
        p1_4: '借款期限 / 分期数：',
        p1_4_installment: '个月（自放款日起按月分期偿还）。',
        p1_4_single: '自放款日起至最终到期日止共计 1 个周期一次性清偿。',
        p1_5: '还款宽限期：到期日次日起 1 个自然日。',
        p1_6: '逾期滞纳金自宽限期届满次日（到期日后第 2 天）起开始计算。',
        p1_7: '双方约定的报酬 / 利息比例：',
        p1_8: '双方约定的报酬或利息属于乙方对甲方的法定义务，乙方须按约定的金额、比例及时间足额支付。',
        pasal2Title: '第二条 逾期滞纳金',
        p2_intro: '滞纳金统一按初始借款本金计算（非按剩余未还余额计算），且不采用复利计息。',
        p2_tierA_title: 'A. 30万 – 1,099万9,999 等值档（A档）',
        p2_tierA_1: '宽限期后逾期第 1 至 28 天：固定收取初始本金 5% 的滞纳金。',
        p2_tierA_2: '自逾期第 29 天起：每满 28 天追加收取初始本金 2.5% 的滞纳金。',
        p2_tierA_3: '累计滞纳金最高不超过初始借款本金的 32.5%。',
        p2_tierB_title: 'B. 1,100万 – 5,000万 等值档（B档）',
        p2_tierB_1: '每逾期 28 天按初始借款本金的 2.71% 计算滞纳金。',
        p2_tierB_2: '按年上限 32.5% 均分为 12 个周期计算。',
        p2_tierB_3: '累计滞纳金最高不超过初始借款本金的 32.5%。',
        p2_micro_title: '小额微型借款滞纳金规定 (10万 – 50万等值)',
        p2_micro_1: '宽限期后逾期第 1 至 28 天：固定收取初始本金 5% 的滞纳金。',
        p2_micro_2: '自逾期第 29 天起：每满 28 天追加收取初始本金 2.5% 的滞纳金。',
        p2_micro_3: '累计滞纳金最高不超过初始借款本金的 32.5%。',
        p2_schemeNote: '本协议适用的滞纳金方案：',
        p2_schemeAuto: '自动阶梯制（标准合同规则）',
        p2_schemeManual: '手动指定百分比',
        p2_schemeMicro: '小额微型借款专享方案 (10万–50万等值)',
        pasal3TitleWith: '第三条 担保 / 抵押条款',
        p3_with_1: '本笔借款附带经甲乙双方共同认可公允价值及规格的担保物。',
        p3_with_2: '登记担保物详情：',
        p3_with_3: '乙方保证所提供的担保物系乙方合法所有（或已取得合法所有权人书面同意），且不存在任何权属争议或第三方权利负担。',
        p3_with_4: '担保物照片及明细附于本协议第 2 页与第 4 页，作为本协议不可分割的组成部分。',
        pasal3TitleWithout: '第三条 无担保个人借款条款',
        p3_without_1: '本笔借款基于甲乙双方之间的个人信用与信任达成，不设任何实物抵押或财产担保（无担保个人借款）。',
        p3_without_2: '乙方对按期全额偿还借款本金、约定报酬/利息及可能产生的逾期滞纳金承担完全的个人清偿责任。',
        p3_without_3: '若乙方未能按约履行还款义务，须依法以其个人财产承担民事清偿责任。',
        pasal4TitleWith: '第四条 违约及担保物处置',
        p4_with_1: '若乙方超过宽限期仍未按时付款，甲方有权以口头或书面形式发出催收通知。',
        p4_with_2: '乙方仍有义务清偿所有已到期的应付款项，包括剩余借款本金、双方约定的报酬/利息，以及依据第二条规定产生的逾期滞纳金。',
        p4_with_3: '特别是针对借款期限为 1（一）个月的借款，若乙方在超过到期日及宽限期后仍未结清，其还款义务依然有效，双方可通过协商或依法定程序予以解决。',
        p4_with_4: '若连续拖欠满 2（两）个月，双方同意通过友好协商并依法定程序变卖处置担保物以解决债务。',
        p4_with_5: '变卖担保物所得款项用于清偿剩余借款本金、约定的报酬/利息、合法产生的逾期滞纳金以及合理的处置销售费用。',
        p4_with_6: '清偿全部债务后若变卖款项仍有结余，余款必须退还给乙方；反之，若变卖所得不足以清偿全部债务，剩余未清偿部分仍由乙方继续承担责任。',
        p4_with_7: '未经合法的权利转让协议或依法定程序执行，担保物不会自动归属甲方所有。',
        pasal4TitleWithout: '第四条 违约及债务清偿解决',
        p4_without_1: '若乙方超过宽限期仍未按时付款，甲方有权以口头或书面形式发出催收通知。',
        p4_without_2: '乙方必须清偿所有已到期的应付款项，包括剩余借款本金以及依据第二条规定产生的逾期滞纳金。',
        p4_without_3: '特别是针对借款期限为 1（一）个月的借款，若乙方在超过到期日及宽限期后仍未结清，乙方仍有义务按照本协议规定全额清偿剩余借款本金及相应逾期滞纳金。',
        p4_without_4: '若连续拖欠满 2（两）个月，双方应进行协商，制定书面分期还款计划（债务重组）或以友好和解方式清偿债务。',
        p4_without_5: '若协商未能达成一致，甲方有权依据现行法律法规提起民事法律诉讼，并将本协议书及所附证明材料作为合法证据使用。',
        pasal5Title: '第五条 签署与生效',
        p5_1: '甲乙双方确认已完整阅读、充分理解并自愿同意本协议全部条款，不存在任何胁迫情形。',
        p5_2: '本协议经双方在应用程序内电子签署，或打印后亲笔签名并加盖指纹印章即具完全法律效力。',
        p5_3: '所附交易摘要、还款记录、分期模拟表及照片证据页均与本协议具有同等法律效力。',
        placeDateLabel: '签署地点 / 日期：',
        signParty1: '甲方（出借人 / 债权人）',
        signParty2: '乙方（借款人 / 债务人）',
        page3Header: '附件：1 – 12 个月分期模拟及滞纳金参考表',
        page3PrincipalBadge: '本金',
        page3StampTitle: '实际还款时间戳及逾期状态审计记录',
        page3PenaltyRefTitle: '合同滞纳金参考（第二条）— 1 天宽限期',
        page3NoHistoryNote: '暂无还款时间戳记录。滞纳金自到期日后第 2 天起按初始本金单利计算。',
        page3NoteTitle: '分期与滞纳金计算说明：',
        page3NoteBody: '以上模拟表按合同实际约定的报酬/利息比例及初始本金计算；逾期滞纳金依据第二条在 1 天宽限期后生效。',
        tenorLabel: '期数',
        monthShort: '个月',
        activeTag: '当前方案',
        tenorPrincipal: '借款本金',
        tenorTotal: '还款总额',
        tenorInstallment: '每月分期额',
        tenorPenaltyHint: '逾期滞纳金（第2至28天）：',
        tenorMaxHint: '合同上限：',
        tenorNoPenaltyHint: '滞纳金方案：免自动滞纳金（本金低于下限或手动0%）',
        page4Header: '附件：债务人身份核验及佐证照片档案',
        page4SubBadge: '标准打印规格 4x6 & 2R (7项)',
        page4Sec1Title: '一、债务人身份核验照片（标准证件照尺寸 4cm × 6cm）',
        page4Sec2Title: '二、担保物 / 抵押品照片（2R 尺寸 6cm × 9cm）',
        page4Sec3Title: '三、其他补充佐证照片 / ETC（2R 尺寸 6cm × 9cm）',
        photoSlotIdDebtor: '债务人身份证件照 (4x6)',
        photoSlotSelfieDebtor: '债务人本人正面照 (4x6)',
        photoSlotSelfieIdDebtor: '债务人手持证件核验照 (4x6)',
        photoSlotCollateral1: '担保物 / 抵押品照片 1 (2R)',
        photoSlotCollateral2: '担保物 / 抵押品照片 2 (2R)',
        photoSlotHandover1: '资金交付 / 转账凭证 1 (2R)',
        photoSlotHandover2: '收据 / 交接证明 2 (2R)',
        photoSlotEtc1: '补充佐证材料 / Etc 1 (2R)',
        photoSlotEtc2: '补充佐证材料 / Etc 2 (2R)',
        photoEmptyHint: '请粘贴 / 附着实体照片'
      }
    }
  };
  const t = translations[language] || translations['id'];

  const currenciesList = [
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

  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('wgen_debt_categories');
    return saved ? JSON.parse(saved) : ['Pribadi', 'Bisnis', 'Keluarga'];
  });

  const [loanTypes, setLoanTypes] = useState(() => {
    const saved = localStorage.getItem('wgen_loan_types');
    return saved ? JSON.parse(saved) : ['Cash Advance', 'Pinjaman Barang', 'Modal Usaha', 'Darurat'];
  });

  const [debts, setDebts] = useState(() => {
    try {
      const saved = localStorage.getItem('wgen_debts_data');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [editingDebtData, setEditingDebtData] = useState(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);

  // State Modal Quick Pay
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedDebtForPay, setSelectedDebtForPay] = useState(null);
  const [payCustomAmount, setPayCustomAmount] = useState('');
  const [payTxMethodKey, setPayTxMethodKey] = useState('transfer');
  const [payCustomDate, setPayCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [payCustomTime, setPayCustomTime] = useState(new Date().toTimeString().slice(0, 5));

  const [newCatName, setNewCatName] = useState('');
  const [newTypeName, setNewTypeName] = useState('');

  const [approvedApplicationId, setApprovedApplicationId] = useState(null);
  const markQrAppApprovedRef = useRef(null);
  const [toastInfo, setToastInfo] = useState(null);

  const showToast = (message, type = 'success') => {
    setToastInfo({ message, type });
    setTimeout(() => {
      setToastInfo((prev) => (prev && prev.message === message ? null : prev));
    }, 3500);
  };

  // Sinkronkan laporan transfer cicilan terverifikasi dari QrLoanHub ke kartu piutang lokal & Turso
  const handleApplyVerifiedTransferToDebt = async (report) => {
    const paidNominal = Number(report.amount) || 0;
    const instNumber = Number(report.installmentNumber) || 1;

    const normalizedReportPhone = String(report.borrowerPhone || report.borrower_phone || '').replace(/\D/g, '');
    const normalizedReportName = String(report.borrowerName || report.borrower_name || '').trim().toLowerCase();

    const targetDebt =
      debts.find(
        (d) => String(d.qrApplicationId || '') === String(report.applicationId)
      ) ||
      debts.find((d) => {
        if (d.statusKey === 'paid') return false;
        const debtPhone = String(d.borrowerPhone || '').replace(/\D/g, '');
        const debtName = String(d.name || '').trim().toLowerCase();
        const phoneMatch =
          normalizedReportPhone &&
          debtPhone &&
          (debtPhone.endsWith(normalizedReportPhone.slice(-9)) ||
            normalizedReportPhone.endsWith(debtPhone.slice(-9)));
        return phoneMatch || (normalizedReportName && debtName === normalizedReportName);
      });

    if (targetDebt && paidNominal > 0) {
      const nowIso = new Date().toISOString();
      const todayStr = formatLocalDateStr(new Date());
      const prevPaid = Number(targetDebt.totalPaidAmount || 0);
      const totalBill = Number(targetDebt.totalAmount || targetDebt.amount || 0);
      const nextPaid = prevPaid + paidNominal;
      const isNowPaid = totalBill > 0 && nextPaid >= totalBill;

      const prevInst = Number(targetDebt.paidInstallments || 0);
      const maxInst = Number(targetDebt.installmentCount || 1);
      const nextInst = targetDebt.isInstallment
        ? isNowPaid
          ? maxInst
          : Math.min(maxInst, Math.max(prevInst + 1, instNumber))
        : isNowPaid
        ? 1
        : 0;

      const newPaymentEntry = {
        id: Date.now(),
        timestamp: `${todayStr} ${new Date().toTimeString().slice(0, 5)}`,
        amount: paidNominal,
        methodKey: 'transfer',
        termIndex: instNumber,
        isOneTerm: true,
        lateFeeCharged: 0,
        daysLate: 0
      };

      const updatedHistory = [
        newPaymentEntry,
        ...(Array.isArray(targetDebt.paymentHistory) ? targetDebt.paymentHistory : [])
      ];

      const updatedDebt = {
        ...targetDebt,
        qrApplicationId: targetDebt.qrApplicationId || String(report.applicationId),
        totalPaidAmount: nextPaid,
        paidInstallments: nextInst,
        statusKey: isNowPaid ? 'paid' : targetDebt.statusKey,
        paymentHistory: updatedHistory,
        updatedAt: nowIso
      };

      const nextDebts = debts.map((item) => (String(item.id) === String(targetDebt.id) ? updatedDebt : item));
      setDebts(nextDebts);

      try {
        localStorage.setItem('wgen_debts_data', JSON.stringify(nextDebts));
      } catch (storageErr) {
        console.warn('Storage quota warning:', storageErr);
      }

      try {
        const userId = auth?.currentUser?.uid || localStorage.getItem('wgen_last_uid') || 'wgen_user';
        await turso.execute({
          sql: `UPDATE debts SET 
            qr_application_id = ?, total_paid_amount = ?, paid_installments = ?, status_key = ?, payment_history = ?, updated_at = ? 
            WHERE id = ? AND user_id = ?`,
          args: [
            updatedDebt.qrApplicationId,
            updatedDebt.totalPaidAmount,
            updatedDebt.paidInstallments,
            updatedDebt.statusKey,
            JSON.stringify(updatedDebt.paymentHistory),
            nowIso,
            String(updatedDebt.id),
            userId
          ]
        });
      } catch (err) {
        console.warn('Offline Sync Transfer:', err.message);
      }
    }

    return targetDebt;
  };

  // Mengisi form DebtManager saat pengajuan dari QrLoanHub disetujui (ACC)
  const handleApproveApplication = (app, qrLinkData = null) => {
    const todayStr = formatLocalDateStr(new Date());
    const months = Number(app.tenor_months) || 1;
    const dueObj = addMonthsSafely(todayStr, months);
    const dueStr = dueObj ? formatLocalDateStr(dueObj) : '';

    const appliedReward =
      app.reward_percent !== undefined && app.reward_percent !== null && app.reward_percent !== ''
        ? Number(app.reward_percent)
        : Number(app.has_collateral) === 1
        ? 12.5
        : 20;

    const isMicroApp =
      Number(app.has_collateral) !== 1 &&
      (app.currency || 'IDR') === 'IDR' &&
      Number(app.requested_amount || 0) <= 500000;

    const savedAccountInfo =
      qrLinkData?.payment_account_info ||
      localStorage.getItem('wgen_default_payment_account') ||
      debts.find((d) => d.paymentAccountInfo)?.paymentAccountInfo ||
      '';

    const savedMethodKey =
      qrLinkData?.payment_method_key ||
      localStorage.getItem('wgen_default_payment_method') ||
      'transfer';

    const finalPrincipalAmount =
      app.borrower_counter_amount !== undefined &&
      app.borrower_counter_amount !== null &&
      Number(app.borrower_counter_amount) > 0
        ? Number(app.borrower_counter_amount)
        : app.counter_principal_amount !== undefined &&
          app.counter_principal_amount !== null &&
          Number(app.counter_principal_amount) > 0
        ? Number(app.counter_principal_amount)
        : Number(app.requested_amount || '');

    setEditingDebtData({
      id: null,
      qrApplicationId: app.id,
      name: app.borrower_name || '',
      lenderName:
        qrLinkData?.lender_name ||
        auth?.currentUser?.displayName ||
        localStorage.getItem('wgen_username') ||
        '',
      debtorIdNo: app.debtor_id || '',
      debtorAddress: app.debtor_address || '',
      borrowerPhone: app.borrower_phone || '',
      emergencyPhone: app.emergency_phone || '',
      currency: app.currency || managerCurrency || 'IDR',
      principalAmount: finalPrincipalAmount || '',
      bonusPercent: appliedReward,
      bonusType: 'bonus',
      lateFeeMode: isMicroApp ? 'micro' : 'auto',
      paymentMethodKey: savedMethodKey,
      paymentAccountInfo: savedAccountInfo,
      startDate: todayStr,
      dueDate: dueStr,
      isInstallment: Number(app.is_installment) === 1,
      installmentCount: months,
      paidInstallments: 0,
      collateral: Number(app.has_collateral) === 1,
      collateralDesc: app.collateral_desc || '',
      photoIdDebtor: app.photo_id || '',
      photoSelfieDebtor: app.photo_selfie || '',
      photoSelfieIdDebtor: app.photo_selfie_id || '',
      photoCollateral1: app.photo_collateral_1 || '',
      photoCollateral2: app.photo_collateral_2 || '',
      debtorFingerprint: app.debtor_fingerprint || app.debtorFingerprint || '',
      debtorSignature: app.debtor_signature || app.debtorSignature || ''
    });

    setApprovedApplicationId(app.id);
    setIsDebtModalOpen(true);
  };

  const addMonthsSafely = (dateStr, monthsToAdd) => {
    const base = new Date(`${dateStr}T00:00:00`);
    if (isNaN(base.getTime())) return null;
    const origDay = base.getDate();
    base.setMonth(base.getMonth() + monthsToAdd);
    if (base.getDate() < origDay) {
      base.setDate(0);
    }
    return base;
  };

  const formatLocalDateStr = (dateObj) => {
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

 // Ekstrak nama Kota / Prefektur / Provinsi dari alamat seluruh negara (ID, JP, EN, AR, CN)
  const extractCityFromAddress = (address) => {
    if (!address || typeof address !== 'string') return '';
    const cleaned = address.trim();
    if (!cleaned) return '';

    // 1. Format eksplisit Indonesia: Kota X / Kab. X
    const idMatch = cleaned.match(/\b(?:Kota|Kabupaten|Kab\.?)\s+([A-Za-z\s]+?)(?=,|$|\.|Kode\s*Pos|\d)/i);
    if (idMatch && idMatch[1]) {
      const prefix = /kota/i.test(idMatch[0]) ? 'Kota ' : 'Kab. ';
      return `${prefix}${idMatch[1].trim()}`;
    }

    // 2. Format Jepang / Mandarin: 東京都, 大阪府, 京都府, 北海道, 横浜市, 北京市, 上海市
    const cjkMatch = cleaned.match(/([^\s,、0-9０-９]{2,6}[都道府県市区县])/);
    if (cjkMatch && cjkMatch[1]) {
      return cjkMatch[1];
    }

    // 3. Format koma internasional (misal: "Shibuya, Tokyo, Japan" atau "123 Main St, New York, NY")
    const parts = cleaned
      .split(/[,،、]/)
      .map((s) => s.replace(/\b\d{3,}[-\s]?\d*\b/g, '').trim())
      .filter(Boolean);

    if (parts.length >= 3) {
      return parts[parts.length - 2];
    }
    if (parts.length === 2) {
      return parts[0].length <= 25 ? parts[0] : parts[1];
    }

    // 4. Input satu baris singkat langsung berupa nama kota (misal: "Tokyo", "London", "Jakarta", "الرياض")
    if (parts.length === 1 && parts[0].length <= 35) {
      return parts[0];
    }

    return '';
  };

  // Fungsi Perhitungan Denda Sesuai Aturan Micro, Tier A & Tier B (Total Maks Sama: 32,5%)
  const computeTieredPenalty = (principal, daysLate, currencyCode = 'IDR', mode = 'auto', manualPct = 0) => {
    if (daysLate <= 0 || principal <= 0) {
      return { percent: 0, amount: 0, maxPercent: 0, tierLabel: '' };
    }

    if (mode === 'manual') {
      const basePct = Number(manualPct) || 0;
      if (basePct <= 0) return { percent: 0, amount: 0, maxPercent: 0, tierLabel: 'Manual' };
      const periods = Math.max(1, Math.ceil(daysLate / 28));
      const totalPct = Number((basePct * periods).toFixed(2));
      return {
        percent: totalPct,
        amount: Math.round(principal * (totalPct / 100)),
        maxPercent: 100,
        tierLabel: 'Manual'
      };
    }

    const cleanCurr = (currencyCode || 'IDR').toUpperCase();
    const equivalentIdr = cleanCurr === 'IDR'
      ? principal
      : convertCurrencyDynamic(principal, cleanCurr, 'IDR', liveRates);

    const minIdrThreshold = mode === 'micro' ? 100000 : 300000;
    if (equivalentIdr < minIdrThreshold) {
      return {
        percent: 0,
        amount: 0,
        maxPercent: 0,
        tierLabel: mode === 'micro' ? 'Below Micro' : 'Below Tier A'
      };
    }

    if (equivalentIdr >= 11000000) {
      const periods = Math.min(12, Math.max(1, Math.ceil(daysLate / 28)));
      const cappedPct = Math.min(Number((periods * 2.71).toFixed(2)), 32.5);
      return {
        percent: cappedPct,
        amount: Math.round(principal * (cappedPct / 100)),
        maxPercent: 32.5,
        tierLabel: 'Tier B'
      };
    }

    const activeTierLabel = mode === 'micro' ? 'Micro' : 'Tier A';

    if (daysLate <= 28) {
      return {
        percent: 5,
        amount: Math.round(principal * 0.05),
        maxPercent: 32.5,
        tierLabel: activeTierLabel
      };
    } else {
      const extraDays = daysLate - 28;
      const extraPeriods = Math.min(11, Math.ceil(extraDays / 28));
      const cappedPct = Math.min(Number((5 + extraPeriods * 2.5).toFixed(2)), 32.5);
      return {
        percent: cappedPct,
        amount: Math.round(principal * (cappedPct / 100)),
        maxPercent: 32.5,
        tierLabel: activeTierLabel
      };
    }
  };

  // Helper: Mendapatkan tanggal jatuh tempo termin ke-N (1-based)
  const getTermDueDate = (debt, termIndex) => {
    const totalTerms = Number(debt.installmentCount) || 1;
    if (debt.isInstallment && debt.startDate && totalTerms > 1) {
      if (termIndex === totalTerms && debt.dueDate) {
        return new Date(`${debt.dueDate}T00:00:00`);
      }
      return addMonthsSafely(debt.startDate, termIndex);
    }
    if (debt.dueDate) {
      return new Date(`${debt.dueDate}T00:00:00`);
    }
    return null;
  };

  // Hitung keterlambatan dan denda berdasarkan tanggal referensi (tanggal bayar atau hari ini)
  const calculateLateStatus = (debt, referenceDateStr = null) => {
    if (!debt) {
      return {
        isLate: false,
        daysLate: 0,
        activeDaysLate: 0,
        pendingLateFee: 0,
        lateFeeAmount: 0,
        effectiveLatePercent: 0,
        effectiveTotal: 0
      };
    }

    const baseAmount = Number(debt.amount) || 0;
    const principal = Number(debt.principalAmount) || baseAmount;
    const penaltyMode = debt.lateFeeMode || (Number(debt.lateFeePercent) > 0 ? 'manual' : 'auto');
    const manualPct = Number(debt.lateFeePercent) || 0;
    const dCurr = debt.currency || managerCurrency;

    const recordedLateFee = (debt.paymentHistory || []).reduce((sum, log) => {
      return sum + (Number(log.lateFeeCharged) || 0);
    }, 0);

    let pendingLateFee = 0;
    let activeDaysLate = 0;

    const isAlreadyPaidOff = debt.statusKey === 'paid' && !referenceDateStr;
    const evalDateStr = referenceDateStr || formatLocalDateStr(new Date());
    const evalDate = new Date(`${evalDateStr}T00:00:00`);

    if (!isAlreadyPaidOff && !isNaN(evalDate.getTime())) {
      const totalTerms = debt.isInstallment ? (Number(debt.installmentCount) || 1) : 1;
      const paidTermsCount = Math.floor(Number(debt.paidInstallments) || 0);
      const currentTermIndex = paidTermsCount + 1;

      if (currentTermIndex <= totalTerms) {
        const termDue = getTermDueDate(debt, currentTermIndex);

        if (termDue && !isNaN(termDue.getTime())) {
          const graceDeadline = new Date(termDue);
          graceDeadline.setDate(graceDeadline.getDate() + 1);

          if (evalDate > graceDeadline) {
            activeDaysLate = Math.floor((evalDate.getTime() - graceDeadline.getTime()) / (1000 * 60 * 60 * 24));
            const penaltyCalc = computeTieredPenalty(principal, activeDaysLate, dCurr, penaltyMode, manualPct);

            const alreadyChargedForCurrentTerm = (debt.paymentHistory || []).reduce((sum, log) => {
              return log.termIndex === currentTermIndex ? sum + (Number(log.lateFeeCharged) || 0) : sum;
            }, 0);

            let termPenalty = Math.max(0, penaltyCalc.amount - alreadyChargedForCurrentTerm);

            if (penaltyMode === 'auto' && penaltyCalc.maxPercent > 0) {
              const maxCapAmount = Math.round(principal * (penaltyCalc.maxPercent / 100));
              const remainingCap = Math.max(0, maxCapAmount - recordedLateFee);
              termPenalty = Math.min(termPenalty, remainingCap);
            }

            pendingLateFee = termPenalty;
          }
        }
      }
    }

    const totalLateFee = recordedLateFee + pendingLateFee;
    const isLate = activeDaysLate > 0 || totalLateFee > 0;
    const effectiveLatePercent = principal > 0 ? Number(((totalLateFee / principal) * 100).toFixed(2)) : 0;

    return {
      isLate,
      daysLate: activeDaysLate,
      activeDaysLate,
      pendingLateFee,
      lateFeeAmount: totalLateFee,
      effectiveLatePercent,
      effectiveTotal: baseAmount + totalLateFee
    };
  };

  // Sinkronkan banner pengingat dengan aturan Grace Period 1 Hari
  const getDueReminderStatus = (debt, lateInfo, isFullyPaid) => {
    if (!debt || isFullyPaid) return null;

    const totalTerms = debt.isInstallment ? (Number(debt.installmentCount) || 1) : 1;
    const paidTermsCount = Math.floor(Number(debt.paidInstallments) || 0);
    const targetTermIndex = paidTermsCount + 1;
    if (targetTermIndex > totalTerms) return null;

    const targetDueDate = getTermDueDate(debt, targetTermIndex);
    if (!targetDueDate || isNaN(targetDueDate.getTime())) return null;

    const todayStr = formatLocalDateStr(new Date());
    const today = new Date(`${todayStr}T00:00:00`);
    const diffDays = Math.round((targetDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const targetDueStr = formatLocalDateStr(targetDueDate);

    const reminderMilestones = [7, 5, 3, 1, 0];
    if (reminderMilestones.includes(diffDays)) {
      return {
        type: diffDays === 0 ? 'today' : 'upcoming',
        daysLeft: diffDays,
        targetDueStr
      };
    }

    if (diffDays === -1) {
      return {
        type: 'today',
        daysLeft: 0,
        targetDueStr
      };
    }

    if (lateInfo.activeDaysLate > 0) {
      return {
        type: 'overdue',
        daysOverdue: lateInfo.activeDaysLate,
        targetDueStr
      };
    }

    return null;
  };

  const handleCopyReminder = async (debt, reminderInfo, effectiveTotalAmount) => {
    const dCurr = debt.currency || managerCurrency;
    const dSym = getCurrencySymbolDynamic(dCurr);
    const remainingAmt = Math.max(effectiveTotalAmount - (debt.totalPaidAmount || 0), 0);
    const methodText = t.methods[debt.paymentMethodKey] || debt.paymentMethod || t.methods.transfer;

    let statusSentence = '';
    if (reminderInfo.type === 'upcoming') {
      statusSentence = `${t.reminderMsgIntro} ${debt.name}, ${t.reminderMsgUpcoming} ${reminderInfo.daysLeft} ${t.reminderDaysLeft}.`;
    } else if (reminderInfo.type === 'today') {
      statusSentence = `${t.reminderMsgIntro} ${debt.name}, ${t.reminderMsgToday}.`;
    } else {
      const overdueCount = reminderInfo.daysOverdue || 1;
      statusSentence = `${t.reminderMsgIntro} ${debt.name}, ${t.reminderMsgOverdue} ${overdueCount} ${t.daysLateText}${language === 'jp' ? '）' : '.'}`;
    }

    const lines = [
      statusSentence,
      `• ${t.reminderMsgDueDate}: ${reminderInfo.targetDueStr}`,
      `• ${t.reminderMsgRemaining}: ${dSym} ${remainingAmt.toLocaleString()} (${dCurr})`,
      `• ${t.reminderMsgMethod}: ${methodText}`
    ];

    if (debt.paymentAccountInfo && debt.paymentMethodKey !== 'cash') {
      lines.push(`• ${t.reminderMsgAccount}: ${debt.paymentAccountInfo}`);
    }

    lines.push(t.reminderMsgClosing);
    const messageText = lines.join('\n');

    try {
      await navigator.clipboard.writeText(messageText);
      setCopiedDebtId(debt.id);
      setTimeout(() => setCopiedDebtId(null), 2500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = messageText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedDebtId(debt.id);
      setTimeout(() => setCopiedDebtId(null), 2500);
    }
  };

  const formatHistoryLogSummary = (log, currencyCode, debt = null) => {
    const dSym = getCurrencySymbolDynamic(currencyCode || managerCurrency);
    const parts = [];

    if (log.isInitial) {
      parts.push(`${t.initialPaidNote} (${log.termCount || 0} ${t.termText})`);
    } else if (debt && debt.isInstallment && log.termIndex) {
      const dueObj = getTermDueDate(debt, log.termIndex);
      const dueStr = formatLocalDateStr(dueObj);
      parts.push(`${t.termText} #${log.termIndex}${dueStr ? ` (${t.dueDateShort}: ${dueStr})` : ''}`);
    } else if (log.isOneTerm) {
      parts.push(`+1 ${t.termText}`);
    }

    if (log.methodKey) {
      parts.push(t.methods[log.methodKey] || log.methodKey);
    }

    const lateFee = Number(log.lateFeeCharged) || 0;
    const daysLate = Number(log.daysLate) || 0;
    if (lateFee > 0 || daysLate > 0) {
      const principalPaid = Math.max((Number(log.amount) || 0) - lateFee, 0);
      const breakdown = `${t.principalShort}: ${dSym} ${principalPaid.toLocaleString()} + ${t.penaltyShort}: ${dSym} ${lateFee.toLocaleString()}${daysLate > 0 ? ` (${t.lateStatusBadge} ${daysLate} ${t.daysLateText})` : ''}`;
      parts.push(breakdown);
    }

    return parts.join(' • ');
  };

  const ensureTursoDebtsSchema = async () => {
    const alterStatements = [
      `ALTER TABLE debts ADD COLUMN lender_name TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN debtor_id_no TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN creditor_id_no TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN debtor_address TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN principal_amount REAL DEFAULT 0`,
      `ALTER TABLE debts ADD COLUMN bonus_percent REAL DEFAULT 0`,
      `ALTER TABLE debts ADD COLUMN bonus_type TEXT DEFAULT 'bonus'`,
      `ALTER TABLE debts ADD COLUMN late_fee_mode TEXT DEFAULT 'auto'`,
      `ALTER TABLE debts ADD COLUMN late_fee_percent REAL DEFAULT 0`,
      `ALTER TABLE debts ADD COLUMN payment_account_info TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN payment_history TEXT DEFAULT '[]'`,
      `ALTER TABLE debts ADD COLUMN creditor_fingerprint TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN creditor_signature TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN debtor_fingerprint TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN debtor_signature TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN updated_at TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN photo_id_debtor TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN photo_selfie_debtor TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN photo_selfie_id_debtor TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN photo_collateral_1 TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN photo_collateral_2 TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN photo_etc1 TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN photo_etc2 TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN qr_application_id TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN custom_clauses TEXT DEFAULT '[]'`,
      `ALTER TABLE debts ADD COLUMN uploaded_contract_text TEXT DEFAULT ''`,
      `ALTER TABLE debts ADD COLUMN uploaded_contract_file_name TEXT DEFAULT ''`
    ];
    for (const stmt of alterStatements) {
      try {
        await turso.execute(stmt);
      } catch {
        // Abaikan jika kolom sudah ada
      }
    }
  };

  useEffect(() => {
    fetchDebtsFromTurso();
    fetchLiveExchangeRates().then(rates => setLiveRates(rates)).catch(() => {});
  }, []);

  const fetchDebtsFromTurso = async () => {
    try {
      await ensureTursoDebtsSchema();
      const userId = auth?.currentUser?.uid || localStorage.getItem('wgen_last_uid') || "wgen_user";
      const res = await turso.execute({
        sql: `SELECT * FROM debts WHERE user_id = ? ORDER BY COALESCE(updated_at, created_at, id) DESC`,
        args: [userId]
      });

      const localSavedRaw = localStorage.getItem('wgen_debts_data');
      const localDebts = localSavedRaw ? JSON.parse(localSavedRaw) : [];

      if (res.rows && res.rows.length > 0) {
       const remoteFormatted = res.rows.map(row => ({
          id: String(row.id),
          qrApplicationId: row.qr_application_id || '',
          name: row.name,
          lenderName: row.lender_name || '',
          debtorIdNo: row.debtor_id_no || '',
          creditorIdNo: row.creditor_id_no || '',
          debtorAddress: row.debtor_address || '',
          category: row.category,
          type: row.type,
          principalAmount: Number(row.principal_amount) || 0,
          bonusPercent: Number(row.bonus_percent) || 0,
          bonusType: row.bonus_type || 'bonus',
          lateFeeMode: row.late_fee_mode || (Number(row.late_fee_percent) > 0 ? 'manual' : 'auto'),
          lateFeePercent: Number(row.late_fee_percent) || 0,
          amount: Number(row.amount) || 0,
          currency: row.currency,
          borrowerPhone: row.borrower_phone,
          emergencyPhone: row.emergency_phone,
          collateral: Boolean(row.collateral),
          collateralDesc: row.collateral_desc,
          startDate: row.start_date,
          dueDate: row.due_date,
          statusKey: row.status_key,
          image: row.image,
          creditorFingerprint: row.creditor_fingerprint || null,
          creditorSignature: row.creditor_signature || null,
          debtorFingerprint: row.debtor_fingerprint || null,
          debtorSignature: row.debtor_signature || null,
          photoIdDebtor: row.photo_id_debtor || '',
          photoSelfieDebtor: row.photo_selfie_debtor || '',
          photoSelfieIdDebtor: row.photo_selfie_id_debtor || '',
          photoCollateral1: row.photo_collateral_1 || '',
          photoCollateral2: row.photo_collateral_2 || '',
          photoEtc1: row.photo_etc1 || '',
          photoEtc2: row.photo_etc2 || '',
          isInstallment: Boolean(row.is_installment),
          installmentCount: Number(row.installment_count) || 1,
          paidInstallments: Number(row.paid_installments) || 0,
          totalPaidAmount: Number(row.total_paid_amount) || 0,
          installmentAmount: Number(row.installment_amount) || 0,
          paymentMethodKey: row.payment_method_key,
          paymentAccountInfo: row.payment_account_info || '',
          paymentHistory: row.payment_history ? JSON.parse(row.payment_history) : [],
          customClauses: (() => {
            try {
              return row.custom_clauses ? JSON.parse(row.custom_clauses) : [];
            } catch {
              return [];
            }
          })(),
          uploadedContractText: row.uploaded_contract_text || '',
          uploadedContractFileName: row.uploaded_contract_file_name || '',
          updatedAt: row.updated_at || ''
        }));
        const remoteMap = new Map(remoteFormatted.map(item => [String(item.id), item]));
        const unsyncedLocalItems = [];

        for (const localItem of localDebts) {
          const remoteItem = remoteMap.get(String(localItem.id));
          if (!remoteItem) {
            unsyncedLocalItems.push(localItem);
          } else if (localItem.updatedAt && (!remoteItem.updatedAt || localItem.updatedAt > remoteItem.updatedAt)) {
            remoteMap.set(String(localItem.id), localItem);
          }
        }

        const mergedDebts = [...unsyncedLocalItems, ...Array.from(remoteMap.values())];
        setDebts(mergedDebts);
        localStorage.setItem('wgen_debts_data', JSON.stringify(mergedDebts));
      } else if (localDebts.length > 0) {
        setDebts(localDebts);
      }
    } catch (err) {
      console.warn("Offline Mode: Menampilkan data pinjaman dari Cache LocalStorage", err.message);
    }
  };

  useEffect(() => {
    localStorage.setItem('wgen_debt_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('wgen_loan_types', JSON.stringify(loanTypes));
  }, [loanTypes]);

  useEffect(() => {
    try {
      localStorage.setItem('wgen_debts_data', JSON.stringify(debts));
    } catch (e) {
      console.warn("Gagal menyimpan ke localStorage:", e);
    }
  }, [debts]);

  const handleSaveDebt = async (formData) => {
    const {
      id: formDebtId,
      name, lenderName, debtorIdNo, creditorIdNo, debtorAddress,
      category, type, amount, bonusPercent, bonusType,
      lateFeeMode, lateFeePercent, debtCurrency,
      borrowerPhone, emergencyPhone, collateral, collateralDesc,
      startDate, dueDate, statusKey, image,
      creditorFingerprint, creditorSignature, debtorFingerprint, debtorSignature,
      photoIdDebtor, photoSelfieDebtor, photoSelfieIdDebtor,
      photoCollateral1, photoCollateral2, photoEtc1, photoEtc2,
      isInstallment, installmentCount, paidInstallments,
      paymentMethodKey, paymentAccountInfo,
      customClauses,
      uploadedContractFileName, uploadedContractText
    } = formData;

    if (!name || !amount) {
      alert(t.fillRequired);
      return;
    }

    const userId = auth?.currentUser?.uid || localStorage.getItem('wgen_last_uid') || "wgen_user";
    const principal = parseFloat(amount) || 0;
    const bonusPct = Math.min(Math.max(parseFloat(bonusPercent) || 0, 0), 20);
    const latePct = lateFeeMode === 'manual' ? (parseFloat(lateFeePercent) || 0) : 0;
    const totalAmt = principal + (principal * (bonusPct / 100));
    const totalInst = parseInt(installmentCount) || 1;
    const paidInst = parseInt(paidInstallments) || 0;

    const existingDebt = formDebtId
      ? debts.find((d) => String(d.id) === String(formDebtId))
      : null;

    const wasPaidBefore = existingDebt && (
      existingDebt.statusKey === 'paid' ||
      (existingDebt.totalPaidAmount || 0) >= (existingDebt.amount || 0)
    );
    const isReopeningFromPaid = Boolean(existingDebt && wasPaidBefore && statusKey !== 'paid');

    const isResettingSimulation = Boolean(
      existingDebt &&
      statusKey !== 'paid' &&
      (
        (isInstallment && paidInst === 0 && (Number(existingDebt.paidInstallments) > 0 || (existingDebt.totalPaidAmount || 0) > 0)) ||
        (!isInstallment && existingDebt.isInstallment)
      )
    );

    let finalPaidAmount = 0;
    let finalPaidInstallments = 0;

    if (statusKey === 'paid') {
      finalPaidAmount = totalAmt;
      finalPaidInstallments = isInstallment ? totalInst : 1;
    } else if (isResettingSimulation) {
      finalPaidInstallments = 0;
      finalPaidAmount = 0;
    } else if (isReopeningFromPaid) {
      if (isInstallment) {
        const safePaidTerms = paidInst >= totalInst ? 0 : paidInst;
        finalPaidInstallments = safePaidTerms;
        finalPaidAmount = Math.round((totalAmt / totalInst) * safePaidTerms);
      } else {
        finalPaidInstallments = 0;
        finalPaidAmount = 0;
      }
    } else if (existingDebt) {
      if (isInstallment) {
        const prevPaidInst = Number(existingDebt.paidInstallments) || 0;
        if (paidInst !== Math.round(prevPaidInst)) {
          finalPaidInstallments = Math.min(paidInst, totalInst);
          finalPaidAmount = Math.round((totalAmt / totalInst) * finalPaidInstallments);
        } else {
          finalPaidInstallments = prevPaidInst;
          finalPaidAmount = existingDebt.totalPaidAmount || 0;
        }
      } else {
        finalPaidInstallments = existingDebt.paidInstallments || 0;
        finalPaidAmount = existingDebt.totalPaidAmount || 0;
      }
    } else {
      finalPaidAmount = isInstallment ? Math.round((totalAmt / totalInst) * paidInst) : 0;
      finalPaidInstallments = isInstallment ? paidInst : 0;
    }

    let initialHistory = [];
    if (existingDebt) {
      const prevHistory = Array.isArray(existingDebt.paymentHistory) ? existingDebt.paymentHistory : [];
      if (isResettingSimulation) {
        initialHistory = [];
      } else if (isInstallment) {
        const targetTerms = Math.max(0, Math.floor(Number(finalPaidInstallments) || 0));
        if (targetTerms === 0) {
          initialHistory = [];
        } else if (prevHistory.length > targetTerms) {
          const chronological = [...prevHistory].reverse();
          initialHistory = chronological.slice(0, targetTerms).reverse();
        } else {
          initialHistory = [...prevHistory];
        }
      } else {
        initialHistory = statusKey !== 'paid' && wasPaidBefore ? [] : [...prevHistory];
      }
    } else if (paidInst > 0) {
      initialHistory = [{
        id: Date.now(),
        timestamp: `${startDate} ${new Date().toTimeString().slice(0, 5)}`,
        amount: finalPaidAmount,
        methodKey: paymentMethodKey,
        isInitial: true,
        termCount: paidInst
      }];
    }

    const isFullyPaid = statusKey === 'paid' || (finalPaidAmount >= totalAmt && totalAmt > 0);
    const finalStatusKey = isFullyPaid ? 'paid' : statusKey;
    const newDebtId = formDebtId ? String(formDebtId) : String(Date.now());
    const cleanedAccountInfo = paymentMethodKey === 'cash' ? '' : paymentAccountInfo;
    const selectedCategory = category || categories[0] || 'Pribadi';
    const nowIso = new Date().toISOString();

    if (cleanedAccountInfo) {
      localStorage.setItem('wgen_default_payment_account', cleanedAccountInfo);
      localStorage.setItem('wgen_default_payment_method', paymentMethodKey);
    }

    const debtData = {
      id: newDebtId,
      qrApplicationId: approvedApplicationId || existingDebt?.qrApplicationId || '',
      name,
      lenderName,
      debtorIdNo,
      creditorIdNo,
      debtorAddress,
      category: selectedCategory,
      type,
      principalAmount: principal,
      bonusPercent: bonusPct,
      bonusType,
      lateFeeMode,
      lateFeePercent: latePct,
      amount: totalAmt,
      currency: debtCurrency,
      borrowerPhone,
      emergencyPhone,
      collateral,
      collateralDesc,
      startDate,
      dueDate,
      statusKey: finalStatusKey,
      image,
      creditorFingerprint,
      creditorSignature,
      debtorFingerprint,
      debtorSignature,
      photoIdDebtor,
      photoSelfieDebtor,
      photoSelfieIdDebtor,
      photoCollateral1,
      photoCollateral2,
      photoEtc1,
      photoEtc2,
      isInstallment,
      installmentCount: isInstallment ? totalInst : 1,
      paidInstallments: finalPaidInstallments,
      totalPaidAmount: finalPaidAmount,
      installmentAmount: isInstallment ? Math.round(totalAmt / totalInst) : totalAmt,
      paymentMethodKey,
      paymentAccountInfo: cleanedAccountInfo,
      paymentHistory: initialHistory,
      updatedAt: nowIso,
      customClauses: Array.isArray(customClauses) ? customClauses : [],
      uploadedContractFileName: uploadedContractFileName || '',
      uploadedContractText: uploadedContractText || '',
    };

    let updatedDebts;
    if (formDebtId) {
      updatedDebts = debts.map(d => String(d.id) === String(formDebtId) ? debtData : d);
    } else {
      updatedDebts = [debtData, ...debts];
    }
    setDebts(updatedDebts);
    try {
      localStorage.setItem('wgen_debts_data', JSON.stringify(updatedDebts));
    } catch (storageErr) {
      console.warn("Storage quota warning:", storageErr);
    }

    setEditingDebtData(null);
    setIsDebtModalOpen(false);

    try {
      await ensureTursoDebtsSchema();
     await turso.execute({
        sql: `INSERT INTO debts (
          id, user_id, qr_application_id, name, lender_name, debtor_id_no, creditor_id_no, debtor_address, category, type, principal_amount, bonus_percent, bonus_type, late_fee_mode, late_fee_percent, amount, currency, 
          borrower_phone, emergency_phone, collateral, collateral_desc, start_date, due_date, 
          status_key, image, creditor_fingerprint, creditor_signature, debtor_fingerprint, debtor_signature,
          photo_id_debtor, photo_selfie_debtor, photo_selfie_id_debtor, photo_collateral_1, photo_collateral_2, photo_etc1, photo_etc2,
          is_installment, installment_count, paid_installments, total_paid_amount, 
          installment_amount, payment_method_key, payment_account_info, payment_history,
          custom_clauses, uploaded_contract_text, uploaded_contract_file_name,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET 
          qr_application_id=excluded.qr_application_id, name=excluded.name, lender_name=excluded.lender_name, debtor_id_no=excluded.debtor_id_no, creditor_id_no=excluded.creditor_id_no,
          debtor_address=excluded.debtor_address, category=excluded.category, type=excluded.type, principal_amount=excluded.principal_amount, bonus_percent=excluded.bonus_percent,
          bonus_type=excluded.bonus_type, late_fee_mode=excluded.late_fee_mode, late_fee_percent=excluded.late_fee_percent,
          amount=excluded.amount, currency=excluded.currency, borrower_phone=excluded.borrower_phone, 
          emergency_phone=excluded.emergency_phone, collateral=excluded.collateral, 
          collateral_desc=excluded.collateral_desc, start_date=excluded.start_date, 
          due_date=excluded.due_date, status_key=excluded.status_key, image=excluded.image,
          creditor_fingerprint=excluded.creditor_fingerprint, creditor_signature=excluded.creditor_signature,
          debtor_fingerprint=excluded.debtor_fingerprint, debtor_signature=excluded.debtor_signature,
          photo_id_debtor=excluded.photo_id_debtor, photo_selfie_debtor=excluded.photo_selfie_debtor,
          photo_selfie_id_debtor=excluded.photo_selfie_id_debtor, photo_collateral_1=excluded.photo_collateral_1,
          photo_collateral_2=excluded.photo_collateral_2, photo_etc1=excluded.photo_etc1, photo_etc2=excluded.photo_etc2,
          is_installment=excluded.is_installment, installment_count=excluded.installment_count, 
          paid_installments=excluded.paid_installments, total_paid_amount=excluded.total_paid_amount, 
          installment_amount=excluded.installment_amount, payment_method_key=excluded.payment_method_key, 
          payment_account_info=excluded.payment_account_info, payment_history=excluded.payment_history,
          custom_clauses=excluded.custom_clauses, uploaded_contract_text=excluded.uploaded_contract_text,
          uploaded_contract_file_name=excluded.uploaded_contract_file_name,
          updated_at=excluded.updated_at`,
        args: [
          newDebtId, userId, debtData.qrApplicationId, name, lenderName, debtorIdNo, creditorIdNo, debtorAddress, selectedCategory, type, principal, bonusPct, bonusType, lateFeeMode, latePct, totalAmt, debtCurrency,
          borrowerPhone, emergencyPhone, collateral ? 1 : 0, collateralDesc, startDate, dueDate,
          finalStatusKey, image, creditorFingerprint || '', creditorSignature || '', debtorFingerprint || '', debtorSignature || '',
          photoIdDebtor || '', photoSelfieDebtor || '', photoSelfieIdDebtor || '', photoCollateral1 || '', photoCollateral2 || '', photoEtc1 || '', photoEtc2 || '',
          isInstallment ? 1 : 0, totalInst, debtData.paidInstallments,
          finalPaidAmount, debtData.installmentAmount, paymentMethodKey, cleanedAccountInfo,
          JSON.stringify(initialHistory),
          JSON.stringify(debtData.customClauses), debtData.uploadedContractText, debtData.uploadedContractFileName,
          nowIso, nowIso
        ]
      });

      if (approvedApplicationId) {
        if (markQrAppApprovedRef.current) {
          await markQrAppApprovedRef.current(approvedApplicationId);
        }
        setApprovedApplicationId(null);
      }
    } catch (err) {
      console.warn("Offline Save: Tersimpan lokal, akan disinkron saat online", err.message);
    }
  };

  const handleEditDebt = (debt) => {
    setEditingDebtData(debt);
    setIsDebtModalOpen(true);
  };

  const handleDeleteDebt = async (id) => {
    if (window.confirm(t.confirmDelete)) {
      const updatedDebts = debts.filter(d => String(d.id) !== String(id));
      setDebts(updatedDebts);
      localStorage.setItem('wgen_debts_data', JSON.stringify(updatedDebts));

      try {
        const userId = auth?.currentUser?.uid || localStorage.getItem('wgen_last_uid') || "wgen_user";
        await turso.execute({
          sql: `DELETE FROM debts WHERE id = ? AND user_id = ?`,
          args: [String(id), userId]
        });
      } catch (err) {
        console.warn("Offline Delete: Dihapus lokal, akan disinkron saat online", err.message);
      }
    }
  };

  const openPayModal = (debt) => {
    setSelectedDebtForPay(debt);
    const todayStr = formatLocalDateStr(new Date());
    const lateInfo = calculateLateStatus(debt, todayStr);
    const remainingWithLate = Math.max(lateInfo.effectiveTotal - (debt.totalPaidAmount || 0), 0);

    const baseInstAmt = debt.installmentAmount || (debt.amount / (debt.installmentCount || 1));
    const instAmt = debt.isInstallment
      ? Math.min(baseInstAmt + (lateInfo.pendingLateFee || 0), remainingWithLate)
      : remainingWithLate;

    setPayCustomAmount(Math.round(instAmt).toString());
    setPayTxMethodKey(debt.paymentMethodKey || 'transfer');
    setPayCustomDate(todayStr);
    setPayCustomTime(new Date().toTimeString().slice(0, 5));
    setIsPayModalOpen(true);
  };

  const handleProcessPayment = async (mode) => {
    if (!selectedDebtForPay) return;

    const formattedTimestamp = `${payCustomDate} ${payCustomTime}`;
    const nowIso = new Date().toISOString();
    let updatedTargetDebt = null;

    const updatedDebts = debts.map(d => {
      if (String(d.id) === String(selectedDebtForPay.id)) {
        const lateInfoOnPayDate = calculateLateStatus(d, payCustomDate);
        const targetTotalWithLate = lateInfoOnPayDate.effectiveTotal;
        const currentTermIndex = Math.floor(Number(d.paidInstallments) || 0) + 1;
        const penaltyAddedThisTx = lateInfoOnPayDate.pendingLateFee || 0;

        let addAmt = 0;
        let addTerm = 0;

        if (mode === 'one_term') {
          const baseTermAmt = d.installmentAmount || (d.amount / (d.installmentCount || 1));
          addAmt = baseTermAmt + penaltyAddedThisTx;
          addTerm = 1;
        } else {
          addAmt = parseFloat(payCustomAmount) || 0;
          const safeInstAmt = (d.installmentAmount && d.installmentAmount > 0) ? d.installmentAmount : d.amount;
          const netPrincipalPaid = Math.max(addAmt - penaltyAddedThisTx, 0);
          addTerm = safeInstAmt > 0 ? (netPrincipalPaid / safeInstAmt) : 1;
        }

        const newTotalPaid = Math.min((d.totalPaidAmount || 0) + addAmt, targetTotalWithLate);
        const newPaidTerms = Math.min((d.paidInstallments || 0) + addTerm, d.installmentCount || 1);
        const isPaidOff = newTotalPaid >= targetTotalWithLate;

        const newHistoryLog = {
          id: Date.now(),
          timestamp: formattedTimestamp,
          amount: addAmt,
          methodKey: payTxMethodKey,
          termIndex: currentTermIndex,
          isOneTerm: mode === 'one_term',
          lateFeeCharged: penaltyAddedThisTx,
          daysLate: lateInfoOnPayDate.activeDaysLate || 0
        };

        updatedTargetDebt = {
          ...d,
          totalPaidAmount: newTotalPaid,
          paidInstallments: Number(newPaidTerms.toFixed(1)),
          statusKey: isPaidOff ? 'paid' : d.statusKey,
          paymentHistory: [newHistoryLog, ...(d.paymentHistory || [])],
          updatedAt: nowIso
        };
        return updatedTargetDebt;
      }
      return d;
    });

    setDebts(updatedDebts);
    localStorage.setItem('wgen_debts_data', JSON.stringify(updatedDebts));

    if (updatedTargetDebt) {
      try {
        const userId = auth?.currentUser?.uid || localStorage.getItem('wgen_last_uid') || "wgen_user";
        await turso.execute({
          sql: `UPDATE debts SET 
            total_paid_amount = ?, paid_installments = ?, status_key = ?, payment_history = ?, updated_at = ? 
            WHERE id = ? AND user_id = ?`,
          args: [
            updatedTargetDebt.totalPaidAmount,
            updatedTargetDebt.paidInstallments,
            updatedTargetDebt.statusKey,
            JSON.stringify(updatedTargetDebt.paymentHistory),
            nowIso,
            String(updatedTargetDebt.id),
            userId
          ]
        });
      } catch (err) {
        console.warn("Offline Payment: Tersimpan lokal, akan disinkron saat online", err.message);
      }
    }

    setIsPayModalOpen(false);
    setSelectedDebtForPay(null);
  };

  const handleUndoLastPayment = async (debt) => {
    const history = Array.isArray(debt.paymentHistory) ? debt.paymentHistory : [];
    if (history.length === 0) return;

    const lastTx = history[0];
    const remainingHistory = history.slice(1);
    const removedAmt = Number(lastTx.amount) || 0;
    const removedTerms = lastTx.isInitial
      ? (Number(lastTx.termCount) || 1)
      : (debt.isInstallment ? 1 : 0);

    const newTotalPaid = Math.max(0, (Number(debt.totalPaidAmount) || 0) - removedAmt);
    const newPaidInstallments = debt.isInstallment
      ? Math.max(0, Number(((Number(debt.paidInstallments) || 0) - removedTerms).toFixed(1)))
      : 0;
    const nowIso = new Date().toISOString();

    const updatedDebt = {
      ...debt,
      totalPaidAmount: newTotalPaid,
      paidInstallments: newPaidInstallments,
      statusKey: 'active',
      paymentHistory: remainingHistory,
      updatedAt: nowIso
    };

    const updatedDebts = debts.map((item) => (String(item.id) === String(debt.id) ? updatedDebt : item));
    setDebts(updatedDebts);
    try {
      localStorage.setItem('wgen_debts_data', JSON.stringify(updatedDebts));
    } catch (e) {
      console.warn("Storage warning:", e);
    }

    try {
      const userId = auth?.currentUser?.uid || localStorage.getItem('wgen_last_uid') || "wgen_user";
      await turso.execute({
        sql: `UPDATE debts SET 
          total_paid_amount = ?, paid_installments = ?, status_key = ?, payment_history = ?, updated_at = ? 
          WHERE id = ? AND user_id = ?`,
        args: [
          updatedDebt.totalPaidAmount,
          updatedDebt.paidInstallments,
          updatedDebt.statusKey,
          JSON.stringify(updatedDebt.paymentHistory),
          nowIso,
          String(updatedDebt.id),
          userId
        ]
      });
    } catch (err) {
      console.warn("Offline Undo: Tersimpan lokal, akan disinkron saat online", err.message);
    }
  };

  // Konversi & format batas nominal Tier A & Tier B secara real-time mengikuti mata uang Debt Manager
  const formatTierThreshold = (idrAmount, targetCurr) => {
    const cleanCurr = (targetCurr || 'IDR').toUpperCase();
    const sym = getCurrencySymbolDynamic(cleanCurr);

    const converted = cleanCurr === 'IDR'
      ? idrAmount
      : convertCurrencyDynamic(idrAmount, 'IDR', cleanCurr, liveRates);

    const safeNum = Number.isFinite(converted) ? converted : idrAmount;

    let formattedVal = '';
    if (['IDR', 'JPY', 'KRW', 'VND'].includes(cleanCurr)) {
      formattedVal = Math.round(safeNum).toLocaleString('en-US').replace(/,/g, '.');
    } else if (Math.abs(safeNum) < 10) {
      formattedVal = Number(safeNum.toFixed(2)).toLocaleString('en-US');
    } else {
      formattedVal = Math.round(safeNum).toLocaleString('en-US');
    }

    return `${sym} ${formattedVal}`;
  };

  const getDynamicTierTexts = (targetCurr) => {
    const cleanCurr = (targetCurr || 'IDR').toUpperCase();

    const aMin = formatTierThreshold(300000, cleanCurr);
    const aMax = formatTierThreshold(10999999, cleanCurr);
    const bMin = formatTierThreshold(11000000, cleanCurr);
    const bMax = formatTierThreshold(50000000, cleanCurr);

    const dynamicMap = {
      id: {
        tierATitle: `A. Pinjaman ${aMin} – ${aMax} (Tier A) [${cleanCurr}]`,
        tierA1: 'Keterlambatan hari ke-1 s.d. ke-28 (setelah grace period): denda tetap sebesar 5% dari pokok pinjaman.',
        tierA2: 'Mulai hari ke-29: tambahan denda sebesar 2,5% untuk setiap periode 28 hari berikutnya.',
        tierA3: 'Akumulasi denda maksimal adalah 32,5% dari pokok pinjaman.',
        tierBTitle: `B. Pinjaman ${bMin} – ${bMax} (Tier B) [${cleanCurr}]`,
        tierB1: 'Denda dihitung sebesar 2,71% dari pokok pinjaman untuk setiap periode 28 hari keterlambatan.',
        tierB2: 'Perhitungan mengacu pada 32,5% dibagi maksimal 12 periode.',
        tierB3: 'Akumulasi denda maksimal adalah 32,5% dari pokok pinjaman.'
      },
      jp: {
        tierATitle: `A. 元本 ${aMin} 〜 ${aMax} 相当（区分A・${cleanCurr}）`,
        tierA1: '延滞1日目〜28日目（猶予期間後）：貸付元本の5%を固定延滞金とする。',
        tierA2: '延滞29日目以降：28日経過するごとに貸付元本の2.5%を加算する。',
        tierA3: '延滞損害金の累積上限は貸付元本の32.5%とする。',
        tierBTitle: `B. 元本 ${bMin} 〜 ${bMax} 相当（区分B・${cleanCurr}）`,
        tierB1: '延滞28日ごとに貸付元本の2.71%を延滞損害金として算出する。',
        tierB2: '上記は年上限32.5%を12期間で按分した基準に基づく。',
        tierB3: '延滞損害金の累積上限は貸付元本の32.5%とする。'
      },
      en: {
        tierATitle: `A. Tier A Loans (${aMin} – ${aMax} • ${cleanCurr})`,
        tierA1: 'Days 1 to 28 overdue (after grace period): flat penalty of 5% of initial principal.',
        tierA2: 'From Day 29 onward: additional 2.5% penalty for every subsequent 28-day period.',
        tierA3: 'Maximum cumulative penalty is capped at 32.5% of the initial principal.',
        tierBTitle: `B. Tier B Loans (${bMin} – ${bMax} • ${cleanCurr})`,
        tierB1: 'Penalty of 2.71% of initial principal for every 28-day overdue period.',
        tierB2: 'Calculated as 32.5% divided across a maximum of 12 periods.',
        tierB3: 'Maximum cumulative penalty is capped at 32.5% of the initial principal.'
      },
      ar: {
        tierATitle: `أ. القروض من ${aMin} إلى ${aMax} (الفئة أ • ${cleanCurr})`,
        tierA1: 'التأخير من اليوم 1 إلى 28 (بعد فترة السماح): غرامة ثابتة 5% من أصل القرض.',
        tierA2: 'ابتداءً من اليوم 29: غرامة إضافية 2.5% عن كل فترة 28 يوماً تالية.',
        tierA3: 'الحد الأقصى لتراكم الغرامة هو 32.5% من أصل القرض.',
        tierBTitle: `ب. القروض من ${bMin} إلى ${bMax} (الفئة ب • ${cleanCurr})`,
        tierB1: 'تُحسب الغرامة بنسبة 2.71% من أصل القرض عن كل فترة تأخير مدتها 28 يوماً.',
        tierB2: 'يستند الحساب إلى 32.5% مقسومة على 12 فترة كحد أقصى.',
        tierB3: 'الحد الأقصى لتراكم الغرامة هو 32.5% من أصل القرض.'
      },
      cn: {
        tierATitle: `A. ${aMin} – ${aMax} 档（A档 • ${cleanCurr}）`,
        tierA1: '宽限期后逾期第 1 至 28 天：固定收取初始本金 5% 的滞纳金。',
        tierA2: '自逾期第 29 天起：每满 28 天追加收取初始本金 2.5% 的滞纳金。',
        tierA3: '累计滞纳金最高不超过初始借款本金的 32.5%。',
        tierBTitle: `B. ${bMin} – ${bMax} 档（B档 • ${cleanCurr}）`,
        tierB1: '每逾期 28 天按初始借款本金的 2.71% 计算滞纳金。',
        tierB2: '按年上限 32.5% 均分为 12 个周期计算。',
        tierB3: '累计滞纳金最高不超过初始借款本金的 32.5%。'
      }
    };

    return dynamicMap[language] || dynamicMap.id;
  };

  // Download Detail HTML - 4 Halaman A4
  const handleDownloadHTMLDetail = (debt) => {
    const c = t.contract;
    const dCurr = debt.currency || managerCurrency;
    const dSym = getCurrencySymbolDynamic(dCurr);
    const dynamicTiers = getDynamicTierTexts(dCurr);
    const statusText = t.statusOptions[debt.statusKey] || debt.status || t.statusOptions.active;
    const methodText = t.methods[debt.paymentMethodKey] || debt.paymentMethod || t.methods.transfer;
    const rewardLabel = debt.bonusType === 'interest' ? t.interestText : t.bonusText;
    const lateInfo = calculateLateStatus(debt);
    const displayLatePercent = lateInfo.isLate ? lateInfo.effectiveLatePercent : (debt.lateFeePercent || 0);
    const isRtl = language === 'ar';
    const isCashMethod = debt.paymentMethodKey === 'cash';
    const hasCollateralFlag = Boolean(debt.collateral);

    const parseLocalDate = (str) => {
      if (!str) return null;
      const d = new Date(`${str}T00:00:00`);
      return isNaN(d.getTime()) ? null : d;
    };

    const localeMap = {
      id: 'id-ID',
      jp: 'ja-JP',
      en: 'en-US',
      ar: 'ar-SA',
      cn: 'zh-CN'
    };
    const activeLocale = localeMap[language] || 'id-ID';

    const formatLocalizedDate = (str) => {
      const d = parseLocalDate(str);
      if (!d) return '-';
      try {
        return d.toLocaleDateString(activeLocale, {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      } catch {
        return str;
      }
    };

    const startObj = parseLocalDate(debt.startDate);
    const startDayName = startObj
      ? startObj.toLocaleDateString(activeLocale, { weekday: 'long' })
      : '........';
    const startDateFormatted = startObj ? formatLocalizedDate(debt.startDate) : '........';
    const dueDateFormatted = debt.dueDate ? formatLocalizedDate(debt.dueDate) : t.flexible;
    const agreementCity = extractCityFromAddress(debt.debtorAddress);
    const principalVal = Number(debt.principalAmount) || Number(debt.amount) || 0;

    const termCountNum = Number(debt.installmentCount) || 1;
    const tenorTextClause = debt.isInstallment
      ? `${termCountNum} ${c.p1_4_installment}`
      : c.p1_4_single;
    const collateralClauseText = hasCollateralFlag
      ? `${t.hasCollateralText} — ${debt.collateralDesc || '-'}`
      : t.hasNoCollateral;

    const contractDocTitle = hasCollateralFlag
      ? c.docTitleWithCollateral
      : c.docTitleNoCollateral;

    const isMicroScheme = debt.lateFeeMode === 'micro';
    const microSchemeTitle = c.p2_micro_title || c.p2_tierA_title;
    const microSchemeItems = [
      c.p2_micro_1 || c.p2_tierA_1,
      c.p2_micro_2 || c.p2_tierA_2,
      c.p2_micro_3 || c.p2_tierA_3
    ].filter(Boolean);

    const activeSchemeLabel = isMicroScheme
      ? (c.p2_schemeMicro || t.microLoanToggleLabel || 'Paket Pinjaman Mikro')
      : debt.lateFeeMode === 'manual'
      ? `${c.p2_schemeManual} (${debt.lateFeePercent}% / 28d)`
      : c.p2_schemeAuto;

    const defaultFiveClausesHtml = `
      <div class="clause-section">
        <div class="clause-title">${c.pasal1Title}</div>
        <ol class="clause-list">
          <li>${c.p1_1} <strong>${dSym} ${principalVal.toLocaleString()} (${dCurr})</strong></li>
          <li>${c.p1_2} ${startDateFormatted} (${debt.startDate || '-'})</li>
          <li>${c.p1_3} ${dueDateFormatted} ${debt.dueDate ? `(${debt.dueDate})` : ''}</li>
          <li>${c.p1_4} ${tenorTextClause}</li>
          <li>${c.p1_5}</li>
          <li>${c.p1_6}</li>
          <li>${c.p1_7} ${debt.bonusPercent || 0}% (${t.totalPlusLabel} ${rewardLabel}: <strong>${dSym} ${(debt.amount || 0).toLocaleString()}</strong>).</li>
          <li>${c.p1_8}</li>
        </ol>
      </div>

      <div class="clause-section">
        <div class="clause-title">${c.pasal2Title}</div>
        <p class="clause-text">${c.p2_intro}</p>
        ${isMicroScheme ? `
        <div class="tier-card" style="margin: 3px 0;">
          <span class="tier-heading">${microSchemeTitle}</span>
          <ul>
            ${microSchemeItems.map((item) => `<li>${item}</li>`).join('')}
          </ul>
        </div>
        ` : `
        <div class="tier-grid">
          <div class="tier-card">
            <span class="tier-heading">${dynamicTiers.tierATitle}</span>
            <ul>
              <li>${dynamicTiers.tierA1}</li>
              <li>${dynamicTiers.tierA2}</li>
              <li>${dynamicTiers.tierA3}</li>
            </ul>
          </div>
          <div class="tier-card">
            <span class="tier-heading">${dynamicTiers.tierBTitle}</span>
            <ul>
              <li>${dynamicTiers.tierB1}</li>
              <li>${dynamicTiers.tierB2}</li>
              <li>${dynamicTiers.tierB3}</li>
            </ul>
          </div>
        </div>
        `}
        <p class="clause-text">
          ${c.p2_schemeNote} <strong>${activeSchemeLabel}</strong>.
        </p>
      </div>

      <div class="clause-section">
        <div class="clause-title">${hasCollateralFlag ? c.pasal3TitleWith : c.pasal3TitleWithout}</div>
        ${hasCollateralFlag ? `
        <ol class="clause-list">
          <li>${c.p3_with_1}</li>
          <li>${c.p3_with_2} <strong>${collateralClauseText}</strong>.</li>
          <li>${c.p3_with_3}</li>
          <li>${c.p3_with_4}</li>
        </ol>
        ` : `
        <ol class="clause-list">
          <li>${c.p3_without_1}</li>
          <li>${c.p3_without_2}</li>
          <li>${c.p3_without_3}</li>
        </ol>
        `}
      </div>

      <div class="clause-section">
        <div class="clause-title">${hasCollateralFlag ? c.pasal4TitleWith : c.pasal4TitleWithout}</div>
        ${hasCollateralFlag ? `
        <ol class="clause-list">
          <li>${c.p4_with_1}</li>
          <li>${c.p4_with_2}</li>
          <li>${c.p4_with_3}</li>
          <li>${c.p4_with_4}</li>
          <li>${c.p4_with_5}</li>
          <li>${c.p4_with_6}</li>
          <li>${c.p4_with_7}</li>
        </ol>
        ` : `
        <ol class="clause-list">
          <li>${c.p4_without_1}</li>
          <li>${c.p4_without_2}</li>
          <li>${c.p4_without_3}</li>
          <li>${c.p4_without_4}</li>
          <li>${c.p4_without_5}</li>
        </ol>
        `}
      </div>

      <div class="clause-section">
        <div class="clause-title">${c.pasal5Title}</div>
        <ol class="clause-list">
          <li>${c.p5_1}</li>
          <li>${c.p5_2}</li>
          <li>${c.p5_3}</li>
        </ol>
      </div>
    `;

   const hasCustomClauses =
      Array.isArray(debt.customClauses) && debt.customClauses.length > 0;

    const contractBodyHtml = hasCustomClauses
      ? buildAdjustedContractHtml(
          debt.customClauses,
          debt,
          dSym,
          dCurr,
          principalVal,
          collateralClauseText,
          t.flexible
        )
      : debt.uploadedContractText
      ? buildAdjustedContractHtml(
          debt.uploadedContractText,
          debt,
          dSym,
          dCurr,
          principalVal,
          collateralClauseText,
          t.flexible
        )
      : defaultFiveClausesHtml;
            
    const penaltyMode = debt.lateFeeMode || (Number(debt.lateFeePercent) > 0 ? 'manual' : 'auto');
    const manualPct = Number(debt.lateFeePercent) || 0;
    const samplePenalty1to28 = computeTieredPenalty(principalVal, 10, dCurr, penaltyMode, manualPct);
    const samplePenaltyMax = computeTieredPenalty(principalVal, 336, dCurr, penaltyMode, manualPct);

    const actualBonusPct = Number(debt.bonusPercent) || 0;

    const buildTenorCardHtml = (months) => {
      const isSelectedTenor = debt.isInstallment && Number(debt.installmentCount) === months;
      const bonusNominal = Math.round(principalVal * (actualBonusPct / 100));
      const totalWithReward = principalVal + bonusNominal;
      const monthlyInstallment = Math.round(totalWithReward / months);

      const estEndObj = debt.startDate ? addMonthsSafely(debt.startDate, months) : null;
      const estEndStr = estEndObj ? formatLocalDateStr(estEndObj) : '-';

      return `
        <div class="tenor-card ${isSelectedTenor ? 'tenor-card-active' : ''}">
          <div class="tenor-card-head">
            <span class="tenor-badge">${c.tenorLabel} ${months} ${c.monthShort} ${isSelectedTenor ? `★ ${c.activeTag}` : ''}</span>
            <span class="tenor-due">${t.dueDateShort}: ${estEndStr}</span>
          </div>
          <div class="tenor-metrics">
            <div class="t-row">
              <span>${c.tenorPrincipal}</span>
              <strong>${dSym} ${principalVal.toLocaleString()}</strong>
            </div>
            <div class="t-row">
              <span>${rewardLabel} (${actualBonusPct}%)</span>
              <strong>+${dSym} ${bonusNominal.toLocaleString()}</strong>
            </div>
            <div class="t-row t-total">
              <span>${c.tenorTotal}</span>
              <strong>${dSym} ${totalWithReward.toLocaleString()}</strong>
            </div>
            <div class="t-row t-installment">
              <span>${c.tenorInstallment} (${months}x)</span>
              <strong>${dSym} ${monthlyInstallment.toLocaleString()}</strong>
            </div>
          </div>
          <div class="tenor-penalty-note">
            ${samplePenalty1to28.amount > 0
              ? `<span>${c.tenorPenaltyHint} <b>+${dSym} ${samplePenalty1to28.amount.toLocaleString()}</b> (${samplePenalty1to28.percent}%) • ${c.tenorMaxHint} <b>+${dSym} ${samplePenaltyMax.amount.toLocaleString()}</b> (${samplePenaltyMax.percent}%)</span>`
              : `<span>${c.tenorNoPenaltyHint}</span>`
            }
          </div>
        </div>
      `;
    };

    const leftTenorCards = [1, 2, 3, 4, 5, 6].map(buildTenorCardHtml).join('');
    const rightTenorCards = [7, 8, 9, 10, 11, 12].map(buildTenorCardHtml).join('');

    const actualPenaltyLogs = (debt.paymentHistory || []).filter(
      (log) => Number(log.daysLate) > 0 || Number(log.lateFeeCharged) > 0
    );
    const hasAnyStamp = (debt.paymentHistory && debt.paymentHistory.length > 0) || lateInfo.isLate;

    const stampBannerHtml = hasAnyStamp
      ? `
        <div class="stamp-audit-box ${lateInfo.isLate || actualPenaltyLogs.length > 0 ? 'stamp-alert' : 'stamp-ok'}">
          <div class="stamp-audit-title">
            <span>${c.page3StampTitle} #${debt.id}</span>
            <span>${activeSchemeLabel}</span>
          </div>
          ${(debt.paymentHistory || []).slice(0, 3).map((log) => {
            const summary = formatHistoryLogSummary(log, dCurr, debt);
            return `<div class="stamp-log-line">• <strong>[${log.timestamp}]</strong> ${dSym} ${Number(log.amount).toLocaleString()} — ${summary}</div>`;
          }).join('')}
          ${lateInfo.pendingLateFee > 0 ? `<div class="stamp-log-line" style="color:#b91c1c;">• <strong>[${t.lateStatusBadge}]</strong> ${lateInfo.activeDaysLate} ${t.daysLateText} → <strong>+${dSym} ${lateInfo.pendingLateFee.toLocaleString()}</strong></div>` : ''}
        </div>
      `
      : `
        <div class="stamp-audit-box stamp-ok">
          <div class="stamp-audit-title">
            <span>${c.page3PenaltyRefTitle}</span>
            <span>${activeSchemeLabel}</span>
          </div>
          <div class="stamp-log-line">• ${c.page3NoHistoryNote} (${dSym} ${principalVal.toLocaleString()})</div>
        </div>
      `;

    const formatPaymentAccountLines = (rawInfo) => {
      if (!rawInfo) return '';
      const escapeHtml = (str) =>
        String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      const parts = String(rawInfo)
        .split(/\s*\/\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length <= 1) {
        return `<span class="sub-account">${escapeHtml(rawInfo)}</span>`;
      }
      return parts
        .map((part) => `<span class="sub-account">• ${escapeHtml(part)}</span>`)
        .join('');
    };

    const htmlContent = `<!DOCTYPE html>
    <html lang="${language}" dir="${isRtl ? 'rtl' : 'ltr'}">
    <head>
    <meta charset="UTF-8">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${contractDocTitle} - ${debt.name}</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 8mm 10mm;
      }
      :root { color-scheme: light !important; }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        box-sizing: border-box;
      }
      html, body {
        background-color: #ffffff !important;
        color: #000000 !important;
        padding: 0 !important;
        margin: 0 !important;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        line-height: 1.32;
      }
      .page-sheet {
        width: 100%;
        max-width: 780px;
        margin: 0 auto 14px auto;
        background: #ffffff !important;
        border: 1.5px solid #cbd5e1;
        border-radius: 6px;
        padding: 14px 18px;
      }
      .page-break {
        page-break-after: always;
        break-after: page;
      }
      .contract-title {
        text-align: center;
        font-size: 13pt;
        font-weight: 900;
        letter-spacing: 0.4px;
        text-transform: uppercase;
        border-bottom: 2px solid #000000;
        padding-bottom: 5px;
        margin: 0 0 7px 0;
      }
      .contract-intro {
        font-size: 8.3pt;
        font-weight: 400;
        margin: 0 0 7px 0;
        color: #0f172a !important;
      }
      .parties-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 7px;
      }
      .party-box {
        background: #f8fafc !important;
        border: 1px solid #cbd5e1;
        border-radius: 5px;
        padding: 6px 10px;
        font-size: 8.1pt;
      }
      .party-box h4 {
        margin: 0 0 4px 0;
        font-size: 8pt;
        font-weight: 800;
        text-transform: uppercase;
        color: #000000 !important;
        border-bottom: 1px solid #cbd5e1;
        padding-bottom: 2px;
      }
      .party-box p {
        margin: 2px 0;
        font-size: 8pt;
        font-weight: 400;
      }
      .clause-section {
        margin-bottom: 6px;
      }
      .clause-title {
        font-size: 8.5pt;
        font-weight: 800;
        text-transform: uppercase;
        background: #f1f5f9 !important;
        padding: 2.5px 7px;
        border-${isRtl ? 'right' : 'left'}: 3px solid #0f172a;
        margin: 0 0 3px 0;
      }
      .clause-list {
        margin: 0;
        padding-${isRtl ? 'right' : 'left'}: 16px;
        font-size: 7.9pt;
        font-weight: 400;
        color: #0f172a !important;
      }
      .clause-list li {
        margin-bottom: 1.5px;
        font-weight: 400;
      }
      .clause-text {
        margin: 0 0 3px 0;
        font-size: 7.9pt;
        font-weight: 400;
        color: #0f172a !important;
      }
      .tier-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin: 3px 0;
      }
      .tier-card {
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        padding: 5px 8px;
        background: #f8fafc !important;
        font-size: 7.5pt;
        font-weight: 400;
      }
      .tier-card .tier-heading {
        display: block;
        margin-bottom: 2px;
        font-size: 7.7pt;
        font-weight: 700;
        color: #000000 !important;
      }
      .tier-card ul {
        margin: 0;
        padding-${isRtl ? 'right' : 'left'}: 14px;
      }
      .tier-card li {
        font-weight: 400;
      }
      .contract-sign-row {
        display: flex;
        justify-content: space-between;
        align-items: stretch;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed #94a3b8;
        gap: 12px;
      }
      .place-date-box {
        font-size: 8.1pt;
        font-weight: 600;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding-bottom: 2px;
      }
      .sign-group {
        display: grid;
        grid-template-columns: repeat(2, 162px);
        gap: 12px;
        align-items: stretch;
        flex-shrink: 0;
      }
      .sign-sub-box {
        width: 162px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        text-align: center;
      }
      .sign-role {
        font-size: 6.8pt;
        line-height: 1.2;
        min-height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #334155 !important;
        text-transform: uppercase;
        margin: 0 0 4px 0;
        font-weight: 700;
        white-space: pre-line;
      }
      .fingerprint-area {
        width: 38px;
        height: 42px;
        border: 1px dashed #64748b;
        margin: 0 auto 4px auto;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 6.5pt;
        color: #475569 !important;
        font-weight: 700;
        overflow: hidden;
        background: #ffffff;
        flex-shrink: 0;
      }
      .fingerprint-area img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .signature-img-slot {
        height: 34px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        margin-bottom: 2px;
        flex-shrink: 0;
      }
      .signature-img-slot img {
        max-width: 136px;
        max-height: 34px;
        object-fit: contain;
      }
      .sign-line {
        border-top: 1px dashed #64748b;
        margin-top: 4px;
        padding-top: 3px;
        font-weight: 800;
        font-size: 8.2pt;
        color: #000000 !important;
        word-break: break-word;
      }
      .doc-header {
        color: #000000 !important;
        font-size: 12.5pt;
        font-weight: 800;
        border-bottom: 2px solid #000000;
        padding-bottom: 5px;
        margin: 0 0 9px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .badge {
        background: #f1f5f9 !important;
        color: #000000 !important;
        border: 1px solid #94a3b8;
        font-size: 7.8pt;
        font-weight: 800;
        padding: 2px 9px;
        border-radius: 4px;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 12px;
        margin-bottom: 10px;
        background: #f8fafc !important;
        padding: 10px 12px;
        border-radius: 5px;
        border: 1px solid #cbd5e1;
      }
      .item { min-width: 0; }
      .item label {
        display: block;
        font-size: 7pt;
        color: #475569 !important;
        text-transform: uppercase;
        margin-bottom: 1px;
        font-weight: 700;
        letter-spacing: 0.4px;
      }
      .item span {
        display: block;
        font-size: 9pt;
        font-weight: 600;
        color: #000000 !important;
        word-wrap: break-word;
        overflow-wrap: anywhere;
      }
      .method-grey {
        font-size: 8.5pt !important;
        font-weight: 600 !important;
        color: #475569 !important;
      }
      .method-black-bold {
        font-size: 9pt !important;
        font-weight: 900 !important;
        color: #000000 !important;
      }
      .sub-account {
        display: block;
        font-size: 8pt;
        font-weight: 700 !important;
        color: #000000 !important;
        margin-top: 2px;
        line-height: 1.28;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      .amount {
        color: #000000 !important;
        font-size: 10.5pt !important;
        font-weight: 900 !important;
      }
      .late-alert {
        color: #b91c1c !important;
        font-weight: 800 !important;
      }
      .table-box {
        background: #ffffff !important;
        border: 1px solid #cbd5e1;
        border-radius: 5px;
        padding: 8px 10px;
        margin-bottom: 10px;
      }
      .table-box h3 {
        margin: 0 0 5px 0;
        font-size: 8pt;
        color: #000000 !important;
        text-transform: uppercase;
        font-weight: 800;
        letter-spacing: 0.4px;
      }
      table { width: 100%; border-collapse: collapse; }
      th {
        text-align: ${isRtl ? 'right' : 'left'};
        font-size: 7pt;
        color: #334155 !important;
        padding: 4px 6px;
        border-bottom: 1.5px solid #94a3b8;
        text-transform: uppercase;
        font-weight: 800;
        background: #f1f5f9 !important;
      }
      td {
        padding: 4px 6px;
        font-size: 8pt;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: middle;
      }
      tr:last-child td { border-bottom: none; }
      .combined-box {
        background: #ffffff !important;
        border: 1px solid #cbd5e1;
        border-radius: 5px;
        padding: 9px 12px;
        margin-bottom: 9px;
      }
      .combined-title {
        display: block;
        font-size: 7.5pt;
        color: #334155 !important;
        margin-bottom: 6px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .combined-content {
        display: flex;
        gap: 12px;
        align-items: stretch;
        justify-content: space-between;
      }
      .proof-img-container {
        flex: 1;
        text-align: center;
        min-height: 108px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px dashed #cbd5e1;
        border-radius: 4px;
        padding: 4px;
      }
      .proof-img-container img {
        max-width: 100%;
        max-height: 115px;
        border-radius: 3px;
        object-fit: contain;
      }
      .disclaimer-box {
        background: #f8fafc !important;
        border: 1px solid #94a3b8;
        border-radius: 4px;
        padding: 7px 10px;
        margin-bottom: 8px;
        font-size: 7.3pt;
        color: #1e293b !important;
        line-height: 1.35;
      }
      .disclaimer-box > strong {
        display: block;
        font-size: 7.5pt;
        color: #000000 !important;
        margin-bottom: 2px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .footer {
        text-align: center;
        font-size: 7.5pt;
        font-weight: 600;
        color: #475569 !important;
        border-top: 1px solid #cbd5e1;
        padding-top: 5px;
        margin: 0;
      }
      .stamp-audit-box {
        border: 1px solid #cbd5e1;
        background: #f8fafc !important;
        border-radius: 5px;
        padding: 5px 8px;
        margin-bottom: 6px;
        font-size: 7pt;
        line-height: 1.28;
      }
      .stamp-audit-title {
        display: flex;
        justify-content: space-between;
        font-weight: 800;
        margin-bottom: 2px;
      }
      .tenor-two-cols {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 8px;
        margin-bottom: 6px;
      }
      .tenor-col {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .tenor-card {
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        padding: 4px 7px;
        background: #ffffff !important;
      }
      .tenor-card-active {
        border: 1.5px solid #0f172a !important;
        background: #f8fafc !important;
      }
      .tenor-card-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 4px;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 1.5px;
        margin-bottom: 2px;
      }
      .tenor-badge {
        font-size: 7.2pt;
        font-weight: 900;
        color: #000000 !important;
        white-space: nowrap;
      }
      .tenor-due {
        font-size: 6.6pt;
        color: #475569 !important;
        font-weight: 600;
        white-space: nowrap;
      }
      .tenor-metrics {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1px 8px;
        font-size: 6.8pt;
      }
      .t-row {
        display: flex;
        justify-content: space-between;
        gap: 4px;
      }
      .tenor-penalty-note {
        margin-top: 2px;
        padding-top: 2px;
        border-top: 1px dashed #cbd5e1;
        font-size: 6.2pt;
        color: #334155 !important;
        line-height: 1.2;
      }
      .photo-sec-title {
        font-size: 7.8pt;
        font-weight: 800;
        text-transform: uppercase;
        background: #f1f5f9 !important;
        padding: 3px 8px;
        border-${isRtl ? 'right' : 'left'}: 3px solid #0f172a;
        margin: 0 0 6px 0;
        color: #000000 !important;
      }
      .photo-grid-3-id {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-bottom: 8px;
      }
      .photo-card-4x6 {
        border: 1px solid #94a3b8;
        border-radius: 5px;
        padding: 5px;
        background: #f8fafc !important;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      .frame-4x6 {
        width: 40mm;
        height: 54mm;
        border: 1.2px dashed #64748b;
        border-radius: 3px;
        background: #ffffff !important;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        padding: 3px;
      }
      .frame-4x6 img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .photo-grid-2-2r {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin-bottom: 8px;
      }
      .photo-card-2r {
        border: 1px solid #94a3b8;
        border-radius: 5px;
        padding: 5px 8px;
        background: #f8fafc !important;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      .frame-2r {
        width: 100%;
        max-width: 84mm;
        height: 56mm;
        border: 1.2px dashed #64748b;
        border-radius: 3px;
        background: #ffffff !important;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        padding: 4px;
      }
      .frame-2r img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .photo-slot-caption {
        font-size: 7pt;
        font-weight: 800;
        color: #0f172a !important;
        margin-top: 4px;
        line-height: 1.2;
      }
      .photo-slot-sub {
        font-size: 6.4pt;
        color: #475569 !important;
        margin-top: 1px;
      }
      .photo-placeholder-txt {
        font-size: 7pt;
        font-weight: 700;
        color: #64748b !important;
      }
      .photo-placeholder-dim {
        font-size: 6.3pt;
        color: #94a3b8 !important;
        margin-top: 2px;
      }
      @media print {
        html, body {
          width: 100%;
          height: auto;
          background-color: #ffffff !important;
          color: #000000 !important;
        }
        .page-sheet {
          max-width: 100% !important;
          border: 1.5px solid #94a3b8 !important;
          box-shadow: none !important;
          margin: 0 !important;
        }
        .amount, .item span, td, .sub-account, .method-black-bold, .sign-line {
          color: #000000 !important;
        }
      }
    </style>
    </head>
    <body>

      <!-- ==================== HALAMAN 1: SURAT PERJANJIAN PINJAMAN PRIBADI ==================== -->
      <div class="page-sheet page-break" dir="${isRtl ? 'rtl' : 'ltr'}">
        <h1 class="contract-title">${contractDocTitle}</h1>
        <p class="contract-intro">
          ${c.introPrefix} <strong>${startDayName}</strong>, ${c.introDateWord} <strong>${startDateFormatted}</strong> (${c.introTxLabel}: #${debt.id}), ${c.introSuffix}
        </p>

        <div class="parties-grid">
          <div class="party-box">
            <h4>${c.party1Title}</h4>
            <p>${c.fieldName}: <strong>${debt.lenderName || '-'}</strong></p>
            <p>${c.fieldId}: ${debt.creditorIdNo || '-'}</p>
          </div>
          <div class="party-box">
            <h4>${c.party2Title}</h4>
            <p>${c.fieldName}: <strong>${debt.name}</strong></p>
            <p>${c.fieldId}: ${debt.debtorIdNo || '-'}</p>
            <p>${c.fieldAddress}: ${debt.debtorAddress || '-'}</p>
            <p>${c.fieldPhone}: ${debt.borrowerPhone || '-'} / ${debt.emergencyPhone || '-'}</p>
          </div>
        </div>

        ${contractBodyHtml}

        <div class="contract-sign-row">
          <div class="place-date-box">  
            <div>${c.placeDateLabel}</div>
            <div style="margin-top: 3px; font-weight: 800;">
              ${agreementCity ? agreementCity : '..........................'}, ${startDateFormatted}
            </div>
          </div>

          <div class="sign-group">
            <div class="sign-sub-box">
              <p class="sign-role">${c.signParty1}</p>
              <div class="fingerprint-area">
                ${debt.creditorFingerprint ? `<img src="${debt.creditorFingerprint}" alt="${t.fingerprintText}" />` : t.fingerprintText}
              </div>
              <div class="signature-img-slot">
                ${debt.creditorSignature ? `<img src="${debt.creditorSignature}" alt="${t.sigCreditor}" />` : ''}
              </div>
              <div class="sign-line">(${debt.lenderName || t.lenderNameText})</div>
            </div>

            <div class="sign-sub-box">
              <p class="sign-role">${c.signParty2}</p>
              <div class="fingerprint-area">
                ${debt.debtorFingerprint ? `<img src="${debt.debtorFingerprint}" alt="${t.fingerprintText}" />` : t.fingerprintText}
              </div>
              <div class="signature-img-slot">
                ${debt.debtorSignature ? `<img src="${debt.debtorSignature}" alt="${t.sigDebtor}" />` : ''}
              </div>
              <div class="sign-line">(${debt.name})</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== HALAMAN 2: DETAIL RINGKASAN & RIWAYAT PEMBAYARAN ==================== -->
      <div class="page-sheet page-break">
        <div class="doc-header">
          <span>${t.receiptTitle}</span>
          <span class="badge">${debt.category}</span>
        </div>

        <div class="grid">
          <div class="item"><label>${t.transId}</label><span>#${debt.id}</span></div>
          <div class="item"><label>${t.loanType}</label><span>${debt.type}</span></div>

          <div class="item"><label>${t.borrowerName}</label><span>${debt.name}</span></div>
          <div class="item"><label>${t.lenderNameLabel}</label><span>${debt.lenderName || '-'}</span></div>

          <div class="item"><label>${t.debtorIdLabel}</label><span>${debt.debtorIdNo || '-'}</span></div>
          <div class="item"><label>${t.creditorIdLabel}</label><span>${debt.creditorIdNo || '-'}</span></div>

          <div class="item" style="grid-column: span 2;"><label>${t.debtorAddressLabel}</label><span>${debt.debtorAddress || '-'}</span></div>

          <div class="item"><label>${t.borrowerPhone}</label><span>${debt.borrowerPhone || '-'}</span></div>
          <div class="item"><label>${t.emergencyPhone}</label><span>${debt.emergencyPhone || '-'}</span></div>

          <div class="item">
            <label>${t.loanAmount}</label>
            <span class="amount">${dSym} ${principalVal.toLocaleString()} (${dCurr})</span>
          </div>
          <div class="item">
            <label>${t.totalWithBonus}</label>
            <span class="amount">${dSym} ${debt.amount.toLocaleString()} ${debt.bonusPercent ? `[+${debt.bonusPercent}% ${rewardLabel}]` : ''}</span>
          </div>

          <div class="item"><label>${t.status}</label><span>${statusText} ${lateInfo.daysLate > 0 ? `(${t.lateStatusBadge} ${lateInfo.daysLate} ${t.daysLateText})` : ''}</span></div>
          <div class="item">
            <label>${t.payMethod}</label>
            <span class="${isCashMethod ? 'method-black-bold' : 'method-grey'}">${methodText}</span>
            ${debt.paymentAccountInfo && !isCashMethod ? formatPaymentAccountLines(debt.paymentAccountInfo) : ''}
          </div>

          <div class="item"><label>${t.datePinjam}</label><span>${debt.startDate}</span></div>
          <div class="item"><label>${t.dateTempo}</label><span>${debt.dueDate || t.flexible}</span></div>

          ${(debt.lateFeeMode === 'auto' || debt.lateFeeMode === 'micro' || debt.lateFeePercent > 0 || lateInfo.isLate) ? `
          <div class="item">
            <label>${t.lateFeeAmountLabel} (${displayLatePercent}%)</label>
            <span class="${lateInfo.isLate ? 'late-alert' : ''}">${lateInfo.isLate ? `${dSym} ${lateInfo.lateFeeAmount.toLocaleString()}${lateInfo.daysLate > 0 ? ` (${lateInfo.daysLate} ${t.daysLateText})` : ''}` : `${dSym} 0`}</span>
          </div>
          <div class="item">
            <label>${t.totalBillWithLate}</label>
            <span class="amount">${dSym} ${lateInfo.effectiveTotal.toLocaleString()}</span>
          </div>
          ` : ''}

          <div class="item" style="grid-column: span 2;"><label>${t.collateral}</label><span>${hasCollateralFlag ? `${t.hasCollateralText} (${debt.collateralDesc || '-'})` : t.hasNoCollateral}</span></div>
          <div class="item" style="grid-column: span 2;"><label>${t.totalPaidSoFar}</label><span style="color:#000000 !important; font-weight: 800;">${dSym} ${(debt.totalPaidAmount || 0).toLocaleString()} / ${dSym} ${lateInfo.effectiveTotal.toLocaleString()}</span></div>
        </div>

        <div class="table-box">
          <h3>${t.paymentHistoryTitle}</h3>
          ${(debt.paymentHistory && debt.paymentHistory.length > 0) ? `
          <table>
            <thead>
              <tr>
                <th style="width: 34px;">${t.tableNoLabel}</th>
                <th>${t.dateAndTime}</th>
                <th style="text-align: ${isRtl ? 'left' : 'right'};">${t.amountPaid}</th>
              </tr>
            </thead>
            <tbody>
              ${historyRows}
            </tbody>
          </table>
          ` : `<p style="font-size:8pt; color:#475569; margin:0;">(${t.noHistoryYet})</p>`}
        </div>

        <div class="combined-box">
          <span class="combined-title">${t.proof}</span>
          <div class="combined-content">
            <div class="proof-img-container">
              ${debt.image ? `<img src="${debt.image}" alt="${t.proofAltText}" />` : `<span style="color:#475569; font-size:8pt;">(${t.noPhotoProof})</span>`}
            </div>

            <div class="sign-group">
              <div class="sign-sub-box">
                <p class="sign-role">${t.sigCreditor}</p>
                <div class="fingerprint-area">
                  ${debt.creditorFingerprint ? `<img src="${debt.creditorFingerprint}" alt="${t.fingerprintText}" />` : t.fingerprintText}
                </div>
                <div class="signature-img-slot">
                  ${debt.creditorSignature ? `<img src="${debt.creditorSignature}" alt="${t.sigCreditor}" />` : ''}
                </div>
                <div class="sign-line">(${debt.lenderName || t.lenderNameText})</div>
              </div>
              <div class="sign-sub-box">
                <p class="sign-role">${t.sigDebtor}</p>
                <div class="fingerprint-area">
                  ${debt.debtorFingerprint ? `<img src="${debt.debtorFingerprint}" alt="${t.fingerprintText}" />` : t.fingerprintText}
                </div>
                <div class="signature-img-slot">
                  ${debt.debtorSignature ? `<img src="${debt.debtorSignature}" alt="${t.sigDebtor}" />` : ''}
                </div>
                <div class="sign-line">(${debt.name})</div>
              </div>
            </div>
          </div>
        </div>

        <div class="disclaimer-box">
          <strong>${t.legalDisclaimerTitle}</strong>
          <span>${t.legalDisclaimerText}</span>
        </div>

        <div class="footer">
          <span>${t.footerText}</span>
        </div>
      </div>

      <!-- ==================== HALAMAN 3: SIMULASI RINCIAN TENOR 1 s.d. 12 BULAN ==================== -->
      <div class="page-sheet page-break" dir="${isRtl ? 'rtl' : 'ltr'}">
        <div class="doc-header" style="margin-bottom: 7px;">
          <span>${c.page3Header}</span>
          <span class="badge">${c.page3PrincipalBadge}: ${dSym} ${principalVal.toLocaleString()}</span>
        </div>

        ${stampBannerHtml}

        <div class="tenor-two-cols">
          <div class="tenor-col">
            ${leftTenorCards}
          </div>
          <div class="tenor-col">
            ${rightTenorCards}
          </div>
        </div>

        <div class="disclaimer-box" style="margin-bottom: 6px; padding: 5px 8px; font-size: 6.9pt;">
          <strong>${c.page3NoteTitle}</strong>
          <span>${c.page3NoteBody} (<strong>${actualBonusPct}%</strong> | <strong>${dSym} ${principalVal.toLocaleString()}</strong>).</span>
        </div>

        <div class="footer">
          <span>${t.footerText} — #${debt.id} (${debt.name})</span>
        </div>
      </div>

      <!-- ==================== HALAMAN 4: LEMBAR KHUSUS 7 FOTO BUKTI ==================== -->
      <div class="page-sheet" dir="${isRtl ? 'rtl' : 'ltr'}">
        <div class="doc-header" style="margin-bottom: 7px;">
          <span>${c.page4Header}</span>
          <span class="badge">${c.page4SubBadge}</span>
        </div>

        <div class="photo-sec-title">${c.page4Sec1Title}</div>
        <div class="photo-grid-3-id">
          <div class="photo-card-4x6">
            <div class="frame-4x6">
              ${debt.photoIdDebtor
                ? `<img src="${debt.photoIdDebtor}" alt="${c.photoSlotIdDebtor}" />`
                : `<span class="photo-placeholder-txt">${c.photoEmptyHint}</span><span class="photo-placeholder-dim">4 × 6 cm</span>`
              }
            </div>
            <div class="photo-slot-caption">${c.photoSlotIdDebtor}</div>
            <div class="photo-slot-sub">${debt.name} (${debt.debtorIdNo || '-'})</div>
          </div>

          <div class="photo-card-4x6">
            <div class="frame-4x6">
              ${debt.photoSelfieDebtor
                ? `<img src="${debt.photoSelfieDebtor}" alt="${c.photoSlotSelfieDebtor}" />`
                : `<span class="photo-placeholder-txt">${c.photoEmptyHint}</span><span class="photo-placeholder-dim">4 × 6 cm</span>`
              }
            </div>
            <div class="photo-slot-caption">${c.photoSlotSelfieDebtor}</div>
            <div class="photo-slot-sub">${debt.name}</div>
          </div>

          <div class="photo-card-4x6">
            <div class="frame-4x6">
              ${debt.photoSelfieIdDebtor
                ? `<img src="${debt.photoSelfieIdDebtor}" alt="${c.photoSlotSelfieIdDebtor}" />`
                : `<span class="photo-placeholder-txt">${c.photoEmptyHint}</span><span class="photo-placeholder-dim">4 × 6 cm</span>`
              }
            </div>
            <div class="photo-slot-caption">${c.photoSlotSelfieIdDebtor}</div>
            <div class="photo-slot-sub">${debt.name} (${debt.debtorIdNo || '-'})</div>
          </div>
        </div>

        <div class="photo-sec-title">${c.page4Sec2Title}</div>
        <div class="photo-grid-2-2r">
          <div class="photo-card-2r">
            <div class="frame-2r">
              ${debt.photoCollateral1
                ? `<img src="${debt.photoCollateral1}" alt="${hasCollateralFlag ? c.photoSlotCollateral1 : c.photoSlotHandover1}" />`
                : `<span class="photo-placeholder-txt">${c.photoEmptyHint}</span><span class="photo-placeholder-dim">2R (6 × 9 cm)</span>`
              }
            </div>
            <div class="photo-slot-caption">${hasCollateralFlag ? c.photoSlotCollateral1 : c.photoSlotHandover1}</div>
            <div class="photo-slot-sub">${hasCollateralFlag ? (debt.collateralDesc || t.hasCollateralText) : `${methodText} • ${debt.startDate}`}</div>
          </div>

          <div class="photo-card-2r">
            <div class="frame-2r">
              ${debt.photoCollateral2
                ? `<img src="${debt.photoCollateral2}" alt="${hasCollateralFlag ? c.photoSlotCollateral2 : c.photoSlotHandover2}" />`
                : `<span class="photo-placeholder-txt">${c.photoEmptyHint}</span><span class="photo-placeholder-dim">2R (6 × 9 cm)</span>`
              }
            </div>
            <div class="photo-slot-caption">${hasCollateralFlag ? c.photoSlotCollateral2 : c.photoSlotHandover2}</div>
            <div class="photo-slot-sub">${hasCollateralFlag ? (debt.collateralDesc || t.hasCollateralText) : `${dSym} ${principalVal.toLocaleString()} (${dCurr})`}</div>
          </div>
        </div>

        <div class="photo-sec-title">${c.page4Sec3Title}</div>
        <div class="photo-grid-2-2r" style="margin-bottom: 6px;">
          <div class="photo-card-2r">
            <div class="frame-2r">
              ${debt.photoEtc1
                ? `<img src="${debt.photoEtc1}" alt="${c.photoSlotEtc1}" />`
                : `<span class="photo-placeholder-txt">${c.photoEmptyHint}</span><span class="photo-placeholder-dim">2R (6 × 9 cm)</span>`
              }
            </div>
            <div class="photo-slot-caption">${c.photoSlotEtc1}</div>
            <div class="photo-slot-sub">#${debt.id} — ${debt.name}</div>
          </div>

          <div class="photo-card-2r">
            <div class="frame-2r">
              ${debt.photoEtc2
                ? `<img src="${debt.photoEtc2}" alt="${c.photoSlotEtc2}" />`
                : `<span class="photo-placeholder-txt">${c.photoEmptyHint}</span><span class="photo-placeholder-dim">2R (6 × 9 cm)</span>`
              }
            </div>
            <div class="photo-slot-caption">${c.photoSlotEtc2}</div>
            <div class="photo-slot-sub">#${debt.id} — ${debt.lenderName || t.lenderNameText}</div>
          </div>
        </div>

        <div class="footer">
          <span>${t.footerText} — #${debt.id} (${debt.name})</span>
        </div>
      </div>

      <script>
        window.onload = function() { setTimeout(() => { window.print(); }, 400); };
      </script>
    </body>
    </html>`;

    const safePrefix = hasCollateralFlag ? 'Perjanjian_&_Detail_Pinjaman_' : 'Perjanjian_Pinjaman_Pribadi_';
    const fileName = `${safePrefix}${debt.name.replace(/\s+/g, '_')}.html`;

    if (window.AndroidDownloader && typeof window.AndroidDownloader.saveFile === 'function') {
      const encodeBase64 = (str) => {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
          return String.fromCharCode('0x' + p1);
        }));
      };
      const base64Html = encodeBase64(htmlContent);
      window.AndroidDownloader.saveFile(base64Html, fileName, 'text/html');
      return;
    }

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredDebts = debts.filter(d => {
    const matchesCategory = selectedCategoryFilter === 'ALL' || d.category === selectedCategoryFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = d.name.toLowerCase().includes(q) ||
                          (d.lenderName && d.lenderName.toLowerCase().includes(q)) ||
                          (d.debtorAddress && d.debtorAddress.toLowerCase().includes(q)) ||
                          d.type.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const visibleDebts = filteredDebts.slice(0, 5);

  const bgMain = isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800 shadow-xl border border-slate-200';
  const bgCard = isDarkMode ? 'bg-slate-800/90 border-slate-700/80' : 'bg-slate-50 border-slate-200 shadow-sm';
  const bgInnerBox = isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200';
  const inputBg = isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800';
  const modalBg = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  return (
    <div className={`p-4 md:p-6 max-w-7xl mx-auto min-h-screen rounded-2xl transition-colors duration-300 ${bgMain}`}>
      {/* Header & Actions */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b pb-6 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
        <div>
          <h1 className={`text-2xl md:text-3xl font-extrabold flex items-center gap-2 ${themeStyle.textAccent}`}>
            <Landmark className="w-8 h-8 p-1.5 rounded-lg border border-slate-700 bg-slate-800/80" />
            {t.title}
          </h1>
          <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'} text-sm mt-1`}>{t.subtitle}</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
          <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'}`}>
            <Coins className={`w-4 h-4 ${themeStyle.textAccent}`} />
            <select
              value={managerCurrency}
              onChange={(e) => setManagerCurrency(e.target.value)}
              className={`bg-transparent text-sm font-bold focus:outline-none cursor-pointer ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
              {currenciesList.map((c) => (
                <option key={c.code} value={c.code} className={isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}>
                  {c.code} ({getCurrencySymbolDynamic(c.code)})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className={`px-3.5 py-2 rounded-xl font-medium text-sm transition border flex items-center gap-1.5 ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'}`}>
            <Edit2 className={`w-4 h-4 ${themeStyle.textAccent}`} /> {t.manageCat}
          </button>

          <button
            onClick={() => setIsTypeModalOpen(true)}
            className={`px-3.5 py-2 rounded-xl font-medium text-sm transition border flex items-center gap-1.5 ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'}`}>
            <Plus className="w-4 h-4 text-emerald-500" /> {t.loanTypes}
          </button>

          <button
            onClick={() => { setEditingDebtData(null); setIsDebtModalOpen(true); }}
            className={`px-4 py-2.5 bg-gradient-to-r ${themeStyle.gradientBtn} text-white rounded-xl font-semibold shadow-lg transition flex items-center gap-2 flex-1 md:flex-none justify-center`}>
            <Plus className="w-5 h-5" /> {t.addDebt}
          </button>

          <QrLoanHub
            managerCurrency={managerCurrency}
            liveRates={liveRates}
            themeStyle={themeStyle}
            modalBg={modalBg}
            bgInnerBox={bgInnerBox}
            inputBg={inputBg}
            debts={debts}
            onApproveApplication={handleApproveApplication}
            onVerifiedInstallmentTransfer={handleApplyVerifiedTransferToDebt}
            onMarkApplicationApprovedRef={markQrAppApprovedRef}
            showToast={showToast}
          />
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative md:col-span-2 flex items-center">
          <Search className="absolute left-3 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none transition shadow-inner border ${inputBg}`}
          />
        </div>
        <div>
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none transition shadow-inner border ${inputBg}`}>
            <option value="ALL">{t.allCategories}</option>
            {categories.map((cat, idx) => (
              <option key={idx} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredDebts.length > 5 && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl border text-xs flex items-center justify-between ${bgInnerBox}`}>
          <span className="text-slate-400">{t.showingLimitInfo}</span>
          <span className={`font-bold ${themeStyle.textAccent}`}>{visibleDebts.length} / {filteredDebts.length}</span>
        </div>
      )}

      {/* Debt Cards / List View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visibleDebts.length === 0 ? (
          <div className={`col-span-full py-16 text-center border border-dashed rounded-2xl ${isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-300'}`}>
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-400 text-lg">{t.noData}</p>
          </div>
        ) : (
          visibleDebts.map((debt) => {
            const lateInfo = calculateLateStatus(debt);
            const effectiveTotalAmount = lateInfo.effectiveTotal;
            const displayLatePercent = lateInfo.isLate ? lateInfo.effectiveLatePercent : (debt.lateFeePercent || 0);
            const isFullyPaid = debt.statusKey === 'paid' || (debt.totalPaidAmount && debt.totalPaidAmount >= effectiveTotalAmount);
            const isMinimized = !!minimizedCards[debt.id];
            const reminderInfo = getDueReminderStatus(debt, lateInfo, isFullyPaid);

            let progressPercent = 0;
            if (isFullyPaid) {
              progressPercent = 100;
            } else if (effectiveTotalAmount > 0) {
              const currentPaid = debt.totalPaidAmount || 0;
              progressPercent = Math.min((currentPaid / effectiveTotalAmount) * 100, 100);
            }

            const dCurr = debt.currency || managerCurrency;
            const dSym = getCurrencySymbolDynamic(dCurr);
            const rewardTypeLabel = debt.bonusType === 'interest' ? t.interestText : t.bonusText;

            const getPayMethodIcon = (key) => {
              switch (key) {
                case 'transfer': return <CreditCard className="w-3.5 h-3.5 text-blue-400" />;
                case 'ewallet': return <Wallet className="w-3.5 h-3.5 text-purple-400" />;
                case 'cash': return <Banknote className="w-3.5 h-3.5 text-emerald-400" />;
                default: return <Shuffle className="w-3.5 h-3.5 text-amber-400" />;
              }
            };

            return (
              <div
                key={debt.id}
                className={`border rounded-2xl p-4 sm:p-5 transition flex flex-col justify-between overflow-hidden ${bgCard}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-3">
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-3 py-1 border rounded-full text-xs font-semibold uppercase tracking-wider ${themeStyle.badgeBg}`}
                        >
                          {debt.category}
                        </span>

                        {lateInfo.isLate && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-950/90 text-rose-300 border border-rose-700 flex items-center gap-1 max-w-full">
                            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                            <span className="truncate">
                              {t.lateStatusBadge} ({lateInfo.daysLate} {t.daysLateText})
                            </span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleMinimize(debt.id)}
                          className={`ml-auto sm:ml-0 p-1.5 rounded-lg border transition shrink-0 ${
                            isDarkMode
                              ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                              : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                          }`}
                          title={isMinimized ? t.expand : t.minimize}
                          aria-label={isMinimized ? t.expand : t.minimize}
                        >
                          {isMinimized ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <h3
                        className={`text-lg sm:text-xl font-bold mt-2 flex items-center gap-2 min-w-0 ${
                          isDarkMode ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        <User className={`w-5 h-5 shrink-0 ${themeStyle.textAccent}`} />
                        <span className="truncate">{debt.name}</span>
                      </h3>

                      {debt.lenderName && (
                        <p className="text-xs font-medium text-emerald-400 flex items-center gap-1.5 mt-0.5 min-w-0">
                          <UserCheck className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {t.lenderNameLabel}:{' '}
                            <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>
                              {debt.lenderName}
                            </strong>
                          </span>
                        </p>
                      )}

                      {!isMinimized && (
                        <div className="flex flex-col gap-1 mt-2">
                          {debt.debtorIdNo && (
                            <span className="text-xs text-slate-400 flex items-center gap-1.5 break-all">
                              <IdCard className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <span>
                                {t.debtorIdLabel}: {debt.debtorIdNo}
                              </span>
                            </span>
                          )}
                          {debt.debtorAddress && (
                            <span className="text-xs text-slate-400 flex items-start gap-1.5 break-words">
                              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                              <span>{debt.debtorAddress}</span>
                            </span>
                          )}
                          {debt.borrowerPhone && (
                            <span className="text-xs text-slate-400 flex items-center gap-1.5 break-all">
                              <Phone className={`w-3.5 h-3.5 shrink-0 ${themeStyle.textAccent}`} />
                              <span>
                                {t.borrowerPhone}: {debt.borrowerPhone}
                              </span>
                            </span>
                          )}
                          {debt.emergencyPhone && (
                            <span className="text-xs text-slate-400 flex items-center gap-1.5 break-all">
                              <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>
                                {t.emergencyPhone}: {debt.emergencyPhone}
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div
                      className={`w-full sm:w-auto sm:max-w-[45%] text-left sm:text-right pt-2.5 sm:pt-0 border-t sm:border-t-0 shrink-0 ${
                        isDarkMode ? 'border-slate-700/70' : 'border-slate-200'
                      }`}
                    >
                      <span className="text-xs text-slate-400 block">{t.loanAmount}</span>
                      <span className="text-lg sm:text-xl font-black text-emerald-400 break-words leading-tight block">
                        {dSym} {effectiveTotalAmount.toLocaleString()}{' '}
                        <span className="text-xs text-slate-400 font-normal">({dCurr})</span>
                      </span>

                      {debt.bonusPercent > 0 && (
                        <span className="text-[11px] text-amber-400 font-semibold flex items-center sm:justify-end gap-1 mt-0.5 break-words">
                          <Gift className="w-3 h-3 shrink-0" />
                          <span>
                            +{debt.bonusPercent}% {rewardTypeLabel}
                          </span>
                        </span>
                      )}

                      {lateInfo.isLate && lateInfo.lateFeeAmount > 0 && (
                        <span className="text-[11px] text-rose-400 font-bold block mt-0.5 break-words">
                          +{dSym} {lateInfo.lateFeeAmount.toLocaleString()} ({t.lateFeeAmountLabel}{' '}
                          {displayLatePercent}%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* BANNER PENGINGAT JATUH TEMPO OTOMATIS */}
                  {reminderInfo && (
                    <div className={`mb-3 px-3.5 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                      reminderInfo.type === 'overdue'
                        ? 'bg-rose-950/60 border-rose-800/80 text-rose-200'
                        : reminderInfo.type === 'today'
                        ? 'bg-amber-950/70 border-amber-700 text-amber-200'
                        : isDarkMode
                        ? 'bg-sky-950/50 border-sky-800/80 text-sky-200'
                        : 'bg-sky-50 border-sky-200 text-sky-900'
                    }`}>
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <Bell className={`w-4 h-4 shrink-0 ${
                          reminderInfo.type === 'overdue' ? 'text-rose-400' : reminderInfo.type === 'today' ? 'text-amber-400' : 'text-sky-400'
                        }`} />
                        <span>
                          {reminderInfo.type === 'today'
                            ? `${t.reminderBadgePrefix}: ${t.reminderToday}`
                            : reminderInfo.type === 'upcoming'
                            ? `${t.reminderBadgePrefix}: H-${reminderInfo.daysLeft} (${reminderInfo.daysLeft} ${t.reminderDaysLeft})`
                            : `${t.reminderBadgePrefix}: ${t.lateStatusBadge} (${reminderInfo.daysOverdue} ${t.daysLateText})`}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyReminder(debt, reminderInfo, effectiveTotalAmount)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition shadow-sm ${
                          copiedDebtId === debt.id
                            ? 'bg-emerald-600 text-white'
                            : isDarkMode
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600'
                            : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
                        }`}>
                        {copiedDebtId === debt.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedDebtId === debt.id ? t.copiedReminderBtn : t.copyReminderBtn}
                      </button>
                    </div>
                  )}

                  {/* Mode Ekspansi Penuh / Detail Kartu */}
                  {!isMinimized && (
                    <>
                      <div className={`grid grid-cols-2 gap-2 my-4 text-sm p-3 rounded-xl border ${bgInnerBox}`}>
                        <div>
                          <span className="text-slate-400 text-xs block">{t.loanType}</span>
                          <span className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{debt.type}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-xs block">{t.status}</span>
                          <span className={`font-bold px-2 py-0.5 rounded text-xs inline-block mt-0.5 ${isFullyPaid ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : lateInfo.isLate ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                            {isFullyPaid ? t.statusOptions.paid : lateInfo.isLate ? `${t.lateStatusBadge} (${lateInfo.daysLate} ${t.daysLateText})` : (t.statusOptions[debt.statusKey] || debt.status || t.statusOptions.active)}
                          </span>
                        </div>
                        <div className="mt-2">
                          <span className="text-slate-400 text-xs block">{t.payMethod}</span>
                          <span className={`font-medium flex items-center gap-1.5 mt-0.5 text-xs px-2 py-1 rounded-lg border w-fit ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`}>
                            {getPayMethodIcon(debt.paymentMethodKey)}
                            {t.methods[debt.paymentMethodKey] || debt.paymentMethod || t.methods.transfer}
                          </span>
                          {debt.paymentAccountInfo && debt.paymentMethodKey !== 'cash' && (
                            <div className={`text-[11px] font-mono mt-1 px-2 py-1 rounded border w-fit space-y-0.5 ${isDarkMode ? 'bg-slate-900 text-sky-300 border-slate-700' : 'bg-slate-100 text-sky-700 border-slate-300'}`}>
                              {debt.paymentAccountInfo.split(/\s*\/\s*/).filter(Boolean).map((acc, i) => (
                                <div key={i}>• {acc}</div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="mt-2">
                          <span className="text-slate-400 text-xs block">{t.tenor}</span>
                          <span className={`font-medium flex items-center gap-1 mt-0.5 text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                            <Calendar className={`w-3.5 h-3.5 ${themeStyle.textAccent}`} /> {debt.startDate} {t.until} {debt.dueDate || t.flexible}
                          </span>
                          {(debt.dueDate || debt.isInstallment) && (
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              • {t.gracePeriodInfo} {displayLatePercent > 0 ? `• ${t.penaltyShort} ${displayLatePercent}%` : ''}
                            </span>
                          )}
                        </div>

                        <div className={`col-span-2 mt-2 pt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                          <span className="text-slate-400 text-xs block">{t.collateral}</span>
                          <span className={`font-medium flex items-center gap-1 mt-0.5 text-xs ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                            {debt.collateral ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-slate-400" />}
                            {debt.collateral ? (debt.collateralDesc || t.hasCollateralText) : t.noCollateralText}
                          </span>
                        </div>

                        <div className={`col-span-2 mt-2 pt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                          <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                              <span className="text-slate-400 text-xs">{t.totalPaidSoFar}</span>
                              <span className="font-bold text-emerald-400 text-xs mt-0.5">
                                {dSym} {(debt.totalPaidAmount || 0).toLocaleString()} / {dSym} {effectiveTotalAmount.toLocaleString()}
                              </span>
                            </div>
                            <button
                              onClick={() => openPayModal(debt)}
                              disabled={isFullyPaid}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${isFullyPaid ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : `${themeStyle.bgAccent} text-white shadow`}`}>
                              <Plus className="w-3.5 h-3.5" /> {t.quickPay}
                            </button>
                          </div>

                          {debt.paymentHistory && debt.paymentHistory.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-dashed border-slate-700/60 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-1">
                              <span className="flex items-center gap-1 flex-wrap">
                                <History className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span>{t.lastPaidText}: {debt.paymentHistory[0].timestamp}</span>
                                {formatHistoryLogSummary(debt.paymentHistory[0], dCurr, debt) && (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    (Number(debt.paymentHistory[0].daysLate) > 0 || Number(debt.paymentHistory[0].lateFeeCharged) > 0)
                                      ? 'bg-rose-950/70 text-rose-300 border border-rose-800/60'
                                      : isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                                  }`}>
                                    {formatHistoryLogSummary(debt.paymentHistory[0], dCurr, debt)}
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-emerald-400">+{dSym} {debt.paymentHistory[0].amount.toLocaleString()}</span>
                                <button
                                  type="button"
                                  onClick={() => handleUndoLastPayment(debt)}
                                  className="px-1.5 py-0.5 rounded bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/70 text-[10px] font-semibold transition"
                                  title={t.undoLastPayTitle}
                                >
                                  {t.undoLastPay}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {debt.image && (
                        <div className="mb-4">
                          <span className="text-xs text-slate-400 block mb-1">{t.proof}</span>
                          <img src={debt.image} alt={t.proofAltText} className="w-full h-24 object-cover rounded-xl border border-slate-700 shadow" />
                        </div>
                      )}
                    </>
                  )}

                  {/* Progress Bar */}
                  <div className="my-3">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>{t.progress}</span>
                      <span>{Math.round(progressPercent)}%</span>
                    </div>
                    <div className={`w-full h-2.5 rounded-full overflow-hidden border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-200 border-slate-300'}`}>
                      <div
                        className={`h-full transition-all duration-500 ${isFullyPaid ? 'bg-emerald-500' : lateInfo.isLate ? 'bg-rose-500' : themeStyle.progressBar}`}
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className={`flex items-center justify-between pt-3 border-t mt-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditDebt(debt)}
                      className={`p-2 rounded-lg transition ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
                      title={t.edit}>
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteDebt(debt.id)}
                      className="p-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-lg transition border border-rose-900"
                      title={t.delete}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleDownloadHTMLDetail(debt)}
                    className={`px-3.5 py-2 border rounded-xl font-medium text-xs transition flex items-center gap-1.5 shadow ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'}`}>
                    <Download className={`w-4 h-4 ${themeStyle.textAccent}`} /> {t.downloadDetail}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: Form Tambah / Edit Pinjaman */}
      {/* MODAL: Form Tambah / Edit Pinjaman */}
      <DebtFormModal
        language={language}
        isOpen={isDebtModalOpen}
        onClose={() => {
          setIsDebtModalOpen(false);
          setEditingDebtData(null);
        }}
        onSubmitDebt={handleSaveDebt}
        initialData={editingDebtData}
        managerCurrency={managerCurrency}
        liveRates={liveRates}
        categories={categories}
        loanTypes={loanTypes}
        currenciesList={currenciesList}
        themeStyle={themeStyle}
        isDarkMode={isDarkMode}
        modalBg={modalBg}
        bgInnerBox={bgInnerBox}
        inputBg={inputBg}
        t={t}
      />
      {/* MODAL: Quick Pay / Pencatatan Pembayaran dengan Tanggal & Jam Otomatis/Manual */}
      {isPayModalOpen && selectedDebtForPay && (() => {
        const payModalLateInfo = calculateLateStatus(selectedDebtForPay, payCustomDate);
        const modalEffectiveTotal = payModalLateInfo.effectiveTotal;
        const modalRemaining = Math.max(modalEffectiveTotal - (selectedDebtForPay.totalPaidAmount || 0), 0);

        return (
          <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 pb-24 sm:pb-6 overflow-y-auto">
            <div className={`border rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl my-auto max-h-[82vh] overflow-y-auto ${modalBg}`}>
              <h3 className={`text-lg font-bold mb-1 ${themeStyle.textAccent}`}>{t.payModalTitle}</h3>
              <p className="text-xs text-slate-400 mb-4">{selectedDebtForPay.name} — {selectedDebtForPay.type}</p>

              <div className={`p-3 rounded-xl border mb-4 text-xs space-y-1.5 ${bgInnerBox}`}>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t.totalWithBonus}:</span>
                  <span className="font-bold">{getCurrencySymbolDynamic(selectedDebtForPay.currency || managerCurrency)} {selectedDebtForPay.amount.toLocaleString()}</span>
                </div>
                {payModalLateInfo.isLate && (
                  <div className="flex justify-between text-rose-400">
                    <span>{t.lateFeeAmountLabel} ({payModalLateInfo.effectiveLatePercent}% • {payModalLateInfo.daysLate} {t.daysLateText}):</span>
                    <span className="font-bold">+{getCurrencySymbolDynamic(selectedDebtForPay.currency || managerCurrency)} {payModalLateInfo.lateFeeAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">{t.totalPaidSoFar}:</span>
                  <span className="font-bold text-emerald-400">{getCurrencySymbolDynamic(selectedDebtForPay.currency || managerCurrency)} {(selectedDebtForPay.totalPaidAmount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-700/60">
                  <span className="text-slate-400">{t.remaining}:</span>
                  <span className="font-bold text-amber-400">
                    {getCurrencySymbolDynamic(selectedDebtForPay.currency || managerCurrency)} {modalRemaining.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.payAmountLabel}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberWithSeparator(payCustomAmount)}
                    onChange={(e) => setPayCustomAmount(e.target.value.replace(/\D/g, ''))}
                    className={`w-full rounded-xl p-2.5 text-sm font-bold border ${inputBg}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">{t.payMethodTxLabel}</label>
                  <select
                    value={payTxMethodKey}
                    onChange={(e) => setPayTxMethodKey(e.target.value)}
                    className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`}
                  >
                    <option value="transfer">{t.methods.transfer}</option>
                    <option value="ewallet">{t.methods.ewallet}</option>
                    <option value="cash">{t.methods.cash}</option>
                    <option value="flexible">{t.methods.flexible}</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {t.payDateLabel}
                    </label>
                    <input
                      type="date"
                      value={payCustomDate}
                      onChange={(e) => setPayCustomDate(e.target.value)}
                      className={`w-full rounded-xl p-2 text-xs border ${inputBg}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {t.payTimeLabel}
                    </label>
                    <input
                      type="time"
                      value={payCustomTime}
                      onChange={(e) => setPayCustomTime(e.target.value)}
                      className={`w-full rounded-xl p-2 text-xs border ${inputBg}`}
                    />
                  </div>
                </div>

                {selectedDebtForPay.isInstallment && (
                  <button
                    type="button"
                    onClick={() => handleProcessPayment('one_term')}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs border transition flex items-center justify-center gap-2 ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'}`}>
                    {t.payOneTerm} ({getCurrencySymbolDynamic(selectedDebtForPay.currency || managerCurrency)} {Math.round((selectedDebtForPay.installmentAmount || (selectedDebtForPay.amount / (selectedDebtForPay.installmentCount || 1))) + (payModalLateInfo.pendingLateFee || 0)).toLocaleString()})
                  </button>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPayModalOpen(false)}
                    className={`flex-1 py-2.5 rounded-xl font-medium text-xs ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProcessPayment('custom')}
                    className={`flex-1 py-2.5 bg-gradient-to-r ${themeStyle.gradientBtn} text-white rounded-xl font-bold text-xs shadow-lg`}>
                    {t.submitPay}
                  </button>
                </div>
              </div>

              <div className={`mt-5 pt-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-emerald-400" /> {t.paymentHistoryTitle}
                </h4>
                {(!selectedDebtForPay.paymentHistory || selectedDebtForPay.paymentHistory.length === 0) ? (
                  <p className="text-xs text-slate-500 italic">{t.noHistoryYet}</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {selectedDebtForPay.paymentHistory.map((log) => {
                      const logDetail = formatHistoryLogSummary(log, selectedDebtForPay.currency || managerCurrency, selectedDebtForPay);
                      const hasLateDetail = Number(log.daysLate) > 0 || Number(log.lateFeeCharged) > 0;
                      return (
                        <div key={log.id} className={`flex flex-col p-2.5 rounded-lg border text-xs gap-1 ${bgInnerBox}`}>
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-slate-400 font-medium">{log.timestamp}</span>
                            <span className="font-bold text-emerald-400 shrink-0">+{getCurrencySymbolDynamic(selectedDebtForPay.currency || managerCurrency)} {log.amount.toLocaleString()}</span>
                          </div>
                          {logDetail && (
                            <div className={`text-[11px] font-medium ${hasLateDetail ? 'text-rose-400' : 'text-slate-400'}`}>
                              {logDetail}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Manage Categories */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 pb-24 sm:pb-6 overflow-y-auto">
          <div className={`border rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl my-auto max-h-[82vh] overflow-y-auto ${modalBg}`}>
            <h3 className={`text-lg font-bold mb-4 ${themeStyle.textAccent}`}>{t.catManagerTitle}</h3>
            <div className="flex gap-2 mb-4">
              <input type="text" placeholder={t.newCatPlaceholder} value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className={`flex-1 rounded-xl px-3 py-2 text-sm border ${inputBg}`} />
              <button onClick={() => { if (newCatName.trim()) { setCategories([...categories, newCatName.trim()]); setNewCatName(''); } }} className={`px-4 py-2 ${themeStyle.bgAccent} text-white rounded-xl font-bold text-sm`}>
                {t.add}
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {categories.map((cat, idx) => (
                <div key={idx} className={`flex justify-between items-center p-2.5 rounded-xl border ${bgInnerBox}`}>
                  <span className="text-sm font-medium">{cat}</span>
                  <button onClick={() => setCategories(categories.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-300 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setIsCategoryModalOpen(false)} className={`mt-5 w-full py-2.5 rounded-xl font-medium text-sm ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Manage Loan Types */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 pb-24 sm:pb-6 overflow-y-auto">
          <div className={`border rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl my-auto max-h-[82vh] overflow-y-auto ${modalBg}`}>
            <h3 className="text-lg font-bold text-emerald-500 mb-4">{t.typeManagerTitle}</h3>
            <div className="flex gap-2 mb-4">
              <input type="text" placeholder={t.newTypePlaceholder} value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} className={`flex-1 rounded-xl px-3 py-2 text-sm border ${inputBg}`} />
              <button onClick={() => { if (newTypeName.trim()) { setLoanTypes([...loanTypes, newTypeName.trim()]); setNewTypeName(''); } }} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm">
                {t.add}
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {loanTypes.map((tp, idx) => (
                <div key={idx} className={`flex justify-between items-center p-2.5 rounded-xl border ${bgInnerBox}`}>
                  <span className="text-sm font-medium">{tp}</span>
                  <button onClick={() => setLoanTypes(loanTypes.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-300 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setIsTypeModalOpen(false)} className={`mt-5 w-full py-2.5 rounded-xl font-medium text-sm ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
              {t.close}
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastInfo && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-[1000] max-w-sm animate-fade-in">
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold flex items-center gap-2.5 ${
              toastInfo.type === 'error'
                ? 'bg-rose-950/95 border-rose-700 text-rose-200'
                : 'bg-emerald-950/95 border-emerald-700 text-emerald-200'
            }`}
          >
            <Check className="w-4 h-4 shrink-0" />
            <span>{toastInfo.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
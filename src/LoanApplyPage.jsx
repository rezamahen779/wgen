import React, { useEffect, useState } from 'react';
import {
  getQrLinkByToken,
  submitLoanApplication,
  getLoanApplicationById,
  resubmitLoanCounterOffer,
  submitInstallmentPaymentReport
} from './services/qrLoanService';
import {
  fetchLiveExchangeRates,
  convertCurrencyDynamic,
  getCurrencySymbolDynamic
} from './lib/currencyService';

const CURRENCY_CODES = [
  'AED',
  'AUD',
  'CNY',
  'EUR',
  'GBP',
  'IDR',
  'JPY',
  'KRW',
  'MYR',
  'SAR',
  'SGD',
  'THB',
  'USD'
];

// Fallback kurs jika belum ada cache/internet lambat (basis 1 USD)
const FALLBACK_USD_RATES = {
  USD: 1,
  IDR: 17000,
  JPY: 153,
  SGD: 1.34,
  MYR: 4.45,
  SAR: 3.75,
  AED: 3.67,
  EUR: 0.92,
  GBP: 0.79,
  AUD: 1.53,
  CNY: 7.24,
  KRW: 1390,
  THB: 34.2
};

// Format angka mata uang rapi sesuai karakteristik pecahan mata uang
function formatCurrencyAmount(amount, currencyCode) {
  const code = (currencyCode || 'IDR').toUpperCase();
  const symbol = getCurrencySymbolDynamic(code);
  const num = Number(amount) || 0;
  const zeroDecimalCodes = ['IDR', 'JPY', 'KRW'];
  const formatted = zeroDecimalCodes.includes(code)
    ? Math.round(num).toLocaleString('id-ID')
    : num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${symbol} ${formatted}`;
}

// Format tampilan angka dengan pemisah ribuan titik (.) dan desimal koma (,) saat mengetik
function formatNumberInputDisplay(rawNumericStr, currencyCode) {
  if (rawNumericStr === '' || rawNumericStr === null || rawNumericStr === undefined) return '';
  const code = (currencyCode || 'IDR').toUpperCase();
  const zeroDecimalCodes = ['IDR', 'JPY', 'KRW'];
  const str = String(rawNumericStr);
  const [intPart, decPart] = str.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (!zeroDecimalCodes.includes(code) && decPart !== undefined) {
    return `${formattedInt},${decPart.slice(0, 2)}`;
  }
  return formattedInt;
}

// Ubah teks berformat titik/koma kembali ke string angka murni (misal "1.500.000" -> "1500000")
function parseNumberInputToRaw(inputStr, currencyCode) {
  const code = (currencyCode || 'IDR').toUpperCase();
  const zeroDecimalCodes = ['IDR', 'JPY', 'KRW'];

  if (zeroDecimalCodes.includes(code)) {
    return inputStr.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
  }

  let cleaned = inputStr.replace(/\./g, '').replace(/[^0-9,]/g, '');
  const parts = cleaned.split(',');
  const intPart = (parts[0] || '').replace(/^0+(?=\d)/, '');
  if (parts.length > 1) {
    return `${intPart || '0'},${parts[1].slice(0, 2)}`.replace(',', '.');
  }
  return intPart;
}

// Konversi nominal batas IDR ke mata uang target dengan pembulatan bersih
function convertIdrLimit(idrAmount, targetCurrency, rates) {
  const code = (targetCurrency || 'IDR').toUpperCase();
  if (code === 'IDR') return idrAmount;
  const converted = convertCurrencyDynamic(idrAmount, 'IDR', code, rates);
  if (converted <= 0) return idrAmount;
  const zeroDecimalCodes = ['JPY', 'KRW'];
  if (zeroDecimalCodes.includes(code)) {
    return Math.max(1, Math.round(converted));
  }
  return converted < 10 ? Number(converted.toFixed(2)) : Math.max(1, Math.round(converted));
}

// Membangun 3 Kontrak secara dinamis mengikuti mata uang & kurs live
function buildDynamicContracts(currencyCode, rates) {
  const code = (currencyCode || 'IDR').toUpperCase();
  const f = (idrVal) => formatCurrencyAmount(convertIdrLimit(idrVal, code, rates), code);

  const microMin = f(100000);
  const microMax = f(500000);
  const stdMin = f(300000);
  const tierAMax = f(10999999);
  const tierBMin = f(11000000);
  const stdMax = f(50000000);

  return [
    {
      id: 'micro_unsecured',
      badge: 'KONTRAK 1',
      title: 'PERJANJIAN PINJAMAN MIKRO (TANPA JAMINAN)',
      subtitle: `Khusus pinjaman nominal kecil (${microMin} – ${microMax}) [${code}] tanpa agunan fisik.`,
      approvalBadge: 'Tingkat Keberhasilan ACC: Cukup Tinggi',
      approvalBadgeClass: 'bg-emerald-900/80 border-emerald-600/70 text-emerald-300',
      minIdr: 100000,
      maxIdr: 500000,
      requiresCollateral: false,
      pasal1Items: [
        '1. Jumlah pinjaman pokok sesuai nominal dan mata uang yang disepakati pada formulir ini.',
        '2. Tanggal pencairan dana dan tanggal jatuh tempo pelunasan akhir dihitung sesuai tenor yang disetujui.',
        '3. Toleransi pembayaran (Grace Period): 1 (satu) hari kalender setelah tanggal jatuh tempo.',
        '4. Denda keterlambatan mulai berlaku pada hari berikutnya (H+2) setelah masa toleransi berakhir.',
        '5. Imbalan jasa / hadiah pinjaman yang disepakati (standar 12,5% atau hasil kesepakatan penawaran) merupakan kewajiban Pihak Kedua untuk dibayarkan kepada Pihak Pertama.'
      ],
      pasal2Intro:
        'Denda dihitung berdasarkan pokok pinjaman awal, bukan berdasarkan sisa angsuran, dan tidak menggunakan sistem bunga majemuk.',
      pasal2Items: [
        `- Ketentuan Denda Pinjaman Mikro (${microMin} – ${microMax}) [${code}]: H+1 s.d. H+28 denda tetap 5%, mulai H+29 tambah 2,5% tiap periode 28 hari, maksimal 32,5%.`,
        `Skema denda aktif pada perjanjian ini: Skema Khusus Pinjaman Mikro (${microMin} – ${microMax}).`
      ],
      pasal3Title: 'PASAL 3 - STATUS PINJAMAN TANPA JAMINAN',
      pasal3Items: [
        '1. Pinjaman ini diberikan atas dasar kepercayaan pribadi antara Pihak Pertama dan Pihak Kedua tanpa penyerahan barang jaminan atau agunan fisik (Unsecured Personal Loan).',
        '2. Pihak Kedua bertanggung jawab penuh secara pribadi atas pelunasan seluruh pokok pinjaman, imbalan jasa yang disepakati, serta denda keterlambatan (apabila ada) tepat pada waktunya.',
        '3. Seluruh harta kekayaan Pihak Kedua menjadi tanggungan pemenuhan perikatan sesuai ketentuan hukum perdata yang berlaku.'
      ],
      pasal4Title: 'PASAL 4 - WANPRESTASI & PENYELESAIAN KEWAJIBAN',
      pasal4Items: [
        '1. Apabila Pihak Kedua terlambat melakukan pembayaran melewati masa toleransi, Pihak Pertama berhak menyampaikan peringatan penagihan secara lisan maupun tertulis.',
        '2. Pihak Kedua wajib menyelesaikan seluruh kewajiban pembayaran yang telah jatuh tempo, termasuk sisa pokok pinjaman, imbalan jasa, dan denda keterlambatan yang timbul sesuai ketentuan Pasal 2.',
        '3. Khusus pinjaman dengan tenor 1 (satu) bulan, apabila Pihak Kedua tidak melakukan pelunasan setelah melewati tanggal jatuh tempo dan masa toleransi, Pihak Kedua tetap berkewajiban melunasi seluruh sisa pokok pinjaman beserta denda keterlambatan.',
        '4. Apabila tunggakan berlangsung selama 2 (dua) bulan berturut-turut, para pihak wajib bermusyawarah untuk menyusun jadwal pelunasan tertulis (restrukturisasi) atau penyelesaian kewajiban secara kekeluargaan.',
        '5. Apabila musyawarah tidak mencapai kesepakatan, Pihak Pertama berhak menempuh upaya penyelesaian hukum secara perdata sesuai peraturan perundang-undangan yang berlaku dengan dokumen perjanjian ini sebagai alat bukti.'
      ],
      pasal5Items: [
        '1. Kedua belah pihak menyatakan telah membaca, memahami, dan menyetujui seluruh isi perjanjian ini dalam keadaan sadar dan tanpa paksaan dari pihak mana pun.',
        '2. Perjanjian ini sah ditandatangani secara elektronik maupun dicetak fisik dengan tanda tangan basah, cap sidik jari, dan Bea Meterai sesuai ketentuan hukum yang berlaku.',
        '3. Seluruh lampiran rincian transaksi, riwayat pembayaran, simulasi tenor, dan dokumentasi foto merupakan satu kesatuan yang tidak terpisahkan dari perjanjian ini.'
      ]
    },
    {
      id: 'standard_unsecured',
      badge: 'KONTRAK 2',
      title: 'PERJANJIAN PINJAMAN PRIBADI STANDAR (TANPA JAMINAN)',
      subtitle: `Pinjaman reguler (${stdMin} – ${stdMax}) [${code}] tanpa penyerahan aset agunan fisik.`,
      approvalBadge: '⚠ Tingkat Keberhasilan ACC: < 5% (Sangat Kecil)',
      approvalBadgeClass: 'bg-rose-950/90 border-rose-600/80 text-rose-300',
      minIdr: 300000,
      maxIdr: 50000000,
      requiresCollateral: false,
      pasal1Items: [
        '1. Jumlah pinjaman pokok sesuai nominal dan mata uang yang disepakati pada formulir ini.',
        '2. Tanggal pencairan dana dan tanggal jatuh tempo pelunasan akhir dihitung sesuai tenor yang disetujui.',
        '3. Toleransi pembayaran (Grace Period): 1 (satu) hari kalender setelah tanggal jatuh tempo.',
        '4. Denda keterlambatan mulai berlaku pada hari berikutnya (H+2) setelah masa toleransi berakhir.',
        '5. Imbalan jasa / hadiah pinjaman yang disepakati (khusus skema Kontrak 2 sebesar 20% atau hasil kesepakatan lelang penawaran) merupakan kewajiban Pihak Kedua untuk dibayarkan kepada Pihak Pertama.'
      ],
      pasal2Intro:
        'Denda dihitung berdasarkan pokok pinjaman awal, bukan berdasarkan sisa angsuran, dan tidak menggunakan sistem bunga majemuk.',
      pasal2Items: [
        `A. Pinjaman ${stdMin} – ${tierAMax} (Tier A) [${code}]`,
        '- Keterlambatan hari ke-1 s.d. ke-28 (setelah grace period): denda tetap sebesar 5% dari pokok pinjaman.',
        '- Mulai hari ke-29: tambahan denda sebesar 2,5% untuk setiap periode 28 hari berikutnya.',
        '- Akumulasi denda maksimal adalah 32,5% dari pokok pinjaman.',
        `B. Pinjaman ${tierBMin} – ${stdMax} (Tier B) [${code}]`,
        '- Denda dihitung sebesar 2,71% dari pokok pinjaman untuk setiap periode 28 hari keterlambatan.',
        '- Perhitungan mengacu pada 32,5% dibagi maksimal 12 periode.',
        '- Akumulasi denda maksimal adalah 32,5% dari pokok pinjaman.',
        'Skema denda aktif pada perjanjian ini: Otomatis Berjenjang (Standar Kontrak).'
      ],
      pasal3Title: 'PASAL 3 - STATUS PINJAMAN TANPA JAMINAN',
      pasal3Items: [
        '1. Pinjaman ini diberikan atas dasar kepercayaan pribadi antara Pihak Pertama dan Pihak Kedua tanpa penyerahan barang jaminan atau agunan fisik (Unsecured Personal Loan).',
        '2. Pihak Kedua bertanggung jawab penuh secara pribadi atas pelunasan seluruh pokok pinjaman, imbalan jasa yang disepakati, serta denda keterlambatan (apabila ada) tepat pada waktunya.',
        '3. Seluruh harta kekayaan Pihak Kedua menjadi tanggungan pemenuhan perikatan sesuai ketentuan hukum perdata yang berlaku.'
      ],
      pasal4Title: 'PASAL 4 - WANPRESTASI & PENYELESAIAN KEWAJIBAN',
      pasal4Items: [
        '1. Apabila Pihak Kedua terlambat melakukan pembayaran melewati masa toleransi, Pihak Pertama berhak menyampaikan peringatan penagihan secara lisan maupun tertulis.',
        '2. Pihak Kedua wajib menyelesaikan seluruh kewajiban pembayaran yang telah jatuh tempo, termasuk sisa pokok pinjaman, imbalan jasa yang disepakati, serta denda keterlambatan sesuai ketentuan Pasal 2.',
        '3. Khusus pinjaman dengan tenor 1 (satu) bulan, kewajiban pelunasan penuh tetap berlaku setelah tanggal jatuh tempo dan masa toleransi berakhir.',
        '4. Apabila tunggakan berlangsung selama 2 (dua) bulan berturut-turut, para pihak wajib bermusyawarah untuk menyusun jadwal pelunasan tertulis atau penyelesaian kewajiban secara kekeluargaan.',
        '5. Apabila musyawarah tidak mencapai kesepakatan, Pihak Pertama berhak menempuh penyelesaian hukum secara perdata menggunakan perjanjian elektronik/cetak beserta lampiran bukti identitas sebagai alat bukti sah.'
      ],
      pasal5Items: [
        '1. Kedua belah pihak menyatakan telah membaca, memahami, dan menyetujui seluruh isi perjanjian ini dalam keadaan sadar dan tanpa paksaan dari pihak mana pun.',
        '2. Perjanjian ini sah ditandatangani secara elektronik maupun dicetak fisik dengan tanda tangan basah, cap sidik jari, dan Bea Meterai sesuai ketentuan hukum yang berlaku.',
        '3. Seluruh lampiran rincian transaksi, riwayat pembayaran, simulasi tenor, dan dokumentasi foto merupakan satu kesatuan yang tidak terpisahkan dari perjanjian ini.'
      ]
    },
    {
      id: 'secured_collateral',
      badge: 'KONTRAK 3',
      title: 'PERJANJIAN PINJAMAN PRIBADI DAN JAMINAN',
      subtitle: `Pinjaman dengan jaminan (${stdMin} – ${stdMax}) [${code}]. Wajib menyerahkan keterangan barang agunan beserta 2 foto bukti fisik jaminan.`,
      approvalBadge: 'Tingkat Keberhasilan ACC: Cukup Tinggi',
      approvalBadgeClass: 'bg-sky-950/90 border-sky-600/70 text-sky-300',
      minIdr: 300000,
      maxIdr: 50000000,
      requiresCollateral: true,
      pasal1Items: [
        '1. Jumlah pinjaman pokok sesuai nominal dan mata uang yang disepakati pada formulir ini.',
        '2. Tanggal pencairan dana dan tanggal jatuh tempo pelunasan akhir dihitung sesuai tenor yang disetujui.',
        '3. Toleransi pembayaran (Grace Period): 1 (satu) hari kalender setelah tanggal jatuh tempo.',
        '4. Denda keterlambatan mulai berlaku pada hari berikutnya (H+2) setelah masa toleransi berakhir.',
        '5. Imbalan jasa / hadiah pinjaman yang disepakati (standar 12,5% atau hasil kesepakatan penawaran) merupakan kewajiban Pihak Kedua untuk dibayarkan kepada Pihak Pertama.'
      ],
      pasal2Intro:
        'Denda dihitung berdasarkan pokok pinjaman awal, bukan berdasarkan sisa angsuran, dan tidak menggunakan sistem bunga majemuk.',
      pasal2Items: [
        `A. Pinjaman ${stdMin} – ${tierAMax} (Tier A) [${code}]`,
        '- Keterlambatan hari ke-1 s.d. ke-28 (setelah grace period): denda tetap sebesar 5% dari pokok pinjaman.',
        '- Mulai hari ke-29: tambahan denda sebesar 2,5% untuk setiap periode 28 hari berikutnya.',
        '- Akumulasi denda maksimal adalah 32,5% dari pokok pinjaman.',
        `B. Pinjaman ${tierBMin} – ${stdMax} (Tier B) [${code}]`,
        '- Denda dihitung sebesar 2,71% dari pokok pinjaman untuk setiap periode 28 hari keterlambatan.',
        '- Perhitungan mengacu pada 32,5% dibagi maksimal 12 periode.',
        '- Akumulasi denda maksimal adalah 32,5% dari pokok pinjaman.',
        'Skema denda aktif pada perjanjian ini: Otomatis Berjenjang (Standar Kontrak).'
      ],
      pasal3Title: 'PASAL 3 - JAMINAN / AGUNAN',
      pasal3Items: [
        '1. Pinjaman ini disertai jaminan/agunan yang nilai wajar dan jenisnya telah disepakati bersama oleh kedua belah pihak (nilai jaminan wajib melebihi pokok pinjaman).',
        '2. Rincian jaminan yang diserahkan wajib dicantumkan secara jujur dan akurat pada formulir pengajuan ini.',
        '3. Pihak Kedua menjamin sepenuhnya bahwa barang/aset jaminan tersebut merupakan milik sahnya atau telah memperoleh persetujuan tertulis dari pemilik sah serta tidak sedang dalam sengketa.',
        '4. Foto dan dokumentasi fisik jaminan (2 foto lampiran) merupakan bagian tidak terpisahkan dari perjanjian ini.'
      ],
      pasal4Title: 'PASAL 4 - WANPRESTASI & PENYELESAIAN JAMINAN',
      pasal4Items: [
        '1. Apabila Pihak Kedua terlambat melakukan pembayaran melewati masa toleransi, Pihak Pertama berhak menyampaikan peringatan penagihan secara lisan maupun tertulis.',
        '2. Pihak Kedua tetap berkewajiban menyelesaikan seluruh kewajiban pembayaran yang telah jatuh tempo, termasuk sisa pokok pinjaman, imbalan jasa yang disepakati, serta denda keterlambatan sesuai ketentuan Pasal 2.',
        '3. Khusus pinjaman dengan tenor 1 (satu) bulan, apabila Pihak Kedua tidak melakukan pelunasan setelah melewati tanggal jatuh tempo dan masa toleransi, kewajiban pembayaran tetap berlaku dan penyelesaian dapat dilakukan melalui musyawarah atau mekanisme hukum yang berlaku.',
        '4. Apabila tunggakan berlangsung selama 2 (dua) bulan berturut-turut, para pihak sepakat mengupayakan penyelesaian melalui musyawarah dan penjualan barang jaminan sesuai mekanisme hukum yang berlaku.',
        '5. Hasil penjualan barang jaminan digunakan untuk melunasi sisa pokok pinjaman, imbalan jasa yang disepakati, denda keterlambatan yang sah, serta biaya penjualan yang wajar.',
        '6. Apabila terdapat kelebihan hasil penjualan setelah seluruh kewajiban dilunasi, selisihnya wajib dikembalikan kepada Pihak Kedua. Sebaliknya, apabila hasil penjualan belum mencukupi, sisa kewajiban tetap menjadi tanggung jawab Pihak Kedua.',
        '7. Barang jaminan tidak otomatis menjadi hak milik Pihak Pertama tanpa kesepakatan pelepasan hak atau proses eksekusi yang sah sesuai peraturan perundang-undangan.'
      ],
      pasal5Items: [
        '1. Kedua belah pihak menyatakan telah membaca, memahami, dan menyetujui seluruh isi perjanjian ini dalam keadaan sadar dan tanpa paksaan dari pihak mana pun.',
        '2. Perjanjian ini sah ditandatangani secara elektronik maupun dicetak fisik dengan tanda tangan basah, cap sidik jari, dan Bea Meterai sesuai ketentuan hukum yang berlaku.',
        '3. Seluruh lampiran rincian transaksi, riwayat pembayaran, simulasi tenor, dan dokumentasi foto merupakan satu kesatuan yang tidak terpisahkan dari perjanjian ini.'
      ]
    }
  ];
}

async function compressImageToBase64(file, maxWidth = 1024, maxBytes = 750 * 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak valid.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.82;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        while (dataUrl.length * 0.75 > maxBytes && quality > 0.3) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function getPenaltyTierInfo(contractId, amount, currency, rates) {
  const num = Number(amount) || 0;
  const code = (currency || 'IDR').toUpperCase();
  const f = (idrVal) => formatCurrencyAmount(convertIdrLimit(idrVal, code, rates), code);

  if (contractId === 'micro_unsecured') {
    return {
      tierName: `Skema Khusus Pinjaman Mikro (${f(100000)} – ${f(500000)})`,
      firstPeriod: '5% dari pokok pinjaman (H+1 s.d. H+28 setelah grace period)',
      nextPeriod: '+2,5% untuk setiap periode 28 hari berikutnya',
      maxCap: '32,5% dari pokok pinjaman (tanpa bunga majemuk)',
      estFirstPenalty: num * 0.05,
      estMaxPenalty: num * 0.325
    };
  }

  const equivalentInIdr =
    code === 'IDR' ? num : convertCurrencyDynamic(num, code, 'IDR', rates);
  const isTierB = equivalentInIdr >= 11000000;

  if (isTierB) {
    return {
      tierName: `Otomatis Berjenjang — Tier B (${f(11000000)} – ${f(50000000)})`,
      firstPeriod: '2,71% dari pokok pinjaman per periode 28 hari keterlambatan',
      nextPeriod: '2,71% per periode 28 hari (32,5% dibagi maksimal 12 periode)',
      maxCap: '32,5% dari pokok pinjaman (tanpa bunga majemuk)',
      estFirstPenalty: num * 0.0271,
      estMaxPenalty: num * 0.325
    };
  }

  return {
    tierName: `Otomatis Berjenjang — Tier A (${f(300000)} – ${f(10999999)})`,
    firstPeriod: '5% dari pokok pinjaman (H+1 s.d. H+28 setelah grace period)',
    nextPeriod: '+2,5% untuk setiap periode 28 hari berikutnya',
    maxCap: '32,5% dari pokok pinjaman (tanpa bunga majemuk)',
    estFirstPenalty: num * 0.05,
    estMaxPenalty: num * 0.325
  };
}

// Helper: parse riwayat pembayaran dari database Turso (ticketData)
function extractInstallmentProgress(ticketData) {
  if (!ticketData) return null;

  const principal = Number(ticketData.requested_amount || 0);
  const rewardPct = Number(ticketData.reward_percent ?? 12.5);
  const rewardAmt = (principal * rewardPct) / 100;
  const totalDue = Number(ticketData.total_payable || principal + rewardAmt);
  const tenor = Math.max(1, Number(ticketData.approved_tenor_months || ticketData.tenor_months || 1));
  const isInstallment = Number(ticketData.is_installment) === 1 || Boolean(ticketData.is_installment);
  const installmentCount = isInstallment ? tenor : 1;
  const perTermAmount = totalDue / installmentCount;

  let rawHistory = [];
  if (Array.isArray(ticketData.installment_history)) {
    rawHistory = ticketData.installment_history;
  } else if (typeof ticketData.installment_history === 'string' && ticketData.installment_history.trim()) {
    try {
      rawHistory = JSON.parse(ticketData.installment_history);
    } catch {
      rawHistory = [];
    }
  } else if (Array.isArray(ticketData.payments)) {
    rawHistory = ticketData.payments;
  }

  const confirmedPaidAmount = Number(
    ticketData.paid_amount ??
      ticketData.total_paid ??
      rawHistory
        .filter((item) => item.status === 'verified' || item.status === 'paid' || item.verified)
        .reduce((acc, item) => acc + Number(item.amount || 0), 0)
  );

  const confirmedTermCount = Number(
    ticketData.paid_installments ??
      (perTermAmount > 0 ? Math.floor((confirmedPaidAmount + 0.01) / perTermAmount) : 0)
  );

  const remainingAmount = Math.max(0, totalDue - confirmedPaidAmount);
  const progressPercent =
    totalDue > 0 ? Math.min(100, Math.round((confirmedPaidAmount / totalDue) * 100)) : 0;

  return {
    principal,
    rewardPct,
    rewardAmt,
    totalDue,
    tenor,
    isInstallment,
    installmentCount,
    perTermAmount,
    confirmedPaidAmount,
    confirmedTermCount,
    remainingAmount,
    progressPercent,
    rawHistory
  };
}

// Deteksi tipe kontrak dari record ticketData
function detectTicketContractType(ticketData) {
  if (!ticketData) return 'standard_unsecured';
  if (ticketData.contract_type === 'secured_collateral') return 'secured_collateral';
  if (ticketData.contract_type === 'micro_unsecured') return 'micro_unsecured';

  const hasCollateralFlag =
    Number(ticketData.has_collateral) === 1 || Boolean(ticketData.has_collateral);
  const hasCollateralProof = Boolean(
    ticketData.collateral_desc ||
      ticketData.photo_collateral_1 ||
      ticketData.photo_collateral_2
  );

  if (hasCollateralFlag || hasCollateralProof) {
    return 'secured_collateral';
  }

  const code = (ticketData.currency || 'IDR').toUpperCase();
  const amt = Number(ticketData.requested_amount || 0);
  if (code === 'IDR' && amt <= 500000) return 'micro_unsecured';
  return 'standard_unsecured';
}

// Batas maksimal lelang imbalan jasa per kontrak: Kontrak 1 & 3 = 12.5%, Kontrak 2 = 20%
function getMaxAuctionRewardPercent(contractType) {
  return contractType === 'standard_unsecured' ? 20 : 12.5;
}

// Ekstrak rekening / e-wallet tujuan dari data tiket atau QR link kreditur
function extractDestinationAccount(ticketData, qrInfo) {
  const candidates = [
    ticketData?.payment_destination,
    ticketData?.destination_account,
    ticketData?.bank_destination,
    ticketData?.qr_payment_destination,
    ticketData?.payment_account,
    ticketData?.payment_account_info,
    ticketData?.paymentAccountInfo,
    ticketData?.default_payment_account,
    ticketData?.rekening_tujuan,
    qrInfo?.payment_destination,
    qrInfo?.destination_account,
    qrInfo?.bank_destination,
    qrInfo?.payment_account,
    qrInfo?.payment_account_info,
    qrInfo?.paymentAccountInfo,
    qrInfo?.default_payment_account,
    qrInfo?.rekening_tujuan
  ];

  for (const val of candidates) {
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return '';
}

// Ekstrak nominal pokok lelang dari kreditur (kolom counter_principal_amount atau tag [LELANG POKOK: ...])
function extractOfferedPrincipal(ticketData) {
  if (!ticketData) return 0;
  const direct = Number(ticketData.counter_principal_amount || 0);
  if (direct > 0) return direct;

  const text = `${ticketData.rejection_reason || ''} ${ticketData.collateral_feedback || ''}`;
  const match = text.match(/\[LELANG POKOK:\s*[A-Z]{3}\s*([\d.,]+)\]/i);
  if (!match) return 0;

  const digits = match[1].replace(/[^\d]/g, '');
  return Number(digits) || 0;
}

// Ekstrak tenor final yang ditetapkan kreditur (non-lelang)
function extractApprovedTenor(ticketData) {
  if (!ticketData) return 0;
  const direct = Number(ticketData.approved_tenor_months || 0);
  if (direct > 0) return direct;

  const text = `${ticketData.rejection_reason || ''}`;
  const match = text.match(/\[PERSETUJUAN TENOR FINAL:\s*(\d+)\s*BLN\]/i);
  if (match) return Number(match[1]) || 0;

  if (ticketData.status === 'tenor_offer') {
    return Number(ticketData.tenor_months || 0);
  }
  return 0;
}

export default function LoanApplyPage() {
  const params = new URLSearchParams(window.location.search);
  const tokenParam = params.get('token') || '';
  const ticketParam = params.get('ticket') || '';

  // Ubah judul tab browser menjadi formadd (tanpa mengubah favicon/logo)
  useEffect(() => {
    document.title = 'formadd';
  }, []);

  const [liveRates, setLiveRates] = useState(FALLBACK_USD_RATES);

  const [ticketInput, setTicketInput] = useState(ticketParam);
  const [trackingMode, setTrackingMode] = useState(Boolean(ticketParam && !tokenParam));
  const [ticketData, setTicketData] = useState(null);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [ticketError, setTicketError] = useState('');

  // State konfirmasi transfer cicilan oleh peminjam (tersimpan langsung ke Turso)
  const [showPaymentReportForm, setShowPaymentReportForm] = useState(false);
  const [paymentReport, setPaymentReport] = useState({
    installmentNumber: 1,
    amount: '',
    transferMethod: '',
    notes: '',
    proofImage: ''
  });
  const [submittingPaymentReport, setSubmittingPaymentReport] = useState(false);
  const [paymentReportSuccess, setPaymentReportSuccess] = useState('');
  const [auctionSuccessMsg, setAuctionSuccessMsg] = useState('');

  // State Sistem Lelang Multi-Opsi
  const [showAuctionForm, setShowAuctionForm] = useState(false);
  const [auctionMode, setAuctionMode] = useState('reward'); // 'reward' | 'principal' | 'collateral_value' | 'upgrade_collateral'
  const [newRewardPercent, setNewRewardPercent] = useState('12.5');
  const [newRequestedAmount, setNewRequestedAmount] = useState('');
  const [upgradeCollateralDesc, setUpgradeCollateralDesc] = useState('');
  const [upgradePhotoCollateral1, setUpgradePhotoCollateral1] = useState('');
  const [upgradePhotoCollateral2, setUpgradePhotoCollateral2] = useState('');
  const [submittingAuction, setSubmittingAuction] = useState(false);

  // State Respon Penawaran Pokok Kreditur (Oke / Tolak / Minta Tambah maks 5x)
  const [respondingRevisedPrincipal, setRespondingRevisedPrincipal] = useState(false);

  // State Respon Persetujuan Tenor Final Kreditur (Setuju / Tolak - Non-Lelang)
  const [respondingTenorOffer, setRespondingTenorOffer] = useState(false);

  // State Form Upload Bukti Drop Barang Jaminan
  const [showDropProofForm, setShowDropProofForm] = useState(false);
  const [dropProofPhoto, setDropProofPhoto] = useState('');
  const [dropProofNote, setDropProofNote] = useState('');
  const [submittingDropProof, setSubmittingDropProof] = useState(false);
  const [dropProofSuccessMsg, setDropProofSuccessMsg] = useState('');
  const [qrInfo, setQrInfo] = useState(null);
  const [loadingToken, setLoadingToken] = useState(Boolean(tokenParam));
  const [tokenError, setTokenError] = useState('');

  const [form, setForm] = useState({
    borrowerName: '',
    debtorId: '',
    debtorAddress: '',
    borrowerPhone: '',
    emergencyPhone: '',
    requestedAmount: '',
    currency: 'IDR',
    rewardPercent: '12.5',
    tenorMonths: '1',
    isInstallment: false,
    contractType: 'secured_collateral',
    collateralDesc: '',
    photoId: '',
    photoSelfie: '',
    photoSelfieId: '',
    photoCollateral1: '',
    photoCollateral2: '',
    notes: '',
    agreedAllClauses: false
  });

  const [submitting, setSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState(null);
  const [formError, setFormError] = useState('');
  const [copiedTicket, setCopiedTicket] = useState(false);

  // Load kurs live dari currencyService saat halaman dimuat
  useEffect(() => {
    let active = true;
    fetchLiveExchangeRates()
      .then((rates) => {
        if (active && rates && Object.keys(rates).length > 0) {
          setLiveRates((prev) => ({ ...prev, ...rates }));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const fetchTicketStatus = async (idToCheck) => {
    const cleanId = (idToCheck || '').trim();
    if (!cleanId) return;
    setLoadingTicket(true);
    setTicketError('');
    setAuctionSuccessMsg('');
    try {
      const app = await getLoanApplicationById(cleanId);
      if (!app) {
        setTicketError('Nomor tiket pengajuan tidak ditemukan. Periksa kembali ID Anda.');
        setTicketData(null);
      } else {
        setTicketData(app);
        const appContractType = detectTicketContractType(app);
        const maxReward = getMaxAuctionRewardPercent(appContractType);
        const initialReward = Math.min(maxReward, Number(app.reward_percent ?? maxReward));
        setNewRewardPercent(String(initialReward));
        setNewRequestedAmount(String(app.requested_amount || ''));
        setUpgradeCollateralDesc(app.collateral_desc || '');

        const lockedDest = extractDestinationAccount(app, qrInfo);
        const prog = extractInstallmentProgress(app);
        if (prog) {
          const nextTerm = Math.min(prog.installmentCount, prog.confirmedTermCount + 1);
          setPaymentReport((prev) => ({
            ...prev,
            installmentNumber: nextTerm,
            amount: String(Math.round(prog.perTermAmount)),
            transferMethod: lockedDest || prev.transferMethod || ''
          }));
          if (prog.confirmedTermCount >= Number(paymentReport.installmentNumber || 1)) {
            setPaymentReportSuccess('');
          }
        }
      }
    } catch (err) {
      setTicketError('Gagal mengambil status pengajuan dari server.');
    } finally {
      setLoadingTicket(false);
    }
  };

  useEffect(() => {
    if (ticketParam) {
      fetchTicketStatus(ticketParam);
    }
  }, [ticketParam]);

  useEffect(() => {
    if (!tokenParam) {
      setLoadingToken(false);
      return;
    }

    let mounted = true;
    async function validateToken() {
      try {
        const data = await getQrLinkByToken(tokenParam);
        if (!mounted) return;

        if (!data) {
          setTokenError('Tautan pengajuan pinjaman tidak valid atau tidak terdaftar.');
        } else if (Number(data.is_active) !== 1) {
          setTokenError('Tautan pengajuan ini sedang dinonaktifkan oleh pemberi pinjaman.');
        } else {
          setQrInfo(data);
          const lockedDest = extractDestinationAccount(null, data);
          if (lockedDest) {
            setPaymentReport((prev) => ({
              ...prev,
              transferMethod: lockedDest
            }));
          }
          setForm((prev) => ({
            ...prev,
            currency: data.default_currency || 'IDR',
            contractType: Number(data.is_micro) === 1 ? 'micro_unsecured' : 'secured_collateral'
          }));
        }
      } catch (err) {
        if (mounted) setTokenError('Gagal memuat informasi tautan pengajuan.');
      } finally {
        if (mounted) setLoadingToken(false);
      }
    }

    validateToken();
    return () => {
      mounted = false;
    };
  }, [tokenParam]);

  const handlePhotoUpload = async (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToBase64(file);
      setForm((prev) => ({ ...prev, [field]: compressed }));
    } catch (err) {
      setFormError(err.message || 'Gagal memproses gambar.');
    }
  };

  const handleUpgradeCollateralPhoto = async (slot, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToBase64(file);
      if (slot === 1) setUpgradePhotoCollateral1(compressed);
      else setUpgradePhotoCollateral2(compressed);
    } catch (err) {
      setTicketError(err.message || 'Gagal memproses foto barang jaminan.');
    }
  };

  const handleProofUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToBase64(file);
      setPaymentReport((prev) => ({ ...prev, proofImage: compressed }));
    } catch (err) {
      setTicketError(err.message || 'Gagal memproses foto bukti transfer.');
    }
  };

  const handleSubmitPaymentReport = async (e) => {
    e.preventDefault();
    if (!ticketData?.id) return;

    const lockedDest = extractDestinationAccount(ticketData, qrInfo);
    const finalTransferMethod = lockedDest || paymentReport.transferMethod.trim();

    setSubmittingPaymentReport(true);
    setTicketError('');
    setPaymentReportSuccess('');
    try {
      await submitInstallmentPaymentReport(ticketData.id, {
        installmentNumber: Number(paymentReport.installmentNumber) || 1,
        amount: Number(paymentReport.amount) || 0,
        transferMethod: finalTransferMethod,
        notes: paymentReport.notes,
        proofImage: paymentReport.proofImage
      });

      setShowPaymentReportForm(false);
      setPaymentReportSuccess(
        `Laporan transfer angsuran ke-${paymentReport.installmentNumber} sebesar ${formatCurrencyAmount(
          paymentReport.amount,
          ticketData.currency
        )} tersimpan di sistem! Status saat ini: Menunggu Verifikasi Mutasi Manual oleh Kreditur.`
      );
      await fetchTicketStatus(ticketData.id);
    } catch (err) {
      setTicketError(err.message || 'Gagal mengirim laporan transfer angsuran.');
    } finally {
      setSubmittingPaymentReport(false);
    }
  };

  const dynamicContracts = buildDynamicContracts(form.currency, liveRates);
  const selectedContract =
    dynamicContracts.find((c) => c.id === form.contractType) || dynamicContracts[2];

  const contractLimits = {
    min: convertIdrLimit(selectedContract.minIdr, form.currency, liveRates),
    max: convertIdrLimit(selectedContract.maxIdr, form.currency, liveRates)
  };

  const formatMoney = (val) => formatCurrencyAmount(val, form.currency);

  const handleAmountChange = (inputText) => {
    const rawVal = parseNumberInputToRaw(inputText, form.currency);
    if (rawVal === '') {
      setForm((prev) => ({ ...prev, requestedAmount: '' }));
      return;
    }
    const num = Number(rawVal);
    if (isNaN(num)) return;
    if (num > contractLimits.max) {
      setForm((prev) => ({ ...prev, requestedAmount: String(contractLimits.max) }));
      return;
    }
    setForm((prev) => ({ ...prev, requestedAmount: rawVal }));
  };

  const handleContractChange = (newContractId) => {
    const nextContract = dynamicContracts.find((c) => c.id === newContractId) || dynamicContracts[2];
    const nextMax = convertIdrLimit(nextContract.maxIdr, form.currency, liveRates);
    setForm((prev) => {
      let nextAmount = prev.requestedAmount;
      if (nextAmount !== '') {
        const num = Number(nextAmount);
        if (!isNaN(num) && num > nextMax) {
          nextAmount = String(nextMax);
        }
      }
      const nextReward = newContractId === 'standard_unsecured' ? '20' : '12.5';
      return {
        ...prev,
        contractType: newContractId,
        requestedAmount: nextAmount,
        rewardPercent: nextReward,
        agreedAllClauses: false
      };
    });
  };

  const handleCurrencyChange = (newCurrency) => {
    const nextMax = convertIdrLimit(selectedContract.maxIdr, newCurrency, liveRates);
    setForm((prev) => {
      let nextAmount = prev.requestedAmount;
      if (nextAmount !== '') {
        const num = Number(nextAmount);
        if (!isNaN(num) && num > nextMax) {
          nextAmount = String(nextMax);
        }
      }
      return {
        ...prev,
        currency: newCurrency,
        requestedAmount: nextAmount
      };
    });
  };

  const handleTenorChange = (rawVal) => {
    const digitsOnly = rawVal.replace(/[^0-9]/g, '');
    if (digitsOnly === '') {
      setForm((prev) => ({ ...prev, tenorMonths: '' }));
      return;
    }
    const num = Number(digitsOnly);
    if (num > 36) {
      setForm((prev) => ({ ...prev, tenorMonths: '36' }));
      return;
    }
    setForm((prev) => ({ ...prev, tenorMonths: digitsOnly }));
  };

  const parsedTenorVal = Number(form.tenorMonths);
  const showUnrealisticTenorWarning =
    form.tenorMonths !== '' && !isNaN(parsedTenorVal) && parsedTenorVal >= 7;
  const isTenorOverLimit = form.tenorMonths !== '' && !isNaN(parsedTenorVal) && parsedTenorVal > 12;
  const isTenorInvalid =
    form.tenorMonths === '' || isNaN(parsedTenorVal) || parsedTenorVal < 1 || parsedTenorVal > 12;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (
      !form.borrowerName.trim() ||
      !form.debtorId.trim() ||
      !form.debtorAddress.trim() ||
      !form.borrowerPhone.trim() ||
      !form.emergencyPhone.trim()
    ) {
      setFormError('Seluruh data identitas (Nama, NIK, Alamat, No. HP, dan Kontak Darurat) wajib diisi.');
      return;
    }

    const numAmount = Number(form.requestedAmount);
    if (isNaN(numAmount) || numAmount < contractLimits.min || numAmount > contractLimits.max) {
      setFormError(
        `Nominal pinjaman untuk ${selectedContract.badge} (${selectedContract.title}) wajib berada di antara ${formatMoney(
          contractLimits.min
        )} s.d. ${formatMoney(contractLimits.max)}.`
      );
      return;
    }

    if (isTenorInvalid) {
      setFormError(
        parsedTenorVal > 12
          ? 'Masukan Tenor realistis!'
          : 'Tenor pinjaman wajib diisi minimal 1 bulan.'
      );
      return;
    }

    if (!form.photoId || !form.photoSelfie || !form.photoSelfieId) {
      setFormError('Ketiga foto verifikasi identitas (KTP, Selfie, dan Selfie + KTP) wajib dilampirkan.');
      return;
    }

    if (selectedContract.requiresCollateral) {
      if (!form.collateralDesc.trim()) {
        setFormError('Anda memilih Kontrak 3 — keterangan barang jaminan wajib diisi.');
        return;
      }
      if (!form.photoCollateral1 || !form.photoCollateral2) {
        setFormError('Anda memilih Kontrak 3 — kedua foto barang jaminan (Foto 1 & Foto 2) wajib dilampirkan.');
        return;
      }
    }

    if (!form.agreedAllClauses) {
      setFormError('Anda wajib mencentang pernyataan telah membaca dan menyetujui Pasal 1 s.d. Pasal 5 kontrak.');
      return;
    }

    setSubmitting(true);
    try {
      const defaultReward = form.contractType === 'standard_unsecured' ? 20 : 12.5;
      const res = await submitLoanApplication({
        qrToken: tokenParam,
        ...form,
        tenorMonths: Math.min(12, Math.max(1, parsedTenorVal)),
        hasCollateral: selectedContract.requiresCollateral,
        rewardPercent: Number(form.rewardPercent) || defaultReward
      });
      setSubmittedResult(res);
    } catch (err) {
      setFormError(err.message || 'Terjadi kesalahan saat mengirim pengajuan.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handler Submit Lelang Multi-Opsi pada Halaman Cek Status Tiket
  const handleAuctionResubmit = async (e) => {
    e.preventDefault();
    if (!ticketData?.id) return;

    const ticketCurrency = (ticketData.currency || 'IDR').toUpperCase();
    const ticketContractType = detectTicketContractType(ticketData);
    const maxAllowedPct = getMaxAuctionRewardPercent(ticketContractType);
    const currentRewardPct = Math.min(
      maxAllowedPct,
      Number(ticketData.reward_percent ?? maxAllowedPct)
    );

    setTicketError('');

    if (auctionMode === 'reward') {
      const pct = Number(newRewardPercent);
      if (isNaN(pct) || pct < 0 || pct > maxAllowedPct) {
        setTicketError(
          ticketContractType === 'standard_unsecured'
            ? 'Untuk Kontrak 2, penawaran imbalan jasa maksimal adalah 20%.'
            : 'Untuk Kontrak 1 dan Kontrak 3, batas maksimal lelang imbalan jasa adalah 12,5%.'
        );
        return;
      }

      setSubmittingAuction(true);
      try {
        await resubmitLoanCounterOffer(ticketData.id, pct, {
          auctionType: 'reward_percent',
          rewardPercent: pct
        });
        setAuctionSuccessMsg(
          `Penawaran baru imbalan jasa (${pct}%) berhasil dikirim! Menunggu tinjauan ulang kreditur.`
        );
        setShowAuctionForm(false);
        await fetchTicketStatus(ticketData.id);
      } catch (err) {
        setTicketError(err.message || 'Gagal mengirim ulang penawaran imbalan jasa.');
      } finally {
        setSubmittingAuction(false);
      }
      return;
    }

    if (auctionMode === 'principal') {
      const amt = Number(newRequestedAmount);
      const minAllowed = convertIdrLimit(
        ticketContractType === 'micro_unsecured' ? 100000 : 300000,
        ticketCurrency,
        liveRates
      );
      const maxAllowed = convertIdrLimit(
        ticketContractType === 'micro_unsecured' ? 500000 : 50000000,
        ticketCurrency,
        liveRates
      );

      if (isNaN(amt) || amt < minAllowed || amt > maxAllowed) {
        setTicketError(
          `Nominal pokok pinjaman wajib berada di antara ${formatCurrencyAmount(
            minAllowed,
            ticketCurrency
          )} s.d. ${formatCurrencyAmount(maxAllowed, ticketCurrency)}.`
        );
        return;
      }

      setSubmittingAuction(true);
      try {
        await resubmitLoanCounterOffer(ticketData.id, currentRewardPct, {
          auctionType: 'principal_amount',
          requestedAmount: amt,
          rewardPercent: currentRewardPct
        });
        setAuctionSuccessMsg(
          `Penawaran lelang nominal pokok pinjaman baru sebesar ${formatCurrencyAmount(
            amt,
            ticketCurrency
          )} berhasil dikirim! Menunggu tinjauan ulang kreditur.`
        );
        setShowAuctionForm(false);
        await fetchTicketStatus(ticketData.id);
      } catch (err) {
        setTicketError(err.message || 'Gagal mengirim penawaran nominal pokok pinjaman.');
      } finally {
        setSubmittingAuction(false);
      }
      return;
    }

    if (auctionMode === 'collateral_value') {
      setSubmittingAuction(true);
      try {
        await resubmitLoanCounterOffer(ticketData.id, currentRewardPct, {
          auctionType: 'collateral_value',
          collateralDesc: upgradeCollateralDesc.trim() || ticketData.collateral_desc || ''
        });
        setAuctionSuccessMsg(
          'Pembaruan rincian barang jaminan berhasil dikirim! Menunggu verifikasi & penaksiran harga oleh kreditur.'
        );
        setShowAuctionForm(false);
        await fetchTicketStatus(ticketData.id);
      } catch (err) {
        setTicketError(err.message || 'Gagal mengirim pembaruan jaminan.');
      } finally {
        setSubmittingAuction(false);
      }
      return;
    }

    if (auctionMode === 'upgrade_collateral') {
      if (!upgradeCollateralDesc.trim()) {
        setTicketError('Rincian / keterangan barang jaminan wajib diisi untuk upgrade ke Kontrak 3.');
        return;
      }
      if (!upgradePhotoCollateral1 || !upgradePhotoCollateral2) {
        setTicketError('Kedua foto bukti fisik barang jaminan (Foto 1 & Foto 2) wajib dilampirkan.');
        return;
      }

      setSubmittingAuction(true);
      try {
        await resubmitLoanCounterOffer(ticketData.id, currentRewardPct, {
          auctionType: 'upgrade_to_collateral',
          contractType: 'secured_collateral',
          hasCollateral: true,
          collateralDesc: upgradeCollateralDesc.trim(),
          photoCollateral1: upgradePhotoCollateral1,
          photoCollateral2: upgradePhotoCollateral2
        });
        setAuctionSuccessMsg(
          'Permintaan Upgrade ke Kontrak 3 (Dengan Jaminan) beserta foto barang berhasil dikirim! Taksiran nilai akan ditentukan kreditur.'
        );
        setShowAuctionForm(false);
        await fetchTicketStatus(ticketData.id);
      } catch (err) {
        setTicketError(err.message || 'Gagal mengirim upgrade kontrak jaminan.');
      } finally {
        setSubmittingAuction(false);
      }
    }
  };

  // Handler respon debitur atas tawaran pokok dari kreditur (Oke / Tolak)
  const handleRespondRevisedPrincipal = async (agreed, offeredAmount = null) => {
    if (!ticketData?.id) return;
    const revisedAmt = Number(
      offeredAmount ||
        extractOfferedPrincipal(ticketData) ||
        ticketData.requested_amount ||
        0
    );
    const currentRewardPct = Number(
      ticketData.reward_percent ||
        (detectTicketContractType(ticketData) === 'standard_unsecured' ? 20 : 12.5)
    );

    setRespondingRevisedPrincipal(true);
    setTicketError('');
    setAuctionSuccessMsg('');
    try {
      await resubmitLoanCounterOffer(ticketData.id, currentRewardPct, {
        auctionType: agreed ? 'accept_revised_principal' : 'reject_revised_principal',
        requestedAmount: revisedAmt,
        agreedRevisedPrincipal: agreed
      });
      setAuctionSuccessMsg(
        agreed
          ? `Anda menyetujui (Oke) nominal pokok pinjaman baru sebesar ${formatCurrencyAmount(
              revisedAmt,
              ticketData.currency
            )}. Pengajuan awal sebelumnya tidak berlaku.`
          : `Anda menolak nominal penawaran ${formatCurrencyAmount(
              revisedAmt,
              ticketData.currency
            )}.`
      );
      await fetchTicketStatus(ticketData.id);
    } catch (err) {
      setTicketError(err.message || 'Gagal mengirim respon nominal pinjaman baru.');
    } finally {
      setRespondingRevisedPrincipal(false);
    }
  };

  // Handler tombol "Minta Tambah" (maksimal 5x kesempatan)
  const handleRequestAddPrincipal = async () => {
    if (!ticketData?.id) return;
    const addRequestCount = Number(ticketData.principal_add_requests || 0);
    const maxAddRequests = 5;
    if (addRequestCount >= maxAddRequests) return;

    setRespondingRevisedPrincipal(true);
    setTicketError('');
    setAuctionSuccessMsg('');
    try {
      await resubmitLoanCounterOffer(
        ticketData.id,
        Number(ticketData.reward_percent || 12.5),
        { auctionType: 'request_add_principal' }
      );
      const nextUsed = addRequestCount + 1;
      setAuctionSuccessMsg(
        `Permintaan tambah nominal pokok ke-${nextUsed} dari ${maxAddRequests} berhasil dikirim. Penawaran sebelumnya gugur.`
      );
      await fetchTicketStatus(ticketData.id);
    } catch (err) {
      setTicketError(err.message || 'Gagal mengirim permintaan tambah nominal.');
    } finally {
      setRespondingRevisedPrincipal(false);
    }
  };

  // Handler respon debitur atas Persetujuan Tenor Final dari kreditur (Setuju / Tolak - Non-Lelang)
  const handleRespondTenorOffer = async (agreed, approvedTenor) => {
    if (!ticketData?.id) return;
    const currentRewardPct = Number(
      ticketData.reward_percent ||
        (detectTicketContractType(ticketData) === 'standard_unsecured' ? 20 : 12.5)
    );

    setRespondingTenorOffer(true);
    setTicketError('');
    setAuctionSuccessMsg('');
    try {
      await resubmitLoanCounterOffer(ticketData.id, currentRewardPct, {
        auctionType: agreed ? 'accept_tenor_offer' : 'reject_tenor_offer',
        tenorMonths: approvedTenor,
        agreedTenorOffer: agreed
      });
      setAuctionSuccessMsg(
        agreed
          ? `Anda menyetujui ketentuan tenor final selama ${approvedTenor} bulan. Menunggu pencairan/ACC final dari kreditur.`
          : `Anda menolak ketentuan tenor ${approvedTenor} bulan. Pengajuan dibatalkan.`
      );
      await fetchTicketStatus(ticketData.id);
    } catch (err) {
      setTicketError(err.message || 'Gagal mengirim konfirmasi persetujuan tenor.');
    } finally {
      setRespondingTenorOffer(false);
    }
  };

  const handleDropProofPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToBase64(file);
      setDropProofPhoto(compressed);
    } catch (err) {
      setTicketError(err.message || 'Gagal memproses foto bukti drop jaminan.');
    }
  };

  const handleSubmitDropProof = async (e) => {
    e.preventDefault();
    if (!ticketData?.id) return;
    if (!dropProofPhoto) {
      setTicketError('Foto bukti drop / serah terima barang jaminan wajib dilampirkan.');
      return;
    }

    setSubmittingDropProof(true);
    setTicketError('');
    setDropProofSuccessMsg('');
    try {
      await resubmitLoanCounterOffer(
        ticketData.id,
        Number(ticketData.reward_percent || 12.5),
        {
          auctionType: 'collateral_drop_proof',
          collateralDropProofPhoto: dropProofPhoto,
          collateralDropProofNote: dropProofNote.trim()
        }
      );
      setShowDropProofForm(false);
      setDropProofPhoto('');
      setDropProofNote('');
      setDropProofSuccessMsg(
        'Bukti drop barang jaminan berhasil dikirim! Menunggu pengecekan & konfirmasi oleh kreditur.'
      );
      await fetchTicketStatus(ticketData.id);
    } catch (err) {
      setTicketError(err.message || 'Gagal mengirim bukti drop barang jaminan.');
    } finally {
      setSubmittingDropProof(false);
    }
  };

  const numericAmount = Number(form.requestedAmount) || 0;
  const rewardPct = Math.max(0, Number(form.rewardPercent) || 0);
  const rewardAmount = (numericAmount * rewardPct) / 100;
  const totalPayable = numericAmount + rewardAmount;
  const tenorCount = Math.max(1, Number(form.tenorMonths) || 1);
  const perMonthEstimate = form.isInstallment ? totalPayable / tenorCount : totalPayable;
  const penaltyInfo = getPenaltyTierInfo(form.contractType, numericAmount, form.currency, liveRates);

  // =========================================================================
  // TAMPILAN 1: HALAMAN CEK STATUS TIKET, STATUS ANGSURAN & LELANG MULTI-OPSI
  // =========================================================================
  if (trackingMode || (!tokenParam && !submittedResult)) {
    const status = ticketData?.status || '';
    const ticketContractType = detectTicketContractType(ticketData);
    const maxAuctionReward = getMaxAuctionRewardPercent(ticketContractType);
    const ticketCurrency = (ticketData?.currency || 'IDR').toUpperCase();
    const ticketPrincipal = Number(ticketData?.requested_amount || 0);
    const activeTicketTenor = Number(
      ticketData?.approved_tenor_months || ticketData?.tenor_months || 1
    );

    const canUpgradeToContract3 =
      ticketContractType === 'micro_unsecured' ||
      ticketContractType === 'standard_unsecured';

    const isNegotiableStatus =
      status === 'counter_offer' || status === 'rejected' || status === 'pending';

    const progress = extractInstallmentProgress(ticketData);
    const creditorDestinationAccount = extractDestinationAccount(ticketData, qrInfo);
    const isDestinationLocked = creditorDestinationAccount.length > 0;

    // Sembunyikan banner biru jika termin yang dilaporkan sudah terverifikasi masuk
    const reportedTermNum = Number(paymentReport.installmentNumber || 1);
    const isReportedTermVerified =
      progress &&
      (reportedTermNum <= progress.confirmedTermCount ||
        progress.rawHistory?.some(
          (item) =>
            Number(item.installmentNumber) === reportedTermNum &&
            (item.status === 'verified' || item.status === 'paid' || item.verified)
        ));
    const showPaymentReportBanner = Boolean(paymentReportSuccess) && !isReportedTermVerified;

    // Data Penawaran Pokok Kreditur (Oke / Tolak / Minta Tambah maks 5x)
    const creditorOfferedPrincipal = extractOfferedPrincipal(ticketData);
    const addRequestCount = Number(ticketData?.principal_add_requests || 0);
    const maxAddRequests = 5;
    const canRequestAdd = addRequestCount < maxAddRequests;
    const showCreditorPrincipalOffer = creditorOfferedPrincipal > 0 && status !== 'approved';

    // Data Persetujuan Tenor Final Kreditur (Non-Lelang: Setuju / Tolak)
    const approvedTenorOffer = extractApprovedTenor(ticketData);
    const showCreditorTenorOffer = status === 'tenor_offer' && approvedTenorOffer > 0;

    return (
      <div className="min-h-screen bg-[#071510] text-emerald-50 py-6 px-3 sm:px-4">
        <div className="max-w-lg mx-auto bg-[#0c2119] border border-emerald-800/80 rounded-2xl p-4 sm:p-6 space-y-5">
          <div className="border-b border-emerald-800/70 pb-3 flex items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold text-white">Cek Status Pengajuan & Angsuran</h1>
              <p className="text-xs text-emerald-200/75 mt-1">
                Pantau status persetujuan (ACC), progres verifikasi cicilan, atau lakukan penawaran lelang / upgrade jaminan.
              </p>
            </div>
            {tokenParam && (
              <button
                type="button"
                onClick={() => setTrackingMode(false)}
                className="shrink-0 text-[11px] px-2.5 py-1 rounded bg-[#071510] border border-emerald-700 text-emerald-300"
              >
                Kembali ke Form
              </button>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchTicketStatus(ticketInput);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={ticketInput}
              onChange={(e) => setTicketInput(e.target.value)}
              placeholder="Contoh: APP-1795250192"
              className="min-w-0 flex-1 px-3 py-2 rounded-lg bg-[#071510] border border-emerald-800 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={loadingTicket}
              className="shrink-0 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
            >
              {loadingTicket ? 'Cek...' : 'Cek Status'}
            </button>
          </form>

          {ticketError && (
            <div className="p-3 rounded-lg bg-red-950/70 border border-red-700 text-xs text-red-200">
              {ticketError}
            </div>
          )}

          {auctionSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-500 text-xs text-emerald-200">
              {auctionSuccessMsg}
            </div>
          )}

          {showPaymentReportBanner && (
            <div className="p-3 rounded-lg bg-sky-950/80 border border-sky-500 text-xs text-sky-200 leading-relaxed">
              {paymentReportSuccess}
            </div>
          )}

          {ticketData && (
            <div className="bg-[#071510] border border-emerald-800/80 rounded-xl p-3.5 sm:p-4 space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-800/60 pb-3">
                <div>
                  <div className="text-emerald-400 text-[11px]">Pemohon</div>
                  <div className="font-bold text-white text-sm">{ticketData.borrower_name}</div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full font-semibold text-[11px] ${
                    status === 'approved'
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500'
                      : status === 'tenor_offer'
                      ? 'bg-teal-600/20 text-teal-300 border border-teal-500'
                      : status === 'borrower_agreed'
                      ? 'bg-emerald-600/20 text-emerald-200 border border-emerald-400'
                      : status === 'rejected' || status === 'counter_offer'
                      ? 'bg-red-600/20 text-red-300 border border-red-500'
                      : 'bg-amber-600/20 text-amber-300 border border-amber-500'
                  }`}
                >
                  {status === 'approved'
                    ? '✓ DISETUJUI (ACC)'
                    : status === 'tenor_offer'
                    ? '📌 PERSETUJUAN TENOR FINAL'
                    : status === 'borrower_agreed'
                    ? '✓ KESEPAKATAN DISETUJUI'
                    : status === 'counter_offer'
                    ? '⚖ NEGOSIASI / LELANG'
                    : status === 'rejected'
                    ? '✕ DITOLAK'
                    : '⏳ MENUNGGU TINJAUAN'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-emerald-100/85">
                <div>
                  <span className="text-emerald-400/80 block">Pokok Pinjaman:</span>
                  <span className="font-semibold text-white">
                    {formatCurrencyAmount(ticketData.requested_amount, ticketData.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-400/80 block">Imbalan Jasa:</span>
                  <span className="font-semibold text-emerald-300">
                    {ticketData.reward_percent ||
                      (ticketContractType === 'standard_unsecured' ? 20 : 12.5)}
                    %
                  </span>
                </div>
                <div>
                  <span className="text-emerald-400/80 block">Tenor & Skema:</span>
                  <span>
                    {activeTicketTenor} Bulan (
                    {Number(ticketData.is_installment) === 1 ? 'Cicilan Bulanan' : 'Pelunasan Akhir'})
                  </span>
                </div>
                <div>
                  <span className="text-emerald-400/80 block">Skema Kontrak:</span>
                  <span className="font-semibold text-emerald-200">
                    {ticketContractType === 'micro_unsecured'
                      ? 'Kontrak 1 (Mikro)'
                      : ticketContractType === 'secured_collateral'
                      ? 'Kontrak 3 (Dengan Jaminan)'
                      : 'Kontrak 2 (Tanpa Jaminan)'}
                  </span>
                </div>
              </div>

              {/* FEEDBACK STATUS ANGSURAN & KONFIRMASI TRANSFER (JIKA SUDAH ACC) */}
              {status === 'approved' && progress && (
                <div className="p-3.5 rounded-xl bg-[#0c2119] border border-emerald-700/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                    <span className="font-bold text-emerald-300">
                      Status Pembayaran & Verifikasi Angsuran
                    </span>
                    <span className="w-fit text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-900/80 border border-emerald-700/70 text-emerald-200">
                      {progress.confirmedTermCount} / {progress.installmentCount} Termin ACC
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full bg-[#071510] overflow-hidden border border-emerald-800/70">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${progress.progressPercent}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap justify-between gap-1 text-[11px] text-emerald-200/80">
                      <span>Terverifikasi Masuk: {progress.progressPercent}%</span>
                      <span className="font-mono">
                        {formatCurrencyAmount(progress.confirmedPaidAmount, ticketData.currency)} /{' '}
                        {formatCurrencyAmount(progress.totalDue, ticketData.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Rincian Angka */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[#071510] border border-emerald-800/60 text-[11px]">
                    <div>
                      <span className="text-emerald-400/80 block">Nominal per Termin:</span>
                      <span className="font-semibold text-white">
                        {formatCurrencyAmount(progress.perTermAmount, ticketData.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-emerald-400/80 block">Sisa Kewajiban:</span>
                      <span className="font-semibold text-amber-300">
                        {formatCurrencyAmount(progress.remainingAmount, ticketData.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Rincian Status Tiap Angsuran ke-1 s.d. ke-N */}
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-emerald-300">
                      Rincian Status Angsuran:
                    </div>
                    {Array.from({ length: progress.installmentCount }).map((_, idx) => {
                      const termNo = idx + 1;
                      const isVerified = termNo <= progress.confirmedTermCount;
                      const pendingReport =
                        !isVerified &&
                        progress.rawHistory.find(
                          (r) =>
                            Number(r.installmentNumber) === termNo &&
                            r.status === 'pending_verification'
                        );

                      return (
                        <div
                          key={termNo}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 p-2.5 rounded-lg bg-[#071510] border border-emerald-800/60 text-[11px]"
                        >
                          <div className="leading-snug">
                            <span className="font-semibold text-white">
                              {progress.isInstallment ? `Angsuran ke-${termNo}` : 'Pelunasan Penuh'}
                            </span>
                            <span className="text-emerald-300/80 ml-1.5">
                              ({formatCurrencyAmount(progress.perTermAmount, ticketData.currency)})
                            </span>
                          </div>

                          {isVerified ? (
                            <span className="w-fit px-2 py-0.5 rounded bg-emerald-900/70 border border-emerald-600 text-emerald-300 font-semibold text-[10px]">
                              ✓ Masuk & Dikonfirmasi Kreditur
                            </span>
                          ) : pendingReport ? (
                            <span className="w-fit px-2 py-0.5 rounded bg-sky-950 border border-sky-600 text-sky-300 font-semibold text-[10px]">
                              ⏳ Sudah Transfer (Menunggu Cek Mutasi)
                            </span>
                          ) : (
                            <span className="w-fit px-2 py-0.5 rounded bg-amber-950/60 border border-amber-700/70 text-amber-300 text-[10px]">
                              Belum Dibayar
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#071510] border border-emerald-800/70 text-[11px] text-emerald-200/80 leading-relaxed">
                    <strong>Catatan Pembaruan Saldo:</strong> Pencatatan pembayaran masuk diverifikasi secara manual oleh kreditur setelah pengecekan mutasi rekening. Jika Anda sudah transfer namun status belum hijau, laporkan bukti transfer di bawah atau konfirmasi ke WhatsApp kreditur.
                  </div>

                  {progress.remainingAmount > 0 && (
                    <div className="space-y-2.5 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setShowPaymentReportForm((prev) => !prev)}
                          className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px]"
                        >
                          {showPaymentReportForm ? 'Tutup Form Lapor' : 'Lapor Sudah Transfer Cicilan'}
                        </button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            `Halo, saya ${ticketData.borrower_name} (Tiket: ${ticketData.id}). Saya sudah transfer pembayaran ${
                              progress.isInstallment
                                ? `angsuran ke-${Math.min(
                                    progress.installmentCount,
                                    progress.confirmedTermCount + 1
                                  )}`
                                : 'pelunasan pinjaman'
                            } sebesar ${formatCurrencyAmount(
                              progress.perTermAmount,
                              ticketData.currency
                            )}${
                              creditorDestinationAccount
                                ? ` ke rekening tujuan (${creditorDestinationAccount})`
                                : ''
                            }. Mohon dicek mutasinya ya.`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-2 px-3 rounded-lg bg-[#071510] border border-emerald-600 hover:bg-emerald-900/40 text-emerald-300 font-semibold text-[11px] text-center"
                        >
                          Kirim Bukti via WA
                        </a>
                      </div>

                      {showPaymentReportForm && (
                        <form
                          onSubmit={handleSubmitPaymentReport}
                          className="p-3 rounded-lg bg-[#071510] border border-emerald-700 space-y-2.5 text-[11px]"
                        >
                          <div className="font-semibold text-emerald-300">
                            Form Konfirmasi Transfer Angsuran
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-emerald-200/80 mb-1">Termin ke-</label>
                              <input
                                type="number"
                                min="1"
                                max={progress.installmentCount}
                                required
                                value={paymentReport.installmentNumber}
                                onChange={(e) =>
                                  setPaymentReport({
                                    ...paymentReport,
                                    installmentNumber: e.target.value
                                  })
                                }
                                className="w-full px-2.5 py-1.5 rounded bg-[#0c2119] border border-emerald-800 text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-emerald-200/80 mb-1">
                                Nominal Ditransfer ({ticketData.currency})
                              </label>
                              <input
                                type="number"
                                step="any"
                                required
                                value={paymentReport.amount}
                                onChange={(e) =>
                                  setPaymentReport({ ...paymentReport, amount: e.target.value })
                                }
                                className="w-full px-2.5 py-1.5 rounded bg-[#0c2119] border border-emerald-800 text-white"
                              />
                            </div>
                          </div>

                         <div>
  <label className="block text-emerald-200/80 mb-1">
    Bank / E-Wallet Tujuan & Nama Pengirim
    <span className="ml-1.5 text-[10px] text-emerald-400 font-semibold">
      (Terkunci dari Kreditur)
    </span>
  </label>
  <input
    type="text"
    required
    readOnly
    value={creditorDestinationAccount || 'Belum diatur oleh kreditur'}
    className="w-full px-2.5 py-1.5 rounded border bg-[#071510] border-emerald-700/70 text-emerald-200 cursor-not-allowed opacity-90"
  />
</div>
                          <label className="p-2.5 rounded-lg bg-[#0c2119] border border-dashed border-emerald-700 cursor-pointer flex items-center justify-between gap-2">
                            <span className="text-emerald-200">
                              {paymentReport.proofImage
                                ? '✓ Foto Struk Transfer Terlampir'
                                : 'Lampirkan Foto Bukti Transfer (Opsional)'}
                            </span>
                            <span className="shrink-0 text-emerald-400 underline">Pilih File</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleProofUpload}
                              className="hidden"
                            />
                          </label>

                          <button
                            type="submit"
                            disabled={submittingPaymentReport}
                            className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold"
                          >
                            {submittingPaymentReport
                              ? 'Menyimpan ke Sistem...'
                              : 'Simpan Status Sudah Transfer'}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}

              {dropProofSuccessMsg && (
                <div className="p-3 rounded-lg bg-sky-950/80 border border-sky-500 text-xs text-sky-200 leading-relaxed">
                  {dropProofSuccessMsg}
                </div>
              )}

              {ticketData.collateral_feedback && (
                <div className="p-3.5 rounded-xl bg-[#0c2119] border border-sky-600/70 space-y-2.5">
                  <div className="font-semibold text-sky-300">
                    Status & Instruksi Serah Terima Jaminan:
                  </div>
                  <p className="text-emerald-100 leading-relaxed whitespace-pre-line">
                    {ticketData.collateral_feedback}
                  </p>

                  {!ticketData.collateral_feedback.includes('BARANG JAMINAN DITERIMA') && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowDropProofForm((prev) => !prev)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px]"
                      >
                        {showDropProofForm ? 'Tutup Form Bukti Drop' : 'Upload Bukti Drop Jaminan'}
                      </button>

                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `Halo, saya ${ticketData.borrower_name} (Tiket: ${ticketData.id}). Barang jaminan (${ticketData.collateral_desc}) sudah saya antar/kirim ke alamat drop-off sesuai instruksi. Mohon dicek ya.`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-[11px]"
                      >
                        Konfirmasi via WhatsApp
                      </a>
                    </div>
                  )}

                  {showDropProofForm &&
                    !ticketData.collateral_feedback.includes('BARANG JAMINAN DITERIMA') && (
                      <form
                        onSubmit={handleSubmitDropProof}
                        className="p-3 rounded-lg bg-[#071510] border border-sky-700 space-y-2.5 text-[11px] mt-2"
                      >
                        <div className="font-semibold text-sky-300">
                          Form Upload Bukti Drop Barang Jaminan
                        </div>

                        <label className="p-2.5 rounded-lg bg-[#0c2119] border border-dashed border-sky-600 cursor-pointer flex items-center justify-between">
                          <span className="text-sky-100">
                            {dropProofPhoto
                              ? '✓ Foto Bukti Drop Terlampir'
                              : 'Foto Bukti Barang Diantar / Drop *'}
                          </span>
                          <span className="text-sky-400 underline">Pilih Foto</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleDropProofPhotoChange}
                            className="hidden"
                          />
                        </label>

                        <div>
                          <label className="block text-emerald-200/80 mb-1">
                            Catatan Tambahan (Jam antar, titip ke siapa, dll)
                          </label>
                          <input
                            type="text"
                            value={dropProofNote}
                            onChange={(e) => setDropProofNote(e.target.value)}
                            placeholder="Contoh: Diantar jam 15.00 / dititip di pos..."
                            className="w-full px-2.5 py-1.5 rounded bg-[#0c2119] border border-emerald-800 text-white"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={submittingDropProof}
                          className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold"
                        >
                          {submittingDropProof ? 'Mengirim Bukti...' : 'Kirim Bukti Drop Jaminan'}
                        </button>
                      </form>
                    )}
                </div>
              )}

              {ticketData.rejection_reason && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/70 space-y-1">
                  <div className="font-semibold text-red-300">Keterangan Kreditur:</div>
                  <p className="text-red-100 leading-relaxed">{ticketData.rejection_reason}</p>
                </div>
              )}

              {/* RESPON PERSETUJUAN TENOR FINAL DARI KREDITUR (NON-LELANG: SETUJU / TOLAK) */}
              {showCreditorTenorOffer && (
                <div className="p-3.5 rounded-xl bg-teal-950/50 border border-teal-500/70 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-teal-200 text-xs">
                      Ketentuan Tenor Final Kreditur
                    </span>
                    <span className="font-mono font-bold text-white text-xs px-2 py-0.5 rounded bg-teal-800/80">
                      {approvedTenorOffer} Bulan
                    </span>
                  </div>

                  <p className="text-[11px] text-teal-100/85 leading-relaxed">
                    Kreditur menetapkan tenor final menjadi <strong>{approvedTenorOffer} bulan</strong> (ketentuan tetap / bukan lelang). Silakan pilih <strong>Setuju</strong> atau <strong>Tolak</strong>:
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <button
                      type="button"
                      disabled={respondingTenorOffer}
                      onClick={() => handleRespondTenorOffer(true, approvedTenorOffer)}
                      className="py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold"
                    >
                      Setuju ({approvedTenorOffer} Bln)
                    </button>

                    <button
                      type="button"
                      disabled={respondingTenorOffer}
                      onClick={() => handleRespondTenorOffer(false, approvedTenorOffer)}
                      className="py-2 px-3 rounded-lg bg-rose-600/80 hover:bg-rose-600 disabled:opacity-50 text-white font-bold"
                    >
                      Tolak
                    </button>
                  </div>
                </div>
              )}

              {/* RESPON TAWARAN POKOK KREDITUR (OKE / TOLAK / MINTA TAMBAH MAKS 5X) */}
              {showCreditorPrincipalOffer && (
                <div className="p-3.5 rounded-xl bg-indigo-950/45 border border-indigo-500/70 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-indigo-200 text-xs">
                      Penawaran Pokok dari Kreditur
                    </span>
                    <span className="font-mono font-bold text-white text-xs">
                      {formatCurrencyAmount(creditorOfferedPrincipal, ticketCurrency)}
                    </span>
                  </div>

                  <p className="text-[11px] text-indigo-100/85 leading-relaxed">
                    Pengajuan awal ({formatCurrencyAmount(ticketPrincipal, ticketCurrency)}) sudah tidak berlaku.
                    {canRequestAdd
                      ? ` Sisa kesempatan Minta Tambah: ${maxAddRequests - addRequestCount}/${maxAddRequests}.`
                      : ' Kesempatan Minta Tambah (5x) sudah habis — silakan pilih Oke atau Tolak.'}
                  </p>

                  <div className={`grid gap-2 text-[11px] ${canRequestAdd ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <button
                      type="button"
                      disabled={respondingRevisedPrincipal}
                      onClick={() => handleRespondRevisedPrincipal(true, creditorOfferedPrincipal)}
                      className="py-2 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold"
                    >
                      Oke
                    </button>

                    <button
                      type="button"
                      disabled={respondingRevisedPrincipal}
                      onClick={() => handleRespondRevisedPrincipal(false, creditorOfferedPrincipal)}
                      className="py-2 px-2 rounded-lg bg-rose-600/80 hover:bg-rose-600 disabled:opacity-50 text-white font-bold"
                    >
                      Tolak
                    </button>

                    {canRequestAdd && (
                      <button
                        type="button"
                        disabled={respondingRevisedPrincipal}
                        onClick={handleRequestAddPrincipal}
                        className="py-2 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold"
                      >
                        Minta Tambah ({addRequestCount + 1}/5)
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* SISTEM LELANG & NEGOSIASI DEBITUR */}
              {isNegotiableStatus && (
                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-600/70 space-y-3">
                  <div className="font-semibold text-amber-300">
                    Sistem Lelang & Negosiasi Pengajuan
                  </div>
                  <p className="text-[11px] text-amber-100/85 leading-relaxed">
                    Ajukan penawaran ulang tanpa perlu mengisi ulang data KTP/selfie. Pilih opsi negosiasi yang tersedia untuk kontrak Anda di bawah ini:
                  </p>

                  {!showAuctionForm ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAuctionMode('reward');
                        setNewRewardPercent(String(Math.min(maxAuctionReward, Number(ticketData?.reward_percent ?? maxAuctionReward))));
                        setShowAuctionForm(true);
                      }}
                      className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs"
                    >
                      Buka Menu Lelang & Negosiasi Penawaran
                    </button>
                  ) : (
                    <div className="space-y-3 pt-1">
                      {/* Tab Pilihan Jenis Lelang Debitur */}
                      <div className="grid grid-cols-1 gap-1.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setAuctionMode('reward')}
                          className={`px-3 py-2 rounded-lg border text-left font-semibold w-full ${
                            auctionMode === 'reward'
                              ? 'bg-amber-600/30 border-amber-400 text-amber-200'
                              : 'bg-[#071510] border-emerald-800 text-emerald-200/80'
                          }`}
                        >
                          1. Lelang Imbalan Jasa (%) — Maks {maxAuctionReward}%
                        </button>

                        {canUpgradeToContract3 && (
                          <button
                            type="button"
                            onClick={() => setAuctionMode('upgrade_collateral')}
                            className={`px-3 py-2 rounded-lg border text-left font-semibold w-full ${
                              auctionMode === 'upgrade_collateral'
                                ? 'bg-sky-600/30 border-sky-400 text-sky-200'
                                : 'bg-[#071510] border-emerald-800 text-emerald-200/80'
                            }`}
                          >
                            ★ Upgrade ke Kontrak 3 (Jaminan)
                          </button>
                        )}
                      </div>

                      {/* FORM OPSI 1: LELANG IMBALAN JASA (KONTRAK 1 & 3 MAKS 12,5%, KONTRAK 2 MAKS 20%) */}
                      {auctionMode === 'reward' && (
  <form onSubmit={handleAuctionResubmit} className="space-y-2.5">
    <label className="block text-[11px] text-amber-200">
      Masukkan Penawaran Imbalan Jasa Baru (%) (Maks 20%):
    </label>
    <div className="flex gap-2">
      <input
        type="number"
        step="0.1"
        min="0"
        max={maxAuctionReward}
        required
        value={newRewardPercent}
        onChange={(e) => {
          const val = e.target.value;
          if (val !== '' && Number(val) > maxAuctionReward) {
            setNewRewardPercent(String(maxAuctionReward));
            return;
          }
          setNewRewardPercent(val);
        }}
        className="min-w-0 flex-1 px-3 py-2 rounded-lg bg-[#071510] border border-amber-600 text-sm text-white"
      />
      <button
        type="submit"
        disabled={submittingAuction}
        className="shrink-0 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
      >
        {submittingAuction ? 'Kirim...' : 'Kirim Penawaran'}
      </button>
    </div>
    <div className="text-[11px] text-emerald-300 break-all">
      Estimasi Hadiah Baru:{' '}
      {formatCurrencyAmount(
        (ticketPrincipal *
          Math.min(maxAuctionReward, Math.max(0, Number(newRewardPercent) || 0))) /
          100,
        ticketCurrency
      )}
    </div>
  </form>
)}
                      {/* FORM OPSI 2: UPGRADE KONTRAK 1 / KONTRAK 2 -> KONTRAK 3 */}
                      {auctionMode === 'upgrade_collateral' && canUpgradeToContract3 && (
                        <form onSubmit={handleAuctionResubmit} className="space-y-2.5">
                          <div className="p-2 rounded-lg bg-sky-950/60 border border-sky-700/70 text-[11px] text-sky-200">
                            Upgrade pengajuan Anda dari{' '}
                            <strong>
                              {ticketContractType === 'micro_unsecured'
                                ? 'Kontrak 1 (Mikro)'
                                : 'Kontrak 2 (Tanpa Jaminan)'}
                            </strong>{' '}
                            ke <strong>Kontrak 3 (Dengan Jaminan)</strong>. Taksiran nilai jaminan akan ditentukan kreditur.
                          </div>
                          <div>
                            <label className="block text-[11px] text-amber-200 mb-1">
                              Rincian Barang Jaminan *
                            </label>
                            <input
                              type="text"
                              required
                              value={upgradeCollateralDesc}
                              onChange={(e) => setUpgradeCollateralDesc(e.target.value)}
                              placeholder="Contoh: HP Xiaomi Redmi Note 13 Pro+ 5G Fullset..."
                              className="w-full px-3 py-2 rounded-lg bg-[#071510] border border-emerald-800 text-xs text-white"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            <label className="p-2.5 rounded-lg bg-[#071510] border border-dashed border-sky-600 cursor-pointer">
                              <span className="block font-semibold text-sky-200">
                                Foto Jaminan 1 (Utama) *
                              </span>
                              <span className="text-[10px] text-emerald-400">
                                {upgradePhotoCollateral1 ? '✓ Terlampir' : 'Pilih / ambil foto'}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleUpgradeCollateralPhoto(1, e)}
                                className="hidden"
                              />
                            </label>
                            <label className="p-2.5 rounded-lg bg-[#071510] border border-dashed border-sky-600 cursor-pointer">
                              <span className="block font-semibold text-sky-200">
                                Foto Jaminan 2 (Detail/Seri) *
                              </span>
                              <span className="text-[10px] text-emerald-400">
                                {upgradePhotoCollateral2 ? '✓ Terlampir' : 'Pilih / ambil foto'}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleUpgradeCollateralPhoto(2, e)}
                                className="hidden"
                              />
                            </label>
                          </div>
                          <button
                            type="submit"
                            disabled={submittingAuction}
                            className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs"
                          >
                            {submittingAuction
                              ? 'Memproses Upgrade...'
                              : 'Upgrade ke Kontrak 3 & Kirim Bukti Jaminan'}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // TAMPILAN 2: LOADING / ERROR TOKEN QR
  // =========================================================================
  if (loadingToken) {
    return (
      <div className="min-h-screen bg-[#071510] text-emerald-100 flex items-center justify-center p-4">
        <div className="text-sm text-emerald-300">Memverifikasi tautan pengajuan pinjaman...</div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-[#071510] text-emerald-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0c2119] border border-red-800/60 rounded-xl p-6 text-center space-y-3">
          <div className="text-red-400 font-semibold text-base">Tautan Tidak Tersedia</div>
          <p className="text-xs text-emerald-200/80">{tokenError}</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TAMPILAN 3: BUKTI PENGIRIMAN & LINK TRACKING STATUS OTOMATIS
  // =========================================================================
  if (submittedResult) {
    const statusUrl = `${window.location.origin}/apply?ticket=${submittedResult.id}`;
    return (
      <div className="min-h-screen bg-[#071510] text-emerald-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0c2119] border border-emerald-700 rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-600/20 border border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto text-xl font-bold">
            ✓
          </div>
          <h2 className="text-lg font-bold text-white">Pengajuan Berhasil Dikirim</h2>
          <p className="text-xs text-emerald-200/80 leading-relaxed">
            Data pengajuan pinjaman Anda telah masuk ke sistem{' '}
            <span className="font-semibold text-emerald-300">Pemberi Pinjaman Terverifikasi</span>.
          </p>

          <div className="bg-[#071510] border border-emerald-800/80 rounded-xl p-3.5 text-xs space-y-2 text-left">
            <div>
              <span className="text-emerald-400 block text-[11px]">Nomor Tiket Pengajuan:</span>
              <span className="font-mono font-bold text-white text-sm">{submittedResult.id}</span>
            </div>
            <div>
              <span className="text-emerald-400 block text-[11px]">Link Pantau Status / Angsuran / Lelang Jasa:</span>
              <div className="mt-1 p-2 rounded bg-[#0c2119] border border-emerald-800 font-mono text-[11px] text-emerald-200 break-all">
                {statusUrl}
              </div>
            </div>
          </div>

          <div className="bg-[#071510] border border-emerald-800/80 rounded-xl p-3.5 text-xs space-y-2.5 text-left">
            <div>
              <span className="text-emerald-400 block text-[11px] mb-1">Nomor Tiket Pengajuan:</span>
              <div className="flex items-center justify-between gap-2 p-2 rounded bg-[#0c2119] border border-emerald-800">
                <span className="font-mono font-bold text-white text-xs sm:text-sm select-all">
                  {submittedResult.id}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(submittedResult.id);
                    setCopiedTicket(true);
                    setTimeout(() => setCopiedTicket(false), 2000);
                  }}
                  className="shrink-0 px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-semibold"
                >
                  {copiedTicket ? '✓ Tersalin' : 'Salin Tiket'}
                </button>
              </div>
            </div>
            <a
              href={statusUrl}
              className="flex-1 py-2.5 rounded-xl bg-[#071510] border border-emerald-600 hover:bg-emerald-900/40 text-emerald-300 text-xs font-semibold flex items-center justify-center"
            >
              Buka Status Sekarang
            </a>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TAMPILAN 4: FORMULIR PENGAJUAN PINJAMAN PUBLIK LENGKAP
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#071510] text-emerald-50 py-6 px-4">
      <div className="max-w-2xl mx-auto bg-[#0c2119] border border-emerald-800/80 rounded-2xl p-5 sm:p-7 space-y-6">
        <div className="border-b border-emerald-800/70 pb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white">Formulir Pengajuan Pinjaman</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTrackingMode(true)}
              className="text-[11px] px-2.5 py-1 rounded bg-[#071510] border border-emerald-700 text-emerald-300 hover:bg-emerald-900/40"
            >
              Cek Status Tiket
            </button>
            <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-emerald-900/70 border border-emerald-700 text-emerald-300">
              {qrInfo?.token}
            </span>
          </div>
        </div>

        {formError && (
          <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-600 text-xs text-red-200 leading-relaxed">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* BAGIAN 1: IDENTITAS WAJIB PEMINJAM */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              1. Data Identitas Peminjam (Wajib Diisi Semua)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-emerald-300 mb-1">Nama Lengkap (Sesuai KTP) *</label>
                <input
                  type="text"
                  required
                  value={form.borrowerName}
                  onChange={(e) => setForm({ ...form, borrowerName: e.target.value })}
                  placeholder="Nama lengkap peminjam"
                  className="w-full px-3 py-2.5 rounded-lg bg-[#071510] border border-emerald-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-emerald-300 mb-1">NIK / No. Identitas *</label>
                <input
                  type="text"
                  required
                  value={form.debtorId}
                  onChange={(e) => setForm({ ...form, debtorId: e.target.value })}
                  placeholder="16 digit NIK KTP / No. Paspor"
                  className="w-full px-3 py-2.5 rounded-lg bg-[#071510] border border-emerald-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-emerald-300 mb-1">Alamat Lengkap Domisili / KTP *</label>
              <textarea
                rows={2}
                required
                value={form.debtorAddress}
                onChange={(e) => setForm({ ...form, debtorAddress: e.target.value })}
                placeholder="Jalan, No. Rumah, RT/RW, Kelurahan, Kecamatan, Kota..."
                className="w-full px-3 py-2.5 rounded-lg bg-[#071510] border border-emerald-800 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-emerald-300 mb-1">No. HP / WhatsApp Aktif *</label>
                <input
                  type="tel"
                  required
                  value={form.borrowerPhone}
                  onChange={(e) => setForm({ ...form, borrowerPhone: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                  className="w-full px-3 py-2.5 rounded-lg bg-[#071510] border border-emerald-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-emerald-300 mb-1">No. HP Kontak Darurat *</label>
                <input
                  type="tel"
                  required
                  value={form.emergencyPhone}
                  onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })}
                  placeholder="Nomor keluarga / kerabat aktif"
                  className="w-full px-3 py-2.5 rounded-lg bg-[#071510] border border-emerald-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* BAGIAN 2: PILIHAN 3 KONTRAK & BACA PASAL 1-5 */}
          <div className="space-y-3 pt-4 border-t border-emerald-800/70">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                2. Pilih Jenis Kontrak & Baca Seluruh Pasal (Wajib)
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-emerald-300">Mata Uang Kontrak:</span>
                <select
                  value={form.currency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  className="px-2 py-1 rounded bg-[#071510] border border-emerald-700 text-xs text-white font-semibold"
                >
                  {CURRENCY_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code} ({getCurrencySymbolDynamic(code)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[11px] text-emerald-200/80">
              Pilih salah satu dari 3 skema kontrak di bawah ini (batas nominal & ketentuan pasal otomatis menyesuaikan mata uang <strong>{form.currency}</strong>), baca seluruh Pasal 1 s.d. Pasal 5, lalu centang kotak persetujuan.
            </p>

            {/* 3 Kartu Pilihan Kontrak */}
            <div className="grid grid-cols-1 gap-2.5">
              {dynamicContracts.map((ct) => {
                const isSelected = form.contractType === ct.id;
                const ctMin = convertIdrLimit(ct.minIdr, form.currency, liveRates);
                const ctMax = convertIdrLimit(ct.maxIdr, form.currency, liveRates);
                return (
                  <label
                    key={ct.id}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex items-start gap-3 ${
                      isSelected
                        ? 'bg-emerald-900/40 border-emerald-400'
                        : 'bg-[#071510] border-emerald-800/80 hover:border-emerald-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="contractType"
                      checked={isSelected}
                      onChange={() => handleContractChange(ct.id)}
                      className="mt-1 accent-emerald-500"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-800 text-emerald-200">
                            {ct.badge}
                          </span>
                          <span className="text-xs font-bold text-white">{ct.title}</span>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${ct.approvalBadgeClass}`}
                        >
                          {ct.approvalBadge}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-200/80">{ct.subtitle}</p>
                      <div className="text-[10px] text-emerald-300/90 font-mono">
                        Limit Nominal ({form.currency}): {formatMoney(ctMin)} – {formatMoney(ctMax)}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Kotak Baca Full Pasal 1 - 5 dari Kontrak Terpilih */}
            <div className="bg-[#071510] border border-emerald-700/80 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-800/70 pb-2">
                <span className="text-xs font-bold text-emerald-300">{selectedContract.title}</span>
                <span className="text-[10px] text-emerald-400">Pasal 1 – 5 [{form.currency}]</span>
              </div>

              <div className="max-h-72 overflow-y-auto pr-2 space-y-3 text-[11px] text-emerald-100/85 leading-relaxed">
                <div className="space-y-1">
                  <div className="font-bold text-emerald-300">PASAL 1 - POKOK PINJAMAN & IMBALAN JASA</div>
                  {selectedContract.pasal1Items.map((item, idx) => (
                    <p key={idx}>{item}</p>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-emerald-300">PASAL 2 - DENDA KETERLAMBATAN</div>
                  <p>{selectedContract.pasal2Intro}</p>
                  {selectedContract.pasal2Items.map((item, idx) => (
                    <p key={idx}>{item}</p>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-emerald-300">{selectedContract.pasal3Title}</div>
                  {selectedContract.pasal3Items.map((item, idx) => (
                    <p key={idx}>{item}</p>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-emerald-300">{selectedContract.pasal4Title}</div>
                  {selectedContract.pasal4Items.map((item, idx) => (
                    <p key={idx}>{item}</p>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-emerald-300">PASAL 5 - PENUTUP & PERSETUJUAN</div>
                  {selectedContract.pasal5Items.map((item, idx) => (
                    <p key={idx}>{item}</p>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-2.5 pt-2.5 border-t border-emerald-800/70 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.agreedAllClauses}
                  onChange={(e) => setForm({ ...form, agreedAllClauses: e.target.checked })}
                  className="mt-0.5 accent-emerald-500"
                />
                <span className="text-xs font-semibold text-emerald-200">
                  Saya telah membaca seluruh isi {selectedContract.title} (Pasal 1 s.d. Pasal 5 beserta seluruh ayatnya) dan menyetujui ketentuan tersebut. *
                </span>
              </label>
            </div>
          </div>

          {/* BAGIAN 3: NOMINAL & TENOR */}
          <div className="space-y-3 pt-4 border-t border-emerald-800/70">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                3. Rincian Pinjaman & Penawaran Imbalan Jasa
              </span>
              <span className="text-[11px] font-mono text-amber-300">
                Batas {selectedContract.badge}: {formatMoney(contractLimits.min)} – {formatMoney(contractLimits.max)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <label className="block text-xs text-emerald-300 mb-1">
                  Nominal Pokok ({form.currency} — Maks {formatMoney(contractLimits.max)}) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={formatNumberInputDisplay(form.requestedAmount, form.currency)}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder={`Min ${formatNumberInputDisplay(contractLimits.min, form.currency)} – Maks ${formatNumberInputDisplay(contractLimits.max, form.currency)}`}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#071510] border border-emerald-800 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs text-emerald-300 mb-1">Tenor (Bulan) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="Bulan"
                  value={form.tenorMonths}
                  onChange={(e) => handleTenorChange(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-lg bg-[#071510] border text-sm text-white focus:outline-none ${
                    showUnrealisticTenorWarning
                      ? 'border-red-500 focus:border-red-400'
                      : 'border-emerald-800 focus:border-emerald-500'
                  }`}
                />
              </div>
            </div>

            {showUnrealisticTenorWarning && (
              <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-600 text-[11px] text-red-200 font-medium">
                ⚠ Masukan Tenor realistis!
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-xs text-emerald-300 mb-1">
                  Penawaran Imbalan Jasa / Hadiah (%) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max={form.contractType === 'standard_unsecured' ? '20' : '12.5'}
                  required
                  value={form.rewardPercent}
                  onChange={(e) => {
                    const val = e.target.value;
                    const maxFormReward = form.contractType === 'standard_unsecured' ? 20 : 12.5;
                    if (val !== '' && Number(val) > maxFormReward) {
                      setForm({ ...form, rewardPercent: String(maxFormReward) });
                      return;
                    }
                    setForm({ ...form, rewardPercent: val });
                  }}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#071510] border border-emerald-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-emerald-300/75">
                  {form.contractType === 'standard_unsecured'
                    ? 'Khusus Kontrak 2: Imbalan jasa maksimal 20% (dapat dinegosiasikan/lelang)'
                    : 'Kontrak 1 & 3: Maksimal 12,5% (dapat dinegosiasikan/lelang)'}
                </span>
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-lg bg-[#071510] border border-emerald-800/80 cursor-pointer text-xs mt-1 sm:mt-4">
                <input
                  type="checkbox"
                  checked={form.isInstallment}
                  onChange={(e) => setForm({ ...form, isInstallment: e.target.checked })}
                  className="accent-emerald-500"
                />
                <span>Ajukan Pembayaran Cicilan Bulanan ({tenorCount}x)</span>
              </label>
            </div>

            {/* SIMULASI REAL-TIME LENGKAP */}
            <div className="bg-[#071510] border border-emerald-600/70 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-emerald-800/70 pb-2">
                <span className="font-bold text-emerald-300">Simulasi Kewajiban & Ketentuan Denda Real-Time</span>
                <span className="px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-200 font-mono text-[11px]">
                  {form.currency}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="text-emerald-200/80">Pinjaman Pokok:</div>
                <div className="text-right font-semibold text-white">{formatMoney(numericAmount)}</div>

                <div className="text-emerald-200/80">Imbalan Jasa ({rewardPct}%):</div>
                <div className="text-right font-semibold text-emerald-300">+ {formatMoney(rewardAmount)}</div>

                <div className="text-emerald-200/80 border-t border-emerald-800/60 pt-1.5 font-semibold">
                  Total Pengembalian (Pokok + Jasa):
                </div>
                <div className="text-right font-bold text-emerald-400 border-t border-emerald-800/60 pt-1.5 text-sm">
                  {formatMoney(totalPayable)}
                </div>

                <div className="text-emerald-200/80">
                  {form.isInstallment ? `Estimasi Cicilan (${tenorCount} Bulan):` : `Pelunasan Akhir (${tenorCount} Bulan):`}
                </div>
                <div className="text-right font-semibold text-white">
                  {formatMoney(perMonthEstimate)} {form.isInstallment ? '/ bulan' : ''}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#0c2119] border border-emerald-800/80 space-y-1 text-[11px]">
                <div className="font-semibold text-amber-300">
                  Skema Denda Berlaku: {penaltyInfo.tierName}
                </div>
                <div className="text-emerald-100/80">• Grace Period: 1 hari kalender setelah jatuh tempo (denda mulai H+2).</div>
                <div className="text-emerald-100/80">
                  • Periode Awal: {penaltyInfo.firstPeriod}{' '}
                  {numericAmount > 0 && <strong className="text-amber-200">({formatMoney(penaltyInfo.estFirstPenalty)})</strong>}
                </div>
                <div className="text-emerald-100/80">• Periode Lanjutan: {penaltyInfo.nextPeriod}</div>
                <div className="text-emerald-100/80">
                  • Batas Maksimal Denda: {penaltyInfo.maxCap}{' '}
                  {numericAmount > 0 && <strong className="text-amber-200">(Maks {formatMoney(penaltyInfo.estMaxPenalty)})</strong>}
                </div>
              </div>
            </div>
          </div>

          {/* BAGIAN 4: JAMINAN (HANYA MUNCUL JIKA KONTRAK 3 DIPILIH) */}
          {selectedContract.requiresCollateral && (
            <div className="space-y-3 pt-4 border-t border-emerald-800/70">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                4. Detail & Foto Barang Jaminan (Wajib untuk Kontrak 3)
              </div>

              <div>
                <label className="block text-xs text-emerald-300 mb-1">
                  Rincian / Keterangan Barang Jaminan (Nilai Jaminan Wajib &gt; Pokok Pinjaman) *
                </label>
                <input
                  type="text"
                  required
                  value={form.collateralDesc}
                  onChange={(e) => setForm({ ...form, collateralDesc: e.target.value })}
                  placeholder="Contoh: HP Xiaomi Redmi Note 13 Pro+ 5G Fullset / BPKB Motor..."
                  className="w-full px-3 py-2.5 rounded-lg bg-[#071510] border border-emerald-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label className="p-3.5 rounded-xl bg-[#071510] border border-dashed border-emerald-600 hover:border-emerald-400 cursor-pointer flex flex-col gap-1">
                  <span className="text-emerald-200 font-semibold">Foto Barang Jaminan 1 (Tampak Depan/Utama) *</span>
                  <span className="text-[11px] text-emerald-400">
                    {form.photoCollateral1 ? '✓ Foto Jaminan 1 terlampir' : 'Klik untuk pilih / ambil foto'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload('photoCollateral1', e)}
                    className="hidden"
                  />
                </label>

                <label className="p-3.5 rounded-xl bg-[#071510] border border-dashed border-emerald-600 hover:border-emerald-400 cursor-pointer flex flex-col gap-1">
                  <span className="text-emerald-200 font-semibold">Foto Barang Jaminan 2 (Nomor Seri/Detail) *</span>
                  <span className="text-[11px] text-emerald-400">
                    {form.photoCollateral2 ? '✓ Foto Jaminan 2 terlampir' : 'Klik untuk pilih / ambil foto'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload('photoCollateral2', e)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* BAGIAN 5: 3 FOTO VERIFIKASI IDENTITAS WAJIB */}
          <div className="space-y-3 pt-4 border-t border-emerald-800/70">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              {selectedContract.requiresCollateral ? '5.' : '4.'} Lampiran Verifikasi Identitas Wajib (Otomatis &lt; 800 KB)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <label className="p-3.5 rounded-xl bg-[#071510] border border-dashed border-emerald-700 hover:border-emerald-500 cursor-pointer flex flex-col gap-1">
                <span className="text-emerald-200 font-semibold">1. Foto KTP / Identitas *</span>
                <span className="text-[11px] text-emerald-400">
                  {form.photoId ? '✓ Terlampir' : 'Pilih / ambil foto'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload('photoId', e)}
                  className="hidden"
                />
              </label>

              <label className="p-3.5 rounded-xl bg-[#071510] border border-dashed border-emerald-700 hover:border-emerald-500 cursor-pointer flex flex-col gap-1">
                <span className="text-emerald-200 font-semibold">2. Foto Wajah / Selfie *</span>
                <span className="text-[11px] text-emerald-400">
                  {form.photoSelfie ? '✓ Terlampir' : 'Pilih / ambil foto'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload('photoSelfie', e)}
                  className="hidden"
                />
              </label>

              <label className="p-3.5 rounded-xl bg-[#071510] border border-dashed border-emerald-700 hover:border-emerald-500 cursor-pointer flex flex-col gap-1">
                <span className="text-emerald-200 font-semibold">3. Foto Selfie + KTP *</span>
                <span className="text-[11px] text-emerald-400">
                  {form.photoSelfieId ? '✓ Terlampir' : 'Pilih / ambil foto'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePhotoUpload('photoSelfieId', e)}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Catatan Opsional */}
          <div>
            <label className="block text-xs text-emerald-300 mb-1">
              Catatan Tambahan / Bukti Pendukung Lainnya (Opsional)
            </label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Keterangan singkat kebutuhan pinjaman (opsional)..."
              className="w-full px-3 py-2.5 rounded-lg bg-[#071510] border border-emerald-800 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !form.agreedAllClauses || isTenorInvalid}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors"
          >
            {submitting
              ? 'Mengirim Pengajuan...'
              : isTenorOverLimit
              ? 'Masukan Tenor realistis!'
              : !form.agreedAllClauses
              ? 'Centang Persetujuan Pasal 1–5 Terlebih Dahulu'
              : 'Kirim Pengajuan Pinjaman'}
          </button>
        </form>
      </div>
    </div>
  );
}
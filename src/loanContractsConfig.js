import { convertCurrencyDynamic, getCurrencySymbolDynamic } from './lib/currencyService';

// Fallback kurs jika belum ada cache/internet lambat (basis 1 USD)
export const FALLBACK_USD_RATES = {
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
export function formatCurrencyAmount(amount, currencyCode) {
  const code = (currencyCode || 'IDR').toUpperCase();
  const symbol = getCurrencySymbolDynamic(code);
  const num = Number(amount) || 0;
  const zeroDecimalCodes = ['IDR', 'JPY', 'KRW'];
  const formatted = zeroDecimalCodes.includes(code)
    ? Math.round(num).toLocaleString('id-ID')
    : num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${symbol} ${formatted}`;
}

// Konversi nominal batas IDR ke mata uang target dengan pembulatan bersih
export function convertIdrLimit(idrAmount, targetCurrency, rates) {
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
export function buildDynamicContracts(currencyCode, rates) {
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

// Perhitungan tier denda keterlambatan berdasarkan kontrak & mata uang
export function getPenaltyTierInfo(contractId, amount, currency, rates) {
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

// Batas maksimal lelang imbalan jasa per kontrak: Kontrak 1 & 3 = 12.5%, Kontrak 2 = 20%
export function getMaxAuctionRewardPercent(contractType) {
  return contractType === 'standard_unsecured' ? 20 : 12.5;
}
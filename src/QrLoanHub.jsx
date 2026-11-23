import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Inbox,
  Download,
  Copy,
  Check,
  X,
  RefreshCw,
  ShieldCheck,
  Power,
  PackageCheck,
  Headphones,
  PhoneCall,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { convertCurrencyDynamic } from './lib/currencyService';
import {
  getOrCreateLenderQrLink,
  updateLenderQrSettings,
  regenerateLenderQrLink,
  getIncomingApplications,
  updateApplicationStatus,
  updateApplicationFeedback,
  recordVerifiedInstallmentPayment,
  getCollateralDropProofs,
  verifyCollateralDropProof
} from './services/qrLoanService';

const PUBLIC_WEB_ORIGIN =
  window.location.hostname === 'localhost' && !window.Capacitor
    ? window.location.origin
    : 'https://formadd.vercel.app';

const DEFAULT_WA_TEMPLATES = {
  approved:
    'Halo {nama}, pengajuan pinjaman Anda sebesar {nominal} (Pokok: {pokok}, Imbalan jasa {jasa}%, tenor {tenor} bln) telah DISETUJUI.\nCek detail status & kontrak Anda di:\n{link_status}',
  counter_offer:
    'Halo {nama}, pengajuan pinjaman Anda sebesar {nominal} belum disepakati pada imbalan jasa {jasa}%.\nSilakan ajukan ulang penawaran imbalan jasa (Sistem Lelang) melalui link berikut:\n{link_status}',
  principal_offer:
    'Halo {nama}, untuk pengajuan pinjaman Anda (awal {nominal}), kami mengajukan penawaran lelang pokok pinjaman sebesar {pokok} (Imbalan jasa {jasa}%, tenor {tenor} bln).\n{alasan}\nSilakan konfirmasi atau ajukan penawaran balik melalui link berikut:\n{link_status}',
  tenor_approval:
    'Halo {nama}, untuk pengajuan pinjaman Anda sebesar {pokok} (Imbalan jasa {jasa}%), kami menetapkan PERSETUJUAN TENOR FINAL selama {tenor} bulan (bukan lelang / ketentuan tetap).\n{alasan}\nSilakan konfirmasi SETUJU atau TOLAK tenor tersebut melalui link berikut:\n{link_status}',
  upgrade_collateral:
    'Halo {nama}, untuk pengajuan pinjaman sebesar {nominal}, silakan UPGRADE kontrak Anda ke Kontrak 3 (Dengan Jaminan) agar dapat di pertimbangkan.\nKlik link berikut untuk melampirkan data/foto jaminan:\n{link_status}',
  collateral_drop:
    'Halo {nama}, terkait jaminan ({jaminan}) untuk pengajuan {nominal}:\n{feedback_jaminan}\n\nJika saya sedang tidak di rumah, silakan antar/drop jaminan ke alamat:\n{alamat_drop}\n\nPantau status pengajuan Anda di:\n{link_status}',
  rejected:
    'Halo {nama}, mohon maaf pengajuan pinjaman Anda sebesar {nominal} belum dapat kami setujui.\nAlasan: {alasan}\nDetail status: {link_status}'
};

const DEFAULT_HOTLINE_CONFIG = {
  enabled: true,
  label: 'Hotline Bantuan & Konfirmasi',
  phone: '',
  hours: '08.00 – 21.00 WIB',
  note: 'Hubungi admin/kreditur jika mengalami kendala pengisian formulir, upload jaminan, atau konfirmasi transfer.'
};

// === KAMUS 5 BAHASA DINAMIS (ID, JP, EN, CN, AR) ===
const QR_HUB_I18N = {
  id: {
    btnQr: 'QR Pengajuan',
    btnInbox: 'Pengajuan Masuk',
    btnDropProof: 'Bukti Drop Jaminan',
    btnHotline: 'Hotline',
    offBadge: 'Off',
    idNoticeTitle: 'Fitur Khusus Pengguna di Indonesia',
    idNoticeSub: 'QR Pengajuan, Kotak Masuk, Bukti Drop & Hotline',
    idNoticeBody1:
      'Fitur QR Pengajuan, Pengajuan Masuk, Bukti Drop Jaminan, dan Hotline dirancang khusus untuk transaksi di wilayah Indonesia (format nomor HP +62, Rupiah/konversi lokal, serta verifikasi KTP & dokumen).',
    idNoticeBody2:
      'Setelah diaktifkan, pengaturan ini akan tersimpan otomatis. Anda dapat mematikan atau menghidupkan kembali seluruh fitur ini dalam satu saklar melalui menu QR Pengajuan atau Hotline.',
    cancel: 'Batal',
    understandEnable: 'Saya Mengerti & Aktifkan',
    qrModalTitle: 'QR Code Pengajuan Pinjaman',
    qrModalSub: 'Khusus Wilayah & Transaksi Indonesia',
    preparingQr: 'Menyiapkan QR Code...',
    posterSectionTitle: 'Teks Poster QR (Ikut Tercetak Saat Download PNG):',
    posterTopLabel: 'Judul Atas QR:',
    posterBottomLabel: 'Catatan / Keterangan Bawah QR:',
    paymentAccLabel: 'Rekening / E-Wallet Tujuan Pembayaran (Otomatis Tersimpan & Terisi Saat ACC):',
    save: 'Simpan',
    copyLink: 'Salin Link',
    copied: 'Tersalin!',
    downloadQrText: 'Download QR + Teks',
    disableQrLink: 'Nonaktifkan Link QR',
    enableQrLink: 'Aktifkan Link QR',
    newToken: 'Buat Token Baru',
    featureStatusTitle: 'Status Fitur QR, Inbox, Bukti Drop & Hotline',
    featureStatusSub: 'Matikan jika tidak digunakan untuk transaksi Indonesia.',
    turnOffFeature: 'Matikan Fitur',
    inboxTitle: 'Pengajuan Masuk',
    lastUpdated: 'Terakhir diperbarui',
    refresh: 'Refresh',
    loading: 'Memuat...',
    loadingApps: 'Memuat data pengajuan masuk...',
    noPendingApps: 'Belum ada pengajuan baru yang menunggu persetujuan.',
    checkAgain: 'Cek Ulang Sekarang',
    dropModalTitle: 'Bukti Pengiriman / Drop Jaminan',
    deleteAllDrops: 'Hapus Semua',
    confirmDeleteAllDrops: 'Hapus semua daftar bukti drop jaminan yang tersimpan?',
    confirmDeleteSingleDrop: 'Hapus kartu bukti drop jaminan ini?',
    deletedDropToast: 'Bukti drop jaminan dihapus.',
    deletedAllDropsToast: 'Semua bukti drop jaminan berhasil dihapus.',
    loadingDrops: 'Memuat bukti drop jaminan masuk...',
    noDrops: 'Belum ada bukti pengiriman / drop barang jaminan yang diterima atau dikirim debitur.',
    appNo: 'No. Pengajuan',
    receivedDate: 'Tgl Diterima',
    notVerifiedYet: 'Belum diverifikasi',
    collateralUnit: 'Unit Jaminan',
    dropNote: 'Keterangan Drop',
    dropPhotoLabel: 'Lampiran Foto Bukti Drop / Jaminan:',
    downloadProof: 'Unduh Bukti',
    confirmSaveProof: 'Simpan & Konfirmasi Bukti Diterima',
    saving: 'Menyimpan...',
    verifiedBadge: '✓ Bukti Tersimpan & Diverifikasi',
    pendingBadge: 'Menunggu Verifikasi Kreditur',
    minimize: 'Perkecil',
    expand: 'Perluas',
    deleteCard: 'Hapus Kartu',
    hotlineModalTitle: 'Pengaturan Hotline Debitur',
    hotlineModalSub: 'Otomatis tampil di halaman formulir pengajuan (LoanApplyPage)',
    hotlineToggleTitle: 'Tampilkan Tombol Hotline di Halaman Pengajuan',
    hotlineToggleSub: 'Debitur bisa langsung chat WhatsApp / hubungi hotline dari halaman form.',
    hotlineLabelField: 'Judul / Label Hotline:',
    hotlinePhoneField: 'Nomor WhatsApp / Telepon Hotline:',
    hotlineHoursField: 'Jam Layanan / Operasional:',
    hotlineNoteField: 'Pesan / Keterangan Tambahan (Edit Manual):',
    hotlinePreviewLabel: 'Preview di Halaman Pengajuan:',
    saveApplyForm: 'Simpan & Terapkan ke Form',
    transferModalTitle: 'Laporan Transfer Cicilan',
    transferModalSub:
      'Cek mutasi rekening Anda, lalu klik Konfirmasi agar saldo tiket peminjam otomatis terupdate.',
    allTransfersVerified: 'Semua laporan transfer sudah diverifikasi.',
    installmentTo: 'Angsuran ke-',
    transferAmount: 'Nominal Transfer:',
    viaAccount: 'Via / Rekening:',
    receiptPhotoLabel: 'Lampiran Foto Bukti Struk:',
    verifying: 'Memverifikasi...',
    confirmMutationBtn: '✓ Mutasi Masuk — Konfirmasi & Update Tiket',
    saveToLinkOnly: 'Simpan ke Link Saja',
    saveSendWa: 'Simpan & Kirim via WhatsApp',
    openWaAcc: 'Buka WhatsApp & Kirim Info ACC'
  },
  en: {
    btnQr: 'Loan QR',
    btnInbox: 'Incoming Apps',
    btnDropProof: 'Collateral Drop Proofs',
    btnHotline: 'Hotline',
    offBadge: 'Off',
    idNoticeTitle: 'Indonesia Region Feature',
    idNoticeSub: 'Loan QR, Inbox, Collateral Drop Proofs & Hotline',
    idNoticeBody1:
      'Loan QR, Incoming Applications, Collateral Drop Proofs, and Hotline are tailored for transactions in Indonesia (+62 phone numbers, IDR/local currency conversion, and KTP/document verification).',
    idNoticeBody2:
      'Once enabled, this preference is saved automatically. You can turn all these features off or back on anytime with one switch inside Loan QR.',
    cancel: 'Cancel',
    understandEnable: 'I Understand & Enable',
    qrModalTitle: 'Loan Application QR Code',
    qrModalSub: 'For Indonesia Region & Transactions',
    preparingQr: 'Preparing QR Code...',
    posterSectionTitle: 'QR Poster Text (Included When Downloading PNG):',
    posterTopLabel: 'QR Top Title:',
    posterBottomLabel: 'QR Bottom Note / Subtitle:',
    paymentAccLabel: 'Destination Account / E-Wallet (Auto-Saved & Filled on Approval):',
    save: 'Save',
    copyLink: 'Copy Link',
    copied: 'Copied!',
    downloadQrText: 'Download QR + Text',
    disableQrLink: 'Disable QR Link',
    enableQrLink: 'Enable QR Link',
    newToken: 'Generate New Token',
    featureStatusTitle: 'QR, Inbox, Drop Proof & Hotline Status',
    featureStatusSub: 'Turn off if not used for Indonesia transactions.',
    turnOffFeature: 'Turn Off Feature',
    inboxTitle: 'Incoming Applications',
    lastUpdated: 'Last updated',
    refresh: 'Refresh',
    loading: 'Loading...',
    loadingApps: 'Loading incoming applications...',
    noPendingApps: 'No new applications waiting for approval.',
    checkAgain: 'Check Again Now',
    dropModalTitle: 'Collateral Delivery / Drop Proofs',
    deleteAllDrops: 'Delete All',
    confirmDeleteAllDrops: 'Delete all saved collateral drop proof records?',
    confirmDeleteSingleDrop: 'Delete this collateral drop proof card?',
    deletedDropToast: 'Collateral drop proof deleted.',
    deletedAllDropsToast: 'All collateral drop proofs deleted.',
    loadingDrops: 'Loading collateral drop proofs...',
    noDrops: 'No collateral delivery / drop proofs received or submitted yet.',
    appNo: 'Application No.',
    receivedDate: 'Received Date',
    notVerifiedYet: 'Pending verification',
    collateralUnit: 'Collateral Item',
    dropNote: 'Drop Note',
    dropPhotoLabel: 'Attached Drop / Collateral Photo:',
    downloadProof: 'Download Proof',
    confirmSaveProof: 'Save & Confirm Proof Received',
    saving: 'Saving...',
    verifiedBadge: '✓ Proof Saved & Verified',
    pendingBadge: 'Awaiting Lender Verification',
    minimize: 'Minimize',
    expand: 'Expand',
    deleteCard: 'Delete Card',
    hotlineModalTitle: 'Borrower Hotline Settings',
    hotlineModalSub: 'Automatically displayed on the application form (LoanApplyPage)',
    hotlineToggleTitle: 'Show Hotline Button on Application Page',
    hotlineToggleSub: 'Borrowers can directly chat via WhatsApp or call the hotline from the form.',
    hotlineLabelField: 'Hotline Title / Label:',
    hotlinePhoneField: 'Hotline WhatsApp / Phone Number:',
    hotlineHoursField: 'Operating / Service Hours:',
    hotlineNoteField: 'Additional Message / Instructions (Editable):',
    hotlinePreviewLabel: 'Application Page Preview:',
    saveApplyForm: 'Save & Apply to Form',
    transferModalTitle: 'Installment Transfer Reports',
    transferModalSub:
      'Verify your bank statement, then click Confirm to update the borrower ticket balance.',
    allTransfersVerified: 'All transfer reports have been verified.',
    installmentTo: 'Installment #',
    transferAmount: 'Transfer Amount:',
    viaAccount: 'Via / Account:',
    receiptPhotoLabel: 'Transfer Receipt Photo:',
    verifying: 'Verifying...',
    confirmMutationBtn: '✓ Payment Received — Confirm & Update Ticket',
    saveToLinkOnly: 'Save to Link Only',
    saveSendWa: 'Save & Send via WhatsApp',
    openWaAcc: 'Open WhatsApp & Send Approval'
  },
  jp: {
    btnQr: '申請用QR',
    btnInbox: '受信申請一覧',
    btnDropProof: '担保受渡証明',
    btnHotline: 'ホットライン',
    offBadge: 'オフ',
    idNoticeTitle: 'インドネシア地域専用機能',
    idNoticeSub: '申請用QR・受信トレイ・担保受渡証明・ホットライン',
    idNoticeBody1:
      '申請用QR、受信申請一覧、担保受渡証明、ホットラインはインドネシア国内取引向け（+62電話番号、ルピア/現地通貨換算、KTP・書類確認）に設計されています。',
    idNoticeBody2:
      '有効化すると設定は自動保存されます。申請用QRメニュー内のスイッチからいつでも一括でオン/オフを切り替えられます。',
    cancel: 'キャンセル',
    understandEnable: '理解して有効化する',
    qrModalTitle: 'ローン申請用QRコード',
    qrModalSub: 'インドネシア地域・取引専用',
    preparingQr: 'QRコードを準備中...',
    posterSectionTitle: 'QRポスターテキスト（PNG保存時に印刷されます）:',
    posterTopLabel: 'QR上部タイトル:',
    posterBottomLabel: 'QR下部メモ・説明文:',
    paymentAccLabel: '返済先口座 / Eウォレット（承認時に自動保存・入力）:',
    save: '保存',
    copyLink: 'リンクをコピー',
    copied: 'コピー完了！',
    downloadQrText: 'QR＋テキスト保存',
    disableQrLink: 'QRリンクを無効化',
    enableQrLink: 'QRリンクを有効化',
    newToken: '新規トークン発行',
    featureStatusTitle: 'QR・受信トレイ・担保証明・ホットライン状態',
    featureStatusSub: 'インドネシア取引で使用しない場合はオフにしてください。',
    turnOffFeature: '機能をオフにする',
    inboxTitle: '受信した申請',
    lastUpdated: '最終更新',
    refresh: '更新',
    loading: '読込中...',
    loadingApps: '受信申請を読み込み中...',
    noPendingApps: '承認待ちの新規申請はありません。',
    checkAgain: '今すぐ再確認',
    dropModalTitle: '担保引渡し・受領証明',
    deleteAllDrops: 'すべて削除',
    confirmDeleteAllDrops: '保存されている担保受渡証明をすべて削除しますか？',
    confirmDeleteSingleDrop: 'この担保受渡証明カードを削除しますか？',
    deletedDropToast: '担保受渡証明を削除しました。',
    deletedAllDropsToast: 'すべての担保受渡証明を削除しました。',
    loadingDrops: '担保受渡証明を読み込み中...',
    noDrops: '提出または受領された担保引渡し証明はまだありません。',
    appNo: '申請番号',
    receivedDate: '受領日',
    notVerifiedYet: '未確認',
    collateralUnit: '担保品目',
    dropNote: '受渡メモ',
    dropPhotoLabel: '添付された担保・受渡写真:',
    downloadProof: '証明を保存',
    confirmSaveProof: '受領確認して保存',
    saving: '保存中...',
    verifiedBadge: '✓ 証明保存・確認済み',
    pendingBadge: '貸主の確認待ち',
    minimize: '縮小',
    expand: '展開',
    deleteCard: 'カード削除',
    hotlineModalTitle: '借主向けホットライン設定',
    hotlineModalSub: '申請フォーム画面（LoanApplyPage）に自動表示されます',
    hotlineToggleTitle: '申請ページにホットラインボタンを表示',
    hotlineToggleSub: '借主がフォーム画面から直接WhatsAppチャットや電話連絡を行えます。',
    hotlineLabelField: 'ホットライン表示名:',
    hotlinePhoneField: 'ホットライン WhatsApp / 電話番号:',
    hotlineHoursField: '受付・営業時間:',
    hotlineNoteField: '補足メッセージ・案内文（編集可能）:',
    hotlinePreviewLabel: '申請画面でのプレビュー:',
    saveApplyForm: '保存してフォームに反映',
    transferModalTitle: '分割返済の振込報告',
    transferModalSub:
      '口座の入金明細を確認後、「確認」を押すと借主チケット残高が自動更新されます。',
    allTransfersVerified: 'すべての振込報告は確認済みです。',
    installmentTo: '返済回数 第',
    transferAmount: '振込金額:',
    viaAccount: '振込元 / 口座:',
    receiptPhotoLabel: '振込明細写真:',
    verifying: '確認中...',
    confirmMutationBtn: '✓ 入金確認完了 — チケットを更新',
    saveToLinkOnly: 'リンクのみに保存',
    saveSendWa: '保存してWhatsApp送信',
    openWaAcc: 'WhatsAppを開いて承認通知'
  },
  cn: {
    btnQr: '申请二维码',
    btnInbox: '收到的申请',
    btnDropProof: '抵押物交付凭证',
    btnHotline: '客服热线',
    offBadge: '关闭',
    idNoticeTitle: '印度尼西亚地区专用功能',
    idNoticeSub: '申请二维码、收件箱、抵押物交付凭证与热线',
    idNoticeBody1:
      '申请二维码、收到的申请、抵押物交付凭证及热线专为印度尼西亚地区交易设计（+62手机号格式、印尼盾/本地汇率换算及KTP证件审核）。',
    idNoticeBody2:
      '启用后设置将自动保存。您可随时在“申请二维码”菜单中通过一键开关关闭或重新开启全部功能。',
    cancel: '取消',
    understandEnable: '我已了解并启用',
    qrModalTitle: '借款申请二维码',
    qrModalSub: '仅限印度尼西亚地区及交易使用',
    preparingQr: '正在生成二维码...',
    posterSectionTitle: '二维码海报文字（下载PNG时一并打印）:',
    posterTopLabel: '二维码顶部标题:',
    posterBottomLabel: '二维码底部备注/说明:',
    paymentAccLabel: '收款账户 / 电子钱包（审批通过时自动保存并填充）:',
    save: '保存',
    copyLink: '复制链接',
    copied: '已复制！',
    downloadQrText: '下载二维码+文字',
    disableQrLink: '停用二维码链接',
    enableQrLink: '启用二维码链接',
    newToken: '生成新令牌',
    featureStatusTitle: '二维码、收件箱、抵押凭证与热线状态',
    featureStatusSub: '如不用于印尼交易，可关闭此功能。',
    turnOffFeature: '关闭功能',
    inboxTitle: '收到的申请',
    lastUpdated: '最后更新',
    refresh: '刷新',
    loading: '加载中...',
    loadingApps: '正在加载收到的申请...',
    noPendingApps: '暂无等待审批的新申请。',
    checkAgain: '立即重新检查',
    dropModalTitle: '抵押物交付 / 交接凭证',
    deleteAllDrops: '全部删除',
    confirmDeleteAllDrops: '确定要删除所有已保存的抵押物交付凭证吗？',
    confirmDeleteSingleDrop: '确定要删除此抵押物交付凭证卡片吗？',
    deletedDropToast: '已删除抵押物交付凭证。',
    deletedAllDropsToast: '已清空所有抵押物交付凭证。',
    loadingDrops: '正在加载抵押物交付凭证...',
    noDrops: '暂未收到或提交任何抵押物交付凭证。',
    appNo: '申请编号',
    receivedDate: '接收日期',
    notVerifiedYet: '待核实',
    collateralUnit: '抵押物品',
    dropNote: '交付备注',
    dropPhotoLabel: '抵押物/交付凭证照片附件:',
    downloadProof: '下载凭证',
    confirmSaveProof: '保存并确认已收到抵押物',
    saving: '保存中...',
    verifiedBadge: '✓ 凭证已保存并核实',
    pendingBadge: '等待出借人核实',
    minimize: '收起',
    expand: '展开',
    deleteCard: '删除卡片',
    hotlineModalTitle: '借款人热线设置',
    hotlineModalSub: '自动显示在申请表单页面 (LoanApplyPage)',
    hotlineToggleTitle: '在申请页面显示热线按钮',
    hotlineToggleSub: '借款人可直接在表单页面通过 WhatsApp 聊天或拨打热线。',
    hotlineLabelField: '热线标题 / 标签:',
    hotlinePhoneField: '热线 WhatsApp / 电话号码:',
    hotlineHoursField: '服务 / 营业时间:',
    hotlineNoteField: '附加说明 / 提示信息（可手动编辑）:',
    hotlinePreviewLabel: '申请页面预览效果:',
    saveApplyForm: '保存并应用到表单',
    transferModalTitle: '分期转账报告',
    transferModalSub: '核对您的银行流水后，点击确认以自动更新借款人账单余额。',
    allTransfersVerified: '所有转账报告均已核实。',
    installmentTo: '第',
    transferAmount: '转账金额:',
    viaAccount: '转账方式 / 账户:',
    receiptPhotoLabel: '转账凭证截图:',
    verifying: '核实中...',
    confirmMutationBtn: '✓ 已收到款项 — 确认并更新账单',
    saveToLinkOnly: '仅保存到链接',
    saveSendWa: '保存并通过 WhatsApp 发送',
    openWaAcc: '打开 WhatsApp 发送审批通知'
  },
  ar: {
    btnQr: 'رمز QR للطلب',
    btnInbox: 'الطلبات الواردة',
    btnDropProof: 'إثبات تسليم الضمان',
    btnHotline: 'الخط الساخن',
    offBadge: 'متوقف',
    idNoticeTitle: 'ميزة مخصصة للمستخدمين في إندونيسيا',
    idNoticeSub: 'رمز QR، صندوق الوارد، إثبات الضمان والخط الساخن',
    idNoticeBody1:
      'تم تصميم ميزات رمز QR والطلبات الواردة وإثبات تسليم الضمان والخط الساخن خصيصاً للمعاملات داخل إندونيسيا (أرقام +62، الروبية والتحويل المحلي، والتحقق من الهوية والمستندات).',
    idNoticeBody2:
      'بعد التفعيل، يتم حفظ الإعداد تلقائياً. يمكنك إيقاف أو إعادة تشغيل جميع هذه الميزات بزر واحد من قائمة رمز QR.',
    cancel: 'إلغاء',
    understandEnable: 'أفهم وأوافق على التفعيل',
    qrModalTitle: 'رمز QR لتقديم طلب القرض',
    qrModalSub: 'خاص بمنطقة ومعاملات إندونيسيا',
    preparingQr: 'جاري تجهيز رمز QR...',
    posterSectionTitle: 'نص ملصق QR (يُطبع تلقائياً عند تنزيل PNG):',
    posterTopLabel: 'العنوان العلوي لرمز QR:',
    posterBottomLabel: 'الملاحظة السفلية لرمز QR:',
    paymentAccLabel: 'حساب / محفظة السداد (يُحفظ ويُملأ تلقائياً عند الموافقة):',
    save: 'حفظ',
    copyLink: 'نسخ الرابط',
    copied: 'تم النسخ!',
    downloadQrText: 'تنزيل QR + النص',
    disableQrLink: 'تعطيل رابط QR',
    enableQrLink: 'تفعيل رابط QR',
    newToken: 'إنشاء رمز جديد',
    featureStatusTitle: 'حالة ميزات QR والوارد والضمان والخط الساخن',
    featureStatusSub: 'قم بالإيقاف إذا لم تكن تستخدمها لمعاملات إندونيسيا.',
    turnOffFeature: 'إيقاف الميزة',
    inboxTitle: 'الطلبات الواردة',
    lastUpdated: 'آخر تحديث',
    refresh: 'تحديث',
    loading: 'جاري التحميل...',
    loadingApps: 'جاري تحميل الطلبات الواردة...',
    noPendingApps: 'لا توجد طلبات جديدة بانتظار الموافقة.',
    checkAgain: 'إعادة الفحص الآن',
    dropModalTitle: 'إثباتات تسليم / إيداع الضمان',
    deleteAllDrops: 'حذف الكل',
    confirmDeleteAllDrops: 'هل تريد حذف جميع إثباتات تسليم الضمان المحفوظة؟',
    confirmDeleteSingleDrop: 'هل تريد حذف بطاقة إثبات تسليم الضمان هذه؟',
    deletedDropToast: 'تم حذف إثبات تسليم الضمان.',
    deletedAllDropsToast: 'تم حذف جميع إثباتات تسليم الضمان.',
    loadingDrops: 'جاري تحميل إثباتات تسليم الضمان...',
    noDrops: 'لا توجد إثباتات تسليم ضمان مستلمة أو مرسلة بعد.',
    appNo: 'رقم الطلب',
    receivedDate: 'تاريخ الاستلام',
    notVerifiedYet: 'بانتظار التحقق',
    collateralUnit: 'عنصر الضمان',
    dropNote: 'ملاحظة التسليم',
    dropPhotoLabel: 'صورة إثبات التسليم / الضمان المرفقة:',
    downloadProof: 'تنزيل الإثبات',
    confirmSaveProof: 'حفظ وتأكيد استلام الضمان',
    saving: 'جاري الحفظ...',
    verifiedBadge: '✓ تم حفظ الإثبات والتحقق منه',
    pendingBadge: 'بانتظار تحقق المُقرض',
    minimize: 'تصغير',
    expand: 'توسيع',
    deleteCard: 'حذف البطاقة',
    hotlineModalTitle: 'إعدادات الخط الساخن للمقترضين',
    hotlineModalSub: 'يظهر تلقائياً في صفحة نموذج الطلب (LoanApplyPage)',
    hotlineToggleTitle: 'إظهار زر الخط الساخن في صفحة الطلب',
    hotlineToggleSub: 'يمكن للمقترض التواصل مباشرة عبر واتساب أو الاتصال من صفحة النموذج.',
    hotlineLabelField: 'عنوان / تسمية الخط الساخن:',
    hotlinePhoneField: 'رقم واتساب / هاتف الخط الساخن:',
    hotlineHoursField: 'ساعات العمل والخدمة:',
    hotlineNoteField: 'رسالة / تعليمات إضافية (قابلة للتعديل):',
    hotlinePreviewLabel: 'معاينة في صفحة الطلب:',
    saveApplyForm: 'حفظ وتطبيق على النموذج',
    transferModalTitle: 'بلاغات تحويل الأقساط',
    transferModalSub:
      'تحقق من كشف حسابك البنكي، ثم اضغط تأكيد لتحديث رصيد تذكرة المقترض تلقائياً.',
    allTransfersVerified: 'تم التحقق من جميع بلاغات التحويل.',
    installmentTo: 'القسط رقم ',
    transferAmount: 'مبلغ التحويل:',
    viaAccount: 'عبر / الحساب:',
    receiptPhotoLabel: 'صورة إيصال التحويل:',
    verifying: 'جاري التحقق...',
    confirmMutationBtn: '✓ تم استلام التحويل — تأكيد وتحديث التذكرة',
    saveToLinkOnly: 'حفظ في الرابط فقط',
    saveSendWa: 'حفظ وإرسال عبر واتساب',
    openWaAcc: 'فتح واتساب وإرسال الموافقة'
  }
};

export default function QrLoanHub({
  isDarkMode = true,
  lang,
  language,
  currentLang,
  managerCurrency,
  liveRates,
  themeStyle,
  modalBg,
  bgInnerBox,
  inputBg,
  debts,
  onApproveApplication,
  onVerifiedInstallmentTransfer,
  onMarkApplicationApprovedRef,
  showToast
}) {
  // === DETEKSI BAHASA DINAMIS (ID, JP, EN, CN, AR) ===
  const [detectedLang, setDetectedLang] = useState(() => {
    const raw =
      lang ||
      language ||
      currentLang ||
      localStorage.getItem('wgen_lang') ||
      localStorage.getItem('wgen_language') ||
      localStorage.getItem('app_lang') ||
      'id';
    return String(raw).toLowerCase().slice(0, 2);
  });

  useEffect(() => {
    const syncLang = () => {
      const raw =
        lang ||
        language ||
        currentLang ||
        localStorage.getItem('wgen_lang') ||
        localStorage.getItem('wgen_language') ||
        localStorage.getItem('app_lang') ||
        'id';
      const normalized = String(raw).toLowerCase().slice(0, 2);
      setDetectedLang(QR_HUB_I18N[normalized] ? normalized : 'id');
    };
    syncLang();
    window.addEventListener('storage', syncLang);
    return () => window.removeEventListener('storage', syncLang);
  }, [lang, language, currentLang]);

  const activeLang = QR_HUB_I18N[detectedLang] ? detectedLang : 'id';
  const t = QR_HUB_I18N[activeLang];
  const isRtl = activeLang === 'ar';

  // === HELPER STYLING ADAPTIF LIGHT / DARK MODE ===
  const effectiveModalBg = isDarkMode
    ? modalBg || 'bg-slate-900 border-slate-700 text-slate-100'
    : 'bg-white border-slate-300 text-slate-900';

  const effectiveInnerBox = isDarkMode
    ? bgInnerBox || 'bg-slate-950/60 border-slate-800 text-slate-100'
    : 'bg-slate-50 border-slate-200 text-slate-900';

  const effectiveInputBg = isDarkMode
    ? inputBg || 'bg-slate-900/90 border-slate-700 text-white placeholder-slate-400'
    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none';

  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSecondary = isDarkMode ? 'text-slate-300' : 'text-slate-700';
  const textMuted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const borderDivider = isDarkMode ? 'border-slate-700/60' : 'border-slate-200';
  const closeBtnClass = isDarkMode
    ? 'text-slate-400 hover:text-white'
    : 'text-slate-500 hover:text-slate-900';
  const secondaryBtnClass = isDarkMode
    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300';

  // === STATE FITUR KHUSUS INDONESIA (AKTIF / NONAKTIF & PERSETUJUAN AWAL) ===
  const [qrFeatureEnabled, setQrFeatureEnabled] = useState(() => {
    return localStorage.getItem('wgen_qr_feature_enabled') === 'true';
  });
  const [hasAcceptedIdNotice, setHasAcceptedIdNotice] = useState(() => {
    return localStorage.getItem('wgen_qr_id_notice_accepted') === 'true';
  });
  const [showIdNoticeModal, setShowIdNoticeModal] = useState(false);
  const [pendingActionAfterConsent, setPendingActionAfterConsent] = useState(null);

  // === STATE QR CODE & TEKS POSTER CUSTOM ===
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrLinkData, setQrLinkData] = useState(null);
  const [qrPaymentAccount, setQrPaymentAccount] = useState('');
  const [qrPaymentMethod, setQrPaymentMethod] = useState('transfer');
  const [qrPosterTitle, setQrPosterTitle] = useState(() => {
    return localStorage.getItem('wgen_qr_poster_title') || 'SCAN QR PENGAJUAN PINJAMAN';
  });
  const [qrPosterSubtitle, setQrPosterSubtitle] = useState(() => {
    return (
      localStorage.getItem('wgen_qr_poster_subtitle') ||
      'Isi formulir online & pantau status pencairan langsung dari HP Anda'
    );
  });
  const [loadingQr, setLoadingQr] = useState(false);
  const [copiedQrLink, setCopiedQrLink] = useState(false);

  // === STATE HOTLINE (TOMBOL KE-4 — TERINTEGRASI KE LoanApplyPage.jsx) ===
  const [showHotlineModal, setShowHotlineModal] = useState(false);
  const [savingHotline, setSavingHotline] = useState(false);
  const [hotlineConfig, setHotlineConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('wgen_qr_hotline_config');
      return saved ? { ...DEFAULT_HOTLINE_CONFIG, ...JSON.parse(saved) } : DEFAULT_HOTLINE_CONFIG;
    } catch {
      return DEFAULT_HOTLINE_CONFIG;
    }
  });

  // === STATE INBOX PENGAJUAN & NOTIFIKASI ===
  const [showInboxModal, setShowInboxModal] = useState(false);
  const [incomingApps, setIncomingApps] = useState([]);
  const [agreedAppsNotif, setAgreedAppsNotif] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const isFetchingAppsRef = useRef(false);

  // === STATE BUKTI DROP JAMINAN MASUK & TERSIMPAN (TOMBOL KE-3) ===
  const [showDropProofModal, setShowDropProofModal] = useState(false);
  const [dropProofList, setDropProofList] = useState(() => {
    try {
      const cached = localStorage.getItem('wgen_verified_drop_proofs_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [deletedDropIds, setDeletedDropIds] = useState(() => {
    try {
      const saved = localStorage.getItem('wgen_deleted_drop_proof_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [minimizedDropCards, setMinimizedDropCards] = useState({});
  const [loadingDropProofs, setLoadingDropProofs] = useState(false);
  const [verifyingDropId, setVerifyingDropId] = useState(null);

  // === STATE LAPORAN TRANSFER CICILAN MASUK ===
  const [pendingInstallmentReports, setPendingInstallmentReports] = useState([]);
  const [showTransferNotifModal, setShowTransferNotifModal] = useState(false);
  const [verifyingReportId, setVerifyingReportId] = useState(null);

  // === STATE TEMPLATE WA & MODAL AKSI ===
  const [waTemplates, setWaTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem('wgen_wa_loan_templates');
      return saved ? { ...DEFAULT_WA_TEMPLATES, ...JSON.parse(saved) } : DEFAULT_WA_TEMPLATES;
    } catch {
      return DEFAULT_WA_TEMPLATES;
    }
  });

  const [dropAddressDefault, setDropAddressDefault] = useState(() => {
    return (
      localStorage.getItem('wgen_collateral_drop_address') ||
      'Alamat Kreditur (isi alamat rumah / titip penerima di sini)'
    );
  });

  const [actionModal, setActionModal] = useState({
    open: false,
    type: 'collateral_drop',
    app: null,
    offeredPrincipal: '',
    offeredTenor: '1',
    reasonText: '',
    collateralNote: '',
    dropAddress: '',
    collateralReceived: false,
    waMessage: ''
  });

  // Helper simpan cache lokal bukti drop
  const persistDropProofCache = (items) => {
    try {
      localStorage.setItem('wgen_verified_drop_proofs_cache', JSON.stringify(items));
    } catch (e) {
      console.warn('Cache bukti drop melebihi kuota storage:', e);
    }
  };

  const persistDeletedDropIds = (ids) => {
    try {
      localStorage.setItem('wgen_deleted_drop_proof_ids', JSON.stringify(ids));
    } catch (e) {
      console.warn('Gagal menyimpan daftar ID drop terhapus:', e);
    }
  };

  // Helper format tanggal penerimaan barang
  const formatDropReceivedDate = (drop) => {
    const rawDate = drop.verified_at || drop.created_at;
    if (!rawDate) return t.notVerifiedYet;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return String(rawDate);
    const localeMap = {
      id: 'id-ID',
      en: 'en-US',
      jp: 'ja-JP',
      cn: 'zh-CN',
      ar: 'ar-SA'
    };
    return d.toLocaleDateString(localeMap[activeLang] || 'id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper format angka & batas kontrak
  const formatNumberWithSeparator = (value) => {
    if (value === undefined || value === null || value === '') return '';
    const cleanValue = String(value).replace(/\D/g, '');
    return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const getContractLimits = ({ isMicro = false, hasCollateral = false, currencyCode = 'IDR' }) => {
    const cleanCurr = (currencyCode || 'IDR').toUpperCase();
    const minIdr = isMicro ? 100000 : 300000;
    const maxIdr = isMicro ? 500000 : hasCollateral ? 50000000 : 10999999;

    const minVal =
      cleanCurr === 'IDR'
        ? minIdr
        : Math.max(1, Math.round(convertCurrencyDynamic(minIdr, 'IDR', cleanCurr, liveRates)));

    const maxVal =
      cleanCurr === 'IDR'
        ? maxIdr
        : Math.max(minVal, Math.round(convertCurrencyDynamic(maxIdr, 'IDR', cleanCurr, liveRates)));

    const contractLabel = isMicro
      ? 'Kontrak 1 (Mikro • Tanpa Jaminan)'
      : hasCollateral
      ? 'Kontrak 3 (Dengan Jaminan)'
      : 'Kontrak 2 (Tanpa Jaminan)';

    return { minVal, maxVal, contractLabel, cleanCurr };
  };

  const clampContractAmount = (rawDigits, limits) => {
    if (!rawDigits) return '';
    const num = Number(rawDigits);
    if (isNaN(num)) return '';
    if (num > limits.maxVal) return String(limits.maxVal);
    return String(num);
  };

  const getAppContractLimits = (app) => {
    if (!app) {
      return getContractLimits({
        isMicro: false,
        hasCollateral: false,
        currencyCode: managerCurrency || 'IDR'
      });
    }
    const curr = (app.currency || managerCurrency || 'IDR').toUpperCase();
    const hasCol = Number(app.has_collateral) === 1;
    const reqAmt = Number(app.requested_amount || 0);
    const reqIdr = curr === 'IDR' ? reqAmt : convertCurrencyDynamic(reqAmt, curr, 'IDR', liveRates);
    const isMicroApp = !hasCol && reqIdr > 0 && reqIdr <= 500000;

    return getContractLimits({
      isMicro: isMicroApp,
      hasCollateral: hasCol,
      currencyCode: curr
    });
  };

  const formatWaPhone = (rawPhone) => {
    const digits = String(rawPhone || '').replace(/\D/g, '');
    if (digits.startsWith('0')) return '62' + digits.slice(1);
    return digits;
  };

  // === HELPER DETEKSI STATUS DEBITUR SETUJU / MINTA TAMBAH POKOK ===
  const AGREED_STATUSES = [
    'borrower_agreed',
    'agreed',
    'accepted',
    'confirmed_by_borrower',
    'tenor_agreed'
  ];

  const BORROWER_COUNTER_STATUSES = [
    'borrower_counter',
    'borrower_counter_offer',
    'borrower_principal_offer',
    'principal_requested',
    'additional_requested',
    'topup_requested',
    'negotiating',
    'renegotiate',
    'counter_by_borrower'
  ];

  const isRowBorrowerAgreed = (row) => {
    const st = String(row.status || '').toLowerCase().trim();
    return AGREED_STATUSES.includes(st);
  };

  const isRowBorrowerCounter = (row) => {
    const st = String(row.status || '').toLowerCase().trim();
    if (BORROWER_COUNTER_STATUSES.includes(st)) return true;

    const borrowerCounterAmt = Number(row.borrower_counter_amount || 0);
    const lenderCounterAmt = Number(row.counter_principal_amount || 0);
    const reqAmt = Number(row.requested_amount || 0);

    if (borrowerCounterAmt > 0) return true;

    if (
      st === 'pending' &&
      lenderCounterAmt > 0 &&
      reqAmt > 0 &&
      reqAmt !== lenderCounterAmt
    ) {
      return true;
    }

    const hasBorrowerNote = Boolean(
      row.borrower_reply_note && String(row.borrower_reply_note).trim() !== ''
    );
    if ((st === 'pending' || st === 'counter_offer' || st === 'tenor_offer') && hasBorrowerNote) {
      return true;
    }

    return false;
  };

  // === POLLING & REFRESH DATA INBOX, BUKTI DROP JAMINAN, & TRANSFER MASUK ===
  const loadQrApplicationsAndReports = async (explicitUid = '', showSpinner = false) => {
    if (!qrFeatureEnabled) return;

    const uid =
      explicitUid ||
      auth?.currentUser?.uid ||
      localStorage.getItem('wgen_last_uid') ||
      '';
    if (!uid) return;
    if (isFetchingAppsRef.current) return;

    isFetchingAppsRef.current = true;
    if (showSpinner) {
      setLoadingInbox(true);
      setLoadingDropProofs(true);
    }

    try {
      const [allRows, dbDropRows] = await Promise.all([
        getIncomingApplications(uid, 'all'),
        typeof getCollateralDropProofs === 'function'
          ? getCollateralDropProofs(uid).catch(() => [])
          : Promise.resolve([])
      ]);

      setIncomingApps(
        allRows.filter((row) => {
          const st = String(row.status || '').toLowerCase().trim();
          return st !== 'approved' && st !== 'rejected';
        })
      );

      setAgreedAppsNotif(
        allRows.filter((row) => {
          const st = String(row.status || '').toLowerCase().trim();
          if (st === 'approved' || st === 'rejected') return false;
          return isRowBorrowerAgreed(row) || isRowBorrowerCounter(row);
        })
      );

      let cachedLocalDrops = [];
      try {
        cachedLocalDrops = JSON.parse(
          localStorage.getItem('wgen_verified_drop_proofs_cache') || '[]'
        );
      } catch {
        cachedLocalDrops = [];
      }

      let currentDeletedIds = [];
      try {
        currentDeletedIds = JSON.parse(
          localStorage.getItem('wgen_deleted_drop_proof_ids') || '[]'
        );
      } catch {
        currentDeletedIds = [];
      }
      const deletedSet = new Set(currentDeletedIds);

      const dropMap = new Map();

      if (Array.isArray(cachedLocalDrops)) {
        for (const item of cachedLocalDrops) {
          const key = item.application_id || item.id;
          if (key && !deletedSet.has(key) && !deletedSet.has(item.id)) {
            dropMap.set(key, item);
          }
        }
      }

      if (Array.isArray(dbDropRows)) {
        for (const item of dbDropRows) {
          const key = item.application_id || item.id;
          if (!key || deletedSet.has(key) || deletedSet.has(item.id)) continue;
          const existing = dropMap.get(key);
          dropMap.set(key, {
            ...existing,
            ...item,
            status:
              existing?.status === 'verified' || item.status === 'verified'
                ? 'verified'
                : item.status || 'pending'
          });
        }
      }

      for (const app of allRows) {
        if (deletedSet.has(app.id) || deletedSet.has(`DROP-${app.id}`)) continue;

        const fb = String(app.collateral_feedback || '');
        const hasDropFromDebtor =
          fb.includes('[BUKTI DROP DIKIRIM DEBITUR') ||
          Boolean(app.drop_proof_image) ||
          Boolean(app.collateral_drop_proof);
        const isMarkedReceivedByLender = fb.includes('[✓ BARANG JAMINAN DITERIMA]');

        if (hasDropFromDebtor || isMarkedReceivedByLender) {
          const matchNote = fb.match(/\[BUKTI DROP DIKIRIM DEBITUR:\s*([^\]]+)\]/);
          const cleanFeedbackNote = fb
            .replace(/\[✓ BARANG JAMINAN DITERIMA\]\s*/g, '')
            .replace(/\[BUKTI DROP DIKIRIM DEBITUR:[^\]]+\]\s*/g, '')
            .trim();

          const existing = dropMap.get(app.id);
          dropMap.set(app.id, {
            id: existing?.id || `DROP-${app.id}`,
            application_id: app.id,
            lender_uid: uid,
            borrower_name: app.borrower_name || existing?.borrower_name || 'Debitur',
            borrower_phone: app.borrower_phone || existing?.borrower_phone || '',
            collateral_desc: app.collateral_desc || existing?.collateral_desc || 'Jaminan Kontrak 3',
            drop_note:
              (matchNote ? matchNote[1] : '') ||
              cleanFeedbackNote ||
              existing?.drop_note ||
              'Barang jaminan diterima & diverifikasi kreditur',
            proof_image:
              app.drop_proof_image ||
              app.collateral_drop_proof ||
              app.photo_collateral_1 ||
              existing?.proof_image ||
              '',
            status:
              isMarkedReceivedByLender || existing?.status === 'verified'
                ? 'verified'
                : 'pending',
            verified_at: existing?.verified_at || (isMarkedReceivedByLender ? app.updated_at : null),
            created_at: app.updated_at || app.created_at || new Date().toISOString()
          });
        }
      }

      const finalMergedDrops = Array.from(dropMap.values());
      setDropProofList(finalMergedDrops);
      persistDropProofCache(finalMergedDrops);

      // Laporan transfer cicilan masuk
      const reports = [];
      for (const app of allRows) {
        if (app.status !== 'approved') continue;
        let hist = [];
        try {
          hist = JSON.parse(app.installment_history || '[]');
        } catch {
          hist = [];
        }
        if (Array.isArray(hist)) {
          for (const item of hist) {
            if (item.status === 'pending_verification') {
              reports.push({
                ...item,
                applicationId: app.id,
                borrowerName: app.borrower_name,
                borrowerPhone: app.borrower_phone,
                currency: app.currency || 'IDR',
                totalPrincipal: Number(app.requested_amount || 0),
                rewardPercent: Number(app.reward_percent ?? 20)
              });
            }
          }
        }
      }
      setPendingInstallmentReports(reports);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('Gagal memuat pengajuan & laporan masuk:', err);
    } finally {
      isFetchingAppsRef.current = false;
      if (showSpinner) {
        setLoadingInbox(false);
        setLoadingDropProofs(false);
      }
    }
  };

  useEffect(() => {
    if (!qrFeatureEnabled) {
      setIncomingApps([]);
      setAgreedAppsNotif([]);
      setPendingInstallmentReports([]);
      return;
    }

    let isMounted = true;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!isMounted) return;
      if (user?.uid) {
        localStorage.setItem('wgen_last_uid', user.uid);
        loadQrApplicationsAndReports(user.uid, true);
      }
    });

    const cachedUid = auth?.currentUser?.uid || localStorage.getItem('wgen_last_uid');
    if (cachedUid) {
      loadQrApplicationsAndReports(cachedUid, true);
    }

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadQrApplicationsAndReports();
      }
    }, 6000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadQrApplicationsAndReports();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      unsubscribeAuth();
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [qrFeatureEnabled]);

  useEffect(() => {
    if (onMarkApplicationApprovedRef) {
      onMarkApplicationApprovedRef.current = async (appId) => {
        if (!appId) return;
        await updateApplicationStatus(appId, 'approved');
        setIncomingApps((prev) => prev.filter((item) => item.id !== appId));
        setAgreedAppsNotif((prev) => prev.filter((item) => item.id !== appId));
      };
    }
  }, [onMarkApplicationApprovedRef]);

  // === HANDLER AKTIVASI / NONAKTIF FITUR KHUSUS INDONESIA ===
  const executePendingFeatureAction = async (actionType) => {
    if (actionType === 'open_qr') {
      await openQrModalDirect();
    } else if (actionType === 'open_inbox') {
      setShowInboxModal(true);
      await loadQrApplicationsAndReports('', true);
    } else if (actionType === 'open_drop_proofs') {
      setShowDropProofModal(true);
      await loadQrApplicationsAndReports('', true);
    } else if (actionType === 'open_hotline') {
      setShowHotlineModal(true);
      await ensureQrLinkLoaded();
    }
  };

  const handleFeatureAccessRequest = async (actionType) => {
    if (!hasAcceptedIdNotice || !qrFeatureEnabled) {
      setPendingActionAfterConsent(actionType);
      setShowIdNoticeModal(true);
      return;
    }
    await executePendingFeatureAction(actionType);
  };

  const handleConfirmEnableIdFeature = async () => {
    localStorage.setItem('wgen_qr_id_notice_accepted', 'true');
    localStorage.setItem('wgen_qr_feature_enabled', 'true');
    setHasAcceptedIdNotice(true);
    setQrFeatureEnabled(true);
    setShowIdNoticeModal(false);

    if (qrLinkData?.token && typeof updateLenderQrSettings === 'function') {
      updateLenderQrSettings(qrLinkData.token, {
        hotlineEnabled: hotlineConfig.enabled,
        hotlineLabel: hotlineConfig.label,
        hotlinePhone: hotlineConfig.phone,
        hotlineHours: hotlineConfig.hours,
        hotlineNote: hotlineConfig.note
      }).catch(() => {});
    }

    if (showToast) {
      showToast('Fitur QR Pengajuan, Inbox, Bukti Drop & Hotline (Indonesia) diaktifkan.', 'success');
    }

    const nextAction = pendingActionAfterConsent;
    setPendingActionAfterConsent(null);
    if (nextAction) {
      await executePendingFeatureAction(nextAction);
    }
  };

  const handleToggleQrFeature = async (nextState) => {
    setQrFeatureEnabled(nextState);
    localStorage.setItem('wgen_qr_feature_enabled', nextState ? 'true' : 'false');
    if (!nextState) {
      setShowQrModal(false);
      setShowInboxModal(false);
      setShowDropProofModal(false);
      setShowHotlineModal(false);

      if (qrLinkData?.token && typeof updateLenderQrSettings === 'function') {
        updateLenderQrSettings(qrLinkData.token, {
          hotlineEnabled: false
        }).catch(() => {});
      }

      if (showToast) {
        showToast('Fitur QR Pengajuan, Inbox, Bukti Drop & Hotline telah dinonaktifkan.', 'info');
      }
    } else {
      localStorage.setItem('wgen_qr_id_notice_accepted', 'true');
      setHasAcceptedIdNotice(true);
      loadQrApplicationsAndReports('', true);

      if (qrLinkData?.token && typeof updateLenderQrSettings === 'function') {
        updateLenderQrSettings(qrLinkData.token, {
          hotlineEnabled: hotlineConfig.enabled,
          hotlineLabel: hotlineConfig.label,
          hotlinePhone: hotlineConfig.phone,
          hotlineHours: hotlineConfig.hours,
          hotlineNote: hotlineConfig.note
        }).catch(() => {});
      }

      if (showToast) {
        showToast('Fitur QR Pengajuan, Inbox, Bukti Drop & Hotline kembali aktif.', 'success');
      }
    }
  };

  // === VERIFIKASI, MINIMIZE, & HAPUS BUKTI DROP JAMINAN ===
  const handleVerifyAndSaveDropProof = async (dropItem) => {
    setVerifyingDropId(dropItem.id);
    try {
      const noteText = `Barang jaminan (${dropItem.collateral_desc || 'Unit Jaminan'}) telah diterima & disimpan oleh kreditur.`;

      if (typeof verifyCollateralDropProof === 'function') {
        await verifyCollateralDropProof(
          dropItem.id,
          dropItem.application_id,
          noteText
        ).catch(() => {});
      }

      if (dropItem.application_id && typeof updateApplicationFeedback === 'function') {
        await updateApplicationFeedback({
          applicationId: dropItem.application_id,
          collateralFeedback: `[✓ BARANG JAMINAN DITERIMA] ${dropItem.drop_note || noteText}`
        }).catch(() => {});
      }

      const nowIso = new Date().toISOString();
      setDropProofList((prev) => {
        const updated = prev.map((item) =>
          item.id === dropItem.id || item.application_id === dropItem.application_id
            ? { ...item, status: 'verified', verified_at: nowIso }
            : item
        );
        persistDropProofCache(updated);
        return updated;
      });

      if (showToast) {
        showToast('Bukti drop jaminan berhasil diverifikasi & tersimpan!', 'success');
      }
    } catch (err) {
      if (showToast) {
        showToast(err.message || 'Gagal menyimpan verifikasi bukti drop.', 'error');
      }
    } finally {
      setVerifyingDropId(null);
    }
  };

  const handleDeleteSingleDropProof = async (dropItem) => {
    if (!window.confirm(t.confirmDeleteSingleDrop)) return;

    const targetAppId = dropItem.application_id;
    const targetDropId = dropItem.id;

    // 1. Catat ke blacklist lokal agar tidak direkonstruksi ulang dari polling
    const nextDeletedIds = Array.from(
      new Set([...deletedDropIds, targetAppId, targetDropId].filter(Boolean))
    );
    setDeletedDropIds(nextDeletedIds);
    persistDeletedDropIds(nextDeletedIds);

    // 2. Hapus dari state & cache lokal
    setDropProofList((prev) => {
      const updated = prev.filter(
        (item) => item.id !== targetDropId && item.application_id !== targetAppId
      );
      persistDropProofCache(updated);
      return updated;
    });

    // 3. Bersihkan marker drop di DB aplikasi bila ada
    if (targetAppId && typeof updateApplicationFeedback === 'function') {
      updateApplicationFeedback({
        applicationId: targetAppId,
        collateralFeedback: ''
      }).catch(() => {});
    }

    if (showToast) {
      showToast(t.deletedDropToast, 'info');
    }
  };

  const handleDeleteAllDropProofs = async () => {
    if (dropProofList.length === 0) return;
    if (!window.confirm(t.confirmDeleteAllDrops)) return;

    const allIdsToBlock = [];
    for (const item of dropProofList) {
      if (item.application_id) allIdsToBlock.push(item.application_id);
      if (item.id) allIdsToBlock.push(item.id);
    }

    const nextDeletedIds = Array.from(new Set([...deletedDropIds, ...allIdsToBlock]));
    setDeletedDropIds(nextDeletedIds);
    persistDeletedDropIds(nextDeletedIds);

    const itemsSnapshot = [...dropProofList];
    setDropProofList([]);
    persistDropProofCache([]);
    setMinimizedDropCards({});

    for (const item of itemsSnapshot) {
      if (item.application_id && typeof updateApplicationFeedback === 'function') {
        updateApplicationFeedback({
          applicationId: item.application_id,
          collateralFeedback: ''
        }).catch(() => {});
      }
    }

    if (showToast) {
      showToast(t.deletedAllDropsToast, 'info');
    }
  };

  const toggleMinimizeDropCard = (cardKey) => {
    setMinimizedDropCards((prev) => ({
      ...prev,
      [cardKey]: !prev[cardKey]
    }));
  };

  const handleDownloadDropProofImage = (dropItem) => {
    if (!dropItem.proof_image) return;
    const link = document.createElement('a');
    link.download = `Bukti-Drop-${dropItem.application_id || 'Jaminan'}-${dropItem.borrower_name || 'Debitur'}.png`;
    link.href = dropItem.proof_image;
    link.click();
  };

  // === KONFIRMASI MUTASI TRANSFER MASUK ===
  const handleConfirmTransferFromBorrower = async (report) => {
    setVerifyingReportId(report.id);
    try {
      const paidNominal = Number(report.amount) || 0;
      const instNumber = Number(report.installmentNumber) || 1;

      await recordVerifiedInstallmentPayment({
        applicationId: report.applicationId,
        amountReceived: paidNominal,
        installmentNumber: instNumber,
        note: `Diverifikasi via Notifikasi Transfer (${report.transferMethod || 'Transfer'})`
      });

      if (onVerifiedInstallmentTransfer) {
        await onVerifiedInstallmentTransfer(report);
      }

      await loadQrApplicationsAndReports();
    } catch (err) {
      showToast(err.message || 'Gagal memverifikasi pembayaran masuk.', 'error');
    } finally {
      setVerifyingReportId(null);
    }
  };

  // === QR GENERATOR & HOTLINE SYNC HANDLERS ===
  const ensureQrLinkLoaded = async () => {
    if (qrLinkData?.token) return qrLinkData;
    const uid = auth?.currentUser?.uid || localStorage.getItem('wgen_last_uid');
    if (!uid) return null;

    const savedAcc = localStorage.getItem('wgen_default_payment_account') || '';
    const savedMethod = localStorage.getItem('wgen_default_payment_method') || 'transfer';

    const data = await getOrCreateLenderQrLink({
      lenderUid: uid,
      lenderName: auth?.currentUser?.displayName || localStorage.getItem('wgen_username') || '',
      defaultCurrency: managerCurrency || 'IDR',
      isMicro: false
    });

    const finalAcc = data?.payment_account_info || savedAcc;
    const mergedData = {
      ...data,
      payment_account_info: finalAcc,
      payment_method_key: data?.payment_method_key || savedMethod
    };
    setQrPaymentAccount(finalAcc);
    setQrPaymentMethod(mergedData.payment_method_key);
    setQrLinkData(mergedData);

    if (data?.hotline_phone || data?.hotline_label || data?.hotline_note) {
      setHotlineConfig((prev) => {
        const synced = {
          enabled: data.hotline_enabled !== undefined ? Number(data.hotline_enabled) === 1 : prev.enabled,
          label: data.hotline_label || prev.label,
          phone: data.hotline_phone || prev.phone,
          hours: data.hotline_hours || prev.hours,
          note: data.hotline_note || prev.note
        };
        localStorage.setItem('wgen_qr_hotline_config', JSON.stringify(synced));
        return synced;
      });
    }

    return mergedData;
  };

  const openQrModalDirect = async () => {
    setShowQrModal(true);
    setLoadingQr(true);
    try {
      await ensureQrLinkLoaded();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQr(false);
    }
  };

  const handleSaveHotlineSettings = async () => {
    setSavingHotline(true);
    try {
      const cleanConfig = {
        enabled: Boolean(hotlineConfig.enabled),
        label: String(hotlineConfig.label || 'Hotline Bantuan & Konfirmasi').trim(),
        phone: String(hotlineConfig.phone || '').trim(),
        hours: String(hotlineConfig.hours || '').trim(),
        note: String(hotlineConfig.note || '').trim()
      };

      setHotlineConfig(cleanConfig);
      localStorage.setItem('wgen_qr_hotline_config', JSON.stringify(cleanConfig));

      const activeQr = await ensureQrLinkLoaded();
      if (activeQr?.token && typeof updateLenderQrSettings === 'function') {
        await updateLenderQrSettings(activeQr.token, {
          hotlineEnabled: hotlineConfig.enabled ?? true,
          hotlineLabel: hotlineConfig.label || 'Hotline Bantuan & Konfirmasi',
          hotlinePhone: hotlineConfig.phone || '',
          hotlineHours: hotlineConfig.hours || '',
          hotlineNote: hotlineConfig.note || ''
        });
      }

      if (showToast) {
        showToast('Pengaturan Hotline berhasil disimpan & tampil otomatis di halaman pengajuan!', 'success');
      }
      setShowHotlineModal(false);
    } catch (err) {
      if (showToast) {
        showToast(err.message || 'Gagal menyimpan pengaturan Hotline.', 'error');
      }
    } finally {
      setSavingHotline(false);
    }
  };

  const handleSaveQrPaymentAccount = async (
    accValue = qrPaymentAccount,
    methodValue = qrPaymentMethod
  ) => {
    const cleanAcc = String(accValue || '').trim();
    localStorage.setItem('wgen_default_payment_account', cleanAcc);
    localStorage.setItem('wgen_default_payment_method', methodValue);

    setQrLinkData((prev) =>
      prev
        ? {
            ...prev,
            payment_account_info: cleanAcc,
            payment_method_key: methodValue
          }
        : prev
    );

    if (qrLinkData?.token && typeof updateLenderQrSettings === 'function') {
      try {
        await updateLenderQrSettings(qrLinkData.token, {
          paymentDestination: cleanAcc,
          paymentAccountInfo: cleanAcc,
          paymentMethodKey: methodValue
        });
      } catch (err) {
        console.warn('Gagal menyinkronkan rekening QR ke server:', err);
      }
    }
  };

  // === DOWNLOAD POSTER QR CODE + TEKS CUSTOM ===
  const handleDownloadQrPng = () => {
    const qrCanvas = document.getElementById('wgen-loan-qr-canvas');
    if (!qrCanvas) return;

    const posterWidth = 720;
    const posterHeight = 940;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = posterWidth;
    exportCanvas.height = posterHeight;
    const ctx = exportCanvas.getContext('2d');

    ctx.fillStyle = '#062016';
    ctx.fillRect(0, 0, posterWidth, posterHeight);

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 6;
    ctx.strokeRect(24, 24, posterWidth - 48, posterHeight - 48);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    const titleLines = wrapCanvasText(
      ctx,
      (qrPosterTitle || 'SCAN QR PENGAJUAN PINJAMAN').toUpperCase(),
      posterWidth - 100
    );
    let currentY = 95;
    for (const line of titleLines.slice(0, 2)) {
      ctx.fillText(line, posterWidth / 2, currentY);
      currentY += 40;
    }

    const qrBoxSize = 420;
    const qrBoxX = (posterWidth - qrBoxSize) / 2;
    const qrBoxY = currentY + 20;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 24);
    ctx.fill();

    const qrDrawSize = 370;
    const qrDrawX = (posterWidth - qrDrawSize) / 2;
    const qrDrawY = qrBoxY + (qrBoxSize - qrDrawSize) / 2;
    ctx.drawImage(qrCanvas, qrDrawX, qrDrawY, qrDrawSize, qrDrawSize);

    let textY = qrBoxY + qrBoxSize + 48;
    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(`KODE: ${qrLinkData?.token || '-'}`, posterWidth / 2, textY);

    textY += 42;
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '22px sans-serif';
    const subLines = wrapCanvasText(ctx, qrPosterSubtitle || '', posterWidth - 110);
    for (const line of subLines.slice(0, 3)) {
      ctx.fillText(line, posterWidth / 2, textY);
      textY += 32;
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px sans-serif';
    ctx.fillText('WGen Note • Sistem Pengajuan & Kontrak Digital', posterWidth / 2, posterHeight - 52);

    const link = document.createElement('a');
    link.download = `Poster-QR-Pinjaman-${qrLinkData?.token || 'WGen'}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  const wrapCanvasText = (ctx, text, maxWidth) => {
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  // === LEMPAR DATA KE FORM UTAMA DEBTMANAGER SAAT ACC ===
  const triggerApproveToParent = (app) => {
    setShowInboxModal(false);
    if (onApproveApplication) {
      const fingerprint = app.debtor_fingerprint || app.debtorFingerprint || '';
      const signature = app.debtor_signature || app.debtorSignature || '';
      const enrichedApp = {
        ...app,
        debtor_fingerprint: fingerprint,
        debtorFingerprint: fingerprint,
        debtor_signature: signature,
        debtorSignature: signature
      };
      onApproveApplication(enrichedApp, qrLinkData);
    }
  };

  // === TEMPLATE WA & MODAL AKSI ===
  const buildWaMessage = (templateKey, app, extra = {}) => {
    const rawTpl = waTemplates[templateKey] || '';
    const linkStatus = `${PUBLIC_WEB_ORIGIN}/apply?ticket=${app.id}`;
    const currCode = app.currency || managerCurrency || 'IDR';
    const basePrincipal = Number(app.requested_amount || 0);
    const activePrincipal =
      extra.offeredPrincipal !== undefined && extra.offeredPrincipal !== ''
        ? Number(extra.offeredPrincipal) || basePrincipal
        : Number(app.counter_principal_amount || basePrincipal);

    const activeTenor =
      extra.offeredTenor !== undefined && extra.offeredTenor !== ''
        ? Number(extra.offeredTenor) || Number(app.tenor_months || 1)
        : Number(app.approved_tenor_months || app.tenor_months || 1);

    const nominalStr = `${currCode} ${basePrincipal.toLocaleString('id-ID')}`;
    const pokokStr = `${currCode} ${activePrincipal.toLocaleString('id-ID')}`;

    return rawTpl
      .replace(/\{nama\}/g, app.borrower_name || '')
      .replace(/\{nominal\}/g, nominalStr)
      .replace(/\{pokok\}/g, pokokStr)
      .replace(/\{jasa\}/g, String(app.reward_percent ?? 20))
      .replace(/\{tenor\}/g, String(activeTenor))
      .replace(/\{jaminan\}/g, app.collateral_desc || 'Tanpa Jaminan')
      .replace(/\{alasan\}/g, extra.reasonText ?? app.rejection_reason ?? '-')
      .replace(/\{feedback_jaminan\}/g, extra.collateralNote ?? app.collateral_feedback ?? '-')
      .replace(/\{alamat_drop\}/g, extra.dropAddress ?? dropAddressDefault)
      .replace(/\{link_status\}/g, linkStatus);
  };

  const openActionModal = (type, app) => {
    const defaultPrincipal = String(
      app.borrower_counter_amount || app.counter_principal_amount || app.requested_amount || ''
    );
    const defaultTenor = String(app.approved_tenor_months || app.tenor_months || 1);

    const defaultReason =
      type === 'counter_offer'
        ? `Imbalan jasa (${app.reward_percent ?? 20}%) belum sesuai kesepakatan. Silakan ajukan penawaran imbalan jasa ulang.`
        : type === 'principal_offer'
        ? `Penyesuaian nominal pokok pinjaman menjadi ${app.currency || managerCurrency || 'IDR'} ${Number(defaultPrincipal || 0).toLocaleString('id-ID')}.`
        : type === 'tenor_approval'
        ? `Persetujuan tenor final ditetapkan menjadi ${defaultTenor} bulan (ketentuan tetap / non-lelang). Silakan konfirmasi setuju atau tolak.`
        : type === 'upgrade_collateral'
        ? 'Pengajuan tanpa jaminan belum dapat disetujui untuk nominal ini. Silakan upgrade ke Kontrak 3 dengan melampirkan jaminan.'
        : type === 'rejected'
        ? 'Persyaratan pengajuan belum memenuhi kriteria.'
        : '';

    const defaultCollateralNote =
      app.collateral_feedback ||
      'Mohon serahkan/antarkan unit jaminan beserta kelengkapannya untuk pengecekan fisik.';

    const initialMsg = buildWaMessage(type, app, {
      offeredPrincipal: defaultPrincipal,
      offeredTenor: defaultTenor,
      reasonText: defaultReason,
      collateralNote: defaultCollateralNote,
      dropAddress: dropAddressDefault
    });

    setActionModal({
      open: true,
      type,
      app,
      offeredPrincipal: defaultPrincipal,
      offeredTenor: defaultTenor,
      reasonText: defaultReason,
      collateralNote: defaultCollateralNote,
      dropAddress: dropAddressDefault,
      collateralReceived: false,
      waMessage: initialMsg
    });
  };

  const handleConfirmActionModal = async (sendToWa = false) => {
    const {
      type,
      app,
      offeredPrincipal,
      offeredTenor,
      reasonText,
      collateralNote,
      dropAddress,
      collateralReceived,
      waMessage
    } = actionModal;
    if (!app) return;

    try {
      if (type === 'principal_offer') {
        const limits = getAppContractLimits(app);
        const rawDigits = String(offeredPrincipal || '').replace(/\D/g, '');
        const cleanPrincipal = Number(clampContractAmount(rawDigits, limits)) || 0;

        if (cleanPrincipal < limits.minVal || cleanPrincipal > limits.maxVal) {
          showToast(
            `Nominal harus sesuai ${limits.contractLabel}: ${limits.cleanCurr} ${limits.minVal.toLocaleString('id-ID')} – ${limits.maxVal.toLocaleString('id-ID')}`,
            'error'
          );
          return;
        }

        const formattedNote = `[LELANG POKOK: ${limits.cleanCurr} ${cleanPrincipal.toLocaleString('id-ID')}] ${reasonText || ''}`.trim();

        await updateApplicationFeedback({
          applicationId: app.id,
          status: 'counter_offer',
          rejectionReason: formattedNote,
          counterPrincipalAmount: cleanPrincipal
        });

        setIncomingApps((prev) =>
          prev.map((item) =>
            item.id === app.id
              ? {
                  ...item,
                  status: 'counter_offer',
                  rejection_reason: formattedNote,
                  counter_principal_amount: cleanPrincipal,
                  borrower_counter_amount: null
                }
              : item
          )
        );
        setAgreedAppsNotif((prev) => prev.filter((item) => item.id !== app.id));
      } else if (type === 'counter_offer' || type === 'upgrade_collateral') {
        await updateApplicationFeedback({
          applicationId: app.id,
          status: 'counter_offer',
          rejectionReason: reasonText
        });
        setIncomingApps((prev) =>
          prev.map((item) =>
            item.id === app.id
              ? { ...item, status: 'counter_offer', rejection_reason: reasonText }
              : item
          )
        );
      } else if (type === 'tenor_approval') {
        const cleanTenor = Math.min(12, Math.max(1, parseInt(offeredTenor, 10) || 1));
        const formattedNote = `[PERSETUJUAN TENOR FINAL: ${cleanTenor} BLN] ${reasonText || ''}`.trim();

        await updateApplicationFeedback({
          applicationId: app.id,
          status: 'tenor_offer',
          rejectionReason: formattedNote,
          approvedTenorMonths: cleanTenor
        });

        setIncomingApps((prev) =>
          prev.map((item) =>
            item.id === app.id
              ? {
                  ...item,
                  status: 'tenor_offer',
                  rejection_reason: formattedNote,
                  approved_tenor_months: cleanTenor,
                  tenor_months: cleanTenor
                }
              : item
          )
        );
      } else if (type === 'rejected') {
        await updateApplicationFeedback({
          applicationId: app.id,
          status: 'rejected',
          rejectionReason: reasonText
        });
        setIncomingApps((prev) => prev.filter((item) => item.id !== app.id));
        setAgreedAppsNotif((prev) => prev.filter((item) => item.id !== app.id));
      } else if (type === 'collateral_drop') {
        const finalCollateralFeedback = collateralReceived
          ? `[✓ BARANG JAMINAN DITERIMA] ${collateralNote}`
          : `[INSTRUKSI SERAH TERIMA / DROP JAMINAN] ${collateralNote}\nAlamat Drop-Off: ${dropAddress}`;

        await updateApplicationFeedback({
          applicationId: app.id,
          status: app.status,
          rejectionReason: app.rejection_reason || null,
          collateralFeedback: finalCollateralFeedback
        });

        localStorage.setItem('wgen_collateral_drop_address', dropAddress);
        setDropAddressDefault(dropAddress);

        setIncomingApps((prev) =>
          prev.map((item) =>
            item.id === app.id
              ? { ...item, collateral_feedback: finalCollateralFeedback }
              : item
          )
        );

        if (collateralReceived) {
          const uid = auth?.currentUser?.uid || localStorage.getItem('wgen_last_uid') || '';
          const nowIso = new Date().toISOString();
          const newVerifiedRecord = {
            id: `DROP-${app.id}`,
            application_id: app.id,
            lender_uid: uid,
            borrower_name: app.borrower_name || 'Debitur',
            borrower_phone: app.borrower_phone || '',
            collateral_desc: app.collateral_desc || 'Unit Jaminan Kontrak 3',
            drop_note: collateralNote || 'Barang jaminan diterima & diverifikasi fisik oleh kreditur.',
            proof_image: app.drop_proof_image || app.photo_collateral_1 || '',
            status: 'verified',
            verified_at: nowIso,
            created_at: app.updated_at || app.created_at || nowIso
          };

          // Pastikan jika pernah dihapus sebelumnya, dikeluarkan dari daftar blokir
          const cleanedDeleted = deletedDropIds.filter(
            (x) => x !== app.id && x !== `DROP-${app.id}`
          );
          setDeletedDropIds(cleanedDeleted);
          persistDeletedDropIds(cleanedDeleted);

          if (typeof verifyCollateralDropProof === 'function') {
            verifyCollateralDropProof(
              newVerifiedRecord.id,
              app.id,
              newVerifiedRecord.drop_note
            ).catch(() => {});
          }

          setDropProofList((prev) => {
            const filtered = prev.filter((d) => d.application_id !== app.id);
            const updated = [newVerifiedRecord, ...filtered];
            persistDropProofCache(updated);
            return updated;
          });

          if (showToast) {
            showToast('Jaminan ditandai diterima & tersimpan di menu Bukti Drop Jaminan!', 'success');
          }
        }
      }

      if (sendToWa && app.borrower_phone) {
        const phone = formatWaPhone(app.borrower_phone);
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`, '_blank');
      }

      setActionModal((prev) => ({ ...prev, open: false }));
    } catch (err) {
      alert('Gagal menyimpan pembaruan status: ' + err.message);
    }
  };

  const handleSaveCurrentAsTemplate = () => {
    const { type, waMessage } = actionModal;
    const updated = { ...waTemplates, [type]: waMessage };
    setWaTemplates(updated);
    localStorage.setItem('wgen_wa_loan_templates', JSON.stringify(updated));
    showToast('Template pesan WhatsApp berhasil disimpan sebagai default!', 'success');
  };

  const pendingDropCount = dropProofList.filter((d) => d.status !== 'verified').length;

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="contents">
      {/* 4 TOMBOL HEADER: QR PENGAJUAN, PENGAJUAN MASUK, BUKTI DROP JAMINAN, & HOTLINE */}
      <button
        type="button"
        onClick={() => handleFeatureAccessRequest('open_qr')}
        className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
          qrFeatureEnabled
            ? isDarkMode
              ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-300'
              : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800 shadow-xs'
            : isDarkMode
            ? 'bg-slate-800/90 hover:bg-slate-800 border-slate-700 text-slate-300'
            : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
        }`}
      >
        <QrCode className="w-4 h-4" />
        <span>{t.btnQr}</span>
        {!qrFeatureEnabled && (
          <span
            className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
              isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-300 text-slate-800'
            }`}
          >
            {t.offBadge}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => handleFeatureAccessRequest('open_inbox')}
        className={`relative px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
          qrFeatureEnabled
            ? isDarkMode
              ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300'
              : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800 shadow-xs'
            : isDarkMode
            ? 'bg-slate-800/90 hover:bg-slate-800 border-slate-700 text-slate-300'
            : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
        }`}
      >
        <Inbox className="w-4 h-4" />
        <span>{t.btnInbox}</span>
        {qrFeatureEnabled && incomingApps.length > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-500 text-slate-950">
            {incomingApps.length}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => handleFeatureAccessRequest('open_drop_proofs')}
        className={`relative px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
          qrFeatureEnabled
            ? isDarkMode
              ? 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/40 text-sky-300'
              : 'bg-sky-50 hover:bg-sky-100 border-sky-300 text-sky-800 shadow-xs'
            : isDarkMode
            ? 'bg-slate-800/90 hover:bg-slate-800 border-slate-700 text-slate-300'
            : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
        }`}
      >
        <PackageCheck className="w-4 h-4" />
        <span>{t.btnDropProof}</span>
        {qrFeatureEnabled && (pendingDropCount > 0 || dropProofList.length > 0) && (
          <span
            className={`px-1.5 py-0.5 text-[10px] font-extrabold rounded-full ${
              pendingDropCount > 0
                ? 'bg-sky-500 text-white'
                : isDarkMode
                ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/40'
                : 'bg-emerald-600 text-white'
            }`}
          >
            {pendingDropCount > 0 ? pendingDropCount : dropProofList.length}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => handleFeatureAccessRequest('open_hotline')}
        className={`relative px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
          qrFeatureEnabled
            ? isDarkMode
              ? 'bg-teal-500/15 hover:bg-teal-500/25 border-teal-500/40 text-teal-300'
              : 'bg-teal-50 hover:bg-teal-100 border-teal-300 text-teal-800 shadow-xs'
            : isDarkMode
            ? 'bg-slate-800/90 hover:bg-slate-800 border-slate-700 text-slate-300'
            : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
        }`}
      >
        <Headphones className="w-4 h-4" />
        <span>{t.btnHotline}</span>
        {qrFeatureEnabled && hotlineConfig.enabled && hotlineConfig.phone && (
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
        )}
      </button>

      {/* MODAL PEMBERITAHUAN KHUSUS PENGGUNA INDONESIA */}
      {showIdNoticeModal && (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-[1050] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className={`border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl ${effectiveModalBg}`}>
            <div className={`flex items-start justify-between gap-3 border-b pb-3 ${borderDivider}`}>
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                    isDarkMode
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  }`}
                >
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${textPrimary}`}>{t.idNoticeTitle}</h3>
                  <p className={`text-[11px] font-medium ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    {t.idNoticeSub}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowIdNoticeModal(false);
                  setPendingActionAfterConsent(null);
                }}
                className={closeBtnClass}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={`space-y-2.5 text-xs leading-relaxed ${textSecondary}`}>
              <p>{t.idNoticeBody1}</p>
              <div
                className={`p-3 rounded-xl border text-[11px] ${
                  isDarkMode
                    ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-200'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                {t.idNoticeBody2}
              </div>
            </div>

            <div className={`flex items-center justify-end gap-2 pt-2 border-t ${borderDivider}`}>
              <button
                type="button"
                onClick={() => {
                  setShowIdNoticeModal(false);
                  setPendingActionAfterConsent(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold ${secondaryBtnClass}`}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmEnableIdFeature}
                className={`px-4 py-2 rounded-xl bg-gradient-to-r ${themeStyle.gradientBtn} text-white text-xs font-bold shadow`}
              >
                {t.understandEnable}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BANNER FLOATING NOTIFIKASI DEBITUR SETUJU / MINTA TAMBAH POKOK & TRANSFER MASUK */}
      {qrFeatureEnabled && (agreedAppsNotif.length > 0 || pendingInstallmentReports.length > 0) && (
        <div dir={isRtl ? 'rtl' : 'ltr'} className="w-full space-y-2.5 mt-3">
          {agreedAppsNotif.map((appItem) => {
            const isAgreed = isRowBorrowerAgreed(appItem);
            const isRequestMore = !isAgreed;
            const nominalDitampilkan = Number(
              appItem.borrower_counter_amount ||
                appItem.requested_amount ||
                appItem.counter_principal_amount ||
                0
            );
            const tawaranSebelumnya = Number(appItem.counter_principal_amount || 0);

            return (
              <div
                key={appItem.id}
                className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 shadow-lg ${
                  isRequestMore
                    ? isDarkMode
                      ? 'bg-amber-950/95 border-amber-400/80'
                      : 'bg-amber-50 border-amber-400'
                    : isDarkMode
                    ? 'bg-emerald-950/95 border-emerald-400/80'
                    : 'bg-emerald-50 border-emerald-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-sm animate-bounce shrink-0 ${
                      isRequestMore
                        ? isDarkMode
                          ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                          : 'bg-amber-200 border-amber-500 text-amber-900'
                        : isDarkMode
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                        : 'bg-emerald-200 border-emerald-500 text-emerald-900'
                    }`}
                  >
                    {isRequestMore ? '↑' : '✓'}
                  </span>
                  <div>
                    <div className={`text-xs sm:text-sm font-bold ${textPrimary}`}>
                      {isRequestMore
                        ? 'Debitur Minta Tambah Pokok!'
                        : 'Debitur Menyetujui Penawaran!'}
                    </div>
                    <div
                      className={`text-[11px] ${
                        isRequestMore
                          ? isDarkMode
                            ? 'text-amber-200'
                            : 'text-amber-900'
                          : isDarkMode
                          ? 'text-emerald-200'
                          : 'text-emerald-900'
                      }`}
                    >
                      {isRequestMore ? (
                        <>
                          <strong>{appItem.borrower_name}</strong> mengajukan perubahan/tambah nominal menjadi{' '}
                          <strong>
                            {appItem.currency} {nominalDitampilkan.toLocaleString('id-ID')}
                          </strong>{' '}
                          {tawaranSebelumnya > 0 && tawaranSebelumnya !== nominalDitampilkan && (
                            <span className="opacity-80">
                              (dari tawaran {appItem.currency} {tawaranSebelumnya.toLocaleString('id-ID')})
                            </span>
                          )}{' '}
                          (Jasa {appItem.reward_percent ?? 20}%).
                          {appItem.borrower_reply_note && (
                            <span className="block italic opacity-90 mt-0.5">
                              Catatan: "{appItem.borrower_reply_note}"
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <strong>{appItem.borrower_name}</strong> klik Setuju/Oke untuk nominal{' '}
                          <strong>
                            {appItem.currency} {nominalDitampilkan.toLocaleString('id-ID')}
                          </strong>{' '}
                          (Jasa {appItem.reward_percent ?? 20}%). Siap ACC & cairkan!
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isRequestMore && (
                    <button
                      type="button"
                      onClick={() => openActionModal('principal_offer', appItem)}
                      className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors shadow"
                    >
                      Tawar Balik Pokok
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => triggerApproveToParent(appItem)}
                    className={`px-3.5 py-2 rounded-lg text-slate-950 text-xs font-extrabold transition-colors shadow ${
                      isRequestMore
                        ? 'bg-amber-400 hover:bg-amber-300'
                        : 'bg-emerald-500 hover:bg-emerald-400'
                    }`}
                  >
                    {isRequestMore ? 'Setujui Tambahan & ACC' : 'Review & ACC Sekarang'}
                  </button>
                </div>
              </div>
            );
          })}

          {pendingInstallmentReports.length > 0 && (
            <div
              className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 shadow-lg ${
                isDarkMode
                  ? 'bg-sky-950/90 border-sky-500/80'
                  : 'bg-sky-50 border-sky-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-sm animate-pulse ${
                    isDarkMode
                      ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                      : 'bg-sky-200 border-sky-500 text-sky-900'
                  }`}
                >
                  {pendingInstallmentReports.length}
                </span>
                <div>
                  <div className={`text-xs sm:text-sm font-bold ${textPrimary}`}>
                    Konfirmasi Transfer Cicilan Masuk ({pendingInstallmentReports.length})
                  </div>
                  <div className={`text-[11px] ${isDarkMode ? 'text-sky-200/85' : 'text-sky-900'}`}>
                    {pendingInstallmentReports[0].borrowerName} melapor transfer angsuran ke-
                    {pendingInstallmentReports[0].installmentNumber} (
                    {pendingInstallmentReports[0].currency}{' '}
                    {Number(pendingInstallmentReports[0].amount || 0).toLocaleString('id-ID')})
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowTransferNotifModal(true)}
                className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors"
              >
                Cek Mutasi & Verifikasi
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL: PENGATURAN HOTLINE (TOMBOL KE-4 — OTOMATIS TAMPIL DI LoanApplyPage.jsx) */}
      {showHotlineModal && (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className={`border rounded-2xl max-w-md w-full max-h-[88vh] overflow-y-auto p-5 space-y-4 shadow-2xl ${effectiveModalBg}`}>
            <div className={`flex items-center justify-between border-b pb-3 ${borderDivider}`}>
              <div className="flex items-center gap-2">
                <Headphones className={`w-5 h-5 ${isDarkMode ? 'text-teal-400' : 'text-teal-600'}`} />
                <div>
                  <h3 className={`text-base font-bold ${textPrimary}`}>{t.hotlineModalTitle}</h3>
                  <p className={`text-[10px] ${isDarkMode ? 'text-teal-300/85' : 'text-teal-700'}`}>
                    {t.hotlineModalSub}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHotlineModal(false)}
                className={closeBtnClass}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${
                  isDarkMode
                    ? 'bg-teal-950/40 border-teal-700/50'
                    : 'bg-teal-50 border-teal-200'
                }`}
              >
                <div>
                  <span className={`font-bold block ${isDarkMode ? 'text-teal-200' : 'text-teal-900'}`}>
                    {t.hotlineToggleTitle}
                  </span>
                  <span className={`text-[10px] ${textMuted}`}>{t.hotlineToggleSub}</span>
                </div>
                <input
                  type="checkbox"
                  checked={hotlineConfig.enabled}
                  onChange={(e) =>
                    setHotlineConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>

              <div>
                <label className={`block mb-1 font-semibold ${textSecondary}`}>{t.hotlineLabelField}</label>
                <input
                  type="text"
                  value={hotlineConfig.label}
                  onChange={(e) =>
                    setHotlineConfig((prev) => ({ ...prev, label: e.target.value }))
                  }
                  placeholder="Contoh: Hotline Bantuan & Konfirmasi"
                  className={`w-full px-3 py-2 rounded-lg border ${effectiveInputBg}`}
                />
              </div>

              <div>
                <label className={`block mb-1 font-semibold ${textSecondary}`}>{t.hotlinePhoneField}</label>
                <div className="relative">
                  <PhoneCall className="w-4 h-4 text-emerald-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={hotlineConfig.phone}
                    onChange={(e) =>
                      setHotlineConfig((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="Contoh: 081234567890 atau 6281234567890"
                    className={`w-full pl-9 pr-3 py-2 rounded-lg border ${effectiveInputBg}`}
                  />
                </div>
              </div>

              <div>
                <label className={`block mb-1 font-semibold ${textSecondary}`}>{t.hotlineHoursField}</label>
                <input
                  type="text"
                  value={hotlineConfig.hours}
                  onChange={(e) =>
                    setHotlineConfig((prev) => ({ ...prev, hours: e.target.value }))
                  }
                  placeholder="Contoh: Senin – Minggu, 08.00 – 21.00 WIB"
                  className={`w-full px-3 py-2 rounded-lg border ${effectiveInputBg}`}
                />
              </div>

              <div>
                <label className={`block mb-1 font-semibold ${textSecondary}`}>{t.hotlineNoteField}</label>
                <textarea
                  rows={3}
                  value={hotlineConfig.note}
                  onChange={(e) =>
                    setHotlineConfig((prev) => ({ ...prev, note: e.target.value }))
                  }
                  placeholder="Tulis instruksi bantuan atau info kontak untuk calon debitur..."
                  className={`w-full px-3 py-2 rounded-lg border ${effectiveInputBg}`}
                />
              </div>

              {/* Preview tampilan kartu Hotline di LoanApplyPage */}
              <div
                className={`p-3 rounded-xl border space-y-1 ${
                  isDarkMode ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-100 border-slate-300'
                }`}
              >
                <div className={`text-[10px] uppercase tracking-wider font-bold ${textMuted}`}>
                  {t.hotlinePreviewLabel}
                </div>
                <div className={`text-xs font-bold ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  {hotlineConfig.label || 'Hotline Bantuan'}
                </div>
                <div className={`text-[11px] font-mono ${textPrimary}`}>
                  {hotlineConfig.phone || '(Nomor belum diisi)'}{' '}
                  {hotlineConfig.hours ? `• ${hotlineConfig.hours}` : ''}
                </div>
                {hotlineConfig.note && (
                  <p className={`text-[11px] leading-snug ${textMuted}`}>{hotlineConfig.note}</p>
                )}
              </div>
            </div>

            <div className={`flex items-center justify-end gap-2 pt-2 border-t ${borderDivider}`}>
              <button
                type="button"
                onClick={() => setShowHotlineModal(false)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold ${secondaryBtnClass}`}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={savingHotline}
                onClick={handleSaveHotlineSettings}
                className={`px-4 py-2 rounded-xl bg-gradient-to-r ${themeStyle.gradientBtn} text-white text-xs font-bold shadow disabled:opacity-50`}
              >
                {savingHotline ? t.saving : t.saveApplyForm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BUKTI DROP JAMINAN MASUK & TERSIMPAN (2 TOMBOL DELETE + MINIMIZE) */}
      {showDropProofModal && (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className={`border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4 shadow-2xl ${effectiveModalBg}`}>
            <div className={`flex flex-wrap items-center justify-between gap-2 border-b pb-3 ${borderDivider}`}>
              <div>
                <h3 className={`text-base font-bold flex items-center gap-2 ${isDarkMode ? 'text-sky-400' : 'text-sky-700'}`}>
                  <PackageCheck className="w-5 h-5" /> {t.dropModalTitle} ({dropProofList.length})
                </h3>
                {lastRefreshedAt && (
                  <span className={`text-[10px] ${textMuted}`}>
                    {t.lastUpdated}: {lastRefreshedAt.toLocaleTimeString('id-ID')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* TOMBOL DELETE #1: HAPUS SEMUA BUKTI DROP JAMINAN */}
                {dropProofList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteAllDropProofs}
                    title={t.deleteAllDrops}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
                      isDarkMode
                        ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-300'
                        : 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-700'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.deleteAllDrops}</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={loadingDropProofs}
                  onClick={() => loadQrApplicationsAndReports('', true)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition ${
                    isDarkMode
                      ? 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/35 text-sky-300'
                      : 'bg-sky-50 hover:bg-sky-100 border-sky-300 text-sky-700'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDropProofs ? 'animate-spin' : ''}`} />
                  <span>{loadingDropProofs ? t.loading : t.refresh}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDropProofModal(false)}
                  className={`p-1 ${closeBtnClass}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingDropProofs && dropProofList.length === 0 ? (
              <div className={`py-10 text-center text-xs animate-pulse ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`}>
                {t.loadingDrops}
              </div>
            ) : dropProofList.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <div className={`text-xs ${textMuted}`}>{t.noDrops}</div>
                <button
                  type="button"
                  onClick={() => loadQrApplicationsAndReports('', true)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 ${secondaryBtnClass}`}
                >
                  <RefreshCw className="w-3 h-3" /> {t.checkAgain}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {dropProofList.map((drop) => {
                  const cardKey = drop.id || drop.application_id;
                  const isVerified = drop.status === 'verified';
                  const isMinimized = Boolean(minimizedDropCards[cardKey]);

                  return (
                    <div
                      key={cardKey}
                      className={`p-4 rounded-xl border space-y-2.5 text-xs transition-all ${effectiveInnerBox}`}
                    >
                      {/* BARIS ATAS KARTU: SELALU TAMPIL (BAIK MODE MINIMIZE MAUPUN EXPAND) */}
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className={`font-bold text-sm ${textPrimary}`}>
                            {drop.borrower_name || 'Debitur'}
                          </div>
                          <div className={`text-[11px] font-mono ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                            {t.appNo}: {drop.application_id}
                          </div>
                          {isMinimized && (
                            <div className={`text-[11px] pt-1 space-y-0.5 ${textSecondary}`}>
                              <div>
                                <span className={textMuted}>{t.receivedDate}: </span>
                                <span className="font-semibold">{formatDropReceivedDate(drop)}</span>
                              </div>
                              <div>
                                <span className={textMuted}>{t.collateralUnit}: </span>
                                <span className="font-semibold">{drop.collateral_desc || '-'}</span>
                              </div>
                            </div>
                          )}
                          {!isMinimized && drop.borrower_phone && (
                            <div className={`text-[11px] ${textMuted}`}>HP: {drop.borrower_phone}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isMinimized && (
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                isVerified
                                  ? isDarkMode
                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                    : 'bg-emerald-100 border-emerald-300 text-emerald-800'
                                  : isDarkMode
                                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                  : 'bg-amber-100 border-amber-300 text-amber-800'
                              }`}
                            >
                              {isVerified ? t.verifiedBadge : t.pendingBadge}
                            </span>
                          )}

                          {/* TOMBOL MINIMIZE / EXPAND PER KARTU */}
                          <button
                            type="button"
                            onClick={() => toggleMinimizeDropCard(cardKey)}
                            title={isMinimized ? t.expand : t.minimize}
                            className={`px-2 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition ${secondaryBtnClass}`}
                          >
                            {isMinimized ? (
                              <>
                                <ChevronDown className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{t.expand}</span>
                              </>
                            ) : (
                              <>
                                <ChevronUp className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">{t.minimize}</span>
                              </>
                            )}
                          </button>

                          {/* TOMBOL DELETE #2: HAPUS PER KARTU */}
                          <button
                            type="button"
                            onClick={() => handleDeleteSingleDropProof(drop)}
                            title={t.deleteCard}
                            className={`p-1.5 rounded-lg border transition ${
                              isDarkMode
                                ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-300'
                                : 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-700'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* KONTEN DETAIL (DISEMBUNYIKAN SAAT MINIMIZE) */}
                      {!isMinimized && (
                        <>
                          <div
                            className={`p-2.5 rounded-lg border space-y-1 ${
                              isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200'
                            }`}
                          >
                            <div>
                              <span className={textMuted}>{t.receivedDate}: </span>
                              <span className={`font-semibold ${textPrimary}`}>
                                {formatDropReceivedDate(drop)}
                              </span>
                            </div>
                            <div>
                              <span className={textMuted}>{t.collateralUnit}: </span>
                              <span className={`font-semibold ${textPrimary}`}>
                                {drop.collateral_desc || '-'}
                              </span>
                            </div>
                            {drop.drop_note && (
                              <div>
                                <span className={textMuted}>{t.dropNote}: </span>
                                <span className={`font-medium ${isDarkMode ? 'text-sky-300' : 'text-sky-700'}`}>
                                  {drop.drop_note}
                                </span>
                              </div>
                            )}
                          </div>

                          {drop.proof_image && (
                            <div className="space-y-1">
                              <span className={`text-[11px] block ${textMuted}`}>
                                {t.dropPhotoLabel}
                              </span>
                              <img
                                src={drop.proof_image}
                                alt="Bukti Drop Jaminan"
                                className={`w-full max-h-60 object-contain rounded-lg border ${
                                  isDarkMode ? 'border-slate-700 bg-black' : 'border-slate-300 bg-slate-100'
                                }`}
                              />
                            </div>
                          )}

                          <div className={`flex flex-wrap items-center justify-end gap-2 pt-2 border-t ${borderDivider}`}>
                            {drop.proof_image && (
                              <button
                                type="button"
                                onClick={() => handleDownloadDropProofImage(drop)}
                                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 ${secondaryBtnClass}`}
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>{t.downloadProof}</span>
                              </button>
                            )}

                            {!isVerified && (
                              <button
                                type="button"
                                disabled={verifyingDropId === drop.id}
                                onClick={() => handleVerifyAndSaveDropProof(drop)}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold flex items-center gap-1.5"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>
                                  {verifyingDropId === drop.id ? t.saving : t.confirmSaveProof}
                                </span>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: DAFTAR TRANSFER MASUK */}
      {showTransferNotifModal && (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            className={`max-w-lg w-full max-h-[85vh] overflow-y-auto border rounded-2xl p-5 space-y-4 shadow-2xl ${
              isDarkMode
                ? 'bg-[#0c2119] border-sky-600/80 text-emerald-50'
                : 'bg-white border-sky-400 text-slate-900'
            }`}
          >
            <div className={`flex items-center justify-between border-b pb-3 ${borderDivider}`}>
              <div>
                <h3 className={`text-base font-bold ${textPrimary}`}>
                  {t.transferModalTitle} ({pendingInstallmentReports.length})
                </h3>
                <p className={`text-[11px] ${isDarkMode ? 'text-emerald-200/75' : 'text-slate-600'}`}>
                  {t.transferModalSub}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferNotifModal(false)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${secondaryBtnClass}`}
              >
                ✕
              </button>
            </div>

            {pendingInstallmentReports.length === 0 ? (
              <div className={`py-8 text-center text-xs ${isDarkMode ? 'text-emerald-300/80' : 'text-emerald-700'}`}>
                {t.allTransfersVerified}
              </div>
            ) : (
              <div className="space-y-3">
                {pendingInstallmentReports.map((rep) => (
                  <div
                    key={rep.id}
                    className={`p-3.5 rounded-xl border space-y-2.5 text-xs ${
                      isDarkMode
                        ? 'bg-[#071510] border-emerald-800/80'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className={`font-bold text-sm ${textPrimary}`}>{rep.borrowerName}</div>
                        <div className={`text-[11px] font-mono ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                          Tiket: {rep.applicationId}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full border font-semibold text-[11px] ${
                          isDarkMode
                            ? 'bg-sky-950 border-sky-600 text-sky-300'
                            : 'bg-sky-100 border-sky-300 text-sky-800'
                        }`}
                      >
                        {t.installmentTo}
                        {rep.installmentNumber}
                      </span>
                    </div>

                    <div
                      className={`grid grid-cols-2 gap-2 p-2.5 rounded-lg border ${
                        isDarkMode
                          ? 'bg-[#0c2119] border-emerald-800/60'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div>
                        <span className={`text-[11px] block ${isDarkMode ? 'text-emerald-400/80' : 'text-slate-500'}`}>
                          {t.transferAmount}
                        </span>
                        <span className={`font-bold text-sm ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
                          {rep.currency} {Number(rep.amount || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div>
                        <span className={`text-[11px] block ${isDarkMode ? 'text-emerald-400/80' : 'text-slate-500'}`}>
                          {t.viaAccount}
                        </span>
                        <span className={`font-semibold ${textPrimary}`}>{rep.transferMethod || '-'}</span>
                      </div>
                    </div>

                    {rep.proofImage && (
                      <div className="space-y-1">
                        <div className={`text-[11px] ${isDarkMode ? 'text-emerald-300' : 'text-slate-700'}`}>
                          {t.receiptPhotoLabel}
                        </div>
                        <img
                          src={rep.proofImage}
                          alt="Bukti Transfer"
                          className={`w-full max-h-56 object-contain rounded-lg border ${
                            isDarkMode ? 'border-emerald-800 bg-black' : 'border-slate-300 bg-slate-100'
                          }`}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        disabled={verifyingReportId === rep.id}
                        onClick={() => handleConfirmTransferFromBorrower(rep)}
                        className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition-colors"
                      >
                        {verifyingReportId === rep.id ? t.verifying : t.confirmMutationBtn}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: QR CODE GENERATOR + POSTER CUSTOM TEKS (FULL LIGHT & DARK MODE) */}
      {showQrModal && (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className={`border rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl ${effectiveModalBg}`}>
            <div className={`flex items-center justify-between border-b pb-3 ${borderDivider}`}>
              <div>
                <h3
                  className={`text-base font-bold flex items-center gap-2 ${
                    isDarkMode ? themeStyle.textAccent : 'text-emerald-700'
                  }`}
                >
                  <QrCode className="w-5 h-5" /> {t.qrModalTitle}
                </h3>
                <span className={`text-[10px] font-medium ${isDarkMode ? 'text-emerald-400/85' : 'text-emerald-700'}`}>
                  {t.qrModalSub}
                </span>
              </div>
              <button type="button" onClick={() => setShowQrModal(false)} className={closeBtnClass}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingQr || !qrLinkData ? (
              <div className={`py-10 text-center text-xs ${textMuted}`}>{t.preparingQr}</div>
            ) : (
              <>
                <div className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border ${effectiveInnerBox}`}>
                  <div
                    className={`text-xs font-extrabold text-center tracking-wide ${
                      isDarkMode ? 'text-emerald-300' : 'text-emerald-800'
                    }`}
                  >
                    {qrPosterTitle || 'SCAN QR PENGAJUAN PINJAMAN'}
                  </div>
                  <div
                    className={`bg-white p-3 rounded-xl ${
                      isDarkMode ? 'shadow' : 'border border-slate-200 shadow-sm'
                    }`}
                  >
                    <QRCodeCanvas
                      id="wgen-loan-qr-canvas"
                      value={`${PUBLIC_WEB_ORIGIN}/apply?token=${qrLinkData.token}`}
                      size={180}
                      fgColor="#064e3b"
                      bgColor="#ffffff"
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <span
                    className={`text-xs font-mono font-bold ${
                      isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                    }`}
                  >
                    {qrLinkData.token}
                  </span>
                  {qrPosterSubtitle && (
                    <p className={`text-[11px] text-center max-w-xs leading-snug ${textSecondary}`}>
                      {qrPosterSubtitle}
                    </p>
                  )}
                  <input
                    type="text"
                    readOnly
                    value={`${PUBLIC_WEB_ORIGIN}/apply?token=${qrLinkData.token}`}
                    onClick={(e) => e.target.select()}
                    className={`w-full px-3 py-1.5 rounded-lg text-[11px] text-center border ${effectiveInputBg}`}
                  />
                </div>

                {/* EDIT KATA-KATA PADA GAMBAR QR SAAT DI-DOWNLOAD */}
                <div
                  className={`w-full text-left space-y-2 p-3 rounded-xl border ${
                    isDarkMode
                      ? 'bg-slate-900/60 border-slate-700/60'
                      : 'bg-slate-100 border-slate-300'
                  }`}
                >
                  <div className={`text-[11px] font-bold ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>
                    {t.posterSectionTitle}
                  </div>
                  <div>
                    <label className={`text-[10px] block mb-1 font-medium ${textSecondary}`}>
                      {t.posterTopLabel}
                    </label>
                    <input
                      type="text"
                      value={qrPosterTitle}
                      onChange={(e) => {
                        setQrPosterTitle(e.target.value);
                        localStorage.setItem('wgen_qr_poster_title', e.target.value);
                      }}
                      placeholder="Contoh: SCAN QR PENGAJUAN PINJAMAN"
                      className={`w-full px-3 py-1.5 rounded-lg text-xs border ${effectiveInputBg}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[10px] block mb-1 font-medium ${textSecondary}`}>
                      {t.posterBottomLabel}
                    </label>
                    <input
                      type="text"
                      value={qrPosterSubtitle}
                      onChange={(e) => {
                        setQrPosterSubtitle(e.target.value);
                        localStorage.setItem('wgen_qr_poster_subtitle', e.target.value);
                      }}
                      placeholder="Contoh: Hubungi WA 0812xxx jika butuh bantuan..."
                      className={`w-full px-3 py-1.5 rounded-lg text-xs border ${effectiveInputBg}`}
                    />
                  </div>
                </div>

                <div className="w-full text-left space-y-1.5 pt-1">
                  <label className={`text-[11px] font-semibold block ${textSecondary}`}>
                    {t.paymentAccLabel}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Contoh: BCA 1234567890 a.n Budi / Dana 0812xxx..."
                      value={qrPaymentAccount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQrPaymentAccount(val);
                        localStorage.setItem('wgen_default_payment_account', val);
                      }}
                      onBlur={(e) => handleSaveQrPaymentAccount(e.target.value, qrPaymentMethod)}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs border ${effectiveInputBg}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        handleSaveQrPaymentAccount(qrPaymentAccount, qrPaymentMethod);
                        showToast('Nomor rekening QR berhasil disimpan!', 'success');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0"
                    >
                      {t.save}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${PUBLIC_WEB_ORIGIN}/apply?token=${qrLinkData.token}`);
                      setCopiedQrLink(true);
                      setTimeout(() => setCopiedQrLink(false), 2000);
                    }}
                    className={`py-2.5 rounded-xl font-semibold flex items-center justify-center gap-1.5 ${secondaryBtnClass}`}
                  >
                    {copiedQrLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedQrLink ? t.copied : t.copyLink}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadQrPng}
                    className={`py-2.5 rounded-xl bg-gradient-to-r ${themeStyle.gradientBtn} text-white font-bold flex items-center justify-center gap-1.5`}
                  >
                    <Download className="w-4 h-4" />
                    <span>{t.downloadQrText}</span>
                  </button>
                </div>

                <div className={`flex items-center justify-between pt-2 border-t text-xs ${borderDivider}`}>
                  <button
                    type="button"
                    onClick={async () => {
                      const nextActive = Number(qrLinkData.is_active) !== 1;
                      await updateLenderQrSettings(qrLinkData.token, { isActive: nextActive });
                      setQrLinkData({ ...qrLinkData, is_active: nextActive ? 1 : 0 });
                    }}
                    className={`underline font-semibold ${
                      isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                    }`}
                  >
                    {Number(qrLinkData.is_active) === 1 ? t.disableQrLink : t.enableQrLink}
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const uid = auth?.currentUser?.uid || localStorage.getItem('wgen_last_uid');
                      const fresh = await regenerateLenderQrLink({
                        lenderUid: uid,
                        lenderName: qrLinkData.lender_name,
                        defaultCurrency: qrLinkData.default_currency,
                        isMicro: Number(qrLinkData.is_micro) === 1
                      });
                      setQrLinkData(fresh);
                    }}
                    className={`underline font-semibold ${
                      isDarkMode ? 'text-amber-400' : 'text-amber-700'
                    }`}
                  >
                    {t.newToken}
                  </button>
                </div>

                {/* SAKLAR MATIKAN / AKTIFKAN SEMUA FITUR QR, INBOX, BUKTI DROP & HOTLINE */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                    isDarkMode
                      ? 'bg-slate-900/70 border-slate-700/70'
                      : 'bg-slate-100 border-slate-300'
                  }`}
                >
                  <div>
                    <div className={`font-semibold flex items-center gap-1.5 ${textPrimary}`}>
                      <Power className="w-3.5 h-3.5 text-rose-500" />
                      <span>{t.featureStatusTitle}</span>
                    </div>
                    <p className={`text-[10px] ${textMuted}`}>{t.featureStatusSub}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleQrFeature(false)}
                    className={`px-3 py-1.5 rounded-lg border font-bold text-[11px] shrink-0 ${
                      isDarkMode
                        ? 'bg-rose-600/20 hover:bg-rose-600/30 border-rose-500/40 text-rose-300'
                        : 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-700'
                    }`}
                  >
                    {t.turnOffFeature}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL: DAFTAR PENGAJUAN PINJAMAN MASUK */}
      {showInboxModal && (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-[999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className={`border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4 shadow-2xl ${effectiveModalBg}`}>
            <div className={`flex items-center justify-between gap-2 border-b pb-3 ${borderDivider}`}>
              <div>
                <h3
                  className={`text-base font-bold flex items-center gap-2 ${
                    isDarkMode ? themeStyle.textAccent : 'text-emerald-700'
                  }`}
                >
                  <Inbox className="w-5 h-5" /> {t.inboxTitle} ({incomingApps.length})
                </h3>
                {lastRefreshedAt && (
                  <span className={`text-[10px] ${textMuted}`}>
                    {t.lastUpdated}: {lastRefreshedAt.toLocaleTimeString('id-ID')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loadingInbox}
                  onClick={() => loadQrApplicationsAndReports('', true)}
                  title="Muat ulang pengajuan masuk"
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition ${
                    isDarkMode
                      ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/35 text-emerald-300'
                      : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingInbox ? 'animate-spin' : ''}`} />
                  <span>{loadingInbox ? t.loading : t.refresh}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowInboxModal(false)}
                  className={`p-1 ${closeBtnClass}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingInbox && incomingApps.length === 0 ? (
              <div className={`py-10 text-center text-xs animate-pulse ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                {t.loadingApps}
              </div>
            ) : incomingApps.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <div className={`text-xs ${textMuted}`}>{t.noPendingApps}</div>
                <button
                  type="button"
                  onClick={() => loadQrApplicationsAndReports('', true)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 ${secondaryBtnClass}`}
                >
                  <RefreshCw className="w-3 h-3" /> {t.checkAgain}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {incomingApps.map((app) => {
                  const hasCounterPrincipal =
                    app.counter_principal_amount !== undefined &&
                    app.counter_principal_amount !== null &&
                    Number(app.counter_principal_amount) > 0;

                  const isBorrowerAgreed = isRowBorrowerAgreed(app);
                  const isBorrowerRequestMore = isRowBorrowerCounter(app);

                  const debtorFp = app.debtor_fingerprint || app.debtorFingerprint || '';
                  const debtorSig = app.debtor_signature || app.debtorSignature || '';

                  return (
                    <div key={app.id} className={`p-4 rounded-xl border space-y-2.5 text-xs ${effectiveInnerBox}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`font-bold text-sm ${textPrimary}`}>
                            {app.borrower_name && String(app.borrower_name).trim().toLowerCase() !== ''
                              ? app.borrower_name
                              : 'Peminjam (Tanpa Nama)'}
                          </span>
                          {app.status === 'counter_offer' && (
                            <span
                              className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                                isDarkMode
                                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                  : 'bg-amber-100 border-amber-300 text-amber-800'
                              }`}
                            >
                              Lelang Jasa • Tawaran Terkini: {app.reward_percent || 0}%
                            </span>
                          )}
                          {hasCounterPrincipal && (
                            <span
                              className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                                isDarkMode
                                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                                  : 'bg-indigo-100 border-indigo-300 text-indigo-800'
                              }`}
                            >
                              Lelang Pokok: {app.currency} {Number(app.counter_principal_amount).toLocaleString('id-ID')}
                            </span>
                          )}
                        </div>
                        <span
                          className={`font-mono font-bold text-sm ${
                            isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                          }`}
                        >
                          {app.currency} {Number(app.requested_amount || 0).toLocaleString('id-ID')}
                        </span>
                      </div>

                      {app.status === 'tenor_offer' && (
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[10px] font-semibold ${
                            isDarkMode
                              ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
                              : 'bg-teal-100 border-teal-300 text-teal-800'
                          }`}
                        >
                          Persetujuan Tenor Final: {app.approved_tenor_months || app.tenor_months} Bln (Menunggu Konfirmasi)
                        </span>
                      )}

                      {isBorrowerAgreed && (
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${
                            isDarkMode
                              ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-300'
                              : 'bg-emerald-100 border-emerald-400 text-emerald-800'
                          }`}
                        >
                          ✓ Debitur Setuju / Oke
                        </span>
                      )}

                      {isBorrowerRequestMore && (
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${
                            isDarkMode
                              ? 'bg-amber-500/25 border-amber-400/60 text-amber-300'
                              : 'bg-amber-100 border-amber-400 text-amber-800'
                          }`}
                        >
                          ↑ Minta Tambah Pokok
                        </span>
                      )}

                      <div className={`space-y-1 ${textMuted}`}>
                        <div>
                          HP: <span className={`font-medium ${textPrimary}`}>{app.borrower_phone}</span> • Tenor:{' '}
                          <span className={`font-medium ${textPrimary}`}>{app.tenor_months} bln</span> (
                          {Number(app.is_installment) === 1 ? 'Cicilan' : 'Sekali Bayar'}) • Imbalan Jasa:{' '}
                          <span className={`font-semibold ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
                            {app.reward_percent || 20}%
                          </span>
                        </div>
                        <div>
                          Jaminan:{' '}
                          <span className={`font-medium ${textPrimary}`}>
                            {Number(app.has_collateral) === 1 ? app.collateral_desc || 'Ada' : 'Tanpa Jaminan'}
                          </span>
                        </div>
                        {app.collateral_feedback && (
                          <div
                            className={`p-2 rounded border text-[11px] ${
                              isDarkMode
                                ? 'bg-emerald-950/50 border-emerald-700/50 text-emerald-200'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            }`}
                          >
                            <strong>Status Jaminan:</strong> {app.collateral_feedback}
                          </div>
                        )}
                        {app.notes && <div className={textSecondary}>Catatan: {app.notes}</div>}
                      </div>

                      {/* Preview Lampiran Sidik Jari & Tanda Tangan Debitur */}
                      {(debtorFp || debtorSig) && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {debtorFp && (
                            <div
                              className={`p-2 rounded-lg border space-y-1 ${
                                isDarkMode
                                  ? 'bg-slate-950/60 border-emerald-800/50'
                                  : 'bg-white border-emerald-200'
                              }`}
                            >
                              <span
                                className={`block text-[10px] font-semibold ${
                                  isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                                }`}
                              >
                                Cap Sidik Jari Debitur:
                              </span>
                              <img
                                src={debtorFp}
                                alt="Debtor Fingerprint"
                                className="w-full h-16 object-contain rounded bg-white p-1 border border-slate-200"
                              />
                            </div>
                          )}
                          {debtorSig && (
                            <div
                              className={`p-2 rounded-lg border space-y-1 ${
                                isDarkMode
                                  ? 'bg-slate-950/60 border-emerald-800/50'
                                  : 'bg-white border-emerald-200'
                              }`}
                            >
                              <span
                                className={`block text-[10px] font-semibold ${
                                  isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                                }`}
                              >
                                Tanda Tangan Debitur:
                              </span>
                              <img
                                src={debtorSig}
                                alt="Debtor Signature"
                                className="w-full h-16 object-contain rounded bg-white p-1 border border-slate-200"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {app.borrower_reply_note && (
                        <div
                          className={`p-2 rounded border text-[11px] ${
                            isDarkMode
                              ? 'bg-amber-950/50 border-amber-700/50 text-amber-200'
                              : 'bg-amber-50 border-amber-300 text-amber-900'
                          }`}
                        >
                          <strong>Permintaan / Balasan Debitur:</strong> {app.borrower_reply_note}
                        </div>
                      )}

                      <div className={`flex flex-wrap items-center justify-end gap-2 pt-2 border-t ${borderDivider}`}>
                        {Number(app.has_collateral) === 1 ? (
                          <button
                            type="button"
                            onClick={() => openActionModal('collateral_drop', app)}
                            className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                              isDarkMode
                                ? 'bg-sky-600/20 hover:bg-sky-600/30 border-sky-500/40 text-sky-300'
                                : 'bg-sky-50 hover:bg-sky-100 border-sky-300 text-sky-800'
                            }`}
                          >
                            Jaminan & Alamat Drop
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openActionModal('upgrade_collateral', app)}
                            className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                              isDarkMode
                                ? 'bg-sky-600/20 hover:bg-sky-600/30 border-sky-500/40 text-sky-300'
                                : 'bg-sky-50 hover:bg-sky-100 border-sky-300 text-sky-800'
                            }`}
                          >
                            ★ Minta Upgrade Jaminan
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openActionModal('counter_offer', app)}
                          className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                            isDarkMode
                              ? 'bg-amber-600/20 hover:bg-amber-600/30 border-amber-500/40 text-amber-300'
                              : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800'
                          }`}
                        >
                          Lelang Jasa
                        </button>

                        <button
                          type="button"
                          onClick={() => openActionModal('principal_offer', app)}
                          className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                            isDarkMode
                              ? 'bg-indigo-600/20 hover:bg-indigo-600/30 border-indigo-500/40 text-indigo-300'
                              : 'bg-indigo-50 hover:bg-indigo-100 border-indigo-300 text-indigo-800'
                          }`}
                        >
                          Lelang Pokok
                        </button>

                        <button
                          type="button"
                          onClick={() => openActionModal('tenor_approval', app)}
                          className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                            isDarkMode
                              ? 'bg-teal-600/20 hover:bg-teal-600/30 border-teal-500/40 text-teal-300'
                              : 'bg-teal-50 hover:bg-teal-100 border-teal-300 text-teal-800'
                          }`}
                        >
                          Persetujuan Tenor
                        </button>

                        <button
                          type="button"
                          onClick={() => openActionModal('rejected', app)}
                          className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                            isDarkMode
                              ? 'bg-rose-600/20 hover:bg-rose-600/30 border-rose-500/40 text-rose-400'
                              : 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-700'
                          }`}
                        >
                          Tolak
                        </button>

                        <button
                          type="button"
                          onClick={() => openActionModal('approved', app)}
                          className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                            isDarkMode
                              ? 'bg-emerald-600/20 hover:bg-emerald-600/30 border-emerald-500/40 text-emerald-300'
                              : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800'
                          }`}
                        >
                          WA Info ACC
                        </button>

                        <button
                          type="button"
                          onClick={() => triggerApproveToParent(app)}
                          className={`px-3.5 py-1.5 rounded-lg bg-gradient-to-r ${themeStyle.gradientBtn} text-white font-bold`}
                        >
                          Review & Setujui
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL AKSI: FEEDBACK JAMINAN / DROP / LELANG / TEMPLATE WA */}
      {actionModal.open && actionModal.app && (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className={`border rounded-2xl max-w-lg w-full max-h-[88vh] overflow-y-auto p-5 space-y-4 shadow-2xl ${effectiveModalBg}`}>
            <div className={`flex items-center justify-between border-b pb-3 ${borderDivider}`}>
              <h4 className={`text-sm font-bold ${textPrimary}`}>
                {actionModal.type === 'collateral_drop' && 'Feedback & Serah Terima / Drop Jaminan'}
                {actionModal.type === 'counter_offer' && 'Sistem Lelang Imbalan Jasa (Minta Penawaran Ulang)'}
                {actionModal.type === 'principal_offer' && 'Sistem Lelang Pokok Pinjaman (Tentukan Nominal Pokok)'}
                {actionModal.type === 'upgrade_collateral' && 'Minta Peminjam Upgrade ke Kontrak 3 (Jaminan)'}
                {actionModal.type === 'rejected' && 'Tolak Pengajuan Pinjaman'}
                {actionModal.type === 'approved' && 'Kirim Notifikasi Persetujuan (ACC) via WhatsApp'}
                {actionModal.type === 'tenor_approval' && 'Persetujuan Tenor Final (Ketentuan Tetap / Non-Lelang)'}
              </h4>
              <button
                type="button"
                onClick={() => setActionModal((prev) => ({ ...prev, open: false }))}
                className={closeBtnClass}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {actionModal.type === 'collateral_drop' && (
                <>
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer font-semibold ${
                      isDarkMode
                        ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-200'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={actionModal.collateralReceived}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const note = checked
                          ? 'Barang jaminan telah diterima dan diverifikasi fisik oleh Pemberi Pinjaman. Silakan lanjutkan proses pencairan.'
                          : actionModal.collateralNote;
                        setActionModal((prev) => ({
                          ...prev,
                          collateralReceived: checked,
                          collateralNote: note,
                          waMessage: buildWaMessage('collateral_drop', prev.app, {
                            collateralNote: note,
                            dropAddress: prev.dropAddress
                          })
                        }));
                      }}
                      className="accent-emerald-500"
                    />
                    <span>✓ Tandai Barang Jaminan Sudah Diterima (Serah Terima Selesai)</span>
                  </label>

                  <div>
                    <label className={`block mb-1 font-medium ${textSecondary}`}>
                      Catatan / Feedback Kondisi Jaminan:
                    </label>
                    <input
                      type="text"
                      value={actionModal.collateralNote}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActionModal((prev) => ({
                          ...prev,
                          collateralNote: val,
                          waMessage: buildWaMessage('collateral_drop', prev.app, {
                            collateralNote: val,
                            dropAddress: prev.dropAddress
                          })
                        }));
                      }}
                      className={`w-full px-3 py-2 rounded-lg border ${effectiveInputBg}`}
                    />
                  </div>

                  <div>
                    <label className={`block mb-1 font-medium ${textSecondary}`}>
                      Alamat Drop-Off / Titip Jaminan (Bisa diedit manual jika tidak di rumah):
                    </label>
                    <textarea
                      rows={2}
                      value={actionModal.dropAddress}
                      onChange={(e) => {
                        const val = e.target.value;
                        setActionModal((prev) => ({
                          ...prev,
                          dropAddress: val,
                          waMessage: buildWaMessage('collateral_drop', prev.app, {
                            collateralNote: prev.collateralNote,
                            dropAddress: val
                          })
                        }));
                      }}
                      className={`w-full px-3 py-2 rounded-lg border ${effectiveInputBg}`}
                    />
                  </div>
                </>
              )}

              {actionModal.type === 'principal_offer' && (() => {
                const limits = getAppContractLimits(actionModal.app);
                return (
                  <div className="space-y-2.5">
                    <div
                      className={`p-2.5 rounded-lg border text-[11px] flex flex-wrap items-center justify-between gap-1 ${
                        isDarkMode
                          ? 'bg-indigo-950/60 border-indigo-500/40 text-indigo-200'
                          : 'bg-indigo-50 border-indigo-300 text-indigo-900'
                      }`}
                    >
                      <span className="font-bold">{limits.contractLabel}</span>
                      <span
                        className={`font-mono font-semibold ${
                          isDarkMode ? 'text-emerald-300' : 'text-emerald-700'
                        }`}
                      >
                        Batas: {limits.cleanCurr} {limits.minVal.toLocaleString('id-ID')} – {limits.maxVal.toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div>
                      <label className={`block mb-1 font-medium ${textSecondary}`}>
                        Nominal Pokok Tawaran / Lelang ({limits.cleanCurr}):
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNumberWithSeparator(actionModal.offeredPrincipal)}
                        onChange={(e) => {
                          const rawDigits = e.target.value.replace(/\D/g, '');
                          const clampedDigits = clampContractAmount(rawDigits, limits);
                          const autoNote = `Penyesuaian nominal pokok pinjaman menjadi ${limits.cleanCurr} ${Number(clampedDigits || 0).toLocaleString('id-ID')}.`;
                          setActionModal((prev) => ({
                            ...prev,
                            offeredPrincipal: clampedDigits,
                            reasonText: autoNote,
                            waMessage: buildWaMessage('principal_offer', prev.app, {
                              offeredPrincipal: clampedDigits,
                              reasonText: autoNote
                            })
                          }));
                        }}
                        className={`w-full px-3 py-2 rounded-lg border font-bold ${effectiveInputBg}`}
                      />
                    </div>

                    <div>
                      <label className={`block mb-1 font-medium ${textSecondary}`}>
                        Catatan / Syarat Lelang Pokok:
                      </label>
                      <textarea
                        rows={2}
                        value={actionModal.reasonText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setActionModal((prev) => ({
                            ...prev,
                            reasonText: val,
                            waMessage: buildWaMessage('principal_offer', prev.app, {
                              offeredPrincipal: prev.offeredPrincipal,
                              reasonText: val
                            })
                          }));
                        }}
                        className={`w-full px-3 py-2 rounded-lg border ${effectiveInputBg}`}
                      />
                    </div>
                  </div>
                );
              })()}

              {actionModal.type === 'tenor_approval' && (() => {
                const limits = getAppContractLimits(actionModal.app);

                const handleTenorChange = (rawInput, customReason) => {
                  const digitsOnly = String(rawInput || '').replace(/\D/g, '');
                  const clamped =
                    digitsOnly === ''
                      ? ''
                      : String(Math.min(12, Math.max(1, parseInt(digitsOnly, 10) || 1)));
                  const tenorForMsg = clamped || '1';
                  const nextReason =
                    customReason !== undefined
                      ? customReason
                      : `Persetujuan tenor final ditetapkan menjadi ${tenorForMsg} bulan (ketentuan tetap / non-lelang). Silakan konfirmasi YES (Setuju) atau NO (Tolak/Batal).`;

                  setActionModal((prev) => ({
                    ...prev,
                    offeredTenor: clamped,
                    reasonText: nextReason,
                    waMessage: buildWaMessage('tenor_approval', prev.app, {
                      offeredTenor: tenorForMsg,
                      reasonText: nextReason
                    })
                  }));
                };

                return (
                  <div className="space-y-2.5">
                    <div
                      className={`p-2.5 rounded-lg border text-[11px] flex flex-wrap items-center justify-between gap-1 ${
                        isDarkMode
                          ? 'bg-teal-950/60 border-teal-500/40 text-teal-200'
                          : 'bg-teal-50 border-teal-300 text-teal-900'
                      }`}
                    >
                      <span className="font-bold">{limits.contractLabel}</span>
                      <span
                        className={`font-mono font-semibold ${
                          isDarkMode ? 'text-emerald-300' : 'text-emerald-700'
                        }`}
                      >
                        Tenor Final: 1 – 12 Bulan (YES / NO)
                      </span>
                    </div>

                    <div>
                      <label className={`block mb-1 font-medium ${textSecondary}`}>
                        Tenor Final yang Disetujui (Bulan):
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        inputMode="numeric"
                        placeholder="Contoh: 3"
                        value={actionModal.offeredTenor}
                        onChange={(e) => handleTenorChange(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border font-bold ${effectiveInputBg}`}
                      />
                    </div>

                    <div>
                      <label className={`block mb-1 font-medium ${textSecondary}`}>
                        Catatan / Ketentuan Tenor Final:
                      </label>
                      <textarea
                        rows={2}
                        value={actionModal.reasonText}
                        onChange={(e) =>
                          handleTenorChange(actionModal.offeredTenor || '1', e.target.value)
                        }
                        className={`w-full px-3 py-2 rounded-lg border ${effectiveInputBg}`}
                      />
                    </div>
                  </div>
                );
              })()}

              {(actionModal.type === 'counter_offer' || actionModal.type === 'rejected') && (
                <div>
                  <label className={`block mb-1 font-medium ${textSecondary}`}>
                    {actionModal.type === 'counter_offer'
                      ? 'Pesan Penawaran Ulang Imbalan Jasa (Muncul di Link Peminjam):'
                      : 'Alasan Penolakan:'}
                  </label>
                  <textarea
                    rows={2}
                    value={actionModal.reasonText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setActionModal((prev) => ({
                        ...prev,
                        reasonText: val,
                        waMessage: buildWaMessage(prev.type, prev.app, { reasonText: val })
                      }));
                    }}
                    className={`w-full px-3 py-2 rounded-lg border ${effectiveInputBg}`}
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={`font-semibold ${textSecondary}`}>
                    Preview Pesan WhatsApp (Bisa Diedit Manual):
                  </label>
                  <button
                    type="button"
                    onClick={handleSaveCurrentAsTemplate}
                    className={`text-[11px] hover:underline font-medium ${
                      isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                    }`}
                  >
                    Simpan Jadi Template Default
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={actionModal.waMessage}
                  onChange={(e) => setActionModal((prev) => ({ ...prev, waMessage: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg border font-sans leading-relaxed ${effectiveInputBg}`}
                />
                <div className={`text-[10px] mt-1 ${textMuted}`}>
                  Variabel otomatis: {'{nama}'}, {'{nominal}'}, {'{pokok}'}, {'{jasa}'}, {'{tenor}'}, {'{jaminan}'}, {'{alamat_drop}'}, {'{link_status}'}
                </div>
              </div>
            </div>

            <div className={`flex flex-wrap items-center justify-end gap-2 pt-2 border-t ${borderDivider}`}>
              {actionModal.type !== 'approved' && (
                <button
                  type="button"
                  onClick={() => handleConfirmActionModal(false)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold ${secondaryBtnClass}`}
                >
                  {t.saveToLinkOnly}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleConfirmActionModal(true)}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                {actionModal.type === 'approved' ? t.openWaAcc : t.saveSendWa}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
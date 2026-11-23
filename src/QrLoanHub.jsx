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
  PhoneCall
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

export default function QrLoanHub({
  isDarkMode = true,
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

  // Helper simpan cache lokal bukti drop agar tidak pernah hilang saat refresh
  const persistDropProofCache = (items) => {
    try {
      localStorage.setItem('wgen_verified_drop_proofs_cache', JSON.stringify(items));
    } catch (e) {
      console.warn('Cache bukti drop melebihi kuota storage:', e);
    }
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

      // Gabungkan bukti drop dari DB Turso + catatan collateral_feedback di tabel aplikasi + cache lokal
      let cachedLocalDrops = [];
      try {
        cachedLocalDrops = JSON.parse(
          localStorage.getItem('wgen_verified_drop_proofs_cache') || '[]'
        );
      } catch {
        cachedLocalDrops = [];
      }

      const dropMap = new Map();

      // 1. Masukkan dari cache lokal terlebih dahulu
      if (Array.isArray(cachedLocalDrops)) {
        for (const item of cachedLocalDrops) {
          const key = item.application_id || item.id;
          if (key) dropMap.set(key, item);
        }
      }

      // 2. Timpa/lengkapi dengan data dari tabel khusus DB Turso jika ada
      if (Array.isArray(dbDropRows)) {
        for (const item of dbDropRows) {
          const key = item.application_id || item.id;
          const existing = dropMap.get(key);
          dropMap.set(key, {
            ...existing,
            ...item,
            // Pertahankan status verified jika sudah diverifikasi lokal/DB
            status:
              existing?.status === 'verified' || item.status === 'verified'
                ? 'verified'
                : item.status || 'pending'
          });
        }
      }

      // 3. Cek seluruh aplikasi (termasuk yang sudah approved) yang punya bukti drop atau sudah ditandai diterima kreditur
      for (const app of allRows) {
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

  // Expose helper ke parent jika DebtManager selesai menyimpan pengajuan yang di-ACC
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

    // Aktifkan kembali hotline di server jika sebelumnya dimatikan
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

      // Sinkronkan ke server agar Hotline di LoanApplyPage.jsx ikut tersembunyi saat fitur dimatikan
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

  // === VERIFIKASI & SIMPAN BUKTI DROP JAMINAN ===
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

      // Pastikan juga tercatat di collateral_feedback aplikasi utama agar permanen di DB
      if (dropItem.application_id && typeof updateApplicationFeedback === 'function') {
        await updateApplicationFeedback({
          applicationId: dropItem.application_id,
          collateralFeedback: `[✓ BARANG JAMINAN DITERIMA] ${dropItem.drop_note || noteText}`
        }).catch(() => {});
      }

      setDropProofList((prev) => {
        const updated = prev.map((item) =>
          item.id === dropItem.id || item.application_id === dropItem.application_id
            ? { ...item, status: 'verified', verified_at: new Date().toISOString() }
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

    // Jika server menyimpan config hotline sebelumnya, sinkronkan ke state lokal
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

        // JIKA DICENTANG DITERIMA, LANGSUNG SIMPAN KE DAFTAR "BUKTI DROP JAMINAN" (TOMBOL KE-3)
        if (collateralReceived) {
          const uid = auth?.currentUser?.uid || localStorage.getItem('wgen_last_uid') || '';
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
            verified_at: new Date().toISOString(),
            created_at: app.updated_at || app.created_at || new Date().toISOString()
          };

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
    <>
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
        <span>QR Pengajuan</span>
        {!qrFeatureEnabled && (
          <span
            className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
              isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-300 text-slate-800'
            }`}
          >
            Off
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
        <span>Pengajuan Masuk</span>
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
        <span>Bukti Drop Jaminan</span>
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
        <span>Hotline</span>
        {qrFeatureEnabled && hotlineConfig.enabled && hotlineConfig.phone && (
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
        )}
      </button>

      {/* MODAL PEMBERITAHUAN KHUSUS PENGGUNA INDONESIA */}
      {showIdNoticeModal && (
        <div className="fixed inset-0 z-[1050] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl ${modalBg}`}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-700/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Fitur Khusus Pengguna di Indonesia
                  </h3>
                  <p className="text-[11px] text-emerald-400 font-medium">
                    QR Pengajuan, Kotak Masuk, Bukti Drop & Hotline
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowIdNoticeModal(false);
                  setPendingActionAfterConsent(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <p>
                Fitur <strong>QR Pengajuan</strong>, <strong>Pengajuan Masuk</strong>,{' '}
                <strong>Bukti Drop Jaminan</strong>, dan <strong>Hotline</strong> dirancang khusus
                untuk transaksi di wilayah <strong className="text-emerald-300">Indonesia</strong>{' '}
                (format nomor HP +62, Rupiah/konversi lokal, serta verifikasi KTP & dokumen).
              </p>
              <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-[11px] text-emerald-200">
                Setelah diaktifkan, pengaturan ini akan tersimpan otomatis. Anda dapat mematikan
                atau menghidupkan kembali seluruh fitur ini dalam satu saklar melalui menu{' '}
                <strong>QR Pengajuan</strong> atau <strong>Hotline</strong>.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/60">
              <button
                type="button"
                onClick={() => {
                  setShowIdNoticeModal(false);
                  setPendingActionAfterConsent(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmEnableIdFeature}
                className={`px-4 py-2 rounded-xl bg-gradient-to-r ${themeStyle.gradientBtn} text-white text-xs font-bold shadow`}
              >
                Saya Mengerti & Aktifkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BANNER FLOATING NOTIFIKASI DEBITUR SETUJU / MINTA TAMBAH POKOK & TRANSFER MASUK */}
      {qrFeatureEnabled && (agreedAppsNotif.length > 0 || pendingInstallmentReports.length > 0) && (
        <div className="w-full space-y-2.5 mt-3">
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
                    ? 'bg-amber-950/95 border-amber-400/80'
                    : 'bg-emerald-950/95 border-emerald-400/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-sm animate-bounce shrink-0 ${
                      isRequestMore
                        ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                        : 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                    }`}
                  >
                    {isRequestMore ? '↑' : '✓'}
                  </span>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-white">
                      {isRequestMore
                        ? 'Debitur Minta Tambah Pokok!'
                        : 'Debitur Menyetujui Penawaran!'}
                    </div>
                    <div className={`text-[11px] ${isRequestMore ? 'text-amber-200' : 'text-emerald-200'}`}>
                      {isRequestMore ? (
                        <>
                          <strong>{appItem.borrower_name}</strong> mengajukan perubahan/tambah nominal menjadi{' '}
                          <strong>
                            {appItem.currency} {nominalDitampilkan.toLocaleString('id-ID')}
                          </strong>{' '}
                          {tawaranSebelumnya > 0 && tawaranSebelumnya !== nominalDitampilkan && (
                            <span className="text-amber-300/80">
                              (dari tawaran {appItem.currency} {tawaranSebelumnya.toLocaleString('id-ID')})
                            </span>
                          )}{' '}
                          (Jasa {appItem.reward_percent ?? 20}%).
                          {appItem.borrower_reply_note && (
                            <span className="block italic text-amber-300/90 mt-0.5">
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
            <div className="p-3.5 rounded-xl bg-sky-950/90 border border-sky-500/80 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-sky-500/20 border border-sky-400 text-sky-300 flex items-center justify-center font-bold text-sm animate-pulse">
                  {pendingInstallmentReports.length}
                </span>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-white">
                    Konfirmasi Transfer Cicilan Masuk ({pendingInstallmentReports.length})
                  </div>
                  <div className="text-[11px] text-sky-200/85">
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
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-md w-full max-h-[88vh] overflow-y-auto p-5 space-y-4 shadow-2xl ${modalBg}`}>
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div className="flex items-center gap-2">
                <Headphones className="w-5 h-5 text-teal-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Pengaturan Hotline Debitur</h3>
                  <p className="text-[10px] text-teal-300/85">
                    Otomatis tampil di halaman formulir pengajuan (LoanApplyPage)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHotlineModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3 rounded-xl bg-teal-950/40 border border-teal-700/50 cursor-pointer">
                <div>
                  <span className="font-bold text-teal-200 block">Tampilkan Tombol Hotline di Halaman Pengajuan</span>
                  <span className="text-[10px] text-slate-400">
                    Debitur bisa langsung chat WhatsApp / hubungi hotline dari halaman form.
                  </span>
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
                <label className="block text-slate-300 mb-1 font-semibold">Judul / Label Hotline:</label>
                <input
                  type="text"
                  value={hotlineConfig.label}
                  onChange={(e) =>
                    setHotlineConfig((prev) => ({ ...prev, label: e.target.value }))
                  }
                  placeholder="Contoh: Hotline Bantuan & Konfirmasi"
                  className={`w-full px-3 py-2 rounded-lg border ${inputBg}`}
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  Nomor WhatsApp / Telepon Hotline:
                </label>
                <div className="relative">
                  <PhoneCall className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={hotlineConfig.phone}
                    onChange={(e) =>
                      setHotlineConfig((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="Contoh: 081234567890 atau 6281234567890"
                    className={`w-full pl-9 pr-3 py-2 rounded-lg border ${inputBg}`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Jam Layanan / Operasional:</label>
                <input
                  type="text"
                  value={hotlineConfig.hours}
                  onChange={(e) =>
                    setHotlineConfig((prev) => ({ ...prev, hours: e.target.value }))
                  }
                  placeholder="Contoh: Senin – Minggu, 08.00 – 21.00 WIB"
                  className={`w-full px-3 py-2 rounded-lg border ${inputBg}`}
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  Pesan / Keterangan Tambahan (Edit Manual):
                </label>
                <textarea
                  rows={3}
                  value={hotlineConfig.note}
                  onChange={(e) =>
                    setHotlineConfig((prev) => ({ ...prev, note: e.target.value }))
                  }
                  placeholder="Tulis instruksi bantuan atau info kontak untuk calon debitur..."
                  className={`w-full px-3 py-2 rounded-lg border ${inputBg}`}
                />
              </div>

              {/* Preview tampilan kartu Hotline di LoanApplyPage */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  Preview di Halaman Pengajuan:
                </div>
                <div className="text-xs font-bold text-emerald-300">
                  {hotlineConfig.label || 'Hotline Bantuan'}
                </div>
                <div className="text-[11px] text-slate-200 font-mono">
                  {hotlineConfig.phone || '(Nomor belum diisi)'}{' '}
                  {hotlineConfig.hours ? `• ${hotlineConfig.hours}` : ''}
                </div>
                {hotlineConfig.note && (
                  <p className="text-[11px] text-slate-400 leading-snug">{hotlineConfig.note}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/60">
              <button
                type="button"
                onClick={() => setShowHotlineModal(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={savingHotline}
                onClick={handleSaveHotlineSettings}
                className={`px-4 py-2 rounded-xl bg-gradient-to-r ${themeStyle.gradientBtn} text-white text-xs font-bold shadow disabled:opacity-50`}
              >
                {savingHotline ? 'Menyimpan...' : 'Simpan & Terapkan ke Form'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BUKTI DROP JAMINAN MASUK & TERSIMPAN (TOMBOL KHUSUS KE-3) */}
      {showDropProofModal && (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4 shadow-2xl ${modalBg}`}>
            <div className={`flex items-center justify-between gap-2 border-b pb-3 ${isDarkMode ? 'border-slate-700/60' : 'border-slate-200'}`}>
              <div>
                <h3 className={`text-base font-bold flex items-center gap-2 ${isDarkMode ? 'text-sky-400' : 'text-sky-700'}`}>
                  <PackageCheck className="w-5 h-5" /> Bukti Pengiriman / Drop Jaminan ({dropProofList.length})
                </h3>
                {lastRefreshedAt && (
                  <span className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Terakhir diperbarui: {lastRefreshedAt.toLocaleTimeString('id-ID')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
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
                  <span>{loadingDropProofs ? 'Memuat...' : 'Refresh'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDropProofModal(false)}
                  className={`p-1 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingDropProofs && dropProofList.length === 0 ? (
              <div className={`py-10 text-center text-xs animate-pulse ${isDarkMode ? 'text-sky-400' : 'text-sky-600'}`}>
                Memuat bukti drop jaminan masuk...
              </div>
            ) : dropProofList.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Belum ada bukti pengiriman / drop barang jaminan yang diterima atau dikirim debitur.
                </div>
                <button
                  type="button"
                  onClick={() => loadQrApplicationsAndReports('', true)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1.5 ${
                    isDarkMode
                      ? 'bg-slate-800 hover:bg-slate-700 text-sky-400'
                      : 'bg-slate-100 hover:bg-slate-200 text-sky-700 border border-slate-300'
                  }`}
                >
                  <RefreshCw className="w-3 h-3" /> Cek Ulang Sekarang
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {dropProofList.map((drop) => {
                  const isVerified = drop.status === 'verified';
                  return (
                    <div
                      key={drop.id || drop.application_id}
                      className={`p-4 rounded-xl border space-y-2.5 text-xs ${bgInnerBox}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {drop.borrower_name || 'Debitur'}
                          </div>
                          <div className={`text-[11px] font-mono ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                            No. Pengajuan: {drop.application_id}
                          </div>
                          {drop.borrower_phone && (
                            <div className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                              HP: {drop.borrower_phone}
                            </div>
                          )}
                        </div>

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
                          {isVerified ? '✓ Bukti Tersimpan & Diverifikasi' : 'Menunggu Verifikasi Kreditur'}
                        </span>
                      </div>

                      <div
                        className={`p-2.5 rounded-lg border space-y-1 ${
                          isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div>
                          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Unit Jaminan: </span>
                          <span className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                            {drop.collateral_desc || '-'}
                          </span>
                        </div>
                        {drop.drop_note && (
                          <div>
                            <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Keterangan Drop: </span>
                            <span className={`font-medium ${isDarkMode ? 'text-sky-300' : 'text-sky-700'}`}>
                              {drop.drop_note}
                            </span>
                          </div>
                        )}
                      </div>

                      {drop.proof_image && (
                        <div className="space-y-1">
                          <span className={`text-[11px] block ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                            Lampiran Foto Bukti Drop / Jaminan:
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

                      <div className={`flex flex-wrap items-center justify-end gap-2 pt-2 border-t ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200'}`}>
                        {drop.proof_image && (
                          <button
                            type="button"
                            onClick={() => handleDownloadDropProofImage(drop)}
                            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 ${
                              isDarkMode
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                            }`}
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Unduh Bukti</span>
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
                              {verifyingDropId === drop.id
                                ? 'Menyimpan...'
                                : 'Simpan & Konfirmasi Bukti Diterima'}
                            </span>
                          </button>
                        )}
                      </div>
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full max-h-[85vh] overflow-y-auto bg-[#0c2119] border border-sky-600/80 rounded-2xl p-5 space-y-4 text-emerald-50">
            <div className="flex items-center justify-between border-b border-emerald-800/70 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  Laporan Transfer Cicilan ({pendingInstallmentReports.length})
                </h3>
                <p className="text-[11px] text-emerald-200/75">
                  Cek mutasi rekening Anda, lalu klik Konfirmasi agar saldo tiket peminjam otomatis terupdate.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferNotifModal(false)}
                className="px-2.5 py-1 rounded-lg bg-[#071510] border border-emerald-700 text-xs text-emerald-300"
              >
                ✕
              </button>
            </div>

            {pendingInstallmentReports.length === 0 ? (
              <div className="py-8 text-center text-xs text-emerald-300/80">
                Semua laporan transfer sudah diverifikasi.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingInstallmentReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-3.5 rounded-xl bg-[#071510] border border-emerald-800/80 space-y-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-white text-sm">{rep.borrowerName}</div>
                        <div className="text-[11px] text-emerald-400 font-mono">
                          Tiket: {rep.applicationId}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-sky-950 border border-sky-600 text-sky-300 font-semibold text-[11px]">
                        Angsuran ke-{rep.installmentNumber}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[#0c2119] border border-emerald-800/60">
                      <div>
                        <span className="text-[11px] text-emerald-400/80 block">Nominal Transfer:</span>
                        <span className="font-bold text-emerald-300 text-sm">
                          {rep.currency} {Number(rep.amount || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-emerald-400/80 block">Via / Rekening:</span>
                        <span className="text-white font-semibold">{rep.transferMethod || '-'}</span>
                      </div>
                    </div>

                    {rep.proofImage && (
                      <div className="space-y-1">
                        <div className="text-[11px] text-emerald-300">Lampiran Foto Bukti Struk:</div>
                        <img
                          src={rep.proofImage}
                          alt="Bukti Transfer"
                          className="w-full max-h-56 object-contain rounded-lg border border-emerald-800 bg-black"
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
                        {verifyingReportId === rep.id
                          ? 'Memverifikasi...'
                          : '✓ Mutasi Masuk — Konfirmasi & Update Tiket'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: QR CODE GENERATOR + POSTER CUSTOM TEKS */}
      {showQrModal && (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl ${modalBg}`}>
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div>
                <h3 className={`text-base font-bold flex items-center gap-2 ${themeStyle.textAccent}`}>
                  <QrCode className="w-5 h-5" /> QR Code Pengajuan Pinjaman
                </h3>
                <span className="text-[10px] text-emerald-400/80">
                  Khusus Wilayah & Transaksi Indonesia
                </span>
              </div>
              <button type="button" onClick={() => setShowQrModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingQr || !qrLinkData ? (
              <div className="py-10 text-center text-xs text-slate-400">Menyiapkan QR Code...</div>
            ) : (
              <>
                <div className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border ${bgInnerBox}`}>
                  <div className="text-xs font-extrabold text-emerald-300 text-center tracking-wide">
                    {qrPosterTitle || 'SCAN QR PENGAJUAN PINJAMAN'}
                  </div>
                  <div className="bg-white p-3 rounded-xl shadow">
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
                  <span className="text-xs font-mono font-bold text-emerald-400">{qrLinkData.token}</span>
                  {qrPosterSubtitle && (
                    <p className="text-[11px] text-slate-300 text-center max-w-xs leading-snug">
                      {qrPosterSubtitle}
                    </p>
                  )}
                  <input
                    type="text"
                    readOnly
                    value={`${PUBLIC_WEB_ORIGIN}/apply?token=${qrLinkData.token}`}
                    onClick={(e) => e.target.select()}
                    className={`w-full px-3 py-1.5 rounded-lg text-[11px] text-center border ${inputBg}`}
                  />
                </div>

                {/* EDIT KATA-KATA PADA GAMBAR QR SAAT DI-DOWNLOAD */}
                <div className="w-full text-left space-y-2 p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
                  <div className="text-[11px] font-bold text-emerald-300">
                    Teks Poster QR (Ikut Tercetak Saat Download PNG):
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Judul Atas QR:</label>
                    <input
                      type="text"
                      value={qrPosterTitle}
                      onChange={(e) => {
                        setQrPosterTitle(e.target.value);
                        localStorage.setItem('wgen_qr_poster_title', e.target.value);
                      }}
                      placeholder="Contoh: SCAN QR PENGAJUAN PINJAMAN"
                      className={`w-full px-3 py-1.5 rounded-lg text-xs border ${inputBg}`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Catatan / Keterangan Bawah QR:</label>
                    <input
                      type="text"
                      value={qrPosterSubtitle}
                      onChange={(e) => {
                        setQrPosterSubtitle(e.target.value);
                        localStorage.setItem('wgen_qr_poster_subtitle', e.target.value);
                      }}
                      placeholder="Contoh: Hubungi WA 0812xxx jika butuh bantuan..."
                      className={`w-full px-3 py-1.5 rounded-lg text-xs border ${inputBg}`}
                    />
                  </div>
                </div>

                <div className="w-full text-left space-y-1.5 pt-1">
                  <label className="text-[11px] font-semibold text-slate-400">
                    Rekening / E-Wallet Tujuan Pembayaran (Otomatis Tersimpan & Terisi Saat ACC):
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
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs border ${inputBg}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        handleSaveQrPaymentAccount(qrPaymentAccount, qrPaymentMethod);
                        showToast('Nomor rekening QR berhasil disimpan!', 'success');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0"
                    >
                      Simpan
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
                    className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5"
                  >
                    {copiedQrLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedQrLink ? 'Tersalin!' : 'Salin Link'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadQrPng}
                    className={`py-2.5 rounded-xl bg-gradient-to-r ${themeStyle.gradientBtn} text-white font-bold flex items-center justify-center gap-1.5`}
                  >
                    <Download className="w-4 h-4" />
                    <span>Download QR + Teks</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs">
                  <button
                    type="button"
                    onClick={async () => {
                      const nextActive = Number(qrLinkData.is_active) !== 1;
                      await updateLenderQrSettings(qrLinkData.token, { isActive: nextActive });
                      setQrLinkData({ ...qrLinkData, is_active: nextActive ? 1 : 0 });
                    }}
                    className="text-emerald-400 underline"
                  >
                    {Number(qrLinkData.is_active) === 1 ? 'Nonaktifkan Link QR' : 'Aktifkan Link QR'}
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
                    className="text-amber-400 underline"
                  >
                    Buat Token Baru
                  </button>
                </div>

                {/* SAKLAR MATIKAN / AKTIFKAN SEMUA FITUR QR, INBOX, BUKTI DROP & HOTLINE */}
                <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/70 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Power className="w-3.5 h-3.5 text-rose-400" />
                      <span>Status Fitur QR, Inbox, Bukti Drop & Hotline</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Matikan jika tidak digunakan untuk transaksi Indonesia.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleQrFeature(false)}
                    className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-bold text-[11px]"
                  >
                    Matikan Fitur
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL: DAFTAR PENGAJUAN PINJAMAN MASUK */}
      {showInboxModal && (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4 shadow-2xl ${modalBg}`}>
            <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
              <div>
                <h3 className={`text-base font-bold flex items-center gap-2 ${themeStyle.textAccent}`}>
                  <Inbox className="w-5 h-5" /> Pengajuan Masuk ({incomingApps.length})
                </h3>
                {lastRefreshedAt && (
                  <span className="text-[10px] text-slate-400">
                    Terakhir diperbarui: {lastRefreshedAt.toLocaleTimeString('id-ID')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loadingInbox}
                  onClick={() => loadQrApplicationsAndReports('', true)}
                  title="Muat ulang pengajuan masuk"
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingInbox ? 'animate-spin' : ''}`} />
                  <span>{loadingInbox ? 'Memuat...' : 'Refresh'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowInboxModal(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingInbox && incomingApps.length === 0 ? (
              <div className="py-10 text-center text-xs text-emerald-400 animate-pulse">
                Memuat data pengajuan masuk...
              </div>
            ) : incomingApps.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <div className="text-xs text-slate-400">
                  Belum ada pengajuan baru yang menunggu persetujuan.
                </div>
                <button
                  type="button"
                  onClick={() => loadQrApplicationsAndReports('', true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] font-semibold inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" /> Cek Ulang Sekarang
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
                    <div key={app.id} className={`p-4 rounded-xl border space-y-2.5 text-xs ${bgInnerBox}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm">
                            {app.borrower_name && String(app.borrower_name).trim().toLowerCase() !== ''
                              ? app.borrower_name
                              : 'Peminjam (Tanpa Nama)'}
                          </span>
                          {app.status === 'counter_offer' && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-semibold">
                              Lelang Jasa • Tawaran Terkini: {app.reward_percent || 0}%
                            </span>
                          )}
                          {hasCounterPrincipal && (
                            <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-semibold">
                              Lelang Pokok: {app.currency} {Number(app.counter_principal_amount).toLocaleString('id-ID')}
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          {app.currency} {Number(app.requested_amount || 0).toLocaleString('id-ID')}
                        </span>
                      </div>

                      {app.status === 'tenor_offer' && (
                        <span className="px-2 py-0.5 rounded bg-teal-500/20 border border-teal-500/40 text-teal-300 text-[10px] font-semibold">
                          Persetujuan Tenor Final: {app.approved_tenor_months || app.tenor_months} Bln (Menunggu Konfirmasi)
                        </span>
                      )}

                      {isBorrowerAgreed && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/60 text-emerald-300 text-[10px] font-bold">
                          ✓ Debitur Setuju / Oke
                        </span>
                      )}

                      {isBorrowerRequestMore && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/25 border border-amber-400/60 text-amber-300 text-[10px] font-bold">
                          ↑ Minta Tambah Pokok
                        </span>
                      )}

                      <div className="text-slate-400 space-y-1">
                        <div>
                          HP: <span className="text-slate-200">{app.borrower_phone}</span> • Tenor:{' '}
                          <span className="text-slate-200">{app.tenor_months} bln</span> (
                          {Number(app.is_installment) === 1 ? 'Cicilan' : 'Sekali Bayar'}) • Imbalan Jasa:{' '}
                          <span className="text-emerald-300 font-semibold">{app.reward_percent || 20}%</span>
                        </div>
                        <div>
                          Jaminan:{' '}
                          <span className="text-slate-200 font-medium">
                            {Number(app.has_collateral) === 1 ? app.collateral_desc || 'Ada' : 'Tanpa Jaminan'}
                          </span>
                        </div>
                        {app.collateral_feedback && (
                          <div className="p-2 rounded bg-emerald-950/50 border border-emerald-700/50 text-emerald-200 text-[11px]">
                            <strong>Status Jaminan:</strong> {app.collateral_feedback}
                          </div>
                        )}
                        {app.notes && <div className="text-slate-300">Catatan: {app.notes}</div>}
                      </div>

                      {/* Preview Lampiran Sidik Jari & Tanda Tangan Debitur */}
                      {(debtorFp || debtorSig) && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {debtorFp && (
                            <div className="p-2 rounded-lg bg-slate-950/60 border border-emerald-800/50 space-y-1">
                              <span className="block text-[10px] text-emerald-400 font-semibold">
                                Cap Sidik Jari Debitur:
                              </span>
                              <img
                                src={debtorFp}
                                alt="Debtor Fingerprint"
                                className="w-full h-16 object-contain rounded bg-white p-1"
                              />
                            </div>
                          )}
                          {debtorSig && (
                            <div className="p-2 rounded-lg bg-slate-950/60 border border-emerald-800/50 space-y-1">
                              <span className="block text-[10px] text-emerald-400 font-semibold">
                                Tanda Tangan Debitur:
                              </span>
                              <img
                                src={debtorSig}
                                alt="Debtor Signature"
                                className="w-full h-16 object-contain rounded bg-white p-1"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {app.borrower_reply_note && (
                        <div className="p-2 rounded bg-amber-950/50 border border-amber-700/50 text-amber-200 text-[11px]">
                          <strong>Permintaan / Balasan Debitur:</strong> {app.borrower_reply_note}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-700/50">
                        {Number(app.has_collateral) === 1 ? (
                          <button
                            type="button"
                            onClick={() => openActionModal('collateral_drop', app)}
                            className="px-2.5 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 font-semibold"
                          >
                            Jaminan & Alamat Drop
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openActionModal('upgrade_collateral', app)}
                            className="px-2.5 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/40 text-sky-300 font-semibold"
                          >
                            ★ Minta Upgrade Jaminan
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openActionModal('counter_offer', app)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 font-semibold"
                        >
                          Lelang Jasa
                        </button>

                        <button
                          type="button"
                          onClick={() => openActionModal('principal_offer', app)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-semibold"
                        >
                          Lelang Pokok
                        </button>

                        <button
                          type="button"
                          onClick={() => openActionModal('tenor_approval', app)}
                          className="px-2.5 py-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/40 text-teal-300 font-semibold"
                        >
                          Persetujuan Tenor
                        </button>

                        <button
                          type="button"
                          onClick={() => openActionModal('rejected', app)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-400 font-semibold"
                        >
                          Tolak
                        </button>

                        <button
                          type="button"
                          onClick={() => openActionModal('approved', app)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-semibold"
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
        <div className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`border rounded-2xl max-w-lg w-full max-h-[88vh] overflow-y-auto p-5 space-y-4 shadow-2xl ${modalBg}`}>
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <h4 className="text-sm font-bold text-white">
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
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {actionModal.type === 'collateral_drop' && (
                <>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-700/60 cursor-pointer text-emerald-200 font-semibold">
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
                    <label className="block text-slate-300 mb-1">Catatan / Feedback Kondisi Jaminan:</label>
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
                      className="w-full px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1">
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
                      className="w-full px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700 text-white"
                    />
                  </div>
                </>
              )}

              {actionModal.type === 'principal_offer' && (() => {
                const limits = getAppContractLimits(actionModal.app);
                return (
                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-500/40 text-[11px] text-indigo-200 flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold">{limits.contractLabel}</span>
                      <span className="font-mono font-semibold text-emerald-300">
                        Batas: {limits.cleanCurr} {limits.minVal.toLocaleString('id-ID')} – {limits.maxVal.toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1">
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
                        className="w-full px-3 py-2 rounded-lg bg-slate-900/90 border border-indigo-500/60 text-white font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1">Catatan / Syarat Lelang Pokok:</label>
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
                        className="w-full px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700 text-white"
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
                    <div className="p-2.5 rounded-lg bg-teal-950/60 border border-teal-500/40 text-[11px] text-teal-200 flex flex-wrap items-center justify-between gap-1">
                      <span className="font-bold">{limits.contractLabel}</span>
                      <span className="font-mono font-semibold text-emerald-300">
                        Tenor Final: 1 – 12 Bulan (YES / NO)
                      </span>
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1">
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
                        className="w-full px-3 py-2 rounded-lg bg-slate-900/90 border border-teal-500/60 text-white font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1">
                        Catatan / Ketentuan Tenor Final:
                      </label>
                      <textarea
                        rows={2}
                        value={actionModal.reasonText}
                        onChange={(e) =>
                          handleTenorChange(actionModal.offeredTenor || '1', e.target.value)
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700 text-white"
                      />
                    </div>
                  </div>
                );
              })()}

              {(actionModal.type === 'counter_offer' || actionModal.type === 'rejected') && (
                <div>
                  <label className="block text-slate-300 mb-1">
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
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700 text-white"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">Preview Pesan WhatsApp (Bisa Diedit Manual):</label>
                  <button
                    type="button"
                    onClick={handleSaveCurrentAsTemplate}
                    className="text-[11px] text-emerald-400 hover:underline"
                  >
                    Simpan Jadi Template Default
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={actionModal.waMessage}
                  onChange={(e) => setActionModal((prev) => ({ ...prev, waMessage: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/90 border border-emerald-700/60 text-white font-sans leading-relaxed"
                />
                <div className="text-[10px] text-slate-400 mt-1">
                  Variabel otomatis: {'{nama}'}, {'{nominal}'}, {'{pokok}'}, {'{jasa}'}, {'{tenor}'}, {'{jaminan}'}, {'{alamat_drop}'}, {'{link_status}'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-700/60">
              {actionModal.type !== 'approved' && (
                <button
                  type="button"
                  onClick={() => handleConfirmActionModal(false)}
                  className="px-3.5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold"
                >
                  Simpan ke Link Saja
                </button>
              )}
              <button
                type="button"
                onClick={() => handleConfirmActionModal(true)}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
              >
                {actionModal.type === 'approved' ? 'Buka WhatsApp & Kirim Info ACC' : 'Simpan & Kirim via WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
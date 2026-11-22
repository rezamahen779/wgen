import { turso } from '../lib/turso';

function generateRandomToken(prefix = 'WGN') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${code}`;
}

function generateAppId() {
  return `APP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
}

/**
 * 0. Migrasi aman: Pastikan seluruh kolom tambahan tersedia di tabel loan_applications
 */
let columnsEnsured = false;
export async function ensureApplicationExtraColumns() {
  if (columnsEnsured) return;
  const alters = [
    `ALTER TABLE loan_applications ADD COLUMN reward_percent REAL DEFAULT 12.5`,
    `ALTER TABLE loan_applications ADD COLUMN contract_type TEXT DEFAULT 'secured_collateral'`,
    `ALTER TABLE loan_applications ADD COLUMN collateral_value REAL DEFAULT 0`,
    `ALTER TABLE loan_applications ADD COLUMN photo_collateral_2 TEXT`,
    `ALTER TABLE loan_applications ADD COLUMN rejection_reason TEXT`,
    `ALTER TABLE loan_applications ADD COLUMN collateral_feedback TEXT`,
    `ALTER TABLE loan_applications ADD COLUMN paid_amount REAL DEFAULT 0`,
    `ALTER TABLE loan_applications ADD COLUMN paid_installments INTEGER DEFAULT 0`,
    `ALTER TABLE loan_applications ADD COLUMN installment_history TEXT DEFAULT '[]'`,
    `ALTER TABLE loan_applications ADD COLUMN updated_at TEXT`
  ];
  for (const sql of alters) {
    try {
      await turso.execute(sql);
    } catch (_) {
      // Abaikan jika kolom sudah ada di database
    }
  }
  columnsEnsured = true;
}

/**
 * 1. Ambil QR Link aktif milik user, atau buat baru jika belum ada
 */
export async function getOrCreateLenderQrLink({
  lenderUid,
  lenderName = '',
  defaultCurrency = 'IDR',
  isMicro = false
}) {
  if (!lenderUid) throw new Error('User UID tidak ditemukan.');

  const existing = await turso.execute({
    sql: `SELECT * FROM lender_qr_links WHERE lender_uid = ? ORDER BY created_at DESC LIMIT 1`,
    args: [lenderUid]
  });

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const newToken = generateRandomToken('WGN');
  await turso.execute({
    sql: `INSERT INTO lender_qr_links (token, lender_uid, lender_name, default_currency, is_micro, is_active)
          VALUES (?, ?, ?, ?, ?, 1)`,
    args: [newToken, lenderUid, lenderName, defaultCurrency, isMicro ? 1 : 0]
  });

  const created = await turso.execute({
    sql: `SELECT * FROM lender_qr_links WHERE token = ?`,
    args: [newToken]
  });
  return created.rows[0];
}

/**
 * 2. Update pengaturan QR Link (nama default, mata uang, mode mikro, status aktif)
 */
export async function updateLenderQrSettings(token, { lenderName, defaultCurrency, isMicro, isActive }) {
  await turso.execute({
    sql: `UPDATE lender_qr_links
          SET lender_name = COALESCE(?, lender_name),
              default_currency = COALESCE(?, default_currency),
              is_micro = COALESCE(?, is_micro),
              is_active = COALESCE(?, is_active)
          WHERE token = ?`,
    args: [
      lenderName ?? null,
      defaultCurrency ?? null,
      typeof isMicro === 'boolean' ? (isMicro ? 1 : 0) : null,
      typeof isActive === 'boolean' ? (isActive ? 1 : 0) : null,
      token
    ]
  });
}

/**
 * 3. Buat ulang token baru (jika link lama bocor/ingin diganti)
 */
export async function regenerateLenderQrLink({
  lenderUid,
  lenderName = '',
  defaultCurrency = 'IDR',
  isMicro = false
}) {
  await turso.execute({
    sql: `UPDATE lender_qr_links SET is_active = 0 WHERE lender_uid = ?`,
    args: [lenderUid]
  });

  const newToken = generateRandomToken('WGN');
  await turso.execute({
    sql: `INSERT INTO lender_qr_links (token, lender_uid, lender_name, default_currency, is_micro, is_active)
          VALUES (?, ?, ?, ?, ?, 1)`,
    args: [newToken, lenderUid, lenderName, defaultCurrency, isMicro ? 1 : 0]
  });

  const created = await turso.execute({
    sql: `SELECT * FROM lender_qr_links WHERE token = ?`,
    args: [newToken]
  });
  return created.rows[0];
}

/**
 * 4. Validasi token saat calon peminjam membuka link /apply?token=...
 */
export async function getQrLinkByToken(token) {
  if (!token) return null;
  const res = await turso.execute({
    sql: `SELECT token, lender_uid, lender_name, default_currency, is_micro, is_active
          FROM lender_qr_links
          WHERE token = ? LIMIT 1`,
    args: [token.trim().toUpperCase()]
  });
  if (res.rows.length === 0) return null;
  return res.rows[0];
}

/**
 * 5. Kirim pengajuan pinjaman lengkap dari form publik ke akun lender terkait
 */
export async function submitLoanApplication(payload) {
  await ensureApplicationExtraColumns();

  const qrInfo = await getQrLinkByToken(payload.qrToken);
  if (!qrInfo || Number(qrInfo.is_active) !== 1) {
    throw new Error('Link pengajuan tidak valid atau sudah dinonaktifkan oleh pemberi pinjaman.');
  }

  const id = generateAppId();
  const nowIso = new Date().toISOString();
  const isWithCollateral =
    payload.contractType === 'secured_collateral' || Boolean(payload.hasCollateral);
  const resolvedContractType =
    payload.contractType || (isWithCollateral ? 'secured_collateral' : 'standard_unsecured');
  const defaultReward = resolvedContractType === 'standard_unsecured' ? 20 : 12.5;
  const resolvedRewardPercent =
    payload.rewardPercent !== undefined && payload.rewardPercent !== ''
      ? Number(payload.rewardPercent)
      : defaultReward;

  await turso.execute({
    sql: `INSERT INTO loan_applications (
            id, qr_token, lender_uid, borrower_name, debtor_id, debtor_address,
            borrower_phone, emergency_phone, requested_amount, currency,
            reward_percent, contract_type, tenor_months, is_installment,
            has_collateral, collateral_desc, collateral_value,
            photo_id, photo_selfie, photo_selfie_id,
            photo_collateral_1, photo_collateral_2,
            notes, status, paid_amount, paid_installments, installment_history, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, '[]', ?)`,
    args: [
      id,
      qrInfo.token,
      qrInfo.lender_uid,
      payload.borrowerName.trim(),
      (payload.debtorId || '').trim(),
      (payload.debtorAddress || '').trim(),
      payload.borrowerPhone.trim(),
      (payload.emergencyPhone || '').trim(),
      Number(payload.requestedAmount) || 0,
      payload.currency || qrInfo.default_currency || 'IDR',
      resolvedRewardPercent,
      resolvedContractType,
      Number(payload.tenorMonths) || 1,
      payload.isInstallment ? 1 : 0,
      isWithCollateral ? 1 : 0,
      isWithCollateral ? (payload.collateralDesc || '').trim() : '',
      isWithCollateral ? Number(payload.collateralValue) || 0 : 0,
      payload.photoId || '',
      payload.photoSelfie || '',
      payload.photoSelfieId || '',
      isWithCollateral ? (payload.photoCollateral1 || '') : '',
      isWithCollateral ? (payload.photoCollateral2 || '') : '',
      (payload.notes || '').trim(),
      nowIso
    ]
  });

  return { id, lenderName: qrInfo.lender_name };
}

/**
 * 6. Ambil daftar pengajuan masuk untuk akun lender yang sedang login
 */
export async function getIncomingApplications(lenderUid, statusFilter = 'pending') {
  if (!lenderUid) return [];
  await ensureApplicationExtraColumns();

  const res =
    statusFilter === 'all'
      ? await turso.execute({
          sql: `SELECT * FROM loan_applications WHERE lender_uid = ? ORDER BY created_at DESC`,
          args: [lenderUid]
        })
      : await turso.execute({
          sql: `SELECT * FROM loan_applications WHERE lender_uid = ? AND status = ? ORDER BY created_at DESC`,
          args: [lenderUid, statusFilter]
        });
  return res.rows;
}

/**
 * 7. Ubah status pengajuan sederhana ('approved' atau 'rejected')
 */
export async function updateApplicationStatus(applicationId, status) {
  await ensureApplicationExtraColumns();
  const nowIso = new Date().toISOString();
  await turso.execute({
    sql: `UPDATE loan_applications SET status = ?, updated_at = ? WHERE id = ?`,
    args: [status, nowIso, applicationId]
  });
}

/**
 * 8. Ambil status pengajuan berdasarkan ID Tiket (untuk halaman publik ?ticket=...)
 */
export async function getLoanApplicationById(applicationId) {
  if (!applicationId) return null;
  await ensureApplicationExtraColumns();
  const res = await turso.execute({
    sql: `SELECT * FROM loan_applications WHERE id = ? LIMIT 1`,
    args: [applicationId.trim()]
  });
  return res.rows?.[0] || null;
}

/**
 * 9. Sistem Lelang & Upgrade Multi-Opsi:
 *    - Lelang Imbalan Jasa (reward_percent)
 *    - Lelang Nominal Pokok Pinjaman (principal_amount — Kontrak 1 & 3)
 *    - Lelang Taksiran Harga Jaminan (collateral_value — Kontrak 3, wajib > pokok pinjaman)
 *    - Upgrade Kontrak 2 -> Kontrak 3 (upgrade_to_collateral — minimal Rp 300rb + 2 foto jaminan)
 */
export async function resubmitLoanCounterOffer(applicationId, newRewardPercent, extraPayload = {}) {
  await ensureApplicationExtraColumns();
  const existing = await getLoanApplicationById(applicationId);
  if (!existing) throw new Error('Tiket pengajuan tidak ditemukan.');

  const nowIso = new Date().toISOString();
  const auctionType = extraPayload?.auctionType || 'reward_percent';

  const resolvedRewardPct =
    extraPayload?.rewardPercent !== undefined
      ? Number(extraPayload.rewardPercent)
      : newRewardPercent !== undefined && newRewardPercent !== null
      ? Number(newRewardPercent)
      : Number(existing.reward_percent ?? 12.5);

  if (auctionType === 'principal_amount') {
    const nextPrincipal = Number(extraPayload.requestedAmount);
    if (isNaN(nextPrincipal) || nextPrincipal <= 0) {
      throw new Error('Nominal pokok pinjaman baru tidak valid.');
    }
    await turso.execute({
      sql: `UPDATE loan_applications
            SET requested_amount = ?,
                reward_percent = ?,
                status = 'pending',
                rejection_reason = NULL,
                updated_at = ?
            WHERE id = ?`,
      args: [nextPrincipal, resolvedRewardPct, nowIso, applicationId]
    });
    return;
  }

  if (auctionType === 'collateral_value') {
    const nextColVal = Number(extraPayload.collateralValue);
    const currentPrincipal = Number(existing.requested_amount || 0);
    if (isNaN(nextColVal) || nextColVal <= currentPrincipal) {
      throw new Error('Taksiran harga jaminan wajib lebih besar dari pokok pinjaman.');
    }
    const nextColDesc =
      extraPayload.collateralDesc !== undefined && extraPayload.collateralDesc !== ''
        ? String(extraPayload.collateralDesc).trim()
        : existing.collateral_desc || '';

    await turso.execute({
      sql: `UPDATE loan_applications
            SET collateral_value = ?,
                collateral_desc = ?,
                status = 'pending',
                rejection_reason = NULL,
                updated_at = ?
            WHERE id = ?`,
      args: [nextColVal, nextColDesc, nowIso, applicationId]
    });
    return;
  }

  if (auctionType === 'upgrade_to_collateral') {
    const nextColVal = Number(extraPayload.collateralValue);
    const currentPrincipal = Number(existing.requested_amount || 0);
    if (isNaN(nextColVal) || nextColVal <= currentPrincipal) {
      throw new Error('Taksiran harga jaminan wajib lebih besar dari pokok pinjaman.');
    }
    const nextColDesc = String(extraPayload.collateralDesc || '').trim();
    const photo1 = extraPayload.photoCollateral1 || '';
    const photo2 = extraPayload.photoCollateral2 || '';
    if (!nextColDesc || !photo1 || !photo2) {
      throw new Error('Deskripsi barang dan 2 foto bukti fisik jaminan wajib dilengkapi.');
    }

    await turso.execute({
      sql: `UPDATE loan_applications
            SET contract_type = 'secured_collateral',
                has_collateral = 1,
                collateral_desc = ?,
                collateral_value = ?,
                photo_collateral_1 = ?,
                photo_collateral_2 = ?,
                status = 'pending',
                rejection_reason = NULL,
                updated_at = ?
            WHERE id = ?`,
      args: [nextColDesc, nextColVal, photo1, photo2, nowIso, applicationId]
    });
    return;
  }

  // Default: Lelang Imbalan Jasa (reward_percent)
  await turso.execute({
    sql: `UPDATE loan_applications
          SET reward_percent = ?,
              status = 'pending',
              rejection_reason = NULL,
              updated_at = ?
          WHERE id = ?`,
    args: [resolvedRewardPct, nowIso, applicationId]
  });
}

/**
 * 10. Kreditur memberi feedback jaminan atau menolak dengan alasan lelang imbalan jasa
 */
export async function updateApplicationFeedback({
  applicationId,
  status, // 'pending' | 'counter_offer' | 'rejected' | 'approved'
  rejectionReason = null,
  collateralFeedback = null
}) {
  await ensureApplicationExtraColumns();
  const nowIso = new Date().toISOString();
  await turso.execute({
    sql: `UPDATE loan_applications
          SET status = COALESCE(?, status),
              rejection_reason = ?,
              collateral_feedback = COALESCE(?, collateral_feedback),
              updated_at = ?
          WHERE id = ?`,
    args: [status, rejectionReason, collateralFeedback, nowIso, applicationId]
  });
}

/**
 * 11. Peminjam melapor sudah transfer cicilan di halaman tiket (tersimpan ke Turso)
 */
export async function submitInstallmentPaymentReport(
  applicationId,
  { installmentNumber, amount, transferMethod, notes = '', proofImage = '' }
) {
  await ensureApplicationExtraColumns();
  const app = await getLoanApplicationById(applicationId);
  if (!app) throw new Error('Tiket pengajuan tidak ditemukan.');

  let history = [];
  try {
    history = JSON.parse(app.installment_history || '[]');
    if (!Array.isArray(history)) history = [];
  } catch {
    history = [];
  }

  const newEntry = {
    id: `PAY-${Date.now()}`,
    installmentNumber: Number(installmentNumber) || 1,
    amount: Number(amount) || 0,
    transferMethod: (transferMethod || '').trim(),
    notes: (notes || '').trim(),
    proofImage: proofImage || '',
    submittedAt: new Date().toISOString(),
    status: 'pending_verification'
  };

  // Ganti laporan pending pada termin yang sama jika peminjam mengirim ulang
  const filtered = history.filter(
    (item) =>
      !(
        Number(item.installmentNumber) === newEntry.installmentNumber &&
        item.status === 'pending_verification'
      )
  );
  const updatedHistory = [newEntry, ...filtered];
  const nowIso = new Date().toISOString();

  await turso.execute({
    sql: `UPDATE loan_applications
          SET installment_history = ?,
              updated_at = ?
          WHERE id = ?`,
    args: [JSON.stringify(updatedHistory), nowIso, applicationId]
  });

  return updatedHistory;
}

/**
 * 12. Kreditur mengonfirmasi cicilan masuk (menambah paid_amount & paid_installments di Turso)
 */
export async function recordVerifiedInstallmentPayment({
  applicationId,
  amountReceived,
  installmentNumber = null,
  note = ''
}) {
  await ensureApplicationExtraColumns();
  const app = await getLoanApplicationById(applicationId);
  if (!app) throw new Error('Tiket pengajuan tidak ditemukan.');

  const principal = Number(app.requested_amount || 0);
  const rewardPct = Number(app.reward_percent ?? 12.5);
  const totalDue = principal + (principal * rewardPct) / 100;
  const tenor = Math.max(1, Number(app.tenor_months || 1));
  const isInstallment = Number(app.is_installment) === 1;
  const installmentCount = isInstallment ? tenor : 1;
  const perTermAmount = totalDue / installmentCount;

  const prevPaid = Number(app.paid_amount || 0);
  const nextPaid = prevPaid + (Number(amountReceived) || 0);
  const nextPaidTerms =
    perTermAmount > 0
      ? Math.min(installmentCount, Math.floor((nextPaid + 0.01) / perTermAmount))
      : 0;

  let history = [];
  try {
    history = JSON.parse(app.installment_history || '[]');
    if (!Array.isArray(history)) history = [];
  } catch {
    history = [];
  }

  const targetTerm = Number(installmentNumber) || Math.min(installmentCount, nextPaidTerms || 1);
  let matchedPending = false;

  const updatedHistory = history.map((item) => {
    if (
      !matchedPending &&
      Number(item.installmentNumber) === targetTerm &&
      item.status === 'pending_verification'
    ) {
      matchedPending = true;
      return {
        ...item,
        status: 'verified',
        verifiedAmount: Number(amountReceived) || item.amount,
        verifiedAt: new Date().toISOString(),
        verifierNote: note
      };
    }
    return item;
  });

  if (!matchedPending) {
    updatedHistory.unshift({
      id: `VER-${Date.now()}`,
      installmentNumber: targetTerm,
      amount: Number(amountReceived) || 0,
      transferMethod: 'Diverifikasi Kreditur',
      notes: note,
      submittedAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
      status: 'verified'
    });
  }

  const nowIso = new Date().toISOString();
  await turso.execute({
    sql: `UPDATE loan_applications
          SET paid_amount = ?,
              paid_installments = ?,
              installment_history = ?,
              updated_at = ?
          WHERE id = ?`,
    args: [nextPaid, nextPaidTerms, JSON.stringify(updatedHistory), nowIso, applicationId]
  });

  return {
    paidAmount: nextPaid,
    paidInstallments: nextPaidTerms,
    installmentHistory: updatedHistory
  };
}

/**
 * 13. Sinkronisasi langsung total terbayar dari catatan hutang-piutang aplikasi utama ke tiket
 */
export async function syncInstallmentStatusFromLoan({
  applicationId,
  totalPaidAmount,
  paidInstallmentsCount
}) {
  if (!applicationId) return;
  await ensureApplicationExtraColumns();
  const nowIso = new Date().toISOString();
  await turso.execute({
    sql: `UPDATE loan_applications
          SET paid_amount = ?,
              paid_installments = ?,
              updated_at = ?
          WHERE id = ?`,
    args: [Number(totalPaidAmount) || 0, Number(paidInstallmentsCount) || 0, nowIso, applicationId]
  });
}
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
- 0. Migrasi aman: Pastikan seluruh kolom tambahan tersedia di tabel loan_applications
 */
let columnsEnsured = false;
export async function ensureApplicationExtraColumns() {
  if (columnsEnsured) return;
  const alters = [
    `ALTER TABLE loan_applications ADD COLUMN reward_percent REAL DEFAULT 12.5`,
    `ALTER TABLE loan_applications ADD COLUMN contract_type TEXT DEFAULT 'secured_collateral'`,
    `ALTER TABLE loan_applications ADD COLUMN collateral_value REAL DEFAULT 0`,
    `ALTER TABLE loan_applications ADD COLUMN counter_principal_amount REAL DEFAULT 0`,
    `ALTER TABLE loan_applications ADD COLUMN principal_add_requests INTEGER DEFAULT 0`,
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
- 1. Ambil QR Link aktif milik user, atau buat baru jika belum ada
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
- 2. Update pengaturan QR Link (nama default, mata uang, mode mikro, status aktif)
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
- 3. Buat ulang token baru (jika link lama bocor/ingin diganti)
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
- 4. Validasi token saat calon peminjam membuka link /apply?token=...
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
- 5. Kirim pengajuan pinjaman lengkap dari form publik ke akun lender terkait
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
- 6. Ambil daftar pengajuan masuk untuk akun lender yang sedang login
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
- 7. Ubah status pengajuan sederhana ('approved' atau 'rejected')
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
- 8. Ambil status pengajuan berdasarkan ID Tiket (untuk halaman publik ?ticket=...)
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
- 9. Sistem Lelang, Persetujuan Tenor & Upgrade Multi-Opsi:
-    - Persetujuan Tenor Final (accept_tenor_offer -> 'borrower_agreed' / reject_tenor_offer -> 'rejected')
-    - Lelang Imbalan Jasa (reward_percent)
-    - Lelang Nominal Pokok Pinjaman (principal_amount)
-    - Respon Tawaran Pokok Kreditur (accept_revised_principal / reject_revised_principal / request_add_principal maks 5x)
-    - Update Rincian Jaminan (collateral_value)
-    - Upgrade Kontrak 2 -> Kontrak 3 (upgrade_to_collateral)
-    - Upload Bukti Drop Jaminan (collateral_drop_proof)
 */
export async function resubmitLoanCounterOffer(
  applicationId,
  newRewardPercent,
  extraPayload = {}
) {
  await ensureApplicationExtraColumns();
  const existing = await getLoanApplicationById(applicationId);
  if (!existing) throw new Error('Tiket pengajuan tidak ditemukan.');

  const nowIso = new Date().toISOString();
  const auctionType = extraPayload.auctionType || 'reward_percent';
  const resolvedRewardPct =
    newRewardPercent !== undefined && newRewardPercent !== null && newRewardPercent !== ''
      ? Number(newRewardPercent)
      : Number(existing.reward_percent ?? 12.5);

  if (auctionType === 'accept_tenor_offer') {
    const agreedTenor = Math.max(
      1,
      Number(extraPayload.tenorMonths || existing.tenor_months || 1)
    );
    await turso.execute({
      sql: `UPDATE loan_applications
            SET tenor_months = ?,
                status = 'borrower_agreed',
                rejection_reason = ?,
                updated_at = ?
            WHERE id = ?`,
      args: [
        agreedTenor,
        `Debitur menyetujui ketentuan tenor final (${agreedTenor} bulan).`,
        nowIso,
        applicationId
      ]
    });
    return { tenorMonths: agreedTenor, status: 'borrower_agreed' };
  }

  if (auctionType === 'reject_tenor_offer') {
    const rejectedTenor = Math.max(
      1,
      Number(extraPayload.tenorMonths || existing.tenor_months || 1)
    );
    await turso.execute({
      sql: `UPDATE loan_applications
            SET status = 'rejected',
                rejection_reason = ?,
                updated_at = ?
            WHERE id = ?`,
      args: [
        `Debitur menolak ketentuan tenor final (${rejectedTenor} bulan).`,
        nowIso,
        applicationId
      ]
    });
    return { status: 'rejected' };
  }

  if (auctionType === 'request_add_principal') {
    const currentAddCount = Number(existing.principal_add_requests || 0);
    if (currentAddCount >= 5) {
      throw new Error('Kesempatan Minta Tambah sudah habis (maksimal 5x). Silakan pilih Oke atau Tolak.');
    }
    const nextAddCount = currentAddCount + 1;
    const prevNote = existing.rejection_reason ? `${existing.rejection_reason} | ` : '';
    const updatedNote = `${prevNote}Debitur meminta tambah nominal pokok (pengajuan #${nextAddCount}/5).`;

    await turso.execute({
      sql: `UPDATE loan_applications
            SET principal_add_requests = ?,
                status = 'pending',
                rejection_reason = ?,
                updated_at = ?
            WHERE id = ?`,
      args: [nextAddCount, updatedNote, nowIso, applicationId]
    });
    return { principalAddRequests: nextAddCount };
  }

  if (auctionType === 'accept_revised_principal') {
    const revisedAmt = Number(
      extraPayload.requestedAmount ||
        existing.counter_principal_amount ||
        existing.requested_amount ||
        0
    );
    await turso.execute({
      sql: `UPDATE loan_applications
            SET requested_amount = ?,
                counter_principal_amount = 0,
                status = 'pending',
                rejection_reason = 'Debitur menyetujui (Oke) nominal pokok penawaran.',
                updated_at = ?
            WHERE id = ?`,
      args: [revisedAmt, nowIso, applicationId]
    });
    return;
  }

  if (auctionType === 'reject_revised_principal') {
    await turso.execute({
      sql: `UPDATE loan_applications
            SET status = 'counter_offer',
                rejection_reason = 'Debitur menolak nominal pokok penawaran.',
                updated_at = ?
            WHERE id = ?`,
      args: [nowIso, applicationId]
    });
    return;
  }

  if (auctionType === 'principal_amount') {
    const nextPrincipal = Number(extraPayload.requestedAmount);
    if (isNaN(nextPrincipal) || nextPrincipal <= 0) {
      throw new Error('Nominal pokok pinjaman baru tidak valid.');
    }
    await turso.execute({
      sql: `UPDATE loan_applications
            SET requested_amount = ?,
                counter_principal_amount = 0,
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
    const nextDesc = (extraPayload.collateralDesc || existing.collateral_desc || '').trim();
    await turso.execute({
      sql: `UPDATE loan_applications
            SET collateral_desc = ?,
                status = 'pending',
                rejection_reason = NULL,
                updated_at = ?
            WHERE id = ?`,
      args: [nextDesc, nowIso, applicationId]
    });
    return;
  }

  if (auctionType === 'upgrade_to_collateral') {
    const nextDesc = (extraPayload.collateralDesc || '').trim();
    if (!nextDesc) {
      throw new Error('Rincian barang jaminan wajib diisi.');
    }
    if (!extraPayload.photoCollateral1 || !extraPayload.photoCollateral2) {
      throw new Error('Kedua foto bukti barang jaminan wajib dilampirkan.');
    }
    await turso.execute({
      sql: `UPDATE loan_applications
            SET contract_type = 'secured_collateral',
                has_collateral = 1,
                collateral_desc = ?,
                photo_collateral_1 = ?,
                photo_collateral_2 = ?,
                status = 'pending',
                rejection_reason = NULL,
                updated_at = ?
            WHERE id = ?`,
      args: [
        nextDesc,
        extraPayload.photoCollateral1,
        extraPayload.photoCollateral2,
        nowIso,
        applicationId
      ]
    });
    return;
  }

  if (auctionType === 'collateral_drop_proof') {
    const dropNote = (extraPayload.collateralDropProofNote || '').trim();
    const prevFeedback = existing.collateral_feedback ? `${existing.collateral_feedback}\n` : '';
    const nextFeedback = `${prevFeedback}[BUKTI DROP DIKIRIM DEBITUR${dropNote ? `: ${dropNote}` : ''}]`;

    await turso.execute({
      sql: `UPDATE loan_applications
            SET collateral_feedback = ?,
                photo_collateral_2 = COALESCE(NULLIF(?, ''), photo_collateral_2),
                updated_at = ?
            WHERE id = ?`,
      args: [nextFeedback, extraPayload.collateralDropProofPhoto || '', nowIso, applicationId]
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
- 10. Kreditur memberi feedback jaminan, lelang pokok, tenor final, atau menolak dengan alasan lelang imbalan jasa
 */
export async function updateApplicationFeedback({
  applicationId,
  status, // 'pending' | 'counter_offer' | 'tenor_offer' | 'borrower_agreed' | 'rejected' | 'approved'
  rejectionReason = null,
  collateralFeedback = null,
  counterPrincipalAmount = null,
  approvedTenorMonths = null
}) {
  await ensureApplicationExtraColumns();
  const nowIso = new Date().toISOString();
  const resolvedTenor =
    approvedTenorMonths !== null &&
    approvedTenorMonths !== undefined &&
    Number(approvedTenorMonths) > 0
      ? Number(approvedTenorMonths)
      : null;

  await turso.execute({
    sql: `UPDATE loan_applications
          SET status = COALESCE(?, status),
              tenor_months = COALESCE(?, tenor_months),
              rejection_reason = ?,
              collateral_feedback = COALESCE(?, collateral_feedback),
              counter_principal_amount = COALESCE(?, counter_principal_amount),
              updated_at = ?
          WHERE id = ?`,
    args: [
      status,
      resolvedTenor,
      rejectionReason,
      collateralFeedback,
      counterPrincipalAmount,
      nowIso,
      applicationId
    ]
  });
}

/**
- 11. Peminjam melapor sudah transfer cicilan di halaman tiket (tersimpan ke Turso)
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
- 12. Kreditur mengonfirmasi cicilan masuk (menambah paid_amount & paid_installments di Turso)
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
- 13. Sinkronisasi langsung total terbayar dari catatan hutang-piutang aplikasi utama ke tiket
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
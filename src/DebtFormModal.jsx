import React, { useState, useEffect } from 'react';
import {
  FileText, User, UserCheck, IdCard, MapPin, Gift, AlertTriangle,
  Phone, CreditCard, Percent, Fingerprint, PenTool, X, Camera
} from 'lucide-react';
import { convertCurrencyDynamic, getCurrencySymbolDynamic } from './lib/currencyService';
import ContractClauseBuilder from './ContractClauseBuilder';

export default function DebtFormModal({
  language = 'id',
  isOpen,
  onClose,
  onSubmitDebt,
  initialData = null,
  managerCurrency,
  liveRates,
  categories,
  loanTypes,
  currenciesList,
  themeStyle,
  isDarkMode,
  modalBg,
  bgInnerBox,
  inputBg,
  t
}) {
  const [name, setName] = useState('');
  const [lenderName, setLenderName] = useState('');
  const [debtorIdNo, setDebtorIdNo] = useState('');
  const [creditorIdNo, setCreditorIdNo] = useState('');
  const [debtorAddress, setDebtorAddress] = useState('');

  const [category, setCategory] = useState(categories[0] || '');
  const [type, setType] = useState(loanTypes[0] || '');
  const [amount, setAmount] = useState('');
  const [bonusPercent, setBonusPercent] = useState('0');
  const [bonusType, setBonusType] = useState('bonus');
  const [lateFeeMode, setLateFeeMode] = useState('auto');
  const [lateFeePercent, setLateFeePercent] = useState('0');
  const [debtCurrency, setDebtCurrency] = useState(managerCurrency);
  const [borrowerPhone, setBorrowerPhone] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [collateral, setCollateral] = useState(false);
  const [collateralDesc, setCollateralDesc] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [statusKey, setStatusKey] = useState('active');
  const [image, setImage] = useState(null);

  // State Cap Sidik Jari & Tanda Tangan
  const [creditorFingerprint, setCreditorFingerprint] = useState(null);
  const [creditorSignature, setCreditorSignature] = useState(null);
  const [debtorFingerprint, setDebtorFingerprint] = useState(null);
  const [debtorSignature, setDebtorSignature] = useState(null);

  // 7 State Foto Halaman 4
  const [photoIdDebtor, setPhotoIdDebtor] = useState('');
  const [photoSelfieDebtor, setPhotoSelfieDebtor] = useState('');
  const [photoSelfieIdDebtor, setPhotoSelfieIdDebtor] = useState('');
  const [photoCollateral1, setPhotoCollateral1] = useState('');
  const [photoCollateral2, setPhotoCollateral2] = useState('');
  const [photoEtc1, setPhotoEtc1] = useState('');
  const [photoEtc2, setPhotoEtc2] = useState('');

  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState('3');
  const [paidInstallments, setPaidInstallments] = useState('0');
  const [paymentMethodKey, setPaymentMethodKey] = useState('transfer');
  const [paymentAccountInfo, setPaymentAccountInfo] = useState('');
  const [customClauses, setCustomClauses] = useState([]);

  const formatLocalDateStr = (dateObj) => {
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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

  const syncDueDateWithInstallments = (baseStartDate, countVal) => {
    const months = parseInt(countVal, 10);
    if (!baseStartDate || isNaN(months) || months < 1) return;
    const targetDate = addMonthsSafely(baseStartDate, months);
    if (targetDate) {
      setDueDate(formatLocalDateStr(targetDate));
    }
  };

  // Sinkronisasi state form setiap kali modal dibuka (Tambah Baru / Edit / ACC dari QR)
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setName(initialData.name || '');
      setLenderName(initialData.lenderName || '');
      setDebtorIdNo(initialData.debtorIdNo || '');
      setCreditorIdNo(initialData.creditorIdNo || '');
      setDebtorAddress(initialData.debtorAddress || '');
      setCategory(initialData.category || categories[0] || '');
      setType(initialData.type || loanTypes[0] || '');
      setAmount(
        initialData.principalAmount
          ? String(initialData.principalAmount)
          : initialData.amount
          ? String(initialData.amount)
          : ''
      );
      setBonusPercent(String(initialData.bonusPercent ?? 0));
      setBonusType(initialData.bonusType || 'bonus');
      setLateFeeMode(
        initialData.lateFeeMode || (Number(initialData.lateFeePercent) > 0 ? 'manual' : 'auto')
      );
      setLateFeePercent(String(initialData.lateFeePercent ?? 0));
      setDebtCurrency(initialData.currency || managerCurrency);
      setBorrowerPhone(initialData.borrowerPhone || '');
      setEmergencyPhone(initialData.emergencyPhone || '');
      setCollateral(Boolean(initialData.collateral));
      setCollateralDesc(initialData.collateralDesc || '');
      setStartDate(initialData.startDate || formatLocalDateStr(new Date()));
      setDueDate(initialData.dueDate || '');
      setStatusKey(initialData.statusKey || (initialData.status === 'Lunas' ? 'paid' : 'active'));
      setImage(initialData.image || null);
      setCreditorFingerprint(initialData.creditorFingerprint || null);
      setCreditorSignature(initialData.creditorSignature || null);
      setDebtorFingerprint(initialData.debtorFingerprint || null);
      setDebtorSignature(initialData.debtorSignature || null);
      setPhotoIdDebtor(initialData.photoIdDebtor || '');
      setPhotoSelfieDebtor(initialData.photoSelfieDebtor || '');
      setPhotoSelfieIdDebtor(initialData.photoSelfieIdDebtor || '');
      setPhotoCollateral1(initialData.photoCollateral1 || '');
      setPhotoCollateral2(initialData.photoCollateral2 || '');
      setPhotoEtc1(initialData.photoEtc1 || '');
      setPhotoEtc2(initialData.photoEtc2 || '');
      setIsInstallment(Boolean(initialData.isInstallment));
      setInstallmentCount(initialData.installmentCount ? String(initialData.installmentCount) : '3');
      setPaidInstallments(initialData.paidInstallments ? String(initialData.paidInstallments) : '0');
      setPaymentMethodKey(initialData.paymentMethodKey || 'transfer');
      setPaymentAccountInfo(initialData.paymentAccountInfo || '');
      setCustomClauses(Array.isArray(initialData.customClauses) ? initialData.customClauses : []);
    } else {
      setName('');
      setLenderName('');
      setDebtorIdNo('');
      setCreditorIdNo('');
      setDebtorAddress('');
      setCategory(categories[0] || '');
      setType(loanTypes[0] || '');
      setAmount('');
      setBonusPercent('0');
      setBonusType('bonus');
      setLateFeeMode('auto');
      setLateFeePercent('0');
      setDebtCurrency(managerCurrency);
      setBorrowerPhone('');
      setEmergencyPhone('');
      setCollateral(false);
      setCollateralDesc('');
      setStartDate(formatLocalDateStr(new Date()));
      setDueDate('');
      setStatusKey('active');
      setImage(null);
      setCreditorFingerprint(null);
      setCreditorSignature(null);
      setDebtorFingerprint(null);
      setDebtorSignature(null);
      setPhotoIdDebtor('');
      setPhotoSelfieDebtor('');
      setPhotoSelfieIdDebtor('');
      setPhotoCollateral1('');
      setPhotoCollateral2('');
      setPhotoEtc1('');
      setPhotoEtc2('');
      setIsInstallment(false);
      setInstallmentCount('3');
      setPaidInstallments('0');
      setPaymentMethodKey('transfer');
      setPaymentAccountInfo('');
      setCustomClauses([]);
    }
  }, [isOpen, initialData, categories, loanTypes, managerCurrency]);

  if (!isOpen) return null;

  const isEditing = Boolean(initialData?.id);

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

  const compressImageFile = (file, maxDim = 800, format = 'image/jpeg', quality = 0.72) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL(format, quality));
        };
        img.onerror = () => resolve(event.target.result);
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const compressDocPhoto = (file, maxWidth = 900, quality = 0.72) => {
    return new Promise((resolve) => {
      if (!file) return resolve('');
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
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
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(ev.target.result || '');
        img.src = ev.target.result;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handlePage4PhotoUpload = async (e, setter, isPortrait4x6 = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressDocPhoto(file, isPortrait4x6 ? 650 : 950, 0.72);
    setter(compressed);
    e.target.value = '';
  };

  const handleImageCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const compressed = await compressImageFile(file, 800, 'image/jpeg', 0.72);
    setImage(compressed);
  };

  const handleAuthAssetUpload = async (e, setter) => {
    const file = e.target.files[0];
    if (!file) return;
    const compressed = await compressImageFile(file, 320, 'image/png', 0.85);
    setter(compressed);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!name || !amount) {
      alert(t.fillRequired);
      return;
    }

    onSubmitDebt({
      id: initialData?.id || null,
      qrApplicationId: initialData?.qrApplicationId || '',
      name,
      lenderName,
      debtorIdNo,
      creditorIdNo,
      debtorAddress,
      category,
      type,
      amount,
      bonusPercent,
      bonusType,
      lateFeeMode,
      lateFeePercent,
      debtCurrency,
      borrowerPhone,
      emergencyPhone,
      collateral,
      collateralDesc,
      startDate,
      dueDate,
      statusKey,
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
      installmentCount,
      paidInstallments,
      paymentMethodKey,
      paymentAccountInfo,
      customClauses
    });
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 pb-24 sm:pb-6 overflow-y-auto">
      <div className={`border rounded-2xl w-full max-w-2xl p-5 sm:p-6 shadow-2xl my-auto max-h-[82vh] overflow-y-auto ${modalBg}`}>
        <h2 className={`text-xl sm:text-2xl font-bold mb-5 flex items-center gap-2 ${themeStyle.textAccent}`}>
          <FileText className="w-6 h-6" /> {isEditing ? t.modalTitleEdit : t.modalTitleAdd}
        </h2>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> {t.nameLabel} *
              </label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> {t.lenderNameLabel}
              </label>
              <input type="text" value={lenderName} onChange={(e) => setLenderName(e.target.value)} className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <IdCard className="w-3.5 h-3.5 text-sky-400" /> {t.debtorIdLabel}
              </label>
              <input type="text" value={debtorIdNo} onChange={(e) => setDebtorIdNo(e.target.value)} className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <IdCard className="w-3.5 h-3.5 text-amber-400" /> {t.creditorIdLabel}
              </label>
              <input type="text" value={creditorIdNo} onChange={(e) => setCreditorIdNo(e.target.value)} className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-400" /> {t.debtorAddressLabel}
              </label>
              <textarea
                rows={2}
                placeholder={t.debtorAddressPlaceholder}
                value={debtorAddress}
                onChange={(e) => setDebtorAddress(e.target.value)}
                className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">{t.currLabel}</label>
              <select value={debtCurrency} onChange={(e) => setDebtCurrency(e.target.value)} className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`}>
                {currenciesList.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>

            {(() => {
              const modalLimits = getContractLimits({
                isMicro: lateFeeMode === 'micro',
                hasCollateral: collateral,
                currencyCode: debtCurrency
              });
              return (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                    <label className="text-xs font-semibold text-slate-400">{t.loanAmount} *</label>
                    <span className="text-[11px] font-bold text-emerald-400">
                      Maks: {modalLimits.cleanCurr} {formatNumberWithSeparator(modalLimits.maxVal)}
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={formatNumberWithSeparator(amount)}
                    onChange={(e) => {
                      const rawDigits = e.target.value.replace(/\D/g, '');
                      const clamped = clampContractAmount(rawDigits, modalLimits);
                      setAmount(clamped);
                    }}
                    className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {modalLimits.contractLabel}: Min {modalLimits.cleanCurr} {formatNumberWithSeparator(modalLimits.minVal)} – Maks {modalLimits.cleanCurr} {formatNumberWithSeparator(modalLimits.maxVal)}
                  </p>
                </div>
              );
            })()}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                  <Gift className="w-3.5 h-3.5 text-amber-400" /> {t.bonusPercentage} (Maks 20%)
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400">{t.selectRewardType}</span>
                  <button
                    type="button"
                    onClick={() => setBonusType('bonus')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${bonusType === 'bonus' ? `${themeStyle.bgAccent} text-white` : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
                    {t.bonusText}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBonusType('interest')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${bonusType === 'interest' ? `${themeStyle.bgAccent} text-white` : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
                    {t.interestText}
                  </button>
                </div>
              </div>

              <input
                type="number"
                min="0"
                max="20"
                step="0.1"
                value={bonusPercent}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (isNaN(val)) {
                    setBonusPercent('');
                  } else {
                    setBonusPercent(String(Math.min(Math.max(val, 0), 20)));
                  }
                }}
                className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`}
              />

              {amount && parseFloat(bonusPercent) > 0 && (
                <span className="text-[11px] text-emerald-400 mt-1 block font-medium">
                  {t.totalPlusLabel} {bonusType === 'interest' ? t.interestText : t.bonusText}: {getCurrencySymbolDynamic(debtCurrency)} {(parseFloat(amount) + (parseFloat(amount) * (parseFloat(bonusPercent) / 100))).toLocaleString()}
                </span>
              )}
            </div>

            {/* SKEMA DENDA KETERLAMBATAN */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> {t.lateFeeModeLabel}
              </label>
              <div className="flex gap-1.5 mb-1.5">
                <button
                  type="button"
                  onClick={() => setLateFeeMode('auto')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold border transition ${lateFeeMode === 'auto' ? `${themeStyle.bgAccent} text-white border-transparent` : isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                  {t.lateFeeModeAuto}
                </button>
                <button
                  type="button"
                  onClick={() => setLateFeeMode('manual')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold border transition ${lateFeeMode === 'manual' ? `${themeStyle.bgAccent} text-white border-transparent` : isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                  {t.lateFeeModeManual}
                </button>
              </div>

              {lateFeeMode === 'manual' ? (
                <>
                  <input type="number" min="0" step="0.5" value={lateFeePercent} onChange={(e) => setLateFeePercent(e.target.value)} className={`w-full rounded-xl p-2 text-sm border ${inputBg}`} placeholder="%" />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">{t.lateFeeSub}</span>
                </>
              ) : lateFeeMode === 'micro' ? (
                <div className={`p-2 rounded-lg border text-[10px] leading-relaxed ${isDarkMode ? 'bg-emerald-950/30 border-emerald-800/70 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                  <div>• {t.microLoanToggleLabel}</div>
                  <div>• {t.lateFeeSub} (Maks 32,5%)</div>
                </div>
              ) : (
                <div className={`p-2 rounded-lg border text-[10px] leading-relaxed ${isDarkMode ? 'bg-slate-800/70 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'}`}>
                  <div>• {t.lateFeeTierADesc}</div>
                  <div>• {t.lateFeeTierBDesc}</div>
                </div>
              )}
            </div>

            {/* TOGGLE PAKET PINJAMAN MIKRO KHUSUS */}
            <div className="md:col-span-2">
              <div className={`p-3 rounded-xl border ${lateFeeMode === 'micro' ? (isDarkMode ? 'bg-emerald-950/25 border-emerald-700' : 'bg-emerald-50 border-emerald-300') : bgInnerBox}`}>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lateFeeMode === 'micro'}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setLateFeeMode('micro');
                        setCollateral(false);
                        setCollateralDesc('');
                        const microLimits = getContractLimits({ isMicro: true, hasCollateral: false, currencyCode: debtCurrency });
                        if (amount) {
                          setAmount(clampContractAmount(String(amount).replace(/\D/g, ''), microLimits));
                        }
                      } else {
                        setLateFeeMode('auto');
                      }
                    }}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                  <span className="text-xs font-bold text-emerald-400">
                    {t.microLoanToggleLabel}
                  </span>
                </label>
                <p className="text-[11px] text-slate-400 mt-1 pl-6">
                  {t.microLoanToggleHint}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> {t.borrowerPhone}
              </label>
              <input type="tel" value={borrowerPhone} onChange={(e) => setBorrowerPhone(e.target.value)} className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-emerald-400" /> {t.emergencyPhone}
              </label>
              <input type="tel" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">{t.categoryLabel}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`}>
                {categories.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">{t.loanType}</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`}>
                {loanTypes.map((lt, i) => <option key={i} value={lt}>{lt}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">{t.datePinjam}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  const newStart = e.target.value;
                  setStartDate(newStart);
                  if (isInstallment) {
                    syncDueDateWithInstallments(newStart, installmentCount);
                  }
                }}
                className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">{t.dateTempo}</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">{t.payMethod}</label>
              <select value={paymentMethodKey} onChange={(e) => setPaymentMethodKey(e.target.value)} className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`}>
                <option value="transfer">{t.methods.transfer}</option>
                <option value="ewallet">{t.methods.ewallet}</option>
                <option value="cash">{t.methods.cash}</option>
                <option value="flexible">{t.methods.flexible}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">{t.status}</label>
              <select value={statusKey} onChange={(e) => setStatusKey(e.target.value)} className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`}>
                <option value="active">{t.statusOptions.active}</option>
                <option value="dueSoon">{t.statusOptions.dueSoon}</option>
                <option value="paid">{t.statusOptions.paid}</option>
              </select>
            </div>

            {paymentMethodKey !== 'cash' && (
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-sky-400" /> {t.payAccountLabel}
                </label>
                <input
                  type="text"
                  placeholder={t.payAccountPlaceholder}
                  value={paymentAccountInfo}
                  onChange={(e) => setPaymentAccountInfo(e.target.value)}
                  className={`w-full rounded-xl p-2.5 text-sm border ${inputBg}`}
                />
              </div>
            )}
          </div>

          {/* Installment Mode */}
          <div className={`p-3.5 rounded-xl border ${bgInnerBox}`}>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={isInstallment}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsInstallment(checked);
                  if (checked) {
                    syncDueDateWithInstallments(startDate, installmentCount);
                  }
                }}
                className="w-4 h-4 accent-amber-500 rounded"
              />
              <span className={`text-sm font-bold flex items-center gap-1.5 ${themeStyle.textAccent}`}>
                <Percent className="w-4 h-4" /> {t.installmentMode}
              </span>
            </label>

            {isInstallment && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-800">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t.installmentCount}</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={installmentCount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInstallmentCount(val);
                      syncDueDateWithInstallments(startDate, val);
                    }}
                    className={`w-full rounded-xl p-2 text-sm border ${inputBg}`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t.paidInstallments}</label>
                  <input
                    type="number"
                    min="0"
                    max={installmentCount}
                    value={paidInstallments}
                    onChange={(e) => setPaidInstallments(e.target.value)}
                    className={`w-full rounded-xl p-2 text-sm border ${inputBg}`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Builder Pasal-Pasal Perjanjian Kustom */}
          <ContractClauseBuilder
            language={language}
            clauses={customClauses}
            onChangeClauses={setCustomClauses}
            boxClass={bgInnerBox}
            inputBg={inputBg}
            buttonClass={`bg-gradient-to-r ${themeStyle.gradientBtn} text-white shadow`}
            isDarkMode={isDarkMode}
          />

          {/* Collateral Section */}
          <div className={`p-3.5 rounded-xl border ${bgInnerBox}`}>
            <label className="flex items-center gap-2 cursor-pointer mb-1.5">
              <input
                type="checkbox"
                checked={collateral}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setCollateral(checked);
                  if (checked && lateFeeMode === 'micro') {
                    setLateFeeMode('auto');
                  }
                  const nextLimits = getContractLimits({
                    isMicro: !checked && lateFeeMode === 'micro',
                    hasCollateral: checked,
                    currencyCode: debtCurrency
                  });
                  if (amount) {
                    setAmount(clampContractAmount(String(amount).replace(/\D/g, ''), nextLimits));
                  }
                }}
                className="w-4 h-4 accent-amber-500 rounded"
              />
              <span className="text-sm font-semibold">{t.hasCollateral}</span>
            </label>

            <p className={`text-[11px] mb-2 pl-6 ${collateral ? 'text-amber-400' : 'text-sky-400'}`}>
              {collateral ? t.collateralTemplateHintWith : t.collateralTemplateHintWithout}
            </p>

            {collateral && (
              <input type="text" placeholder={t.collateralDesc} value={collateralDesc} onChange={(e) => setCollateralDesc(e.target.value)} className={`w-full rounded-xl p-2.5 text-sm border mt-1 ${inputBg}`} />
            )}
          </div>

          {/* Lampiran Tanda Tangan & Cap Sidik Jari */}
          <div className={`p-3.5 rounded-xl border ${bgInnerBox}`}>
            <label className={`block text-xs font-bold mb-2.5 flex items-center gap-1.5 ${themeStyle.textAccent}`}>
              <Fingerprint className="w-4 h-4" /> {t.authAssetsTitle}
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">{t.creditorFingerprintLabel}</span>
                <div className="flex items-center gap-2">
                  <label className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border flex items-center gap-1 transition ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'}`}>
                    <Fingerprint className="w-3.5 h-3.5 text-emerald-400" /> {t.uploadImgBtn}
                    <input type="file" accept="image/*" onChange={(e) => handleAuthAssetUpload(e, setCreditorFingerprint)} className="hidden" />
                  </label>
                  {creditorFingerprint && (
                    <div className="flex items-center gap-1.5">
                      <img src={creditorFingerprint} alt="Creditor FP" className="w-8 h-8 object-contain rounded border border-slate-600 bg-white" />
                      <button type="button" onClick={() => setCreditorFingerprint(null)} className="text-rose-400 hover:text-rose-300 p-1"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              </div>

              <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">{t.creditorSignatureLabel}</span>
                <div className="flex items-center gap-2">
                  <label className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border flex items-center gap-1 transition ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'}`}>
                    <PenTool className="w-3.5 h-3.5 text-sky-400" /> {t.uploadImgBtn}
                    <input type="file" accept="image/*" onChange={(e) => handleAuthAssetUpload(e, setCreditorSignature)} className="hidden" />
                  </label>
                  {creditorSignature && (
                    <div className="flex items-center gap-1.5">
                      <img src={creditorSignature} alt="Creditor Sign" className="w-12 h-8 object-contain rounded border border-slate-600 bg-white" />
                      <button type="button" onClick={() => setCreditorSignature(null)} className="text-rose-400 hover:text-rose-300 p-1"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              </div>

              <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">{t.debtorFingerprintLabel}</span>
                <div className="flex items-center gap-2">
                  <label className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border flex items-center gap-1 transition ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'}`}>
                    <Fingerprint className="w-3.5 h-3.5 text-emerald-400" /> {t.uploadImgBtn}
                    <input type="file" accept="image/*" onChange={(e) => handleAuthAssetUpload(e, setDebtorFingerprint)} className="hidden" />
                  </label>
                  {debtorFingerprint && (
                    <div className="flex items-center gap-1.5">
                      <img src={debtorFingerprint} alt="Debtor FP" className="w-8 h-8 object-contain rounded border border-slate-600 bg-white" />
                      <button type="button" onClick={() => setDebtorFingerprint(null)} className="text-rose-400 hover:text-rose-300 p-1"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              </div>

              <div className={`p-2.5 rounded-xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">{t.debtorSignatureLabel}</span>
                <div className="flex items-center gap-2">
                  <label className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border flex items-center gap-1 transition ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'}`}>
                    <PenTool className="w-3.5 h-3.5 text-sky-400" /> {t.uploadImgBtn}
                    <input type="file" accept="image/*" onChange={(e) => handleAuthAssetUpload(e, setDebtorSignature)} className="hidden" />
                  </label>
                  {debtorSignature && (
                    <div className="flex items-center gap-1.5">
                      <img src={debtorSignature} alt="Debtor Sign" className="w-12 h-8 object-contain rounded border border-slate-600 bg-white" />
                      <button type="button" onClick={() => setDebtorSignature(null)} className="text-rose-400 hover:text-rose-300 p-1"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Camera / Proof */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">{t.cameraLabel}</label>
            <div className="flex items-center gap-3">
              <label className={`px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer border flex items-center gap-2 transition ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'}`}>
                <Camera className={`w-5 h-5 ${themeStyle.textAccent}`} /> {t.takePhoto}
                <input type="file" accept="image/*" onChange={handleImageCapture} className="hidden" />
              </label>
              {image && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-400 font-semibold">{t.photoAttached}</span>
                  <button type="button" onClick={() => setImage(null)} className="text-rose-400 hover:text-rose-300 p-1"><X className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          </div>

          {/* Lampiran 7 Foto Verifikasi Debitur, Jaminan & Etc (Halaman 4 Cetak) */}
          <div className="mt-4 pt-4 border-t border-slate-700/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Camera className="w-4 h-4" /> {t.contract.page4Header} (7 Foto)
              </span>
              <span className="text-[11px] text-slate-400">4x6 & 2R</span>
            </div>

            <p className="text-[11px] font-semibold text-slate-300 mb-1.5">{t.contract.page4Sec1Title}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
              {[
                { label: t.contract.photoSlotIdDebtor, val: photoIdDebtor, set: setPhotoIdDebtor },
                { label: t.contract.photoSlotSelfieDebtor, val: photoSelfieDebtor, set: setPhotoSelfieDebtor },
                { label: t.contract.photoSlotSelfieIdDebtor, val: photoSelfieIdDebtor, set: setPhotoSelfieIdDebtor }
              ].map((slot, i) => (
                <div key={i} className={`p-2 rounded-xl border ${bgInnerBox}`}>
                  <span className="block text-[11px] font-medium text-slate-300 mb-1.5 truncate" title={slot.label}>
                    {slot.label}
                  </span>
                  {slot.val ? (
                    <div className="relative group">
                      <img src={slot.val} alt={slot.label} className="w-full h-24 object-cover rounded-lg border border-slate-600" />
                      <button
                        type="button"
                        onClick={() => slot.set('')}
                        className="absolute top-1 right-1 bg-rose-600 text-white p-1 rounded-full shadow"
                        title="Hapus foto"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-20 border border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-amber-400 transition text-slate-400 hover:text-amber-300 text-[11px]">
                      <Camera className="w-4 h-4 mb-1" />
                      <span>{t.uploadImgBtn}</span>
                      <input type="file" accept="image/*" onChange={(e) => handlePage4PhotoUpload(e, slot.set, true)} className="hidden" />
                    </label>
                  )}
                </div>
              ))}
            </div>

            <p className="text-[11px] font-semibold text-slate-300 mb-1.5">{t.contract.page4Sec2Title}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
              {[
                { label: collateral ? t.contract.photoSlotCollateral1 : t.contract.photoSlotHandover1, val: photoCollateral1, set: setPhotoCollateral1 },
                { label: collateral ? t.contract.photoSlotCollateral2 : t.contract.photoSlotHandover2, val: photoCollateral2, set: setPhotoCollateral2 }
              ].map((slot, i) => (
                <div key={i} className={`p-2 rounded-xl border ${bgInnerBox}`}>
                  <span className="block text-[11px] font-medium text-slate-300 mb-1.5 truncate" title={slot.label}>
                    {slot.label}
                  </span>
                  {slot.val ? (
                    <div className="relative">
                      <img src={slot.val} alt={slot.label} className="w-full h-24 object-cover rounded-lg border border-slate-600" />
                      <button
                        type="button"
                        onClick={() => slot.set('')}
                        className="absolute top-1 right-1 bg-rose-600 text-white p-1 rounded-full shadow"
                        title="Hapus foto"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-20 border border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-amber-400 transition text-slate-400 hover:text-amber-300 text-[11px]">
                      <Camera className="w-4 h-4 mb-1" />
                      <span>{t.uploadImgBtn}</span>
                      <input type="file" accept="image/*" onChange={(e) => handlePage4PhotoUpload(e, slot.set, false)} className="hidden" />
                    </label>
                  )}
                </div>
              ))}
            </div>

            <p className="text-[11px] font-semibold text-slate-300 mb-1.5">{t.contract.page4Sec3Title}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { label: t.contract.photoSlotEtc1, val: photoEtc1, set: setPhotoEtc1 },
                { label: t.contract.photoSlotEtc2, val: photoEtc2, set: setPhotoEtc2 }
              ].map((slot, i) => (
                <div key={i} className={`p-2 rounded-xl border ${bgInnerBox}`}>
                  <span className="block text-[11px] font-medium text-slate-300 mb-1.5 truncate" title={slot.label}>
                    {slot.label}
                  </span>
                  {slot.val ? (
                    <div className="relative">
                      <img src={slot.val} alt={slot.label} className="w-full h-24 object-cover rounded-lg border border-slate-600" />
                      <button
                        type="button"
                        onClick={() => slot.set('')}
                        className="absolute top-1 right-1 bg-rose-600 text-white p-1 rounded-full shadow"
                        title="Hapus foto"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-20 border border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-amber-400 transition text-slate-400 hover:text-amber-300 text-[11px]">
                      <Camera className="w-4 h-4 mb-1" />
                      <span>{t.uploadImgBtn}</span>
                      <input type="file" accept="image/*" onChange={(e) => handlePage4PhotoUpload(e, slot.set, false)} className="hidden" />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={`flex justify-end gap-3 pt-4 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <button type="button" onClick={onClose} className={`px-4 py-2 rounded-xl text-sm font-medium ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}>
              {t.cancel}
            </button>
            <button type="submit" className={`px-6 py-2 bg-gradient-to-r ${themeStyle.gradientBtn} text-white rounded-xl font-bold text-sm shadow-lg`}>
              {t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
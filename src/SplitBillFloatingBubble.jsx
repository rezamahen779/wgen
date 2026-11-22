import { useState, useEffect, useRef } from 'react';
import { Calculator, X, Plus, Trash2, Copy, Users } from 'lucide-react';
import { getThemeStyles } from './Settings';

export default function SplitBillFloatingBubble({ mainCurrency, language, twoToneTheme }) {
  const [isOpen, setIsOpen] = useState(false);
  
  // --- STATE KUNCI VISIBILITAS BALON ---
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Cek status sakelar dari Settings (localStorage)
    const checkVisibility = () => {
      const isEnabled = localStorage.getItem('wgen_show_split_bill') === 'true';
      setIsVisible(isEnabled);
    };

    checkVisibility();

    // Event listener jika setting diubah secara real-time dari Settings tab
    window.addEventListener('split-bill-setting-changed', checkVisibility);
    return () => window.removeEventListener('split-bill-setting-changed', checkVisibility);
  }, []);

  // State Draggable & Auto-Hide Balloon
  const [pos, setPos] = useState({ x: 24, y: 120 });
  const [isIdle, setIsIdle] = useState(false);
  
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const idleTimerRef = useRef(null);

  const resetIdleTimer = () => {
    setIsIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    
    if (!isOpen) {
      idleTimerRef.current = setTimeout(() => {
        if (!isDraggingRef.current && !isOpen) {
          setIsIdle(true);
        }
      }, 2000);
    }
  };

  useEffect(() => {
    if (isVisible) {
      resetIdleTimer();
    }
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [isOpen, isVisible]);

  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    resetIdleTimer();

    const clientX = e.clientX ?? (e.touches && e.touches[0].clientX) ?? 0;
    const clientY = e.clientY ?? (e.touches && e.touches[0].clientY) ?? 0;
    
    startPosRef.current = { x: clientX, y: clientY };
    initialPosRef.current = { ...pos };

    if (e.target && e.target.setPointerCapture && e.pointerId) {
      try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
    }
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    
    const clientX = e.clientX ?? (e.touches && e.touches[0].clientX) ?? 0;
    const clientY = e.clientY ?? (e.touches && e.touches[0].clientY) ?? 0;

    const deltaX = clientX - startPosRef.current.x;
    const deltaY = clientY - startPosRef.current.y;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      hasMovedRef.current = true;
    }

    const nextX = initialPosRef.current.x + deltaX;
    const nextY = initialPosRef.current.y + deltaY;

    const boundedX = Math.max(12, Math.min(window.innerWidth - 75, nextX));
    const boundedY = Math.max(12, Math.min(window.innerHeight - 75, nextY));

    requestAnimationFrame(() => {
      setPos({ x: boundedX, y: boundedY });
    });
  };

  const handlePointerUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      resetIdleTimer();
    }
  };

  const handleBubbleClick = (e) => {
    if (hasMovedRef.current) {
      e.stopPropagation();
      hasMovedRef.current = false;
      return;
    }
    setIsOpen(true);
  };

  useEffect(() => {
    const onMove = (e) => handlePointerMove(e);
    const onUp = () => handlePointerUp();

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  const activeThemeId = twoToneTheme || 'emerald';
  const currentTheme = getThemeStyles(activeThemeId);

  const getCurrencySymbol = (code) => {
    const symbols = { JPY: '¥', IDR: 'Rp', USD: '$', EUR: '€', GBP: '£', SGD: 'S$', MYR: 'RM', KRW: '₩', THB: '฿', AUD: 'A$', CNY: '¥', AED: 'DH' };
    return symbols[code] || code;
  };
  const sym = getCurrencySymbol(mainCurrency);

  const tSplit = {
    id: {
      title: 'Split Bill Calculator', desc: 'Hitung & bagi tagihan dengan pajak & service secara otomatis',
      eventPlaceholder: 'Nama Acara (misal: Makan Malam Resto A)', subtotalLabel: 'Subtotal', 
      taxServiceLabel: 'Pajak (%) / Service (%)', equalSplit: 'Bagi Rata (Equal)', itemizedSplit: 'Per Pesanan (Itemized)', 
      membersLabel: 'Anggota Split Bill:', addMemberBtn: 'Tambah Teman', orderPricePlaceholder: 'Harga Pesanan', 
      calculationResult: 'Estimasi Pembagian (+Tax/Service):', defaultFriendName: 'Teman',
      copyTextBtn: 'Salin Teks Lengkap Tagihan', copySuccess: 'Teks rincian tagihan berhasil disalin!', doneBtn: 'Selesai'
    },
    jp: {
      title: '割り勘計算機', desc: '税金やサービス料込で自動計算します',
      eventPlaceholder: 'イベント名 (例: 居酒屋ディナー)', subtotalLabel: '小計', 
      taxServiceLabel: '税 (%) / サービス (%)', equalSplit: '均等割り (Equal)', itemizedSplit: '個別割り (Itemized)', 
      membersLabel: 'メンバー:', addMemberBtn: 'メンバーを追加', orderPricePlaceholder: '注文価格', 
      calculationResult: '内訳 (税・サービス込):', defaultFriendName: 'メンバー',
      copyTextBtn: '請求テキストをコピー', copySuccess: '請求テキストをコピーしました！', doneBtn: '完了'
    },
    en: {
      title: 'Split Bill Calculator', desc: 'Calculate and split bills with tax & service automatically',
      eventPlaceholder: 'Event Name (e.g., Dinner at Restaurant A)', subtotalLabel: 'Subtotal', 
      taxServiceLabel: 'Tax (%) / Service (%)', equalSplit: 'Equal Split', itemizedSplit: 'Itemized Split', 
      membersLabel: 'Split Members:', addMemberBtn: 'Add Member', orderPricePlaceholder: 'Item Price', 
      calculationResult: 'Estimated Total (+Tax/Service):', defaultFriendName: 'Friend',
      copyTextBtn: 'Copy Full Bill Summary', copySuccess: 'Bill summary copied to clipboard!', doneBtn: 'Done'
    },
    ar: {
      title: 'حاسبة تقسيم الفاتورة', desc: 'حساب وتقسيم الفواتير مع الضرائب والخدمة تلقائياً',
      eventPlaceholder: 'اسم المناسبة (مثال: عشاء في مطعم أ)', subtotalLabel: 'المجموع الفرعي', 
      taxServiceLabel: 'الضريبة (%) / الخدمة (%)', equalSplit: 'بالتساوي', itemizedSplit: 'بالتحديد', 
      membersLabel: 'الأعضاء:', addMemberBtn: 'إضافة عضو', orderPricePlaceholder: 'سعر الطلب', 
      calculationResult: 'الإجمالي المتوقع:', defaultFriendName: 'صديق',
      copyTextBtn: 'نسخ نص الفاتورة بالكامل', copySuccess: 'تم نسخ ملخص الفاتورة!', doneBtn: 'تم'
    },
    cn: {
      title: 'AA制账单计算器', desc: '自动计算含税及服务费的AA分摊金额',
      eventPlaceholder: '事件名称 (例如: 餐厅聚餐)', subtotalLabel: '小计', 
      taxServiceLabel: '税费 (%) / 服务费 (%)', equalSplit: '均分 (Equal)', itemizedSplit: '按项目 (Itemized)', 
      membersLabel: '成员:', addMemberBtn: '添加成员', orderPricePlaceholder: '单价金额', 
      calculationResult: '预计分摊金额 (+税费):', defaultFriendName: '成员',
      copyTextBtn: '复制完整账单文本', copySuccess: '账单摘要已复制！', doneBtn: '完成'
    }
  };

  const t = tSplit[language] || tSplit['id'];

  const [billTitle, setBillTitle] = useState('');
  const [subtotalAmount, setSubtotalAmount] = useState('');
  const [taxPercent, setTaxPercent] = useState('10');
  const [servicePercent, setServicePercent] = useState('5');
  const [splitMode, setSplitMode] = useState('equal');
  const [members, setMembers] = useState([
    { name: '', amount: '' },
    { name: '', amount: '' }
  ]);

  // --- HANDLER FORMAT SUBTOTAL ---
  const handleSubtotalChange = (e) => {
    const rawValue = e.target.value.replace(/,/g, '');
    if (rawValue === '' || !isNaN(rawValue)) {
      if (rawValue === '') {
        setSubtotalAmount('');
      } else {
        const parts = rawValue.split('.');
        parts[0] = Number(parts[0]).toLocaleString('en-US');
        setSubtotalAmount(parts.join('.'));
      }
    }
  };

  // --- HANDLER FORMAT HARGA PESANAN (ITEMIZED) ---
  const handleItemAmountChange = (index, value) => {
    const rawValue = value.replace(/,/g, '');
    if (rawValue === '' || !isNaN(rawValue)) {
      const updated = [...members];
      if (rawValue === '') {
        updated[index].amount = '';
      } else {
        const parts = rawValue.split('.');
        parts[0] = Number(parts[0]).toLocaleString('en-US');
        updated[index].amount = parts.join('.');
      }
      setMembers(updated);
    }
  };

  const calculateSplitBill = () => {
    const cleanSubtotal = subtotalAmount.toString().replace(/,/g, '');
    const sub = parseFloat(cleanSubtotal) || 0;
    const tax = parseFloat(taxPercent) || 0;
    const service = parseFloat(servicePercent) || 0;
    const taxAndServiceMultiplier = 1 + (tax / 100) + (service / 100);

    if (splitMode === 'equal') {
      const activeMembersCount = members.length || 1;
      const perPerson = Math.round((sub * taxAndServiceMultiplier) / activeMembersCount);
      return members.map(m => ({ ...m, calculatedTotal: perPerson }));
    } else {
      return members.map(m => {
        const cleanItemVal = (m.amount || '').toString().replace(/,/g, '');
        const itemVal = parseFloat(cleanItemVal) || 0;
        const perPerson = Math.round(itemVal * taxAndServiceMultiplier);
        return { ...m, calculatedTotal: perPerson };
      });
    }
  };

  const handleCopyFullBillText = () => {
    const results = calculateSplitBill();
    const title = billTitle || 'Split Bill Summary';
    const cleanSubtotal = subtotalAmount.toString().replace(/,/g, '');
    const sub = parseFloat(cleanSubtotal) || 0;
    const tax = parseFloat(taxPercent) || 0;
    const service = parseFloat(servicePercent) || 0;
    const grandTotal = results.reduce((sum, r) => sum + r.calculatedTotal, 0);

    let text = `📌 ${title}\n`;
    text += `──────────────────\n`;
    text += `• ${t.subtotalLabel}: ${sym} ${sub.toLocaleString()}\n`;
    text += `• Tax: ${tax}% | Service: ${service}%\n`;
    text += `──────────────────\n`;
    text += `${t.calculationResult}\n`;
    
    results.forEach((m, idx) => {
      text += `${idx + 1}. ${m.name || t.defaultFriendName}: ${sym} ${m.calculatedTotal.toLocaleString()}\n`;
    });
    
    text += `──────────────────\n`;
    text += `Total: ${sym} ${grandTotal.toLocaleString()}`;

    navigator.clipboard.writeText(text);
    alert(t.copySuccess);
  };

  // --- JIKA TERKUNCI (DISABLED FROM SETTINGS), TIDAK MERENDER APA PUN ---
  if (!isVisible) return null;

  return (
    <>
      {/* BALON MELAYANG DENGAN AUTO-HIDE & SMOOTH DRAG */}
      <div
        style={{
          position: 'fixed',
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          touchAction: 'none'
        }}
        onPointerDown={handlePointerDown}
        onClick={handleBubbleClick}
        onMouseEnter={resetIdleTimer}
        className={`z-[999] flex items-center justify-center w-14 h-14 rounded-full shadow-2xl bg-gradient-to-r ${currentTheme.btn} text-white cursor-grab active:cursor-grabbing select-none transition-opacity duration-300 border-2 border-white/30 hover:scale-110 active:scale-95 ${
          isIdle ? 'opacity-30 hover:opacity-100 scale-90' : 'opacity-100'
        }`}
        title={t.title}
      >
        <Calculator className="w-6 h-6 pointer-events-none" />
      </div>

      {/* MODAL / POPUP SPLIT BILL CALCULATOR */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-5 relative flex flex-col gap-4 shadow-2xl border border-gray-200 dark:border-gray-800 my-auto text-gray-800 dark:text-gray-200 animate-in fade-in zoom-in duration-150">
            
            {/* Header Modal */}
            <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl bg-gray-100 dark:bg-gray-800 ${currentTheme.icon}`}>
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">{t.title}</h3>
                  <p className="text-[10px] text-gray-500">{t.desc}</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-full text-gray-400 hover:text-rose-500 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Konten Kalkulator */}
            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
              <input 
                type="text" 
                placeholder={t.eventPlaceholder}
                value={billTitle}
                onChange={e => setBillTitle(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-semibold focus:outline-none"
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-400">{t.subtotalLabel} ({sym})</label>
                  {/* INPUT SUBTOTAL DENGAN FORMAT PEMISAH RIBUAN */}
                  <input 
                    type="text" 
                    placeholder="350,000"
                    value={subtotalAmount}
                    onChange={handleSubtotalChange}
                    className="w-full p-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400">{t.taxServiceLabel}</label>
                  <div className="flex gap-1">
                    <input 
                      type="number" 
                      placeholder="10"
                      value={taxPercent}
                      onChange={e => setTaxPercent(e.target.value)}
                      className="w-1/2 p-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-bold text-center"
                    />
                    <input 
                      type="number" 
                      placeholder="5"
                      value={servicePercent}
                      onChange={e => setServicePercent(e.target.value)}
                      className="w-1/2 p-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-bold text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl gap-1">
                <button 
                  type="button"
                  onClick={() => setSplitMode('equal')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${splitMode === 'equal' ? 'bg-white dark:bg-gray-700 text-emerald-500 shadow-sm' : 'text-gray-400'}`}
                >
                  {t.equalSplit}
                </button>
                <button 
                  type="button"
                  onClick={() => setSplitMode('itemized')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${splitMode === 'itemized' ? 'bg-white dark:bg-gray-700 text-emerald-500 shadow-sm' : 'text-gray-400'}`}
                >
                  {t.itemizedSplit}
                </button>
              </div>

              {/* Daftar Anggota */}
              <div className="flex flex-col gap-2 mt-1">
                <span className="text-[11px] font-bold text-gray-500">{t.membersLabel}</span>
                {members.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/60 p-2 rounded-xl border border-gray-200 dark:border-gray-700">
                    <input 
                      type="text" 
                      placeholder={`${t.defaultFriendName} ${i+1}`}
                      value={m.name}
                      onChange={e => {
                        const updated = [...members];
                        updated[i].name = e.target.value;
                        setMembers(updated);
                      }}
                      className="flex-1 bg-transparent text-xs font-bold focus:outline-none"
                    />
                    {splitMode === 'itemized' && (
                      /* INPUT HARGA PESANAN DENGAN FORMAT PEMISAH RIBUAN */
                      <input 
                        type="text" 
                        placeholder={t.orderPricePlaceholder}
                        value={m.amount}
                        onChange={e => handleItemAmountChange(i, e.target.value)}
                        className="w-28 p-1 rounded-lg border border-gray-300 dark:border-gray-700 text-xs font-bold bg-white dark:bg-gray-900"
                      />
                    )}
                    <button 
                      type="button"
                      onClick={() => setMembers(members.filter((_, idx) => idx !== i))}
                      className="text-gray-400 hover:text-rose-500 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <button 
                  type="button"
                  onClick={() => setMembers([...members, { name: '', amount: '' }])}
                  className="py-1.5 text-xs font-bold text-emerald-500 bg-emerald-500/10 rounded-xl border border-emerald-500/20 hover:bg-emerald-500/20 transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> {t.addMemberBtn}
                </button>
              </div>

              {/* Rincian Hasil Kalkulasi */}
              <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col gap-1.5 mt-2">
                <span className="text-[10px] font-extrabold uppercase text-gray-400">{t.calculationResult}</span>
                {calculateSplitBill().map((res, i) => (
                  <div key={i} className="flex justify-between text-xs font-bold">
                    <span>{res.name || `${t.defaultFriendName} ${i+1}`}</span>
                    <span className="text-emerald-500">{sym} {res.calculatedTotal.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tombol Salin Teks Lengkap & Selesai */}
            <div className="flex gap-2 border-t border-gray-200 dark:border-gray-800 pt-3">
              <button 
                type="button"
                onClick={handleCopyFullBillText}
                className={`flex-1 py-2.5 rounded-xl text-white font-extrabold text-xs bg-gradient-to-r ${currentTheme.btn} shadow-md flex items-center justify-center gap-2 transition cursor-pointer`}
              >
                <Copy className="w-3.5 h-3.5" /> {t.copyTextBtn}
              </button>
              <button 
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
              >
                {t.doneBtn}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
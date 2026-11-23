import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, FileUp, Loader2, ChevronUp, ChevronDown,
  BookOpen, Save, FolderOpen, Check
} from 'lucide-react';
import { extractContractTextFromFile, splitRawTextToClauses } from './utils/contractParser';

const STORAGE_KEY = 'wgen_saved_contract_templates_v1';

const builderTranslations = {
  id: {
    title: 'Pasal & Ayat Perjanjian Manual (Opsional)',
    subtitle: 'Tulis atau kopas isi pasal dan ayat perjanjian secara manual (1–100+ pasal). Judul surat, identitas para pihak, ringkasan detail pinjaman, dan kolom tanda tangan/sidik jari akan digenerate otomatis oleh sistem.',
    addClause: 'Tambah Pasal',
    importFile: 'Import (.docx/.pdf/.txt)',
    importing: 'Memecah pasal...',
    titlePlaceholder: 'Judul Pasal (cth: Pasal 1 – Objek Perjanjian)',
    bodyPlaceholder: 'Tulis atau kopas isi ayat perjanjian secara manual di sini...\nContoh:\n1. PIHAK PERTAMA menyerahkan dana pinjaman kepada PIHAK KEDUA.\n2. PIHAK KEDUA wajib mengembalikan sesuai jadwal yang disepakati.',
    emptyHint: 'Belum ada pasal manual. Sistem akan memakai pasal standar bawaan aplikasi, atau klik "Tambah Pasal" / muat paket pasal tersimpan.',
    bundleNamePlaceholder: 'Nama paket kontrak (cth: Kontrak Ijarah Full)',
    saveAllBtn: 'Simpan Semua Pasal',
    savedSuccess: 'Semua Pasal Tersimpan!',
    loadBundlePlaceholder: '-- Muat paket pasal tersimpan --',
    deleteBundleTitle: 'Hapus paket pasal terpilih',
    clausesCountUnit: 'pasal'
  },
  jp: {
    title: '手動契約条項エディタ（任意）',
    subtitle: '契約の条項・各項を手動で入力または貼り付けてください（1〜100条以上）。表題、当事者情報、貸付詳細サマリー、署名・指印欄はシステムが自動生成します。',
    addClause: '条項を追加',
    importFile: '読込 (.docx/.pdf/.txt)',
    importing: '分割中...',
    titlePlaceholder: '条項タイトル (例: 第1条 – 貸付の目的)',
    bodyPlaceholder: '条項の本文を手動で入力してください...',
    emptyHint: '手動条項は未登録です。標準条項を使用するか、「条項を追加」または保存済みテンプレートを読み込んでください。',
    bundleNamePlaceholder: '契約テンプレート名 (例: 標準金銭消費貸借)',
    saveAllBtn: '全条項を一括保存',
    savedSuccess: '一括保存完了!',
    loadBundlePlaceholder: '-- 保存済み契約テンプレートを読込 --',
    deleteBundleTitle: '選択中のテンプレートを削除',
    clausesCountUnit: '条'
  },
  en: {
    title: 'Manual Agreement Clauses (Optional)',
    subtitle: 'Type or paste agreement clauses and articles manually (1–100+ clauses). Document header, party identities, loan summary details, and signature/fingerprint blocks are generated automatically.',
    addClause: 'Add Clause',
    importFile: 'Import (.docx/.pdf/.txt)',
    importing: 'Splitting...',
    titlePlaceholder: 'Clause Title (e.g., Article 1 – Loan Object)',
    bodyPlaceholder: 'Type or paste clause paragraphs manually here...',
    emptyHint: 'No manual clauses added. Default template will be used, or click "Add Clause" / load a saved preset.',
    bundleNamePlaceholder: 'Contract preset name (e.g., Full Loan Agreement)',
    saveAllBtn: 'Save All Clauses',
    savedSuccess: 'All Clauses Saved!',
    loadBundlePlaceholder: '-- Load saved contract preset --',
    deleteBundleTitle: 'Delete selected preset',
    clausesCountUnit: 'clauses'
  },
  ar: {
    title: 'بنود وفقرات الاتفاقية اليدوية (اختياري)',
    subtitle: 'اكتب أو الصق بنود وفقرات الاتفاقية يدوياً (1–100+ بند). يتم إنشاء عنوان العقد وبيانات الأطراف وملخص تفاصيل القرض وخانات التوقيع تلقائياً.',
    addClause: 'إضافة بند',
    importFile: 'استيراد (.docx/.pdf/.txt)',
    importing: 'جاري التقسيم...',
    titlePlaceholder: 'عنوان البند (مثال: المادة 1 – موضوع العقد)',
    bodyPlaceholder: 'اكتب أو الصق فقرات البند يدوياً هنا...',
    emptyHint: 'لا توجد بنود يدوية. سيتم استخدام القالب الافتراضي، أو اضغط "إضافة بند" أو اختر حزمة محفوظة.',
    bundleNamePlaceholder: 'اسم حزمة العقد (مثال: عقد تمويل كامل)',
    saveAllBtn: 'حفظ جميع البنود',
    savedSuccess: 'تم حفظ جميع البنود!',
    loadBundlePlaceholder: '-- تحميل حزمة بنود محفوظة --',
    deleteBundleTitle: 'حذف الحزمة المحددة',
    clausesCountUnit: 'بند'
  },
  cn: {
    title: '手动协议条款编辑器（可选）',
    subtitle: '请手动输入或粘贴协议条款内容（1–100+条）。文件标题、双方身份信息、借款明细摘要及签名/指纹栏将由系统自动生成。',
    addClause: '添加条款',
    importFile: '导入 (.docx/.pdf/.txt)',
    importing: '拆分中...',
    titlePlaceholder: '条款标题（例：第一条 – 借款标的）',
    bodyPlaceholder: '在此手动输入或粘贴条款段落内容...',
    emptyHint: '尚未添加手动条款。将使用默认模板，或点击“添加条款”/加载已保存的整套条款。',
    bundleNamePlaceholder: '合同模板名称（例：完整借款协议）',
    saveAllBtn: '一键保存全部条款',
    savedSuccess: '全部条款已保存!',
    loadBundlePlaceholder: '-- 加载已保存的整套条款 --',
    deleteBundleTitle: '删除所选模板',
    clausesCountUnit: '条'
  }
};

export default function ContractClauseBuilder({
  language = 'id',
  clauses = [],
  onChangeClauses,
  boxClass,
  inputBg,
  buttonClass,
  isDarkMode
}) {
  const [isImporting, setIsImporting] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [bundleName, setBundleName] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const bt = builderTranslations[language] || builderTranslations.id;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedTemplates(parsed);
      }
    } catch {
      // Abaikan jika localStorage tidak tersedia
    }
  }, []);

  const persistTemplates = (list) => {
    setSavedTemplates(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Abaikan error quota
    }
  };

  const handleSaveAllClauses = () => {
    const validClauses = clauses.filter(
      (c) => (c.title && c.title.trim()) || (c.body && c.body.trim())
    );
    if (validClauses.length === 0) return;

    const cleanName =
      bundleName.trim() || `Kontrak ${savedTemplates.length + 1} (${validClauses.length} ${bt.clausesCountUnit})`;

    const existingIdx = savedTemplates.findIndex(
      (tpl) => tpl.name.toLowerCase() === cleanName.toLowerCase()
    );

    const newItem = {
      id: existingIdx >= 0 ? savedTemplates[existingIdx].id : String(Date.now()),
      name: cleanName,
      clauses: validClauses.map((c) => ({ ...c }))
    };

    const nextList =
      existingIdx >= 0
        ? savedTemplates.map((tpl, i) => (i === existingIdx ? newItem : tpl))
        : [newItem, ...savedTemplates];

    persistTemplates(nextList);
    setSelectedTemplateId(newItem.id);
    setBundleName(cleanName);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleLoadTemplate = (tplId) => {
    setSelectedTemplateId(tplId);
    if (!tplId) return;
    const found = savedTemplates.find((tpl) => tpl.id === tplId);
    if (!found) return;
    onChangeClauses(found.clauses.map((c) => ({ ...c })));
    setBundleName(found.name);
    setActiveIndex(0);
  };

  const handleDeleteTemplate = () => {
    if (!selectedTemplateId) return;
    const nextList = savedTemplates.filter((tpl) => tpl.id !== selectedTemplateId);
    persistTemplates(nextList);
    setSelectedTemplateId('');
    setBundleName('');
  };

  const handleAddClause = () => {
    const nextNum = clauses.length + 1;
    const defaultPrefix =
      language === 'jp'
        ? `第${nextNum}条 – `
        : language === 'cn'
        ? `第${nextNum}条 – `
        : language === 'ar'
        ? `المادة ${nextNum} – `
        : language === 'en'
        ? `Article ${nextNum} – `
        : `Pasal ${nextNum} – `;

    const updated = [...clauses, { title: defaultPrefix, body: '' }];
    onChangeClauses(updated);
    setActiveIndex(updated.length - 1);
  };

  const handleUpdateClause = (idx, field, value) => {
    const updated = clauses.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    );
    onChangeClauses(updated);
  };

  const handleRemoveClause = (idx) => {
    const updated = clauses.filter((_, i) => i !== idx);
    onChangeClauses(updated);
    if (activeIndex >= updated.length) {
      setActiveIndex(Math.max(0, updated.length - 1));
    }
  };

  const handleMoveClause = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= clauses.length) return;
    const copy = [...clauses];
    const [moved] = copy.splice(idx, 1);
    copy.splice(target, 0, moved);
    onChangeClauses(copy);
    setActiveIndex(target);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const raw = await extractContractTextFromFile(file);
      const parsedClauses = splitRawTextToClauses(raw);
      if (parsedClauses.length > 0) {
        onChangeClauses(parsedClauses);
        setBundleName(file.name.replace(/\.[^/.]+$/, ''));
        setActiveIndex(0);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className={`p-3.5 rounded-xl border ${boxClass}`}>
      {/* Header & Tombol Aksi Utama */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
          <BookOpen className="w-4 h-4" /> {bt.title}
        </span>

        <div className="flex flex-wrap items-center gap-1.5">
          <label className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'}`}>
            {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5 text-sky-400" />}
            <span>{isImporting ? bt.importing : bt.importFile}</span>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.html,.htm"
              onChange={handleImportFile}
              disabled={isImporting}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleAddClause}
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold transition ${buttonClass}`}
          >
            <Plus className="w-3.5 h-3.5" /> {bt.addClause}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 mb-2.5 leading-relaxed">
        {bt.subtitle}
      </p>

      {/* Bar Simpan & Muat Keseluruhan Paket Pasal Sekaligus */}
      {(savedTemplates.length > 0 || clauses.length > 0) && (
        <div className={`p-2 rounded-lg border mb-3 space-y-2 ${isDarkMode ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
          {savedTemplates.length > 0 && (
            <div className="flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <select
                value={selectedTemplateId}
                onChange={(e) => handleLoadTemplate(e.target.value)}
                className={`flex-1 rounded-lg px-2 py-1 text-[11px] border ${inputBg}`}
              >
                <option value="">{bt.loadBundlePlaceholder}</option>
                {savedTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.clauses.length} {bt.clausesCountUnit})
                  </option>
                ))}
              </select>
              {selectedTemplateId && (
                <button
                  type="button"
                  onClick={handleDeleteTemplate}
                  title={bt.deleteBundleTitle}
                  className="p-1 text-rose-400 hover:text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {clauses.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="text"
                value={bundleName}
                onChange={(e) => setBundleName(e.target.value)}
                placeholder={bt.bundleNamePlaceholder}
                className={`flex-1 min-w-[160px] rounded-lg px-2.5 py-1 text-[11px] border ${inputBg}`}
              />
              <button
                type="button"
                onClick={handleSaveAllClauses}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold border transition ${
                  justSaved
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                    : isDarkMode
                    ? 'bg-emerald-950/60 hover:bg-emerald-900/70 border-emerald-700 text-emerald-300'
                    : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-700'
                }`}
              >
                {justSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>
                  {justSaved
                    ? bt.savedSuccess
                    : `${bt.saveAllBtn} (${clauses.length})`}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Daftar Kartu Pasal */}
      {clauses.length === 0 ? (
        <div className={`p-3 rounded-xl border border-dashed text-[11px] text-slate-400 text-center ${isDarkMode ? 'border-slate-700 bg-slate-900/40' : 'border-slate-300 bg-slate-50'}`}>
          {bt.emptyHint}
        </div>
      ) : (
        <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
          {clauses.map((clause, idx) => (
            <div
              key={idx}
              onFocus={() => setActiveIndex(idx)}
              className={`p-3 rounded-xl border transition ${
                activeIndex === idx
                  ? isDarkMode
                    ? 'bg-slate-900/90 border-amber-500/60'
                    : 'bg-white border-amber-400'
                  : isDarkMode
                  ? 'bg-slate-900/50 border-slate-800'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold text-amber-400">
                  #{idx + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveClause(idx, -1)}
                    disabled={idx === 0}
                    className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveClause(idx, 1)}
                    disabled={idx === clauses.length - 1}
                    className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveClause(idx)}
                    className="p-1 text-rose-400 hover:text-rose-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={clause.title}
                onChange={(e) => handleUpdateClause(idx, 'title', e.target.value)}
                placeholder={bt.titlePlaceholder}
                className={`w-full rounded-lg px-3 py-2 text-xs font-bold border mb-2 ${inputBg}`}
              />

              <textarea
                rows={7}
                value={clause.body}
                onChange={(e) => handleUpdateClause(idx, 'body', e.target.value)}
                placeholder={bt.bodyPlaceholder}
                className={`w-full min-h-[160px] resize-y rounded-lg px-3 py-2.5 text-xs border leading-relaxed ${inputBg}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
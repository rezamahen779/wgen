import React, { useState } from 'react';
import {
  Plus, Trash2, FileUp, Loader2, Sparkles, ChevronUp, ChevronDown, BookOpen
} from 'lucide-react';
import { extractContractTextFromFile, splitRawTextToClauses } from './utils/contractParser';

const builderTranslations = {
  id: {
    title: 'Pasal-Pasal Perjanjian Kustom (Opsional)',
    subtitle: 'Tulis atau kopas pasal perjanjian saja (1 sampai 100+ pasal). Judul surat, identitas pihak & tanda tangan dibuat otomatis. Gunakan titik-titik (......) atau tombol variabel untuk pengisian nominal otomatis.',
    addClause: '+ Tambah Pasal',
    importFile: 'Import dari File (.docx/.pdf/.txt)',
    importing: 'Memecah pasal...',
    clauseLabel: 'Pasal',
    titlePlaceholder: 'Contoh: Pasal 1 – Objek Ijarah',
    bodyPlaceholder: 'Contoh:\n1. PIHAK PERTAMA menyediakan dana sebesar ...... yang dapat digunakan oleh PIHAK KEDUA.\n2. Atas jasa penyediaan dana tersebut, PIHAK KEDUA berkewajiban membayar ujrah sebesar ......',
    quickInsert: 'Sisipkan Otomatis:',
    vars: {
      principal: 'Pokok',
      bonus: 'Ujrah/Bonus',
      installment: 'Cicilan/Bln',
      total: 'Total Bayar',
      tenor: 'Tenor',
      address: 'Alamat Debitur',
      collateral: 'Jaminan'
    },
    emptyHint: 'Belum ada pasal kustom. Sistem akan memakai pasal standar aplikasi, atau klik "+ Tambah Pasal" untuk menulis/kopas pasal sendiri.'
  },
  jp: {
    title: 'カスタム契約条項ビルダー（任意）',
    subtitle: '契約の条項のみを入力または貼り付けてください（1〜100条以上対応）。表題・当事者情報・署名欄は自動生成されます。「......」または変数ボタンで金額等が自動入力されます。',
    addClause: '+ 条項を追加',
    importFile: 'ファイルから読込 (.docx/.pdf/.txt)',
    importing: '条項を分割中...',
    clauseLabel: '第',
    titlePlaceholder: '例: 第1条（貸付の目的および金額）',
    bodyPlaceholder: '例:\n1. 甲は乙に対し、元金 ...... を貸し渡す。\n2. 乙は甲に対し、利息・手数料として ...... を支払う。',
    quickInsert: '自動挿入:',
    vars: {
      principal: '元金',
      bonus: '利息/報酬',
      installment: '月額返済',
      total: '返済総額',
      tenor: '期間',
      address: '借主住所',
      collateral: '担保'
    },
    emptyHint: 'カスタム条項は未登録です。標準条項を使用するか、「+ 条項を追加」を押して入力してください。'
  },
  en: {
    title: 'Custom Agreement Clauses Builder (Optional)',
    subtitle: 'Type or paste agreement clauses only (1 to 100+ clauses). Document title, party details & signatures are generated automatically. Use dots (......) or variable chips to auto-fill amounts.',
    addClause: '+ Add Clause',
    importFile: 'Import from File (.docx/.pdf/.txt)',
    importing: 'Splitting clauses...',
    clauseLabel: 'Clause',
    titlePlaceholder: 'e.g., Article 1 – Loan Object',
    bodyPlaceholder: 'e.g.,\n1. The FIRST PARTY provides funds amounting to ...... to be used by the SECOND PARTY.\n2. The SECOND PARTY agrees to pay a service fee/bonus of ......',
    quickInsert: 'Auto-Fill Chip:',
    vars: {
      principal: 'Principal',
      bonus: 'Bonus/Interest',
      installment: 'Monthly',
      total: 'Total Due',
      tenor: 'Tenor',
      address: 'Debtor Address',
      collateral: 'Collateral'
    },
    emptyHint: 'No custom clauses added. Default template will be used, or click "+ Add Clause" to write/paste your own.'
  },
  ar: {
    title: 'منشئ بنود الاتفاقية المخصصة (اختياري)',
    subtitle: 'اكتب أو الصق بنود الاتفاقية فقط (من 1 إلى 100+ بند). يتم إنشاء العنوان وبيانات الأطراف والتوقيع تلقائياً. استخدم النقاط (......) لتعبئة المبالغ تلقائياً.',
    addClause: '+ إضافة بند',
    importFile: 'استيراد من ملف (.docx/.pdf/.txt)',
    importing: 'جاري تقسيم البنود...',
    clauseLabel: 'البند',
    titlePlaceholder: 'مثال: المادة 1 – موضوع العقد',
    bodyPlaceholder: 'مثال:\n1. يقدم الطرف الأول مبلغاً وقدره ...... ليستخدمه الطرف الثاني.\n2. يلتزم الطرف الثاني بدفع أجر/مكافأة قدرها ......',
    quickInsert: 'إدراج تلقائي:',
    vars: {
      principal: 'أصل المبلغ',
      bonus: 'الأجر/الفائدة',
      installment: 'القسط الشهري',
      total: 'الإجمالي',
      tenor: 'المدة',
      address: 'عنوان المدين',
      collateral: 'الضمان'
    },
    emptyHint: 'لا توجد بنود مخصصة. سيتم استخدام القالب الافتراضي، أو اضغط "+ إضافة بند" للكتابة.'
  },
  cn: {
    title: '自定义协议条款编辑器（可选）',
    subtitle: '仅输入或粘贴协议条款正文（支持1至100+条）。合同标题、双方信息及签名栏将自动生成。使用省略号（......）或快捷变量按钮可自动填充金额。',
    addClause: '+ 添加条款',
    importFile: '从文件导入 (.docx/.pdf/.txt)',
    importing: '正在拆分条款...',
    clauseLabel: '条款',
    titlePlaceholder: '例如：第一条 – 借款标的',
    bodyPlaceholder: '例如：\n1. 甲方向乙方提供资金 ...... 供乙方使用。\n2. 乙方自愿向甲方支付服务费/奖励 ......',
    quickInsert: '自动填充变量:',
    vars: {
      principal: '本金',
      bonus: '利息/奖励',
      installment: '每期还款',
      total: '还款总额',
      tenor: '期限',
      address: '借款人地址',
      collateral: '担保物'
    },
    emptyHint: '尚未添加自定义条款。系统将使用默认条款，或点击“+ 添加条款”自行输入/粘贴。'
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
  const bt = builderTranslations[language] || builderTranslations.id;

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

  const handleInsertToken = (token) => {
    if (clauses.length === 0) {
      onChangeClauses([{ title: 'Pasal 1 – ', body: token }]);
      setActiveIndex(0);
      return;
    }
    const idx = Math.min(activeIndex, clauses.length - 1);
    const currentBody = clauses[idx].body || '';
    const spacer = currentBody && !currentBody.endsWith(' ') && !currentBody.endsWith('\n') ? ' ' : '';
    handleUpdateClause(idx, 'body', `${currentBody}${spacer}${token}`);
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
        setActiveIndex(0);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const variableChips = [
    { label: bt.vars.principal, token: '{{PRINCIPAL}}' },
    { label: bt.vars.bonus, token: '{{BONUS}}' },
    { label: bt.vars.installment, token: '{{INSTALLMENT}}' },
    { label: bt.vars.total, token: '{{TOTAL}}' },
    { label: bt.vars.tenor, token: '{{TENOR}}' },
    { label: bt.vars.address, token: '{{DEBTOR_ADDRESS}}' },
    { label: bt.vars.collateral, token: '{{COLLATERAL}}' }
  ];

  return (
    <div className={`p-3.5 rounded-xl border ${boxClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
          <BookOpen className="w-4 h-4" /> {bt.title}
        </span>

        <div className="flex items-center gap-1.5">
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
            <Plus className="w-3.5 h-3.5" /> {bt.addClause.replace(/^\+\s*/, '')}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 mb-2.5 leading-relaxed">
        {bt.subtitle}
      </p>

      {/* Baris Tombol Sisip Variabel Cepat */}
      <div className="flex flex-wrap items-center gap-1 mb-3">
        <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
          <Sparkles className="w-3 h-3 text-amber-400" /> {bt.quickInsert}
        </span>
        {variableChips.map((chip) => (
          <button
            key={chip.token}
            type="button"
            onClick={() => handleInsertToken(chip.token)}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition ${isDarkMode ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-emerald-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-emerald-700'}`}
          >
            + {chip.label}
          </button>
        ))}
      </div>

      {clauses.length === 0 ? (
        <div className={`p-3 rounded-xl border border-dashed text-[11px] text-slate-400 text-center ${isDarkMode ? 'border-slate-700 bg-slate-900/40' : 'border-slate-300 bg-slate-50'}`}>
          {bt.emptyHint}
        </div>
      ) : (
        <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
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
                className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-bold border mb-2 ${inputBg}`}
              />

              <textarea
                rows={4}
                value={clause.body}
                onChange={(e) => handleUpdateClause(idx, 'body', e.target.value)}
                placeholder={bt.bodyPlaceholder}
                className={`w-full rounded-lg px-2.5 py-2 text-xs border leading-relaxed ${inputBg}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
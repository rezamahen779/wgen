import React, { useState } from 'react';
import { extractTextFromContractFile } from '../utils/contractParser';

export default function ContractUploadBox({
  fileName,
  onContractLoaded,
  onClearContract,
  boxClass = '',
  buttonClass = '',
}) {
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setIsParsing(true);
    try {
      const extractedText = await extractTextFromContractFile(file);
      if (!extractedText) {
        throw new Error('Isi dokumen kosong atau berupa gambar scan.');
      }
      onContractLoaded({
        fileName: file.name,
        text: extractedText,
      });
    } catch (err) {
      setErrorMsg(err.message || 'Gagal membaca file kontrak.');
    } finally {
      setIsParsing(false);
      e.target.value = '';
    }
  };

  return (
    <div className={`p-3.5 rounded-xl border space-y-2 ${boxClass}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-xs font-bold text-emerald-400 block">
            Upload Template Kontrak (PDF / Word .docx)
          </span>
          <span className="text-[11px] text-slate-400">
            Otomatis menyesuaikan isi kontrak dengan data pinjaman saat generate HTML.
          </span>
        </div>

        <label className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer shrink-0 transition ${buttonClass}`}>
          {isParsing ? 'Membaca...' : 'Pilih PDF / Word'}
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleFileChange}
            disabled={isParsing}
          />
        </label>
      </div>

      {fileName && (
        <div className="flex items-center justify-between text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-3 py-2 rounded-lg">
          <span className="truncate">
            ✓ Kontrak siap: <strong>{fileName}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              setErrorMsg('');
              onClearContract?.();
            }}
            className="text-[11px] underline ml-2 shrink-0"
          >
            Hapus
          </button>
        </div>
      )}

      {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}
    </div>
  );
}
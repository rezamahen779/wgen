import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export async function extractContractTextFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'txt') return await file.text();

  if (ext === 'html' || ext === 'htm') {
    const rawHtml = await file.text();
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    const blocks = doc.querySelectorAll('p, div, li, h1, h2, h3, h4');
    if (blocks.length > 0) {
      return Array.from(blocks).map((el) => el.textContent.trim()).filter(Boolean).join('\n');
    }
    return doc.body.textContent || '';
  }

  if (ext === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || '';
  }

  if (ext === 'pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let lastY = null;
      let pageLines = [];
      let currentLine = '';

      for (const item of content.items) {
        const str = item.str;
        const y = item.transform ? item.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 5) {
          if (currentLine.trim()) pageLines.push(currentLine.trim());
          currentLine = str;
        } else {
          currentLine += (currentLine && !currentLine.endsWith(' ') && !str.startsWith(' ') ? ' ' : '') + str;
        }
        if (y !== null) lastY = y;
      }
      if (currentLine.trim()) pageLines.push(currentLine.trim());
      pages.push(pageLines.join('\n'));
    }
    return pages.join('\n\n');
  }

  throw new Error('Format file tidak didukung. Gunakan .pdf, .docx, .txt, atau .html');
}

const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Pecah teks mentah hasil import menjadi array [{ title, body }] untuk diisi ke kartu pasal
export function splitRawTextToClauses(rawText) {
  let text = String(rawText || '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  text = text.replace(/\s+(?=(?:PASAL|Pasal|ARTICLE|Article)\s+\d+\s*[–\-—:.]?)/g, '\n\n');
  text = text.replace(/\s+(?=(?:第\s*[0-9一二三四五六七八九十]+\s*条|المادة\s*\d+))/g, '\n\n');
  text = text.replace(/([.。;:])\s+(?=\d{1,2}\.\s+[A-Z\u3040-\u30FF\u4E00-\u9FAF\u0600-\u06FF])/g, '$1\n');

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const isHeader = (line) =>
    /^(?:PASAL|Pasal|ARTICLE|Article)\s+\d+/i.test(line) ||
    /^第\s*[0-9一二三四五六七八九十]+\s*条/.test(line) ||
    /^المادة\s*\d+/.test(line);

  const result = [];
  let current = null;

  for (const line of lines) {
    if (isHeader(line)) {
      if (current) result.push(current);
      current = { title: line, body: '' };
    } else {
      if (!current) current = { title: 'Pasal 1', body: '' };
      current.body = current.body ? `${current.body}\n${line}` : line;
    }
  }
  if (current) result.push(current);
  return result;
}

// Mengisi titik-titik (...... / ……) berdasarkan kata kunci konteks tepat sebelum titik-titik
function fillSmartDots(text, values) {
  return text.replace(/([^\n.…]{0,55}?)([.…]{3,}\.?)/g, (fullMatch, beforeContext) => {
    const ctx = beforeContext.toLowerCase();

    if (/(ujrah|upah|jasa|hadiah|bunga|bonus|imbalan|interest|fee|reward|利息|報酬|أجر|مكافأة)/i.test(ctx)) {
      return `${beforeContext}${values.bonus}`;
    }
    if (/(cicilan|angsuran|per\s*bulan|bulanan|installment|monthly|月額|毎期|قسط)/i.test(ctx)) {
      return `${beforeContext}${values.installment}`;
    }
    if (/(total|keseluruhan|seluruhnya|pelunasan|total\s*due|総額|الإجمالي)/i.test(ctx)) {
      return `${beforeContext}${values.total}`;
    }
    if (/(jangka\s*waktu|tenor|selama|durasi|bulan|term|duration|期間|期限|المدة)/i.test(ctx)) {
      return `${beforeContext}${values.tenor}`;
    }
    if (/(denda|keterlambatan|late\s*fee|penalty|遅延|延滞|غرامة)/i.test(ctx)) {
      return `${beforeContext}${values.lateFee}`;
    }
    if (/(alamat|beralamat|domisili|address|住所|地址|عنوان)/i.test(ctx)) {
      return `${beforeContext}${values.address}`;
    }
    if (/(jaminan|agunan|sertifikat|collateral|担保|ضمان)/i.test(ctx)) {
      return `${beforeContext}${values.collateral}`;
    }
    // Default untuk "dana sebesar ......", "pokok ......", "pinjaman ......"
    return `${beforeContext}${values.principal}`;
  });
}

export function buildAdjustedContractHtml(clausesOrText) {
  const sections = Array.isArray(clausesOrText)
    ? clausesOrText
        .filter((c) => (c.title && c.title.trim()) || (c.body && c.body.trim()))
        .map((c) => ({
          title: String(c.title || '').trim(),
          items: String(c.body || '')
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
        }))
    : splitRawTextToClauses(String(clausesOrText || '')).map((c) => ({
        title: c.title.trim(),
        items: c.body.split('\n').map((l) => l.trim()).filter(Boolean)
      }));

  const isNumberedItem = (line) => /^\d{1,2}[.)]\s+/.test(line);

  return sections
    .map((sec) => {
      const titleHtml = sec.title
        ? `<div class="clause-title">${escapeHtml(sec.title)}</div>`
        : '';

      const allNumbered =
        sec.items.length > 0 && sec.items.every((item) => isNumberedItem(item));

      if (allNumbered) {
        const listItems = sec.items
          .map((item) => `<li>${escapeHtml(item.replace(/^\d{1,2}[.)]\s+/, ''))}</li>`)
          .join('');
        return `<div class="clause-section">${titleHtml}<ol class="clause-list">${listItems}</ol></div>`;
      }

      const bodyHtml = sec.items
        .map((item) => `<p class="clause-text" style="margin-bottom: 3px;">${escapeHtml(item)}</p>`)
        .join('');

      return `<div class="clause-section">${titleHtml}${bodyHtml}</div>`;
    })
    .join('');
}
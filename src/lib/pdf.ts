/**
 * Gerador de PDF minimo, sem dependencias: texto em fontes padrao (Helvetica / Courier, WinAnsi),
 * quebra de linha, paginas A4 e rodape com numero da pagina.
 */

export type PdfFont = 'regular' | 'bold' | 'mono';
export type PdfBlock = { text: string; size: number; font: PdfFont; gapBefore?: number; indent?: number };

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 72;
const FOOTER_Y = 40;
const LINE = 1.45;
const FONT_KEY: Record<PdfFont, string> = { regular: 'F1', bold: 'F2', mono: 'F3' };
const FONT_NAME: Record<PdfFont, string> = { regular: 'Helvetica', bold: 'Helvetica-Bold', mono: 'Courier' };
// Largura media por caractere, em multiplos do tamanho da fonte (suficiente para quebrar linhas).
const CHAR_EM: Record<PdfFont, number> = { regular: 0.5, bold: 0.56, mono: 0.6 };

// Caracteres do WinAnsi acima de 0x7F que nao ficam no mesmo codigo do Unicode.
const WIN_ANSI: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89,
  'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95,
  '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};

/** Texto em codigos de 1 byte (WinAnsi); o que nao cabe vira '?'. */
function encode(text: string): string {
  text = text.replace(/−/g, '-').replace(/≥/g, '>=').replace(/ᵢ/g, '_i').replace(/ᵣ/g, '_r').replace(/𝓰/g, '_g').replace(/ₒ/g, '_o').replace(/ₚ/g, '_p');
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x0a || code === 0x09) out += ' ';
    else if (code >= 0x20 && code <= 0x7e) out += ch;
    else if (code >= 0xa0 && code <= 0xff) out += ch;
    else if (WIN_ANSI[ch] !== undefined) out += String.fromCharCode(WIN_ANSI[ch]);
    else out += '?';
  }
  return out;
}

function escapePdf(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrap(text: string, size: number, font: PdfFont, width: number): string[] {
  const maxChars = Math.max(10, Math.floor(width / (size * CHAR_EM[font])));
  const words = encode(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // Palavra maior que a linha: quebra em pedacos.
      let rest = word;
      while (rest.length > maxChars) {
        lines.push(rest.slice(0, maxChars));
        rest = rest.slice(maxChars);
      }
      current = rest;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

/** Monta o PDF a partir de blocos de texto ja prontos. */
export function buildPdf(title: string, blocks: PdfBlock[]): Blob {
  const pages: string[][] = [[]];
  const contentWidth = PAGE_W - MARGIN * 2;
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    pages.push([]);
    y = PAGE_H - MARGIN;
  };

  for (const block of blocks) {
    if (block.gapBefore && y < PAGE_H - MARGIN) y -= block.gapBefore;
    const x = MARGIN + (block.indent ?? 0);
    const lines = wrap(block.text, block.size, block.font, contentWidth - (block.indent ?? 0));
    const step = block.size * LINE;
    for (const line of lines) {
      if (y - block.size < MARGIN) newPage();
      pages[pages.length - 1].push(
        `BT /${FONT_KEY[block.font]} ${block.size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(line)}) Tj ET`,
      );
      y -= step;
    }
  }

  // Rodape com numero da pagina.
  const total = pages.length;
  pages.forEach((content, index) => {
    content.push(
      `BT /F3 8 Tf ${(PAGE_W - MARGIN - 40).toFixed(2)} ${FOOTER_Y} Td (${index + 1} / ${total}) Tj ET`,
    );
  });

  // Objetos: 1 catalogo, 2 paginas, 3-5 fontes, depois pagina + conteudo em pares, depois info.
  const objects: string[] = [];
  const fontObjects = [3, 4, 5];
  const pageObjects: number[] = [];
  const firstPageObj = 6;
  pages.forEach((_, i) => pageObjects.push(firstPageObj + i * 2));

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageObjects.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  (['regular', 'bold', 'mono'] as PdfFont[]).forEach((font, i) => {
    objects[fontObjects[i]] = `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_NAME[font]} /Encoding /WinAnsiEncoding >>`;
  });
  const fontRes = `<< /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >>`;
  pages.forEach((content, i) => {
    const pageNo = firstPageObj + i * 2;
    const streamNo = pageNo + 1;
    const stream = content.join('\n');
    objects[pageNo] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources ${fontRes} /Contents ${streamNo} 0 R >>`;
    objects[streamNo] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  const infoNo = firstPageObj + pages.length * 2;
  objects[infoNo] = `<< /Title (${escapePdf(encode(title))}) /Producer (Wii) >>`;

  // Monta o arquivo; cada caractere e um byte (tudo esta em Latin-1).
  let body = '%PDF-1.4\n%âãÏÓ\n';
  const offsets: number[] = [];
  for (let n = 1; n < objects.length; n += 1) {
    if (objects[n] === undefined) continue;
    offsets[n] = body.length;
    body += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xrefAt = body.length;
  const count = objects.length; // objetos 0..count-1
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n += 1) {
    xref += `${String(offsets[n] ?? 0).padStart(10, '0')} 00000 ${offsets[n] === undefined ? 'f' : 'n'} \n`;
  }
  body += xref;
  body += `trailer\n<< /Size ${count} /Root 1 0 R /Info ${infoNo} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  const bytes = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i += 1) bytes[i] = body.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: 'application/pdf' });
}

const clean = (text: string) => text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`/g, '');

/** Converte o Markdown dos artigos (mesmo subconjunto da leitura na pagina) em blocos de PDF. */
export function markdownToPdfBlocks(md: string): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  md.trim().split(/\n{2,}/).forEach((raw) => {
    const lines = raw.split('\n').map((l) => l.replace(/\s+$/, '')).filter(Boolean);
    if (lines.length === 0) return;
    if (lines.every((l) => /^!\[[^\]]*\]\([^)]*\)$/.test(l))) return; // figuras ficam de fora
    if (raw.startsWith('# ')) blocks.push({ text: clean(raw.slice(2)), size: 20, font: 'bold', gapBefore: 4 });
    else if (raw.startsWith('## ')) blocks.push({ text: clean(raw.slice(3)), size: 14, font: 'bold', gapBefore: 18 });
    else if (raw.startsWith('### ')) blocks.push({ text: clean(raw.slice(4)), size: 12, font: 'bold', gapBefore: 12 });
    else if (lines.every((l) => l.trimStart().startsWith('|'))) {
      const rows = lines
        .map((l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()))
        .filter((r) => !r.every((c) => /^:?-{3,}:?$/.test(c)));
      rows.forEach((r, i) => blocks.push({ text: clean(r.join('   |   ')), size: 9.5, font: i === 0 ? 'bold' : 'regular', gapBefore: i === 0 ? 8 : 0, indent: 8 }));
    } else if (lines.every((l) => /^[-*] /.test(l))) {
      lines.forEach((l, i) => blocks.push({ text: `•  ${clean(l.slice(2))}`, size: 11, font: 'regular', gapBefore: i === 0 ? 6 : 0, indent: 10 }));
    } else if (lines.every((l) => /^\d+\. /.test(l))) {
      lines.forEach((l, i) => blocks.push({ text: clean(l), size: 11, font: 'regular', gapBefore: i === 0 ? 6 : 0, indent: 10 }));
    } else if (lines.every((l) => /^\[\d+\] /.test(l))) {
      lines.forEach((l, i) => blocks.push({ text: clean(l), size: 9, font: 'regular', gapBefore: i === 0 ? 6 : 0 }));
    } else {
      blocks.push({ text: clean(lines.join(' ')), size: 11, font: 'regular', gapBefore: 6 });
    }
  });
  return blocks;
}

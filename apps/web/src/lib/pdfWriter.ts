import { concatBytes, latin1, toBlob } from "./bytes";
import type { Block, DocModel } from "./blocks";
import { ConvertError } from "./errors";

/* A small PDF writer: enough to place JPEG pictures on pages and to lay out plain text with the built-in Helvetica fonts. */

const A4: [number, number] = [595.28, 841.89];
const LETTER: [number, number] = [612, 792];

class PdfBuilder {
  private objects: Uint8Array[] = [];
  reserve(): number {
    this.objects.push(new Uint8Array());
    return this.objects.length;
  }
  set(id: number, ...parts: (string | Uint8Array)[]) {
    this.objects[id - 1] = concatBytes(parts.map((p) => (typeof p === "string" ? latin1(p) : p)));
  }
  add(...parts: (string | Uint8Array)[]): number {
    const id = this.reserve();
    this.set(id, ...parts);
    return id;
  }
  finish(rootId: number): Uint8Array {
    const out: Uint8Array[] = [latin1("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")];
    let offset = out[0].length;
    const offsets: number[] = [];
    this.objects.forEach((body, i) => {
      offsets.push(offset);
      const chunk = concatBytes([latin1(`${i + 1} 0 obj\n`), body, latin1("\nendobj\n")]);
      out.push(chunk);
      offset += chunk.length;
    });
    const xref = [`xref\n0 ${this.objects.length + 1}\n`, "0000000000 65535 f \n", ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)];
    out.push(latin1(xref.join("")));
    out.push(latin1(`trailer\n<< /Size ${this.objects.length + 1} /Root ${rootId} 0 R >>\nstartxref\n${offset}\n%%EOF\n`));
    return concatBytes(out);
  }
}

const num = (n: number) => (Math.round(n * 100) / 100).toString();

/* ---------- Pictures ---------- */

export interface PdfImage {
  /** A JPEG file (baseline or progressive, 3 colour channels). */
  jpeg: Uint8Array;
  width: number;
  height: number;
}

export interface ImagePdfOptions {
  pageSize: "fit" | "a4" | "letter";
  /** Page margin in points (only used for A4 and Letter). */
  margin: number;
}

export function imagesToPdf(images: PdfImage[], opts: ImagePdfOptions): Uint8Array {
  if (!images.length) throw new ConvertError("Add at least one image.");
  const pdf = new PdfBuilder();
  const catalog = pdf.reserve();
  const pagesId = pdf.reserve();
  const pageIds: number[] = [];

  for (const img of images) {
    const imgId = pdf.add(
      `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>\nstream\n`,
      img.jpeg,
      "\nendstream",
    );
    let pw: number;
    let ph: number;
    let x = 0;
    let y = 0;
    let w: number;
    let h: number;
    if (opts.pageSize === "fit") {
      // Pixels at 96 dpi, kept to a sensible size.
      const scale = Math.min(1, 1440 / Math.max(img.width * 0.75, img.height * 0.75)) * 0.75;
      pw = w = Math.max(36, img.width * scale);
      ph = h = Math.max(36, img.height * scale);
    } else {
      const [shortSide, longSide] = opts.pageSize === "a4" ? A4 : LETTER;
      [pw, ph] = img.width > img.height ? [longSide, shortSide] : [shortSide, longSide];
      const fit = Math.min((pw - 2 * opts.margin) / img.width, (ph - 2 * opts.margin) / img.height);
      w = img.width * fit;
      h = img.height * fit;
      x = (pw - w) / 2;
      y = (ph - h) / 2;
    }
    const content = latin1(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(y)} cm /Im0 Do Q`);
    const contentId = pdf.add(`<< /Length ${content.length} >>\nstream\n`, content, "\nendstream");
    pageIds.push(
      pdf.add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(pw)} ${num(ph)}] /Resources << /XObject << /Im0 ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>`),
    );
  }
  pdf.set(pagesId, `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] >>`);
  pdf.set(catalog, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  return pdf.finish(catalog);
}

/* ---------- Text ---------- */

// Helvetica glyph widths for ASCII 32..126, in 1/1000 em.
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const WIN_ANSI_EXTRA: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

function glyphWidth(byte: number): number {
  if (byte >= 32 && byte <= 126) return HELV[byte - 32];
  if (byte === 0x91 || byte === 0x92) return 222;
  if (byte === 0x93 || byte === 0x94) return 333;
  if (byte === 0x85 || byte === 0x97) return 1000;
  if (byte === 0x95) return 350;
  return 556;
}

/** Turns text into WinAnsi bytes (what the standard PDF fonts draw). Returns the bytes and how many characters had no equivalent. */
export function toWinAnsi(text: string): { bytes: number[]; unsupported: number } {
  const bytes: number[] = [];
  let unsupported = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp === 9 || cp === 0xa0) bytes.push(32);
    else if (cp >= 32 && cp <= 126) bytes.push(cp);
    else if (cp >= 0xa1 && cp <= 0xff) bytes.push(cp);
    else if (WIN_ANSI_EXTRA[cp] !== undefined) bytes.push(WIN_ANSI_EXTRA[cp]);
    else if (cp === 0x2212) bytes.push(0x2d);
    else if (cp === 0x200b || cp === 0x200c || cp === 0x200d || cp === 0xfeff || cp === 0xad || (cp >= 0x300 && cp <= 0x36f)) continue;
    else {
      const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      if (base !== ch && /^[\x20-\x7e]+$/.test(base)) for (const c of base) bytes.push(c.charCodeAt(0));
      else if (cp < 32) continue;
      else {
        bytes.push(63);
        unsupported++;
      }
    }
  }
  return { bytes, unsupported };
}

interface Style {
  size: number;
  leading: number;
  bold: boolean;
  before: number;
  indent: number;
}

const STYLES: Record<Exclude<Block["kind"], "break">, Style> = {
  h1: { size: 22, leading: 28, bold: true, before: 18, indent: 0 },
  h2: { size: 17, leading: 22, bold: true, before: 14, indent: 0 },
  h3: { size: 13.5, leading: 18, bold: true, before: 10, indent: 0 },
  p: { size: 11, leading: 15.5, bold: false, before: 0, indent: 0 },
  li: { size: 11, leading: 15.5, bold: false, before: 0, indent: 16 },
};

const BOLD_FACTOR = 1.06;

function wrap(bytes: number[], size: number, bold: boolean, maxWidth: number): number[][] {
  const unit = (size / 1000) * (bold ? BOLD_FACTOR : 1);
  const width = (word: number[]) => word.reduce((n, b) => n + glyphWidth(b), 0) * unit;
  const words: number[][] = [];
  let cur: number[] = [];
  for (const b of bytes) {
    if (b === 32) {
      if (cur.length) words.push(cur);
      cur = [];
    } else cur.push(b);
  }
  if (cur.length) words.push(cur);

  const lines: number[][] = [];
  let line: number[] = [];
  let lineW = 0;
  const space = glyphWidth(32) * unit;
  const flush = () => {
    if (line.length) lines.push(line);
    line = [];
    lineW = 0;
  };
  for (let word of words) {
    // Break a word that is wider than the whole line.
    while (width(word) > maxWidth) {
      let cut = 1;
      while (cut < word.length && width(word.slice(0, cut + 1)) <= maxWidth) cut++;
      flush();
      lines.push(word.slice(0, cut));
      word = word.slice(cut);
    }
    const w = width(word);
    if (line.length && lineW + space + w > maxWidth) flush();
    if (line.length) {
      line.push(32);
      lineW += space;
    }
    line.push(...word);
    lineW += w;
  }
  flush();
  return lines;
}

const hex = (bytes: number[]) => `<${bytes.map((b) => b.toString(16).padStart(2, "0")).join("")}>`;

/** Lays headings and paragraphs out on A4 pages in Helvetica. Latin-script text only. */
export function blocksToPdf(model: DocModel): Uint8Array {
  const [PW, PH] = A4;
  const margin = 56;
  const maxWidth = PW - 2 * margin;

  let total = 0;
  let bad = 0;
  const blocks: Block[] = [];
  if (model.title) blocks.push({ kind: "h1", text: model.title });
  if (model.author) blocks.push({ kind: "p", text: model.author });
  blocks.push(...model.blocks);
  const prepared = blocks.map((b) => {
    if (b.kind === "break") return { block: b, bytes: [] as number[] };
    const { bytes, unsupported } = toWinAnsi(b.text);
    total += bytes.length;
    bad += unsupported;
    return { block: b, bytes };
  });
  if (total > 0 && bad / total > 0.3) {
    throw new ConvertError("This document uses a writing system that the PDF export cannot draw yet. It supports Latin letters (English, French, Spanish and similar).");
  }

  const pdf = new PdfBuilder();
  const catalog = pdf.reserve();
  const pagesId = pdf.reserve();
  const fontRegular = pdf.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontBold = pdf.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  const pageIds: number[] = [];
  let ops: string[] = [];
  let y = PH - margin;
  let pageHasContent = false;

  const endPage = () => {
    const stream = latin1(ops.join("\n"));
    const contentId = pdf.add(`<< /Length ${stream.length} >>\nstream\n`, stream, "\nendstream");
    pageIds.push(
      pdf.add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`),
    );
    ops = [];
    y = PH - margin;
    pageHasContent = false;
  };

  for (const { block, bytes } of prepared) {
    if (block.kind === "break") {
      if (pageHasContent) endPage();
      continue;
    }
    const st = STYLES[block.kind];
    const bulleted = block.kind === "li";
    const lines = wrap(bytes, st.size, st.bold, maxWidth - st.indent);
    if (!lines.length) continue;
    const spaceBefore = pageHasContent ? st.before : 0;
    // Do not leave a heading alone at the bottom of a page.
    const keep = st.bold ? Math.min(lines.length, 1) + 2 : Math.min(lines.length, 2);
    if (pageHasContent && y - spaceBefore - st.leading * keep < margin) endPage();
    else y -= spaceBefore;

    lines.forEach((line, i) => {
      if (y - st.leading < margin && pageHasContent) endPage();
      y -= st.leading;
      const font = st.bold ? "/F2" : "/F1";
      if (bulleted && i === 0) ops.push(`BT /F1 ${st.size} Tf ${margin + 4} ${num(y)} Td ${hex([0x95])} Tj ET`);
      ops.push(`BT ${font} ${st.size} Tf ${margin + st.indent} ${num(y)} Td ${hex(line)} Tj ET`);
      pageHasContent = true;
    });
    y -= block.kind === "p" || bulleted ? 6 : 4;
  }
  if (pageHasContent || !pageIds.length) endPage();

  pdf.set(pagesId, `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] >>`);
  pdf.set(catalog, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  return pdf.finish(catalog);
}

export const pdfBlob = (bytes: Uint8Array) => toBlob(bytes, "application/pdf");

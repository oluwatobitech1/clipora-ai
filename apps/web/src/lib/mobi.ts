import { concatBytes, latin1, toBlob, utf8 } from "./bytes";
import { type DocModel } from "./blocks";
import { ConvertError } from "./errors";

/* Writes a basic MOBI 6 e-book (the format older Kindles and many readers open). The text is stored uncompressed. */

const RECORD_SIZE = 4096;

function htmlEscape(s: string): string {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (ch === "&") out += "&amp;";
    else if (ch === "<") out += "&lt;";
    else if (ch === ">") out += "&gt;";
    else if (cp === 9 || cp === 10 || cp === 13 || (cp >= 32 && cp < 127)) out += ch;
    else if (cp < 32 || cp === 0xfeff || cp === 0xffff || cp === 0xfffe) continue;
    else out += `&#${cp};`; // keeps the whole book plain ASCII, so records can be cut anywhere
  }
  return out;
}

export function modelToMobiHtml(model: DocModel): string {
  const parts = ['<html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body>'];
  if (model.title) {
    parts.push(`<h1>${htmlEscape(model.title)}</h1>`);
    if (model.author) parts.push(`<p>${htmlEscape(model.author)}</p>`);
    parts.push("<mbp:pagebreak/>");
  }
  for (const b of model.blocks) {
    const t = htmlEscape(b.text);
    if (b.kind === "break") parts.push("<mbp:pagebreak/>");
    else if (b.kind === "h1") parts.push(`<h1>${t}</h1>`);
    else if (b.kind === "h2") parts.push(`<h2>${t}</h2>`);
    else if (b.kind === "h3") parts.push(`<h3>${t}</h3>`);
    else if (b.kind === "li") parts.push(`<p>&#8226; ${t}</p>`);
    else parts.push(`<p>${t}</p>`);
  }
  parts.push("</body></html>");
  return parts.join("\n");
}

const u32 = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0);
  return b;
};

function exthRecord(type: number, data: Uint8Array): Uint8Array {
  return concatBytes([u32(type), u32(8 + data.length), data]);
}

export function modelToMobi(model: DocModel): Uint8Array {
  const text = latin1(modelToMobiHtml(model));
  if (text.length < 40) throw new ConvertError("There is no text to put in the e-book.");
  const records: Uint8Array[] = [];
  for (let at = 0; at < text.length; at += RECORD_SIZE) records.push(text.subarray(at, at + RECORD_SIZE));
  const textRecords = records.length;

  const title = (model.title || "Untitled").slice(0, 120);
  const titleBytes = utf8(title);

  // EXTH block: author (100) and title (503).
  const exthRecords: Uint8Array[] = [];
  if (model.author) exthRecords.push(exthRecord(100, utf8(model.author)));
  exthRecords.push(exthRecord(503, titleBytes));
  const exthBody = concatBytes(exthRecords);
  let exth = concatBytes([latin1("EXTH"), u32(12 + exthBody.length), u32(exthRecords.length), exthBody]);
  while (exth.length % 4) exth = concatBytes([exth, new Uint8Array(1)]);

  const HEADER = 0xf8; // 16 byte PalmDOC header + 232 byte MOBI header
  const nameOffset = HEADER + exth.length;
  const record0 = new Uint8Array(HEADER);
  const v = new DataView(record0.buffer);
  v.setUint16(0, 1); // no compression
  v.setUint32(4, text.length);
  v.setUint16(8, textRecords);
  v.setUint16(10, RECORD_SIZE);
  latin1("MOBI").forEach((b, i) => (record0[0x10 + i] = b));
  v.setUint32(0x14, 232); // header length
  v.setUint32(0x18, 2); // type: book
  v.setUint32(0x1c, 65001); // UTF-8
  v.setUint32(0x20, Math.floor(Math.random() * 0xffffffff));
  v.setUint32(0x24, 6); // version
  for (let o = 0x28; o <= 0x4c; o += 4) v.setUint32(o, 0xffffffff); // unused index pointers
  v.setUint32(0x50, textRecords + 1); // first non-text record
  v.setUint32(0x54, nameOffset);
  v.setUint32(0x58, titleBytes.length);
  v.setUint32(0x5c, 0x409); // locale
  v.setUint32(0x68, 6); // minimum version
  v.setUint32(0x6c, 0xffffffff); // first image record: none
  v.setUint32(0x80, 0x40); // EXTH present
  v.setUint32(0xa4, 0xffffffff);
  v.setUint32(0xa8, 0xffffffff); // no DRM
  v.setUint16(0xc0, 1);
  v.setUint16(0xc2, textRecords);
  v.setUint32(0xc4, 1);
  v.setUint32(0xc8, 0xffffffff);
  v.setUint32(0xcc, 1);
  v.setUint32(0xd0, 0xffffffff);
  v.setUint32(0xd4, 1);
  v.setUint32(0xe0, 0xffffffff);
  v.setUint32(0xe8, 0xffffffff);
  v.setUint32(0xec, 0xffffffff);
  v.setUint32(0xf0, 0); // no extra record data
  v.setUint32(0xf4, 0xffffffff); // no index

  const padding = new Uint8Array(4 + ((4 - ((nameOffset + titleBytes.length) % 4)) % 4));
  const rec0 = concatBytes([record0, exth, titleBytes, padding]);

  const allRecords = [rec0, ...records, Uint8Array.of(0xe9, 0x8e, 0x0d, 0x0a)];
  const listSize = allRecords.length * 8;
  const dataStart = 78 + listSize + 2;

  const db = new Uint8Array(78);
  const dv = new DataView(db.buffer);
  const dbName = title.replace(/[^\x20-\x7e]/g, "_").replace(/\s+/g, "_").slice(0, 27);
  latin1(dbName).forEach((b, i) => (db[i] = b));
  const now = Math.floor(Date.now() / 1000) + 2082844800; // seconds since 1904
  dv.setUint32(36, now);
  dv.setUint32(40, now);
  latin1("BOOKMOBI").forEach((b, i) => (db[60 + i] = b));
  dv.setUint32(68, 2 * allRecords.length - 1);
  dv.setUint16(76, allRecords.length);

  const list = new Uint8Array(listSize);
  const lv = new DataView(list.buffer);
  let offset = dataStart;
  allRecords.forEach((r, i) => {
    lv.setUint32(i * 8, offset);
    lv.setUint32(i * 8 + 4, (2 * i) & 0xffffff); // attributes 0, unique id
    offset += r.length;
  });
  return concatBytes([db, list, new Uint8Array(2), ...allRecords]);
}

export const mobiBlob = (bytes: Uint8Array) => toBlob(bytes, "application/x-mobipocket-ebook");

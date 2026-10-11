import { charCount, cleanText, tidyBlocks, type Block, type DocModel } from "./blocks";
import { ConvertError } from "./errors";
import { readZip } from "./zip";
import { layoutPages, type RawItem } from "./pdfLayout";

/* Readers: turn each supported file type into the same simple DocModel. */

const BLOCK_TAGS = new Set(["p", "li", "pre", "dt", "dd", "caption", "figcaption", "td", "th", "address"]);
const HEADINGS: Record<string, Block["kind"]> = { h1: "h1", h2: "h2", h3: "h3", h4: "h3", h5: "h3", h6: "h3" };
const CONTAINER_TAGS = new Set(["div", "section", "article", "body", "main", "ul", "ol", "dl", "table", "tbody", "thead", "tfoot", "tr", "blockquote", "figure", "aside", "header", "footer", "span", "a", "center", "font", "html"]);
const SKIP_TAGS = new Set(["script", "style", "head", "svg", "img", "image", "nav", "title", "meta", "link", "audio", "video", "object", "iframe"]);

const isElement = (n: Node): n is Element => n.nodeType === 1;

function hasBlockDescendant(el: Element): boolean {
  return el.querySelector("p,li,h1,h2,h3,h4,h5,h6,pre,div,table,blockquote,ul,ol,dl") !== null;
}

/** Walks an HTML/XHTML tree and returns its headings and paragraphs in reading order. */
export function htmlToBlocks(root: Element): Block[] {
  const blocks: Block[] = [];
  const walk = (node: Element) => {
    let inline = "";
    const flushInline = () => {
      const t = cleanText(inline);
      if (t) blocks.push({ kind: "p", text: t });
      inline = "";
    };
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        inline += child.textContent ?? "";
        continue;
      }
      if (!isElement(child)) continue;
      const tag = child.localName.toLowerCase();
      if (SKIP_TAGS.has(tag)) continue;
      if (tag === "br") {
        inline += " ";
        continue;
      }
      if (HEADINGS[tag]) {
        flushInline();
        const t = cleanText(child.textContent ?? "");
        if (t) blocks.push({ kind: HEADINGS[tag], text: t });
      } else if (BLOCK_TAGS.has(tag) && !(tag !== "li" && hasBlockDescendant(child))) {
        flushInline();
        const t = cleanText(child.textContent ?? "");
        if (t) blocks.push({ kind: tag === "li" ? "li" : "p", text: t });
      } else if (CONTAINER_TAGS.has(tag) || BLOCK_TAGS.has(tag)) {
        if (hasBlockDescendant(child)) {
          flushInline();
          walk(child);
        } else inline += " " + (child.textContent ?? "") + " ";
      } else inline += child.textContent ?? "";
    }
    flushInline();
  };
  walk(root);
  return blocks;
}

function parseMarkup(text: string, type: DOMParserSupportedType): Document {
  return new DOMParser().parseFromString(text, type);
}

function parseXhtml(text: string): Document {
  const doc = parseMarkup(text, "application/xhtml+xml");
  if (doc.getElementsByTagName("parsererror").length) return parseMarkup(text, "text/html");
  return doc;
}

const decode = (b: Uint8Array) => new TextDecoder("utf-8").decode(b).replace(/^﻿/, "");

function resolvePath(base: string, href: string): string {
  const clean = decodeURIComponent(href.split("#")[0]);
  const parts = (base ? base.replace(/[^/]*$/, "") + clean : clean).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p && p !== ".") out.push(p);
  }
  return out.join("/");
}

export async function readEpub(bytes: Uint8Array): Promise<DocModel> {
  const files = await readZip(bytes);
  const container = files.get("META-INF/container.xml");
  if (!container) throw new ConvertError("This does not look like an EPUB e-book.");
  const rootfile = parseMarkup(decode(container), "application/xml").getElementsByTagName("rootfile")[0]?.getAttribute("full-path");
  const opfBytes = rootfile ? files.get(rootfile) : undefined;
  if (!rootfile || !opfBytes) throw new ConvertError("This EPUB is missing its book description, so it cannot be read.");
  const opf = parseMarkup(decode(opfBytes), "application/xml");
  if (opf.getElementsByTagName("parsererror").length) throw new ConvertError("This EPUB could not be read.");
  const encryption = files.get("META-INF/encryption.xml");
  if (encryption) {
    // Font obfuscation is harmless. Any other encryption is DRM.
    const algorithms = Array.from(decode(encryption).matchAll(/Algorithm="([^"]+)"/g)).map((m) => m[1]);
    if (algorithms.some((a) => !/obfuscation/i.test(a))) throw new ConvertError("This e-book is protected (DRM) and cannot be converted.");
  }

  const text = (name: string) => cleanText(opf.getElementsByTagNameNS("*", name)[0]?.textContent ?? "");
  const manifest = new Map<string, { href: string; props: string }>();
  for (const item of Array.from(opf.getElementsByTagNameNS("*", "item"))) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) manifest.set(id, { href, props: item.getAttribute("properties") ?? "" });
  }
  const blocks: Block[] = [];
  for (const ref of Array.from(opf.getElementsByTagNameNS("*", "itemref"))) {
    const entry = manifest.get(ref.getAttribute("idref") ?? "");
    if (!entry || /\bnav\b/.test(entry.props)) continue;
    const data = files.get(resolvePath(rootfile, entry.href));
    if (!data) continue;
    const doc = parseXhtml(decode(data));
    const body = doc.body ?? doc.documentElement;
    const chapter = htmlToBlocks(body);
    if (!chapter.length) continue;
    blocks.push(...chapter, { kind: "break", text: "" });
  }
  const tidy = tidyBlocks(blocks);
  if (charCount(tidy) < 20) throw new ConvertError("No readable text was found in this e-book. It may be made of images only.");
  return { title: text("title"), author: text("creator"), blocks: tidy };
}

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export async function readDocx(bytes: Uint8Array): Promise<DocModel> {
  const files = await readZip(bytes);
  const main = files.get("word/document.xml");
  if (!main) throw new ConvertError("This does not look like a Word (.docx) file.");
  const doc = parseMarkup(decode(main), "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new ConvertError("This Word file could not be read.");
  const blocks: Block[] = [];
  let title = "";
  for (const p of Array.from(doc.getElementsByTagNameNS(W_NS, "p"))) {
    let t = "";
    const walk = (n: Node) => {
      for (const c of Array.from(n.childNodes)) {
        if (!isElement(c)) continue;
        if (c.namespaceURI === W_NS && c.localName === "t") t += c.textContent ?? "";
        else if (c.namespaceURI === W_NS && (c.localName === "tab" || c.localName === "br")) t += " ";
        else if (c.localName !== "pPr" && c.localName !== "rPr") walk(c);
      }
    };
    walk(p);
    const text = cleanText(t);
    if (!text) continue;
    const style = p.getElementsByTagNameNS(W_NS, "pStyle")[0]?.getAttributeNS(W_NS, "val") ?? "";
    const isList = p.getElementsByTagNameNS(W_NS, "numPr").length > 0 || /list/i.test(style);
    const level = /heading\s*(\d)/i.exec(style)?.[1];
    if (/^title$/i.test(style) && !title) title = text;
    else if (level) blocks.push({ kind: Number(level) === 1 ? "h1" : Number(level) === 2 ? "h2" : "h3", text });
    else if (isList) blocks.push({ kind: "li", text: text.replace(/^[•\-*]\s*/, "") });
    else blocks.push({ kind: "p", text });
  }
  if (!blocks.length && !title) throw new ConvertError("No text was found in this Word file.");
  return { title, author: "", blocks: tidyBlocks(blocks) };
}

export function readPlainText(text: string, markdown: boolean): DocModel {
  const blocks: Block[] = [];
  for (const chunk of text.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n");
    if (markdown) {
      let para: string[] = [];
      const flush = () => {
        const t = cleanText(para.join(" "));
        if (t) blocks.push({ kind: "p", text: t });
        para = [];
      };
      for (const raw of lines) {
        const line = raw.trim();
        const h = /^(#{1,6})\s+(.*)$/.exec(line);
        const li = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
        const clean = (s: string) => s.replace(/(\*\*|__|`)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
        if (h) {
          flush();
          blocks.push({ kind: h[1].length === 1 ? "h1" : h[1].length === 2 ? "h2" : "h3", text: cleanText(clean(h[2])) });
        } else if (li) {
          flush();
          blocks.push({ kind: "li", text: cleanText(clean(li[1])) });
        } else para.push(clean(line));
      }
      flush();
    } else {
      const t = cleanText(lines.join(" "));
      if (t) blocks.push({ kind: "p", text: t });
    }
  }
  if (!blocks.length) throw new ConvertError("This file has no text in it.");
  return { title: "", author: "", blocks };
}

export function readHtml(text: string): DocModel {
  const doc = parseMarkup(text, "text/html");
  const blocks = tidyBlocks(htmlToBlocks(doc.body));
  if (!blocks.length) throw new ConvertError("No readable text was found in this web page.");
  return { title: cleanText(doc.title), author: "", blocks };
}

/** Reads the text of a PDF with pdf.js and arranges it into paragraphs. */
export async function readPdf(bytes: Uint8Array, onProgress?: (pct: number) => void): Promise<DocModel> {
  const { loadPdf } = await import("./pdfjs");
  const pdf = await loadPdf(bytes);
  const pages: RawItem[][] = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const items: RawItem[] = [];
      for (const it of content.items) {
        if (!("str" in it) || !it.str) continue;
        const t = it.transform as number[];
        items.push({ str: it.str, x: t[4], y: t[5], size: Math.abs(t[3]) || it.height || 10, width: it.width });
      }
      pages.push(items);
      page.cleanup();
      onProgress?.(n / pdf.numPages);
    }
  } finally {
    void pdf.loadingTask.destroy();
  }
  const blocks = tidyBlocks(layoutPages(pages));
  if (charCount(blocks) < 20) {
    throw new ConvertError("No selectable text was found in this PDF. It may be a scan or a photo of a page, which would need text recognition (OCR).");
  }
  return { title: "", author: "", blocks };
}

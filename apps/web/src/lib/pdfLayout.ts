import { cleanText, type Block } from "./blocks";

/** One piece of text from a PDF page, in PDF units (origin bottom-left, so a bigger y is higher on the page). */
export interface RawItem {
  str: string;
  x: number;
  y: number;
  size: number;
  width: number;
}

interface Line {
  text: string;
  y: number;
  x: number;
  right: number;
  size: number;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function buildLines(items: RawItem[]): Line[] {
  const sorted = items.filter((i) => i.str.length > 0).sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: RawItem[][] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last[0].y - item.y) <= Math.max(2, Math.min(last[0].size, item.size || last[0].size) * 0.5)) last.push(item);
    else groups.push([item]);
  }
  const lines: Line[] = [];
  for (const g of groups) {
    g.sort((a, b) => a.x - b.x);
    let text = "";
    let prevEnd = 0;
    g.forEach((it, i) => {
      if (i > 0) {
        const gap = it.x - prevEnd;
        if (gap > it.size * 0.12 && !text.endsWith(" ") && !it.str.startsWith(" ")) text += " ";
      }
      text += it.str;
      prevEnd = it.x + it.width;
    });
    const clean = cleanText(text);
    if (!clean) continue;
    lines.push({
      text: clean,
      y: g[0].y,
      x: g[0].x,
      right: Math.max(...g.map((i) => i.x + i.width)),
      size: Math.max(...g.map((i) => i.size)),
    });
  }
  return lines;
}

const BULLET = /^(?:[•●○▪▫◦·‣⁃*]|[-–—])\s+/;
const ENDS_SENTENCE = /[.!?:;"”')\]]$/;

/** Turns the text items of each page into headings, paragraphs and list items. */
export function layoutPages(pages: RawItem[][]): Block[] {
  const blocks: Block[] = [];
  const sizes = pages.flatMap((p) => p.filter((i) => i.str.trim()).map((i) => Math.round(i.size * 2) / 2));
  const bodySize = median(sizes) || 11;

  for (const items of pages) {
    const lines = buildLines(items);
    if (!lines.length) continue;
    const maxRight = Math.max(...lines.map((l) => l.right));
    const pageBlocks: Block[] = [];
    let prev: Line | null = null;
    let current: { kind: Block["kind"]; text: string } | null = null;

    const flush = () => {
      if (current && current.text.trim()) pageBlocks.push({ kind: current.kind, text: current.text.trim() });
      current = null;
    };

    for (const line of lines) {
      const ratio = line.size / bodySize;
      const isHeading = ratio >= 1.15 && line.text.length < 140;
      const kind: Block["kind"] = isHeading ? (ratio >= 1.5 ? "h1" : ratio >= 1.28 ? "h2" : "h3") : "p";
      const bullet = !isHeading && BULLET.test(line.text);
      const gap = prev ? prev.y - line.y : 0;
      const bigGap = prev ? gap > Math.max(prev.size, line.size) * 1.7 : false;
      const prevShort = prev ? prev.right < maxRight - bodySize * 6 && ENDS_SENTENCE.test(prev.text) : false;

      const currentKind: Block["kind"] | null = current ? (current.kind === "li" ? "p" : current.kind) : null;
      const startNew = !current || kind !== currentKind || bullet || bigGap || prevShort || isHeading;
      if (startNew) {
        flush();
        current = { kind: bullet ? "li" : kind, text: bullet ? line.text.replace(BULLET, "") : line.text };
      } else if (current) {
        if (current.text.endsWith("-") && /^[a-z]/.test(line.text)) current.text = current.text.slice(0, -1) + line.text;
        else current.text += " " + line.text;
      }
      prev = line;
    }
    flush();

    // A paragraph that runs over the page break is joined back together.
    const last = blocks[blocks.length - 1];
    const first = pageBlocks[0];
    if (last && first && last.kind === "p" && first.kind === "p" && !ENDS_SENTENCE.test(last.text) && /^[a-z]/.test(first.text)) {
      last.text += " " + first.text;
      pageBlocks.shift();
    }
    blocks.push(...pageBlocks);
  }
  return blocks;
}

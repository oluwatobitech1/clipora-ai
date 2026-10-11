/** A simple, format-neutral picture of a document: headings and paragraphs. Every document tool reads into this and writes out of it. */
export type BlockKind = "h1" | "h2" | "h3" | "p" | "li" | "break";

export interface Block {
  kind: BlockKind;
  text: string;
}

export interface DocModel {
  title: string;
  author: string;
  blocks: Block[];
}

/** Collapses runs of whitespace (including line breaks and non-breaking spaces) into single spaces. */
export function cleanText(s: string): string {
  return s.replace(/[\s ]+/g, " ").trim();
}

/** Removes characters that are not allowed in XML 1.0 documents. */
export function stripInvalidXml(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "");
}

export function escapeXml(s: string): string {
  return stripInvalidXml(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Drops empty blocks and repeated page breaks, and any break at the very start or end. */
export function tidyBlocks(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    if (b.kind === "break") {
      if (out.length && out[out.length - 1].kind !== "break") out.push(b);
      continue;
    }
    if (!b.text.trim()) continue;
    out.push(b);
  }
  while (out.length && out[out.length - 1].kind === "break") out.pop();
  return out;
}

export function blocksToText(model: DocModel): string {
  const lines: string[] = [];
  if (model.title) lines.push(model.title, "");
  for (const b of model.blocks) {
    if (b.kind === "break") lines.push("", "");
    else if (b.kind === "li") lines.push(`- ${b.text}`);
    else lines.push(b.text, "");
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export const charCount = (blocks: Block[]) => blocks.reduce((n, b) => n + b.text.length, 0);

/** Wraps bytes in a Blob (copying first so the Blob never shares a resizable buffer). */
export function toBlob(data: Uint8Array, type = ""): Blob {
  return new Blob([data.slice().buffer], { type });
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const encoder = new TextEncoder();
export const utf8 = (s: string) => encoder.encode(s);
/** One byte per character (only for text that is already plain ASCII/Latin-1). */
export const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

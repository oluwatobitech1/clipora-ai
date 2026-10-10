// Extractive summarizer: picks the most important sentences from the real transcript. It never rewrites or invents text.

const STOP = new Set(("a about above after again all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its just me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up us very was we were what when where which while who whom why will with would you your yours yeah okay um uh like really actually going get got one two").split(" "));

export interface SummaryResult {
  summary: string;
  takeaways: string[];
  keywords: string[];
}

export type SummaryLength = "short" | "medium" | "long";
const TARGET: Record<SummaryLength, number> = { short: 3, medium: 5, long: 8 };

export function splitSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  let parts = clean.split(/(?<=[.!?…])\s+(?=[\p{Lu}"'(\[\d])/u).map((s) => s.trim()).filter(Boolean);
  // Speech-to-text sometimes has no punctuation: fall back to chunks of about 25 words.
  if (parts.length < 3 && clean.split(" ").length > 60) {
    const words = clean.split(" ");
    parts = [];
    for (let i = 0; i < words.length; i += 25) parts.push(words.slice(i, i + 25).join(" "));
  }
  return parts;
}

function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []).filter((w) => w.length > 2 && !STOP.has(w));
}

/** How central each line is to the main topics of the whole text (higher is more central). */
export function scoreUnits(units: string[]): number[] {
  const freq = new Map<string, number>();
  for (const s of units) for (const w of tokens(s)) freq.set(w, (freq.get(w) ?? 0) + 1);
  const max = Math.max(1, ...freq.values());
  return units.map((s, index) => {
    const t = tokens(s);
    const raw = t.reduce((sum, w) => sum + (freq.get(w) ?? 0) / max, 0);
    const lenFactor = t.length < 4 ? 0.5 : Math.min(1, 14 / t.length) ** 0.3;
    return (t.length ? raw / Math.sqrt(t.length) : 0) * lenFactor * (index < 3 ? 1.1 : 1);
  });
}

export function summarize(text: string, length: SummaryLength = "medium"): SummaryResult | null {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return null;

  const freq = new Map<string, number>();
  for (const s of sentences) for (const w of tokens(s)) freq.set(w, (freq.get(w) ?? 0) + 1);
  const scores = scoreUnits(sentences);
  const scored = sentences.map((s, index) => ({ s, index, score: scores[index] }));

  const want = Math.max(1, Math.min(TARGET[length], Math.ceil(sentences.length / 3)));
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, want).sort((a, b) => a.index - b.index);
  const summary = top.map((x) => x.s).join(" ");

  // Key takeaways: the next-strongest sentences that are not already in the summary, in the order they were said.
  const inSummary = new Set(top.map((x) => x.index));
  const takeCount = Math.min(5, Math.ceil(sentences.length / 4));
  const rest = [...scored].filter((x) => !inSummary.has(x.index)).sort((a, b) => b.score - a.score).slice(0, takeCount).sort((a, b) => a.index - b.index);
  const takeaways = rest.length >= 2 ? rest.map((x) => x.s) : [];

  const keywords = [...freq.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
  return { summary, takeaways, keywords };
}

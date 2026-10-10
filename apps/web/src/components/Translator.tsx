import { useEffect, useMemo, useRef, useState } from "react";
import { buildTranscriptName, formatSrt, formatVtt, type TranscriptSegment } from "@clipora/shared";
import { formatBytes } from "../lib/media";
import { splitSentences } from "../lib/summarize";
import { useBrowserTranscription } from "../lib/useBrowserTranscription";
import { Button, Notice } from "./ui";

// Only language pairs whose free Opus-MT models are published for the browser.
const SOURCES: Record<string, string> = { en: "English", fr: "French", es: "Spanish", de: "German", it: "Italian", ru: "Russian", zh: "Chinese", ja: "Japanese", ko: "Korean", ar: "Arabic" };
const TO_EN = new Set(["fr", "es", "de", "it", "ru", "zh", "ja", "ko", "ar"]);
const FROM_EN: Record<string, string> = { fr: "French", es: "Spanish", de: "German", it: "Italian", ru: "Russian", zh: "Chinese", id: "Indonesian" };
const TARGETS: Record<string, string> = { en: "English", ...FROM_EN };

/** Model steps needed: x to English, English to y, or both (pivoting through English). Null when unavailable. */
function modelsFor(src: string, tgt: string): string[] | null {
  if (src === tgt) return null;
  if (tgt === "en") return TO_EN.has(src) ? [`Xenova/opus-mt-${src}-en`] : null;
  if (src === "en") return FROM_EN[tgt] ? [`Xenova/opus-mt-en-${tgt}`] : null;
  return TO_EN.has(src) && FROM_EN[tgt] ? [`Xenova/opus-mt-${src}-en`, `Xenova/opus-mt-en-${tgt}`] : null;
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Run =
  | { kind: "idle" }
  | { kind: "translating"; downloadPct: number; pct: number; step: number; steps: number }
  | { kind: "done" };

/** Translates a transcript (from a file or pasted) into another language, keeping the original unchanged. All in the browser. */
export function Translator({ file }: { file: File | null }) {
  const stt = useBrowserTranscription();
  const [source, setSource] = useState<"file" | "paste">("file");
  const [pasted, setPasted] = useState("");
  const [from, setFrom] = useState("en");
  const [to, setTo] = useState("fr");
  const [run, setRun] = useState<Run>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [original, setOriginal] = useState<string[]>([]);
  const [translated, setTranslated] = useState<string[]>([]);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [copied, setCopied] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const waitingForSpeech = useRef(false);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const models = modelsFor(from, to);
  const shownError = error ?? stt.error;

  function translate(units: string[], segs: TranscriptSegment[]) {
    if (!models) return;
    setError(null);
    setOriginal(units);
    setSegments(segs);
    setTranslated([]);
    workerRef.current?.terminate();
    const worker = new Worker(new URL("../lib/translateWorker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    setRun({ kind: "translating", downloadPct: 0, pct: 0, step: 0, steps: models.length });
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === "download") setRun((r) => (r.kind === "translating" ? { ...r, downloadPct: m.pct, step: m.step, steps: m.steps } : r));
      else if (m.type === "progress") setRun((r) => (r.kind === "translating" ? { ...r, pct: m.pct, downloadPct: 1 } : r));
      else if (m.type === "result") {
        setTranslated(m.units);
        setRun({ kind: "done" });
        worker.terminate();
      } else if (m.type === "error") {
        setError("Translation failed. Check your internet connection and try again.");
        setRun({ kind: "idle" });
        worker.terminate();
      }
    };
    worker.onerror = () => {
      setError("Translation could not start in this browser. Try the latest Chrome, Edge or Firefox.");
      setRun({ kind: "idle" });
    };
    worker.postMessage({ units, models });
  }

  function startPaste() {
    const units = splitSentences(pasted);
    if (units.length) translate(units, []);
  }

  function startFile() {
    if (!file) return;
    setRun({ kind: "idle" });
    setTranslated([]);
    waitingForSpeech.current = true;
    void stt.start(file);
  }

  // When speech-to-text finishes, translate its lines.
  useEffect(() => {
    if (!waitingForSpeech.current || stt.phase.kind !== "done") return;
    waitingForSpeech.current = false;
    const segs = stt.segments.filter((s) => s.text.trim());
    if (segs.length) translate(segs.map((s) => s.text), segs);
    else setError("No speech was found in this file.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.phase.kind]);

  const originalText = useMemo(() => original.join(" "), [original]);
  const translatedText = useMemo(() => translated.join(" "), [translated]);
  const translatedSegments = useMemo(
    () => (segments.length === translated.length ? segments.map((s, i) => ({ ...s, text: translated[i] })) : []),
    [segments, translated],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy is blocked by your browser. Select the text and copy it manually.");
    }
  }

  const busy = stt.busy || run.kind === "translating";
  const stem = source === "file" && file ? file.name.replace(/\.[^.]+$/, "") : "translation";

  return (
    <div className="space-y-5">
      <Notice>
        Translation runs in your browser, with no account. Each language pair downloads a model once (about 75 MB). Machine translation can contain mistakes, so check anything important. Your original text is never changed.
      </Notice>

      <div className="flex flex-wrap gap-3" role="tablist" aria-label="Where the text comes from">
        <Button variant={source === "file" ? "primary" : "secondary"} onClick={() => setSource("file")}>From the file above</Button>
        <Button variant={source === "paste" ? "primary" : "secondary"} onClick={() => setSource("paste")}>Paste text</Button>
      </div>

      <div className="flex flex-wrap gap-4">
        <div>
          <label htmlFor="from" className="mb-1.5 block text-sm font-semibold">Translate from</label>
          <select id="from" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-xl border border-line bg-white px-3 py-2.5 sm:w-52">
            {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="to" className="mb-1.5 block text-sm font-semibold">Translate to</label>
          <select id="to" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-xl border border-line bg-white px-3 py-2.5 sm:w-52">
            {Object.entries(TARGETS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      {!models && <p className="text-sm font-semibold text-danger">{from === to ? "Choose two different languages." : "That language pair is not available yet. Translating to or from English is always supported for the listed languages."}</p>}

      {source === "file" ? (
        <div>
          <Button onClick={startFile} disabled={!file || busy || !models}>Translate</Button>
          {!file && <p className="mt-3 text-sm text-muted">Choose a file first.</p>}
          {file && !busy && run.kind === "idle" && <p className="mt-3 text-sm text-muted">{file.name} ({formatBytes(file.size)}) stays on your device. Its speech is turned into text here first (about 80 MB model, first time only), then translated. Pick the language spoken in the file under "Translate from".</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <label htmlFor="tpaste" className="block text-sm font-semibold">Text to translate</label>
          <textarea id="tpaste" value={pasted} onChange={(e) => setPasted(e.target.value)} rows={8} className="w-full rounded-xl border border-line bg-white p-3 text-base leading-relaxed" placeholder="Paste text here." />
          <Button onClick={startPaste} disabled={!pasted.trim() || busy || !models}>Translate text</Button>
        </div>
      )}

      {shownError && <p role="alert" className="text-sm font-semibold text-danger">{shownError}</p>}

      {source === "file" && stt.busy && (
        <div role="status" aria-live="polite">
          {stt.phase.kind === "download" && stt.phase.pct > 0 ? <progress className="w-full" max={1} value={stt.phase.pct} aria-label="Speech model download" /> : <progress className="w-full" aria-label="Working" />}
          <p className="mt-2 text-sm text-muted">
            {stt.phase.kind === "prepare" && "Reading the audio from your file. Keep this page open."}
            {stt.phase.kind === "download" && `Loading the speech model${stt.phase.pct > 0 ? `: ${Math.round(stt.phase.pct * 100)}%` : ""}. First time only. Keep this page open.`}
            {stt.phase.kind === "transcribe" && "Turning speech into text. This can take a few minutes. Keep this page open."}
          </p>
        </div>
      )}

      {run.kind === "translating" && (
        <div role="status" aria-live="polite">
          {run.pct === 0 && run.downloadPct < 1 ? <progress className="w-full" max={1} value={run.downloadPct || undefined} aria-label="Translation model download" /> : <progress className="w-full" max={1} value={run.pct} aria-label="Translation progress" />}
          <p className="mt-2 text-sm text-muted">
            {run.pct === 0 && run.downloadPct < 1 ? `Loading the translation model${run.steps > 1 ? ` (${run.step + 1} of ${run.steps})` : ""}${run.downloadPct > 0 ? `: ${Math.round(run.downloadPct * 100)}%` : ""}. First time only.` : `Translating: ${Math.round(run.pct * 100)}%. Keep this page open.`}
          </p>
        </div>
      )}

      {run.kind === "done" && (
        <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="orig" className="mb-1.5 block text-sm font-semibold">Original ({SOURCES[from]})</label>
              <textarea id="orig" readOnly value={originalText} rows={12} className="w-full rounded-xl border border-line bg-surface p-3 text-base leading-relaxed" />
            </div>
            <div>
              <label htmlFor="trans" className="mb-1.5 block text-sm font-semibold">Translation ({TARGETS[to]})</label>
              <textarea id="trans" readOnly value={translatedText} rows={12} className="w-full rounded-xl border border-line bg-white p-3 text-base leading-relaxed" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={copy}>{copied ? "Copied" : "Copy translation"}</Button>
            <Button variant="secondary" onClick={() => download(buildTranscriptName(`${stem} ${to}`, "txt"), translatedText, "text/plain")}>Download TXT</Button>
            {translatedSegments.length > 0 && (
              <>
                <Button variant="secondary" onClick={() => download(buildTranscriptName(`${stem} ${to}`, "srt"), formatSrt(translatedSegments), "application/x-subrip")}>Download SRT</Button>
                <Button variant="secondary" onClick={() => download(buildTranscriptName(`${stem} ${to}`, "vtt"), formatVtt(translatedSegments), "text/vtt")}>Download VTT</Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

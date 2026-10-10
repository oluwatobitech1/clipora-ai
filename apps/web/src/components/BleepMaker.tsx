import { useEffect, useMemo, useState } from "react";
import type { TranscriptSegment } from "@framevox/shared";
import { getFfmpeg, resetFfmpeg } from "../lib/browserFfmpeg";
import { formatBytes } from "../lib/media";
import { fmtClock } from "../lib/time";
import { isVideoFile } from "../lib/useObjectUrl";
import { useBrowserTranscription } from "../lib/useBrowserTranscription";
import { SpeechProgress } from "./SpeechProgress";
import { Button, Notice } from "./ui";

interface Range { start: number; end: number; label: string }
type Mode = "beep" | "silence";

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Finds the typed words or phrases in the speech and returns the time ranges to cover. */
function findRanges(segments: TranscriptSegment[], wordLevel: boolean, terms: string[]): Range[] {
  const tokens: { w: string; start: number; end: number }[] = [];
  for (const s of segments) {
    const parts = s.text.split(/\s+/).map(norm).filter(Boolean);
    // In sentence-timing mode every word of a sentence shares the sentence's time range.
    for (const p of wordLevel ? [norm(s.text)].filter(Boolean) : parts) tokens.push({ w: p, start: s.start, end: s.end });
  }
  const out: Range[] = [];
  for (const term of terms) {
    const want = term.split(/\s+/).map(norm).filter(Boolean);
    if (want.length === 0) continue;
    for (let i = 0; i + want.length <= tokens.length; i++) {
      if (want.every((w, k) => tokens[i + k].w === w)) {
        out.push({ start: Math.max(0, tokens[i].start - 0.08), end: tokens[i + want.length - 1].end + 0.08, label: term });
      }
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

export function BleepMaker({ file }: { file: File | null }) {
  const stt = useBrowserTranscription();
  const [terms, setTerms] = useState("");
  const [mode, setMode] = useState<Mode>("beep");
  const [off, setOff] = useState<Set<number>>(new Set());
  const [working, setWorking] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; name: string; size: number } | null>(null);

  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const list = useMemo(() => terms.split(/[,\n]/).map((t) => t.trim()).filter(Boolean), [terms]);
  const ranges = useMemo(() => (stt.phase.kind === "done" ? findRanges(stt.segments, stt.wordLevel, list) : []), [stt.phase.kind, stt.segments, stt.wordLevel, list]);
  const chosen = ranges.filter((_, i) => !off.has(i));
  const video = isVideoFile(file);

  async function make() {
    if (!file || chosen.length === 0) return;
    setError(null);
    setWorking(true);
    setPct(0);
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    try {
      const ff = await getFfmpeg();
      const ext = (/\.[a-z0-9]+$/i.exec(file.name)?.[0] ?? ".mp4").toLowerCase();
      const inName = `bleepsrc${ext}`;
      await ff.writeFile(inName, new Uint8Array(await file.arrayBuffer()));
      const expr = chosen.map((r) => `between(t,${r.start.toFixed(3)},${r.end.toFixed(3)})`).join("+");
      const graph = mode === "silence"
        ? `[0:a:0]volume=enable='${expr}':volume=0[out]`
        : `[0:a:0]aresample=44100,aformat=channel_layouts=stereo,volume=enable='${expr}':volume=0[m];aevalsrc='0.25*sin(2*PI*1000*t)*(${expr})':s=44100:d=${Math.ceil(stt.seconds) + 2},aformat=channel_layouts=stereo[b];[m][b]amix=inputs=2:duration=first:normalize=0[out]`;
      const keepMp4 = /\.(mp4|mov|m4v)$/i.test(ext);
      const outExt = video ? (keepMp4 ? "mp4" : "mkv") : "mp3";
      const out = `bleeped.${outExt}`;
      const args = video
        ? ["-i", inName, "-filter_complex", graph, "-map", "0:v?", "-map", "[out]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", out]
        : ["-i", inName, "-filter_complex", graph, "-map", "[out]", "-c:a", "libmp3lame", "-q:a", "2", out];
      const onProgress = ({ progress }: { progress: number }) => setPct(Math.min(1, Math.max(0, progress)));
      ff.on("progress", onProgress);
      const code = await ff.exec(args);
      ff.off("progress", onProgress);
      await ff.deleteFile(inName).catch(() => {});
      if (code !== 0) throw new Error("The file could not be processed. Try an MP4 or MP3 version of it.");
      const data = (await ff.readFile(out)) as Uint8Array;
      await ff.deleteFile(out).catch(() => {});
      const blob = new Blob([data.slice().buffer], { type: video ? (keepMp4 ? "video/mp4" : "video/x-matroska") : "audio/mpeg" });
      setResult({ url: URL.createObjectURL(blob), name: `${file.name.replace(/\.[^.]+$/, "")}-bleeped.${outExt}`, size: blob.size });
    } catch (err) {
      resetFfmpeg();
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setWorking(false);
    }
  }

  const ready = stt.phase.kind === "done";

  return (
    <div className="space-y-5">
      <Notice>
        Bleep Maker finds words you choose, such as names or phone numbers, and covers them with a beep or silence. It all happens on your device, so the file is never uploaded. Automatic speech recognition can miss a word, so always listen to the result before you share it.
      </Notice>

      <div>
        <label htmlFor="terms" className="mb-1.5 block text-sm font-semibold">Words or phrases to cover (separate with commas)</label>
        <textarea id="terms" value={terms} onChange={(e) => { setTerms(e.target.value); setOff(new Set()); }} rows={2} placeholder="for example: John Smith, 0803, my address" className="w-full rounded-xl border border-line bg-white p-3 text-base" />
      </div>
      <div>
        <label htmlFor="bmode" className="mb-1.5 block text-sm font-semibold">Cover with</label>
        <select id="bmode" value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="w-full rounded-xl border border-line bg-white px-3 py-2.5 sm:w-60">
          <option value="beep">A beep</option>
          <option value="silence">Silence</option>
        </select>
      </div>

      <div>
        <Button onClick={() => { setResult(null); setOff(new Set()); if (file) void stt.start(file, { words: true }); }} disabled={!file || stt.busy || working}>Find the words</Button>
        {!file && <p className="mt-3 text-sm text-muted">Choose a file first.</p>}
        {file && stt.phase.kind === "idle" && <p className="mt-3 text-sm text-muted">{file.name} ({formatBytes(file.size)}) is checked on your device. The first time, a speech model of about 80 MB downloads once.</p>}
      </div>

      {(stt.error || error) && <p role="alert" className="text-sm font-semibold text-danger">{stt.error ?? error}</p>}
      <SpeechProgress phase={stt.phase} doing="Listening for your words" />

      {ready && (
        <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
          {!stt.wordLevel && <Notice tone="error">This browser could not time each word, so whole sentences containing your words will be covered. Check the list below and untick any you do not want covered.</Notice>}
          {list.length === 0 && <p className="text-sm text-muted">Type the words to cover above. The matches appear here straight away.</p>}
          {list.length > 0 && ranges.length === 0 && <p className="text-sm font-semibold">No match found. Check the spelling, or try a shorter word.</p>}
          {ranges.length > 0 && (
            <>
              <p className="text-sm text-muted">{ranges.length} match{ranges.length === 1 ? "" : "es"} found. Untick any you want to keep.</p>
              <ul className="space-y-2">
                {ranges.map((r, i) => (
                  <li key={i}>
                    <label className="flex items-center gap-3 rounded-xl border border-line p-3">
                      <input type="checkbox" checked={!off.has(i)} onChange={(e) => setOff((prev) => { const n = new Set(prev); if (e.target.checked) n.delete(i); else n.add(i); return n; })} />
                      <span className="font-semibold">{r.label}</span>
                      <span className="text-sm text-muted">{fmtClock(r.start)} to {fmtClock(r.end)}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <Button onClick={() => void make()} disabled={working || chosen.length === 0}>{working ? `Working ${Math.round(pct * 100)}%` : "Create the covered file"}</Button>
            </>
          )}
          {result && (
            <div className="space-y-3" role="status" aria-live="polite">
              <p className="font-semibold">Done. Listen to it before you share it.</p>
              {video ? <video controls src={result.url} className="w-full rounded-xl bg-black" /> : <audio controls src={result.url} className="w-full" />}
              <a href={result.url} download={result.name} className="inline-block rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700">Download ({formatBytes(result.size)})</a>
              {video && !/\.(mp4|mov|m4v)$/i.test(file?.name ?? "") && <p className="text-sm text-muted">Your file was saved as MKV. It plays in VLC and most computers, but some phones may not play it.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

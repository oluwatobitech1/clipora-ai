import { useMemo } from "react";
import type { TranscriptSegment } from "@clipora/shared";
import { formatBytes } from "../lib/media";
import { fmtClock } from "../lib/time";
import { useBrowserTranscription } from "../lib/useBrowserTranscription";
import { SpeechProgress } from "./SpeechProgress";
import { Button, Notice } from "./ui";

const FILLERS: [string, RegExp][] = [
  ["um, uh, er, hmm", /\b(?:u+m+|u+h+|e+r+m?|h+m+)\b/gi],
  ["you know", /\byou know\b/gi],
  ["I mean", /\bi mean\b/gi],
  ["basically", /\bbasically\b/gi],
  ["actually", /\bactually\b/gi],
  ["literally", /\bliterally\b/gi],
  ["sort of, kind of", /\b(?:sort|kind) of\b/gi],
  ["like (may include normal uses)", /\blike\b/gi],
];
const PAUSE = 1.2;

function analyse(segs: TranscriptSegment[]) {
  const usable = segs.filter((s) => s.text.trim());
  if (usable.length === 0) return null;
  const fullText = usable.map((s) => s.text).join(" ");
  const words = fullText.split(/\s+/).filter(Boolean).length;
  const first = usable[0].start;
  const last = usable[usable.length - 1].end;
  const duration = Math.max(1, last - first);
  const wpm = Math.round((words / duration) * 60);

  const gaps: number[] = [];
  for (let i = 1; i < usable.length; i++) gaps.push(usable[i].start - usable[i - 1].end);
  const pauses = gaps.filter((g) => g >= PAUSE);
  const longest = Math.max(0, ...gaps);
  const pauseTotal = pauses.reduce((a, b) => a + b, 0);

  const fillers = FILLERS.map(([label, re]) => ({ label, count: (fullText.match(re) ?? []).length })).filter((f) => f.count > 0);
  const fillerTotal = fillers.reduce((a, f) => a + f.count, 0);
  const repeats = (fullText.match(/\b([\p{L}']+)\s+\1\b/giu) ?? []).length;

  const minutes: { label: string; wpm: number }[] = [];
  for (let b = 0; b * 60 < duration; b++) {
    const lo = first + b * 60;
    const hi = Math.min(last, lo + 60);
    if (hi - lo < 20) continue;
    const w = usable.filter((s) => (s.start + s.end) / 2 >= lo && (s.start + s.end) / 2 < hi).reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);
    minutes.push({ label: `${fmtClock(lo - first)} to ${fmtClock(hi - first)}`, wpm: Math.round((w / (hi - lo)) * 60) });
  }

  const tips: string[] = [];
  if (wpm > 175) tips.push("You speak quickly. Slow down a little and breathe between ideas so listeners can keep up.");
  else if (wpm < 105) tips.push("Your pace is slow. If this is a presentation, a slightly quicker pace can keep attention.");
  else tips.push("Your speaking speed is in a comfortable range for most audiences.");
  const perMin = fillerTotal / (duration / 60);
  if (perMin >= 4) tips.push("You use many filler words. Try pausing silently instead of saying a filler word.");
  else if (fillerTotal > 0) tips.push("Filler words are low. Keep replacing them with short, calm pauses.");
  if (longest >= 4) tips.push(`Your longest pause was ${longest.toFixed(1)} seconds. Pauses help emphasis, but long ones can lose listeners.`);
  if (pauses.length === 0 && duration > 60) tips.push("You almost never pause. Short pauses after key points help people absorb them.");
  if (repeats >= 3) tips.push("You repeated some words back to back, which usually happens when thinking ahead. Slow down slightly.");

  return { words, duration, wpm, pauses: pauses.length, longest, pauseTotal, fillers, fillerTotal, perMin, repeats, minutes, tips };
}

export function SpeakingCoach({ file }: { file: File | null }) {
  const stt = useBrowserTranscription();
  const report = useMemo(() => (stt.phase.kind === "done" ? analyse(stt.segments) : null), [stt.phase.kind, stt.segments]);

  function download() {
    if (!report) return;
    const lines = [
      "SPEAKING REPORT",
      `Length: ${fmtClock(report.duration)} | Words: ${report.words} | Speed: ${report.wpm} words per minute`,
      `Pauses of ${PAUSE}s or more: ${report.pauses} | Longest pause: ${report.longest.toFixed(1)}s`,
      `Filler words: ${report.fillerTotal} (${report.perMin.toFixed(1)} per minute)`,
      ...report.fillers.map((f) => `  - ${f.label}: ${f.count}`),
      `Repeated words in a row: ${report.repeats}`,
      "", "TIPS", ...report.tips.map((t) => `- ${t}`), "",
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file ? file.name.replace(/\.[^.]+$/, "") : "speaking"}-report.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const stat = (label: string, value: string) => (
    <div className="rounded-xl border border-line p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <Notice>
        Speaking Coach listens to a recording of you and reports your speaking speed, pauses and filler words, all in your browser with no upload. Speech recognition often leaves out short sounds like "um" and "uh", so those counts can be lower than the real number.
      </Notice>
      <div>
        <Button onClick={() => file && void stt.start(file)} disabled={!file || stt.busy}>Analyse my speaking</Button>
        {!file && <p className="mt-3 text-sm text-muted">Choose a file first.</p>}
        {file && stt.phase.kind === "idle" && <p className="mt-3 text-sm text-muted">{file.name} ({formatBytes(file.size)}) stays on your device. Use a recording of just you for the best result.</p>}
      </div>
      {stt.error && <p role="alert" className="text-sm font-semibold text-danger">{stt.error}</p>}
      <SpeechProgress phase={stt.phase} doing="Listening to your speaking" />

      {stt.phase.kind === "done" && !report && <Notice>No speech was found in this file.</Notice>}

      {report && (
        <div className="space-y-6 rounded-2xl border border-line bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {stat("Speed", `${report.wpm} wpm`)}
            {stat("Filler words", `${report.fillerTotal}`)}
            {stat("Long pauses", `${report.pauses}`)}
            {stat("Length", fmtClock(report.duration))}
          </div>

          <section>
            <h2 className="text-lg font-bold">Tips</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 leading-relaxed">{report.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </section>

          {report.fillers.length > 0 && (
            <section>
              <h2 className="text-lg font-bold">Filler words</h2>
              <ul className="mt-2 space-y-1">{report.fillers.map((f) => <li key={f.label}>{f.label}: <strong>{f.count}</strong></li>)}</ul>
            </section>
          )}

          {report.minutes.length > 1 && (
            <section>
              <h2 className="text-lg font-bold">Speed through your talk</h2>
              <ul className="mt-2 space-y-2">
                {report.minutes.map((m) => (
                  <li key={m.label} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 text-muted">{m.label}</span>
                    <span className="h-3 rounded-full bg-brand-600" style={{ width: `${Math.min(100, (m.wpm / 220) * 100)}%` }} aria-hidden="true" />
                    <span className="font-semibold">{m.wpm} wpm</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-muted">Most audiences follow speech comfortably at about 120 to 170 words per minute.</p>
            </section>
          )}

          <Button variant="secondary" onClick={download}>Download report (TXT)</Button>
        </div>
      )}
    </div>
  );
}

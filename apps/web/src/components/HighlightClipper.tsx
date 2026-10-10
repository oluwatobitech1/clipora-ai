import { useEffect, useMemo, useRef, useState } from "react";
import type { TranscriptSegment } from "@framevox/shared";
import { getFfmpeg, resetFfmpeg } from "../lib/browserFfmpeg";
import { formatBytes } from "../lib/media";
import { scoreUnits } from "../lib/summarize";
import { fmtClock } from "../lib/time";
import { isVideoFile, useObjectUrl } from "../lib/useObjectUrl";
import { useBrowserTranscription } from "../lib/useBrowserTranscription";
import { Player } from "./Player";
import { SpeechProgress } from "./SpeechProgress";
import { Button, Notice } from "./ui";

interface Clip { id: number; start: number; end: number; text: string }
interface Made { url: string; name: string; size: number }

const MIN_LEN = 12;
const MAX_LEN = 35;

/** Picks the moments that talk most about the main topics, as short non-overlapping clips. */
function pickClips(segs: TranscriptSegment[], count = 5): Clip[] {
  const usable = segs.filter((s) => s.text.trim());
  if (usable.length === 0) return [];
  const scores = scoreUnits(usable.map((s) => s.text));
  const order = usable.map((_, k) => k).sort((a, b) => scores[b] - scores[a]);
  const used = new Set<number>();
  const clips: Omit<Clip, "id">[] = [];
  for (const k of order) {
    if (clips.length >= count) break;
    if (used.has(k)) continue;
    let lo = k, hi = k;
    const len = () => usable[hi].end - usable[lo].start;
    while (len() < MIN_LEN) {
      if (hi + 1 < usable.length && !used.has(hi + 1)) hi++;
      else if (lo - 1 >= 0 && !used.has(lo - 1)) lo--;
      else break;
    }
    if (len() > MAX_LEN && lo < hi) hi = Math.max(lo, hi - 1);
    for (let x = lo; x <= hi; x++) used.add(x);
    clips.push({ start: Math.max(0, usable[lo].start - 0.3), end: usable[hi].end + 0.3, text: usable.slice(lo, hi + 1).map((s) => s.text).join(" ") });
  }
  return clips.sort((a, b) => a.start - b.start).map((c, i) => ({ ...c, id: i + 1 }));
}

export function HighlightClipper({ file }: { file: File | null }) {
  const stt = useBrowserTranscription();
  const url = useObjectUrl(file);
  const video = isVideoFile(file);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const stopAt = useRef<number | null>(null);
  const [made, setMade] = useState<Record<number, Made>>({});
  const [cutting, setCutting] = useState<number | null>(null);
  const [cutPct, setCutPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputName = useRef<string | null>(null);

  const clips = useMemo(() => (stt.phase.kind === "done" ? pickClips(stt.segments) : []), [stt.phase.kind, stt.segments]);

  useEffect(() => () => { Object.values(made).forEach((m) => URL.revokeObjectURL(m.url)); }, [made]);

  function preview(c: Clip) {
    const m = mediaRef.current;
    if (!m) return;
    m.currentTime = c.start;
    stopAt.current = c.end;
    void m.play().catch(() => {});
    m.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function cut(c: Clip) {
    if (!file) return;
    setError(null);
    setCutting(c.id);
    setCutPct(0);
    try {
      const ff = await getFfmpeg();
      const ext = (/\.[a-z0-9]+$/i.exec(file.name)?.[0] ?? ".mp4").toLowerCase();
      const inName = `clipsrc${ext}`;
      if (inputName.current !== `${inName}:${file.name}:${file.size}`) {
        await ff.writeFile(inName, new Uint8Array(await file.arrayBuffer()));
        inputName.current = `${inName}:${file.name}:${file.size}`;
      }
      const out = video ? `clip${c.id}.mp4` : `clip${c.id}.mp3`;
      const onProgress = ({ progress }: { progress: number }) => setCutPct(Math.min(1, Math.max(0, progress)));
      ff.on("progress", onProgress);
      const dur = (c.end - c.start).toFixed(2);
      const args = video
        ? ["-ss", c.start.toFixed(2), "-i", inName, "-t", dur, "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out]
        : ["-ss", c.start.toFixed(2), "-i", inName, "-t", dur, "-c:a", "libmp3lame", "-q:a", "4", out];
      const code = await ff.exec(args);
      ff.off("progress", onProgress);
      if (code !== 0) throw new Error("This clip could not be cut. Try a different file format such as MP4.");
      const data = (await ff.readFile(out)) as Uint8Array;
      await ff.deleteFile(out).catch(() => {});
      const blob = new Blob([data.slice().buffer], { type: video ? "video/mp4" : "audio/mpeg" });
      const stem = file.name.replace(/\.[^.]+$/, "");
      setMade((all) => ({ ...all, [c.id]: { url: URL.createObjectURL(blob), name: `${stem}-highlight-${c.id}.${video ? "mp4" : "mp3"}`, size: blob.size } }));
    } catch (err) {
      resetFfmpeg();
      inputName.current = null;
      setError(err instanceof Error ? err.message : "Something went wrong while cutting. Please try again.");
    } finally {
      setCutting(null);
    }
  }

  const ready = stt.phase.kind === "done";

  return (
    <div className="space-y-5">
      <Notice>
        Highlight Clipper finds the moments that talk most about the main topics of your video, then cuts them into short clips on your device. Nothing is uploaded and no account is needed. It judges by topic, not by emotion, so always preview each clip.
      </Notice>
      <div>
        <Button onClick={() => { setMade({}); inputName.current = null; if (file) void stt.start(file); }} disabled={!file || stt.busy || cutting !== null}>Find highlights</Button>
        {!file && <p className="mt-3 text-sm text-muted">Choose a file first.</p>}
        {file && stt.phase.kind === "idle" && <p className="mt-3 text-sm text-muted">{file.name} ({formatBytes(file.size)}) stays on your device. Videos with clear speech work best.</p>}
      </div>
      {(stt.error || error) && <p role="alert" className="text-sm font-semibold text-danger">{stt.error ?? error}</p>}
      <SpeechProgress phase={stt.phase} doing="Listening for the best moments" />

      {ready && clips.length === 0 && <Notice>No speech was found in this file.</Notice>}

      {ready && clips.length > 0 && url && (
        <div className="space-y-5 rounded-2xl border border-line bg-white p-5">
          <Player
            url={url}
            video={video}
            mediaRef={mediaRef}
            onTime={(e) => {
              if (stopAt.current !== null && e.currentTarget.currentTime >= stopAt.current) {
                e.currentTarget.pause();
                stopAt.current = null;
              }
            }}
          />
          <p className="text-sm text-muted">{clips.length} highlight{clips.length === 1 ? "" : "s"} found, in the order they appear. Cutting a video clip can take a minute on a slow device.</p>
          <ul className="space-y-3">
            {clips.map((c) => {
              const m = made[c.id];
              return (
                <li key={c.id} className="rounded-xl border border-line p-4">
                  <p className="text-sm font-semibold">Highlight {c.id}: {fmtClock(c.start)} to {fmtClock(c.end)} ({Math.round(c.end - c.start)} s)</p>
                  <p className="mt-2 leading-relaxed">{c.text}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button variant="secondary" onClick={() => preview(c)}>Preview</Button>
                    <Button onClick={() => void cut(c)} disabled={cutting !== null}>{cutting === c.id ? `Cutting ${Math.round(cutPct * 100)}%` : m ? "Cut again" : "Cut this clip"}</Button>
                    {m && (
                      <a href={m.url} download={m.name} className="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700">Download ({formatBytes(m.size)})</a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

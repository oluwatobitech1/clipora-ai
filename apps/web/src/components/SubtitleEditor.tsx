import { useEffect, useMemo, useRef, useState } from "react";
import { buildTranscriptName, formatSrt, formatVtt } from "@framevox/shared";
import { formatBytes } from "../lib/media";
import { useBrowserTranscription } from "../lib/useBrowserTranscription";
import { Button, Notice } from "./ui";

interface Cue { id: number; start: number; end: number; text: string }

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

const num = (v: string) => (Number.isFinite(parseFloat(v)) ? Math.max(0, parseFloat(v)) : 0);

/** Generates subtitles in the visitor's browser, lets them fix the text and timing, then exports SRT or VTT. */
export function SubtitleEditor({ file }: { file: File | null }) {
  const { phase, busy, error, segments, start } = useBrowserTranscription();
  const [cues, setCues] = useState<Cue[]>([]);
  const nextId = useRef(1);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    nextId.current = segments.length + 1;
    setCues(segments.map((s, i) => ({ id: i + 1, start: s.start, end: s.end, text: s.text })));
  }, [segments]);

  const isVideo = !!file && (file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv)$/i.test(file.name));
  const videoUrl = useMemo(() => (file && isVideo ? URL.createObjectURL(file) : null), [file, isVideo]);
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);

  const sorted = useMemo(() => [...cues].sort((a, b) => a.start - b.start), [cues]);
  const problems = cues.filter((c) => c.text.trim() && c.end <= c.start).length;
  const vttUrl = useMemo(() => {
    if (!videoUrl || cues.length === 0 || problems) return null;
    return URL.createObjectURL(new Blob([formatVtt(sorted)], { type: "text/vtt" }));
  }, [videoUrl, cues, sorted, problems]);
  useEffect(() => () => { if (vttUrl) URL.revokeObjectURL(vttUrl); }, [vttUrl]);

  function update(id: number, patch: Partial<Cue>) {
    setCues((all) => all.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function remove(id: number) {
    setCues((all) => all.filter((c) => c.id !== id));
  }
  function add() {
    const last = sorted[sorted.length - 1];
    const s = last ? last.end : 0;
    setCues((all) => [...all, { id: nextId.current++, start: s, end: s + 2, text: "" }]);
  }
  function seek(t: number) {
    if (videoRef.current) {
      videoRef.current.currentTime = t;
      void videoRef.current.play().catch(() => {});
    }
  }

  const stem = file ? file.name.replace(/\.[^.]+$/, "") : "subtitles";
  const ready = phase.kind === "done";

  return (
    <div className="space-y-5">
      <Notice>
        Subtitles are made in your browser, with no account. The first time, it downloads a speech model once (about 80 MB), so you need internet then. Try a short clip first. Always read the result: automatic subtitles can contain mistakes.
      </Notice>
      <div>
        <Button onClick={() => file && start(file)} disabled={!file || busy}>Generate subtitles</Button>
        {!file && <p className="mt-3 text-sm text-muted">Choose a file first.</p>}
        {file && phase.kind === "idle" && <p className="mt-3 text-sm text-muted">{file.name} ({formatBytes(file.size)}) stays on your device. Nothing is uploaded.</p>}
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}

      {busy && (
        <div role="status" aria-live="polite">
          {phase.kind === "download" && phase.pct > 0 ? <progress className="w-full" max={1} value={phase.pct} aria-label="Model download" /> : <progress className="w-full" aria-label="Working" />}
          <p className="mt-2 text-sm text-muted">
            {phase.kind === "prepare" && "Reading the audio from your file. Keep this page open."}
            {phase.kind === "download" && `Loading the speech model${phase.pct > 0 ? `: ${Math.round(phase.pct * 100)}%` : ""}. First time only. Keep this page open.`}
            {phase.kind === "transcribe" && "Creating subtitles. This can take a few minutes. Keep this page open."}
          </p>
        </div>
      )}

      {ready && cues.length === 0 && <Notice>No speech was found in this file.</Notice>}

      {ready && cues.length > 0 && (
        <div className="space-y-5 rounded-2xl border border-line bg-white p-5">
          {videoUrl && vttUrl && (
            <video ref={videoRef} controls className="w-full rounded-xl bg-black" src={videoUrl}>
              <track key={vttUrl} kind="subtitles" srcLang="en" label="Your subtitles" src={vttUrl} default />
            </video>
          )}

          <p className="text-sm text-muted">Edit any line. Times are in seconds. Changes show in the preview straight away.</p>

          <ul className="space-y-3">
            {sorted.map((c) => {
              const bad = c.text.trim() !== "" && c.end <= c.start;
              return (
                <li key={c.id} className="rounded-xl border border-line p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-xs font-semibold">
                      Start
                      <input type="number" min={0} step={0.1} value={Number(c.start.toFixed(2))} onChange={(e) => update(c.id, { start: num(e.target.value) })} className="mt-1 block w-24 rounded-lg border border-line px-2 py-1.5 text-sm" />
                    </label>
                    <label className="text-xs font-semibold">
                      End
                      <input type="number" min={0} step={0.1} value={Number(c.end.toFixed(2))} onChange={(e) => update(c.id, { end: num(e.target.value) })} className="mt-1 block w-24 rounded-lg border border-line px-2 py-1.5 text-sm" />
                    </label>
                    {videoUrl && <Button variant="secondary" onClick={() => seek(c.start)}>Play</Button>}
                    <Button variant="secondary" onClick={() => remove(c.id)}>Delete</Button>
                  </div>
                  <textarea
                    aria-label={`Subtitle text at ${c.start.toFixed(1)} seconds`}
                    value={c.text}
                    onChange={(e) => update(c.id, { text: e.target.value })}
                    rows={2}
                    className="mt-2 w-full rounded-lg border border-line p-2 text-base"
                  />
                  {bad && <p role="alert" className="mt-1 text-sm font-semibold text-danger">End time must be after the start time.</p>}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={add}>Add a line</Button>
            <Button disabled={problems > 0} onClick={() => download(buildTranscriptName(stem, "srt"), formatSrt(sorted), "application/x-subrip")}>Download SRT</Button>
            <Button disabled={problems > 0} onClick={() => download(buildTranscriptName(stem, "vtt"), formatVtt(sorted), "text/vtt")}>Download VTT</Button>
          </div>
          {problems > 0 && <p className="text-sm font-semibold text-danger">Fix the lines marked in red to enable downloads.</p>}
        </div>
      )}
    </div>
  );
}

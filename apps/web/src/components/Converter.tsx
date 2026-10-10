import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { ACCEPT_ATTRIBUTE, MAX_UPLOAD_MB, SUPPORTED_EXTENSIONS_LABEL, buildDownloadName, validateMediaFile, type AudioOutputFormat } from "@framevox/shared";
import { getFfmpeg, resetFfmpeg } from "../lib/browserFfmpeg";
import { formatBytes, formatDuration, readMediaDuration } from "../lib/media";
import { Button, buttonClass, Notice } from "./ui";

const FORMATS: { id: AudioOutputFormat; label: string; hint: string }[] = [
  { id: "mp3", label: "MP3", hint: "Plays everywhere" },
  { id: "m4a", label: "M4A", hint: "Fastest, great on iPhone" },
  { id: "wav", label: "WAV", hint: "Lossless, big file" },
];
const CODEC: Record<AudioOutputFormat, string[]> = {
  mp3: ["-c:a", "libmp3lame", "-q:a", "2"],
  wav: ["-c:a", "pcm_s16le"],
  m4a: ["-c:a", "aac", "-b:a", "192k"],
};
const MIME: Record<AudioOutputFormat, string> = { mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4" };
const COPY_FALLBACK_MAX_MB = 300;

class ConvertError extends Error {}

/** Pulls the audio out of a video inside the browser. The file is read in place (never copied or uploaded). */
async function extractAudio(file: File, format: AudioOutputFormat, onProgress: (pct: number) => void): Promise<Blob> {
  const ff = await getFfmpeg();
  const dir = "/in";
  let input = "input";
  let mounted = false;

  try {
    // Fast path: let ffmpeg read the file directly. Fallback: copy it into memory (smaller files only).
    try {
      await ff.createDir(dir).catch(() => undefined);
      const ok = await ff.mount("WORKERFS" as never, { files: [new File([file], "input")] }, dir);
      if (!ok) throw new Error("mount failed");
      input = `${dir}/input`;
      mounted = true;
    } catch {
      if (file.size > COPY_FALLBACK_MAX_MB * 1024 * 1024) {
        throw new ConvertError(`This browser cannot handle a file this big. Please use a file under ${COPY_FALLBACK_MAX_MB} MB.`);
      }
      await ff.writeFile("input", new Uint8Array(await file.arrayBuffer()));
    }

    // Look at the streams first: no audio track means a clear message, and AAC audio can be copied instantly.
    let log = "";
    const onLog = ({ message }: { message: string }) => { log += `${message}\n`; };
    ff.on("log", onLog);
    await ff.exec(["-hide_banner", "-i", input]);
    ff.off("log", onLog);
    if (!/Audio:/i.test(log)) throw new ConvertError("This file has no audio track, or its format could not be read.");
    const isAac = /Audio: aac/i.test(log);

    const onProg = ({ progress }: { progress: number }) => onProgress(Math.min(1, Math.max(0, progress)));
    ff.on("progress", onProg);
    const out = `out.${format}`;
    const base = ["-i", input, "-map", "0:a:0", "-vn", "-sn", "-dn"];
    let code = 1;
    if (format === "m4a" && isAac) code = await ff.exec([...base, "-c:a", "copy", out]); // no re-encoding: seconds, original quality
    if (code !== 0) code = await ff.exec([...base, ...CODEC[format], out]);
    ff.off("progress", onProg);
    if (code !== 0) throw new ConvertError("This file could not be converted. It may be damaged or use an unusual format.");

    const data = (await ff.readFile(out)) as Uint8Array;
    await ff.deleteFile(out).catch(() => undefined);
    return new Blob([data.slice().buffer], { type: MIME[format] });
  } finally {
    if (mounted) {
      await ff.unmount(dir).catch(() => undefined);
      await ff.deleteDir(dir).catch(() => undefined);
    } else {
      await ff.deleteFile("input").catch(() => undefined);
    }
  }
}

type Phase =
  | { kind: "idle" }
  | { kind: "working"; pct: number }
  | { kind: "done"; url: string; name: string; size: number; format: AudioOutputFormat };

export function Converter() {
  const inputId = useId();
  const hintId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [format, setFormat] = useState<AudioOutputFormat>("mp3");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [engine, setEngine] = useState<"loading" | "ready" | "error">("loading");
  const cancelled = useRef(false);
  const busy = phase.kind === "working";

  // Get the converter ready in the background so the first click is quick.
  function warmUp() {
    setEngine("loading");
    getFfmpeg().then(() => setEngine("ready")).catch(() => setEngine("error"));
  }
  useEffect(() => {
    const t = setTimeout(warmUp, 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase.kind !== "done") return;
    const url = phase.url;
    return () => URL.revokeObjectURL(url);
  }, [phase]);

  useEffect(() => {
    setDuration(null);
    if (!file) return;
    const check = validateMediaFile(file);
    if (!check.ok) return;
    let live = true;
    void readMediaDuration(file, check.kind).then((d) => { if (live) setDuration(d); });
    return () => { live = false; };
  }, [file]);

  function pick(candidate: File | undefined) {
    if (!candidate || busy) return;
    const check = validateMediaFile(candidate);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError(null);
    setPhase({ kind: "idle" });
    setFile(candidate);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files[0]);
  }

  async function start() {
    if (!file || busy) return;
    const chosen = file;
    const fmt = format;
    setError(null);
    cancelled.current = false;
    setPhase({ kind: "working", pct: 0 });
    try {
      const blob = await extractAudio(chosen, fmt, (pct) => setPhase({ kind: "working", pct }));
      setPhase({ kind: "done", url: URL.createObjectURL(blob), name: buildDownloadName(chosen.name, fmt), size: blob.size, format: fmt });
    } catch (err) {
      setPhase({ kind: "idle" });
      if (cancelled.current) return;
      if (!(err instanceof ConvertError)) {
        resetFfmpeg();
        warmUp();
      }
      setError(err instanceof ConvertError ? err.message : "Something went wrong. Please try again, or try a smaller file.");
    }
  }

  function cancel() {
    cancelled.current = true;
    resetFfmpeg();
    setPhase({ kind: "idle" });
    warmUp();
  }

  function reset() {
    setFile(null);
    setError(null);
    setPhase({ kind: "idle" });
  }

  return (
    <div className="rounded-3xl border border-line bg-white p-5 text-left shadow-[var(--shadow-lift)] sm:p-7">
      {/* 1. File */}
      {file ? (
        <div className="animate-pop flex items-center gap-4 rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-ok">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold" title={file.name}>{file.name}</p>
            <p className="text-sm text-muted">
              {formatBytes(file.size)}
              {duration !== null && `, ${formatDuration(duration)} long`}
            </p>
          </div>
          {!busy && (
            <button type="button" onClick={reset} className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-white">
              Change
            </button>
          )}
        </div>
      ) : (
        <div>
          <input
            id={inputId}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            className="peer sr-only"
            aria-describedby={hintId}
            onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }}
          />
          <label
            htmlFor={inputId}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`group flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all duration-300 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 ${
              dragging ? "scale-[1.02] border-brand-600 bg-brand-50" : "border-brand-200 bg-surface/60 hover:border-brand-500 hover:bg-brand-50"
            }`}
          >
            <span className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 transition-transform duration-300 group-hover:scale-110 ${dragging ? "" : "animate-bob"}`}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#5b46e8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
              </svg>
            </span>
            <span className="mt-3 font-display text-xl font-bold">{dragging ? "Release to add your video" : "Choose a video"}</span>
            <span className="text-sm text-muted">or drag and drop it here</span>
            <span id={hintId} className="mt-2 text-xs text-muted">{SUPPORTED_EXTENSIONS_LABEL}. Up to {MAX_UPLOAD_MB} MB.</span>
          </label>
        </div>
      )}

      {/* 2. Format */}
      <fieldset className="mt-6" disabled={busy}>
        <legend className="mb-2 text-sm font-semibold">Audio format</legend>
        <div role="radiogroup" aria-label="Audio format" className="grid grid-cols-3 gap-2">
          {FORMATS.map((f) => {
            const on = format === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setFormat(f.id)}
                className={`rounded-xl border px-2 py-3 text-center transition-all duration-200 disabled:opacity-60 ${
                  on ? "border-brand-600 bg-brand-50 shadow-[0_0_0_3px_rgb(108_92_244/0.15)]" : "border-line bg-white hover:border-brand-400"
                }`}
              >
                <span className={`block font-display text-base font-extrabold ${on ? "text-brand-700" : ""}`}>{f.label}</span>
                <span className="mt-0.5 block text-xs text-muted">{f.hint}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 3. Convert */}
      <div className="mt-6">
        {phase.kind !== "done" && (
          <Button onClick={start} disabled={!file || busy} className="w-full">
            {busy ? "Converting…" : file ? `Convert to ${format.toUpperCase()}` : "Choose a video first"}
          </Button>
        )}

        {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}

        {phase.kind === "working" && (
          <div role="status" aria-live="polite" className="mt-5">
            {phase.pct > 0 ? <progress className="w-full" max={1} value={phase.pct} aria-label="Conversion progress" /> : <progress className="w-full" aria-label="Working" />}
            <div className="mt-2 flex items-center justify-between gap-3 text-sm text-muted">
              <span>
                {phase.pct > 0
                  ? `Converting… ${Math.round(phase.pct * 100)}%`
                  : engine === "ready" ? "Reading your video…" : "Getting the converter ready (first time only)…"}
              </span>
              <button type="button" onClick={cancel} className="font-semibold text-brand-700 hover:underline">Cancel</button>
            </div>
          </div>
        )}

        {phase.kind === "done" && (
          <div role="status" aria-live="polite" className="animate-pop rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
            <p className="flex items-center gap-2 font-display text-lg font-bold text-ok">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
              Your audio is ready
            </p>
            <p className="mt-1 break-all text-sm text-muted">{phase.name} ({formatBytes(phase.size)})</p>
            <audio className="mt-4 w-full" controls src={phase.url} />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <a href={phase.url} download={phase.name} className={buttonClass("primary", "flex-1")}>Download {phase.format.toUpperCase()}</a>
              <button type="button" onClick={reset} className={buttonClass("secondary", "flex-1")}>Convert another video</button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-muted">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
        Private: your video is converted on your device and never uploaded.
      </p>
    </div>
  );
}

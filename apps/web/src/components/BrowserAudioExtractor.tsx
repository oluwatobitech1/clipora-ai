import { useRef, useState } from "react";
import { buildDownloadName, type AudioOutputFormat } from "@clipora/shared";
import { formatBytes } from "../lib/media";
import { Button, Notice } from "./ui";

const CORE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
const MAX_BROWSER_MB = 300;

const CODEC: Record<AudioOutputFormat, string[]> = {
  mp3: ["-c:a", "libmp3lame", "-q:a", "2"],
  wav: ["-c:a", "pcm_s16le"],
  m4a: ["-c:a", "aac", "-b:a", "192k"],
};
const MIME: Record<AudioOutputFormat, string> = { mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4" };

type Phase = { kind: "idle" } | { kind: "loading" } | { kind: "working"; pct: number } | { kind: "done"; url: string; name: string; size: number };

/** Extracts audio inside the visitor's own browser (ffmpeg.wasm). No sign-in, no server, the file never leaves their device. */
export function BrowserAudioExtractor({ file, format }: { file: File | null; format: AudioOutputFormat }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const ffmpegRef = useRef<import("@ffmpeg/ffmpeg").FFmpeg | null>(null);

  async function start() {
    if (!file) return;
    setError(null);
    if (file.size > MAX_BROWSER_MB * 1024 * 1024) {
      setError(`This file is too large to process in the browser. Please use a file under ${MAX_BROWSER_MB} MB.`);
      return;
    }
    try {
      if (phase.kind === "done") URL.revokeObjectURL(phase.url);
      setPhase({ kind: "loading" });
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import("@ffmpeg/ffmpeg"), import("@ffmpeg/util")]);
      if (!ffmpegRef.current) {
        const ff = new FFmpeg();
        await ff.load({
          coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, "application/wasm"),
        });
        ffmpegRef.current = ff;
      }
      const ff = ffmpegRef.current;
      const onProgress = ({ progress }: { progress: number }) => setPhase({ kind: "working", pct: Math.min(1, Math.max(0, progress)) });
      ff.on("progress", onProgress);
      setPhase({ kind: "working", pct: 0 });

      const out = `out.${format}`;
      await ff.writeFile("input", new Uint8Array(await file.arrayBuffer()));
      const code = await ff.exec(["-i", "input", "-map", "0:a:0", "-vn", "-sn", "-dn", ...CODEC[format], out]);
      ff.off("progress", onProgress);
      if (code !== 0) throw new Error("This file has no audio track, or its format could not be read.");
      const data = (await ff.readFile(out)) as Uint8Array;
      await ff.deleteFile("input").catch(() => {});
      await ff.deleteFile(out).catch(() => {});

      const blob = new Blob([data.slice().buffer], { type: MIME[format] });
      setPhase({ kind: "done", url: URL.createObjectURL(blob), name: buildDownloadName(file.name, format), size: blob.size });
    } catch (err) {
      ffmpegRef.current = null;
      setPhase({ kind: "idle" });
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  const busy = phase.kind === "loading" || phase.kind === "working";

  return (
    <div className="space-y-5">
      <div>
        <Button onClick={start} disabled={!file || busy}>Extract audio</Button>
        {!file && <p className="mt-3 text-sm text-muted">Choose a file first.</p>}
        {file && phase.kind === "idle" && (
          <p className="mt-3 text-sm text-muted">
            {file.name} ({formatBytes(file.size)}) is processed right here in your browser. It is never uploaded, and no account is needed.
          </p>
        )}
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}

      {busy && (
        <div role="status" aria-live="polite">
          {phase.kind === "working" && phase.pct > 0 ? <progress className="w-full" max={1} value={phase.pct} aria-label="Extraction progress" /> : <progress className="w-full" aria-label="Working" />}
          <p className="mt-2 text-sm text-muted">
            {phase.kind === "loading" ? "Loading the converter (first time only). Keep this page open." : `Extracting audio${phase.pct > 0 ? `: ${Math.round(phase.pct * 100)}%` : ""}. Keep this page open.`}
          </p>
        </div>
      )}

      {phase.kind === "done" && (
        <div className="rounded-2xl border border-line bg-white p-5" role="status" aria-live="polite">
          <p className="font-semibold">Done</p>
          <p className="mt-1 text-sm text-muted">{phase.name} ({formatBytes(phase.size)})</p>
          <audio className="mt-3 w-full" controls src={phase.url} />
          <a
            href={phase.url}
            download={phase.name}
            className="mt-3 inline-block rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700"
          >
            Download {format.toUpperCase()}
          </a>
        </div>
      )}

      <Notice>Everything happens on your device, so very large files may be slow on phones.</Notice>
    </div>
  );
}

import { useMemo, useState } from "react";
import { buildTranscriptName, formatSrt, formatTimestamp, formatVtt } from "@framevox/shared";
import { formatBytes } from "../lib/media";
import { useBrowserTranscription } from "../lib/useBrowserTranscription";
import { Button, Notice } from "./ui";

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

/** Speech-to-text fully in the visitor's browser (ffmpeg.wasm to read the audio, Whisper to transcribe). No account, no server. */
export function BrowserTranscriber({ file }: { file: File | null }) {
  const { phase, busy, error, setError, segments, text: plain, start } = useBrowserTranscription();
  const [edited, setEdited] = useState<{ base: string; value: string } | null>(null);
  const [withTimes, setWithTimes] = useState(false);
  const [copied, setCopied] = useState(false);

  const timedText = useMemo(
    () => segments.map((s) => `[${formatTimestamp(s.start, ".").slice(0, 8)}] ${s.text}`).join("\n"),
    [segments],
  );
  const shown = withTimes && timedText ? timedText : plain;
  const text = edited && edited.base === shown ? edited.value : shown;

  function toggleTimes(on: boolean) {
    setWithTimes(on);
    setEdited(null);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy is blocked by your browser. Select the text and copy it manually.");
    }
  }

  const stem = file ? file.name.replace(/\.[^.]+$/, "") : "transcript";

  return (
    <div className="space-y-5">
      <Notice>
        Free transcription runs in your browser, with no account. The first time, it downloads a speech model once (about 80 MB), so you need internet then. It is slower than paid cloud services, so try a short clip first.
      </Notice>
      <div>
        <Button onClick={() => file && start(file)} disabled={!file || busy}>Transcribe</Button>
        {!file && <p className="mt-3 text-sm text-muted">Choose a file first.</p>}
        {file && phase.kind === "idle" && (
          <p className="mt-3 text-sm text-muted">{file.name} ({formatBytes(file.size)}) stays on your device. Nothing is uploaded.</p>
        )}
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}

      {busy && (
        <div role="status" aria-live="polite">
          {phase.kind === "download" && phase.pct > 0 ? <progress className="w-full" max={1} value={phase.pct} aria-label="Model download" /> : <progress className="w-full" aria-label="Working" />}
          <p className="mt-2 text-sm text-muted">
            {phase.kind === "prepare" && "Reading the audio from your file. Keep this page open."}
            {phase.kind === "download" && `Loading the speech model${phase.pct > 0 ? `: ${Math.round(phase.pct * 100)}%` : ""}. First time only. Keep this page open.`}
            {phase.kind === "transcribe" && "Transcribing speech. This can take a few minutes. Keep this page open."}
          </p>
        </div>
      )}

      {phase.kind === "done" && (
        <div className="space-y-3 rounded-2xl border border-line bg-white p-5">
          <label htmlFor="transcript" className="block text-sm font-semibold">Transcript. You can edit it before copying or downloading TXT.</label>
          <textarea id="transcript" value={text} onChange={(e) => setEdited({ base: shown, value: e.target.value })} rows={14} className="w-full rounded-xl border border-line bg-white p-3 text-base leading-relaxed" />
          {segments.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={withTimes} onChange={(e) => toggleTimes(e.target.checked)} />
              Show timestamps (resets edits)
            </label>
          )}
          <div className="flex flex-wrap gap-3">
            <Button onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
            <Button variant="secondary" onClick={() => download(buildTranscriptName(stem, "txt"), text, "text/plain")}>Download TXT</Button>
            {segments.length > 0 && (
              <>
                <Button variant="secondary" onClick={() => download(buildTranscriptName(stem, "srt"), formatSrt(segments), "application/x-subrip")}>Download SRT</Button>
                <Button variant="secondary" onClick={() => download(buildTranscriptName(stem, "vtt"), formatVtt(segments), "text/vtt")}>Download VTT</Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

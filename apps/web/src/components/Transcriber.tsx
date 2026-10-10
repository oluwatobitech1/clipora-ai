import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  buildTranscriptName, formatSrt, formatTimestamp, formatVtt, isTerminalStatus,
  type JobDto, type TranscriptDto,
} from "@clipora/shared";
import { useAuth } from "../auth/AuthContext";
import { api, ApiClientError } from "../lib/api";
import { formatBytes } from "../lib/media";
import { isAbort, startLocalJob, useMode } from "../lib/mode";
import { uploadForProcessing } from "../lib/upload";
import { BrowserTranscriber } from "./BrowserTranscriber";
import { Button, Notice } from "./ui";

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; step: "preparing" | "uploading" | "starting"; pct?: number }
  | { kind: "job"; job: JobDto }
  | { kind: "message"; text: string };

const statusText: Record<JobDto["status"], string> = {
  uploading: "Uploading",
  queued: "Waiting for a free worker",
  processing: "Transcribing speech",
  completed: "Done",
  failed: "Failed",
  expired: "Expired",
};

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

export function Transcriber({ file }: { file: File | null }) {
  const { session, loading, configured } = useAuth();
  const mode = useMode();
  const local = mode?.local === true;
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptDto | null>(null);
  const [text, setText] = useState("");
  const [withTimes, setWithTimes] = useState(false);
  const [copied, setCopied] = useState(false);
  const keyRef = useRef<{ id: string; sig: string } | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);

  const jobId = phase.kind === "job" && !isTerminalStatus(phase.job.status) ? phase.job.id : null;

  useEffect(() => {
    if (!jobId) return;
    let failures = 0;
    const timer = setInterval(async () => {
      try {
        const job = await api<JobDto>(`/api/jobs/${jobId}`);
        failures = 0;
        setPhase({ kind: "job", job });
      } catch {
        if (++failures >= 5) {
          clearInterval(timer);
          setPhase({ kind: "message", text: "Lost connection while checking progress. Your job may still be running; reload this page to check." });
        }
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [jobId]);

  // When the job really completes, fetch the real transcript.
  const completedId = phase.kind === "job" && phase.job.status === "completed" ? phase.job.id : null;
  useEffect(() => {
    if (!completedId) return;
    let cancelled = false;
    api<TranscriptDto>(`/api/jobs/${completedId}/transcript`)
      .then((t) => {
        if (cancelled) return;
        setTranscript(t);
        setText(t.text);
        setWithTimes(false);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiClientError ? err.message : "The transcript could not be loaded. Try again.");
      });
    return () => { cancelled = true; };
  }, [completedId]);

  const timedText = useMemo(
    () => (transcript ? transcript.segments.map((s) => `[${formatTimestamp(s.start, ".").slice(0, 8)}] ${s.text}`).join("\n") : ""),
    [transcript],
  );

  function toggleTimes(on: boolean) {
    setWithTimes(on);
    if (transcript) setText(on && timedText ? timedText : transcript.text);
  }

  const start = useCallback(async () => {
    if (!file) return;
    setError(null);
    setTranscript(null);
    if (local) {
      try {
        setPhase({ kind: "uploading", step: "uploading", pct: 0 });
        uploadAbort.current = new AbortController();
        const job = (await startLocalJob(file, { task: "transcribe" }, {
          signal: uploadAbort.current.signal,
          onProgress: (pct) => setPhase({ kind: "uploading", step: "uploading", pct }),
        })) as JobDto;
        setPhase({ kind: "job", job });
      } catch (err) {
        setPhase(isAbort(err) ? { kind: "message", text: "Cancelled." } : { kind: "idle" });
        if (!isAbort(err)) setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
      return;
    }
    try {
      setPhase({ kind: "uploading", step: "preparing" });
      const auth = await uploadForProcessing(file, (step) => setPhase({ kind: "uploading", step }));
      setPhase({ kind: "uploading", step: "starting" });
      const sig = `${file.name}:${file.size}:${file.lastModified}`;
      if (keyRef.current?.sig !== sig) keyRef.current = { id: crypto.randomUUID(), sig };
      const job = await api<JobDto>("/api/jobs/transcribe", {
        method: "POST",
        body: { mediaFileId: auth.mediaFileId, idempotencyKey: keyRef.current.id },
      });
      setPhase({ kind: "job", job });
    } catch (err) {
      setPhase({ kind: "idle" });
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }, [file, local]);

  async function cancel() {
    if (phase.kind === "uploading") {
      uploadAbort.current?.abort();
      return;
    }
    if (phase.kind !== "job") return;
    try {
      await api(`/api/jobs/${phase.job.id}/cancel`, { method: "POST" });
      setPhase({ kind: "message", text: "Cancelled. Nothing was kept." });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not cancel. Please try again.");
    }
  }

  async function retry(job: JobDto) {
    try {
      setPhase({ kind: "job", job: await api<JobDto>(`/api/jobs/${job.id}/retry`, { method: "POST" }) });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Retry failed. Please try again.");
    }
  }

  async function remove(job: JobDto) {
    try {
      await api(`/api/projects/${job.projectId}`, { method: "DELETE" });
      setTranscript(null);
      setText("");
      setPhase({ kind: "message", text: "Deleted. Your file and transcript were removed from our storage." });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not delete. Please try again.");
    }
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

  if (mode === null) return <p className="text-sm text-muted">Loading.</p>;
  // No Supabase configured (plain static deploy): transcribe in the visitor's browser, no account needed.
  if (!local && !configured) return <BrowserTranscriber file={file} />;
  if (!local && loading) return <p className="text-sm text-muted">Loading.</p>;
  if (!local && !session) {
    return (
      <Notice>
        Sign in to transcribe. Your upload is stored privately under your account.{" "}
        <Link to="/login" className="font-semibold text-brand-700 underline">Sign in</Link> or{" "}
        <Link to="/signup" className="font-semibold text-brand-700 underline">create an account</Link>.
      </Notice>
    );
  }

  const busy = phase.kind === "uploading" || (phase.kind === "job" && !isTerminalStatus(phase.job.status));
  const stem = transcript?.title ?? "transcript";

  return (
    <div className="space-y-5">
      {local && !mode?.transcription && (
        <Notice tone="error">
          Transcription is switched off: the server is set to use OpenAI but has no <code>OPENAI_API_KEY</code>. Remove <code>TRANSCRIBE_ENGINE</code> from <code>.env</code> to use the free local engine, then restart <code>npm run dev</code>.
        </Notice>
      )}
      {local && mode?.engine === "local-whisper" && (
        <Notice>
          Free transcription runs on this computer, with no account or key. The first time, it downloads a speech model once (about 80 MB), so you need internet then. It is slower than paid cloud services, so try a short clip first.
        </Notice>
      )}
      <div>
        <Button onClick={start} disabled={!file || busy || (local && !mode?.transcription)}>Transcribe</Button>
        {!file && <p className="mt-3 text-sm text-muted">Choose a file first.</p>}
        {file && phase.kind === "idle" && (
          <p className="mt-3 text-sm text-muted">
            {local ? `Clicking this sends ${file.name} (${formatBytes(file.size)}) to the Clipora server on this computer, which sends only its audio to the speech-to-text provider.` : `Clicking this uploads ${file.name} (${formatBytes(file.size)}) to your private storage and sends its audio to our speech-to-text provider. Everything is deleted after 24 hours.`}
          </p>
        )}
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}

      {phase.kind === "uploading" && (
        <div role="status" aria-live="polite">
          {phase.pct !== undefined ? <progress className="w-full" max={1} value={phase.pct} aria-label="Upload progress" /> : <progress className="w-full" />}
          <p className="mt-2 text-sm text-muted">
            {phase.step === "preparing" && "Preparing the upload."}
            {phase.step === "uploading" && `Uploading your file${phase.pct !== undefined ? `: ${Math.round(phase.pct * 100)}%` : ""}. Keep this page open.`}
            {phase.step === "starting" && "Starting the job."}
          </p>
          {local && <div className="mt-3"><Button variant="secondary" onClick={cancel}>Cancel</Button></div>}
        </div>
      )}

      {phase.kind === "message" && <Notice>{phase.text}</Notice>}

      {phase.kind === "job" && (
        <div className="rounded-2xl border border-line bg-white p-5" role="status" aria-live="polite">
          <p className="font-semibold">Status: {statusText[phase.job.status]}</p>

          {(phase.job.status === "queued" || phase.job.status === "processing") && (
            <div className="mt-3">
              {phase.job.progress !== null ? (
                <progress className="w-full" max={1} value={phase.job.progress} aria-label="Transcription progress" />
              ) : (
                <progress className="w-full" aria-label="Waiting" />
              )}
              {phase.job.progress !== null && <p className="mt-1 text-sm text-muted">{Math.round(phase.job.progress * 100)}%</p>}
              {local && <div className="mt-3"><Button variant="secondary" onClick={cancel}>Cancel</Button></div>}
            </div>
          )}

          {phase.job.status === "completed" && !transcript && !error && <p className="mt-3 text-sm text-muted">Loading transcript.</p>}

          {phase.job.status === "completed" && transcript && (
            <div className="mt-4 space-y-3">
              <label htmlFor="transcript" className="block text-sm font-semibold">
                Transcript{transcript.language ? ` (${transcript.language})` : ""}. You can edit it before copying or downloading TXT.
              </label>
              <textarea
                id="transcript"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={14}
                className="w-full rounded-xl border border-line bg-white p-3 text-base leading-relaxed"
              />
              {transcript.segments.length > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={withTimes} onChange={(e) => toggleTimes(e.target.checked)} />
                  Show timestamps (resets edits)
                </label>
              )}
              <div className="flex flex-wrap gap-3">
                <Button onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
                <Button variant="secondary" onClick={() => download(buildTranscriptName(stem, "txt"), text, "text/plain")}>Download TXT</Button>
                {transcript.segments.length > 0 && (
                  <>
                    <Button variant="secondary" onClick={() => download(buildTranscriptName(stem, "srt"), formatSrt(transcript.segments), "application/x-subrip")}>Download SRT</Button>
                    <Button variant="secondary" onClick={() => download(buildTranscriptName(stem, "vtt"), formatVtt(transcript.segments), "text/vtt")}>Download VTT</Button>
                  </>
                )}
                <Button variant="secondary" onClick={() => remove(phase.job)}>Delete file and transcript</Button>
              </div>
              <p className="text-sm text-muted">Kept until {new Date(transcript.expiresAt).toLocaleString()}, then deleted. SRT and VTT always contain the original recognized text.</p>
            </div>
          )}

          {phase.job.status === "failed" && (
            <div className="mt-3 space-y-3">
              <p role="alert" className="text-sm font-semibold text-danger">{phase.job.errorMessage ?? "Processing failed."}</p>
              <div className="flex flex-wrap gap-3">
                {phase.job.retryable && <Button onClick={() => retry(phase.job)}>Try again</Button>}
                <Button variant="secondary" onClick={() => remove(phase.job)}>Delete file</Button>
              </div>
            </div>
          )}

          {phase.job.status === "expired" && <p className="mt-3 text-sm text-muted">This transcript expired and was deleted. Upload the file again to repeat.</p>}
        </div>
      )}
    </div>
  );
}

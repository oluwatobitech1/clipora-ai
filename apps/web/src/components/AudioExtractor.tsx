import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { isTerminalStatus, type AudioOutputFormat, type AuthorizeUploadResponse, type JobDto } from "@framevox/shared";
import { useAuth } from "../auth/AuthContext";
import { api, ApiClientError } from "../lib/api";
import { formatBytes } from "../lib/media";
import { isAbort, startLocalJob, useMode } from "../lib/mode";
import { supabase } from "../lib/supabase";
import { BrowserAudioExtractor } from "./BrowserAudioExtractor";
import { Button, Notice } from "./ui";

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; step: "preparing" | "uploading" | "starting"; pct?: number }
  | { kind: "job"; job: JobDto }
  | { kind: "message"; text: string };

const statusText: Record<JobDto["status"], string> = {
  uploading: "Uploading",
  queued: "Waiting for a free worker",
  processing: "Extracting audio",
  completed: "Done",
  failed: "Failed",
  expired: "Expired",
};

export function AudioExtractor({ file, format }: { file: File | null; format: AudioOutputFormat }) {
  const { session, loading, configured } = useAuth();
  const mode = useMode();
  const local = mode?.local === true;
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  // One key per chosen file+format: if the request is sent twice, the server returns the same job.
  const keyRef = useRef<{ id: string; sig: string } | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);

  const jobId = phase.kind === "job" && !isTerminalStatus(phase.job.status) ? phase.job.id : null;

  // Poll the real job status until it reaches a final state.
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

  const start = useCallback(async () => {
    if (!file) return;
    setError(null);
    if (local) {
      try {
        setPhase({ kind: "uploading", step: "uploading", pct: 0 });
        uploadAbort.current = new AbortController();
        const job = (await startLocalJob(file, { task: "audio_extract", format }, {
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
    if (!supabase) return;
    try {
      setPhase({ kind: "uploading", step: "preparing" });
      const auth = await api<AuthorizeUploadResponse>("/api/uploads/authorize", {
        method: "POST",
        body: { fileName: file.name, mimeType: file.type, sizeBytes: file.size },
      });

      setPhase({ kind: "uploading", step: "uploading" });
      const { error: uploadError } = await supabase.storage.from(auth.bucket).uploadToSignedUrl(auth.path, auth.token, file);
      if (uploadError) throw new Error("The upload failed. Check your connection and try again.");

      setPhase({ kind: "uploading", step: "starting" });
      const sig = `${file.name}:${file.size}:${file.lastModified}:${format}`;
      if (keyRef.current?.sig !== sig) keyRef.current = { id: crypto.randomUUID(), sig };
      const job = await api<JobDto>("/api/jobs/audio-extract", {
        method: "POST",
        body: { mediaFileId: auth.mediaFileId, format, idempotencyKey: keyRef.current.id },
      });
      setPhase({ kind: "job", job });
    } catch (err) {
      setPhase({ kind: "idle" });
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }, [file, format, local]);

  async function download(job: JobDto) {
    try {
      const { url } = await api<{ url: string }>(`/api/jobs/${job.id}/download`);
      const a = document.createElement("a");
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "The download could not start. Try again.");
    }
  }

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
      const next = await api<JobDto>(`/api/jobs/${job.id}/retry`, { method: "POST" });
      setPhase({ kind: "job", job: next });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Retry failed. Please try again.");
    }
  }

  async function remove(job: JobDto) {
    try {
      await api(`/api/projects/${job.projectId}`, { method: "DELETE" });
      setPhase({ kind: "message", text: "Deleted. Your file and result were removed from our storage." });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not delete. Please try again.");
    }
  }

  if (mode === null) return <p className="text-sm text-muted">Loading.</p>;
  // No Supabase configured (e.g. a plain Vercel deploy): run fully in the visitor's browser, no account needed.
  if (!local && !configured) return <BrowserAudioExtractor file={file} format={format} />;
  if (!local && loading) return <p className="text-sm text-muted">Loading.</p>;
  if (!local && !session) {
    return (
      <Notice>
        Sign in to extract audio. Your upload is stored privately under your account.{" "}
        <Link to="/login" className="font-semibold text-brand-700 underline">Sign in</Link> or{" "}
        <Link to="/signup" className="font-semibold text-brand-700 underline">create an account</Link>.
      </Notice>
    );
  }

  const busy = phase.kind === "uploading" || (phase.kind === "job" && !isTerminalStatus(phase.job.status));

  return (
    <div className="space-y-5">
      <div>
        <Button onClick={start} disabled={!file || busy}>Extract audio</Button>
        {!file && <p className="mt-3 text-sm text-muted">Choose a file first.</p>}
        {file && phase.kind === "idle" && (
          <p className="mt-3 text-sm text-muted">
            Clicking this {local ? `sends ${file.name} (${formatBytes(file.size)}) to the Framevox server running on this computer. Nothing leaves your machine.` : `uploads ${file.name} (${formatBytes(file.size)}) to your private storage. It is deleted after 24 hours.`}
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
              {/* Determinate only when the worker reported real progress; otherwise status only. */}
              {phase.job.progress !== null ? (
                <progress className="w-full" max={1} value={phase.job.progress} aria-label="Extraction progress" />
              ) : (
                <progress className="w-full" aria-label="Waiting" />
              )}
              {phase.job.progress !== null && <p className="mt-1 text-sm text-muted">{Math.round(phase.job.progress * 100)}%</p>}
              {local && <div className="mt-3"><Button variant="secondary" onClick={cancel}>Cancel</Button></div>}
            </div>
          )}

          {phase.job.status === "completed" && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-muted">
                {phase.job.outputName} ({phase.job.outputSizeBytes ? formatBytes(phase.job.outputSizeBytes) : ""}). Kept until{" "}
                {phase.job.expiresAt ? new Date(phase.job.expiresAt).toLocaleString() : "tomorrow"}, then deleted.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => download(phase.job)}>Download {phase.job.format?.toUpperCase()}</Button>
                <Button variant="secondary" onClick={() => remove(phase.job)}>Delete file and result</Button>
              </div>
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

          {phase.job.status === "expired" && <p className="mt-3 text-sm text-muted">This result expired and was deleted. Upload the file again to repeat.</p>}
        </div>
      )}
    </div>
  );
}

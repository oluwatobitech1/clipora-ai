import { useEffect, useId, useState, type DragEvent } from "react";
import {
  ACCEPT_ATTRIBUTE,
  MAX_UPLOAD_MB,
  SUPPORTED_EXTENSIONS_LABEL,
  validateMediaFile,
} from "@framevox/shared";
import { formatBytes, formatDuration, readMediaDuration } from "../lib/media";

interface Props {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

/** Validates and previews a real file. Uploading happens in AudioExtractor / Transcriber. */
export function UploadZone({ file, onFileChange }: Props) {
  const inputId = useId();
  const hintId = useId();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    setDuration(null);
    if (!file) return;
    const check = validateMediaFile(file);
    if (!check.ok) return;
    let cancelled = false;
    readMediaDuration(file, check.kind).then((d) => {
      if (!cancelled) setDuration(d);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  function accept(candidate: File | undefined) {
    if (!candidate) return;
    const check = validateMediaFile(candidate);
    if (!check.ok) {
      setError(check.message);
      onFileChange(null);
      return;
    }
    setError(null);
    onFileChange(candidate);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files[0]);
  }

  if (file) {
    return (
      <div className="animate-pop flex items-center justify-between gap-4 rounded-2xl border border-brand-200 bg-white p-4 text-left shadow-[var(--shadow-soft)]">
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
        <button
          type="button"
          onClick={() => {
            setError(null);
            onFileChange(null);
          }}
          className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
        >
          Choose a different file
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        id={inputId}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="peer sr-only"
        aria-describedby={hintId}
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`group flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all duration-300 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 ${
          dragging ? "scale-[1.02] border-brand-600 bg-brand-50 shadow-[var(--shadow-lift)]" : "border-brand-200 bg-white/90 shadow-[var(--shadow-soft)] hover:border-brand-500 hover:bg-brand-50"
        }`}
      >
        <span className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 transition-transform duration-300 group-hover:scale-110 ${dragging ? "" : "animate-bob"}`}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5b46e8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
          </svg>
        </span>
        <span className="mt-3 font-display text-lg font-bold">{dragging ? "Release to add your file" : "Drop a file here, or browse"}</span>
        <span id={hintId} className="text-sm text-muted">
          {SUPPORTED_EXTENSIONS_LABEL}. Up to {MAX_UPLOAD_MB} MB.
        </span>
      </label>
      {error && (
        <p role="alert" className="animate-pop mt-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

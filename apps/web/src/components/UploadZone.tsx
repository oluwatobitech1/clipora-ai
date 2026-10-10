import { useEffect, useId, useState, type DragEvent } from "react";
import {
  ACCEPT_ATTRIBUTE,
  MAX_UPLOAD_MB,
  SUPPORTED_EXTENSIONS_LABEL,
  validateMediaFile,
} from "@clipora/shared";
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
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-white p-4 text-left">
        <div className="min-w-0">
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
          className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
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
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 ${
          dragging ? "border-brand-600 bg-brand-50" : "border-brand-200 bg-white hover:border-brand-500 hover:bg-brand-50"
        }`}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#5b46e8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
        <span className="mt-2 text-lg font-semibold">Drop a file here, or browse</span>
        <span id={hintId} className="text-sm text-muted">
          {SUPPORTED_EXTENSIONS_LABEL}. Up to {MAX_UPLOAD_MB} MB.
        </span>
      </label>
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

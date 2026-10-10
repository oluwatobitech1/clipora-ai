import { useEffect, useState } from "react";

export interface ModeInfo {
  local: boolean;
  transcription: boolean;
  /** "local-whisper" = free, on this computer. "openai" = cloud. */
  engine: string;
}

let cached: Promise<ModeInfo> | null = null;

/** Asks the backend whether it is the no-account "local mode" server. Hosted mode has no /api/mode route. */
export function loadMode(): Promise<ModeInfo> {
  cached ??= fetch("/api/mode")
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { mode?: string; transcription?: boolean; engine?: string } | null) => ({ local: j?.mode === "local", transcription: !!j?.transcription, engine: j?.engine ?? "" }))
    .catch(() => ({ local: false, transcription: false, engine: "" }));
  return cached;
}

/** null while still checking. */
export function useMode(): ModeInfo | null {
  const [mode, setMode] = useState<ModeInfo | null>(null);
  useEffect(() => { void loadMode().then(setMode); }, []);
  return mode;
}

/** Local mode: send the file straight to the local server, with real upload progress (0..1) and cancel support. */
export function startLocalJob(
  file: File,
  fields: Record<string, string>,
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v); // fields first so the server has them before the file
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/local/jobs");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new Error("Could not reach the local server. Is `npm run dev` still running?"));
    xhr.onabort = () => reject(new DOMException("Cancelled", "AbortError"));
    xhr.onload = () => {
      const json = xhr.response as { error?: { message?: string } } | null;
      if (xhr.status >= 200 && xhr.status < 300) resolve(json);
      else reject(new Error(json?.error?.message ?? "The upload failed. Please try again."));
    };
    opts.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

export const isAbort = (err: unknown) => err instanceof DOMException && err.name === "AbortError";

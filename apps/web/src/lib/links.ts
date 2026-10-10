import { isAbort } from "./mode";

/** Address of the hosted link server (set VITE_LINK_API on Vercel). Empty = use the local server on this computer. */
export const LINK_API = ((import.meta.env.VITE_LINK_API as string | undefined) ?? "").replace(/\/+$/, "");

const OFFLINE = "The link server is waking up or offline. Wait about 30 seconds and try again, or upload the file instead.";
async function call(url: string, init?: RequestInit): Promise<Response> {
  try { return await fetch(url, init); } catch (err) {
    if (isAbort(err)) throw err;
    throw new LinkImportError("link_network", OFFLINE);
  }
}

interface LinkStatus {
  id: string;
  status: "downloading" | "ready" | "failed";
  progress: number | null;
  errorCode: string | null;
  message: string | null;
  fileName: string | null;
  sizeBytes: number | null;
}

export class LinkImportError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as T | { error?: { code?: string; message?: string } } | null;
  if (!res.ok) {
    const e = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new LinkImportError(e?.code ?? "link_failed", e?.message ?? "Could not fetch this link. Please try again.");
  }
  return body as T;
}

const MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska",
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4",
};

/**
 * Asks the local server to fetch a video from a web link, then brings the finished file into the browser as a
 * normal File, so every tool works on it exactly like an upload. The server's temporary copy is removed afterwards.
 */
export async function importFromLink(
  url: string,
  opts: { onProgress?: (fraction: number | null) => void; signal?: AbortSignal; audioOnly?: boolean; remote?: boolean } = {},
): Promise<File> {
  const base = opts.remote ? LINK_API : "";
  const start = await json<LinkStatus>(
    await call(`${base}/api/local/links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, confirmed: true, audioOnly: opts.audioOnly === true }),
      signal: opts.signal,
    }),
  );
  const id = start.id;
  const cleanup = () => { void fetch(`${base}/api/local/links/${id}`, { method: "DELETE" }).catch(() => {}); };
  opts.signal?.addEventListener("abort", cleanup, { once: true });

  try {
    for (;;) {
      if (opts.signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      await new Promise((r) => setTimeout(r, 300));
      const st = await json<LinkStatus>(await call(`${base}/api/local/links/${id}`, { signal: opts.signal }));
      opts.onProgress?.(st.progress);
      if (st.status === "failed") throw new LinkImportError(st.errorCode ?? "link_failed", st.message ?? "Could not fetch this link.");
      if (st.status === "ready") {
        const res = await call(`${base}/api/local/links/${id}/file`, { signal: opts.signal });
        if (!res.ok) throw new LinkImportError("link_failed", "The video was fetched but could not be loaded. Please try again.");
        const blob = await res.blob();
        const name = st.fileName ?? "video.mp4";
        const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
        return new File([blob], name, { type: blob.type || MIME_BY_EXT[ext] || "video/mp4" });
      }
    }
  } catch (err) {
    if (!isAbort(err)) cleanup();
    throw err;
  } finally {
    // Once the browser holds the file, the server's copy is not needed.
    opts.signal?.removeEventListener("abort", cleanup);
    cleanup();
  }
}

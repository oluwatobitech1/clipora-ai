import { useCallback, useEffect, useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { importFromLink, LINK_API, LinkImportError } from "../lib/links";
import { isAbort, useMode } from "../lib/mode";
import { parseLink } from "../lib/platform";
import { UploadZone } from "./UploadZone";
import { Button, Notice } from "./ui";

interface Props {
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** True for tools that only need the sound: links then fetch audio only, which is much faster. */
  audioOnly?: boolean;
}

type Tab = "upload" | "link";
type LinkPhase =
  | { kind: "idle" }
  | { kind: "fetching"; pct: number | null; platform: string | null }
  | { kind: "error"; message: string; code: string };

const SITES = ["YouTube", "TikTok", "Instagram", "X", "Facebook", "Vimeo", "SoundCloud", "Reddit"];
const CONSENT_KEY = "framevox.linkConsent";

function readConsent(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === "1"; } catch { return false; }
}
function saveConsent(on: boolean) {
  try { if (on) localStorage.setItem(CONSENT_KEY, "1"); else localStorage.removeItem(CONSENT_KEY); } catch { /* private mode: fine */ }
}

/** True when the paste landed in a place where the visitor is typing, so the page must not take it over. */
function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !("tagName" in el)) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
}

/**
 * Where a recording comes from: a file on this computer, or a link to a video on the web (local mode).
 * Pasting a link anywhere on the page switches to the link tab and, once the visitor has confirmed they have
 * permission, starts fetching straight away. Either way the result is one File, so every tool behaves the same.
 */
export function MediaSource({ file, onFileChange, audioOnly }: Props) {
  const mode = useMode();
  const [tab, setTab] = useState<Tab>("upload");
  const [url, setUrl] = useState("");
  const [confirmed, setConfirmed] = useState(readConsent);
  const [phase, setPhase] = useState<LinkPhase>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [linkServerOk, setLinkServerOk] = useState<boolean | null>(null); // null = still checking
  const remote = mode !== null && mode.local !== true && LINK_API !== "" && linkServerOk !== false; // hosted site with a working link server
  const canLink = mode?.local === true || remote;
  const onLocalhost = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const active = !file && canLink;
  // Ask the link server if it is really usable from this website. If not, the tab is hidden (no errors for visitors).
  useEffect(() => {
    if (!LINK_API || mode === null || mode.local) return;
    let live = true;
    fetch(`${LINK_API}/api/mode`, { signal: AbortSignal.timeout(45_000) }) // generous: a free server may be waking up
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { links?: boolean } | null) => { if (live) setLinkServerOk(j?.links === true); })
      .catch(() => { if (live) setLinkServerOk(false); });
    return () => { live = false; };
  }, [mode]);
  const showTabs = !file && (canLink || (mode !== null && onLocalhost)); // hidden on a live site with no working link server; on your own computer it explains how to start it

  const parsed = parseLink(url);
  const busy = phase.kind === "fetching";
  const ready = !!parsed && confirmed && !busy && canLink;

  const fetchIt = useCallback(async (target: string, platform: string | null) => {
    if (abortRef.current) return; // one fetch at a time
    const ctl = new AbortController();
    abortRef.current = ctl;
    setPhase({ kind: "fetching", pct: null, platform });
    try {
      const f = await importFromLink(target, { signal: ctl.signal, audioOnly, remote, onProgress: (pct) => setPhase({ kind: "fetching", pct, platform }) });
      setPhase({ kind: "idle" });
      setUrl("");
      onFileChange(f);
    } catch (err) {
      if (isAbort(err)) { setPhase({ kind: "idle" }); return; }
      setPhase({
        kind: "error",
        code: err instanceof LinkImportError ? err.code : "link_failed",
        message: err instanceof Error ? err.message : "Could not fetch this link. Please try again.",
      });
    } finally {
      abortRef.current = null;
    }
  }, [onFileChange, audioOnly, remote]);

  /** Takes pasted text: shows the clean link, and starts fetching when permission was already confirmed. */
  const takePasted = useCallback((text: string) => {
    const link = parseLink(text);
    if (!link) return false;
    setTab("link");
    setUrl(link.url);
    setPhase({ kind: "idle" });
    if (readConsent()) void fetchIt(link.url, link.platform);
    return true;
  }, [fetchIt]);

  // Paste a link anywhere on the page (not inside a text box) and it goes straight to the link tab.
  useEffect(() => {
    if (!active) return;
    const onPaste = (e: globalThis.ClipboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const text = e.clipboardData?.getData("text") ?? "";
      if (text && takePasted(text)) e.preventDefault();
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [active, takePasted]);

  if (!showTabs) return <UploadZone file={file} onFileChange={onFileChange} />;

  function onInputPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (takePasted(text)) e.preventDefault(); // replaces the box content with just the clean link
  }

  function setConsent(on: boolean) {
    setConfirmed(on);
    saveConsent(on);
  }

  function onKey(e: KeyboardEvent<HTMLButtonElement>) {
    const order: Tab[] = ["upload", "link"];
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = order[(order.indexOf(tab) + (e.key === "ArrowRight" ? 1 : order.length - 1)) % order.length]!;
    setTab(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  }

  const tabClass = (t: Tab) =>
    `relative flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
      tab === t ? "bg-white text-brand-700 shadow-[var(--shadow-soft)]" : "text-muted hover:text-ink"
    }`;

  const detected = busy ? phase.platform : parsed?.platform ?? null;

  return (
    <div>
      <div role="tablist" aria-label="Where is your recording?" className="mb-3 flex gap-1 rounded-2xl bg-brand-50 p-1">
        {(["upload", "link"] as const).map((t) => (
          <button
            key={t}
            id={`${id}-tab-${t}`}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-controls={`${id}-panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={onKey}
            className={tabClass(t)}
          >
            {t === "upload" ? "Upload a file" : "Paste a link"}
          </button>
        ))}
      </div>

      {tab === "upload" ? (
        <div role="tabpanel" id={`${id}-panel-upload`} aria-labelledby={`${id}-tab-upload`} className="animate-pop">
          <UploadZone file={file} onFileChange={onFileChange} />
          <p className="mt-3 text-center text-xs text-muted">
            Tip: copy a YouTube, TikTok or Instagram link, then press <kbd className="rounded border border-line bg-white px-1.5 py-0.5 font-sans font-semibold">Ctrl</kbd> + <kbd className="rounded border border-line bg-white px-1.5 py-0.5 font-sans font-semibold">V</kbd> on this page.
          </p>
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`${id}-panel-link`}
          aria-labelledby={`${id}-tab-link`}
          className="animate-pop rounded-2xl border border-brand-200 bg-white/90 p-5 text-left shadow-[var(--shadow-soft)]"
        >
          {mode !== null && !canLink && (
            <div className="mb-4">
              <Notice tone="error">
                Link import runs on your own computer. Stop the app, then start it with <code className="rounded bg-white px-1">npm run dev</code> from the project folder (this starts the web page <em>and</em> the local server), and open <strong>http://localhost:5173</strong>. Install the free <strong>yt-dlp</strong> tool once: <code className="rounded bg-white px-1">winget install yt-dlp.yt-dlp</code>.
              </Notice>
            </div>
          )}
          {mode?.local === true && mode.links === false && (
            <div className="mb-4">
              <Notice tone="error">
                Link import needs the free tool <strong>yt-dlp</strong>. Windows: run <code className="rounded bg-white px-1">winget install yt-dlp.yt-dlp</code>, then close and reopen this app. Mac: <code className="rounded bg-white px-1">brew install yt-dlp</code>.
              </Notice>
            </div>
          )}
          <label htmlFor={`${id}-url`} className="block text-sm font-semibold">Link to a video or audio</label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              id={`${id}-url`}
              ref={inputRef}
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              value={url}
              onPaste={onInputPaste}
              onChange={(e) => { setUrl(e.target.value); if (phase.kind === "error") setPhase({ kind: "idle" }); }}
              onKeyDown={(e) => { if (e.key === "Enter" && ready && parsed) void fetchIt(parsed.url, parsed.platform); }}
              placeholder="Paste a YouTube, TikTok or Instagram link"
              className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-3 text-base shadow-[var(--shadow-soft)] disabled:opacity-60"
            />
            {busy ? (
              <Button variant="secondary" onClick={() => abortRef.current?.abort()}>Cancel</Button>
            ) : (
              <Button onClick={() => parsed && void fetchIt(parsed.url, parsed.platform)} disabled={!ready}>Fetch video</Button>
            )}
          </div>

          {detected && (
            <p className="animate-pop mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-ok">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {detected} link detected
            </p>
          )}

          <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-muted">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-brand-600)]"
            />
            <span>
              I own this content or have permission to use it, and I accept the site&apos;s terms.
              <span className="block text-xs">Tick once and pasted links start fetching automatically. Untick any time.</span>
            </span>
          </label>

          {busy && (
            <div className="animate-pop mt-4" role="status" aria-live="polite">
              <div className="mb-1.5 flex justify-between text-sm font-semibold">
                <span>{phase.pct === null ? "Contacting the site…" : "Fetching the video…"}</span>
                {phase.pct !== null && <span className="text-muted">{Math.round(phase.pct * 100)}%</span>}
              </div>
              {phase.pct === null ? <progress className="w-full" aria-label="Fetching" /> : <progress className="w-full" max={1} value={phase.pct} aria-label="Fetching progress" />}
            </div>
          )}

          {phase.kind === "error" && (
            <div className="mt-4 space-y-3">
              <Notice tone="error">{phase.message}</Notice>
              <Button variant="secondary" onClick={() => { setPhase({ kind: "idle" }); setTab("upload"); }}>Upload a file instead</Button>
            </div>
          )}

          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted">
            <span className="font-semibold">Works with</span>
            {SITES.map((s) => (
              <span key={s} className={`rounded-full px-2.5 py-1 font-semibold transition-colors ${detected === s ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"}`}>{s}</span>
            ))}
            <span>and more. Public videos only.</span>
          </p>
        </div>
      )}
    </div>
  );
}

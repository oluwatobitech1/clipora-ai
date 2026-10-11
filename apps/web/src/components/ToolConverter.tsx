import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";
import { MAX_UPLOAD_MB } from "@framevox/shared";
import { ConvertError } from "../lib/errors";
import { formatBytes } from "../lib/media";
import type { ResultFile } from "../lib/engines";
import type { ToolDef } from "../lib/tools";
import { Button, buttonClass, Notice } from "./ui";

type Phase = { kind: "idle" } | { kind: "working"; pct: number } | { kind: "done"; items: { file: ResultFile; url: string }[] };

const extOf = (name: string) => name.slice(name.lastIndexOf(".") + 1).toLowerCase();
const MEDIA_ENGINES = ["video", "gif", "audio"];

/** The converter box used on every tool page: choose files, pick options, convert, download. */
export function ToolConverter({ tool }: { tool: ToolDef }) {
  const inputId = useId();
  const hintId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [output, setOutput] = useState(tool.outputs[0]?.id ?? "");
  const [options, setOptions] = useState<Record<string, string>>(() => Object.fromEntries(tool.options.map((o) => [o.id, o.default])));
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [zipping, setZipping] = useState(false);
  const cancelled = useRef(false);
  const busy = phase.kind === "working";
  const accept = useMemo(() => tool.exts.map((e) => `.${e}`).join(","), [tool.exts]);
  const extLabel = useMemo(() => tool.exts.filter((e) => !["qt", "markdown", "htm", "aif", "oga", "3g2"].includes(e)).map((e) => e.toUpperCase()).join(", "), [tool.exts]);

  // Download links are made from in-memory files, so they are released when the results go away.
  useEffect(() => {
    if (phase.kind !== "done") return;
    const urls = phase.items.map((i) => i.url);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [phase]);

  function pick(candidates: File[]) {
    if (busy || !candidates.length) return;
    const good: File[] = [];
    let problem: string | null = null;
    for (const f of candidates) {
      if (!tool.exts.includes(extOf(f.name))) problem = `"${f.name}" is not a supported file. Use ${extLabel}.`;
      else if (f.size <= 0) problem = `"${f.name}" is empty.`;
      else if (f.size > MAX_UPLOAD_MB * 1024 * 1024) problem = `"${f.name}" is larger than the ${MAX_UPLOAD_MB} MB limit.`;
      else good.push(f);
    }
    setError(problem);
    if (!good.length) return;
    setPhase({ kind: "idle" });
    setFiles((prev) => (tool.multiple ? [...prev, ...good] : [good[0]]));
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    pick(Array.from(e.dataTransfer.files));
  }

  function move(index: number, by: number) {
    setFiles((prev) => {
      const next = [...prev];
      const to = index + by;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  async function start() {
    if (!files.length || busy) return;
    setError(null);
    cancelled.current = false;
    setPhase({ kind: "working", pct: 0 });
    try {
      const { runTool } = await import("../lib/engines");
      const results = await runTool(tool, {
        files,
        output,
        options,
        onProgress: (pct) => setPhase({ kind: "working", pct }),
        isCancelled: () => cancelled.current,
      });
      if (cancelled.current) return;
      setPhase({ kind: "done", items: results.map((file) => ({ file, url: URL.createObjectURL(file.blob) })) });
    } catch (err) {
      setPhase({ kind: "idle" });
      if (cancelled.current) return;
      if (!(err instanceof ConvertError)) {
        console.error(err);
        if (MEDIA_ENGINES.includes(tool.engine)) void import("../lib/browserFfmpeg").then((m) => m.resetFfmpeg());
      }
      setError(err instanceof ConvertError ? err.message : "Something went wrong. Please try again, or try a smaller file.");
    }
  }

  function cancel() {
    cancelled.current = true;
    if (MEDIA_ENGINES.includes(tool.engine)) void import("../lib/browserFfmpeg").then((m) => m.resetFfmpeg());
    setPhase({ kind: "idle" });
  }

  function reset() {
    setFiles([]);
    setError(null);
    setPhase({ kind: "idle" });
  }

  async function downloadZip() {
    if (phase.kind !== "done") return;
    setZipping(true);
    try {
      const { zipBlob } = await import("../lib/zip");
      const entries = await Promise.all(phase.items.map(async (i) => ({ name: i.file.name, data: new Uint8Array(await i.file.blob.arrayBuffer()) })));
      const url = URL.createObjectURL(zipBlob(entries));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tool.slug}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } finally {
      setZipping(false);
    }
  }

  const visibleOptions = tool.options.filter((o) => !o.showFor || o.showFor.includes(output));
  const outLabel = tool.outputs.find((o) => o.id === output)?.label ?? output.toUpperCase();
  const pickerLabel = files.length && tool.multiple ? "Add more files" : tool.chooseLabel;

  return (
    <div className="rounded-3xl border border-line bg-white p-5 text-left shadow-[var(--shadow-lift)] sm:p-7">
      {/* 1. Files */}
      {files.length > 0 && (
        <ul className="grid gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="animate-pop flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-3">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-ok">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold" title={f.name}>{f.name}</p>
                <p className="text-sm text-muted">{formatBytes(f.size)}</p>
              </div>
              {!busy && (
                <div className="flex shrink-0 items-center gap-1">
                  {tool.engine === "images-to-pdf" && files.length > 1 && (
                    <>
                      <button type="button" aria-label={`Move ${f.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded-lg px-2 py-1.5 text-brand-700 hover:bg-white disabled:opacity-30">↑</button>
                      <button type="button" aria-label={`Move ${f.name} down`} disabled={i === files.length - 1} onClick={() => move(i, 1)} className="rounded-lg px-2 py-1.5 text-brand-700 hover:bg-white disabled:opacity-30">↓</button>
                    </>
                  )}
                  <button type="button" onClick={() => setFiles((p) => p.filter((_, n) => n !== i))} className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-white">
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {(files.length === 0 || (tool.multiple && !busy && phase.kind !== "done")) && (
        <div className={files.length ? "mt-3" : ""}>
          <input
            id={inputId}
            type="file"
            accept={accept}
            multiple={tool.multiple}
            className="peer sr-only"
            aria-describedby={hintId}
            onChange={(e) => { pick(Array.from(e.target.files ?? [])); e.target.value = ""; }}
          />
          <label
            htmlFor={inputId}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`group flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-6 text-center transition-all duration-300 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 ${
              files.length ? "py-5" : "py-12"
            } ${dragging ? "scale-[1.02] border-brand-600 bg-brand-50" : "border-brand-200 bg-surface/60 hover:border-brand-500 hover:bg-brand-50"}`}
          >
            {files.length === 0 && (
              <span className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 transition-transform duration-300 group-hover:scale-110 ${dragging ? "" : "animate-bob"}`}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#5b46e8" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
                </svg>
              </span>
            )}
            <span className={`font-display font-bold ${files.length ? "text-base" : "mt-3 text-xl"}`}>{dragging ? "Release to add your files" : pickerLabel}</span>
            {files.length === 0 && <span className="text-sm text-muted">or drag and drop {tool.multiple ? "them" : "it"} here</span>}
            <span id={hintId} className="mt-1 text-xs text-muted">{extLabel}. Up to {MAX_UPLOAD_MB} MB each.</span>
          </label>
        </div>
      )}

      {/* 2. Format */}
      {tool.outputs.length > 1 && (
        <fieldset className="mt-6" disabled={busy}>
          <legend className="mb-2 text-sm font-semibold">Convert to</legend>
          <div role="radiogroup" aria-label="Convert to" className={`grid gap-2 ${tool.outputs.length > 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3"}`}>
            {tool.outputs.map((o) => {
              const on = output === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setOutput(o.id)}
                  className={`rounded-xl border px-2 py-3 text-center transition-all duration-200 disabled:opacity-60 ${
                    on ? "border-brand-600 bg-brand-50 shadow-[0_0_0_3px_rgb(108_92_244/0.15)]" : "border-line bg-white hover:border-brand-400"
                  }`}
                >
                  <span className={`block font-display text-base font-extrabold ${on ? "text-brand-700" : ""}`}>{o.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{o.hint}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* Options */}
      {visibleOptions.length > 0 && (
        <details className="mt-6 rounded-2xl border border-line">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold">Settings (optional)</summary>
          <fieldset className="grid gap-3 px-4 pb-4 sm:grid-cols-2" disabled={busy}>
            {visibleOptions.map((o) => (
              <label key={o.id} className="text-sm">
                <span className="mb-1 block font-semibold">{o.label}</span>
                <select
                  className="w-full rounded-lg border border-line bg-white px-2 py-2"
                  value={options[o.id]}
                  onChange={(e) => setOptions({ ...options, [o.id]: e.target.value })}
                >
                  {o.choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
            ))}
          </fieldset>
        </details>
      )}

      {/* 3. Convert */}
      <div className="mt-6">
        {phase.kind !== "done" && (
          <Button onClick={start} disabled={!files.length || busy} className="w-full">
            {busy ? "Converting…" : files.length ? `Convert to ${outLabel}` : tool.chooseLabel + " first"}
          </Button>
        )}

        {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}

        {phase.kind === "working" && (
          <div role="status" aria-live="polite" className="mt-5">
            {phase.pct > 0 ? <progress className="w-full" max={1} value={phase.pct} aria-label="Conversion progress" /> : <progress className="w-full" aria-label="Working" />}
            <div className="mt-2 flex items-center justify-between gap-3 text-sm text-muted">
              <span>{phase.pct > 0 ? `Converting… ${Math.round(phase.pct * 100)}%` : MEDIA_ENGINES.includes(tool.engine) ? "Getting the converter ready (first time only)…" : "Working…"}</span>
              <button type="button" onClick={cancel} className="font-semibold text-brand-700 hover:underline">Cancel</button>
            </div>
          </div>
        )}

        {phase.kind === "done" && (
          <div role="status" aria-live="polite" className="animate-pop rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
            <p className="flex items-center gap-2 font-display text-lg font-bold text-ok">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
              {phase.items.length === 1 ? "Your file is ready" : `Your ${phase.items.length} files are ready`}
            </p>
            <ul className="mt-3 grid gap-3">
              {phase.items.map(({ file, url }) => (
                <li key={url} className="rounded-xl border border-emerald-100 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-all text-sm font-semibold">{file.name}</p>
                      <p className="text-xs text-muted">{formatBytes(file.blob.size)}</p>
                    </div>
                    <a href={url} download={file.name} className={buttonClass("secondary", "!px-4 !py-2 text-sm")}>Download</a>
                  </div>
                  {file.blob.type.startsWith("image/") && <img src={url} alt="" loading="lazy" className="mt-3 max-h-48 w-auto rounded-lg border border-line" />}
                  {file.blob.type.startsWith("video/") && <video src={url} controls className="mt-3 max-h-64 w-full rounded-lg" />}
                  {file.blob.type.startsWith("audio/") && <audio src={url} controls className="mt-3 w-full" />}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              {phase.items.length > 1 && (
                <button type="button" onClick={downloadZip} disabled={zipping} className={buttonClass("primary", "flex-1")}>
                  {zipping ? "Making ZIP…" : "Download all (ZIP)"}
                </button>
              )}
              <button type="button" onClick={reset} className={buttonClass("secondary", "flex-1")}>Convert more files</button>
            </div>
          </div>
        )}
      </div>

      {tool.note && <p className="mt-4 text-xs text-muted">{tool.note}</p>}
      <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-muted">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
        Private: your files are converted on your device and never uploaded.
      </p>
    </div>
  );
}

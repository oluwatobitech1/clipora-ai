import { useMemo, useState } from "react";
import { buildTranscriptName } from "@framevox/shared";
import { formatBytes } from "../lib/media";
import { summarize, type SummaryLength } from "../lib/summarize";
import { useBrowserTranscription } from "../lib/useBrowserTranscription";
import { Button, Notice } from "./ui";

function downloadText(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Summaries and key takeaways built from the real transcript, entirely in the browser. */
export function Summarizer({ file }: { file: File | null }) {
  const { phase, busy, error, setError, text: fileText, start } = useBrowserTranscription();
  const [source, setSource] = useState<"file" | "paste">("file");
  const [pasted, setPasted] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [length, setLength] = useState<SummaryLength>("medium");
  const [copied, setCopied] = useState(false);

  const sourceText = source === "paste" ? submitted : phase.kind === "done" ? fileText : "";
  const result = useMemo(() => (sourceText ? summarize(sourceText, length) : null), [sourceText, length]);

  const output = result
    ? `SUMMARY\n${result.summary}${result.takeaways.length ? `\n\nKEY TAKEAWAYS\n${result.takeaways.map((t) => `- ${t}`).join("\n")}` : ""}${result.keywords.length ? `\n\nTOPICS\n${result.keywords.join(", ")}` : ""}\n`
    : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy is blocked by your browser. Select the text and copy it manually.");
    }
  }

  return (
    <div className="space-y-5">
      <Notice>
        This tool picks the most important sentences from your transcript, so every line comes from what was really said. It does not rewrite or add anything. It works best on English speech and on talks of a few minutes or more.
      </Notice>

      <div className="flex flex-wrap gap-3" role="tablist" aria-label="Where the text comes from">
        <Button variant={source === "file" ? "primary" : "secondary"} onClick={() => setSource("file")}>From the file above</Button>
        <Button variant={source === "paste" ? "primary" : "secondary"} onClick={() => setSource("paste")}>Paste a transcript</Button>
      </div>

      <div>
        <label htmlFor="sumlen" className="mb-1.5 block text-sm font-semibold">Summary length</label>
        <select id="sumlen" value={length} onChange={(e) => setLength(e.target.value as SummaryLength)} className="w-full rounded-xl border border-line bg-white px-3 py-2.5 sm:w-60">
          <option value="short">Short</option>
          <option value="medium">Medium</option>
          <option value="long">Long</option>
        </select>
      </div>

      {source === "file" ? (
        <div>
          <Button onClick={() => file && start(file)} disabled={!file || busy}>Summarize</Button>
          {!file && <p className="mt-3 text-sm text-muted">Choose a file first.</p>}
          {file && phase.kind === "idle" && <p className="mt-3 text-sm text-muted">{file.name} ({formatBytes(file.size)}) stays on your device. It is turned into text here first (about 80 MB model download the first time), then summarized.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <label htmlFor="paste" className="block text-sm font-semibold">Transcript text</label>
          <textarea id="paste" value={pasted} onChange={(e) => setPasted(e.target.value)} rows={8} className="w-full rounded-xl border border-line bg-white p-3 text-base leading-relaxed" placeholder="Paste the transcript here." />
          <Button onClick={() => { setError(null); setSubmitted(pasted); }} disabled={pasted.trim().split(/\s+/).length < 20}>Summarize text</Button>
          {pasted.trim() !== "" && pasted.trim().split(/\s+/).length < 20 && <p className="text-sm text-muted">Paste at least 20 words.</p>}
        </div>
      )}

      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}

      {source === "file" && busy && (
        <div role="status" aria-live="polite">
          {phase.kind === "download" && phase.pct > 0 ? <progress className="w-full" max={1} value={phase.pct} aria-label="Model download" /> : <progress className="w-full" aria-label="Working" />}
          <p className="mt-2 text-sm text-muted">
            {phase.kind === "prepare" && "Reading the audio from your file. Keep this page open."}
            {phase.kind === "download" && `Loading the speech model${phase.pct > 0 ? `: ${Math.round(phase.pct * 100)}%` : ""}. First time only. Keep this page open.`}
            {phase.kind === "transcribe" && "Turning speech into text. This can take a few minutes. Keep this page open."}
          </p>
        </div>
      )}

      {sourceText && !result && <Notice>There was not enough text to summarize.</Notice>}

      {result && (
        <div className="space-y-5 rounded-2xl border border-line bg-white p-5">
          <section>
            <h2 className="text-lg font-bold">Summary</h2>
            <p className="mt-2 leading-relaxed">{result.summary}</p>
          </section>
          {result.takeaways.length > 0 && (
          <section>
            <h2 className="text-lg font-bold">Key takeaways</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 leading-relaxed">
              {result.takeaways.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </section>
          )}
          {result.keywords.length > 0 && (
            <section>
              <h2 className="text-lg font-bold">Topics mentioned often</h2>
              <p className="mt-2 text-muted">{result.keywords.join(", ")}</p>
            </section>
          )}
          <div className="flex flex-wrap gap-3">
            <Button onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
            <Button variant="secondary" onClick={() => downloadText(buildTranscriptName(file && source === "file" ? file.name.replace(/\.[^.]+$/, "") : "summary", "txt"), output)}>Download TXT</Button>
          </div>
        </div>
      )}
    </div>
  );
}

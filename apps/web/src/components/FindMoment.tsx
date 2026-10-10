import { Fragment, useMemo, useRef, useState } from "react";
import { formatBytes } from "../lib/media";
import { fmtClock } from "../lib/time";
import { isVideoFile, useObjectUrl } from "../lib/useObjectUrl";
import { useBrowserTranscription } from "../lib/useBrowserTranscription";
import { Player } from "./Player";
import { SpeechProgress } from "./SpeechProgress";
import { Button, Notice } from "./ui";

function Highlight({ text, q }: { text: string; q: string }) {
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 === 1 ? <mark key={i} className="rounded bg-brand-100 px-0.5">{part}</mark> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}

/** Search inside a video: type a word or phrase, see every moment it was said, and jump straight there. */
export function FindMoment({ file }: { file: File | null }) {
  const stt = useBrowserTranscription();
  const url = useObjectUrl(file);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [q, setQ] = useState("");

  const term = q.trim();
  const matches = useMemo(
    () => (term.length < 2 ? [] : stt.segments.filter((s) => s.text.toLowerCase().includes(term.toLowerCase()))),
    [term, stt.segments],
  );

  function seek(t: number) {
    const m = mediaRef.current;
    if (!m) return;
    m.currentTime = Math.max(0, t - 0.5);
    void m.play().catch(() => {});
    m.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const ready = stt.phase.kind === "done";

  return (
    <div className="space-y-5">
      <Notice>
        Find the Moment turns your video into searchable text in your browser, with no account. The first time, it downloads a speech model once (about 80 MB). Try a short clip first.
      </Notice>
      <div>
        <Button onClick={() => file && void stt.start(file)} disabled={!file || stt.busy}>Make it searchable</Button>
        {!file && <p className="mt-3 text-sm text-muted">Choose a file first.</p>}
        {file && stt.phase.kind === "idle" && <p className="mt-3 text-sm text-muted">{file.name} ({formatBytes(file.size)}) stays on your device. Nothing is uploaded.</p>}
      </div>
      {stt.error && <p role="alert" className="text-sm font-semibold text-danger">{stt.error}</p>}
      <SpeechProgress phase={stt.phase} doing="Listening to your file" />

      {ready && url && (
        <div className="space-y-5 rounded-2xl border border-line bg-white p-5">
          <Player url={url} video={isVideoFile(file)} mediaRef={mediaRef} />
          <div>
            <label htmlFor="search" className="mb-1.5 block text-sm font-semibold">Search for a word or phrase</label>
            <input id="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type at least 2 letters" className="w-full rounded-xl border border-line bg-white px-3 py-2.5" />
          </div>
          {term.length >= 2 && <p role="status" className="text-sm text-muted">{matches.length === 0 ? "No match. Try a different spelling or a shorter word." : `${matches.length} moment${matches.length === 1 ? "" : "s"} found.`}</p>}
          <ul className="space-y-2">
            {matches.map((m, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border border-line p-3">
                <Button variant="secondary" onClick={() => seek(m.start)}>Play {fmtClock(m.start)}</Button>
                <p className="leading-relaxed"><Highlight text={m.text} q={term} /></p>
              </li>
            ))}
          </ul>
          {term.length < 2 && stt.segments.length === 0 && <Notice>No speech was found in this file.</Notice>}
        </div>
      )}
    </div>
  );
}

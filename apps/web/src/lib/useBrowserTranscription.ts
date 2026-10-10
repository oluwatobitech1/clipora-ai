import { useEffect, useRef, useState } from "react";
import type { TranscriptSegment } from "@clipora/shared";
import { getFfmpeg, resetFfmpeg } from "./browserFfmpeg";

export const MAX_BROWSER_MB = 300;
export const MAX_MINUTES = 30;

export type TranscribePhase =
  | { kind: "idle" }
  | { kind: "prepare" }
  | { kind: "download"; pct: number }
  | { kind: "transcribe" }
  | { kind: "done" };

/** Shared by the speech tools: reads audio with ffmpeg.wasm, then runs Whisper in a worker. Nothing leaves the device. */
export function useBrowserTranscription() {
  const [phase, setPhase] = useState<TranscribePhase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [text, setText] = useState("");
  const [wordLevel, setWordLevel] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  async function decodeAudio(f: File): Promise<Float32Array> {
    const ff = await getFfmpeg();
    await ff.writeFile("input", new Uint8Array(await f.arrayBuffer()));
    const code = await ff.exec(["-i", "input", "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "audio.raw"]);
    await ff.deleteFile("input").catch(() => {});
    if (code !== 0) throw new Error("This file has no audio track, or its format could not be read.");
    const raw = (await ff.readFile("audio.raw")) as Uint8Array;
    await ff.deleteFile("audio.raw").catch(() => {});
    return new Float32Array(raw.slice().buffer);
  }

  /** words: ask for a timestamp on every word (needed to bleep exact words). Falls back to sentence timing if the browser cannot. */
  async function start(file: File, opts: { words?: boolean } = {}) {
    setError(null);
    setSegments([]);
    setText("");
    setWordLevel(false);
    if (file.size > MAX_BROWSER_MB * 1024 * 1024) {
      setError(`This file is too large to process in the browser. Please use a file under ${MAX_BROWSER_MB} MB.`);
      return;
    }
    try {
      setPhase({ kind: "prepare" });
      const audio = await decodeAudio(file);
      const secs = audio.length / 16000;
      if (secs > MAX_MINUTES * 60) throw new Error(`This recording is longer than ${MAX_MINUTES} minutes. Please use a shorter clip.`);
      if (audio.length < 1600) throw new Error("No audio was found in this file.");
      setSeconds(secs);

      workerRef.current?.terminate();
      const worker = new Worker(new URL("./whisperWorker.ts", import.meta.url), { type: "module" });
      workerRef.current = worker;
      worker.onmessage = (e: MessageEvent) => {
        const m = e.data;
        if (m.type === "download") setPhase({ kind: "download", pct: m.pct });
        else if (m.type === "transcribing") setPhase({ kind: "transcribe" });
        else if (m.type === "result") {
          setSegments(m.segments);
          setText(m.text);
          setWordLevel(!!m.wordLevel);
          setPhase({ kind: "done" });
          worker.terminate();
        } else if (m.type === "error") {
          setError("Transcription failed. Check your internet connection and try again.");
          setPhase({ kind: "idle" });
          worker.terminate();
        }
      };
      worker.onerror = () => {
        setError("Transcription could not start in this browser. Try the latest Chrome, Edge or Firefox.");
        setPhase({ kind: "idle" });
      };
      setPhase({ kind: "download", pct: 0 });
      worker.postMessage({ audio, words: !!opts.words }, [audio.buffer]);
    } catch (err) {
      resetFfmpeg();
      setPhase({ kind: "idle" });
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  const busy = phase.kind === "prepare" || phase.kind === "download" || phase.kind === "transcribe";
  return { phase, busy, error, setError, segments, text, wordLevel, seconds, start };
}

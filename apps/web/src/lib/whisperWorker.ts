/// <reference lib="webworker" />
import { pipeline, env, type ProgressInfo } from "@huggingface/transformers";

// Runs speech-to-text inside the visitor's browser. The model downloads once and is cached by the browser.
env.allowLocalModels = false;

const MODEL = "Xenova/whisper-base";
type Chunk = { timestamp?: [number | null, number | null]; text?: string };
type AsrOut = { text?: string; chunks?: Chunk[] };
type Asr = (audio: Float32Array, opts: Record<string, unknown>) => Promise<AsrOut>;
let asr: Asr | null = null;

async function load(): Promise<Asr> {
  if (asr) return asr;
  const files = new Map<string, { loaded: number; total: number }>();
  asr = (await pipeline("automatic-speech-recognition", MODEL, {
    progress_callback: (p: ProgressInfo) => {
      if (p.status === "progress" && p.file && p.total) {
        files.set(p.file, { loaded: p.loaded, total: p.total });
        let l = 0, t = 0;
        files.forEach((f) => { l += f.loaded; t += f.total; });
        self.postMessage({ type: "download", pct: t ? l / t : 0 });
      }
    },
  })) as unknown as Asr;
  return asr;
}

self.onmessage = async (e: MessageEvent<{ audio: Float32Array; words?: boolean }>) => {
  try {
    const model = await load();
    self.postMessage({ type: "transcribing" });
    const run = (words: boolean) =>
      model(e.data.audio, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: words ? "word" : true, task: "transcribe" });
    let wordLevel = !!e.data.words;
    let out: AsrOut;
    try {
      out = await run(wordLevel);
    } catch (err) {
      if (!wordLevel) throw err;
      wordLevel = false; // this browser or model could not align words: use sentence timing instead
      out = await run(false);
    }
    const chunks = (out.chunks ?? []).map((c) => ({
      start: c.timestamp?.[0] ?? 0,
      end: c.timestamp?.[1] ?? c.timestamp?.[0] ?? 0,
      text: String(c.text ?? "").trim(),
    })).filter((c) => c.text);
    self.postMessage({ type: "result", text: String(out.text ?? "").trim(), segments: chunks, wordLevel });
  } catch (err) {
    asr = null;
    self.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};

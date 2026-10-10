/// <reference lib="webworker" />
import { pipeline, env } from "@huggingface/transformers";

// Runs speech-to-text inside the visitor's browser. The model downloads once and is cached by the browser.
env.allowLocalModels = false;

const MODEL = "Xenova/whisper-base";
let asr: any = null;

async function load() {
  if (asr) return asr;
  const files = new Map<string, { loaded: number; total: number }>();
  asr = await pipeline("automatic-speech-recognition", MODEL, {
    progress_callback: (p: any) => {
      if (p.status === "progress" && p.file && p.total) {
        files.set(p.file, { loaded: p.loaded, total: p.total });
        let l = 0, t = 0;
        files.forEach((f) => { l += f.loaded; t += f.total; });
        self.postMessage({ type: "download", pct: t ? l / t : 0 });
      }
    },
  });
  return asr;
}

self.onmessage = async (e: MessageEvent<{ audio: Float32Array; words?: boolean }>) => {
  try {
    const model = await load();
    self.postMessage({ type: "transcribing" });
    const run = (words: boolean) =>
      model(e.data.audio, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: words ? "word" : true, task: "transcribe" });
    let wordLevel = !!e.data.words;
    let out: any;
    try {
      out = await run(wordLevel);
    } catch (err) {
      if (!wordLevel) throw err;
      wordLevel = false; // this browser or model could not align words: use sentence timing instead
      out = await run(false);
    }
    const chunks = (out.chunks ?? []).map((c: any) => ({
      start: c.timestamp?.[0] ?? 0,
      end: c.timestamp?.[1] ?? c.timestamp?.[0] ?? 0,
      text: String(c.text ?? "").trim(),
    })).filter((c: any) => c.text);
    self.postMessage({ type: "result", text: String(out.text ?? "").trim(), segments: chunks, wordLevel });
  } catch (err) {
    asr = null;
    self.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};

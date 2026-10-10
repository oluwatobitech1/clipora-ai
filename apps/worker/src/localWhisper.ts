/**
 * Free, offline speech-to-text: Whisper running on this computer through Transformers.js (ONNX, CPU).
 * No API key and no per-minute cost. The first run downloads the model once (about 80 MB for the default)
 * from Hugging Face into a local cache; after that it works without internet.
 *
 * The library is loaded lazily, so servers that never transcribe locally do not pay for it.
 */
import { spawn } from "node:child_process";
import type { TranscriptSegment } from "@framevox/shared";
import { MediaError } from "./ffmpeg.ts";
import type { ProviderResult, TranscriptionProvider } from "./transcribe.ts";

/** Decodes any audio file to 16 kHz mono 32-bit float samples, which is what Whisper expects. */
export function decodeToFloat32(path: string, signal?: AbortSignal): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      ["-nostdin", "-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file", "-i", path, "-f", "f32le", "-ac", "1", "-ar", "16000", "pipe:1"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const parts: Buffer[] = [];
    const onAbort = () => child.kill("SIGKILL");
    signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (c: Buffer) => parts.push(c));
    child.on("error", (err) => reject((err as NodeJS.ErrnoException).code === "ENOENT" ? new Error("ffmpeg is not installed on the worker") : err));
    child.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort);
      if (signal?.aborted) return reject(new MediaError("cancelled", "Cancelled."));
      if (code !== 0) return reject(new MediaError("processing_failed", "The audio could not be prepared for transcription."));
      const buf = Buffer.concat(parts);
      const usable = buf.length - (buf.length % 4);
      const copy = buf.buffer.slice(buf.byteOffset, buf.byteOffset + usable); // copy: keeps 4-byte alignment
      resolve(new Float32Array(copy));
    });
  });
}

interface WhisperOutput {
  text?: string;
  chunks?: { text?: string; timestamp?: [number, number | null] }[];
}
type Recognizer = (audio: Float32Array, options: Record<string, unknown>) => Promise<WhisperOutput>;

export interface LocalWhisperOptions {
  model: string;
  /** Test hook: supply a recognizer instead of loading the real model. */
  recognizer?: Recognizer;
}

/** Turns the library's chunk list into our segments. A missing end time becomes the next start (or the audio end). */
export function toSegments(out: WhisperOutput, audioSeconds: number): TranscriptSegment[] {
  const chunks = (out.chunks ?? []).filter((c) => (c.text ?? "").trim() && c.timestamp);
  return chunks.map((c, i) => {
    const start = c.timestamp![0] ?? 0;
    const nextStart = chunks[i + 1]?.timestamp?.[0];
    const end = c.timestamp![1] ?? nextStart ?? audioSeconds;
    return { start, end: Math.max(end, start), text: (c.text as string).trim() };
  });
}

export class LocalWhisperProvider implements TranscriptionProvider {
  private readonly model: string;
  private recognizer: Promise<Recognizer> | null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(opts: LocalWhisperOptions) {
    this.model = opts.model;
    this.recognizer = opts.recognizer ? Promise.resolve(opts.recognizer) : null;
  }

  private load(): Promise<Recognizer> {
    this.recognizer ??= import("@huggingface/transformers")
      .then(async ({ pipeline }) => (await pipeline("automatic-speech-recognition", this.model, { dtype: "q8" })) as unknown as Recognizer)
      .catch((err: unknown) => {
        this.recognizer = null; // allow a retry after the user fixes their connection
        console.error(JSON.stringify({ level: "error", msg: "could not load speech model", reason: err instanceof Error ? err.message : String(err) }));
        throw new MediaError(
          "transcription_unavailable",
          "The speech model could not be loaded. The first transcription needs an internet connection to download it once. Check your connection and try again.",
        );
      });
    return this.recognizer;
  }

  /** Starts loading the model without waiting for it. Errors are logged by load() and retried on first use. */
  warmup(): void {
    this.load().catch(() => undefined);
  }

  /** One recognition at a time: the model is CPU-heavy and not safe to run in parallel. */
  transcribe(filePath: string, opts: { language?: string; signal?: AbortSignal }): Promise<ProviderResult> {
    const run = this.queue.then(() => this.run(filePath, opts));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async run(filePath: string, { signal }: { language?: string; signal?: AbortSignal }): Promise<ProviderResult> {
    const samples = await decodeToFloat32(filePath, signal);
    if (samples.length < 1600) return { text: "", language: null, segments: [] }; // under 0.1 s: nothing to hear
    const recognizer = await this.load();
    if (signal?.aborted) throw new MediaError("cancelled", "Cancelled.");
    let out: WhisperOutput;
    try {
      out = await recognizer(samples, { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5, task: "transcribe" });
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "local whisper failed", reason: err instanceof Error ? err.message : String(err) }));
      throw new MediaError("transcription_failed", "The speech recognizer failed on this audio.");
    }
    const segments = toSegments(out, samples.length / 16000);
    const text = (out.text ?? segments.map((s) => s.text).join(" ")).trim();
    return { text, language: null, segments };
  }
}

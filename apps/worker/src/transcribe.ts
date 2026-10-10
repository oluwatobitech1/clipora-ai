/**
 * Speech-to-text provider boundary. The worker only talks to `TranscriptionProvider`,
 * so another engine (for example a local Whisper server) can replace OpenAI without touching the job code.
 * Nothing here invents text: if the provider returns nothing, the caller gets an empty result and fails the job.
 */
import { readFile } from "node:fs/promises";
import type { TranscriptSegment } from "@framevox/shared";
import { MediaError } from "./ffmpeg.ts";

export interface ProviderResult {
  text: string;
  language: string | null;
  segments: TranscriptSegment[];
}

export interface TranscriptionProvider {
  /** Transcribes one audio file. Timestamps in the result are relative to the start of that file. */
  transcribe(filePath: string, opts: { language?: string; signal?: AbortSignal }): Promise<ProviderResult>;
}

export interface OpenAIOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

interface VerboseJson {
  text?: string;
  language?: string;
  segments?: { start?: number; end?: number; text?: string }[];
  duration?: number;
}

export class OpenAIProvider implements TranscriptionProvider {
  private readonly opts: OpenAIOptions;
  constructor(opts: OpenAIOptions) {
    this.opts = opts;
  }

  async transcribe(filePath: string, { language, signal }: { language?: string; signal?: AbortSignal }): Promise<ProviderResult> {
    const form = new FormData();
    form.append("file", new Blob([await readFile(filePath)], { type: "audio/mpeg" }), "audio.mp3");
    form.append("model", this.opts.model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    if (language) form.append("language", language);

    let res: Response;
    try {
      res = await fetch(`${this.opts.baseUrl}/v1/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.opts.apiKey}` },
        body: form,
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(this.opts.timeoutMs)]) : AbortSignal.timeout(this.opts.timeoutMs),
      });
    } catch {
      if (signal?.aborted) throw new MediaError("cancelled", "Cancelled.");
      throw new Error("transcription provider unreachable or timed out"); // temporary: the job is retried
    }

    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      console.error(JSON.stringify({ level: "error", msg: "transcription provider error", status: res.status, detail }));
      if (res.status === 401 || res.status === 403) {
        throw new MediaError("transcription_unavailable", "The transcription service rejected this server's API key. The site owner needs to check OPENAI_API_KEY.");
      }
      if (res.status === 429 && /insufficient_quota/.test(detail)) {
        throw new MediaError("transcription_unavailable", "The transcription service account is out of credit. The site owner needs to add billing.");
      }
      if (res.status === 429 || res.status >= 500) throw new Error(`transcription provider returned ${res.status}`); // temporary
      throw new MediaError("transcription_failed", "The transcription service could not process this audio.");
    }

    const data = (await res.json().catch(() => null)) as VerboseJson | null;
    if (!data || typeof data.text !== "string") {
      throw new Error("transcription provider returned an unreadable response");
    }
    const segments: TranscriptSegment[] = (data.segments ?? [])
      .filter((s) => typeof s.start === "number" && typeof s.end === "number" && typeof s.text === "string")
      .map((s) => ({ start: s.start as number, end: s.end as number, text: (s.text as string).trim() }))
      .filter((s) => s.text.length > 0);
    return { text: data.text.trim(), language: data.language ?? null, segments };
  }
}

/** Joins per-chunk results into one transcript, moving each chunk's timestamps by that chunk's start time. */
export function mergeChunks(chunks: { offsetSeconds: number; result: ProviderResult }[]): ProviderResult {
  const segments: TranscriptSegment[] = [];
  const texts: string[] = [];
  let language: string | null = null;
  for (const { offsetSeconds, result } of chunks) {
    language ??= result.language;
    if (result.text) texts.push(result.text);
    for (const s of result.segments) {
      segments.push({ start: s.start + offsetSeconds, end: s.end + offsetSeconds, text: s.text });
    }
  }
  return { text: texts.join(" ").trim(), language, segments };
}

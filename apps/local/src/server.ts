/**
 * Local mode: the whole product on one laptop, with no Supabase, no accounts and no database.
 * Files go to a temp folder, FFmpeg runs in this process, jobs live in memory.
 * It listens on 127.0.0.1 only, so nobody else on the network can reach it. Not for the public internet.
 * It reuses the worker's FFmpeg and transcription code, so results match the hosted version.
 */
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import {
  AUDIO_OUTPUT_FORMATS, audioContentType, buildDownloadName, validateMediaFile,
  type AudioOutputFormat, type ErrorCode, type JobDto, type TaskType, type TranscriptDto,
} from "@clipora/shared";
import { assertProcessable, extractAudio, extractSpeechChunks, MediaError, probeMedia, validateOutput } from "../../worker/src/ffmpeg.ts";
import { LocalWhisperProvider } from "../../worker/src/localWhisper.ts";
import { mergeChunks, OpenAIProvider, type ProviderResult, type TranscriptionProvider } from "../../worker/src/transcribe.ts";

export interface LocalConfig {
  port: number;
  maxUploadMb: number;
  maxDurationSeconds: number;
  retentionMs: number;
  openaiApiKey: string;
  openaiBaseUrl: string;
  transcribeModel: string;
  chunkSeconds: number;
  engine: "auto" | "local" | "openai";
  localModel: string;
  ffmpegTimeoutMs: number;
  provider?: TranscriptionProvider; // tests inject one
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): LocalConfig {
  const num = (k: string, d: number) => (Number(env[k]) > 0 ? Number(env[k]) : d);
  return {
    port: num("API_PORT", 3001),
    maxUploadMb: num("LOCAL_MAX_UPLOAD_MB", 500),
    maxDurationSeconds: num("MAX_MEDIA_DURATION_MINUTES", 240) * 60,
    retentionMs: num("RETENTION_HOURS", 2) * 3600_000,
    openaiApiKey: env.OPENAI_API_KEY ?? "",
    openaiBaseUrl: (env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/+$/, ""),
    transcribeModel: env.TRANSCRIBE_MODEL || "whisper-1",
    chunkSeconds: num("TRANSCRIBE_CHUNK_SECONDS", 0), // 0 = pick by engine
    engine: env.TRANSCRIBE_ENGINE === "local" || env.TRANSCRIBE_ENGINE === "openai" ? env.TRANSCRIBE_ENGINE : "auto",
    localModel: env.LOCAL_WHISPER_MODEL || "Xenova/whisper-base",
    ffmpegTimeoutMs: num("FFMPEG_TIMEOUT_SECONDS", 1800) * 1000,
  };
}

interface Job {
  dto: JobDto;
  dir: string;
  inputPath: string;
  originalName: string;
  language?: string;
  outputPath?: string;
  transcript?: TranscriptDto;
  abort: AbortController;
  cancelled: boolean;
}

const RETRYABLE: ErrorCode[] = ["processing_failed", "transcription_failed", "internal_error"];

export async function buildLocalApp(config: LocalConfig) {
  const app = Fastify({ logger: { level: "info" }, bodyLimit: 1024 * 1024 });
  await app.register(multipart, { limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1, fields: 10 } });

  const root = await mkdtemp(join(tmpdir(), "clipora-local-"));
  const jobs = new Map<string, Job>();
  let running = 0;
  const waiting: (() => void)[] = [];
  const slot = async () => { if (running >= 2) await new Promise<void>((r) => waiting.push(r)); running++; };
  const release = () => { running--; waiting.shift()?.(); };

  // Engine: an OpenAI key (if set) gives cloud transcription; otherwise free Whisper runs on this computer.
  const useOpenAI = config.engine === "openai" || (config.engine === "auto" && !!config.openaiApiKey);
  const provider: TranscriptionProvider | null =
    config.provider ??
    (useOpenAI
      ? config.openaiApiKey
        ? new OpenAIProvider({ apiKey: config.openaiApiKey, baseUrl: config.openaiBaseUrl, model: config.transcribeModel, timeoutMs: 300_000 })
        : null
      : new LocalWhisperProvider({ model: config.localModel }));
  const engine = config.provider ? "custom" : useOpenAI ? "openai" : "local-whisper";
  // Local Whisper is slow, so smaller pieces keep the progress bar moving.
  const chunkSeconds = config.chunkSeconds || (engine === "local-whisper" ? 180 : 600);

  const get = (id: string): Job => {
    const job = jobs.get(id);
    if (!job) throw Object.assign(new Error("Job not found."), { statusCode: 404, code: "not_found" });
    return job;
  };

  async function drop(job: Job) {
    jobs.delete(job.dto.id);
    await rm(job.dir, { recursive: true, force: true });
  }

  async function run(job: Job) {
    const d = job.dto;
    d.status = "queued"; d.progress = null; d.errorCode = null; d.errorMessage = null; d.retryable = false;
    job.abort = new AbortController();
    await slot();
    if (job.cancelled) { release(); return; }
    d.status = "processing"; d.progress = 0;
    const signal = job.abort.signal;
    try {
      const info = await probeMedia(job.inputPath);
      assertProcessable(info, config.maxDurationSeconds);

      if (d.taskType === "audio_extract") {
        const format = d.format as AudioOutputFormat;
        const out = join(job.dir, `audio.${format}`);
        await extractAudio(job.inputPath, out, format, {
          durationSeconds: info.durationSeconds, timeoutMs: config.ffmpegTimeoutMs, signal,
          onProgress: (f) => { d.progress = f; },
        });
        const res = await validateOutput(out, format, info.durationSeconds, Number.MAX_SAFE_INTEGER);
        job.outputPath = out;
        d.outputName = buildDownloadName(job.originalName, format);
        d.outputSizeBytes = res.sizeBytes;
      } else {
        if (!provider) {
          throw new MediaError("transcription_unavailable", "TRANSCRIBE_ENGINE is set to openai but OPENAI_API_KEY is missing. Add the key to the .env file, or remove TRANSCRIBE_ENGINE to use the free local engine.");
        }
        const chunkDir = join(job.dir, "chunks");
        await rm(chunkDir, { recursive: true, force: true });
        await mkdir(chunkDir);
        const chunks = await extractSpeechChunks(job.inputPath, chunkDir, chunkSeconds, {
          durationSeconds: info.durationSeconds, timeoutMs: config.ffmpegTimeoutMs, signal, onProgress: (f) => { d.progress = f * 0.3; },
        });
        const results: { offsetSeconds: number; result: ProviderResult }[] = [];
        let offset = 0;
        for (let i = 0; i < chunks.length; i++) {
          if (signal.aborted) throw new MediaError("cancelled", "Cancelled.");
          const ci = await probeMedia(chunks[i]!);
          results.push({ offsetSeconds: offset, result: await provider.transcribe(chunks[i]!, { language: job.language, signal }) });
          offset += ci.durationSeconds;
          d.progress = 0.3 + 0.7 * ((i + 1) / chunks.length);
        }
        await rm(chunkDir, { recursive: true, force: true });
        const merged = mergeChunks(results);
        if (!merged.text) throw new MediaError("no_speech", "No speech was detected in this recording.");
        job.transcript = {
          jobId: d.id, text: merged.text, segments: merged.segments, language: merged.language,
          durationSeconds: info.durationSeconds, title: job.originalName.replace(/\.[^.]*$/, "") || "transcript",
          expiresAt: d.expiresAt ?? "",
        };
      }
      d.status = "completed"; d.progress = 1; d.completedAt = new Date().toISOString();
    } catch (err) {
      if (job.cancelled) return; // the cancel route already removed this job
      d.status = "failed"; d.progress = null; d.completedAt = new Date().toISOString();
      if (err instanceof MediaError) {
        d.errorCode = err.code as ErrorCode; d.errorMessage = err.message;
      } else {
        app.log.error({ err: err instanceof Error ? err.message : String(err) }, "job failed");
        const text = err instanceof Error ? err.message : "";
        d.errorCode = "internal_error";
        d.errorMessage = /not installed/.test(text)
          ? "FFmpeg is not installed or not on PATH. Install it, then reopen VS Code and restart."
          : "Something went wrong while processing. Please try again.";
      }
      d.retryable = RETRYABLE.includes(d.errorCode);
    } finally {
      release();
    }
  }

  app.get("/api/mode", async () => ({ mode: "local", transcription: !!provider, engine }));
  app.get("/api/health", async () => ({ ok: true }));

  app.post("/api/local/jobs", async (request, reply) => {
    const fields: Record<string, string> = {};
    let saved: { path: string; name: string; type: string; dir: string } | null = null;
    const id = randomUUID();
    const dir = join(root, id);
    await mkdir(dir);
    try {
      for await (const part of request.parts()) {
        if (part.type === "field") {
          fields[part.fieldname] = String(part.value).slice(0, 100);
        } else if (!saved) {
          const name = part.filename.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255) || "file";
          const path = join(dir, "input"); // generated path; the user's name is never used on disk
          await pipeline(part.file, createWriteStream(path));
          if (part.file.truncated) throw Object.assign(new Error(`This file is larger than the ${config.maxUploadMb} MB limit.`), { statusCode: 413, code: "file_too_large" });
          saved = { path, name, type: part.mimetype, dir };
        }
      }
      if (!saved) throw Object.assign(new Error("Choose a file first."), { statusCode: 400, code: "validation_failed" });
      const size = (await stat(saved.path)).size;
      const check = validateMediaFile({ name: saved.name, size, type: saved.type }, config.maxUploadMb);
      if (!check.ok) throw Object.assign(new Error(check.message), { statusCode: 400, code: "validation_failed" });

      const task: TaskType = fields.task === "transcribe" ? "transcribe" : "audio_extract";
      const format = AUDIO_OUTPUT_FORMATS.find((f) => f === fields.format) ?? "mp3";
      const now = new Date();
      const job: Job = {
        dir, inputPath: saved.path, originalName: saved.name, abort: new AbortController(), cancelled: false,
        language: /^[a-z]{2,3}$/.test(fields.language ?? "") ? fields.language : undefined,
        dto: {
          id, taskType: task, projectId: id, status: "queued", progress: null, errorCode: null, errorMessage: null,
          retryable: false, format: task === "audio_extract" ? format : null, createdAt: now.toISOString(), completedAt: null,
          expiresAt: new Date(now.getTime() + config.retentionMs).toISOString(), outputName: null, outputSizeBytes: null,
        },
      };
      jobs.set(id, job);
      void run(job);
      return reply.code(202).send(job.dto);
    } catch (err) {
      await rm(dir, { recursive: true, force: true });
      throw err;
    }
  });

  app.get<{ Params: { id: string } }>("/api/jobs/:id", async (request) => get(request.params.id).dto);

  app.post<{ Params: { id: string } }>("/api/jobs/:id/retry", async (request, reply) => {
    const job = get(request.params.id);
    if (job.dto.status !== "failed" || !job.dto.retryable) {
      throw Object.assign(new Error("This job cannot be retried. Choose the file again."), { statusCode: 409, code: "not_retryable" });
    }
    void run(job);
    return reply.code(202).send(job.dto);
  });

  // Stops FFmpeg / the provider request and removes the job and its files.
  app.post<{ Params: { id: string } }>("/api/jobs/:id/cancel", async (request, reply) => {
    const job = get(request.params.id);
    job.cancelled = true;
    job.abort.abort();
    await drop(job);
    return reply.code(204).send();
  });

  app.get<{ Params: { id: string } }>("/api/jobs/:id/download", async (request) => {
    const job = get(request.params.id);
    if (job.dto.status !== "completed" || !job.outputPath) throw Object.assign(new Error("The result is not ready yet."), { statusCode: 409, code: "not_found" });
    return { url: `/api/local/files/${job.dto.id}`, fileName: job.dto.outputName };
  });

  app.get<{ Params: { id: string } }>("/api/local/files/:id", async (request, reply) => {
    const job = get(request.params.id);
    if (!job.outputPath || job.dto.status !== "completed") throw Object.assign(new Error("Not found."), { statusCode: 404, code: "not_found" });
    const name = (job.dto.outputName ?? "audio").replace(/["\\\r\n]/g, "_");
    return reply
      .header("Content-Type", audioContentType(job.dto.format as AudioOutputFormat))
      .header("Content-Disposition", `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`)
      .send(createReadStream(job.outputPath));
  });

  app.get<{ Params: { id: string } }>("/api/jobs/:id/transcript", async (request) => {
    const job = get(request.params.id);
    if (!job.transcript) throw Object.assign(new Error("The transcript is not ready yet."), { statusCode: 409, code: "not_found" });
    return job.transcript;
  });

  app.delete<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
    await drop(get(request.params.id));
    return reply.code(204).send();
  });

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, request, reply) => {
    const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    if (status === 500) request.log.error({ err: err.message }, "unhandled error");
    const code = status === 413 || err.code === "FST_REQ_FILE_TOO_LARGE" ? "file_too_large" : (err.code && /^[a-z_]+$/.test(err.code) ? err.code : status === 500 ? "internal_error" : "validation_failed");
    const message = status === 500 ? "Something went wrong. Please try again." : err.code === "FST_REQ_FILE_TOO_LARGE" ? `This file is larger than the ${config.maxUploadMb} MB limit.` : err.message;
    return reply.code(err.code === "FST_REQ_FILE_TOO_LARGE" ? 413 : status).send({ error: { code, message } });
  });

  // Delete finished jobs after the retention time, so the temp folder never fills up.
  const sweep = setInterval(() => {
    for (const job of jobs.values()) {
      const done = job.dto.status === "completed" || job.dto.status === "failed";
      if (done && job.dto.expiresAt && Date.parse(job.dto.expiresAt) < Date.now()) void drop(job);
    }
  }, 60_000);
  sweep.unref();

  app.addHook("onClose", async () => {
    clearInterval(sweep);
    await rm(root, { recursive: true, force: true });
  });

  return { app, root, jobs, listFiles: () => readdir(root) };
}

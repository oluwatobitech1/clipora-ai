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
} from "@framevox/shared";
import { assertProcessable, extractAudio, extractSpeechChunks, MediaError, probeMedia, validateOutput } from "../../worker/src/ffmpeg.ts";
import { assertPublicDns, fetchLink, LinkError, parseCookiesBrowser, validateLinkUrl, ytdlpAvailable } from "./links.ts";
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
  /** Path of the yt-dlp program used for link import. */
  ytdlpPath: string;
  linkTimeoutMs: number;
  /** Optional: use the signed-in session of this browser for sites that demand a login. */
  cookiesBrowser?: string;
  /** Tests only: lets links to this computer through. */
  allowPrivateLinkHosts?: boolean;
  provider?: TranscriptionProvider; // tests inject one
  /** Hosted link server: only link import (no uploads, no transcription), reachable from your website. */
  linkOnly?: boolean;
  /** Websites allowed to call this server from a browser (CORS). Needed for linkOnly. */
  corsOrigins?: string[];
  host?: string;
  cookiesFile?: string;
  /** Link imports allowed per visitor per hour (linkOnly). */
  linkRatePerHour?: number;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): LocalConfig {
  const num = (k: string, d: number) => (Number(env[k]) > 0 ? Number(env[k]) : d);
  return {
    port: num("PORT", num("API_PORT", 3001)),
    maxUploadMb: num("LOCAL_MAX_UPLOAD_MB", 500),
    maxDurationSeconds: num("MAX_MEDIA_DURATION_MINUTES", 240) * 60,
    retentionMs: num("RETENTION_HOURS", 2) * 3600_000,
    openaiApiKey: env.OPENAI_API_KEY ?? "",
    openaiBaseUrl: (env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/+$/, ""),
    transcribeModel: env.TRANSCRIBE_MODEL || "whisper-1",
    chunkSeconds: num("TRANSCRIBE_CHUNK_SECONDS", 0), // 0 = pick by engine
    engine: env.TRANSCRIBE_ENGINE === "local" || env.TRANSCRIBE_ENGINE === "openai" ? env.TRANSCRIBE_ENGINE : "auto",
    localModel: env.LOCAL_WHISPER_MODEL || "Xenova/whisper-tiny",
    ffmpegTimeoutMs: num("FFMPEG_TIMEOUT_SECONDS", 1800) * 1000,
    ytdlpPath: env.YTDLP_PATH || "yt-dlp",
    linkTimeoutMs: num("LINK_TIMEOUT_MINUTES", 15) * 60_000,
    cookiesBrowser: parseCookiesBrowser(env.YTDLP_COOKIES_BROWSER),
    linkOnly: env.LINK_SERVER === "1",
    corsOrigins: (env.CORS_ORIGIN ?? "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean),
    host: env.LINK_SERVER === "1" ? "0.0.0.0" : "127.0.0.1",
    cookiesFile: env.YTDLP_COOKIES_FILE || undefined,
    linkRatePerHour: num("LINK_RATE_PER_HOUR", 20),
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

interface LinkJob {
  id: string;
  dir: string;
  status: "downloading" | "ready" | "failed";
  progress: number | null;
  errorCode: string | null;
  message: string | null;
  fileName: string | null;
  filePath: string | null;
  sizeBytes: number | null;
  abort: AbortController;
  createdAt: number;
}

const RETRYABLE: ErrorCode[] = ["processing_failed", "transcription_failed", "internal_error"];

export async function buildLocalApp(config: LocalConfig) {
  const app = Fastify({ logger: { level: "info" }, bodyLimit: 1024 * 1024, trustProxy: !!config.linkOnly });

  // Browser access from the website (CORS), and in link-only mode nothing but link import is reachable.
  const allowed = new Set(config.corsOrigins ?? []);
  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && allowed.has(origin)) {
      reply.header("Access-Control-Allow-Origin", origin).header("Vary", "Origin")
        .header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS").header("Access-Control-Allow-Headers", "content-type").header("Access-Control-Max-Age", "600");
    }
    if (request.method === "OPTIONS") return reply.code(204).send();
    if (config.linkOnly && !/^\/api\/(local\/links|mode|health)(\/|$)/.test(request.url.split("?")[0]!)) {
      return reply.code(404).send({ error: { code: "not_found", message: "Not found." } });
    }
  });
  const hits = new Map<string, number[]>();
  const rateLimited = (ip: string) => {
    if (!config.linkOnly) return false;
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
    if (recent.length >= (config.linkRatePerHour ?? 20)) { hits.set(ip, recent); return true; }
    recent.push(now); hits.set(ip, recent);
    return false;
  };
  await app.register(multipart, { limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1, fields: 10 } });

  const root = await mkdtemp(join(tmpdir(), "framevox-local-"));
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
  // Load the speech model now, in the background, so the first transcription does not wait for it.
  if (provider instanceof LocalWhisperProvider && !config.provider && !config.linkOnly) provider.warmup();
  const engine = config.provider ? "custom" : useOpenAI ? "openai" : "local-whisper";
  // Local Whisper is slow, so smaller pieces keep the progress bar moving.
  const chunkSeconds = config.chunkSeconds || (engine === "local-whisper" ? 180 : 600);

  const links = new Map<string, LinkJob>();
  let ytdlpOk: boolean | null = null;
  const checkYtdlp = async () => (ytdlpOk ??= await ytdlpAvailable(config.ytdlpPath));

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

  app.get("/api/mode", async () => ({ mode: config.linkOnly ? "links" : "local", transcription: !!provider, engine, links: await checkYtdlp() }));

  // ---- Link import: fetch a video from a web link, then hand the file to the browser like a normal upload ----
  const linkDto = (l: LinkJob) => ({
    id: l.id, status: l.status, progress: l.progress, errorCode: l.errorCode, message: l.message, fileName: l.fileName, sizeBytes: l.sizeBytes,
  });
  const getLink = (id: string): LinkJob => {
    const l = links.get(id);
    if (!l) throw Object.assign(new Error("Link download not found."), { statusCode: 404, code: "not_found" });
    return l;
  };
  async function dropLink(l: LinkJob) {
    l.abort.abort();
    links.delete(l.id);
    await rm(l.dir, { recursive: true, force: true });
  }

  app.post<{ Body: { url?: unknown; confirmed?: unknown; audioOnly?: unknown } }>("/api/local/links", async (request, reply) => {
    const body = request.body ?? {};
    if (rateLimited(request.ip)) {
      throw Object.assign(new Error("You have fetched a lot of links this hour. Please try again later, or upload the file instead."), { statusCode: 429, code: "busy" });
    }
    if (body.confirmed !== true) {
      throw Object.assign(new Error("Please confirm that you own this content or have permission to use it."), { statusCode: 400, code: "consent_required" });
    }
    let url: string;
    try {
      url = validateLinkUrl(typeof body.url === "string" ? body.url : "", { allowPrivateHosts: config.allowPrivateLinkHosts });
    } catch (err) {
      throw Object.assign(err as Error, { statusCode: 400 });
    }
    if (!config.allowPrivateLinkHosts) {
      try { await assertPublicDns(url); } catch (err) { throw Object.assign(err as Error, { statusCode: 400 }); }
    }
    if (!(await checkYtdlp())) {
      // Re-check once: the visitor may have installed it since the server started.
      ytdlpOk = null;
      if (!(await checkYtdlp())) {
        throw Object.assign(new Error("Link import needs the free tool yt-dlp. Install it (Windows: winget install yt-dlp.yt-dlp), then restart Framevox."), { statusCode: 503, code: "link_tool_missing" });
      }
    }
    if ([...links.values()].filter((l) => l.status === "downloading").length >= 2) {
      throw Object.assign(new Error("Two links are already being fetched. Wait for one to finish."), { statusCode: 429, code: "busy" });
    }
    const id = randomUUID();
    const dir = join(root, `link-${id}`);
    await mkdir(dir);
    const link: LinkJob = { id, dir, status: "downloading", progress: null, errorCode: null, message: null, fileName: null, filePath: null, sizeBytes: null, abort: new AbortController(), createdAt: Date.now() };
    links.set(id, link);
    void (async () => {
      try {
        const res = await fetchLink(url, dir, {
          ytdlpPath: config.ytdlpPath, maxMb: config.maxUploadMb, maxDurationSeconds: config.maxDurationSeconds,
          timeoutMs: config.linkTimeoutMs, cookiesBrowser: config.cookiesBrowser, cookiesFile: config.cookiesFile, audioOnly: body.audioOnly === true, signal: link.abort.signal, onProgress: (f) => { link.progress = f; },
        });
        link.filePath = res.path; link.fileName = res.name; link.sizeBytes = (await stat(res.path)).size;
        link.progress = 1; link.status = "ready";
      } catch (err) {
        if (link.abort.signal.aborted) return;
        link.status = "failed"; link.progress = null;
        if (err instanceof LinkError) { link.errorCode = err.code; link.message = err.message; }
        else {
          app.log.error({ err: err instanceof Error ? err.message : String(err) }, "link import failed");
          link.errorCode = "link_failed"; link.message = "Could not fetch this link. Please try again.";
        }
      }
    })();
    return reply.code(202).send(linkDto(link));
  });

  app.get<{ Params: { id: string } }>("/api/local/links/:id", async (request) => linkDto(getLink(request.params.id)));

  app.get<{ Params: { id: string } }>("/api/local/links/:id/file", async (request, reply) => {
    const l = getLink(request.params.id);
    if (l.status !== "ready" || !l.filePath || !l.fileName) throw Object.assign(new Error("The file is not ready yet."), { statusCode: 409, code: "not_found" });
    const name = l.fileName.replace(/["\\\r\n]/g, "_");
    const isAudio = /\.(mp3|wav|m4a)$/i.test(name);
    const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
    const type = isAudio ? (ext === "mp3" ? "audio/mpeg" : ext === "wav" ? "audio/wav" : "audio/mp4") : ext === "webm" ? "video/webm" : ext === "mkv" ? "video/x-matroska" : ext === "mov" ? "video/quicktime" : "video/mp4";
    return reply
      .header("Content-Type", type)
      .header("Content-Length", String(l.sizeBytes ?? 0))
      .header("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`)
      .send(createReadStream(l.filePath));
  });

  // Cancels a running fetch, or removes the temporary copy once the browser has it.
  app.delete<{ Params: { id: string } }>("/api/local/links/:id", async (request, reply) => {
    await dropLink(getLink(request.params.id));
    return reply.code(204).send();
  });
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
    const status = err.statusCode && (err.statusCode < 500 || err.statusCode === 503) ? err.statusCode : 500;
    if (status === 500) request.log.error({ err: err.message }, "unhandled error");
    const code = status === 413 || err.code === "FST_REQ_FILE_TOO_LARGE" ? "file_too_large" : (err.code && /^[a-z_]+$/.test(err.code) ? err.code : status === 500 ? "internal_error" : "validation_failed");
    const message = status === 500 ? "Something went wrong. Please try again." : err.code === "FST_REQ_FILE_TOO_LARGE" ? `This file is larger than the ${config.maxUploadMb} MB limit.` : err.message;
    return reply.code(err.code === "FST_REQ_FILE_TOO_LARGE" ? 413 : status).send({ error: { code, message } });
  });

  // Delete finished jobs after the retention time, so the temp folder never fills up.
  const sweep = setInterval(() => {
    for (const l of links.values()) if (Date.now() - l.createdAt > 30 * 60_000) void dropLink(l);
    for (const job of jobs.values()) {
      const done = job.dto.status === "completed" || job.dto.status === "failed";
      if (done && job.dto.expiresAt && Date.parse(job.dto.expiresAt) < Date.now()) void drop(job);
    }
  }, 60_000);
  sweep.unref();

  app.addHook("onClose", async () => {
    clearInterval(sweep);
    for (const l of links.values()) l.abort.abort();
    await rm(root, { recursive: true, force: true });
  });

  return { app, root, jobs, listFiles: () => readdir(root) };
}

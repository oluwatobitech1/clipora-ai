import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { audioContentType, buildDownloadName, JOB_ATTEMPTS, type AudioOutputFormat } from "@clipora/shared";
import { config } from "./config.ts";
import { db, type JobRow, type MediaRow } from "./db.ts";
import { assertProcessable, extractAudio, extractSpeechChunks, MediaError, probeMedia, validateOutput } from "./ffmpeg.ts";
import { log } from "./log.ts";
import { mergeChunks, OpenAIProvider, type ProviderResult, type TranscriptionProvider } from "./transcribe.ts";

async function fail(jobId: string, code: string, message: string): Promise<void> {
  const { error } = await db
    .from("processing_jobs")
    .update({ status: "failed", error_code: code, error_message: message, progress_value: null, completed_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) log.error("could not record failure", { jobId, reason: error.message });
}

async function downloadTo(url: string, dest: string, maxBytes: number): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`storage download failed with status ${res.status}`);
  let total = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      total += chunk.length;
      if (total > maxBytes) cb(new MediaError("file_too_large", "This file is larger than the allowed limit."));
      else cb(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(res.body as unknown as WebReadableStream), limiter, createWriteStream(dest));
}

/**
 * Runs one extraction job that has already been claimed (status "processing") by the poller.
 * Permanent problems (bad file) are recorded as failed straight away.
 * Temporary problems (network, storage) put the job back in the queue until JOB_ATTEMPTS is used up.
 */
export async function processJob(job: JobRow): Promise<void> {
  const jobId = job.id;
  const workdir = await mkdtemp(join(tmpdir(), "clipora-"));
  try {
    const { data: mediaData } = job.media_file_id
      ? await db.from("media_files").select("id, bucket, storage_key, original_name").eq("id", job.media_file_id).maybeSingle()
      : { data: null };
    const media = mediaData as MediaRow | null;
    if (!media) throw new MediaError("file_not_found", "The uploaded file is no longer available. Please upload it again.");

    if (job.task_type === "transcribe" && !config.openaiApiKey) {
      // Checked before downloading anything, so a missing key costs nothing.
      throw new MediaError("transcription_unavailable", "Transcription is not set up on this server yet. The site owner needs to add OPENAI_API_KEY.");
    }

    const format: AudioOutputFormat = job.params.format === "wav" || job.params.format === "m4a" ? job.params.format : "mp3";
    const input = join(workdir, "input");
    const output = join(workdir, `audio.${format}`);

    const { data: signed, error: signError } = await db.storage.from(media.bucket).createSignedUrl(media.storage_key, 300);
    if (signError || !signed) throw new Error("could not create download link for the original");
    await downloadTo(signed.signedUrl, input, config.maxUploadBytes);

    const info = await probeMedia(input);
    assertProcessable(info, config.maxDurationSeconds);
    await db.from("media_files").update({ duration_seconds: info.durationSeconds }).eq("id", media.id);

    if (job.task_type === "transcribe") {
      await runTranscription(job, media, input, info.durationSeconds, workdir);
      return;
    }

    // Real progress from FFmpeg, written at most every two seconds.
    let lastWrite = 0;
    await extractAudio(input, output, format, {
      durationSeconds: info.durationSeconds,
      timeoutMs: config.ffmpegTimeoutMs,
      threads: config.ffmpegThreads,
      onProgress: (fraction) => {
        const now = Date.now();
        if (now - lastWrite < 2000) return;
        lastWrite = now;
        void db.from("processing_jobs").update({ progress_value: Number(fraction.toFixed(3)) }).eq("id", jobId).eq("status", "processing");
      },
    });

    const out = await validateOutput(output, format, info.durationSeconds, config.maxExportBytes);

    const exportKey = `exports/${job.owner_id}/${job.id}.${format}`;
    const { error: uploadError } = await db.storage
      .from(media.bucket)
      .upload(exportKey, await readFile(output), { contentType: audioContentType(format), upsert: true });
    if (uploadError) throw new Error(`could not store result: ${uploadError.message}`);

    const expiresAt = new Date(Date.now() + config.retentionHours * 3600_000).toISOString();
    const { error: exportError } = await db.from("exports").upsert(
      {
        project_id: job.project_id,
        job_id: job.id,
        owner_id: job.owner_id,
        bucket: media.bucket,
        storage_key: exportKey,
        format,
        download_name: buildDownloadName(media.original_name, format),
        size_bytes: out.sizeBytes,
        expires_at: expiresAt,
      },
      { onConflict: "storage_key" },
    );
    if (exportError) throw new Error(`could not record result: ${exportError.message}`);

    await db
      .from("processing_jobs")
      .update({ status: "completed", progress_value: 1, completed_at: new Date().toISOString(), error_code: null, error_message: null })
      .eq("id", jobId);
    log.info("job completed", { jobId, format, bytes: out.sizeBytes });
  } catch (err) {
    if (err instanceof MediaError) {
      await fail(jobId, err.code, err.message);
      log.info("job failed (permanent)", { jobId, code: err.code });
    } else {
      const reason = err instanceof Error ? err.message : String(err);
      if (job.attempts < JOB_ATTEMPTS) {
        await db.from("processing_jobs").update({ status: "queued", progress_value: null }).eq("id", jobId);
        log.error("job attempt failed, will retry", { jobId, attempt: job.attempts, reason });
      } else {
        await fail(jobId, "internal_error", "Something went wrong while processing. Please try again.");
        log.error("job failed (out of attempts)", { jobId, reason });
      }
    }
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

let defaultProvider: TranscriptionProvider | null = null;
function provider(): TranscriptionProvider {
  defaultProvider ??= new OpenAIProvider({
    apiKey: config.openaiApiKey,
    baseUrl: config.openaiBaseUrl,
    model: config.transcribeModel,
    timeoutMs: config.transcribeRequestTimeoutMs,
  });
  return defaultProvider;
}

/** Cuts the audio into chunks, sends each to the provider, joins the real results and stores them. */
async function runTranscription(job: JobRow, media: MediaRow, input: string, durationSeconds: number, workdir: string): Promise<void> {
  const chunkDir = join(workdir, "chunks");
  await mkdir(chunkDir);

  // First 30% of the progress bar is audio preparation, the rest is the provider calls. Both are measured, not animated.
  let lastWrite = 0;
  const writeProgress = (value: number, force = false) => {
    const now = Date.now();
    if (!force && now - lastWrite < 2000) return;
    lastWrite = now;
    void db.from("processing_jobs").update({ progress_value: Number(value.toFixed(3)) }).eq("id", job.id).eq("status", "processing");
  };

  const chunkPaths = await extractSpeechChunks(input, chunkDir, config.transcribeChunkSeconds, {
    durationSeconds,
    timeoutMs: config.ffmpegTimeoutMs,
    threads: config.ffmpegThreads,
    onProgress: (f) => writeProgress(f * 0.3),
  });

  const results: { offsetSeconds: number; result: ProviderResult }[] = [];
  let offset = 0;
  for (let i = 0; i < chunkPaths.length; i++) {
    const path = chunkPaths[i]!;
    const chunkInfo = await probeMedia(path);
    const result = await provider().transcribe(path, { language: job.params.language });
    results.push({ offsetSeconds: offset, result });
    offset += chunkInfo.durationSeconds;
    writeProgress(0.3 + 0.7 * ((i + 1) / chunkPaths.length), true);
  }

  const merged = mergeChunks(results);
  if (!merged.text) {
    throw new MediaError("no_speech", "No speech was detected in this recording.");
  }

  const stem = media.original_name.replace(/\.[^.]*$/, "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200) || "transcript";
  const expiresAt = new Date(Date.now() + config.retentionHours * 3600_000).toISOString();
  const { error } = await db.from("transcripts").upsert(
    {
      project_id: job.project_id,
      job_id: job.id,
      owner_id: job.owner_id,
      title: stem,
      full_text: merged.text,
      segments: merged.segments,
      language: merged.language,
      duration_seconds: durationSeconds,
      expires_at: expiresAt,
    },
    { onConflict: "job_id" },
  );
  if (error) throw new Error(`could not store transcript: ${error.message}`);

  await db
    .from("processing_jobs")
    .update({ status: "completed", progress_value: 1, completed_at: new Date().toISOString(), error_code: null, error_message: null })
    .eq("id", job.id);
  log.info("transcription completed", { jobId: job.id, chunks: chunkPaths.length, characters: merged.text.length });
}

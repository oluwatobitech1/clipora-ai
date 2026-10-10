import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { audioContentType, buildDownloadName, JOB_ATTEMPTS, type AudioOutputFormat } from "@clipora/shared";
import { config } from "./config.ts";
import { db, type JobRow, type MediaRow } from "./db.ts";
import { assertProcessable, extractAudio, MediaError, probeMedia, validateOutput } from "./ffmpeg.ts";
import { log } from "./log.ts";

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

    const format: AudioOutputFormat = job.params.format === "wav" ? "wav" : "mp3";
    const input = join(workdir, "input");
    const output = join(workdir, `audio.${format}`);

    const { data: signed, error: signError } = await db.storage.from(media.bucket).createSignedUrl(media.storage_key, 300);
    if (signError || !signed) throw new Error("could not create download link for the original");
    await downloadTo(signed.signedUrl, input, config.maxUploadBytes);

    const info = await probeMedia(input);
    assertProcessable(info, config.maxDurationSeconds);
    await db.from("media_files").update({ duration_seconds: info.durationSeconds }).eq("id", media.id);

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

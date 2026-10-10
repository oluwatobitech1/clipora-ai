import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AUDIO_OUTPUT_FORMATS, RETRYABLE_ERROR_CODES, type JobDto, type TranscriptDto, type TranscriptSegment } from "@framevox/shared";
import { requireUser } from "../auth.ts";
import { db } from "../clients.ts";
import { toJobDto, type ExportRow, type JobRow } from "../dto.ts";
import { ApiError } from "../errors.ts";
import { createJob } from "../jobs.ts";

const transcribeBody = z.object({
  mediaFileId: z.string().uuid(),
  language: z.string().regex(/^[a-z]{2,3}$/).optional(),
  idempotencyKey: z.string().min(8).max(100),
});
const idParams = z.object({ id: z.string().uuid() });
const createBody = z.object({
  mediaFileId: z.string().uuid(),
  format: z.enum(AUDIO_OUTPUT_FORMATS),
  idempotencyKey: z.string().min(8).max(100),
});

async function loadOwnedJob(userId: string, id: string): Promise<JobRow> {
  const { data: found } = await db.from("processing_jobs").select("*").eq("id", id).eq("owner_id", userId).maybeSingle();
  const data = found as JobRow | null;
  // Same answer for "missing" and "someone else's", so IDs cannot be probed.
  if (!data) throw new ApiError(404, "not_found", "Job not found.");
  return data;
}

async function loadExport(userId: string, jobId: string) {
  const { data } = await db
    .from("exports").select("bucket, storage_key, download_name, size_bytes, expires_at")
    .eq("job_id", jobId).eq("owner_id", userId).maybeSingle();
  return data as (ExportRow & { bucket: string; storage_key: string }) | null;
}

export async function jobRoutes(app: FastifyInstance) {
  app.post("/api/jobs/audio-extract", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const userId = await requireUser(request);
    const input = createBody.parse(request.body);
    const job: JobDto = await createJob(userId, input.mediaFileId, "audio_extract", { format: input.format }, input.idempotencyKey);
    return reply.code(202).send(job);
  });

  app.post("/api/jobs/transcribe", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const userId = await requireUser(request);
    const input = transcribeBody.parse(request.body);
    const params: Record<string, string> = input.language ? { language: input.language } : {};
    const job: JobDto = await createJob(userId, input.mediaFileId, "transcribe", params, input.idempotencyKey);
    return reply.code(202).send(job);
  });

  // The real transcript text and timestamps. Ownership is checked in the query itself.
  app.get("/api/jobs/:id/transcript", async (request): Promise<TranscriptDto> => {
    const userId = await requireUser(request);
    const { id } = idParams.parse(request.params);
    const job = await loadOwnedJob(userId, id);
    if (job.task_type !== "transcribe") throw new ApiError(404, "not_found", "Transcript not found.");
    if (job.status === "expired") throw new ApiError(410, "not_found", "This transcript has expired and was deleted. Transcribe the file again.");
    if (job.status !== "completed") throw new ApiError(409, "not_found", "The transcript is not ready yet.");
    const { data } = await db
      .from("transcripts")
      .select("job_id, title, full_text, segments, language, duration_seconds, expires_at")
      .eq("job_id", id).eq("owner_id", userId).maybeSingle();
    const t = data as { job_id: string; title: string; full_text: string; segments: TranscriptSegment[]; language: string | null; duration_seconds: number | null; expires_at: string } | null;
    if (!t || new Date(t.expires_at) < new Date()) throw new ApiError(410, "not_found", "This transcript has expired and was deleted. Transcribe the file again.");
    return {
      jobId: t.job_id, text: t.full_text, segments: t.segments, language: t.language,
      durationSeconds: t.duration_seconds === null ? null : Number(t.duration_seconds), title: t.title, expiresAt: t.expires_at,
    };
  });

  app.get("/api/jobs/:id", async (request) => {
    const userId = await requireUser(request);
    const { id } = idParams.parse(request.params);
    const job = await loadOwnedJob(userId, id);
    const exp = job.status === "completed" ? await loadExport(userId, id) : null;
    return toJobDto(job, exp);
  });

  // Short-lived signed link (60 s). Ownership is checked before it is created.
  app.get("/api/jobs/:id/download", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request) => {
    const userId = await requireUser(request);
    const { id } = idParams.parse(request.params);
    const job = await loadOwnedJob(userId, id);
    if (job.status === "expired") throw new ApiError(410, "not_found", "This result has expired and was deleted. Process the file again.");
    if (job.status !== "completed") throw new ApiError(409, "not_found", "The result is not ready yet.");
    const exp = await loadExport(userId, id);
    if (!exp || new Date(exp.expires_at) < new Date()) throw new ApiError(410, "not_found", "This result has expired and was deleted. Process the file again.");

    const { data, error } = await db.storage.from(exp.bucket).createSignedUrl(exp.storage_key, 60, { download: exp.download_name });
    if (error || !data) throw new Error(`could not create download link: ${error?.message}`);
    return { url: data.signedUrl, fileName: exp.download_name };
  });

  // Retry a failed job. Only for errors that can succeed on a second try; revalidates everything.
  app.post("/api/jobs/:id/retry", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const userId = await requireUser(request);
    const { id } = idParams.parse(request.params);
    const job = await loadOwnedJob(userId, id);
    if (job.status !== "failed" || !job.error_code || !RETRYABLE_ERROR_CODES.includes(job.error_code) || !job.media_file_id) {
      throw new ApiError(409, "not_retryable", "This job cannot be retried. Upload the file again.");
    }
    // Deterministic key: pressing Retry twice gives the same new job, not two.
    const params: Record<string, string> =
      job.task_type === "transcribe"
        ? (job.params.language ? { language: job.params.language } : {})
        : { format: AUDIO_OUTPUT_FORMATS.find((f) => f === job.params.format) ?? "mp3" };
    const retried = await createJob(userId, job.media_file_id, job.task_type, params, `retry:${job.id}`);
    return reply.code(202).send(retried);
  });
}

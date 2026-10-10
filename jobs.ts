import { MEDIA_BUCKET, type AudioOutputFormat, type JobDto } from "@clipora/shared";
import { db } from "./clients.ts";
import { config } from "./config.ts";
import { toJobDto, type JobRow } from "./dto.ts";
import { ApiError } from "./errors.ts";


/** Creates (or returns the existing) audio extraction job for a file the user owns. Safe to call twice. */
export async function createAudioJob(userId: string, mediaFileId: string, format: AudioOutputFormat, idempotencyKey: string): Promise<JobDto> {
  // Same key from the same user = same job. A double click cannot create a second paid job.
  const existing = await findByKey(userId, idempotencyKey);
  if (existing) return existing;

  const { data: mediaData } = await db
    .from("media_files")
    .select("id, project_id, bucket, storage_key, size_bytes, expires_at")
    .eq("id", mediaFileId)
    .eq("owner_id", userId) // ownership check: never trust the ID alone
    .maybeSingle();
  const media = mediaData as { id: string; project_id: string; bucket: string; storage_key: string; size_bytes: number; expires_at: string } | null;
  if (!media) throw new ApiError(404, "not_found", "File not found.");
  if (new Date(media.expires_at) < new Date()) throw new ApiError(409, "file_not_found", "This upload has expired. Please upload the file again.");

  // Confirm the upload really arrived and is within the limit (the bucket also enforces it).
  const slash = media.storage_key.lastIndexOf("/");
  const dir = media.storage_key.slice(0, slash);
  const name = media.storage_key.slice(slash + 1);
  const { data: files } = await db.storage.from(MEDIA_BUCKET).list(dir, { limit: 5, search: name });
  const stored = files?.find((f) => f.name === name);
  if (!stored) throw new ApiError(400, "file_not_found", "The upload did not finish. Please upload the file again.");
  const storedSize = Number((stored.metadata as { size?: number } | null)?.size ?? 0);
  if (storedSize > config.maxUploadMb * 1024 * 1024) {
    await db.storage.from(MEDIA_BUCKET).remove([media.storage_key]);
    throw new ApiError(413, "file_too_large", `This file is larger than the ${config.maxUploadMb} MB limit.`);
  }

  // Quotas
  const { count: active } = await db.from("processing_jobs").select("id", { count: "exact", head: true })
    .eq("owner_id", userId).in("status", ["queued", "processing"]);
  if ((active ?? 0) >= config.maxActiveJobsPerUser) {
    throw new ApiError(429, "quota_exceeded", "You already have files processing. Wait for them to finish, then try again.");
  }
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count: today } = await db.from("processing_jobs").select("id", { count: "exact", head: true })
    .eq("owner_id", userId).gte("created_at", since);
  if ((today ?? 0) >= config.maxJobsPerDay) {
    throw new ApiError(429, "quota_exceeded", "You have reached the daily processing limit. Try again tomorrow.");
  }

  const { data: rowData, error } = await db
    .from("processing_jobs")
    .insert({
      project_id: media.project_id, owner_id: userId, media_file_id: media.id,
      task_type: "audio_extract", status: "queued", params: { format }, idempotency_key: idempotencyKey,
    })
    .select("*")
    .single();
  const row = rowData as JobRow | null;

  if (error?.code === "23505") {
    // Lost a race with an identical request: return the winner.
    const winner = await findByKey(userId, idempotencyKey);
    if (winner) return winner;
  }
  if (error || !row) throw new Error(`could not create job: ${error?.message}`);

  // The worker picks up queued rows by itself. Nothing else to send.
  return toJobDto(row);
}

async function findByKey(userId: string, key: string): Promise<JobDto | null> {
  const { data } = await db.from("processing_jobs").select("*").eq("owner_id", userId).eq("idempotency_key", key).maybeSingle();
  return data ? toJobDto(data as JobRow) : null;
}

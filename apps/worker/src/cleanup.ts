import { db } from "./db.ts";
import { log } from "./log.ts";

interface Expired {
  id: string;
  bucket: string;
  storage_key: string;
  job_id?: string;
}

/** Deletes expired originals and exports (files first, then rows) and marks their jobs "expired". */
export async function cleanupExpired(): Promise<void> {
  const now = new Date().toISOString();

  const { data: mediaData } = await db.from("media_files").select("id, bucket, storage_key").lt("expires_at", now).limit(100);
  const media = (mediaData ?? []) as Expired[];
  if (media.length) await removeAll("media_files", media);

  // Transcripts have no files in storage, only rows.
  const { data: tData } = await db.from("transcripts").select("id, job_id").lt("expires_at", now).limit(100);
  const ts = (tData ?? []) as { id: string; job_id: string }[];
  if (ts.length) {
    const { error } = await db.from("transcripts").delete().in("id", ts.map((t) => t.id));
    if (error) log.error("cleanup: could not delete transcripts", { reason: error.message });
    else {
      await db.from("processing_jobs").update({ status: "expired" }).in("id", ts.map((t) => t.job_id)).eq("status", "completed");
      log.info("cleanup: removed expired transcripts", { count: ts.length });
    }
  }

  const { data: exportData } = await db.from("exports").select("id, bucket, storage_key, job_id").lt("expires_at", now).limit(100);
  const exports = (exportData ?? []) as Expired[];
  if (exports.length) {
    await removeAll("exports", exports);
    const jobIds = exports.map((e) => e.job_id).filter((id): id is string => !!id);
    await db.from("processing_jobs").update({ status: "expired" }).in("id", jobIds).eq("status", "completed");
  }
}

async function removeAll(table: "media_files" | "exports", rows: Expired[]): Promise<void> {
  const byBucket = new Map<string, string[]>();
  for (const r of rows) byBucket.set(r.bucket, [...(byBucket.get(r.bucket) ?? []), r.storage_key]);

  for (const [bucket, keys] of byBucket) {
    const { error } = await db.storage.from(bucket).remove(keys);
    if (error) {
      // Keep the rows so the next run retries; never orphan files by deleting the record first.
      log.error("cleanup: could not remove files", { table, count: keys.length, reason: error.message });
      return;
    }
  }
  const { error } = await db.from(table).delete().in("id", rows.map((r) => r.id));
  if (error) log.error("cleanup: could not delete rows", { table, reason: error.message });
  else log.info("cleanup: removed expired items", { table, count: rows.length });
}

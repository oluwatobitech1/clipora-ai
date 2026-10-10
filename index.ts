import { JOB_ATTEMPTS } from "@clipora/shared";
import { cleanupExpired } from "./cleanup.ts";
import { config } from "./config.ts";
import { db, type JobRow } from "./db.ts";
import { log } from "./log.ts";
import { processJob } from "./processor.ts";

/** Jobs stuck in "processing" longer than this had a worker that crashed. */
const STALE_MS = config.ffmpegTimeoutMs + 5 * 60_000;

async function recoverStaleJobs(): Promise<void> {
  const before = new Date(Date.now() - STALE_MS).toISOString();
  await db.from("processing_jobs").update({ status: "queued" })
    .eq("status", "processing").lt("started_at", before).lt("attempts", JOB_ATTEMPTS);
  await db.from("processing_jobs").update({
    status: "failed", error_code: "internal_error", error_message: "Processing was interrupted. Please try again.",
    completed_at: new Date().toISOString(),
  }).eq("status", "processing").lt("started_at", before).gte("attempts", JOB_ATTEMPTS);
}

/**
 * Takes the oldest queued job. The update only succeeds while the status is still "queued",
 * so two workers can never take the same job.
 */
async function claimNext(): Promise<JobRow | null> {
  const { data: candidates } = await db.from("processing_jobs").select("*").eq("status", "queued").order("created_at", { ascending: true }).limit(1);
  const candidate = candidates?.[0] as JobRow | undefined;
  if (!candidate) return null;

  const { data: claimed } = await db
    .from("processing_jobs")
    .update({ status: "processing", started_at: new Date().toISOString(), progress_value: 0, attempts: candidate.attempts + 1, error_code: null, error_message: null })
    .eq("id", candidate.id)
    .eq("status", "queued")
    .select("*");
  return (claimed?.[0] as JobRow | undefined) ?? null;
}

let running = 0;
let stopping = false;
let ticking = false;

async function tick(): Promise<void> {
  if (ticking || stopping) return;
  ticking = true;
  try {
    await recoverStaleJobs();
    while (running < config.concurrency && !stopping) {
      const job = await claimNext();
      if (!job) break;
      running++;
      processJob(job)
        .catch((err) => log.error("job crashed", { jobId: job.id, reason: err instanceof Error ? err.message : String(err) }))
        .finally(() => { running--; });
    }
  } catch (err) {
    log.error("poll failed", { reason: err instanceof Error ? err.message : String(err) });
  } finally {
    ticking = false;
  }
}

log.info("worker ready", { concurrency: config.concurrency, pollMs: config.pollIntervalMs });
const pollTimer = setInterval(() => void tick(), config.pollIntervalMs);
void tick();

const runCleanup = () => cleanupExpired().catch((err) => log.error("cleanup crashed", { reason: String(err) }));
void runCleanup();
const cleanupTimer = setInterval(runCleanup, 15 * 60 * 1000);

async function shutdown(signal: string): Promise<void> {
  log.info("shutting down", { signal });
  stopping = true;
  clearInterval(pollTimer);
  clearInterval(cleanupTimer);
  const deadline = Date.now() + 60_000;
  while (running > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 500)); // let running jobs finish
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

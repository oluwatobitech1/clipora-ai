function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  return value;
}

function number(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive number`);
  return n;
}

const maxUploadMb = number("MAX_UPLOAD_MB", 50);

export const config = {
  supabaseUrl: required("SUPABASE_URL"),
  serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  maxUploadBytes: maxUploadMb * 1024 * 1024,
  maxExportBytes: number("MAX_EXPORT_MB", maxUploadMb) * 1024 * 1024,
  maxDurationSeconds: number("MAX_MEDIA_DURATION_MINUTES", 60) * 60,
  ffmpegTimeoutMs: number("FFMPEG_TIMEOUT_SECONDS", 600) * 1000,
  ffmpegThreads: number("FFMPEG_THREADS", 2),
  concurrency: number("WORKER_CONCURRENCY", 1),
  pollIntervalMs: number("POLL_INTERVAL_MS", 2000),
  retentionHours: number("RETENTION_HOURS", 24),
};

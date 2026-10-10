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

export const config = {
  port: number("API_PORT", 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  supabaseUrl: required("SUPABASE_URL"),
  serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  maxUploadMb: number("MAX_UPLOAD_MB", 50),
  retentionHours: number("RETENTION_HOURS", 24),
  maxActiveJobsPerUser: number("MAX_ACTIVE_JOBS_PER_USER", 2),
  maxJobsPerDay: number("MAX_JOBS_PER_DAY", 20),
  maxUploadsPerDay: number("MAX_UPLOADS_PER_DAY", 40),
};

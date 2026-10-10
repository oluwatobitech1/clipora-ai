# Architecture (plan from the brief)

## Flow

```
Browser (apps/web)
  1. asks API to authorize an upload  -> API checks user, quota, type, size
  2. uploads to private object storage (signed URL)
  3. asks API to create a job         -> API writes a processing_jobs row with status "queued"
Worker (apps/worker)
  4. polls the database every 2 s, claims the oldest queued job (only succeeds while still "queued")
  5. downloads the original to a temp dir, inspects it with ffprobe
  6. runs FFmpeg (argument array, never a shell string); validates the output
  7. uploads the result to private storage, updates the job to completed or failed
Browser
  8. polls GET /api/jobs/:id for real status, downloads via a short-lived signed URL
```

Long media work never runs inside a web request. Only the worker runs FFmpeg.

## Services

| Service | Used for |
|---|---|
| Supabase (Postgres, Auth, Storage) | Users, projects, jobs, private files, RLS |
| FFmpeg | Audio extraction |
| OpenAI or another provider | Transcription (Milestone 3), summaries and translation (Milestone 5) |
| Paystack or Flutterwave | Billing (Milestone 6) |

A separate queue (Redis) was removed on purpose: the jobs table already holds every job's real status, so polling it is simpler and has one less thing to install and pay for. Add a queue later only if load requires it.

## Decisions and defaults

- Vite + React SPA with a separate Node API, because the worker must be separate anyway and this avoids tying long jobs to a serverless host.
- Fastify + Zod for the API. Database polling instead of a queue.
- npm workspaces; shared types and validation live in `packages/shared`.
- Provider limits (file size, models, timestamp support) are checked against current documentation when Milestone 3 starts, not hardcoded from memory.
- Supabase Auth is pulled forward from Milestone 4 into Milestone 2, so every uploaded file has an owner from the start and RLS is never retrofitted.

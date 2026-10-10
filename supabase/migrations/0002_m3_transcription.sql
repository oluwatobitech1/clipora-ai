-- Clipora AI, Milestone 3: speech transcription + M4A output.
-- Run in the Supabase SQL Editor AFTER 0001_m2_core.sql.

-- Allow the new job type.
alter table public.processing_jobs drop constraint if exists processing_jobs_task_type_check;
alter table public.processing_jobs
  add constraint processing_jobs_task_type_check check (task_type in ('audio_extract', 'transcribe'));

-- Allow M4A audio exports.
alter table public.exports drop constraint if exists exports_format_check;
alter table public.exports
  add constraint exports_format_check check (format in ('mp3', 'wav', 'm4a'));

-- Transcripts: real text returned by the speech provider. One per job.
create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  job_id uuid not null unique references public.processing_jobs (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  full_text text not null,
  segments jsonb not null default '[]'::jsonb,
  language text,
  duration_seconds numeric,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index transcripts_owner_idx on public.transcripts (owner_id);
create index transcripts_expires_idx on public.transcripts (expires_at);

alter table public.transcripts enable row level security;
create policy "transcripts: read own" on public.transcripts
  for select to authenticated using (owner_id = (select auth.uid()));
-- No insert/update/delete policies: only the worker (service role) writes.

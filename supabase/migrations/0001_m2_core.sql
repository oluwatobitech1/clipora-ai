-- Framevox, Milestone 2: core schema.
-- Run in the Supabase dashboard (SQL Editor) or with the Supabase CLI (`supabase db push`).
-- Clients never write to these tables. Only the API (service role key) does,
-- always after checking ownership. RLS is a second layer of defence.

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  status text not null default 'active' check (status in ('active', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_user_created_idx on public.projects (user_id, created_at desc);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------- media_files
-- storage_key is a generated key. The user's filename is stored only as metadata.
create table public.media_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null default 'media',
  storage_key text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  duration_seconds numeric,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index media_files_project_idx on public.media_files (project_id);
create index media_files_expires_idx on public.media_files (expires_at);

-- ---------------------------------------------------------- processing_jobs
create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  media_file_id uuid references public.media_files (id) on delete set null,
  task_type text not null check (task_type in ('audio_extract')),
  status text not null default 'queued'
    check (status in ('uploading', 'queued', 'processing', 'completed', 'failed', 'expired')),
  params jsonb not null default '{}'::jsonb,
  progress_value numeric(4, 3) check (progress_value is null or (progress_value >= 0 and progress_value <= 1)),
  error_code text,
  error_message text,
  attempts integer not null default 0,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (owner_id, idempotency_key)
);
create index jobs_owner_created_idx on public.processing_jobs (owner_id, created_at desc);
create index jobs_status_idx on public.processing_jobs (status);
create index jobs_project_idx on public.processing_jobs (project_id);

-- ----------------------------------------------------------------- exports
create table public.exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  job_id uuid not null references public.processing_jobs (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null default 'media',
  storage_key text not null unique,
  format text not null check (format in ('mp3', 'wav')),
  download_name text not null,
  size_bytes bigint not null check (size_bytes > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index exports_job_idx on public.exports (job_id);
create index exports_expires_idx on public.exports (expires_at);

-- -------------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.media_files enable row level security;
alter table public.processing_jobs enable row level security;
alter table public.exports enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "projects: read own" on public.projects
  for select to authenticated using (user_id = (select auth.uid()));
create policy "media_files: read own" on public.media_files
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "jobs: read own" on public.processing_jobs
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "exports: read own" on public.exports
  for select to authenticated using (owner_id = (select auth.uid()));
-- No insert, update or delete policies on purpose: the API does those after authorization checks.

-- ---------------------------------------------------------------- storage
-- Private bucket. No storage.objects policies, so browsers cannot read or list anything.
-- The API creates short-lived signed URLs for uploads and downloads.
-- 52428800 bytes = 50 MB, the maximum on the Supabase Free plan. Raise it only after upgrading,
-- and keep it equal to MAX_UPLOAD_MB in .env.
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

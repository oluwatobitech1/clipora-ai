import type { AudioOutputFormat, ErrorCode, JobDto, JobStatus, TaskType } from "@clipora/shared";
import { RETRYABLE_ERROR_CODES } from "@clipora/shared";

export interface JobRow {
  id: string;
  project_id: string;
  owner_id: string;
  media_file_id: string | null;
  task_type: TaskType;
  status: JobStatus;
  params: { format?: AudioOutputFormat; language?: string };
  progress_value: number | null;
  error_code: ErrorCode | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ExportRow {
  download_name: string;
  size_bytes: number;
  expires_at: string;
}

export function toJobDto(job: JobRow, exp?: ExportRow | null): JobDto {
  return {
    id: job.id,
    taskType: job.task_type,
    projectId: job.project_id,
    status: job.status,
    progress: job.status === "processing" && job.progress_value !== null ? Number(job.progress_value) : job.status === "completed" ? 1 : null,
    errorCode: job.error_code,
    errorMessage: job.error_message,
    retryable: job.status === "failed" && !!job.error_code && RETRYABLE_ERROR_CODES.includes(job.error_code),
    format: job.params.format ?? null,
    createdAt: job.created_at,
    completedAt: job.completed_at,
    expiresAt: exp?.expires_at ?? null,
    outputName: exp?.download_name ?? null,
    outputSizeBytes: exp?.size_bytes ?? null,
  };
}

/** Shared constants, types and pure helpers used by the web app, API and worker. */

export const APP_NAME = "Framevox";
export const TAGLINE = "Every video has more to give.";

/**
 * Client-side hint only. The API (Milestone 2) enforces the real limit from the
 * MAX_UPLOAD_MB environment variable; never rely on the browser for security.
 */
export const MAX_UPLOAD_MB = 500;

/** Initial formats from the brief. Each is verified against the real FFmpeg pipeline in Milestone 2. */
export const SUPPORTED_VIDEO_EXTENSIONS = [".mp4", ".m4v", ".mov", ".webm", ".mkv", ".avi", ".wmv", ".flv", ".3gp", ".mpg", ".mpeg", ".ogv"] as const;
export const SUPPORTED_AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".flac"] as const;
export const SUPPORTED_EXTENSIONS = [
  ...SUPPORTED_VIDEO_EXTENSIONS,
  ...SUPPORTED_AUDIO_EXTENSIONS,
] as const;

export const ACCEPT_ATTRIBUTE = SUPPORTED_EXTENSIONS.join(",");
export const SUPPORTED_EXTENSIONS_LABEL = SUPPORTED_EXTENSIONS.map((e) =>
  e.slice(1).toUpperCase(),
).join(", ");

export const AUDIO_OUTPUT_FORMATS = ["mp3", "wav", "m4a"] as const;
export type AudioOutputFormat = (typeof AUDIO_OUTPUT_FORMATS)[number];

/** Real lifecycle states from the brief. The UI only shows a state a job is actually in. */
export const JOB_STATUSES = [
  "uploading",
  "queued",
  "processing",
  "completed",
  "failed",
  "expired",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export type ToolAvailability = "available" | "in-development" | "planned";

export interface ToolDefinition {
  id: string;
  name: string;
  summary: string;
  availability: ToolAvailability;
  /** Milestone in which the tool becomes functional. */
  milestone: string;
}

/** Single source of truth for what exists. Change `availability` only when end-to-end behaviour is tested. */
export const TOOLS: readonly ToolDefinition[] = [
  {
    id: "video-to-audio",
    name: "Video to Audio",
    summary: "Extract the sound from a video as MP3, WAV or M4A.",
    availability: "available",
    milestone: "Milestone 2",
  },
  {
    id: "video-to-text",
    name: "Video to Text",
    summary: "Transcribe speech from a video or audio file, with timestamps where available.",
    availability: "available",
    milestone: "Milestone 3",
  },
  {
    id: "subtitles",
    name: "Subtitles",
    summary: "Generate and edit subtitles, then export SRT and VTT.",
    availability: "available",
    milestone: "Milestone 5",
  },
  {
    id: "video-summarizer",
    name: "Video Summarizer",
    summary: "Summaries and key takeaways based on the actual transcript.",
    availability: "available",
    milestone: "Milestone 5",
  },
  {
    id: "translate",
    name: "Translator",
    summary: "Translate a transcript into another language, keeping the original unchanged.",
    availability: "available",
    milestone: "Milestone 5",
  },
  {
    id: "find-moment",
    name: "Find the Moment",
    summary: "Search inside a video. Type a word and jump to every moment it was said.",
    availability: "available",
    milestone: "Milestone 6",
  },
  {
    id: "highlight-clipper",
    name: "Highlight Clipper",
    summary: "Find the key moments in a video and cut them into short clips.",
    availability: "available",
    milestone: "Milestone 6",
  },
  {
    id: "bleep-maker",
    name: "Bleep Maker",
    summary: "Cover names, numbers or any words you choose with a beep or silence.",
    availability: "available",
    milestone: "Milestone 6",
  },
  {
    id: "speaking-coach",
    name: "Speaking Coach",
    summary: "Check your speaking speed, pauses and filler words from a recording.",
    availability: "available",
    milestone: "Milestone 6",
  },
];

export type MediaKind = "video" | "audio";

export interface FileLike {
  name: string;
  size: number;
  type: string;
}

export type ValidationResult =
  | { ok: true; kind: MediaKind }
  | { ok: false; code: "empty" | "too-large" | "unsupported-type"; message: string };

export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

/**
 * Quick, friendly pre-check in the browser. The server repeats this and also inspects
 * the real file signature with FFmpeg, because filenames and MIME types can be faked.
 */
export function validateMediaFile(file: FileLike, maxMb: number = MAX_UPLOAD_MB): ValidationResult {
  const ext = getExtension(file.name);
  const isVideo = (SUPPORTED_VIDEO_EXTENSIONS as readonly string[]).includes(ext);
  const isAudio = (SUPPORTED_AUDIO_EXTENSIONS as readonly string[]).includes(ext);

  if (!isVideo && !isAudio) {
    return {
      ok: false,
      code: "unsupported-type",
      message: `This file type is not supported. Use ${SUPPORTED_EXTENSIONS_LABEL}.`,
    };
  }
  if (file.type && !file.type.startsWith("video/") && !file.type.startsWith("audio/") && file.type !== "application/ogg") {
    return {
      ok: false,
      code: "unsupported-type",
      message: "This file does not look like a video or audio file.",
    };
  }
  if (file.size <= 0) {
    return { ok: false, code: "empty", message: "This file is empty." };
  }
  if (file.size > maxMb * 1024 * 1024) {
    return {
      ok: false,
      code: "too-large",
      message: `This file is larger than the ${maxMb} MB limit.`,
    };
  }
  return { ok: true, kind: isVideo ? "video" : "audio" };
}

/* ---------------------------------------------------------------------------
 * Milestone 2: API contract shared by web, API and worker
 * ------------------------------------------------------------------------- */

/** Files and exports are deleted after this long unless the user deletes them sooner. */
export const DEFAULT_RETENTION_HOURS = 24;

export const MEDIA_BUCKET = "media";

export const ERROR_CODES = [
  "unauthorized",
  "validation_failed",
  "file_not_found",
  "file_too_large",
  "unsupported_media",
  "no_audio_stream",
  "too_long",
  "quota_exceeded",
  "output_too_large",
  "transcription_unavailable",
  "transcription_failed",
  "no_speech",
  "cancelled",
  "processing_failed",
  "not_found",
  "not_retryable",
  "internal_error",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Only failures that may succeed on a second try. A corrupt file will never succeed. */
export const RETRYABLE_ERROR_CODES: readonly ErrorCode[] = ["processing_failed", "transcription_failed", "internal_error"];

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string };
}

export interface AuthorizeUploadRequest {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface AuthorizeUploadResponse {
  projectId: string;
  mediaFileId: string;
  bucket: string;
  path: string;
  /** One-time token for supabase.storage.from(bucket).uploadToSignedUrl(path, token, file). */
  token: string;
}

export interface CreateAudioJobRequest {
  mediaFileId: string;
  format: AudioOutputFormat;
  /** Random value created by the browser per click, so a double submit cannot create two jobs. */
  idempotencyKey: string;
}

export const TASK_TYPES = ["audio_extract", "transcribe"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export interface CreateTranscribeRequest {
  mediaFileId: string;
  /** Optional ISO-639-1 hint such as "en". Empty or missing means auto-detect. */
  language?: string;
  idempotencyKey: string;
}

export interface TranscriptSegment {
  /** Seconds from the start of the recording, as returned by the provider. */
  start: number;
  end: number;
  text: string;
}

export interface TranscriptDto {
  jobId: string;
  text: string;
  segments: TranscriptSegment[];
  language: string | null;
  durationSeconds: number | null;
  /** Source file name without extension, used to name downloads. */
  title: string;
  expiresAt: string;
}

export interface JobDto {
  id: string;
  taskType: TaskType;
  projectId: string;
  status: JobStatus;
  /** 0 to 1, only when really measured. null means "status only". */
  progress: number | null;
  errorCode: ErrorCode | null;
  errorMessage: string | null;
  retryable: boolean;
  format: AudioOutputFormat | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  outputName: string | null;
  outputSizeBytes: number | null;
}

export const TERMINAL_STATUSES: readonly JobStatus[] = ["completed", "failed", "expired"];

export function isTerminalStatus(status: JobStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function audioContentType(format: AudioOutputFormat): string {
  return format === "mp3" ? "audio/mpeg" : format === "m4a" ? "audio/mp4" : "audio/wav";
}

/** Builds a safe download name like "My talk.mp3": no path characters, no control characters. */
export function buildDownloadName(originalName: string, format: AudioOutputFormat): string {
  const dot = originalName.lastIndexOf(".");
  const stem = dot >= 0 ? originalName.slice(0, dot) : originalName;
  const cleaned = stem
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
  return `${cleaned || "audio"}.${format}`;
}

/** How many times the worker tries a job before recording it as failed. */
export const JOB_ATTEMPTS = 3;

/* ---------------------------------------------------------------------------
 * Milestone 3: transcript formatting (pure functions, used by the web app)
 * ------------------------------------------------------------------------- */

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** 3725.5 -> "01:02:05,500" (SRT) or "01:02:05.500" (VTT). */
export function formatTimestamp(totalSeconds: number, separator: "," | "."): string {
  const ms = Math.max(0, Math.round(totalSeconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}${separator}${pad(ms % 1000, 3)}`;
}

function cleanCue(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function formatSrt(segments: readonly TranscriptSegment[]): string {
  return segments
    .filter((s) => cleanCue(s.text))
    .map((s, i) => `${i + 1}\n${formatTimestamp(s.start, ",")} --> ${formatTimestamp(s.end, ",")}\n${cleanCue(s.text)}\n`)
    .join("\n");
}

export function formatVtt(segments: readonly TranscriptSegment[]): string {
  const cues = segments
    .filter((s) => cleanCue(s.text))
    .map((s) => `${formatTimestamp(s.start, ".")} --> ${formatTimestamp(s.end, ".")}\n${cleanCue(s.text)}\n`);
  return `WEBVTT\n\n${cues.join("\n")}`;
}

/** Download name for transcripts: "My talk.srt". Same cleaning rules as audio names. */
export function buildTranscriptName(originalStem: string, ext: "txt" | "srt" | "vtt"): string {
  return buildDownloadName(`${originalStem}.x`, "mp3").replace(/\.mp3$/, `.${ext}`);
}

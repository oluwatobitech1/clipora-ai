/**
 * FFmpeg / ffprobe wrapper. Rules:
 *  - Arguments are always passed as an array, never concatenated into a shell string.
 *  - The input path is a server-generated temp path, never a user-supplied name.
 *  - The real container format is checked after probing; the filename and MIME type are not trusted.
 *  - Only local files may be read (-protocol_whitelist file), so a crafted playlist cannot fetch URLs.
 *  - Output is probed again before the job is allowed to succeed.
 */
import { execFile, spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import type { AudioOutputFormat } from "@clipora/shared";

export type MediaErrorCode =
  | "file_too_large"
  | "file_not_found"
  | "unsupported_media"
  | "no_audio_stream"
  | "too_long"
  | "output_too_large"
  | "processing_failed";

/** An error whose message is safe to show to the user. */
export class MediaError extends Error {
  code: MediaErrorCode;
  constructor(code: MediaErrorCode, message: string) {
    super(message);
    this.name = "MediaError";
    this.code = code;
  }
}

/** Container names ffprobe reports for MP4, MOV, M4A, MP3 and WAV. Anything else (playlists, scripts) is refused. */
const ALLOWED_FORMAT_NAMES = ["mov", "mp4", "m4a", "mp3", "wav"];

export interface MediaInfo {
  formatName: string;
  durationSeconds: number;
  audioStreams: number;
}

function run(cmd: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(Object.assign(err, { stderr }));
      else resolve({ stdout, stderr });
    });
  });
}

export async function probeMedia(path: string, timeoutMs = 30_000): Promise<MediaInfo> {
  let stdout: string;
  try {
    ({ stdout } = await run(
      "ffprobe",
      ["-v", "error", "-protocol_whitelist", "file", "-print_format", "json", "-show_format", "-show_streams", path],
      timeoutMs,
    ));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("ffprobe is not installed on the worker"); // operator problem, not the user's
    }
    throw new MediaError("unsupported_media", "This file could not be read as a video or audio file. It may be corrupt.");
  }

  let data: { format?: { format_name?: string; duration?: string }; streams?: { codec_type?: string; duration?: string }[] };
  try {
    data = JSON.parse(stdout);
  } catch {
    throw new MediaError("unsupported_media", "This file could not be read as a video or audio file.");
  }

  const formatName = data.format?.format_name ?? "";
  if (!formatName.split(",").some((n) => ALLOWED_FORMAT_NAMES.includes(n))) {
    throw new MediaError("unsupported_media", "This file type is not supported. Use MP4, MOV, MP3, WAV or M4A.");
  }

  const audioStreams = (data.streams ?? []).filter((s) => s.codec_type === "audio");
  let duration = Number.parseFloat(data.format?.duration ?? "");
  if (!Number.isFinite(duration) || duration <= 0) {
    duration = Number.parseFloat(audioStreams[0]?.duration ?? "");
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new MediaError("unsupported_media", "The length of this file could not be determined. It may be corrupt.");
  }

  return { formatName, durationSeconds: duration, audioStreams: audioStreams.length };
}

export function assertProcessable(info: MediaInfo, maxDurationSeconds: number): void {
  if (info.audioStreams === 0) {
    throw new MediaError("no_audio_stream", "This file has no sound track, so there is no audio to extract.");
  }
  if (info.durationSeconds > maxDurationSeconds) {
    const mins = Math.floor(maxDurationSeconds / 60);
    throw new MediaError("too_long", `This recording is longer than the ${mins}-minute limit.`);
  }
}

const CODEC_ARGS: Record<AudioOutputFormat, string[]> = {
  mp3: ["-c:a", "libmp3lame", "-q:a", "2"],
  wav: ["-c:a", "pcm_s16le"],
};

export interface ExtractOptions {
  durationSeconds: number;
  timeoutMs: number;
  threads?: number;
  /** Called with a real measured fraction (0..1) taken from FFmpeg's own progress output. */
  onProgress?: (fraction: number) => void;
}

export function extractAudio(
  inputPath: string,
  outputPath: string,
  format: AudioOutputFormat,
  opts: ExtractOptions,
): Promise<void> {
  const args = [
    "-nostdin", "-hide_banner", "-loglevel", "error",
    "-protocol_whitelist", "file",
    "-i", inputPath,
    "-map", "0:a:0", "-vn", "-sn", "-dn",
    ...CODEC_ARGS[format],
    "-threads", String(opts.threads ?? 2),
    "-progress", "pipe:1", "-nostats",
    "-y", outputPath,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let buffer = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.timeoutMs);

    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 4096) stderr += chunk.toString();
    });

    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        // FFmpeg reports out_time_us (and a misnamed out_time_ms) in microseconds.
        const m = /^out_time_(?:us|ms)=(\d+)$/.exec(line);
        if (m && opts.onProgress) {
          const fraction = Number(m[1]) / 1_000_000 / opts.durationSeconds;
          opts.onProgress(Math.max(0, Math.min(1, fraction)));
        }
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      if ((err as NodeJS.ErrnoException).code === "ENOENT") reject(new Error("ffmpeg is not installed on the worker"));
      else reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new MediaError("too_long", "Processing took too long and was stopped."));
      } else if (code !== 0) {
        console.error(JSON.stringify({ level: "error", msg: "ffmpeg failed", code, stderr: stderr.slice(0, 1000) }));
        reject(new MediaError("processing_failed", "The audio could not be extracted from this file."));
      } else {
        resolve();
      }
    });
  });
}

export interface OutputInfo {
  sizeBytes: number;
  durationSeconds: number;
}

/** Confirms the output file really is audio of the right format and length before marking success. */
export async function validateOutput(
  outputPath: string,
  format: AudioOutputFormat,
  inputDurationSeconds: number,
  maxBytes: number,
): Promise<OutputInfo> {
  const { size } = await stat(outputPath).catch(() => ({ size: 0 }));
  if (size <= 0) throw new MediaError("processing_failed", "The audio could not be extracted from this file.");
  if (size > maxBytes) {
    throw new MediaError(
      "output_too_large",
      format === "wav"
        ? "The WAV file would be too large. Choose MP3 instead, or use a shorter recording."
        : "The audio file would be too large. Use a shorter recording.",
    );
  }

  const info = await probeMedia(outputPath).catch(() => {
    throw new MediaError("processing_failed", "The extracted audio did not pass a quality check.");
  });
  const wrongFormat = !info.formatName.split(",").includes(format);
  const tolerance = Math.max(1, inputDurationSeconds * 0.05);
  const wrongLength = Math.abs(info.durationSeconds - inputDurationSeconds) > tolerance;
  if (info.audioStreams !== 1 || wrongFormat || wrongLength) {
    throw new MediaError("processing_failed", "The extracted audio did not pass a quality check.");
  }
  return { sizeBytes: size, durationSeconds: info.durationSeconds };
}

import type { AudioOutputFormat } from "@framevox/shared";

export interface AudioOptions {
  /** "auto" keeps the format's default quality. */
  bitrate: "auto" | "64" | "128" | "192" | "256" | "320";
  /** "auto" keeps the original sample rate. */
  sampleRate: "auto" | "22050" | "44100" | "48000";
  /** 100 = original loudness, 200 = twice as loud, 50 = half. */
  volume: number;
  fadeIn: boolean;
  fadeOut: boolean;
  reverse: boolean;
  /** Seconds. trimEnd 0 = until the end of the video. */
  trimStart: number;
  trimEnd: number;
}

export const DEFAULT_OPTIONS: AudioOptions = {
  bitrate: "auto",
  sampleRate: "auto",
  volume: 100,
  fadeIn: false,
  fadeOut: false,
  reverse: false,
  trimStart: 0,
  trimEnd: 0,
};

export const FADE_SECONDS = 3;
export const MAX_VOLUME = 500;

const BASE_CODEC: Record<AudioOutputFormat, string[]> = {
  mp3: ["-c:a", "libmp3lame", "-q:a", "2"],
  wav: ["-c:a", "pcm_s16le"],
  m4a: ["-c:a", "aac", "-b:a", "192k"],
};

/** Parses "hh:mm:ss.ms" pieces into seconds. */
export function toSeconds(h: number, m: number, s: number, cs: number): number {
  return h * 3600 + m * 60 + s + cs / 100;
}

export function splitSeconds(total: number): { h: number; m: number; s: number; cs: number } {
  const t = Math.max(0, total);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const cs = Math.round((t - Math.floor(t)) * 100) % 100;
  return { h, m, s, cs };
}

/** Returns an error message if the trim range makes no sense, otherwise null. */
export function validateOptions(o: AudioOptions, duration: number | null): string | null {
  if (o.trimEnd > 0 && o.trimEnd <= o.trimStart) return "Trim end must be after trim start.";
  if (duration !== null && o.trimStart >= duration) return "Trim start is past the end of the video.";
  if (o.volume < 0 || o.volume > MAX_VOLUME) return `Volume must be between 0 and ${MAX_VOLUME}%.`;
  return null;
}

/** True when nothing needs re-encoding beyond the plain extraction (so AAC can be copied untouched). */
export function isPlain(o: AudioOptions): boolean {
  return (
    o.bitrate === "auto" && o.sampleRate === "auto" && o.volume === 100 && !o.fadeIn && !o.fadeOut &&
    !o.reverse && o.trimStart === 0 && o.trimEnd === 0
  );
}

const num = (n: number) => String(Math.round(n * 1000) / 1000);

/** Builds the ffmpeg audio filter chain, or null if no filter is needed. */
export function buildFilter(o: AudioOptions, duration: number | null): string | null {
  const parts: string[] = [];
  const start = Math.max(0, o.trimStart);
  const end = o.trimEnd > 0 ? (duration !== null ? Math.min(o.trimEnd, duration) : o.trimEnd) : duration;

  if (start > 0 || o.trimEnd > 0) {
    parts.push(`atrim=start=${num(start)}${o.trimEnd > 0 ? `:end=${num(o.trimEnd)}` : ""}`, "asetpts=PTS-STARTPTS");
  }
  if (o.volume !== 100) parts.push(`volume=${num(o.volume / 100)}`);

  const length = end !== null ? end - start : null;
  const fade = length !== null ? Math.min(FADE_SECONDS, length / 2) : FADE_SECONDS;
  if (o.fadeIn && fade > 0) parts.push(`afade=t=in:st=0:d=${num(fade)}`);
  // The fade-out needs to know where the clip ends, so it is skipped if the length is unknown.
  if (o.fadeOut && length !== null && fade > 0) parts.push(`afade=t=out:st=${num(Math.max(0, length - fade))}:d=${num(fade)}`);

  // Fades are applied first, then the whole clip is reversed (so a fade-out ends up at the start, as expected for "reverse").
  if (o.reverse) parts.push("areverse");
  return parts.length ? parts.join(",") : null;
}

/** Full encoder arguments (codec, quality, sample rate, filters) for the chosen format. */
export function buildEncodeArgs(format: AudioOutputFormat, o: AudioOptions, duration: number | null): string[] {
  let codec = [...BASE_CODEC[format]];
  if (o.bitrate !== "auto" && format === "mp3") codec = ["-c:a", "libmp3lame", "-b:a", `${o.bitrate}k`];
  if (o.bitrate !== "auto" && format === "m4a") codec = ["-c:a", "aac", "-b:a", `${o.bitrate}k`];
  const args = [...codec];
  if (o.sampleRate !== "auto") args.push("-ar", o.sampleRate);
  const filter = buildFilter(o, duration);
  if (filter) args.push("-af", filter);
  return args;
}

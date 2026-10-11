import { ConvertError } from "./errors";
import type { MediaInfo } from "./ffmpegRun";

/* The ffmpeg settings for each video and audio tool. Kept free of browser code so they can be tested with a normal ffmpeg. */

export type VideoFormat = "mp4" | "webm" | "mkv" | "mov" | "avi";
export type AudioFormat = "mp3" | "wav" | "m4a" | "ogg" | "flac";

export const VIDEO_MIME: Record<VideoFormat, string> = { mp4: "video/mp4", webm: "video/webm", mkv: "video/x-matroska", mov: "video/quicktime", avi: "video/x-msvideo" };
export const AUDIO_MIME: Record<AudioFormat, string> = { mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg", flac: "audio/flac" };

/** Scales to a maximum height (keeping the picture's shape) and keeps both sides even, which most video codecs need. */
function scaleFilter(maxHeight: string): string {
  if (maxHeight === "original") return "scale=trunc(iw/2)*2:trunc(ih/2)*2";
  const h = Number(maxHeight);
  return `scale=-2:'min(${h},trunc(ih/2)*2)'`;
}

export function videoPlan(format: VideoFormat, maxHeight: string, input: string, info: MediaInfo): string[][] {
  if (!info.hasVideo) throw new ConvertError("This file has no video in it. Try the Audio Converter instead.");
  const maps = ["-map", "0:v:0", "-map", "0:a:0?", "-sn", "-dn"];
  const vf = ["-vf", scaleFilter(maxHeight)];
  const plans: string[][] = [];
  const h264Ok = info.videoCodec === "h264" && (!info.hasAudio || ["aac", "mp3"].includes(info.audioCodec));

  if ((format === "mp4" || format === "mov" || format === "mkv") && h264Ok && maxHeight === "original") {
    // Already in the right kind of video: just move it into the new container. Seconds instead of minutes.
    const flags = format === "mkv" ? [] : ["-movflags", "+faststart"];
    plans.push(["-i", input, ...maps, "-c", "copy", ...flags]);
  }
  switch (format) {
    case "mp4":
    case "mov":
      plans.push(["-i", input, ...maps, ...vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart"]);
      break;
    case "mkv":
      plans.push(["-i", input, ...maps, ...vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k"]);
      break;
    case "webm":
      plans.push(["-i", input, ...maps, ...vf, "-c:v", "libvpx", "-b:v", "1500k", "-crf", "10", "-deadline", "good", "-cpu-used", "5", "-c:a", "libvorbis", "-b:a", "128k"]);
      break;
    case "avi":
      plans.push(["-i", input, ...maps, ...vf, "-c:v", "mpeg4", "-q:v", "5", "-c:a", "libmp3lame", "-b:a", "192k"]);
      break;
  }
  return plans;
}

export function gifPlan(fps: string, width: string, seconds: string, input: string, info: MediaInfo): string[][] {
  if (!info.hasVideo) throw new ConvertError("This file has no video in it, so there is nothing to turn into a GIF.");
  const limit = seconds === "all" ? [] : ["-t", seconds];
  const filter = `fps=${Number(fps)},scale='min(${Number(width)},iw)':-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`;
  return [["-i", input, ...limit, "-map", "0:v:0", "-an", "-sn", "-dn", "-vf", filter, "-loop", "0"]];
}

export function audioPlan(format: AudioFormat, bitrate: string, input: string, info: MediaInfo): string[][] {
  if (!info.hasAudio) throw new ConvertError("This file has no audio track, or its format could not be read.");
  const base = ["-i", input, "-map", "0:a:0", "-vn", "-sn", "-dn"];
  const kbps = bitrate === "auto" ? null : `${bitrate}k`;
  switch (format) {
    case "mp3":
      return [[...base, "-c:a", "libmp3lame", ...(kbps ? ["-b:a", kbps] : ["-q:a", "2"])]];
    case "m4a":
      return [[...base, "-c:a", "aac", "-b:a", kbps ?? "192k"]];
    case "ogg":
      return [[...base, "-c:a", "libvorbis", ...(kbps ? ["-b:a", kbps] : ["-q:a", "5"])]];
    case "flac":
      return [[...base, "-c:a", "flac"]];
    case "wav":
      return [[...base, "-c:a", "pcm_s16le"]];
  }
}

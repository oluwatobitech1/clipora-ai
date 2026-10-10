/**
 * Link import: fetch a video or audio file from a web link (YouTube, TikTok, Instagram, X, Facebook, Vimeo,
 * SoundCloud and the many other sites yt-dlp supports) so the visitor does not have to download it by hand.
 *
 * Safety rules:
 *  - yt-dlp is started with an argument array, never through a shell, and the URL comes after "--".
 *  - Only public http(s) links. Addresses on this computer or private networks are refused.
 *  - No cookies, no logins, no DRM circumvention: private or protected content simply fails.
 *  - One video per link (no playlists), no live streams, size and duration limits, and a hard time limit.
 */
import { spawn, execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { join } from "node:path";
import { promisify } from "node:util";
import { getExtension, SUPPORTED_EXTENSIONS } from "@framevox/shared";

const execFileAsync = promisify(execFile);

export class LinkError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export const MAX_LINK_LENGTH = 2000;

function isPrivateIPv4(host: string): boolean {
  const p = host.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = p as [number, number, number, number];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

function isPrivateHost(rawHost: string): boolean {
  const host = rawHost.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || (!host.includes(".") && !isIP(host))) return true;
  const kind = isIP(host);
  if (kind === 4) return isPrivateIPv4(host);
  if (kind === 6) {
    if (host === "::1" || host === "::") return true;
    if (/^f[cd]/.test(host) || /^fe[89ab]/.test(host)) return true; // unique-local and link-local
    // IPv4 inside IPv6. Node rewrites ::ffff:127.0.0.1 to ::ffff:7f00:1, so handle both spellings.
    const dotted = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return isPrivateIPv4(dotted[1]!);
    const hex = host.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const hi = parseInt(hex[1]!, 16), lo = parseInt(hex[2]!, 16);
      return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return false;
  }
  return false;
}

/**
 * Share buttons paste text like "Watch this! https://vm.tiktok.com/ZM123/ #fyp". Finds the first web link in such text.
 * A bare "youtube.com/watch?v=..." is accepted when it is the whole input.
 */
export function extractUrl(input: string): string {
  const text = (input ?? "").trim();
  const found = text.match(/https?:\/\/[^\s<>"'`]+/i);
  if (!found) return text;
  // Drop punctuation that usually belongs to the sentence, not the link.
  return found[0].replace(/[)\]}.,;:!?]+$/, "");
}

/** Returns a clean URL string, or throws a LinkError with a message the visitor can act on. */
export function validateLinkUrl(input: string, opts: { allowPrivateHosts?: boolean } = {}): string {
  const text = extractUrl(input);
  if (!text) throw new LinkError("validation_failed", "Paste a link first.");
  if (text.length > MAX_LINK_LENGTH) throw new LinkError("validation_failed", "This link is too long.");
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    throw new LinkError("validation_failed", "This does not look like a web link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new LinkError("validation_failed", "Only http and https links are supported.");
  if (url.username || url.password) throw new LinkError("validation_failed", "Links with a username or password are not supported.");
  if (!opts.allowPrivateHosts && isPrivateHost(url.hostname)) throw new LinkError("validation_failed", "Only public web links are supported.");
  return url.toString();
}

/** Refuses names that point at this computer or a private network (a public-looking name can still resolve to one). */
export async function assertPublicDns(
  url: string,
  lookup: (host: string) => Promise<{ address: string }[]> = (h) => dnsLookup(h, { all: true }),
): Promise<void> {
  const host = new URL(url).hostname;
  if (isIP(host.replace(/^\[|\]$/g, ""))) return; // literal addresses were already checked by validateLinkUrl
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host);
  } catch {
    throw new LinkError("link_network", "Could not find that website. Check the link and your internet connection.");
  }
  if (addrs.some((a) => isPrivateHost(a.address))) throw new LinkError("validation_failed", "Only public web links are supported.");
}

export interface LinkResult {
  path: string;
  /** File name to give the visitor, such as "My video.mp4". */
  name: string;
}

/** Browsers yt-dlp can read a signed-in session from. */
export const COOKIE_BROWSERS = ["chrome", "chromium", "edge", "firefox", "brave", "opera", "vivaldi", "safari"] as const;

/** Reads YTDLP_COOKIES_BROWSER. Returns undefined when unset; throws on a value that is not a known browser. */
export function parseCookiesBrowser(value: string | undefined): string | undefined {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return undefined;
  if (!(COOKIE_BROWSERS as readonly string[]).includes(v)) {
    throw new Error(`YTDLP_COOKIES_BROWSER must be one of: ${COOKIE_BROWSERS.join(", ")}.`);
  }
  return v;
}

export interface FetchOptions {
  ytdlpPath: string;
  maxMb: number;
  maxDurationSeconds: number;
  timeoutMs: number;
  /** Use the signed-in session of this browser on the same computer. The visitor opts in through .env; off by default. */
  cookiesBrowser?: string;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** True when yt-dlp can be started. */
export async function ytdlpAvailable(ytdlpPath: string): Promise<boolean> {
  try {
    await execFileAsync(ytdlpPath, ["--version"], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

/** Turns yt-dlp's last error lines into one plain sentence. */
export function explainYtdlpError(stderr: string): LinkError {
  const t = stderr.toLowerCase();
  if (/unsupported url/.test(t)) return new LinkError("link_unsupported", "This link is not supported, or it does not point to a single video. Try the link to the video itself.");
  if (/(private video|this video is private|members-only|age-restricted)/.test(t))
    return new LinkError("link_restricted", "This video is private or restricted, so it cannot be fetched. Download it yourself and upload the file instead.");
  if (/(confirm you.re not a bot|sign in to confirm|login required|rate-limit reached|requires authentication|use --cookies|cookies are needed|log in|sign in)/.test(t))
    return new LinkError("link_login", "This site wants a login before it shows the video (Instagram and YouTube often do). If you can watch it while signed in, set YTDLP_COOKIES_BROWSER=chrome in the .env file (see START-HERE) and restart. Or download the video yourself and upload the file.");
  if (/(drm|protected)/.test(t)) return new LinkError("link_restricted", "This video is copy-protected and cannot be fetched.");
  if (/(video unavailable|not available|removed|deleted|does not exist|404|no longer available|been terminated|geo|not made this video available in your country)/.test(t))
    return new LinkError("link_unavailable", "This video is not available (removed, region-locked or private).");
  if (/(live event|is live|live stream)/.test(t)) return new LinkError("link_unsupported", "Live streams cannot be fetched. Try again after the broadcast has ended.");
  if (/(file is larger than|max-filesize|larger than max)/.test(t)) return new LinkError("file_too_large", "This video is larger than the size limit.");
  if (/(unable to download|urlopen error|timed out|connection|network|name or service|getaddrinfo|temporary failure)/.test(t))
    return new LinkError("link_network", "Could not reach that site. Check your internet connection and try again.");
  return new LinkError("link_failed", "Could not fetch this link. The site may block downloads, or the link may be wrong. You can download the video yourself and upload the file instead.");
}

/** The exact yt-dlp command line. Exported so tests can check the safety flags. */
export function buildYtdlpArgs(url: string, dir: string, o: Pick<FetchOptions, "maxMb" | "maxDurationSeconds" | "cookiesBrowser">): string[] {
  const args = [
    "--ignore-config", "--no-playlist", "--no-warnings", "--no-exec", "--no-cache-dir", "--no-mtime", "--no-part",
    "--socket-timeout", "20", "--retries", "3", "--fragment-retries", "3",
    "--max-filesize", `${o.maxMb}M`,
    "--match-filters", `!is_live & duration <=? ${Math.floor(o.maxDurationSeconds)}`,
    // Prefer a modest size (720p or less): this is for speech and clips, not for archiving.
    "-f", "bv*[height<=720]+ba/b[height<=720]/bv*+ba/b",
    "--merge-output-format", "mp4", "--remux-video", "mp4>mp4/mov>mp4/m4a>m4a",
    "--restrict-filenames", "-P", dir, "-o", "media.%(ext)s",
    "--print-to-file", "%(title).150B", join(dir, "title.txt"),
    "--newline", "--progress", "--progress-template", "download:FVPROGRESS %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s",
    "--", url,
  ];
  if (o.cookiesBrowser) args.splice(args.indexOf("--"), 0, "--cookies-from-browser", o.cookiesBrowser);
  return args;
}

/** Downloads one media file from `url` into `dir`. Never throws anything but LinkError. */
export async function fetchLink(url: string, dir: string, o: FetchOptions): Promise<LinkResult> {
  const args = buildYtdlpArgs(url, dir, o);

  const stderrLines: string[] = [];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(o.ytdlpPath, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true, cwd: dir });
    let settled = false;
    const finish = (err?: LinkError) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      o.signal?.removeEventListener("abort", onAbort);
      if (err) reject(err); else resolve();
    };
    const onAbort = () => { child.kill("SIGKILL"); finish(new LinkError("cancelled", "Cancelled.")); };
    const timer = setTimeout(() => { child.kill("SIGKILL"); finish(new LinkError("link_timeout", "Fetching took too long and was stopped.")); }, o.timeoutMs);
    o.signal?.addEventListener("abort", onAbort, { once: true });
    if (o.signal?.aborted) return onAbort();

    let buf = "";
    child.stdout.on("data", (c: Buffer) => {
      buf += c.toString("utf8");
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const m = line.match(/^FVPROGRESS (\S+) (\S+) (\S+)/);
        if (!m) continue;
        const done = Number(m[1]);
        const total = Number(m[2]) || Number(m[3]);
        if (done >= 0 && total > 0) o.onProgress?.(Math.min(1, done / total));
      }
    });
    child.stderr.on("data", (c: Buffer) => {
      for (const l of c.toString("utf8").split(/\r?\n/)) if (l.trim()) stderrLines.push(l.trim());
      if (stderrLines.length > 60) stderrLines.splice(0, stderrLines.length - 60);
    });
    child.on("error", (err) => finish((err as NodeJS.ErrnoException).code === "ENOENT"
      ? new LinkError("link_tool_missing", "Link import needs the free tool yt-dlp. Install it (Windows: winget install yt-dlp.yt-dlp), then restart Framevox.")
      : new LinkError("link_failed", "Could not start the link downloader.")));
    child.on("close", (code) => {
      if (code === 0) return finish();
      const text = stderrLines.join("\n");
      if (/does not pass filter|duration/i.test(text) && /filter/i.test(text)) {
        return finish(new LinkError("file_too_long", `This video is longer than the ${Math.round(o.maxDurationSeconds / 60)} minute limit, or it is a live stream.`));
      }
      finish(explainYtdlpError(text));
    });
  });

  const files = (await readdir(dir)).filter((f) => f.startsWith("media.") && !f.endsWith(".part") && !f.endsWith(".ytdl"));
  const media = files.find((f) => (SUPPORTED_EXTENSIONS as readonly string[]).includes(getExtension(f)));
  if (!media) {
    if (files.length) throw new LinkError("link_unsupported", "This link gave a file type Framevox cannot process.");
    // yt-dlp can exit 0 when the filters skip the video.
    throw new LinkError("file_too_long", `This video is longer than the ${Math.round(o.maxDurationSeconds / 60)} minute limit, or it is a live stream.`);
  }
  const path = join(dir, media);
  const size = (await stat(path)).size;
  if (size <= 0) throw new LinkError("link_failed", "The downloaded file was empty.");
  if (size > o.maxMb * 1024 * 1024) throw new LinkError("file_too_large", `This video is larger than the ${o.maxMb} MB limit.`);

  let title = "";
  try { title = (await readFile(join(dir, "title.txt"), "utf8")).split(/\r?\n/)[0]?.trim() ?? ""; } catch { /* no title: use a generic name */ }
  const safe = title.replace(/[\u0000-\u001f\u007f\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "video";
  return { path, name: `${safe}${getExtension(media)}` };
}

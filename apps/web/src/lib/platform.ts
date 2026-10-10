/** Pulls the first web link out of pasted text (share buttons add words and hashtags around the link). */
export function extractUrl(input: string): string {
  const text = (input ?? "").trim();
  const found = text.match(/https?:\/\/[^\s<>"'`]+/i);
  return found ? found[0].replace(/[)\]}.,;:!?]+$/, "") : text;
}

const PLATFORMS: { name: string; hosts: string[] }[] = [
  { name: "YouTube", hosts: ["youtube.com", "youtu.be", "youtube-nocookie.com"] },
  { name: "TikTok", hosts: ["tiktok.com"] },
  { name: "Instagram", hosts: ["instagram.com", "instagr.am"] },
  { name: "X", hosts: ["x.com", "twitter.com", "t.co"] },
  { name: "Facebook", hosts: ["facebook.com", "fb.watch", "fb.com"] },
  { name: "Vimeo", hosts: ["vimeo.com"] },
  { name: "SoundCloud", hosts: ["soundcloud.com"] },
  { name: "Reddit", hosts: ["reddit.com", "redd.it"] },
  { name: "Twitch", hosts: ["twitch.tv"] },
  { name: "Dailymotion", hosts: ["dailymotion.com", "dai.ly"] },
  { name: "LinkedIn", hosts: ["linkedin.com"] },
  { name: "Pinterest", hosts: ["pinterest.com", "pin.it"] },
];

/** Parses pasted text into a link, or null when it does not contain a usable web link. */
export function parseLink(input: string): { url: string; platform: string | null } | null {
  const candidate = extractUrl(input);
  if (!candidate || /\s/.test(candidate)) return null;
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(candidate) ? candidate : `https://${candidate}`);
  } catch {
    return null;
  }
  if ((u.protocol !== "http:" && u.protocol !== "https:") || !u.hostname.includes(".")) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const platform = PLATFORMS.find((p) => p.hosts.some((h) => host === h || host.endsWith(`.${h}`)))?.name ?? null;
  return { url: u.toString(), platform };
}

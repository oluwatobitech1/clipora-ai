// Link import: URL safety rules (unit) and a real yt-dlp + FFmpeg run against a local test server (end to end).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { buildLocalApp, configFromEnv, type LocalConfig } from "./server.ts";
import { assertPublicDns, buildYtdlpArgs, explainYtdlpError, extractUrl, LinkError, parseCookiesBrowser, validateLinkUrl, ytdlpAvailable } from "./links.ts";

test("accepts normal public links and adds https when missing", () => {
  assert.equal(validateLinkUrl("https://www.youtube.com/watch?v=abc123"), "https://www.youtube.com/watch?v=abc123");
  assert.equal(validateLinkUrl("  vimeo.com/12345 "), "https://vimeo.com/12345");
  assert.equal(validateLinkUrl("https://www.tiktok.com/@user/video/1"), "https://www.tiktok.com/@user/video/1");
});

test("refuses empty, malformed, non-http, credential and over-long links", () => {
  for (const bad of ["", "   ", "not a url at all", "ftp://example.com/a.mp4", "file:///etc/passwd", "javascript:alert(1)", "https://user:pw@example.com/a", `https://example.com/${"a".repeat(2100)}`]) {
    assert.throws(() => validateLinkUrl(bad), LinkError, bad);
  }
});

test("refuses addresses on this computer and private networks", () => {
  for (const bad of [
    "http://localhost:3001/api/health", "http://127.0.0.1/a", "http://0.0.0.0/a", "http://10.0.0.5/a", "http://192.168.1.1/a",
    "http://172.16.0.1/a", "http://169.254.169.254/latest/meta-data", "http://[::1]/a", "http://[fd00::1]/a", "http://[::ffff:127.0.0.1]/a", "http://[::ffff:10.1.2.3]/a", "http://[::ffff:c0a8:1]/a",
    "http://printer.local/a", "http://intranet/a", "http://2130706433/a",
  ]) {
    assert.throws(() => validateLinkUrl(bad), LinkError, bad);
  }
  assert.equal(validateLinkUrl("http://127.0.0.1:9/a", { allowPrivateHosts: true }), "http://127.0.0.1:9/a");
});

test("refuses public-looking names that resolve to private addresses", async () => {
  await assert.rejects(assertPublicDns("https://sneaky.example.com/a", async () => [{ address: "127.0.0.1" }]), LinkError);
  await assert.rejects(assertPublicDns("https://sneaky.example.com/a", async () => [{ address: "93.184.216.34" }, { address: "10.0.0.8" }]), LinkError);
  await assert.rejects(assertPublicDns("https://nowhere.example.com/a", async () => { throw new Error("ENOTFOUND"); }), LinkError);
  await assertPublicDns("https://fine.example.com/a", async () => [{ address: "93.184.216.34" }]);
});

test("finds the link inside pasted share text", () => {
  assert.equal(extractUrl("Watch this! https://vm.tiktok.com/ZMabc123/ #fyp"), "https://vm.tiktok.com/ZMabc123/");
  assert.equal(extractUrl("(see https://youtu.be/dQw4w9WgXcQ?si=xyz)."), "https://youtu.be/dQw4w9WgXcQ?si=xyz");
  assert.equal(extractUrl("https://www.instagram.com/reel/C1a2b3c/?igsh=abc, so good"), "https://www.instagram.com/reel/C1a2b3c/?igsh=abc");
  assert.equal(extractUrl("  youtube.com/watch?v=abc  "), "youtube.com/watch?v=abc");
  assert.equal(validateLinkUrl("Check this out https://www.tiktok.com/@user/video/7300000000000000000 lol"), "https://www.tiktok.com/@user/video/7300000000000000000");
  // A link hidden in share text cannot smuggle in a private address.
  assert.throws(() => validateLinkUrl("lol http://127.0.0.1:3001/api/health"), LinkError);
});

test("the yt-dlp command line keeps its safety flags and puts the link last, after --", () => {
  const args = buildYtdlpArgs("https://example.com/v?x=--exec", "/tmp/d", { maxMb: 500, maxDurationSeconds: 14400 });
  for (const f of ["--ignore-config", "--no-playlist", "--no-exec", "--max-filesize"]) assert.ok(args.includes(f), f);
  assert.equal(args.at(-1), "https://example.com/v?x=--exec");
  assert.equal(args.at(-2), "--");
  assert.ok(!args.includes("--cookies-from-browser"));
  const withCookies = buildYtdlpArgs("https://example.com/v", "/tmp/d", { maxMb: 500, maxDurationSeconds: 14400, cookiesBrowser: "chrome" });
  const at = withCookies.indexOf("--cookies-from-browser");
  assert.ok(at > 0 && withCookies[at + 1] === "chrome" && at < withCookies.indexOf("--"));
});

test("YTDLP_COOKIES_BROWSER accepts only known browsers", () => {
  assert.equal(parseCookiesBrowser(undefined), undefined);
  assert.equal(parseCookiesBrowser("  Chrome "), "chrome");
  assert.throws(() => parseCookiesBrowser("chrome:/etc/shadow"));
  assert.throws(() => parseCookiesBrowser("--exec"));
});

test("explains common yt-dlp failures in plain words", () => {
  assert.equal(explainYtdlpError("ERROR: [generic] Unsupported URL: https://x.test").code, "link_unsupported");
  assert.equal(explainYtdlpError("ERROR: Private video. Sign in if you've been granted access").code, "link_restricted");
  assert.equal(explainYtdlpError("ERROR: Video unavailable").code, "link_unavailable");
  assert.equal(explainYtdlpError("ERROR: [youtube] abc: Sign in to confirm you're not a bot").code, "link_login");
  assert.equal(explainYtdlpError("ERROR: [Instagram] C1: Instagram sent an empty media response. Login required").code, "link_login");
  assert.equal(explainYtdlpError("ERROR: [youtube] abc: Unable to download API page: Unable to connect to proxy").code, "link_network");
  assert.equal(explainYtdlpError("ERROR: unable to download video data: <urlopen error timed out>").code, "link_network");
  assert.equal(explainYtdlpError("something odd").code, "link_failed");
});

// ---- End to end (skipped when yt-dlp is not installed) ----
let dir: string;
let media: Server;
let mediaUrl: string;
let close: () => Promise<void>;
let base: string;
const have = await ytdlpAvailable("yt-dlp"); // decided at load time: `skip` below is read before any hook runs

async function start(over: Partial<LocalConfig>) {
  const { app } = await buildLocalApp({ ...configFromEnv({}), maxUploadMb: 5, allowPrivateLinkHosts: true, linkTimeoutMs: 60_000, ...over });
  await app.listen({ port: 0, host: "127.0.0.1" });
  return { url: `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`, close: () => app.close() };
}

const post = (url: string, body: unknown) =>
  fetch(`${url}/api/local/links`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function settle(url: string, id: string) {
  for (let i = 0; i < 300; i++) {
    const j = await (await fetch(`${url}/api/local/links/${id}`)).json();
    if (j.status !== "downloading") return j;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("link download did not finish");
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "framevox-link-"));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=duration=3:size=160x120:rate=10", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-c:v", "libx264", "-c:a", "aac", "-shortest", join(dir, "clip.mp4")]);
  const bytes = readFileSync(join(dir, "clip.mp4"));
  media = createServer((req, res) => {
    if (req.url === "/clip.mp4") { res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": bytes.length }); res.end(bytes); }
    else { res.writeHead(404); res.end("nope"); }
  });
  await new Promise<void>((r) => media.listen(0, "127.0.0.1", r));
  mediaUrl = `http://127.0.0.1:${(media.address() as AddressInfo).port}`;
  const a = await start({});
  base = a.url; close = a.close;
});
after(async () => { await close(); media.close(); rmSync(dir, { recursive: true, force: true }); });

test("mode reports whether link import is available", async () => {
  const m = await (await fetch(`${base}/api/mode`)).json();
  assert.equal(m.links, have);
});

test("requires the permission confirmation", async () => {
  const res = await post(base, { url: `${mediaUrl}/clip.mp4`, confirmed: false });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, "consent_required");
});

test("refuses private addresses when the test override is off", async () => {
  const strict = await start({ allowPrivateLinkHosts: false });
  try {
    const res = await post(strict.url, { url: "http://169.254.169.254/latest/meta-data", confirmed: true });
    assert.equal(res.status, 400);
  } finally { await strict.close(); }
});

test("fetches a real video from a link, serves it, and cleans up", { skip: !have && "yt-dlp is not installed" }, async () => {
  const res = await post(base, { url: `${mediaUrl}/clip.mp4`, confirmed: true });
  assert.equal(res.status, 202);
  const { id } = await res.json();
  const done = await settle(base, id);
  assert.equal(done.status, "ready", JSON.stringify(done));
  assert.match(done.fileName, /\.mp4$/);
  assert.ok(done.sizeBytes > 1000);
  const file = await fetch(`${base}/api/local/links/${id}/file`);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get("content-type"), "video/mp4");
  const got = Buffer.from(await file.arrayBuffer());
  assert.equal(got.length, done.sizeBytes);
  assert.equal(got.subarray(4, 8).toString(), "ftyp"); // a real MP4
  assert.equal((await fetch(`${base}/api/local/links/${id}`, { method: "DELETE" })).status, 204);
  assert.equal((await fetch(`${base}/api/local/links/${id}`)).status, 404);
});

test("reports a clear failure for a link that is not a video", { skip: !have && "yt-dlp is not installed" }, async () => {
  const { id } = await (await post(base, { url: `${mediaUrl}/missing.mp4`, confirmed: true })).json();
  const done = await settle(base, id);
  assert.equal(done.status, "failed");
  assert.ok(done.message && done.errorCode);
  await fetch(`${base}/api/local/links/${id}`, { method: "DELETE" });
});

test("a video over the size limit is refused", { skip: !have && "yt-dlp is not installed" }, async () => {
  const tiny = await start({ maxUploadMb: 0.0001 as unknown as number });
  try {
    const { id } = await (await post(tiny.url, { url: `${mediaUrl}/clip.mp4`, confirmed: true })).json();
    const done = await settle(tiny.url, id);
    assert.equal(done.status, "failed");
  } finally { await tiny.close(); }
});

test("a missing yt-dlp gives install instructions", async () => {
  const none = await start({ ytdlpPath: "definitely-not-installed-xyz" });
  try {
    assert.equal((await (await fetch(`${none.url}/api/mode`)).json()).links, false);
    const res = await post(none.url, { url: `${mediaUrl}/clip.mp4`, confirmed: true });
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error.code, "link_tool_missing");
  } finally { await none.close(); }
});

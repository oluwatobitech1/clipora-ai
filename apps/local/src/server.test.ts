// End-to-end test of local mode: real HTTP upload, real FFmpeg, real download. The speech provider is a stub.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { buildLocalApp, configFromEnv, type LocalConfig } from "./server.ts";

let dir: string;
let base: string;
let stop: () => Promise<void>;
let root: string;
let stopNoKey: () => Promise<void>;
let baseNoKey: string;

const stubProvider = { transcribe: async () => ({ text: "Hello from the stub.", language: "english", segments: [{ start: 0, end: 1, text: "Hello from the stub." }] }) };

async function start(over: Partial<LocalConfig>) {
  const { app, root } = await buildLocalApp({ ...configFromEnv({}), maxUploadMb: 1, ...over });
  await app.listen({ port: 0, host: "127.0.0.1" });
  return { url: `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`, close: () => app.close(), root };
}

async function submit(url: string, fileName: string, bytes: Buffer, fields: Record<string, string>, type = "video/mp4") {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("file", new Blob([new Uint8Array(bytes)], { type }), fileName);
  return fetch(`${url}/api/local/jobs`, { method: "POST", body: form });
}

async function finish(url: string, id: string) {
  for (let i = 0; i < 100; i++) {
    const j = await (await fetch(`${url}/api/jobs/${id}`)).json();
    if (j.status === "completed" || j.status === "failed") return j;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("job did not finish");
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "framevox-lt-"));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=duration=3:size=160x120:rate=10", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-c:v", "mpeg4", "-c:a", "aac", "-shortest", join(dir, "a.mp4")]);
  const a = await start({ provider: stubProvider });
  base = a.url; stop = a.close; root = a.root;
  const b = await start({ engine: "openai" }); // cloud engine chosen, but no key
  baseNoKey = b.url; stopNoKey = b.close;
});
after(async () => { await stop(); await stopNoKey(); rmSync(dir, { recursive: true, force: true }); });

test("reports local mode", async () => {
  assert.deepEqual(await (await fetch(`${base}/api/mode`)).json(), { mode: "local", transcription: true, engine: "custom" });
  assert.equal((await (await fetch(`${baseNoKey}/api/mode`)).json()).transcription, false);
  const auto = await start({});
  try { assert.deepEqual(await (await fetch(`${auto.url}/api/mode`)).json(), { mode: "local", transcription: true, engine: "local-whisper" }); } finally { await auto.close(); }
});

test("uploads a video, extracts real MP3, and the download is real audio", async () => {
  const res = await submit(base, "My clip.mp4", readFileSync(join(dir, "a.mp4")), { task: "audio_extract", format: "mp3" });
  assert.equal(res.status, 202);
  const created = await res.json();
  const done = await finish(base, created.id);
  assert.equal(done.status, "completed", JSON.stringify(done));
  assert.equal(done.outputName, "My clip.mp3");
  const { url } = await (await fetch(`${base}/api/jobs/${created.id}/download`)).json();
  const file = await fetch(`${base}${url}`);
  assert.match(file.headers.get("content-type") ?? "", /audio\/mpeg/);
  assert.match(file.headers.get("content-disposition") ?? "", /My%20clip\.mp3/);
  const out = join(dir, "dl.mp3");
  writeFileSync(out, Buffer.from(await file.arrayBuffer()));
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", out]).toString());
  assert.equal(probe.streams.length, 1);
  assert.equal(probe.streams[0].codec_type, "audio");
  assert.ok(Math.abs(Number(probe.format.duration) - 3) < 0.3);
});

test("rejects a text file renamed .mp4 with a clear message", async () => {
  const created = await (await submit(base, "fake.mp4", Buffer.from("not a video"), { task: "audio_extract", format: "mp3" })).json();
  const done = await finish(base, created.id);
  assert.equal(done.status, "failed");
  assert.equal(done.errorCode, "unsupported_media");
  assert.equal(done.retryable, false);
});

test("rejects unsupported extensions and oversized uploads", async () => {
  const bad = await submit(base, "x.exe", Buffer.from("MZ"), { task: "audio_extract" }, "application/octet-stream");
  assert.equal(bad.status, 400);
  const big = await submit(base, "big.mp4", Buffer.alloc(2 * 1024 * 1024, 1), { task: "audio_extract" });
  assert.equal(big.status, 413);
  assert.equal((await big.json()).error.code, "file_too_large");
});

test("transcribes through the provider and returns the real text", async () => {
  const created = await (await submit(base, "talk.mp4", readFileSync(join(dir, "a.mp4")), { task: "transcribe" })).json();
  const done = await finish(base, created.id);
  assert.equal(done.status, "completed", JSON.stringify(done));
  const t = await (await fetch(`${base}/api/jobs/${created.id}/transcript`)).json();
  assert.equal(t.text, "Hello from the stub.");
  assert.equal(t.title, "talk");
  assert.deepEqual(t.segments, [{ start: 0, end: 1, text: "Hello from the stub." }]);
});

test("transcribe without an API key fails with a helpful message", async () => {
  const created = await (await submit(baseNoKey, "talk.mp4", readFileSync(join(dir, "a.mp4")), { task: "transcribe" })).json();
  const done = await finish(baseNoKey, created.id);
  assert.equal(done.status, "failed");
  assert.equal(done.errorCode, "transcription_unavailable");
  assert.match(done.errorMessage, /OPENAI_API_KEY/);
});

test("deleting a job removes its files from disk", async () => {
  const created = await (await submit(base, "d.mp4", readFileSync(join(dir, "a.mp4")), { task: "audio_extract", format: "wav" })).json();
  await finish(base, created.id);
  assert.ok(existsSync(join(root, created.id)));
  assert.equal((await fetch(`${base}/api/projects/${created.id}`, { method: "DELETE" })).status, 204);
  assert.equal(existsSync(join(root, created.id)), false);
  assert.equal((await fetch(`${base}/api/jobs/${created.id}`)).status, 404);
});

test("cancel stops a running job, removes its files, and the job disappears", async () => {
  // a slow provider keeps the transcribe job busy until cancelled
  const slow = await start({ provider: { transcribe: (_f, o) => new Promise((_r, rej) => o.signal?.addEventListener("abort", () => rej(new Error("aborted")))) } });
  try {
    const created = await (await submit(slow.url, "c.mp4", readFileSync(join(dir, "a.mp4")), { task: "transcribe" })).json();
    await new Promise((r) => setTimeout(r, 1200));
    assert.ok(existsSync(join(slow.root, created.id)));
    assert.equal((await fetch(`${slow.url}/api/jobs/${created.id}/cancel`, { method: "POST" })).status, 204);
    assert.equal(existsSync(join(slow.root, created.id)), false);
    assert.equal((await fetch(`${slow.url}/api/jobs/${created.id}`)).status, 404);
  } finally {
    await slow.close();
  }
});

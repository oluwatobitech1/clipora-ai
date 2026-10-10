// Tests the real FFmpeg chunking and the real provider code against a local mock of the OpenAI endpoint.
// No network and no API key are needed. The mock records what it was sent, so we can check the real request.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { extractSpeechChunks, MediaError, probeMedia } from "./ffmpeg.ts";
import { mergeChunks, OpenAIProvider } from "./transcribe.ts";

let dir: string;
let server: Server;
let baseUrl: string;
let mode: "ok" | "unauthorized" | "quota" | "busy" | "bad" = "ok";
const requests: { auth: string | undefined; bodyBytes: number; text: string }[] = [];

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "clipora-tr-"));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=300:duration=7", join(dir, "long.wav")]);
  server = createServer((req, res) => {
    const parts: Buffer[] = [];
    req.on("data", (c: Buffer) => parts.push(c));
    req.on("end", () => {
      const body = Buffer.concat(parts);
      requests.push({ auth: req.headers.authorization, bodyBytes: body.length, text: body.toString("latin1") });
      const send = (status: number, json: unknown) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(json)); };
      if (req.url !== "/v1/audio/transcriptions") return send(404, {});
      if (mode === "unauthorized") return send(401, { error: { message: "bad key" } });
      if (mode === "quota") return send(429, { error: { code: "insufficient_quota" } });
      if (mode === "busy") return send(503, {});
      if (mode === "bad") return send(400, { error: { message: "bad audio" } });
      send(200, { text: " Hello world. ", language: "english", duration: 3, segments: [{ start: 0, end: 1.5, text: " Hello world." }, { start: 1.5, end: 2, text: "  " }] });
    });
  }).listen(0);
  await new Promise((r) => server.once("listening", r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server.close(); rmSync(dir, { recursive: true, force: true }); });

const provider = (apiKey = "test-key") => new OpenAIProvider({ apiKey, baseUrl, model: "whisper-1", timeoutMs: 10_000 });

test("cuts a 7 s file into 3 s mono 16 kHz MP3 chunks that cover the whole length", async () => {
  const out = join(dir, "chunks");
  mkdirSync(out);
  const files = await extractSpeechChunks(join(dir, "long.wav"), out, 3, { durationSeconds: 7, timeoutMs: 30_000 });
  assert.equal(files.length, 3);
  let total = 0;
  for (const p of files) {
    const info = await probeMedia(p);
    assert.ok(info.formatName.includes("mp3"));
    total += info.durationSeconds;
  }
  assert.ok(Math.abs(total - 7) < 0.3, `total ${total}`);
});

test("sends the real request with the key, model, timestamps and file, and parses the real response", async () => {
  mode = "ok";
  const before = requests.length;
  const out = join(dir, "chunks");
  const file = join(out, "chunk-000.mp3");
  const r = await provider().transcribe(file, { language: "en" });
  const req = requests[before]!;
  assert.equal(req.auth, "Bearer test-key");
  assert.ok(req.bodyBytes > 1000, "the audio bytes were uploaded");
  assert.match(req.text, /name="model"\r\n\r\nwhisper-1/);
  assert.match(req.text, /name="response_format"\r\n\r\nverbose_json/);
  assert.match(req.text, /name="language"\r\n\r\nen/);
  assert.equal(r.text, "Hello world.");
  assert.equal(r.language, "english");
  assert.deepEqual(r.segments, [{ start: 0, end: 1.5, text: "Hello world." }]); // blank segment dropped
});

test("mergeChunks shifts timestamps by each chunk's start and joins text in order", () => {
  const m = mergeChunks([
    { offsetSeconds: 0, result: { text: "One.", language: "en", segments: [{ start: 0, end: 2, text: "One." }] } },
    { offsetSeconds: 600, result: { text: "Two.", language: "en", segments: [{ start: 1, end: 3, text: "Two." }] } },
  ]);
  assert.equal(m.text, "One. Two.");
  assert.deepEqual(m.segments[1], { start: 601, end: 603, text: "Two." });
});

test("provider errors: bad key and no credit are permanent, busy is temporary, bad audio is a retryable failure", async () => {
  const file = join(dir, "chunks", "chunk-000.mp3");
  mode = "unauthorized";
  await assert.rejects(provider().transcribe(file, {}), (e: unknown) => e instanceof MediaError && e.code === "transcription_unavailable");
  mode = "quota";
  await assert.rejects(provider().transcribe(file, {}), (e: unknown) => e instanceof MediaError && e.code === "transcription_unavailable");
  mode = "busy";
  await assert.rejects(provider().transcribe(file, {}), (e: unknown) => !(e instanceof MediaError)); // worker re-queues
  mode = "bad";
  await assert.rejects(provider().transcribe(file, {}), (e: unknown) => e instanceof MediaError && e.code === "transcription_failed");
});

test("an unreachable provider is a temporary error, not a fake result", async () => {
  const dead = new OpenAIProvider({ apiKey: "k", baseUrl: "http://127.0.0.1:9", model: "whisper-1", timeoutMs: 2000 });
  await assert.rejects(dead.transcribe(join(dir, "chunks", "chunk-000.mp3"), {}), (e: unknown) => !(e instanceof MediaError));
});

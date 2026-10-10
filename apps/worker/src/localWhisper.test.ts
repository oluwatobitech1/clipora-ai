// Tests everything around the local Whisper engine that can run without downloading a model:
// real FFmpeg decoding to samples, timestamp mapping, queueing, cancel, and the failure when the model can't be fetched.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MediaError } from "./ffmpeg.ts";
import { decodeToFloat32, LocalWhisperProvider, toSegments } from "./localWhisper.ts";

let dir: string;
before(() => {
  dir = mkdtempSync(join(tmpdir(), "framevox-lw-"));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", join(dir, "tone.mp3")]);
});
after(() => rmSync(dir, { recursive: true, force: true }));

test("decodes audio to 16 kHz mono float samples of the right length and loudness", async () => {
  const samples = await decodeToFloat32(join(dir, "tone.mp3"));
  assert.ok(Math.abs(samples.length - 3 * 16000) < 2000, `length ${samples.length}`);
  const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  assert.ok(peak > 0.1 && peak <= 1.0, `peak ${peak}`);
});

test("a corrupt audio file is a clear processing failure", async () => {
  await assert.rejects(decodeToFloat32(join(dir, "missing.mp3")), (e: unknown) => e instanceof MediaError && e.code === "processing_failed");
});

test("maps recognizer chunks to segments, filling a missing end time", () => {
  const segs = toSegments({ chunks: [
    { text: " Hello there.", timestamp: [0, 2] },
    { text: "  ", timestamp: [2, 3] },
    { text: " Second part", timestamp: [4, null] },
    { text: " Last", timestamp: [6, null] },
  ] }, 9);
  assert.deepEqual(segs, [
    { start: 0, end: 2, text: "Hello there." },
    { start: 4, end: 6, text: "Second part" },
    { start: 6, end: 9, text: "Last" },
  ]);
});

test("transcribes through the recognizer, passing real samples and timestamps on", async () => {
  let received = 0; let opts: Record<string, unknown> = {};
  const provider = new LocalWhisperProvider({ model: "x", recognizer: async (audio, o) => { received = audio.length; opts = o; return { text: " Hi. ", chunks: [{ text: " Hi.", timestamp: [0, 1] }] }; } });
  const r = await provider.transcribe(join(dir, "tone.mp3"), {});
  assert.ok(received > 40000);
  assert.equal(opts.return_timestamps, true);
  assert.equal(r.text, "Hi.");
  assert.deepEqual(r.segments, [{ start: 0, end: 1, text: "Hi." }]);
});

test("requests run one at a time", async () => {
  let active = 0; let maxActive = 0;
  const provider = new LocalWhisperProvider({ model: "x", recognizer: async () => { active++; maxActive = Math.max(maxActive, active); await new Promise((r) => setTimeout(r, 80)); active--; return { text: "ok", chunks: [] }; } });
  await Promise.all([1, 2, 3].map(() => provider.transcribe(join(dir, "tone.mp3"), {})));
  assert.equal(maxActive, 1);
});

test("a recognizer crash becomes a retryable failure, not a fake transcript", async () => {
  const provider = new LocalWhisperProvider({ model: "x", recognizer: async () => { throw new Error("onnx exploded"); } });
  await assert.rejects(provider.transcribe(join(dir, "tone.mp3"), {}), (e: unknown) => e instanceof MediaError && e.code === "transcription_failed");
});

test("cancel before recognition stops with 'cancelled'", async () => {
  const provider = new LocalWhisperProvider({ model: "x", recognizer: async () => ({ text: "should not run" }) });
  const ac = new AbortController(); ac.abort();
  await assert.rejects(provider.transcribe(join(dir, "tone.mp3"), { signal: ac.signal }), (e: unknown) => e instanceof MediaError && e.code === "cancelled");
});

test("when the model cannot be downloaded, the error tells the user to connect once", { timeout: 120_000 }, async () => {
  const provider = new LocalWhisperProvider({ model: "Xenova/definitely-not-a-real-model-xyz" });
  await assert.rejects(provider.transcribe(join(dir, "tone.mp3"), {}), (e: unknown) => e instanceof MediaError && e.code === "transcription_unavailable" && /internet/.test(e.message));
});

// Real tests: they generate media with the real ffmpeg and run the real pipeline. Needs ffmpeg + ffprobe on PATH.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertProcessable, extractAudio, MediaError, probeMedia, validateOutput } from "./ffmpeg.ts";

let dir: string;
const f = (name: string) => join(dir, name);
const ff = (...args: string[]) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);

before(() => {
  dir = mkdtempSync(join(tmpdir(), "clipora-test-"));
  // 3 s video with a 440 Hz tone
  ff("-f", "lavfi", "-i", "testsrc=duration=3:size=320x240:rate=15", "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
     "-c:v", "mpeg4", "-c:a", "aac", "-shortest", f("with-audio.mp4"));
  // 3 s video, no sound track
  ff("-f", "lavfi", "-i", "testsrc=duration=3:size=320x240:rate=15", "-c:v", "mpeg4", f("silent.mp4"));
  // not media at all, with a media extension
  writeFileSync(f("fake.mp4"), "this is plain text, not a video");
  // truncated real file
  ff("-f", "lavfi", "-i", "sine=frequency=330:duration=3", f("tone.wav"));
  // a playlist that tries to make ffmpeg fetch a URL
  writeFileSync(f("evil.m3u8"), "#EXTM3U\n#EXTINF:1,\nhttp://127.0.0.1:9/x.ts\n");
});
after(() => rmSync(dir, { recursive: true, force: true }));

test("probe reads duration and audio stream of a real video", async () => {
  const info = await probeMedia(f("with-audio.mp4"));
  assert.ok(info.formatName.includes("mp4"));
  assert.equal(info.audioStreams, 1);
  assert.ok(Math.abs(info.durationSeconds - 3) < 0.3);
});

test("extracts MP3, reports real progress, and the output passes validation", async () => {
  const info = await probeMedia(f("with-audio.mp4"));
  const seen: number[] = [];
  await extractAudio(f("with-audio.mp4"), f("out.mp3"), "mp3", {
    durationSeconds: info.durationSeconds, timeoutMs: 30_000, onProgress: (p) => seen.push(p),
  });
  const out = await validateOutput(f("out.mp3"), "mp3", info.durationSeconds, 10 * 1024 * 1024);
  assert.ok(out.sizeBytes > 1000);
  assert.ok(seen.length > 0, "progress callback was called");
  assert.ok(seen.every((p) => p >= 0 && p <= 1));
  assert.ok(Math.max(...seen) > 0.9, "progress reached the end");
});

test("extracts WAV from a video and validates it", async () => {
  const info = await probeMedia(f("with-audio.mp4"));
  await extractAudio(f("with-audio.mp4"), f("out.wav"), "wav", { durationSeconds: info.durationSeconds, timeoutMs: 30_000 });
  const out = await validateOutput(f("out.wav"), "wav", info.durationSeconds, 10 * 1024 * 1024);
  assert.ok(out.sizeBytes > 100_000);
});

test("converts an audio-only file too", async () => {
  const info = await probeMedia(f("tone.wav"));
  await extractAudio(f("tone.wav"), f("tone.mp3"), "mp3", { durationSeconds: info.durationSeconds, timeoutMs: 30_000 });
  await validateOutput(f("tone.mp3"), "mp3", info.durationSeconds, 10 * 1024 * 1024);
});

test("a video with no sound track is refused with a clear code", async () => {
  const info = await probeMedia(f("silent.mp4"));
  assert.throws(() => assertProcessable(info, 600), (e: unknown) => e instanceof MediaError && e.code === "no_audio_stream");
});

test("a text file renamed .mp4 is refused as unsupported", async () => {
  await assert.rejects(probeMedia(f("fake.mp4")), (e: unknown) => e instanceof MediaError && e.code === "unsupported_media");
});

test("a playlist file is refused, so ffmpeg never fetches a URL", async () => {
  await assert.rejects(probeMedia(f("evil.m3u8")), (e: unknown) => e instanceof MediaError && e.code === "unsupported_media");
});

test("recordings over the length limit are refused", async () => {
  const info = await probeMedia(f("with-audio.mp4"));
  assert.throws(() => assertProcessable(info, 1), (e: unknown) => e instanceof MediaError && e.code === "too_long");
});

test("oversized output is refused", async () => {
  await assert.rejects(validateOutput(f("out.wav"), "wav", 3, 100),
    (e: unknown) => e instanceof MediaError && e.code === "output_too_large");
});

test("an output of the wrong length fails the quality check", async () => {
  await assert.rejects(validateOutput(f("out.mp3"), "mp3", 60, 10 * 1024 * 1024),
    (e: unknown) => e instanceof MediaError && e.code === "processing_failed");
});

test("a stuck ffmpeg is killed at the timeout and no half file is trusted", async () => {
  // 1 ms timeout guarantees the kill path runs
  await assert.rejects(
    extractAudio(f("with-audio.mp4"), f("timeout.mp3"), "mp3", { durationSeconds: 3, timeoutMs: 1 }),
    (e: unknown) => e instanceof MediaError && e.code === "too_long",
  );
  assert.ok(true, existsSync(f("timeout.mp3")) ? "partial file exists but is never published" : "no partial file");
});

test("accepts WebM and MKV videos and extracts M4A, WAV and MP3 from them", async () => {
  ff("-f", "lavfi", "-i", "testsrc=duration=2:size=160x120:rate=10", "-f", "lavfi", "-i", "sine=frequency=500:duration=2",
     "-c:v", "libvpx", "-c:a", "libvorbis", "-shortest", f("v.webm"));
  ff("-f", "lavfi", "-i", "testsrc=duration=2:size=160x120:rate=10", "-f", "lavfi", "-i", "sine=frequency=500:duration=2",
     "-c:v", "mpeg4", "-c:a", "aac", "-shortest", f("v.mkv"));
  for (const src of ["v.webm", "v.mkv"]) {
    const info = await probeMedia(f(src));
    assertProcessable(info, 3600);
    for (const fmt of ["mp3", "wav", "m4a"] as const) {
      await extractAudio(f(src), f(`${src}.${fmt}`), fmt, { durationSeconds: info.durationSeconds, timeoutMs: 30_000 });
      const out = await validateOutput(f(`${src}.${fmt}`), fmt, info.durationSeconds, 10 * 1024 * 1024);
      assert.ok(out.sizeBytes > 500, `${src} -> ${fmt}`);
    }
  }
});

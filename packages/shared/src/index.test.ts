import { test } from "node:test";
import assert from "node:assert/strict";
import { getExtension, validateMediaFile, TOOLS, MAX_UPLOAD_MB } from "./index.ts";

const MB = 1024 * 1024;

test("getExtension is case-insensitive and handles no extension", () => {
  assert.equal(getExtension("Clip.MP4"), ".mp4");
  assert.equal(getExtension("archive.tar.gz"), ".gz");
  assert.equal(getExtension("noextension"), "");
});

test("accepts supported video and audio", () => {
  assert.deepEqual(validateMediaFile({ name: "a.mp4", size: MB, type: "video/mp4" }), { ok: true, kind: "video" });
  assert.deepEqual(validateMediaFile({ name: "a.MOV", size: MB, type: "video/quicktime" }), { ok: true, kind: "video" });
  assert.deepEqual(validateMediaFile({ name: "a.mp3", size: MB, type: "audio/mpeg" }), { ok: true, kind: "audio" });
  assert.deepEqual(validateMediaFile({ name: "a.wav", size: MB, type: "" }), { ok: true, kind: "audio" });
});

test("rejects unsupported extensions", () => {
  const r = validateMediaFile({ name: "virus.exe", size: MB, type: "application/octet-stream" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.code, "unsupported-type");
});

test("rejects a supported extension with a non-media MIME type", () => {
  const r = validateMediaFile({ name: "fake.mp4", size: MB, type: "text/html" });
  assert.equal(r.ok, false);
});

test("rejects empty and oversized files", () => {
  const empty = validateMediaFile({ name: "a.mp4", size: 0, type: "video/mp4" });
  assert.equal(empty.ok === false && empty.code, "empty");
  const big = validateMediaFile({ name: "a.mp4", size: (MAX_UPLOAD_MB + 1) * MB, type: "video/mp4" });
  assert.equal(big.ok === false && big.code, "too-large");
});

test("tool ids are unique and only the built tools are marked available", () => {
  const ids = TOOLS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(TOOLS.filter((t) => t.availability === "available").map((t) => t.id), ["video-to-audio", "video-to-text", "subtitles", "video-summarizer", "translate", "find-moment", "highlight-clipper", "bleep-maker", "speaking-coach"]);
});

import { buildDownloadName, isTerminalStatus, RETRYABLE_ERROR_CODES } from "./index.ts";

test("buildDownloadName strips path and control characters", () => {
  assert.equal(buildDownloadName("My talk.mp4", "mp3"), "My talk.mp3");
  assert.equal(buildDownloadName("../../etc/passwd.mov", "wav"), "_.._etc_passwd.wav");
  assert.equal(buildDownloadName("a\nb\u0000c.mp4", "mp3"), "abc.mp3");
  assert.equal(buildDownloadName("...hidden.mp4", "mp3"), "hidden.mp3");
  assert.equal(buildDownloadName(".mp4", "mp3"), "audio.mp3");
  assert.ok(buildDownloadName("x".repeat(500) + ".mp4", "mp3").length <= 124);
});

test("only finished states are terminal, and corrupt-file errors are not retryable", () => {
  assert.equal(isTerminalStatus("completed"), true);
  assert.equal(isTerminalStatus("failed"), true);
  assert.equal(isTerminalStatus("processing"), false);
  assert.equal(isTerminalStatus("queued"), false);
  assert.equal(RETRYABLE_ERROR_CODES.includes("unsupported_media"), false);
  assert.equal(RETRYABLE_ERROR_CODES.includes("no_audio_stream"), false);
});

import { formatSrt, formatVtt, formatTimestamp, buildTranscriptName, validateMediaFile as vmf } from "./index.ts";

test("subtitle timestamps and files are correctly formatted", () => {
  assert.equal(formatTimestamp(3725.5, ","), "01:02:05,500");
  assert.equal(formatTimestamp(0.0004, "."), "00:00:00.000");
  const segs = [{ start: 0, end: 1.25, text: "Hello" }, { start: 1.25, end: 2, text: "  " }, { start: 2, end: 3, text: "line\nbreak" }];
  assert.equal(formatSrt(segs), "1\n00:00:00,000 --> 00:00:01,250\nHello\n\n2\n00:00:02,000 --> 00:00:03,000\nline break\n");
  assert.equal(formatVtt(segs), "WEBVTT\n\n00:00:00.000 --> 00:00:01.250\nHello\n\n00:00:02.000 --> 00:00:03.000\nline break\n");
  assert.equal(buildTranscriptName("My talk/../x", "srt"), "My talk_.._x.srt");
});

test("WebM and MKV are accepted", () => {
  assert.equal(vmf({ name: "a.webm", size: MB, type: "video/webm" }).ok, true);
  assert.equal(vmf({ name: "a.mkv", size: MB, type: "video/x-matroska" }).ok, true);
});

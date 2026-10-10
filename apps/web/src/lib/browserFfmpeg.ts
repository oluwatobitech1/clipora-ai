import type { FFmpeg } from "@ffmpeg/ffmpeg";

const CORE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
let instance: Promise<FFmpeg> | null = null;

/** One shared ffmpeg.wasm per page. It runs in the visitor's browser, so files never leave their device. */
export function getFfmpeg(): Promise<FFmpeg> {
  if (!instance) {
    instance = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import("@ffmpeg/ffmpeg"), import("@ffmpeg/util")]);
      const ff = new FFmpeg();
      await ff.load({
        coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ff;
    })().catch((err) => {
      instance = null;
      throw err;
    });
  }
  return instance;
}

export function resetFfmpeg() {
  const old = instance;
  instance = null;
  void old?.then((ff) => ff.terminate()).catch(() => {});
}

import { getFfmpeg } from "./browserFfmpeg";
import { ConvertError } from "./errors";

export interface MediaInfo {
  hasVideo: boolean;
  hasAudio: boolean;
  videoCodec: string;
  audioCodec: string;
}

/** Works out what is inside a file from ffmpeg's own description of it. */
export function parseMediaInfo(log: string): MediaInfo {
  const video = /Stream #\d+:\d+[^\n]*?: Video: (\w+)/i.exec(log);
  const audio = /Stream #\d+:\d+[^\n]*?: Audio: (\w+)/i.exec(log);
  return { hasVideo: !!video, hasAudio: !!audio, videoCodec: video?.[1].toLowerCase() ?? "", audioCodec: audio?.[1].toLowerCase() ?? "" };
}

const COPY_FALLBACK_MAX_MB = 300;

/**
 * Runs ffmpeg in the browser on one file. `plan` receives the input path and what the file contains, and returns one or more
 * argument lists to try in order (for example "copy the streams" first, then "re-encode"). The first one that succeeds wins.
 */
export async function runFfmpeg(
  file: File,
  outName: string,
  mime: string,
  plan: (input: string, info: MediaInfo) => string[][],
  onProgress: (pct: number) => void,
): Promise<Blob> {
  const ff = await getFfmpeg();
  const dir = "/in";
  let input = "input";
  let mounted = false;
  try {
    try {
      await ff.createDir(dir).catch(() => undefined);
      const ok = await ff.mount("WORKERFS" as never, { files: [new File([file], "input")] }, dir);
      if (!ok) throw new Error("mount failed");
      input = `${dir}/input`;
      mounted = true;
    } catch {
      if (file.size > COPY_FALLBACK_MAX_MB * 1024 * 1024) {
        throw new ConvertError(`This browser cannot handle a file this big. Please use a file under ${COPY_FALLBACK_MAX_MB} MB.`);
      }
      await ff.writeFile("input", new Uint8Array(await file.arrayBuffer()));
    }

    let log = "";
    const onLog = ({ message }: { message: string }) => {
      log += `${message}\n`;
    };
    ff.on("log", onLog);
    await ff.exec(["-hide_banner", "-i", input]);
    ff.off("log", onLog);
    const info = parseMediaInfo(log);
    if (!info.hasAudio && !info.hasVideo) throw new ConvertError("This file could not be read. It may be damaged or in a format that is not supported.");

    const onProg = ({ progress }: { progress: number }) => onProgress(Math.min(1, Math.max(0, progress)));
    ff.on("progress", onProg);
    let code = 1;
    try {
      for (const args of plan(input, info)) {
        await ff.deleteFile(outName).catch(() => undefined);
        code = await ff.exec([...args, outName]);
        if (code === 0) break;
      }
    } finally {
      ff.off("progress", onProg);
    }
    if (code !== 0) throw new ConvertError("This file could not be converted. It may be damaged or use an unusual format.");
    const data = (await ff.readFile(outName)) as Uint8Array;
    await ff.deleteFile(outName).catch(() => undefined);
    return new Blob([data.slice().buffer], { type: mime });
  } finally {
    if (mounted) {
      await ff.unmount(dir).catch(() => undefined);
      await ff.deleteDir(dir).catch(() => undefined);
    } else {
      await ff.deleteFile("input").catch(() => undefined);
    }
  }
}

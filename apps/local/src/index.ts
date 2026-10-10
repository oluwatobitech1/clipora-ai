import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildLocalApp, configFromEnv } from "./server.ts";

// .env is optional here: audio extraction needs nothing. Only OPENAI_API_KEY (for Transcribe) comes from it.
try {
  process.loadEnvFile(resolve(import.meta.dirname, "../../../.env"));
} catch {
  /* no .env file: fine */
}

const config = configFromEnv();
// Hosted link server: cookies.txt pasted into an environment variable becomes a private file for yt-dlp.
if (process.env.YTDLP_COOKIES_TXT && !config.cookiesFile) {
  const file = join(tmpdir(), "ytdlp-cookies.txt");
  writeFileSync(file, process.env.YTDLP_COOKIES_TXT.replace(/\\n/g, "\n"), { mode: 0o600 });
  config.cookiesFile = file;
}
const { app } = await buildLocalApp(config);
await app.listen({ port: config.port, host: config.host ?? "127.0.0.1" });
if (config.linkOnly) {
  app.log.info("Framevox link server ready (link import only).");
} else {
  const usesOpenAI = config.engine === "openai" || (config.engine === "auto" && !!config.openaiApiKey);
  const engineLabel = usesOpenAI
    ? config.openaiApiKey
      ? "enabled (OpenAI cloud)"
      : "OFF (TRANSCRIBE_ENGINE=openai but OPENAI_API_KEY is missing)"
    : "enabled (free local Whisper)";
  app.log.info(`Framevox local mode ready. Transcription ${engineLabel}.`);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

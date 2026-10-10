import { resolve } from "node:path";
import { buildLocalApp, configFromEnv } from "./server.ts";

// .env is optional here: audio extraction needs nothing. Only OPENAI_API_KEY (for Transcribe) comes from it.
try {
  process.loadEnvFile(resolve(import.meta.dirname, "../../../.env"));
} catch {
  /* no .env file: fine */
}

const config = configFromEnv();
const { app } = await buildLocalApp(config);
await app.listen({ port: config.port, host: "127.0.0.1" });
const usesOpenAI = config.engine === "openai" || (config.engine === "auto" && !!config.openaiApiKey);
const engineLabel = usesOpenAI
  ? config.openaiApiKey
    ? "enabled (OpenAI cloud)"
    : "OFF (TRANSCRIBE_ENGINE=openai but OPENAI_API_KEY is missing)"
  : "enabled (free local Whisper)";
app.log.info(`Framevox local mode ready. Transcription ${engineLabel}.`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

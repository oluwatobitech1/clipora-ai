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
app.log.info(`Clipora local mode ready. Transcription ${config.openaiApiKey ? "enabled" : "OFF (no OPENAI_API_KEY)"}.`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

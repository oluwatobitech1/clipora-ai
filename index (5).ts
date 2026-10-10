import { buildApp } from "./app.ts";
import { config } from "./config.ts";

const app = await buildApp();
await app.listen({ port: config.port, host: "0.0.0.0" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

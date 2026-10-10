import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import type { ApiErrorBody } from "@clipora/shared";
import { config } from "./config.ts";
import { ApiError } from "./errors.ts";
import { jobRoutes } from "./routes/jobs.ts";
import { projectRoutes } from "./routes/projects.ts";
import { uploadRoutes } from "./routes/uploads.ts";

export async function buildApp() {
  const app = Fastify({
    logger: { level: "info", redact: ["req.headers.authorization"] },
    bodyLimit: 32 * 1024, // JSON only. Files go straight to storage, never through this server.
  });

  await app.register(cors, { origin: config.corsOrigin, methods: ["GET", "POST", "DELETE"] });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  app.setErrorHandler((err, request, reply) => {
    const send = (status: number, body: ApiErrorBody) => reply.code(status).send(body);
    if (err instanceof ApiError) return send(err.status, { error: { code: err.code, message: err.message } });
    if (err instanceof ZodError) return send(400, { error: { code: "validation_failed", message: "The request was not valid." } });
    if ((err as { statusCode?: number }).statusCode === 429) {
      return send(429, { error: { code: "quota_exceeded", message: "Too many requests. Please slow down and try again shortly." } });
    }
    request.log.error({ err: err instanceof Error ? err.message : String(err) }, "unhandled error"); // message only, never request bodies
    return send(500, { error: { code: "internal_error", message: "Something went wrong. Please try again." } });
  });

  app.get("/api/health", async () => ({ ok: true }));
  await app.register(uploadRoutes);
  await app.register(jobRoutes);
  await app.register(projectRoutes);
  return app;
}

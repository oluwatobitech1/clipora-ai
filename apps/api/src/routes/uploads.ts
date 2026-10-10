import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { MEDIA_BUCKET, validateMediaFile, type AuthorizeUploadResponse } from "@framevox/shared";
import { requireUser } from "../auth.ts";
import { db } from "../clients.ts";
import { config } from "../config.ts";
import { ApiError } from "../errors.ts";

const body = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(100),
  sizeBytes: z.number().int().positive(),
});

const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, "").trim();

export async function uploadRoutes(app: FastifyInstance) {
  // POST /api/uploads/authorize: validate the request, create the project and file record, return a one-time upload token.
  app.post("/api/uploads/authorize", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const userId = await requireUser(request);
    const input = body.parse(request.body);
    const fileName = clean(input.fileName);

    const check = validateMediaFile({ name: fileName, size: input.sizeBytes, type: input.mimeType }, config.maxUploadMb);
    if (!check.ok) {
      throw new ApiError(check.code === "too-large" ? 413 : 400, check.code === "too-large" ? "file_too_large" : "validation_failed", check.message);
    }

    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await db.from("media_files").select("id", { count: "exact", head: true }).eq("owner_id", userId).gte("created_at", since);
    if ((count ?? 0) >= config.maxUploadsPerDay) {
      throw new ApiError(429, "quota_exceeded", "You have reached the daily upload limit. Try again tomorrow.");
    }

    const dot = fileName.lastIndexOf(".");
    const title = (dot > 0 ? fileName.slice(0, dot) : fileName).slice(0, 200) || "Untitled";
    const { data: project, error: projectError } = await db.from("projects").insert({ user_id: userId, title }).select("id").single();
    if (projectError || !project) throw new Error(`could not create project: ${projectError?.message}`);

    // The storage key is generated here. The user's filename is never used as a path.
    const path = `originals/${userId}/${randomUUID()}`;
    const expiresAt = new Date(Date.now() + config.retentionHours * 3600_000).toISOString();
    const { data: media, error: mediaError } = await db
      .from("media_files")
      .insert({
        project_id: project.id, owner_id: userId, bucket: MEDIA_BUCKET, storage_key: path,
        original_name: fileName, mime_type: input.mimeType, size_bytes: input.sizeBytes, expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (mediaError || !media) {
      await db.from("projects").delete().eq("id", project.id).eq("user_id", userId);
      throw new Error(`could not create file record: ${mediaError?.message}`);
    }

    const { data: signed, error: signError } = await db.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
    if (signError || !signed) {
      await db.from("projects").delete().eq("id", project.id).eq("user_id", userId);
      throw new Error(`could not create upload link: ${signError?.message}`);
    }

    const response: AuthorizeUploadResponse = { projectId: project.id, mediaFileId: media.id, bucket: MEDIA_BUCKET, path, token: signed.token };
    return reply.code(201).send(response);
  });
}

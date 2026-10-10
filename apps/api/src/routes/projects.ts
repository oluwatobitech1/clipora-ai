import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth.ts";
import { db } from "../clients.ts";
import { ApiError } from "../errors.ts";

const idParams = z.object({ id: z.string().uuid() });

export async function projectRoutes(app: FastifyInstance) {
  // Deletes the project, its uploaded file, its results and its job records.
  app.delete("/api/projects/:id", async (request, reply) => {
    const userId = await requireUser(request);
    const { id } = idParams.parse(request.params);

    const { data: project } = await db.from("projects").select("id").eq("id", id).eq("user_id", userId).maybeSingle();
    if (!project) throw new ApiError(404, "not_found", "Project not found.");

    const [{ data: media }, { data: exports }] = await Promise.all([
      db.from("media_files").select("bucket, storage_key").eq("project_id", id).eq("owner_id", userId),
      db.from("exports").select("bucket, storage_key").eq("project_id", id).eq("owner_id", userId),
    ]);

    const byBucket = new Map<string, string[]>();
    for (const f of [...(media ?? []), ...(exports ?? [])]) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.storage_key]);
    for (const [bucket, keys] of byBucket) {
      const { error } = await db.storage.from(bucket).remove(keys);
      // Files first. If this fails we keep the records so the delete can be retried.
      if (error) throw new ApiError(502, "internal_error", "Your files could not be deleted right now. Please try again.");
    }

    const { error } = await db.from("projects").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new Error(`could not delete project: ${error.message}`);
    return reply.code(204).send();
  });
}

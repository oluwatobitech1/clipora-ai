import type { FastifyRequest } from "fastify";
import { db } from "./clients.ts";
import { ApiError } from "./errors.ts";

/** Verifies the Supabase access token with Supabase itself and returns the user ID. */
export async function requireUser(request: FastifyRequest): Promise<string> {
  const header = request.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new ApiError(401, "unauthorized", "Please sign in to continue.");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, "unauthorized", "Your session has expired. Please sign in again.");
  return data.user.id;
}

import type { AuthorizeUploadResponse } from "@framevox/shared";
import { api } from "./api";
import { supabase } from "./supabase";

/** Asks the API for a one-time upload link, then sends the file straight to private storage. */
export async function uploadForProcessing(file: File, onStep: (step: "preparing" | "uploading") => void): Promise<AuthorizeUploadResponse> {
  if (!supabase) throw new Error("Storage is not configured. Follow the setup steps in the README.");
  onStep("preparing");
  const auth = await api<AuthorizeUploadResponse>("/api/uploads/authorize", {
    method: "POST",
    body: { fileName: file.name, mimeType: file.type, sizeBytes: file.size },
  });
  onStep("uploading");
  const { error } = await supabase.storage.from(auth.bucket).uploadToSignedUrl(auth.path, auth.token, file);
  if (error) throw new Error("The upload failed. Check your connection and try again.");
  return auth;
}

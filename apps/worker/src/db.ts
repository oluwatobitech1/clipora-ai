import { createClient } from "@supabase/supabase-js";
import { config } from "./config.ts";

/** Service-role client: bypasses RLS, so every query below filters by IDs taken from the job row itself. */
export const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface JobRow {
  id: string;
  project_id: string;
  owner_id: string;
  media_file_id: string | null;
  task_type: "audio_extract" | "transcribe";
  status: string;
  attempts: number;
  params: { format?: "mp3" | "wav" | "m4a"; language?: string };
}

export interface MediaRow {
  id: string;
  bucket: string;
  storage_key: string;
  original_name: string;
}

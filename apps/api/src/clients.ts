import { createClient } from "@supabase/supabase-js";
import { config } from "./config.ts";

/** Service-role client: bypasses RLS. Every query that uses it MUST filter by the authenticated user's ID. */
export const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

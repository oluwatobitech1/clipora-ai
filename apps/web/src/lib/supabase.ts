import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null when the project is not configured yet, so the UI can say so instead of crashing. */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

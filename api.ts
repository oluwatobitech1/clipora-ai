import type { ApiErrorBody } from "@clipora/shared";
import { supabase } from "./supabase";

const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export class ApiClientError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, options: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {}): Promise<T> {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  const token = data.session?.access_token;

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiClientError(0, "network", "Could not reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) {
    throw new ApiClientError(res.status, json?.error?.code ?? "unknown", json?.error?.message ?? "Something went wrong. Please try again.");
  }
  return json as T;
}

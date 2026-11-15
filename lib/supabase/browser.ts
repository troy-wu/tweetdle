"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseAuthConfigured } from "./env";

let client: SupabaseClient | null = null;

/** Browser Supabase client (anon key, session in cookies). Null when Supabase is not configured. */
export function getBrowserSupabase(): SupabaseClient | null {
  if (!supabaseAuthConfigured || typeof window === "undefined") return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseAuthConfigured } from "./env";

/**
 * Per-request Supabase client acting as the signed-in user (anon key + session
 * cookies). Use in Route Handlers. Null when Supabase is not configured.
 */
export async function createServerSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseAuthConfigured) return null;
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called somewhere cookies are read-only (e.g. a Server Component). Safe to ignore:
          // the browser client refreshes the session and rewrites the cookies itself.
        }
      },
    },
  });
}

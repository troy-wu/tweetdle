/** Who is making this request? Null for guests and whenever Supabase is not configured. */
import { createServerSupabase } from "@/lib/supabase/server";

export interface RequestUser {
  id: string;
  email?: string;
}

export async function getRequestUser(): Promise<RequestUser | null> {
  try {
    const supabase = await createServerSupabase();
    if (!supabase) return null;
    // getUser() verifies the token with Supabase Auth (getSession() would trust the cookie).
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? undefined };
  } catch {
    return null;
  }
}

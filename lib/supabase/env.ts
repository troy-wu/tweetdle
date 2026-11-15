/** Supabase configuration. Everything here tolerates missing env vars. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/** True when sign-in can work (public URL + anon key are set). */
export const supabaseAuthConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

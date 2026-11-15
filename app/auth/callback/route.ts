import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

/** Only same-site relative paths, so the callback cannot be used as an open redirect. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : "/";
}

/**
 * GET /auth/callback. Landing URL for Google OAuth and email magic links.
 * Exchanges the one-time code (PKCE) or token hash for a session cookie and
 * redirects home.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const done = (path: string) => NextResponse.redirect(new URL(path, url.origin), 303);
  const failed = () => done("/?auth_error=1");

  try {
    const supabase = await createServerSupabase();
    if (!supabase) return failed();

    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type") as EmailOtpType | null;

    let userId: string | undefined;
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return failed();
      userId = data.user?.id;
    } else if (tokenHash && type) {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) return failed();
      userId = data.user?.id;
    } else {
      return failed();
    }

    // The database trigger creates the profile on sign-up; this is a no-op
    // backstop for users created before the trigger existed.
    if (userId) {
      const { error } = (await getAdminClient()?.rpc("ensure_profile", { p_user_id: userId })) ?? { error: null };
      if (error) console.error("[auth] ensure_profile:", error.message);
    }

    return done(safeNext(url.searchParams.get("next")));
  } catch (err) {
    console.error("[auth] callback:", err);
    return failed();
  }
}

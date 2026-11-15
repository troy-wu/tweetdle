"use client";
/**
 * Auth facade used by the UI, backed by Supabase Auth. Safe to import when the
 * Supabase env vars are missing: authEnabled is false and every call is a no-op.
 */
import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { supabaseAuthConfigured } from "@/lib/supabase/env";
import type { SessionUser } from "@/lib/types";

/** False when Supabase env vars are missing: UI hides sign-in. */
export const authEnabled = supabaseAuthConfigured;

type AuthState = { user: SessionUser | null; loading: boolean };

const SERVER_STATE: AuthState = { user: null, loading: authEnabled };
let state: AuthState = SERVER_STATE;
const listeners = new Set<() => void>();
let started = false;
let loadSeq = 0;

function setState(next: AuthState) {
  state = next;
  for (const notify of listeners) notify();
}

const fallbackName = (user: User) => `Player ${user.id.replace(/-/g, "").slice(0, 8)}`;

async function loadUser(user: User | null | undefined) {
  const seq = ++loadSeq;
  if (!user) return setState({ user: null, loading: false });
  let displayName = fallbackName(user);
  try {
    const { data } = await getBrowserSupabase()!
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    if (data?.display_name) displayName = data.display_name as string;
  } catch {
    // Keep the fallback name; the session itself is still valid.
  }
  if (seq !== loadSeq) return; // a newer auth event superseded this one
  setState({ user: { id: user.id, displayName, email: user.email ?? undefined }, loading: false });
}

/** One auth subscription for the whole app, started by the first useUser(). */
function start() {
  if (started) return;
  started = true;
  const supabase = getBrowserSupabase();
  if (!supabase) return setState({ user: null, loading: false });
  // Fires INITIAL_SESSION straight away, then on every sign-in/out/refresh.
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED" && state.user?.id === session?.user.id) return;
    // Supabase calls must not be awaited inside this callback (it holds the auth lock).
    setTimeout(() => void loadUser(session?.user), 0);
  });
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  start();
  return () => {
    listeners.delete(notify);
  };
}

export function useUser(): { user: SessionUser | null; loading: boolean } {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
}

const callbackUrl = () => `${window.location.origin}/auth/callback`;

export async function signInWithGoogle(): Promise<void> {
  const supabase = getBrowserSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl() },
  });
  if (error) throw new Error(error.message);
}

/** Sends a magic link. Resolves once the email is sent. */
export async function signInWithEmail(email: string): Promise<void> {
  const supabase = getBrowserSupabase();
  if (!supabase) return;
  const address = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error("Enter a valid email address.");
  const { error } = await supabase.auth.signInWithOtp({
    email: address,
    options: { emailRedirectTo: callbackUrl() },
  });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const supabase = getBrowserSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function updateDisplayName(name: string): Promise<void> {
  const displayName = name.trim().replace(/\s+/g, " ");
  if (!/^[A-Za-z0-9_ ]{3,20}$/.test(displayName)) {
    throw new Error("Names are 3-20 characters: letters, numbers, spaces and underscores.");
  }
  const supabase = getBrowserSupabase();
  if (!supabase) return;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sign in to change your name.");
  const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", auth.user.id);
  if (error) {
    // 23505 = unique violation on the case-insensitive name index.
    throw new Error(error.code === "23505" ? "That name is taken. Try another." : error.message);
  }
  if (state.user?.id === auth.user.id) setState({ user: { ...state.user, displayName }, loading: false });
}

"use client";
import { useEffect } from "react";
import { syncHistory } from "@/lib/api";
import { authEnabled, useUser } from "@/lib/auth";
import { getHistory, mergeHistory } from "@/lib/game";
import { useModals } from "./AppShell";
import { bumpStorage } from "./hooks";
import { UserIcon } from "./icons";

const syncedKey = (userId: string) => `tweetdle:synced:${userId}`;

/**
 * Header account button. Also uploads the guest history once per browser
 * session after sign-in and merges what the server sends back.
 */
export function AuthButton() {
  const { open } = useModals();
  const { user, loading } = useUser();
  const userId = user?.id;

  useEffect(() => {
    if (!authEnabled || !userId) return;
    try {
      if (window.sessionStorage.getItem(syncedKey(userId))) return;
      window.sessionStorage.setItem(syncedKey(userId), "1");
    } catch {}
    syncHistory(getHistory())
      .then((res) => {
        mergeHistory(res.history);
        bumpStorage();
      })
      .catch(() => {
        // Try again on the next page load.
        try {
          window.sessionStorage.removeItem(syncedKey(userId));
        } catch {}
      });
  }, [userId]);

  if (!authEnabled || loading) return null;

  return (
    <button
      type="button"
      className="btn btn-icon"
      onClick={() => open("account")}
      aria-label={user ? `Account: ${user.displayName}` : "Sign in"}
    >
      <UserIcon />
    </button>
  );
}

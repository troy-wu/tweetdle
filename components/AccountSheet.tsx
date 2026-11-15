"use client";
import { useState } from "react";
import {
  authEnabled,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  updateDisplayName,
  useUser,
} from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { Modal } from "./Modal";

type Status = { kind: "idle" | "busy" } | { kind: "ok" | "error"; message: string };

const messageOf = (e: unknown) =>
  e instanceof Error && e.message ? e.message : "Something went wrong. Try again.";

function StatusLine({ status }: { status: Status }) {
  if (status.kind !== "ok" && status.kind !== "error") return null;
  return (
    <p role="status" className={`font-semibold ${status.kind === "error" ? "text-bad" : ""}`}>
      {status.message}
    </p>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const busy = status.kind === "busy";

  async function run(action: () => Promise<void>, done?: string) {
    setStatus({ kind: "busy" });
    try {
      await action();
      setStatus(done ? { kind: "ok", message: done } : { kind: "idle" });
    } catch (e) {
      setStatus({ kind: "error", message: messageOf(e) });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">Save your streak on every device and join the leaderboard.</p>
      <button
        type="button"
        className="btn btn-accent w-full"
        disabled={busy}
        onClick={() => run(signInWithGoogle)}
      >
        Continue with Google
      </button>
      <div className="flex items-center gap-3 label">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => signInWithEmail(email.trim()), "Check your email for a sign-in link.");
        }}
      >
        <label htmlFor="signin-email" className="font-semibold">
          Email me a sign-in link
        </label>
        <input
          id="signin-email"
          className="field"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="btn w-full" disabled={busy || !email.trim()}>
          {busy ? "Sending…" : "Send link"}
        </button>
      </form>
      <StatusLine status={status} />
    </div>
  );
}

function Account({ user, onClose }: { user: SessionUser; onClose: () => void }) {
  const [name, setName] = useState(user.displayName);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const busy = status.kind === "busy";
  const trimmed = name.trim();

  return (
    <div className="flex flex-col gap-4">
      {user.email && <p className="break-all text-muted">Signed in as {user.email}</p>}
      <form
        className="flex flex-col gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setStatus({ kind: "busy" });
          try {
            await updateDisplayName(trimmed);
            setStatus({ kind: "ok", message: "Name saved." });
          } catch (err) {
            setStatus({ kind: "error", message: messageOf(err) });
          }
        }}
      >
        <label htmlFor="display-name" className="font-semibold">
          Leaderboard name
        </label>
        <input
          id="display-name"
          className="field"
          type="text"
          required
          minLength={2}
          maxLength={24}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          className="btn btn-accent w-full"
          disabled={busy || trimmed.length < 2 || trimmed === user.displayName}
        >
          Save name
        </button>
      </form>
      <StatusLine status={status} />
      <button
        type="button"
        className="btn w-full"
        disabled={busy}
        onClick={async () => {
          try {
            await signOut();
            onClose();
          } catch (err) {
            setStatus({ kind: "error", message: messageOf(err) });
          }
        }}
      >
        Sign out
      </button>
    </div>
  );
}

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const { user } = useUser();
  if (!authEnabled) return null;
  return (
    <Modal title={user ? "Your account" : "Sign in"} onClose={onClose}>
      {user ? <Account key={user.id} user={user} onClose={onClose} /> : <SignIn />}
    </Modal>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getLeaderboard } from "@/lib/api";
import { authEnabled, useUser } from "@/lib/auth";
import { MAX_GUESSES } from "@/lib/constants";
import type { LeaderboardKind, LeaderboardRow } from "@/lib/types";
import { useModals } from "./AppShell";
import { useToday } from "./hooks";

const TABS: { kind: LeaderboardKind; label: string }[] = [
  { kind: "today", label: "Today" },
  { kind: "alltime", label: "All-time" },
  { kind: "streak", label: "Streaks" },
];

type Loaded = { key: string; rows: LeaderboardRow[] | null };

function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function valueText(kind: LeaderboardKind, row: LeaderboardRow): string {
  if (kind === "streak") return `${row.value} days`;
  return `${row.value.toLocaleString("en-US")} pts`;
}

export function Leaderboard() {
  const today = useToday();
  const { open } = useModals();
  const { user, loading: userLoading } = useUser();
  const [kind, setKind] = useState<LeaderboardKind>("today");
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // The signed-in user is part of the key so "isYou" refreshes after sign-in.
  const key = today === null ? null : `${kind}:${today}:${user?.id ?? ""}:${attempt}`;

  useEffect(() => {
    if (key === null || today === null) return;
    let cancelled = false;
    getLeaderboard(kind, today)
      .then((rows) => !cancelled && setLoaded({ key, rows }))
      .catch(() => !cancelled && setLoaded({ key, rows: null }));
    return () => {
      cancelled = true;
    };
  }, [key, kind, today]);

  const current = loaded && loaded.key === key ? loaded : null;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-4xl font-bold">Leaderboard</h1>

      <div role="tablist" aria-label="Leaderboard" className="flex gap-6 border-b border-line">
        {TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            role="tab"
            id={`tab-${tab.kind}`}
            aria-selected={kind === tab.kind}
            aria-controls="leaderboard-panel"
            className={`-mb-px cursor-pointer border-b-2 pb-2 text-sm font-semibold ${kind === tab.kind ? "border-ink" : "border-transparent text-muted"}`}
            onClick={() => setKind(tab.kind)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!authEnabled ? (
        <p className="text-sm text-muted">
          Sign-in is coming soon. Then your scores can appear here.
        </p>
      ) : (
        !userLoading &&
        !user && (
          <button type="button" className="link self-start text-sm" onClick={() => open("account")}>
            Sign in to join the leaderboard
          </button>
        )
      )}

      <div id="leaderboard-panel" role="tabpanel" aria-labelledby={`tab-${kind}`}>
        {!current ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading leaderboard">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-12" />
            ))}
          </div>
        ) : current.rows === null ? (
          <div className="card flex flex-col items-center gap-4 p-6 text-center">
            <p className="text-lg font-semibold">The leaderboard didn&apos;t load.</p>
            <button type="button" className="btn btn-accent" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
          </div>
        ) : current.rows.length === 0 ? (
          <div className="card flex flex-col items-center gap-4 p-6 text-center">
            <p className="font-display text-2xl font-bold">Nobody here yet</p>
            <p className="text-muted">
              {kind === "today" ? "Be the first on today's board." : "Scores show up after the first games."}
            </p>
            <Link href="/play" className="btn btn-accent">
              Play today&apos;s puzzle
            </Link>
          </div>
        ) : (
          <ol className="flex flex-col divide-y divide-line border-y border-line">
            {current.rows.map((row) => (
              <li
                key={`${row.rank}-${row.displayName}`}
                aria-current={row.isYou ? "true" : undefined}
                className={`flex items-center gap-3 px-2 py-2.5 ${row.isYou ? "bg-soft" : ""}`}
              >
                <span
                  className="w-7 shrink-0 text-right font-display text-lg font-bold tabular-nums"
                >
                  {row.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {row.displayName}
                    {row.isYou && <span className="ml-2 text-sm font-semibold">(you)</span>}
                  </p>
                  {kind === "today" && row.guessesUsed !== undefined && (
                    <p className="text-sm text-muted">
                      {row.value > 0 ? `${row.guessesUsed}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`}
                      {row.durationMs !== undefined && ` · ${duration(row.durationMs)}`}
                    </p>
                  )}
                </div>
                <span className="font-semibold tabular-nums">
                  {valueText(kind, row)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

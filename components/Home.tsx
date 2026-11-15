"use client";
import Link from "next/link";
import { useModals } from "./AppShell";
import { Countdown } from "./Countdown";
import { usePlayerStats, useToday, useTodayGame } from "./hooks";

const dateFormat = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

export function Home() {
  const { open } = useModals();
  const stats = usePlayerStats();
  const today = useToday();
  const game = useTodayGame();
  const done = game !== null && game.status !== "playing";
  const inProgress = game !== null && game.status === "playing" && game.guesses.length > 0;
  const streak = stats?.currentStreak ?? 0;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 pb-10 pt-6 text-center">
      <div className="flex flex-col items-center gap-3">
        {/* Reserve the line so nothing jumps once the date is known. */}
        <p className="label min-h-[1.1rem]">
          {today !== null && today >= 1 ? `No. ${today} \u00b7 ${dateFormat.format(new Date())}` : ""}
        </p>
        <h1 className="font-display text-[2.6rem] font-bold leading-[1.05] tracking-tight sm:text-5xl">
          Who tweeted this?
        </h1>
        <p className="max-w-[22rem] text-lg text-muted">
          Five tweets. One author. Five guesses. A new one every day.
        </p>
      </div>

      <div className="flex w-full max-w-[16rem] flex-col gap-4">
        <Link href="/play" className="btn btn-accent btn-xl w-full">
          {done ? "See today\u2019s result" : inProgress ? "Continue" : "Play"}
        </Link>
        <p className="flex justify-center gap-5 text-sm">
          <Link href="/leaderboard" className="link">
            Leaderboard
          </Link>
          <button type="button" className="link" onClick={() => open("help")}>
            How to play
          </button>
        </p>
      </div>

      <div className="flex min-h-[6rem] flex-col items-center gap-4">
        {streak > 0 && (
          <button
            type="button"
            className="link text-sm"
            onClick={() => open("stats")}
            aria-label={`Current streak: ${streak}. Open your stats`}
          >
            {streak}-day streak
          </button>
        )}
        {done && <Countdown />}
      </div>

      <Link href="/unlimited" className="text-xs text-muted hover:text-ink">
        Unlimited mode
      </Link>
    </div>
  );
}

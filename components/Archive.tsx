"use client";
import Link from "next/link";
import { MAX_GUESSES } from "@/lib/constants";
import { dateForPuzzleNumber, listGames } from "@/lib/game";
import type { GameState } from "@/lib/types";
import { useMounted, useToday } from "./hooks";

const dayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

function status(game: GameState | undefined): { text: string; tone: string } {
  if (!game) return { text: "Play", tone: "text-ink underline decoration-line underline-offset-4" };
  if (game.status === "won") return { text: `Solved ${game.guesses.length}/${MAX_GUESSES}`, tone: "text-good" };
  if (game.status === "lost") return { text: `Missed X/${MAX_GUESSES}`, tone: "text-bad" };
  return { text: "In progress", tone: "text-muted" };
}

/** Every daily puzzle so far, newest first, with the player's own result. */
export function Archive() {
  const today = useToday();
  const mounted = useMounted();
  const ready = mounted && today !== null;
  const games = new Map((ready ? listGames("daily") : []).map((g) => [g.puzzleNumber, g]));
  const numbers = ready ? Array.from({ length: Math.max(0, today) }, (_, i) => today - i) : [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-4xl font-bold">Archive</h1>
        <p className="mt-1 text-sm text-muted">Catch up on any day you missed. Only the day itself counts for your streak.</p>
      </div>
      {!ready ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading puzzles">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-11" />
          ))}
        </div>
      ) : numbers.length === 0 ? (
        <p className="text-muted">The first puzzle has not run yet.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line border-y border-ink">
          {numbers.map((n) => {
            const s = status(games.get(n));
            return (
              <li key={n}>
                <Link
                  href={n === today ? "/play" : `/archive/${n}`}
                  className="flex items-baseline gap-4 px-1 py-3 hover:bg-soft"
                >
                  <span className="w-14 shrink-0 font-display text-lg font-bold tabular-nums">No. {n}</span>
                  <span className="min-w-0 flex-1 text-sm text-muted">
                    {n === today ? "Today" : dayFormat.format(dateForPuzzleNumber(n))}
                  </span>
                  <span className={`shrink-0 text-sm font-semibold ${s.tone}`}>{s.text}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

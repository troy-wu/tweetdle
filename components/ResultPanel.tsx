"use client";
import Link from "next/link";
import { MAX_GUESSES, SITE_URL } from "@/lib/constants";
import { authEnabled, useUser } from "@/lib/auth";
import { shareText, toHistoryEntry } from "@/lib/game";
import type { Author, DailyStats, GameState } from "@/lib/types";
import { useModals } from "./AppShell";
import { Countdown } from "./Countdown";
import { DistributionBars } from "./DistributionBars";
import { usePlayerStats } from "./hooks";
import { ShareButton } from "./ShareButton";

export interface Outcome {
  answer: Author | null;
  stats: DailyStats | null;
}

/** Share of other outcomes that were worse than the player's bucket. */
function beatPercent(distribution: readonly number[], bucket: number): number | null {
  const total = distribution.reduce((a, b) => a + b, 0);
  if (total <= 1) return null;
  const worse = distribution.slice(bucket + 1).reduce((a, b) => a + b, 0);
  return Math.round((worse / total) * 100);
}

export function ResultPanel({
  game,
  outcome,
  onNext,
  review,
  archive,
}: {
  game: GameState;
  /** null while the server is being asked. */
  outcome: Outcome | null;
  /** Unlimited mode: move on to another puzzle. Leaves out everything daily. */
  onNext?: () => void;
  /** Review mode: links to the next puzzle and the review list instead of anything daily. */
  review?: { next: number | null };
  /** Archive mode: a past daily puzzle, played for fun. */
  archive?: boolean;
}) {
  const { open } = useModals();
  const { user, loading } = useUser();
  const stats = usePlayerStats();
  const entry = toHistoryEntry(game);
  const won = entry.solved;
  const bucket = won ? entry.guessesUsed - 1 : MAX_GUESSES;
  const streak = stats?.currentStreak ?? 0;
  const global = outcome?.stats ?? null;
  const beat = global && won ? beatPercent(global.distribution, bucket) : null;
  const figures = [
    { label: "Guesses", value: won ? `${entry.guessesUsed}/${MAX_GUESSES}` : `X/${MAX_GUESSES}` },
    { label: "Score", value: String(entry.score) },
    ...(onNext || review || archive ? [] : [{ label: "Streak", value: String(streak) }]),
  ];

  return (
    <section className="card animate-pop flex flex-col gap-5 p-5" aria-live="polite">
      <div className="text-center">
        <p className={`label ${won ? "!text-good" : "!text-bad"}`}>
          {won ? (entry.guessesUsed === 1 ? "Solved on the first guess" : `Solved in ${entry.guessesUsed} guesses`) : "Not solved"}
        </p>
        {outcome ? (
          <>
            <h1 className="mt-1 font-display text-4xl font-bold leading-tight">
              {outcome.answer?.name ?? "Unknown"}
            </h1>
            {outcome.answer && <p className="text-muted">{outcome.answer.descriptor}</p>}
          </>
        ) : (
          <div className="skeleton mx-auto mt-2 h-10 w-48" aria-label="Loading answer" />
        )}
      </div>

      <dl className="flex divide-x divide-line border-y border-line text-center">
        {figures.map((s) => (
          <div key={s.label} className="flex-1 px-1 py-2.5">
            <dd className="font-display text-2xl font-bold tabular-nums">{s.value}</dd>
            <dt className="label">{s.label}</dt>
          </div>
        ))}
      </dl>

      {review ? (
        <p className="flex justify-center gap-5 text-sm">
          <Link href="/review" className="link">
            All puzzles
          </Link>
          {review.next !== null && (
            <Link href={`/review/${review.next}`} className="link">
              Skip to No. {review.next}
            </Link>
          )}
        </p>
      ) : onNext ? (
        <>
          <button type="button" className="btn btn-accent btn-xl w-full" onClick={onNext}>
            Next author
          </button>
          <p className="text-center text-sm">
            <Link href="/play" className="link">
              Back to today&apos;s puzzle
            </Link>
          </p>
        </>
      ) : (
        <>
          {!archive && <ShareButton text={shareText(entry, streak, SITE_URL)} />}

          <div>
            <h2 className="label mb-2">How everyone did</h2>
            {global ? (
              <>
                <DistributionBars distribution={global.distribution} highlight={bucket} />
                <p className="mt-3 text-center text-sm font-medium">
                  {beat !== null
                    ? `You beat ${beat}% of players`
                    : `${global.plays} ${global.plays === 1 ? "player" : "players"} ${archive ? "on the day" : "so far today"}`}
                </p>
              </>
            ) : outcome ? (
              <p className="text-muted">Global stats are not available right now.</p>
            ) : (
              <div className="skeleton h-40" />
            )}
          </div>

          {!archive && <Countdown />}

          <p className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
            {!archive && authEnabled && !loading && !user && (
              <button type="button" className="link" onClick={() => open("account")}>
                Sign in to save your streak
              </button>
            )}
            <Link href="/archive" className="link">
              Previous puzzles
            </Link>
            <Link href="/unlimited" className="link">
              Keep playing
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

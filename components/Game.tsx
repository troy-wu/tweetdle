"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_GUESSES } from "@/lib/constants";
import {
  type ReviewPuzzle,
  getAuthors,
  getPuzzleNumbers,
  getPuzzle,
  getReviewPuzzle,
  getStats,
  submitResult,
} from "@/lib/api";
import {
  applyGuess,
  applySkip,
  dateForPuzzleNumber,
  deleteGames,
  findAnswerId,
  getDeviceId,
  getGame,
  hintsUnlocked,
  isCorrectGuess,
  listGames,
  newGame,
  pickUnlimited,
  puzzleNumberForDate,
  recordResult,
  saveGame,
  toHistoryEntry,
  tweetsVisible,
} from "@/lib/game";
import type { Author, GameState, PublicPuzzle, ResultResponse } from "@/lib/types";
import { Countdown } from "./Countdown";
import { GuessInput } from "./GuessInput";
import { GuessList } from "./GuessList";
import { GuessPips } from "./GuessPips";
import { HintChips } from "./HintChips";
import { bumpStorage } from "./hooks";
import { type Outcome, ResultPanel } from "./ResultPanel";
import { ReviewRater } from "./ReviewRater";
import { TweetCard } from "./TweetCard";

type Load =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "none" }
  | {
      phase: "ready";
      puzzle: PublicPuzzle;
      authors: Author[];
      /** Tweets already on screen at load: those do not animate in. */
      initialVisible: number;
    };

/*
 * The server's reply is kept so a reload shows the result without a second submit.
 * Casual (unlimited/archive) replies are kept apart, so playing a puzzle early in
 * unlimited mode can never stand in for that day's real submission.
 */
const resultKey = (n: number, casual: boolean) => `tweetdle:result:${casual ? "c:" : ""}${n}`;

function readCachedResult(n: number, casual: boolean): ResultResponse | null {
  try {
    const raw = window.localStorage.getItem(resultKey(n, casual));
    return raw ? (JSON.parse(raw) as ResultResponse) : null;
  } catch {
    return null;
  }
}

function cacheResult(n: number, casual: boolean, result: ResultResponse) {
  try {
    window.localStorage.setItem(resultKey(n, casual), JSON.stringify(result));
  } catch {}
}

const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * Unlimited mode: the unfinished puzzle if there is one, else another from the
 * whole bank. When everything has been played the record is cleared and it
 * starts over, so it never runs out. null only if the bank is empty.
 */
async function pickUnlimitedNumber(): Promise<number | null> {
  const pool = await getPuzzleNumbers();
  const today = puzzleNumberForDate(new Date());
  const games = listGames("free").filter((g) => pool.includes(g.puzzleNumber));
  const unfinished = games.find((g) => g.status === "playing");
  if (unfinished) return unfinished.puzzleNumber;
  // Skip what was already played here, or as a daily or archive puzzle.
  const played = new Set(
    [...games, ...listGames("daily").filter((g) => g.status !== "playing")].map((g) => g.puzzleNumber),
  );
  const fresh = pickUnlimited(pool, played, today);
  if (fresh !== null) return fresh;
  const last = games.reduce<GameState | null>((a, g) => (!a || (g.finishedAt ?? 0) > (a.finishedAt ?? 0) ? g : a), null);
  deleteGames("free");
  return pickUnlimited(pool, new Set(last ? [last.puzzleNumber] : []), today);
}

export function Game({
  mode = "daily",
  reviewNumber,
  archiveNumber,
}: {
  mode?: "daily" | "unlimited" | "archive" | "review";
  /** Review mode only: the puzzle to play. */
  reviewNumber?: number;
  /** Archive mode only: the past daily puzzle to play. */
  archiveNumber?: number;
}) {
  const unlimited = mode === "unlimited";
  const archive = mode === "archive";
  /** Unlimited and archive games are for fun: no history, streak, stats or leaderboard. */
  const casual = unlimited || archive;
  const slot = unlimited ? "free" : "daily";
  /** Review mode plays any puzzle in memory only: nothing is saved, submitted or counted. */
  const review = mode === "review";
  const [reviewData, setReviewData] = useState<ReviewPuzzle | null>(null);
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const [game, setGame] = useState<GameState | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [tweetUrls, setTweetUrls] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [shake, setShake] = useState(0);
  const [checking, setChecking] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  /** Ask the server for the reveal; fall back to what the browser can work out. */
  const finish = useCallback(async (state: GameState, puzzle: PublicPuzzle, authors: Author[]) => {
    const n = state.puzzleNumber;
    const cached = readCachedResult(n, casual);
    if (cached) {
      setOutcome({ answer: cached.answer, stats: cached.stats });
      setTweetUrls(cached.tweetUrls);
      // Refresh the global numbers; the cached ones are fine if this fails.
      if (!unlimited) getStats(n)
        .then((stats) => setOutcome({ answer: cached.answer, stats }))
        .catch(() => {});
      return;
    }
    try {
      const result = await submitResult({
        puzzleNumber: n,
        guesses: state.guesses,
        durationMs: Math.max(0, (state.finishedAt ?? Date.now()) - state.startedAt),
        deviceId: getDeviceId(),
        ...(casual ? { casual: true } : {}),
      });
      cacheResult(n, casual, result);
      setOutcome({ answer: result.answer, stats: result.stats });
      setTweetUrls(result.tweetUrls);
    } catch {
      const [answerId, stats] = await Promise.all([
        findAnswerId(puzzle, authors).catch(() => null),
        getStats(n).catch(() => null),
      ]);
      // The server never counted this game, so add it to the bars ourselves.
      if (stats && !casual) {
        const bucket = state.status === "won" ? state.guesses.length - 1 : MAX_GUESSES;
        stats.distribution[bucket] += 1;
        stats.plays += 1;
      }
      setOutcome({ answer: authors.find((a) => a.id === answerId) ?? null, stats });
    }
  }, [casual, unlimited]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (review) {
          const [data, authors] = await Promise.all([getReviewPuzzle(reviewNumber ?? 0), getAuthors()]);
          if (cancelled) return;
          setReviewData(data);
          setGame(newGame(data.puzzle.number, Date.now()));
          setLoad({ phase: "ready", puzzle: data.puzzle, authors, initialVisible: 1 });
          return;
        }
        const today = puzzleNumberForDate(new Date());
        const n = unlimited ? await pickUnlimitedNumber() : archive ? (archiveNumber ?? 0) : today;
        if (cancelled) return;
        // The archive only holds days that are over; today's puzzle is played on the main page.
        if (n === null || n < 1 || (archive && n >= today)) throw new Error("not found");
        const [puzzle, authors] = await Promise.all([getPuzzle(n), getAuthors()]);
        if (cancelled) return;
        const saved = getGame(n, slot) ?? newGame(n, Date.now());
        setGame(saved);
        setLoad({ phase: "ready", puzzle, authors, initialVisible: tweetsVisible(saved) });
        if (saved.status !== "playing") {
          // Covers a tab closed between the last guess and the history write.
          if (!casual) {
            recordResult(toHistoryEntry(saved));
            bumpStorage();
          }
          void finish(saved, puzzle, authors);
        }
      } catch (e) {
        if (cancelled) return;
        // lib/api only surfaces a message, so a missing puzzle is spotted by its wording.
        const message = e instanceof Error ? e.message : "";
        setLoad({ phase: /404|not found|not available|no puzzle/i.test(message) ? "none" : "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt, finish, unlimited, archive, archiveNumber, casual, slot, review, reviewNumber]);

  // Bring the newest tweet into view after a wrong guess.
  const wrongCount = game && game.status === "playing" ? game.guesses.length : 0;
  useEffect(() => {
    if (wrongCount > 0) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [wrongCount]);

  if (load.phase === "loading") return <GameSkeleton />;

  if (load.phase === "error") {
    return (
      <Notice title="That didn't load" body="Check your connection and try again.">
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => {
            setLoad({ phase: "loading" });
            setAttempt((a) => a + 1);
          }}
        >
          Try again
        </button>
      </Notice>
    );
  }

  /** Unlimited mode: clear this round and load another puzzle. */
  function next() {
    setLoad({ phase: "loading" });
    setGame(null);
    setOutcome(null);
    setTweetUrls([]);
    setShake(0);
    setAttempt((a) => a + 1);
  }

  if (load.phase === "none" || !game) {
    return (
      archive ? (
        <Notice title="Not in the archive" body="A puzzle joins the archive the day after it runs.">
          <Link href="/archive" className="btn">
            Archive
          </Link>
        </Notice>
      ) : (
        <Notice title="No puzzle today" body="This one is not ready yet. Come back tomorrow.">
          <Countdown />
          <Link href="/" className="btn">
            Back home
          </Link>
        </Notice>
      )
    );
  }

  const { puzzle, authors, initialVisible } = load;
  const finished = game.status !== "playing";
  const visible = Math.min(tweetsVisible(game), puzzle.tweets.length);
  const unlocked = hintsUnlocked(game);
  const wrongIds = game.status === "won" ? game.guesses.slice(0, -1) : game.guesses;

  async function onGuess(author: Author) {
    if (!game || checking || game.status !== "playing") return;
    setChecking(true);
    try {
      const correct = await isCorrectGuess(puzzle, author.id);
      advance(applyGuess(game, author.id, correct, Date.now()));
    } finally {
      setChecking(false);
    }
  }

  function onSkip() {
    setConfirmSkip(false);
    if (!game || checking || game.status !== "playing") return;
    advance(applySkip(game));
  }

  /** Shared by guesses and skips: a skip is a wrong guess in every respect. */
  function advance(after: GameState) {
    if (!game || after === game) return;
    setGame(after);
    if (after.status === "playing") setShake((s) => s + 1);
    else topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

    if (review) {
      // In memory only: nothing saved, recorded or submitted.
      if (after.status !== "playing" && reviewData) {
        setOutcome({ answer: reviewData.answer, stats: null });
        setTweetUrls(reviewData.tweetUrls);
      }
      return;
    }
    saveGame(after, slot);
    if (after.status !== "playing") {
      if (!casual) recordResult(toHistoryEntry(after));
      void finish(after, puzzle, authors);
    }
    bumpStorage();
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div ref={topRef} className="flex scroll-mt-20 items-center justify-between gap-3">
        <span className="label">
          {review ? (
            <>
              <Link href="/review" className="link">Review</Link> · No. {puzzle.number} of {reviewData?.total}
            </>
          ) : unlimited ? (
            "Unlimited"
          ) : archive ? (
            <>
              <Link href="/archive" className="link">Archive</Link> · No. {puzzle.number} ·{" "}
              {dayFormat.format(dateForPuzzleNumber(puzzle.number))}
            </>
          ) : (
            `No. ${puzzle.number}`
          )}
        </span>
        <GuessPips game={game} />
      </div>

      {finished ? (
        <>
          <ResultPanel
            game={game}
            outcome={outcome}
            onNext={unlimited ? next : undefined}
            archive={archive}
            review={review && reviewData ? { next: reviewData.next } : undefined}
          />
          {review && reviewData && <ReviewRater data={reviewData} game={game} />}
        </>
      ) : (
        <div>
          <h1 className="font-display text-[2rem] font-bold leading-tight tracking-tight">Who tweeted this?</h1>
          {game.guesses.length === 0 && (
            <p className="mt-1 text-sm text-muted">
              One person wrote all five tweets. A wrong guess shows the next tweet and a clue.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 border-y border-ink py-4">
        {puzzle.tweets.slice(0, visible).map((tweet, i) => (
          <TweetCard
            key={i}
            tweet={review && finished && reviewData ? { ...tweet, text: reviewData.fullTexts[i] } : tweet}
            index={i}
            url={finished ? tweetUrls[i] : undefined}
            animate={!finished && i >= initialVisible}
          />
        ))}
      </div>

      <HintChips hints={puzzle.hints} unlocked={unlocked} />

      <GuessList ids={wrongIds} authors={authors} />

      <div ref={bottomRef} className="scroll-mb-28" />

      {!finished && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-auto border-t border-line bg-bg px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {/* The key restarts the shake animation on every wrong guess. */}
          <div key={shake} className={shake > 0 ? "animate-shake" : ""}>
            <GuessInput
              authors={authors}
              excludeIds={game.guesses}
              disabled={checking}
              onGuess={(a) => {
                setConfirmSkip(false);
                void onGuess(a);
              }}
            />
          </div>
          <div className="mt-2 flex min-h-7 items-center justify-center gap-3 text-sm">
            {confirmSkip ? (
              <>
                <span className="text-muted">
                  {game.guesses.length + 1 >= MAX_GUESSES
                    ? "This is your last guess. Skip and give up?"
                    : "Skip? It uses up one of your 5 guesses."}
                </span>
                <button type="button" className="link font-semibold text-bad" onClick={onSkip} autoFocus>
                  {game.guesses.length + 1 >= MAX_GUESSES ? "Give up" : "Yes, skip"}
                </button>
                <button type="button" className="link" onClick={() => setConfirmSkip(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="link text-muted"
                disabled={checking}
                onClick={() => setConfirmSkip(true)}
              >
                {game.guesses.length + 1 >= MAX_GUESSES ? "Give up" : "Skip to the next tweet"}
              </button>
            )}
          </div>
          <p className="sr-only" aria-live="assertive">
            {shake > 0 ? `Wrong. ${wrongIds.length} of ${MAX_GUESSES} guesses used. New tweet revealed.` : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function Notice({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card mt-6 flex flex-col items-center gap-4 p-6 text-center">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <p className="text-muted">{body}</p>
      {children}
    </div>
  );
}

function GameSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading today's puzzle">
      <div className="flex justify-between">
        <div className="skeleton h-7 w-44" />
        <div className="skeleton h-7 w-32" />
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-8 w-20" />
        ))}
      </div>
      <div className="skeleton h-36" />
      <div className="skeleton h-12" />
    </div>
  );
}

import { HINT_SCHEDULE, MAX_GUESSES, SKIP_PREFIX, TWEETS_PER_PUZZLE, type HintKind } from "../constants";
import type { GameState, HistoryEntry } from "../types";
import { scoreFor } from "./score";

export function newGame(puzzleNumber: number, now: number): GameState {
  return { puzzleNumber, guesses: [], status: "playing", startedAt: now };
}

/**
 * Returns a new state with the guess applied. Returns the same state object
 * (no-op) when the game is finished or the author was already guessed.
 */
export function applyGuess(
  state: GameState,
  authorId: string,
  isCorrect: boolean,
  now: number,
): GameState {
  if (state.status !== "playing") return state;
  if (!authorId || state.guesses.includes(authorId)) return state;
  if (state.guesses.length >= MAX_GUESSES) return state;

  const guesses = [...state.guesses, authorId];
  if (isCorrect) return { ...state, guesses, status: "won", finishedAt: now };
  if (guesses.length >= MAX_GUESSES) return { ...state, guesses, status: "lost", finishedAt: now };
  return { ...state, guesses };
}

/** Skips the current tweet: uses up a guess exactly like a wrong one. */
export function applySkip(state: GameState, now: number = Date.now()): GameState {
  const skips = state.guesses.filter((g) => g.startsWith(SKIP_PREFIX)).length;
  return applyGuess(state, `${SKIP_PREFIX}${skips + 1}`, false, now);
}

export function wrongGuessCount(state: GameState): number {
  return state.status === "won" ? state.guesses.length - 1 : state.guesses.length;
}

/** Tweets on screen: one to start, one more per wrong guess, all once finished. */
export function tweetsVisible(state: GameState): number {
  if (state.status !== "playing") return TWEETS_PER_PUZZLE;
  return Math.min(wrongGuessCount(state) + 1, TWEETS_PER_PUZZLE);
}

/** Hints unlocked so far, in schedule order. All of them once finished. */
export function hintsUnlocked(state: GameState): HintKind[] {
  if (state.status !== "playing") return [...HINT_SCHEDULE];
  return HINT_SCHEDULE.slice(0, Math.min(wrongGuessCount(state), HINT_SCHEDULE.length));
}

/** Only valid for finished games. */
export function toHistoryEntry(state: GameState): HistoryEntry {
  if (state.status === "playing") {
    throw new Error("toHistoryEntry: game is not finished");
  }
  const solved = state.status === "won";
  const guessesUsed = solved ? state.guesses.length : MAX_GUESSES;
  return {
    puzzleNumber: state.puzzleNumber,
    guessesUsed,
    solved,
    score: scoreFor(guessesUsed, solved),
  };
}

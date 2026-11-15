/**
 * Shared contract for Tweetdle. Every workstream builds against these types.
 * Change them only with care: engine, UI, API routes and content scripts all depend on them.
 */

export const CATEGORIES = [
  "Politics",
  "Music",
  "Sports",
  "Tech",
  "Film & TV",
  "Media",
  "Internet",
  "Business",
  "Science",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** A guessable person. The full list is public and shipped to the browser. */
export interface Author {
  /** Stable kebab-case id, e.g. "barack-obama". */
  id: string;
  name: string;
  /** Extra search terms: handle without @, nicknames, alternate spellings. */
  aliases: string[];
  category: Category;
  /** Short spoiler-free description, e.g. "American rapper". */
  descriptor: string;
  /** e.g. "B.O." */
  initials: string;
}

/**
 * A tweet as stored privately. Giveaway spans in `text` are wrapped in
 * double square brackets, e.g. "Proud to announce [[Tesla]] is ...".
 */
export interface Tweet {
  text: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Link to the original post. */
  url: string;
}

/** Private puzzle: contains the answer. Never committed, never sent to the browser as-is. */
export interface Puzzle {
  /** 1-based day number. */
  number: number;
  authorId: string;
  /** Exactly 5 tweets, ordered most obscure first, most iconic last. */
  tweets: Tweet[];
}

/** Tweet as sent to the browser: bracketed spans replaced by REDACTED_TOKEN, no url. */
export interface PublicTweet {
  text: string;
  date: string;
}

/** What GET /api/puzzle/[n] returns. Safe to cache publicly. */
export interface PublicPuzzle {
  number: number;
  tweets: PublicTweet[];
  hints: {
    category: Category;
    descriptor: string;
    initials: string;
  };
  /** Used with answerHash: sha256Hex(`${salt}:${authorId}`). */
  salt: string;
  answerHash: string;
}

export type GameStatus = "playing" | "won" | "lost";

/** One day's game, persisted in localStorage. */
export interface GameState {
  puzzleNumber: number;
  /** Author ids guessed so far, in order. */
  guesses: string[];
  status: GameStatus;
  /** Epoch ms. */
  startedAt: number;
  finishedAt?: number;
}

/** One finished day in the player's history. */
export interface HistoryEntry {
  puzzleNumber: number;
  /** 1-5. Equals MAX_GUESSES when lost. */
  guessesUsed: number;
  solved: boolean;
  score: number;
}

export interface PlayerStats {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  /** Index 0-4 = solved on guess 1-5, index 5 = missed. */
  distribution: [number, number, number, number, number, number];
  totalScore: number;
}

/** Body of POST /api/result. */
export interface ResultPayload {
  puzzleNumber: number;
  guesses: string[];
  durationMs: number;
  /** Random id generated once per browser. */
  deviceId: string;
}

export interface DailyStats {
  puzzleNumber: number;
  plays: number;
  /** Index 0-4 = solved on guess 1-5, index 5 = missed. */
  distribution: [number, number, number, number, number, number];
}

/** Response of POST /api/result. */
export interface ResultResponse {
  solved: boolean;
  score: number;
  answer: Author;
  /** Original post links, same order as the puzzle's tweets. */
  tweetUrls: string[];
  stats: DailyStats;
}

export type LeaderboardKind = "today" | "alltime" | "streak";

export interface LeaderboardRow {
  rank: number;
  displayName: string;
  /** today: day score. alltime: total score. streak: current streak length. */
  value: number;
  /** today only. */
  guessesUsed?: number;
  /** today only. */
  durationMs?: number;
  /** True for the signed-in player's own row. */
  isYou?: boolean;
}

export interface SessionUser {
  id: string;
  displayName: string;
  email?: string;
}

/** Response of POST /api/sync. Server history after merging the guest history. */
export interface SyncResponse {
  history: HistoryEntry[];
}

export interface ApiError {
  error: string;
}

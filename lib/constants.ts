export const MAX_GUESSES = 5;
export const TWEETS_PER_PUZZLE = 5;

/** Points for solving on guess 1..5. A miss scores 0. */
export const SCORE_TABLE = [100, 80, 60, 40, 20] as const;

/** Rendered by the UI as a blurred block. */
export const REDACTED_TOKEN = "█████";

/**
 * Hints unlocked after N wrong guesses (cumulative). Tweet dates always show.
 * After each wrong guess the next tweet is also revealed; the last wrong
 * guess reveals only the final tweet.
 */
export const HINT_SCHEDULE = ["category", "descriptor", "initials"] as const;
export type HintKind = (typeof HINT_SCHEDULE)[number];

/** Puzzle #1 is played on this local date (YYYY-MM-DD). */
export const LAUNCH_DATE = process.env.NEXT_PUBLIC_LAUNCH_DATE || "2026-11-15";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const SITE_NAME = "Tweetdle";

/**
 * Unlimited mode draws from a separate pool: puzzles numbered above this.
 * They are never a daily puzzle and never count for streaks or leaderboards.
 */
export const PRACTICE_BASE = 100_000;
export const isPracticeNumber = (n: number) => n > PRACTICE_BASE;

export const STORAGE_KEY = "tweetdle:v1";

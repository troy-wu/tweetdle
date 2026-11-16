import { LAUNCH_DATE, PRACTICE_BASE } from "../constants";

const DAY_MS = 86_400_000;
/** UTC+14 (Line Islands) is the furthest-ahead timezone on Earth. */
const MAX_UTC_OFFSET_MS = 14 * 60 * 60 * 1000;

/** Calendar day as a day count, independent of timezone and DST. */
function dayIndex(year: number, monthIndex: number, day: number): number {
  return Math.round(Date.UTC(year, monthIndex, day) / DAY_MS);
}

function launchDayIndex(launchDate: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(launchDate);
  if (!m) throw new Error(`Invalid launch date: ${launchDate}`);
  return dayIndex(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Puzzle number for the LOCAL calendar date of `date`. Launch day is puzzle 1. */
export function puzzleNumberForDate(date: Date, launchDate: string = LAUNCH_DATE): number {
  const today = dayIndex(date.getFullYear(), date.getMonth(), date.getDate());
  return today - launchDayIndex(launchDate) + 1;
}

/** The local calendar date on which a daily puzzle runs. */
export function dateForPuzzleNumber(n: number, launchDate: string = LAUNCH_DATE): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(launchDate);
  if (!m) throw new Error(`Invalid launch date: ${launchDate}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n - 1);
}

/**
 * Unlimited mode: which puzzle to serve next from the whole bank, or null when
 * everything has been played. Puzzles that cannot spoil a daily come first
 * (unlimited-only ones and past dailies, at random); upcoming dailies are used
 * last, furthest away first.
 */
export function pickUnlimited(
  pool: readonly number[],
  played: ReadonlySet<number>,
  today: number,
  random: () => number = Math.random,
): number | null {
  const fresh = pool.filter((n) => n !== today && !played.has(n));
  if (fresh.length === 0) return null;
  const safe = fresh.filter((n) => n > PRACTICE_BASE || n < today);
  if (safe.length) return safe[Math.floor(random() * safe.length)];
  return Math.max(...fresh);
}

/** Highest puzzle number any player on Earth can legitimately be on right now. */
export function maxValidPuzzleNumber(nowMs: number, launchDate: string = LAUNCH_DATE): number {
  const d = new Date(nowMs + MAX_UTC_OFFSET_MS);
  const today = dayIndex(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return today - launchDayIndex(launchDate) + 1;
}

/** Milliseconds until the next local midnight. */
export function msUntilNextPuzzle(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

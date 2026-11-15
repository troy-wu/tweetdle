import { LAUNCH_DATE } from "../constants";

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

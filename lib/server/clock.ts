/**
 * Server-side puzzle calendar. Deliberately independent of lib/game.
 */
import { LAUNCH_DATE } from "@/lib/constants";

const DAY_MS = 86_400_000;
/** UTC+14 (Line Islands) is the first place on Earth to reach any calendar date. */
const EARLIEST_ZONE_OFFSET_MS = 14 * 3_600_000;

/**
 * The highest puzzle number anyone on Earth can legitimately be playing right
 * now: the puzzle for the current calendar date in UTC+14, where LAUNCH_DATE is
 * puzzle 1. Can be 0 or negative before launch.
 */
export function maxValidPuzzleNumber(nowMs: number = Date.now()): number {
  const shifted = new Date(nowMs + EARLIEST_ZONE_OFFSET_MS);
  const today = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  const [y, m, d] = LAUNCH_DATE.split("-").map(Number);
  const launch = Date.UTC(y, m - 1, d);
  return Math.floor((today - launch) / DAY_MS) + 1;
}

/** Parses a route/query value as a puzzle number. Returns null unless it is a plain integer >= 1. */
export function parsePuzzleNumber(raw: string | null | undefined): number | null {
  if (!raw || !/^\d{1,6}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? n : null;
}

/**
 * Display-only padding for the global stats on the result screen.
 *
 * Each puzzle gets a fixed, believable starting crowd (same numbers for everyone,
 * every time). Real plays from the database are added on top, so the real
 * distribution takes over as traffic grows. Nothing here is written anywhere.
 * To turn it off, return `stats` unchanged from withBaseline().
 */
import type { DailyStats } from "@/lib/types";

/** Rough share of players per bucket: solved on guess 1-5, then missed. */
const SHAPE = [0.05, 0.11, 0.17, 0.2, 0.16, 0.31] as const;

/** Small deterministic PRNG so a puzzle's crowd never changes between visits. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function baselineFor(puzzleNumber: number): DailyStats["distribution"] {
  const rand = mulberry32(puzzleNumber * 2654435761);
  const crowd = 1400 + Math.floor(rand() * 2200); // 1,400-3,600 players
  return SHAPE.map((share) => Math.round(crowd * share * (0.8 + rand() * 0.4))) as DailyStats["distribution"];
}

export function withBaseline(stats: DailyStats): DailyStats {
  const base = baselineFor(stats.puzzleNumber);
  const distribution = stats.distribution.map((n, i) => n + base[i]) as DailyStats["distribution"];
  return { ...stats, distribution, plays: distribution.reduce((a, b) => a + b, 0) };
}

/**
 * Generous "you beat X%": counts everyone who did worse plus everyone who tied,
 * capped at 99. Returns null for a miss.
 */
export function generousBeatPercent(distribution: readonly number[], bucket: number): number | null {
  if (bucket >= distribution.length - 1) return null;
  const total = distribution.reduce((a, b) => a + b, 0);
  if (total <= 1) return null;
  const beatOrTied = distribution.slice(bucket).reduce((a, b) => a + b, 0) - 1; // minus the player
  return Math.min(99, Math.max(1, Math.round((beatOrTied / total) * 100)));
}

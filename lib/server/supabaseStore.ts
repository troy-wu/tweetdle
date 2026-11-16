/**
 * Supabase implementation of the Store. Uses the service-role client, which
 * bypasses RLS: server only. See supabase/migrations/0001_init.sql for the
 * tables and functions this talks to.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Author, DailyStats, HistoryEntry, Puzzle } from "@/lib/types";
import type { LeaderboardEntry, Store } from "./store";

const CONTENT_TTL_MS = 5 * 60_000;

interface StatsRow {
  puzzle_number?: number;
  plays: number;
  d1: number;
  d2: number;
  d3: number;
  d4: number;
  d5: number;
  dmiss: number;
}

const toStats = (n: number, r: StatsRow | null | undefined): DailyStats => ({
  puzzleNumber: n,
  plays: r?.plays ?? 0,
  distribution: [r?.d1 ?? 0, r?.d2 ?? 0, r?.d3 ?? 0, r?.d4 ?? 0, r?.d5 ?? 0, r?.dmiss ?? 0],
});

function check<T>(label: string, res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`supabase ${label}: ${res.error.message}`);
  return res.data;
}

export function createSupabaseStore(db: SupabaseClient): Store {
  let authorsCache: { at: number; value: Author[] } | null = null;
  let practiceCache: { at: number; value: number[] } | null = null;
  const puzzleCache = new Map<number, { at: number; value: Puzzle }>();

  return {
    kind: "supabase",

    async getAuthors() {
      if (authorsCache && Date.now() - authorsCache.at < CONTENT_TTL_MS) return authorsCache.value;
      const rows = check(
        "authors",
        await db.from("authors").select("id,name,aliases,category,descriptor,initials").order("name").limit(5000),
      );
      const value = (rows ?? []) as Author[];
      authorsCache = { at: Date.now(), value };
      return value;
    },

    async getPuzzle(n) {
      const hit = puzzleCache.get(n);
      if (hit && Date.now() - hit.at < CONTENT_TTL_MS) return hit.value;
      const row = check(
        "puzzle",
        await db.from("puzzles").select("number,author_id,tweets").eq("number", n).maybeSingle(),
      ) as { number: number; author_id: string; tweets: Puzzle["tweets"] } | null;
      if (!row) return null;
      const value: Puzzle = { number: row.number, authorId: row.author_id, tweets: row.tweets };
      if (puzzleCache.size > 200) puzzleCache.clear();
      puzzleCache.set(n, { at: Date.now(), value });
      return value;
    },

    async getPuzzleNumbers() {
      if (practiceCache && Date.now() - practiceCache.at < CONTENT_TTL_MS) return practiceCache.value;
      const rows = check(
        "puzzle numbers",
        await db.from("puzzles").select("number").order("number").limit(10000),
      ) as { number: number }[] | null;
      const value = (rows ?? []).map((r) => r.number);
      practiceCache = { at: Date.now(), value };
      return value;
    },

    async getStats(n) {
      const row = check(
        "daily_stats",
        await db.from("daily_stats").select("plays,d1,d2,d3,d4,d5,dmiss").eq("puzzle_number", n).maybeSingle(),
      ) as StatsRow | null;
      return toStats(n, row);
    },

    async submitPlay({ puzzleNumber, deviceHash, bucket, userId, durationMs }) {
      const data = check(
        "record_play",
        await db.rpc("record_play", {
          p_puzzle_number: puzzleNumber,
          p_device_hash: deviceHash,
          p_bucket: bucket,
          p_user_id: userId,
          p_duration_ms: durationMs,
        }),
      ) as (StatsRow & { bucket: number })[] | (StatsRow & { bucket: number }) | null;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("supabase record_play: no row returned");
      return { bucket: row.bucket, stats: toStats(puzzleNumber, row) };
    },

    async getUserHistory(userId) {
      const rows = check(
        "results",
        await db
          .from("results")
          .select("puzzle_number,guesses_used,solved,score")
          .eq("user_id", userId)
          .order("puzzle_number")
          .limit(10000),
      ) as { puzzle_number: number; guesses_used: number; solved: boolean; score: number }[] | null;
      return (rows ?? []).map(
        (r): HistoryEntry => ({
          puzzleNumber: r.puzzle_number,
          guessesUsed: r.guesses_used,
          solved: r.solved,
          score: r.score,
        }),
      );
    },

    async importHistory(userId, entries) {
      if (entries.length === 0) return;
      // results.user_id references profiles; make sure the row exists even if
      // the sign-up trigger was not in place when this user was created.
      check("ensure_profile", await db.rpc("ensure_profile", { p_user_id: userId }));
      check(
        "import results",
        await db.from("results").upsert(
          entries.map((e) => ({
            user_id: userId,
            puzzle_number: e.puzzleNumber,
            guesses_used: e.guessesUsed,
            solved: e.solved,
            score: e.score,
            duration_ms: null,
            imported: true,
          })),
          { onConflict: "user_id,puzzle_number", ignoreDuplicates: true },
        ),
      );
    },

    async getLeaderboard(kind, puzzleNumber) {
      const call =
        kind === "today"
          ? db.rpc("leaderboard_today", { p_puzzle_number: puzzleNumber, p_limit: 100 })
          : kind === "alltime"
            ? db.rpc("leaderboard_alltime", { p_limit: 100 })
            : db.rpc("leaderboard_streak", { p_puzzle_number: puzzleNumber, p_limit: 100 });
      const rows = check(`leaderboard_${kind}`, await call) as
        | { user_id: string; display_name: string; value: number; guesses_used?: number; duration_ms?: number | null }[]
        | null;
      return (rows ?? []).map((r): LeaderboardEntry => {
        const entry: LeaderboardEntry = { userId: r.user_id, displayName: r.display_name, value: r.value };
        if (kind === "today") {
          entry.guessesUsed = r.guesses_used;
          if (r.duration_ms != null) entry.durationMs = r.duration_ms;
        }
        return entry;
      });
    },

    async ping() {
      check("ping", await db.from("authors").select("id").limit(1));
    },
  };
}

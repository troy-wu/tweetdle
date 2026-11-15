/**
 * Data layer. One interface, two implementations picked at runtime:
 *  - memory: no Supabase needed. Content from JSON files, stats/results in process memory.
 *  - supabase: service-role client (see supabaseStore.ts).
 * Server only. Never import this from client components.
 */
import fs from "node:fs";
import path from "node:path";
import fixtureAuthors from "@/content/fixtures/authors.json";
import fixturePuzzles from "@/content/fixtures/puzzles.json";
import { getAdminClient } from "@/lib/supabase/admin";
import { isPracticeNumber } from "@/lib/constants";
import type { Author, DailyStats, HistoryEntry, LeaderboardKind, Puzzle } from "@/lib/types";
import { bucketToOutcome, outcomeToBucket } from "./puzzle";
import { createSupabaseStore } from "./supabaseStore";

export interface PlaySubmission {
  puzzleNumber: number;
  /** Keyed hash of the device id, never the raw id. */
  deviceHash: string;
  /** 0-4 = solved on guess 1-5, 5 = missed. Already verified by the server. */
  bucket: number;
  /** Signed-in user, if any. */
  userId: string | null;
  durationMs: number;
}

export interface PlayOutcome {
  /** The outcome on record: the first submission from this user/device wins. */
  bucket: number;
  stats: DailyStats;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  value: number;
  guessesUsed?: number;
  durationMs?: number;
}

export interface Store {
  readonly kind: "memory" | "supabase";
  getAuthors(): Promise<Author[]>;
  getPuzzle(n: number): Promise<Puzzle | null>;
  /** Numbers of the unlimited-mode puzzles (see PRACTICE_BASE), ascending. */
  getPracticeNumbers(): Promise<number[]>;
  getStats(n: number): Promise<DailyStats>;
  /**
   * Atomically: count the play in the day's distribution once per device, and
   * store the signed-in user's result row (first submission wins). Idempotent.
   */
  submitPlay(play: PlaySubmission): Promise<PlayOutcome>;
  getUserHistory(userId: string): Promise<HistoryEntry[]>;
  /** Inserts entries the user has no row for, flagged as imported. Does not touch daily stats. */
  importHistory(userId: string, entries: HistoryEntry[]): Promise<void>;
  getLeaderboard(kind: LeaderboardKind, puzzleNumber: number): Promise<LeaderboardEntry[]>;
  /** Trivial query, used by the keep-alive cron. */
  ping(): Promise<void>;
}

export function emptyStats(puzzleNumber: number): DailyStats {
  return { puzzleNumber, plays: 0, distribution: [0, 0, 0, 0, 0, 0] };
}

/* ------------------------------ memory store ------------------------------ */

export interface MemoryContent {
  authors: Author[];
  puzzles: Puzzle[];
}

export function fixtureContent(): MemoryContent {
  return { authors: fixtureAuthors as Author[], puzzles: fixturePuzzles as Puzzle[] };
}

/**
 * Real content when BOTH content/authors.json and content/private/puzzles.json
 * exist (they only make sense as a pair: puzzle answers must be in the author
 * list). Otherwise the committed fixtures.
 */
export function loadLocalContent(root: string = process.cwd()): MemoryContent {
  const authorsFile = path.join(root, "content", "authors.json");
  const puzzlesFile = path.join(root, "content", "private", "puzzles.json");
  // TWEETDLE_FIXTURES=1 forces the sample data (used by the end-to-end tests).
  if (process.env.TWEETDLE_FIXTURES === "1") return fixtureContent();
  try {
    if (fs.existsSync(authorsFile) && fs.existsSync(puzzlesFile)) {
      const authors = JSON.parse(fs.readFileSync(authorsFile, "utf8")) as Author[];
      const puzzles = JSON.parse(fs.readFileSync(puzzlesFile, "utf8")) as Puzzle[];
      if (Array.isArray(authors) && Array.isArray(puzzles) && authors.length > 0 && puzzles.length > 0) {
        return { authors, puzzles };
      }
    }
  } catch (err) {
    console.warn("[store] could not read content/*.json, using fixtures:", err);
  }
  return fixtureContent();
}

interface MemoryResult extends HistoryEntry {
  durationMs: number | null;
  imported: boolean;
}

export function createMemoryStore(content: MemoryContent = loadLocalContent()): Store {
  const puzzles = new Map(content.puzzles.map((p) => [p.number, p]));
  const stats = new Map<number, DailyStats>();
  const devicePlays = new Map<string, number>(); // `${n}:${deviceHash}` -> bucket
  const results = new Map<string, Map<number, MemoryResult>>(); // userId -> puzzle -> row

  const copy = (s: DailyStats): DailyStats => ({ ...s, distribution: [...s.distribution] });

  return {
    kind: "memory",
    async getAuthors() {
      return content.authors;
    },
    async getPuzzle(n) {
      return puzzles.get(n) ?? null;
    },
    async getPracticeNumbers() {
      return [...puzzles.keys()].filter(isPracticeNumber).sort((a, b) => a - b);
    },
    async getStats(n) {
      return copy(stats.get(n) ?? emptyStats(n));
    },
    async submitPlay({ puzzleNumber: n, deviceHash, bucket, userId, durationMs }) {
      const current = () => copy(stats.get(n) ?? emptyStats(n));

      const existing = userId ? results.get(userId)?.get(n) : undefined;
      if (existing) {
        return { bucket: outcomeToBucket(existing.solved, existing.guessesUsed), stats: current() };
      }

      const key = `${n}:${deviceHash}`;
      const priorBucket = devicePlays.get(key);
      if (priorBucket === undefined) {
        devicePlays.set(key, bucket);
        const s = stats.get(n) ?? emptyStats(n);
        s.plays += 1;
        s.distribution[bucket] += 1;
        stats.set(n, s);
      } else if (!userId) {
        // Guest repeat from the same device: the first submission stands.
        bucket = priorBucket;
      }

      if (userId) {
        const { solved, score, guessesUsed } = bucketToOutcome(bucket);
        const rows = results.get(userId) ?? new Map<number, MemoryResult>();
        rows.set(n, { puzzleNumber: n, guessesUsed, solved, score, durationMs, imported: false });
        results.set(userId, rows);
      }
      return { bucket, stats: current() };
    },
    async getUserHistory(userId) {
      return [...(results.get(userId)?.values() ?? [])]
        .sort((a, b) => a.puzzleNumber - b.puzzleNumber)
        .map(({ puzzleNumber, guessesUsed, solved, score }) => ({ puzzleNumber, guessesUsed, solved, score }));
    },
    async importHistory(userId, entries) {
      const rows = results.get(userId) ?? new Map<number, MemoryResult>();
      for (const e of entries) {
        if (!rows.has(e.puzzleNumber)) rows.set(e.puzzleNumber, { ...e, durationMs: null, imported: true });
      }
      results.set(userId, rows);
    },
    async getLeaderboard() {
      // No accounts without Supabase, so there is nobody to rank.
      return [];
    },
    async ping() {},
  };
}

/* -------------------------------- selection ------------------------------- */

// Kept on globalThis so every route bundle (and dev hot reloads) share one
// instance; otherwise the memory store's counters would be split per route.
const globalStore = globalThis as typeof globalThis & { __tweetdleStore?: Store };

export function getStore(): Store {
  if (!globalStore.__tweetdleStore) {
    const admin = getAdminClient();
    globalStore.__tweetdleStore = admin ? createSupabaseStore(admin) : createMemoryStore();
  }
  return globalStore.__tweetdleStore;
}

/** Tests: inject a store (or pass null to reset to runtime selection). */
export function setStore(store: Store | null): void {
  globalStore.__tweetdleStore = store ?? undefined;
}

import { MAX_GUESSES, STORAGE_KEY } from "../constants";
import type { GameState, HistoryEntry, PlayerStats } from "../types";

const VERSION = 1;

interface StoredData {
  v: number;
  deviceId?: string;
  games: Record<string, GameState>;
  history: HistoryEntry[];
}

/* ---------- pure logic (no localStorage) ---------- */

function isHistoryEntry(x: unknown): x is HistoryEntry {
  if (!x || typeof x !== "object") return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.puzzleNumber === "number" &&
    Number.isInteger(e.puzzleNumber) &&
    typeof e.guessesUsed === "number" &&
    typeof e.solved === "boolean" &&
    typeof e.score === "number"
  );
}

function isGameState(x: unknown): x is GameState {
  if (!x || typeof x !== "object") return false;
  const g = x as Record<string, unknown>;
  return (
    typeof g.puzzleNumber === "number" &&
    Array.isArray(g.guesses) &&
    g.guesses.every((id) => typeof id === "string") &&
    (g.status === "playing" || g.status === "won" || g.status === "lost") &&
    typeof g.startedAt === "number" &&
    (g.finishedAt === undefined || typeof g.finishedAt === "number")
  );
}

/** Sorted by puzzleNumber, one entry per puzzle (first occurrence wins). */
export function normalizeHistory(history: HistoryEntry[]): HistoryEntry[] {
  const byNumber = new Map<number, HistoryEntry>();
  for (const e of history) {
    if (isHistoryEntry(e) && !byNumber.has(e.puzzleNumber)) byNumber.set(e.puzzleNumber, e);
  }
  return [...byNumber.values()].sort((a, b) => a.puzzleNumber - b.puzzleNumber);
}

/** Adds a result unless that puzzle already has one (first result wins). */
export function addResult(history: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return normalizeHistory([...history, entry]);
}

/** Union by puzzleNumber; the server entry wins on conflict. */
export function mergeHistories(local: HistoryEntry[], server: HistoryEntry[]): HistoryEntry[] {
  return normalizeHistory([...server, ...local]);
}

/**
 * A streak is a run of consecutive puzzle numbers that were all solved.
 * The current streak is alive if its last puzzle is today's or yesterday's.
 */
export function computeStats(history: HistoryEntry[], todayNumber: number): PlayerStats {
  const sorted = normalizeHistory(history);
  const distribution: PlayerStats["distribution"] = [0, 0, 0, 0, 0, 0];
  let wins = 0;
  let totalScore = 0;
  let maxStreak = 0;
  let run = 0;
  let prev: number | null = null;

  for (const e of sorted) {
    totalScore += e.score;
    if (e.solved) {
      wins++;
      const slot = Math.min(Math.max(Math.round(e.guessesUsed), 1), MAX_GUESSES) - 1;
      distribution[slot]++;
      run = prev !== null && e.puzzleNumber === prev + 1 ? run + 1 : 1;
      if (run > maxStreak) maxStreak = run;
    } else {
      distribution[5]++;
      run = 0;
    }
    prev = e.puzzleNumber;
  }

  // `run` is the streak ending at the latest entry (0 if that was a miss).
  const alive = prev !== null && prev >= todayNumber - 1;
  return {
    played: sorted.length,
    wins,
    currentStreak: alive ? run : 0,
    maxStreak,
    distribution,
    totalScore,
  };
}

/* ---------- localStorage wrapper ---------- */

function emptyData(): StoredData {
  return { v: VERSION, games: {}, history: [] };
}

/** Never throws: returns null in Node/SSR or when storage is blocked. */
function getStorage(): Storage | null {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}

/** Parses stored JSON, discarding anything malformed. Exported for tests. */
export function parseStored(raw: string | null | undefined): StoredData {
  if (!raw) return emptyData();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyData();
    const p = parsed as Record<string, unknown>;
    if (p.v !== VERSION) return emptyData();
    const data = emptyData();
    if (typeof p.deviceId === "string" && p.deviceId) data.deviceId = p.deviceId;
    if (p.games && typeof p.games === "object") {
      for (const [key, g] of Object.entries(p.games as Record<string, unknown>)) {
        if (isGameState(g)) data.games[key] = g;
      }
    }
    if (Array.isArray(p.history)) data.history = normalizeHistory(p.history as HistoryEntry[]);
    return data;
  } catch {
    return emptyData();
  }
}

function load(): StoredData {
  const ls = getStorage();
  if (!ls) return emptyData();
  try {
    return parseStored(ls.getItem(STORAGE_KEY));
  } catch {
    return emptyData();
  }
}

function save(data: StoredData): void {
  const ls = getStorage();
  if (!ls) return;
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Quota exceeded or storage disabled: the game still works for this session.
  }
}

function randomId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Used when storage is unavailable so the id is at least stable for the session. */
let memoryDeviceId: string | null = null;

/** Random uuid created once per browser. */
export function getDeviceId(): string {
  const data = load();
  if (data.deviceId) return data.deviceId;
  const id = memoryDeviceId ?? randomId();
  memoryDeviceId = id;
  data.deviceId = id;
  save(data);
  return id;
}

export function getGame(puzzleNumber: number): GameState | null {
  const g = load().games[String(puzzleNumber)];
  return g && g.puzzleNumber === puzzleNumber ? g : null;
}

/** Every saved game whose number passes the filter, e.g. the unlimited-mode ones. */
export function listGames(filter: (puzzleNumber: number) => boolean): GameState[] {
  return Object.values(load().games).filter((g) => filter(g.puzzleNumber));
}

export function deleteGames(filter: (puzzleNumber: number) => boolean): void {
  const data = load();
  for (const key of Object.keys(data.games)) {
    if (filter(data.games[key].puzzleNumber)) delete data.games[key];
  }
  save(data);
}

export function saveGame(state: GameState): void {
  const data = load();
  data.games[String(state.puzzleNumber)] = state;
  save(data);
}

export function getHistory(): HistoryEntry[] {
  return load().history;
}

/** Idempotent per puzzleNumber: the first result recorded wins. */
export function recordResult(entry: HistoryEntry): void {
  const data = load();
  data.history = addResult(data.history, entry);
  save(data);
}

/** Merges server history into local (server wins), saves and returns the result. */
export function mergeHistory(serverHistory: HistoryEntry[]): HistoryEntry[] {
  const data = load();
  data.history = mergeHistories(data.history, serverHistory);
  save(data);
  return data.history;
}

export function clearAll(): void {
  memoryDeviceId = null;
  const ls = getStorage();
  if (!ls) return;
  try {
    ls.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

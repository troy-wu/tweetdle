import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY } from "../constants";
import type { GameState, HistoryEntry } from "../types";
import { applyGuess, newGame } from "./engine";
import {
  addResult,
  clearAll,
  computeStats,
  getDeviceId,
  getGame,
  getHistory,
  mergeHistories,
  mergeHistory,
  recordResult,
  saveGame,
} from "./storage";

const SCORES = [100, 80, 60, 40, 20];
const win = (puzzleNumber: number, guessesUsed = 1): HistoryEntry => ({
  puzzleNumber,
  guessesUsed,
  solved: true,
  score: SCORES[guessesUsed - 1],
});
const miss = (puzzleNumber: number): HistoryEntry => ({
  puzzleNumber,
  guessesUsed: 5,
  solved: false,
  score: 0,
});

function installMemoryStorage(): Map<string, string> {
  const map = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", { value: ls, configurable: true, writable: true });
  return map;
}
function removeStorage() {
  Object.defineProperty(globalThis, "localStorage", {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

describe("computeStats (pure)", () => {
  it("handles empty history", () => {
    expect(computeStats([], 10)).toEqual({
      played: 0,
      wins: 0,
      currentStreak: 0,
      maxStreak: 0,
      distribution: [0, 0, 0, 0, 0, 0],
      totalScore: 0,
    });
  });

  it("counts played, wins, distribution and total score", () => {
    const s = computeStats([win(1, 1), win(2, 3), miss(3), win(4, 3), win(5, 5)], 5);
    expect(s.played).toBe(5);
    expect(s.wins).toBe(4);
    expect(s.distribution).toEqual([1, 0, 2, 0, 1, 1]);
    expect(s.totalScore).toBe(100 + 60 + 0 + 60 + 20);
  });

  it("continues a streak across consecutive solved puzzles", () => {
    const s = computeStats([win(3), win(4), win(5)], 5);
    expect(s.currentStreak).toBe(3);
    expect(s.maxStreak).toBe(3);
  });

  it("keeps the streak alive when the last solve was yesterday", () => {
    expect(computeStats([win(3), win(4), win(5)], 6).currentStreak).toBe(3);
  });

  it("ends the streak when a day was skipped before today", () => {
    const s = computeStats([win(3), win(4), win(5)], 7);
    expect(s.currentStreak).toBe(0);
    expect(s.maxStreak).toBe(3);
  });

  it("a miss breaks the streak", () => {
    const s = computeStats([win(1), win(2), win(3), miss(4)], 4);
    expect(s.currentStreak).toBe(0);
    expect(s.maxStreak).toBe(3);
    expect(computeStats([win(1), win(2), miss(3), win(4)], 4).currentStreak).toBe(1);
  });

  it("a gap in puzzle numbers breaks the streak", () => {
    const s = computeStats([win(1), win(2), win(3), win(5), win(6)], 6);
    expect(s.currentStreak).toBe(2);
    expect(s.maxStreak).toBe(3);
  });

  it("does not depend on input order", () => {
    expect(computeStats([win(5), win(3), win(4)], 5).currentStreak).toBe(3);
  });
});

describe("history merging (pure)", () => {
  it("addResult keeps the first result for a puzzle", () => {
    const h = addResult([win(1, 2)], miss(1));
    expect(h).toEqual([win(1, 2)]);
    expect(addResult(h, win(2))).toEqual([win(1, 2), win(2)]);
  });

  it("mergeHistories is a union where the server wins", () => {
    const merged = mergeHistories([win(1, 1), win(3, 2)], [miss(1), win(2, 4)]);
    expect(merged).toEqual([miss(1), win(2, 4), win(3, 2)]);
  });
});

describe("localStorage-backed storage", () => {
  let map: Map<string, string>;
  beforeEach(() => {
    map = installMemoryStorage();
    clearAll();
  });
  afterAll(removeStorage);

  it("creates the device id once", () => {
    const id = getDeviceId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(getDeviceId()).toBe(id);
    expect(JSON.parse(map.get(STORAGE_KEY)!).deviceId).toBe(id);
    clearAll();
    expect(getDeviceId()).not.toBe(id);
  });

  it("saves and reloads a game mid-play", () => {
    expect(getGame(3)).toBeNull();
    let s: GameState = newGame(3, 100);
    s = applyGuess(s, "a", false, 200);
    saveGame(s);
    expect(getGame(3)).toEqual(s);
    expect(getGame(4)).toBeNull();
    const s2 = applyGuess(getGame(3)!, "b", true, 300);
    saveGame(s2);
    expect(getGame(3)).toEqual(s2);
  });

  it("keeps games for different puzzles apart", () => {
    saveGame(newGame(1, 1));
    saveGame(newGame(2, 2));
    expect(getGame(1)!.startedAt).toBe(1);
    expect(getGame(2)!.startedAt).toBe(2);
  });

  it("recordResult is idempotent and history is sorted", () => {
    recordResult(win(5, 2));
    recordResult(win(2, 1));
    recordResult(miss(5));
    recordResult(win(5, 2));
    expect(getHistory()).toEqual([win(2, 1), win(5, 2)]);
  });

  it("mergeHistory unions, prefers the server, saves and returns", () => {
    recordResult(win(1, 1));
    recordResult(win(3, 2));
    const merged = mergeHistory([miss(1), win(2, 4)]);
    expect(merged).toEqual([miss(1), win(2, 4), win(3, 2)]);
    expect(getHistory()).toEqual(merged);
  });

  it("does not lose the device id or games when history changes", () => {
    const id = getDeviceId();
    saveGame(newGame(1, 1));
    recordResult(win(1));
    mergeHistory([win(2)]);
    expect(getDeviceId()).toBe(id);
    expect(getGame(1)).not.toBeNull();
  });

  it("tolerates corrupt and foreign data", () => {
    for (const bad of ["{not json", "null", "42", '"str"', "[]", '{"v":999,"history":[{}]}']) {
      map.set(STORAGE_KEY, bad);
      expect(getHistory()).toEqual([]);
      expect(getGame(1)).toBeNull();
    }
    map.set(
      STORAGE_KEY,
      JSON.stringify({
        v: 1,
        games: { "1": { puzzleNumber: 1, guesses: "nope" }, "2": newGame(2, 5) },
        history: [win(2), { puzzleNumber: "x" }, null, win(1)],
      }),
    );
    expect(getGame(1)).toBeNull();
    expect(getGame(2)).toEqual(newGame(2, 5));
    expect(getHistory()).toEqual([win(1), win(2)]);
    recordResult(win(3));
    expect(getHistory()).toEqual([win(1), win(2), win(3)]);
  });

  it("clearAll wipes everything", () => {
    saveGame(newGame(1, 1));
    recordResult(win(1));
    clearAll();
    expect(getGame(1)).toBeNull();
    expect(getHistory()).toEqual([]);
    expect(map.has(STORAGE_KEY)).toBe(false);
  });

  it("survives a localStorage that throws", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    expect(() => saveGame(newGame(1, 1))).not.toThrow();
    expect(getGame(1)).toBeNull();
    expect(getHistory()).toEqual([]);
    expect(() => clearAll()).not.toThrow();
  });
});

describe("without localStorage (Node / SSR)", () => {
  beforeEach(() => {
    removeStorage();
    clearAll();
  });

  it("never throws and returns empty values", () => {
    expect(getGame(1)).toBeNull();
    expect(getHistory()).toEqual([]);
    expect(() => saveGame(newGame(1, 1))).not.toThrow();
    expect(() => recordResult(win(1))).not.toThrow();
    expect(mergeHistory([win(2)])).toEqual([win(2)]);
    const id = getDeviceId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(getDeviceId()).toBe(id);
  });
});

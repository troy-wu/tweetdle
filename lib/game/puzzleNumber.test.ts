import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dateForPuzzleNumber, maxValidPuzzleNumber, msUntilNextPuzzle, pickUnlimited, puzzleNumberForDate } from "./puzzleNumber";

const LAUNCH = "2026-11-15";
const HOUR = 3_600_000;
const originalTz = process.env.TZ;

beforeAll(() => {
  process.env.TZ = "America/New_York";
});
afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe("puzzleNumberForDate", () => {
  it("runs in the expected timezone", () => {
    // Guards the DST tests below: EST in January, EDT in July.
    expect(new Date(2027, 0, 1).getTimezoneOffset()).toBe(300);
    expect(new Date(2027, 6, 1).getTimezoneOffset()).toBe(240);
  });

  it("launch day is puzzle 1, all day long", () => {
    expect(puzzleNumberForDate(new Date(2026, 10, 15, 0, 0, 0), LAUNCH)).toBe(1);
    expect(puzzleNumberForDate(new Date(2026, 10, 15, 12, 0, 0), LAUNCH)).toBe(1);
    expect(puzzleNumberForDate(new Date(2026, 10, 15, 23, 59, 59, 999), LAUNCH)).toBe(1);
  });

  it("rolls over exactly at local midnight", () => {
    expect(puzzleNumberForDate(new Date(2026, 10, 16, 0, 0, 0, 0), LAUNCH)).toBe(2);
    expect(puzzleNumberForDate(new Date(2026, 10, 14, 23, 59, 59), LAUNCH)).toBe(0);
    expect(puzzleNumberForDate(new Date(2026, 11, 15, 8), LAUNCH)).toBe(31);
  });

  it("is consecutive across spring-forward (23h day, 14 Mar 2027)", () => {
    const before = puzzleNumberForDate(new Date(2027, 2, 13, 23, 30), LAUNCH);
    const day = puzzleNumberForDate(new Date(2027, 2, 14, 0, 30), LAUNCH);
    const dayLate = puzzleNumberForDate(new Date(2027, 2, 14, 23, 30), LAUNCH);
    const after = puzzleNumberForDate(new Date(2027, 2, 15, 0, 30), LAUNCH);
    expect(before).toBe(119);
    expect([day, dayLate, after]).toEqual([120, 120, 121]);
  });

  it("is consecutive across fall-back (25h day, 7 Nov 2027)", () => {
    const before = puzzleNumberForDate(new Date(2027, 10, 6, 23, 30), LAUNCH);
    const day = puzzleNumberForDate(new Date(2027, 10, 7, 0, 30), LAUNCH);
    const dayLate = puzzleNumberForDate(new Date(2027, 10, 7, 23, 59), LAUNCH);
    const after = puzzleNumberForDate(new Date(2027, 10, 8, 0, 0), LAUNCH);
    expect(before).toBe(357);
    expect([day, dayLate, after]).toEqual([358, 358, 359]);
  });

  it("increments by exactly one every calendar day for two years", () => {
    for (let i = 0; i < 730; i++) {
      expect(puzzleNumberForDate(new Date(2026, 10, 15 + i, 0, 0), LAUNCH)).toBe(i + 1);
      expect(puzzleNumberForDate(new Date(2026, 10, 15 + i, 23, 59), LAUNCH)).toBe(i + 1);
    }
  });

  it("defaults to the configured launch date", () => {
    expect(Number.isInteger(puzzleNumberForDate(new Date()))).toBe(true);
  });
});

describe("maxValidPuzzleNumber", () => {
  it("uses the calendar date in UTC+14", () => {
    // 09:59 UTC on the 14th is 23:59 on the 14th in UTC+14.
    expect(maxValidPuzzleNumber(Date.UTC(2026, 10, 14, 9, 59), LAUNCH)).toBe(0);
    // 10:00 UTC on the 14th is already the 15th in UTC+14.
    expect(maxValidPuzzleNumber(Date.UTC(2026, 10, 14, 10, 0), LAUNCH)).toBe(1);
    expect(maxValidPuzzleNumber(Date.UTC(2026, 10, 15, 9, 59, 59), LAUNCH)).toBe(1);
    expect(maxValidPuzzleNumber(Date.UTC(2026, 10, 15, 10, 0), LAUNCH)).toBe(2);
  });

  it("is never behind any player's local puzzle number", () => {
    const start = Date.UTC(2027, 2, 13);
    for (let h = 0; h < 72; h++) {
      const now = start + h * HOUR;
      expect(maxValidPuzzleNumber(now, LAUNCH)).toBeGreaterThanOrEqual(
        puzzleNumberForDate(new Date(now), LAUNCH),
      );
    }
  });
});

describe("msUntilNextPuzzle", () => {
  it("counts down to local midnight", () => {
    expect(msUntilNextPuzzle(new Date(2026, 10, 20, 23, 0, 0))).toBe(HOUR);
    expect(msUntilNextPuzzle(new Date(2026, 10, 20, 0, 0, 0))).toBe(24 * HOUR);
    expect(msUntilNextPuzzle(new Date(2026, 10, 20, 23, 59, 59, 999))).toBe(1);
    expect(msUntilNextPuzzle(new Date(2026, 11, 31, 22, 0, 0))).toBe(2 * HOUR);
  });

  it("accounts for short and long DST days", () => {
    expect(msUntilNextPuzzle(new Date(2027, 2, 14, 0, 0, 0))).toBe(23 * HOUR);
    expect(msUntilNextPuzzle(new Date(2027, 10, 7, 0, 0, 0))).toBe(25 * HOUR);
  });
});

describe("pickUnlimited", () => {
  const pool = [1, 2, 3, 4, 5, 100001, 100002];
  it("never serves today's puzzle or one already played", () => {
    for (let i = 0; i < 50; i++) {
      const n = pickUnlimited(pool, new Set([1, 100001]), 3);
      expect([2, 100002]).toContain(n);
    }
  });
  it("uses upcoming dailies only when nothing else is left, furthest first", () => {
    expect(pickUnlimited(pool, new Set([1, 2, 100001, 100002]), 3)).toBe(5);
    expect(pickUnlimited(pool, new Set([1, 2, 5, 100001, 100002]), 3)).toBe(4);
  });
  it("returns null when the bank is used up", () => {
    expect(pickUnlimited(pool, new Set([1, 2, 4, 5, 100001, 100002]), 3)).toBeNull();
  });
});

describe("dateForPuzzleNumber", () => {
  it("is the inverse of puzzleNumberForDate", () => {
    for (const n of [1, 2, 17, 400]) expect(puzzleNumberForDate(dateForPuzzleNumber(n))).toBe(n);
  });
});

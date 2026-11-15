import { describe, expect, it } from "vitest";
import { maxValidPuzzleNumber, parsePuzzleNumber } from "./clock";
import { answerHash, redact } from "./puzzle";

// LAUNCH_DATE defaults to 2026-11-15 (puzzle 1).
const at = (iso: string) => maxValidPuzzleNumber(Date.parse(iso));

describe("maxValidPuzzleNumber", () => {
  it("follows the calendar date in UTC+14", () => {
    expect(at("2026-11-14T09:59:59Z")).toBe(0); // still Nov 14 everywhere
    expect(at("2026-11-14T10:00:00Z")).toBe(1); // Nov 15 00:00 at UTC+14
    expect(at("2026-11-15T09:59:59Z")).toBe(1);
    expect(at("2026-11-15T10:00:00Z")).toBe(2);
    expect(at("2026-12-25T00:00:00Z")).toBe(41);
    expect(at("2027-11-15T00:00:00Z")).toBe(366);
  });
});

describe("parsePuzzleNumber", () => {
  it("accepts only plain positive integers", () => {
    expect(parsePuzzleNumber("1")).toBe(1);
    expect(parsePuzzleNumber("42")).toBe(42);
    for (const bad of ["0", "-3", "1.0", "abc", "", "1e2", "0x1", "9999999", null, undefined]) {
      expect(parsePuzzleNumber(bad)).toBeNull();
    }
  });
});

describe("puzzle helpers", () => {
  it("redacts every bracketed span", () => {
    expect(redact("[[A]] and [[B C]] met [[D]]")).toBe("█████ and █████ met █████");
    expect(redact("line [[one\ntwo]] end")).toBe("line █████ end");
    expect(redact("no spans [here]")).toBe("no spans [here]");
  });

  it("hashes like the browser will (sha256 of salt:authorId)", () => {
    // Known vector from `printf 'tweetdle-1:ada-mockwell' | shasum -a 256`.
    expect(answerHash("tweetdle-1", "ada-mockwell")).toBe(
      "b87f47b16fa448ccdcfcdeef4d74f90968a979cf7a1a56554eb376bb5bec4edb",
    );
  });
});

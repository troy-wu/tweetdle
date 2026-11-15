import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "../types";
import { shareText } from "./share";

const URL = "https://tweetdle.example";
const win = (n: number, puzzleNumber = 42): HistoryEntry => ({
  puzzleNumber,
  guessesUsed: n,
  solved: true,
  score: 120 - n * 20,
});

describe("shareText", () => {
  it("matches the documented format", () => {
    expect(shareText(win(3), 7, URL)).toBe(`Tweetdle #42 3/5\n🟥🟥🟩\n🔥 7\n${URL}`);
  });

  it("draws one square per guess", () => {
    expect(shareText(win(1), 0, URL).split("\n")[1]).toBe("🟩");
    expect(shareText(win(2), 0, URL).split("\n")[1]).toBe("🟥🟩");
    expect(shareText(win(4), 0, URL).split("\n")[1]).toBe("🟥🟥🟥🟩");
    expect(shareText(win(5), 0, URL).split("\n")[1]).toBe("🟥🟥🟥🟥🟩");
  });

  it("shows X/5 and five red squares for a miss", () => {
    const miss: HistoryEntry = { puzzleNumber: 9, guessesUsed: 5, solved: false, score: 0 };
    expect(shareText(miss, 0, URL)).toBe(`Tweetdle #9 X/5\n🟥🟥🟥🟥🟥\n${URL}`);
  });

  it("omits the streak line below 2", () => {
    expect(shareText(win(1), 1, URL)).toBe(`Tweetdle #42 1/5\n🟩\n${URL}`);
    expect(shareText(win(1), 0, URL)).not.toContain("🔥");
    expect(shareText(win(1), 2, URL)).toContain("\n🔥 2\n");
  });
});

import { describe, expect, it } from "vitest";
import { HINT_SCHEDULE } from "../constants";
import {
  applyGuess,
  applySkip,
  hintsUnlocked,
  newGame,
  toHistoryEntry,
  tweetsVisible,
  wrongGuessCount,
} from "./engine";
import { scoreFor } from "./score";

const ANSWER = "answer";
const play = (wrongBefore: number, win: boolean) => {
  let s = newGame(7, 1000);
  for (let i = 0; i < wrongBefore; i++) s = applyGuess(s, `wrong-${i}`, false, 2000 + i);
  if (win) s = applyGuess(s, ANSWER, true, 9000);
  return s;
};

describe("scoreFor", () => {
  it("follows the score table", () => {
    expect([1, 2, 3, 4, 5].map((n) => scoreFor(n, true))).toEqual([100, 80, 60, 40, 20]);
    expect(scoreFor(5, false)).toBe(0);
    expect(scoreFor(1, false)).toBe(0);
    expect(scoreFor(0, true)).toBe(0);
    expect(scoreFor(6, true)).toBe(0);
  });
});

describe("engine", () => {
  it("starts with one tweet and no hints", () => {
    const s = newGame(7, 1000);
    expect(s).toEqual({ puzzleNumber: 7, guesses: [], status: "playing", startedAt: 1000 });
    expect(tweetsVisible(s)).toBe(1);
    expect(hintsUnlocked(s)).toEqual([]);
    expect(wrongGuessCount(s)).toBe(0);
  });

  it.each([
    [1, 100],
    [2, 80],
    [3, 60],
    [4, 40],
    [5, 20],
  ])("win on guess %i scores %i", (guessNo, score) => {
    const s = play(guessNo - 1, true);
    expect(s.status).toBe("won");
    expect(s.finishedAt).toBe(9000);
    expect(s.guesses).toHaveLength(guessNo);
    expect(wrongGuessCount(s)).toBe(guessNo - 1);
    expect(toHistoryEntry(s)).toEqual({ puzzleNumber: 7, guessesUsed: guessNo, solved: true, score });
    expect(tweetsVisible(s)).toBe(5);
    expect(hintsUnlocked(s)).toEqual([...HINT_SCHEDULE]);
  });

  it("loses after five wrong guesses with score 0", () => {
    const s = play(5, false);
    expect(s.status).toBe("lost");
    expect(s.finishedAt).toBe(2004);
    expect(wrongGuessCount(s)).toBe(5);
    expect(toHistoryEntry(s)).toEqual({ puzzleNumber: 7, guessesUsed: 5, solved: false, score: 0 });
    expect(tweetsVisible(s)).toBe(5);
    expect(hintsUnlocked(s)).toEqual(["category", "descriptor", "initials"]);
  });

  it("reveals one tweet and one hint per wrong guess", () => {
    const expectedHints = [
      [],
      ["category"],
      ["category", "descriptor"],
      ["category", "descriptor", "initials"],
      ["category", "descriptor", "initials"],
    ];
    for (let wrong = 0; wrong <= 4; wrong++) {
      const s = play(wrong, false);
      expect(s.status).toBe("playing");
      expect(s.finishedAt).toBeUndefined();
      expect(tweetsVisible(s)).toBe(wrong + 1);
      expect(hintsUnlocked(s)).toEqual(expectedHints[wrong]);
    }
  });

  it("ignores duplicate guesses", () => {
    const s1 = applyGuess(newGame(1, 0), "a", false, 1);
    const s2 = applyGuess(s1, "a", false, 2);
    expect(s2).toBe(s1);
    expect(s2.guesses).toEqual(["a"]);
  });

  it("ignores guesses after the game is finished", () => {
    const won = play(1, true);
    expect(applyGuess(won, "late", false, 99999)).toBe(won);
    const lost = play(5, false);
    expect(applyGuess(lost, ANSWER, true, 99999)).toBe(lost);
  });

  it("does not mutate the previous state", () => {
    const s0 = newGame(1, 0);
    const s1 = applyGuess(s0, "a", false, 1);
    expect(s1).not.toBe(s0);
    expect(s0.guesses).toEqual([]);
  });

  it("toHistoryEntry throws for an unfinished game", () => {
    expect(() => toHistoryEntry(play(2, false))).toThrow();
  });

  it("survives a JSON round trip mid-game (reload)", () => {
    const reloaded = JSON.parse(JSON.stringify(play(2, false)));
    expect(tweetsVisible(reloaded)).toBe(3);
    const done = applyGuess(reloaded, ANSWER, true, 5000);
    expect(toHistoryEntry(done).score).toBe(60);
  });
});

describe("applySkip", () => {
  it("counts exactly like a wrong guess", () => {
    let s = newGame(7, 1000);
    s = applySkip(s, 2000);
    expect(s.guesses).toEqual(["skip:1"]);
    expect(wrongGuessCount(s)).toBe(1);
    expect(tweetsVisible(s)).toBe(2);
    expect(hintsUnlocked(s)).toEqual(HINT_SCHEDULE.slice(0, 1));
    s = applyGuess(s, "wrong-0", false, 2500);
    s = applySkip(s, 3000);
    expect(s.guesses).toEqual(["skip:1", "wrong-0", "skip:2"]);
    s = applyGuess(s, ANSWER, true, 4000);
    expect(toHistoryEntry(s)).toMatchObject({ solved: true, guessesUsed: 4, score: scoreFor(4, true) });
  });

  it("loses the game when used as the fifth guess", () => {
    let s = newGame(7, 1000);
    for (let i = 0; i < 5; i++) s = applySkip(s, 2000 + i);
    expect(s.status).toBe("lost");
    expect(s.guesses).toHaveLength(5);
    expect(applySkip(s, 9000)).toBe(s);
  });
});

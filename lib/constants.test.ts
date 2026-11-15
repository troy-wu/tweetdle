import { describe, expect, it } from "vitest";
import { HINT_SCHEDULE, MAX_GUESSES, SCORE_TABLE } from "@/lib/constants";
import authors from "@/content/fixtures/authors.json";
import puzzles from "@/content/fixtures/puzzles.json";

describe("constants and fixtures", () => {
  it("has one score per guess and one hint per wrong guess before the last", () => {
    expect(SCORE_TABLE).toHaveLength(MAX_GUESSES);
    expect(HINT_SCHEDULE.length).toBeLessThan(MAX_GUESSES);
  });
  it("fixture puzzles reference fixture authors and have 5 tweets", () => {
    const ids = new Set(authors.map((a) => a.id));
    for (const p of puzzles) {
      expect(ids.has(p.authorId)).toBe(true);
      expect(p.tweets).toHaveLength(5);
    }
  });
});

import { describe, expect, it } from "vitest";
import { baselineFor, generousBeatPercent, withBaseline } from "./baselineStats";

describe("baseline stats", () => {
  it("is fixed per puzzle and sized like a real crowd", () => {
    expect(baselineFor(7)).toEqual(baselineFor(7));
    const total = baselineFor(7).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(1000);
    expect(total).toBeLessThan(5000);
  });

  it("adds real plays on top", () => {
    const real = { puzzleNumber: 3, plays: 2, distribution: [0, 1, 1, 0, 0, 0] as [number, number, number, number, number, number] };
    const out = withBaseline(real);
    const base = baselineFor(3);
    expect(out.distribution[1]).toBe(base[1] + 1);
    expect(out.plays).toBe(base.reduce((a, b) => a + b, 0) + 2);
  });

  it("gives a generous percentile, capped at 99, none for a miss", () => {
    const d = [10, 10, 10, 10, 10, 50];
    expect(generousBeatPercent(d, 0)).toBe(99);
    expect(generousBeatPercent(d, 4)).toBe(59); // 10 tied + 50 missed - self, of 100
    expect(generousBeatPercent(d, 5)).toBeNull();
  });
});

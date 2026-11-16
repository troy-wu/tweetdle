import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getStats } from "@/app/api/stats/[n]/route";
import { params, post, setupMemoryBackend, teardownMemoryBackend } from "@/lib/server/testing";
import type { DailyStats, ResultPayload, ResultResponse } from "@/lib/types";
import { POST } from "./route";

// Puzzle 1's answer in the fixtures.
const ANSWER = "ada-mockwell";
const WRONG = ["dj-lorem", "senator-sample", "rex-fixture", "nina-null", "betty-beta"];

const payload = (over: Partial<ResultPayload> = {}): ResultPayload => ({
  puzzleNumber: 1,
  guesses: [WRONG[0], ANSWER],
  durationMs: 42_000,
  deviceId: "device-a",
  ...over,
});
const submit = (body: unknown, headers?: Record<string, string>) => POST(post("/api/result", body, headers));
const stats = async (n = 1) =>
  (await (await getStats(new Request(`http://localhost/api/stats/${n}`), params(String(n)))).json()) as DailyStats;

beforeEach(() => setupMemoryBackend());
afterEach(teardownMemoryBackend);

describe("POST /api/result", () => {
  it("accepts a valid win and reveals the answer", async () => {
    const res = await submit(payload());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as ResultResponse;
    expect(body.solved).toBe(true);
    expect(body.score).toBe(80);
    expect(body.answer.id).toBe(ANSWER);
    expect(body.answer.name).toBe("Ada Mockwell");
    expect(body.tweetUrls).toEqual([101, 102, 103, 104, 105].map((i) => `https://example.com/status/${i}`));
    expect(body.stats).toEqual({ puzzleNumber: 1, plays: 1, distribution: [0, 1, 0, 0, 0, 0] });
  });

  it("scores a first-guess win at 100 and a fifth-guess win at 20", async () => {
    const first = (await (await submit(payload({ guesses: [ANSWER], deviceId: "d1" }))).json()) as ResultResponse;
    expect([first.solved, first.score]).toEqual([true, 100]);
    const fifth = (await (
      await submit(payload({ guesses: [...WRONG.slice(0, 4), ANSWER], deviceId: "d2" }))
    ).json()) as ResultResponse;
    expect([fifth.solved, fifth.score]).toEqual([true, 20]);
  });

  it("treats skips as wrong guesses", async () => {
    const win = (await (
      await submit(payload({ guesses: ["skip:1", WRONG[0], "skip:2", ANSWER], deviceId: "s1" }))
    ).json()) as ResultResponse;
    expect([win.solved, win.score]).toEqual([true, 40]);
    const loss = await submit(payload({ guesses: ["skip:1", "skip:2", "skip:3", "skip:4", "skip:5"], deviceId: "s2" }));
    expect(((await loss.json()) as ResultResponse).solved).toBe(false);
    expect((await submit(payload({ guesses: ["skip:9", ANSWER], deviceId: "s3" }))).status).toBe(400);
  });

  it("accepts a valid loss", async () => {
    const res = await submit(payload({ guesses: WRONG }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ResultResponse;
    expect(body.solved).toBe(false);
    expect(body.score).toBe(0);
    expect(body.answer.id).toBe(ANSWER);
    expect(body.stats.distribution).toEqual([0, 0, 0, 0, 0, 1]);
  });

  describe("forged or malformed submissions", () => {
    const cases: [string, unknown][] = [
      ["correct answer not last", payload({ guesses: [ANSWER, WRONG[0]] })],
      ["correct answer in the middle of five", payload({ guesses: [WRONG[0], ANSWER, WRONG[1], WRONG[2], WRONG[3]] })],
      ["fewer than 5 wrong guesses", payload({ guesses: WRONG.slice(0, 4) })],
      ["a single wrong guess", payload({ guesses: [WRONG[0]] })],
      ["unknown author id", payload({ guesses: ["not-a-real-person", ANSWER] })],
      ["duplicate guesses", payload({ guesses: [WRONG[0], WRONG[0], ANSWER] })],
      ["duplicate wrong guesses padding a loss", payload({ guesses: [...WRONG.slice(0, 4), WRONG[0]] })],
      ["no guesses", payload({ guesses: [] })],
      ["six guesses", payload({ guesses: [...WRONG, ANSWER] })],
      ["negative duration", payload({ durationMs: -1 })],
      ["absurd duration", payload({ durationMs: 1e12 })],
      ["non-numeric duration", { ...payload(), durationMs: "fast" }],
      ["missing deviceId", { ...payload(), deviceId: undefined }],
      ["deviceId over 64 chars", payload({ deviceId: "x".repeat(65) })],
      ["puzzle 0", payload({ puzzleNumber: 0 })],
      ["fractional puzzle", payload({ puzzleNumber: 1.5 })],
      ["future puzzle", payload({ puzzleNumber: 3, guesses: ["senator-sample"] })],
      ["not an object", [1, 2, 3]],
      ["not JSON", "{nope"],
    ];
    it.each(cases)("rejects %s", async (_name, body) => {
      const res = await submit(body);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json).toEqual({ error: expect.any(String) });
      // A rejected submission must not leak the answer or count as a play.
      expect(JSON.stringify(json)).not.toContain(ANSWER);
      expect((await stats()).plays).toBe(0);
    });
  });

  it("does not leak a future puzzle's answer", async () => {
    const res = await submit(payload({ puzzleNumber: 3, guesses: WRONG.filter((g) => g !== "senator-sample").concat("zed-zero").slice(0, 5) }));
    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain("senator");
  });

  it("returns 404 when the puzzle does not exist", async () => {
    setupMemoryBackend("2027-01-01T00:00:00Z");
    expect((await submit(payload({ puzzleNumber: 40 }))).status).toBe(404);
  });

  it("does not double count the same device and returns the same response", async () => {
    const first = await (await submit(payload())).json();
    const again = await (await submit(payload())).json();
    expect(again).toEqual(first);

    // Even a different (valid) guess list from that device cannot change the record.
    const changed = (await (await submit(payload({ guesses: [ANSWER] }))).json()) as ResultResponse;
    expect(changed).toEqual(first);
    expect((await stats()).plays).toBe(1);
  });

  it("aggregates across devices and puzzles, and stats reflect submissions", async () => {
    expect(await stats()).toEqual({ puzzleNumber: 1, plays: 0, distribution: [0, 0, 0, 0, 0, 0] });

    await submit(payload({ deviceId: "a", guesses: [ANSWER] }));
    await submit(payload({ deviceId: "b", guesses: [WRONG[0], ANSWER] }));
    await submit(payload({ deviceId: "c", guesses: [WRONG[1], ANSWER] }));
    await submit(payload({ deviceId: "d", guesses: WRONG }));
    await submit(payload({ deviceId: "a", guesses: WRONG })); // repeat device
    await submit(payload({ deviceId: "a", puzzleNumber: 2, guesses: ["dj-lorem"] })); // same device, other day

    expect(await stats(1)).toEqual({ puzzleNumber: 1, plays: 4, distribution: [1, 2, 0, 0, 0, 1] });
    expect(await stats(2)).toEqual({ puzzleNumber: 2, plays: 1, distribution: [1, 0, 0, 0, 0, 0] });
  });

  it("rate limits a single IP", async () => {
    const ip = { "x-forwarded-for": "203.0.113.9" };
    for (let i = 0; i < 30; i++) expect((await submit(payload({ deviceId: `dev-${i}` }), ip)).status).toBe(200);
    const blocked = await submit(payload({ deviceId: "dev-30" }), ip);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: expect.any(String) });
    // Other IPs are unaffected.
    expect((await submit(payload({ deviceId: "other" }), { "x-forwarded-for": "198.51.100.1" })).status).toBe(200);
  });
});

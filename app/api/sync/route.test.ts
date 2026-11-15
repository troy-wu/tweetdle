import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as result } from "@/app/api/result/route";
import { GET as stats } from "@/app/api/stats/[n]/route";
import { params, post, setupMemoryBackend, teardownMemoryBackend } from "@/lib/server/testing";
import type { DailyStats, ResultResponse, SyncResponse } from "@/lib/types";
import { POST } from "./route";

// Signed-in flows on the memory store: the session lookup is the only thing mocked.
const session = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/lib/server/session", () => ({ getRequestUser: async () => session.user }));

const sync = (history: unknown) => POST(post("/api/sync", { history }));
const win = (puzzleNumber: number, guessesUsed: number) => ({
  puzzleNumber,
  guessesUsed,
  solved: true,
  score: [100, 80, 60, 40, 20][guessesUsed - 1],
});

beforeEach(() => {
  setupMemoryBackend(); // puzzles 1-2 valid, 3 is in the future
  session.user = { id: "user-1" };
});
afterEach(teardownMemoryBackend);

describe("POST /api/sync (signed in)", () => {
  it("returns 401 when signed out", async () => {
    session.user = null;
    expect((await sync([win(1, 1)])).status).toBe(401);
  });

  it("imports consistent guest entries and skips the rest", async () => {
    const res = await sync([
      win(1, 2),
      { puzzleNumber: 2, guessesUsed: 5, solved: false, score: 0 },
      win(3, 1), // future puzzle
      { puzzleNumber: 1, guessesUsed: 1, solved: true, score: 100 }, // duplicate number: first wins
      { puzzleNumber: 2, guessesUsed: 3, solved: true, score: 100 }, // score does not match the table
      { puzzleNumber: 2, guessesUsed: 3, solved: false, score: 0 }, // a loss always uses 5 guesses
      { puzzleNumber: 0, guessesUsed: 1, solved: true, score: 100 },
      { puzzleNumber: "1", guessesUsed: 1, solved: true, score: 100 },
      null,
    ]);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(((await res.json()) as SyncResponse).history).toEqual([
      win(1, 2),
      { puzzleNumber: 2, guessesUsed: 5, solved: false, score: 0 },
    ]);
  });

  it("rejects a forged entry outright when it is the only claim", async () => {
    const res = await sync([{ puzzleNumber: 1, guessesUsed: 5, solved: true, score: 100 }]);
    expect(((await res.json()) as SyncResponse).history).toEqual([]);
  });

  it("never overwrites a result the server already has", async () => {
    const submitted = (await (
      await result(
        post("/api/result", {
          puzzleNumber: 1,
          guesses: ["dj-lorem", "rex-fixture", "ada-mockwell"],
          durationMs: 9000,
          deviceId: "dev",
        }),
      )
    ).json()) as ResultResponse;
    expect(submitted.score).toBe(60);

    const res = await sync([win(1, 1), win(2, 4)]);
    expect(((await res.json()) as SyncResponse).history).toEqual([win(1, 3), win(2, 4)]);
  });

  it("keeps histories separate per user and does not touch daily stats", async () => {
    await sync([win(1, 1)]);
    session.user = { id: "user-2" };
    expect(((await (await sync([])).json()) as SyncResponse).history).toEqual([]);
    const s = (await (await stats(new Request("http://localhost/api/stats/1"), params("1"))).json()) as DailyStats;
    expect(s.plays).toBe(0);
  });

  it("rejects a malformed body", async () => {
    expect((await sync("nope")).status).toBe(400);
    expect((await POST(post("/api/sync", "{bad"))).status).toBe(400);
  });
});

describe("POST /api/result (signed in)", () => {
  const submit = (guesses: string[], deviceId: string) =>
    result(post("/api/result", { puzzleNumber: 1, guesses, durationMs: 5000, deviceId }));

  it("counts a user once across devices; the first submission wins", async () => {
    const first = (await (await submit(["ada-mockwell"], "phone")).json()) as ResultResponse;
    const second = (await (await submit(["dj-lorem", "ada-mockwell"], "laptop")).json()) as ResultResponse;
    expect(first.score).toBe(100);
    expect(second).toEqual(first);
    expect(second.stats.plays).toBe(1);
  });

  it("does not recount a device that already played as a guest", async () => {
    session.user = null;
    await submit(["dj-lorem", "ada-mockwell"], "shared");
    session.user = { id: "user-1" };
    const res = (await (await submit(["dj-lorem", "ada-mockwell"], "shared")).json()) as ResultResponse;
    expect(res.stats).toEqual({ puzzleNumber: 1, plays: 1, distribution: [0, 1, 0, 0, 0, 0] });
    // ...but the account still gets its result row.
    expect(((await (await sync([])).json()) as SyncResponse).history).toEqual([win(1, 2)]);
  });
});

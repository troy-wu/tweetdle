import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as authors } from "@/app/api/authors/route";
import { GET as keepalive } from "@/app/api/cron/keepalive/route";
import { GET as leaderboard } from "@/app/api/leaderboard/route";
import { GET as stats } from "@/app/api/stats/[n]/route";
import { POST as sync } from "@/app/api/sync/route";
import { params, post, setupMemoryBackend, teardownMemoryBackend } from "@/lib/server/testing";
import type { Author } from "@/lib/types";

beforeEach(() => setupMemoryBackend());
afterEach(() => {
  teardownMemoryBackend();
  vi.unstubAllEnvs();
});

describe("GET /api/authors", () => {
  it("returns every author sorted by name, cached for an hour", async () => {
    const res = await authors();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
    const list = (await res.json()) as Author[];
    expect(list).toHaveLength(20);
    const names = list.map((a) => a.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
    expect(Object.keys(list[0]).sort()).toEqual(["aliases", "category", "descriptor", "id", "initials", "name"]);
  });
});

describe("GET /api/stats/[n]", () => {
  const get = (n: string) => stats(new Request(`http://localhost/api/stats/${n}`), params(n));

  it("returns zeros when nobody has played, cached for a minute", async () => {
    const res = await get("2");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=60");
    expect(await res.json()).toEqual({ puzzleNumber: 2, plays: 0, distribution: [0, 0, 0, 0, 0, 0] });
  });

  it("rejects bad and future numbers", async () => {
    expect((await get("0")).status).toBe(400);
    expect((await get("nope")).status).toBe(400);
    expect((await get("3")).status).toBe(404);
  });
});

describe("GET /api/leaderboard", () => {
  const get = (query: string) => leaderboard(new Request(`http://localhost/api/leaderboard${query}`));

  it.each(["today", "alltime", "streak"])("returns an empty %s board on the memory store", async (kind) => {
    const res = await get(`?kind=${kind}&n=1`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=60");
    expect(await res.json()).toEqual([]);
  });

  it("validates kind and n", async () => {
    expect((await get("?kind=weekly&n=1")).status).toBe(400);
    expect((await get("?n=1")).status).toBe(400);
    expect((await get("?kind=today")).status).toBe(400);
    expect((await get("?kind=today&n=0")).status).toBe(400);
    expect((await get("?kind=today&n=99")).status).toBe(400);
  });
});

describe("POST /api/sync", () => {
  it("returns 401 without a signed-in user", async () => {
    const res = await sync(
      post("/api/sync", { history: [{ puzzleNumber: 1, guessesUsed: 1, solved: true, score: 100 }] }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: expect.any(String) });
  });
});

describe("GET /api/cron/keepalive", () => {
  const get = (auth?: string) =>
    keepalive(new Request("http://localhost/api/cron/keepalive", { headers: auth ? { authorization: auth } : {} }));

  it("requires the cron secret", async () => {
    expect((await get("Bearer anything")).status).toBe(401); // CRON_SECRET unset: closed
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await get()).status).toBe(401);
    expect((await get("Bearer wrong!")).status).toBe(401);
    const ok = await get("Bearer s3cret");
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, store: "memory" });
  });
});

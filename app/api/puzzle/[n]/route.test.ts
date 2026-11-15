import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { REDACTED_TOKEN } from "@/lib/constants";
import fixturePuzzles from "@/content/fixtures/puzzles.json";
import fixtureAuthors from "@/content/fixtures/authors.json";
import { params, setupMemoryBackend, teardownMemoryBackend } from "@/lib/server/testing";
import type { PublicPuzzle } from "@/lib/types";
import { GET } from "./route";

const get = (n: string) => GET(new Request(`http://localhost/api/puzzle/${n}`), params(n));

beforeEach(() => setupMemoryBackend());
afterEach(teardownMemoryBackend);

describe("GET /api/puzzle/[n]", () => {
  it("returns a public puzzle with redactions and no answer", async () => {
    const res = await get("1");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=86400, stale-while-revalidate=604800");

    const raw = await res.text();
    const body = JSON.parse(raw) as PublicPuzzle;
    const source = fixturePuzzles[0];
    const author = fixtureAuthors.find((a) => a.id === source.authorId)!;

    expect(Object.keys(body).sort()).toEqual(["answerHash", "hints", "number", "salt", "tweets"]);
    expect(body.number).toBe(1);
    expect(body.tweets).toHaveLength(5);
    for (const t of body.tweets) expect(Object.keys(t).sort()).toEqual(["date", "text"]);

    // Bracketed spans are replaced, urls and the author id are nowhere in the payload.
    expect(source.tweets[3].text).toContain("[[Mockwell Labs]]");
    expect(body.tweets[3].text).toBe(`Sample tweet: ${REDACTED_TOKEN} is hiring. Bring your own keyboard.`);
    expect(raw).not.toContain("[[");
    expect(raw).not.toContain("]]");
    expect(raw).not.toContain("Mockwell");
    expect(raw).not.toContain("example.com");
    expect(raw).not.toContain(source.authorId);
    expect(raw).not.toContain(author.name);

    expect(body.hints).toEqual({
      category: author.category,
      descriptor: author.descriptor,
      initials: author.initials,
    });
    expect(body.salt).toBe("tweetdle-1");
    expect(body.answerHash).toBe(
      createHash("sha256").update(`tweetdle-1:${source.authorId}`).digest("hex"),
    );
  });

  it.each(["0", "-1", "abc", "1.5", "1e3", " 1", "01x"])("rejects %j with 400", async (n) => {
    const res = await get(n);
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: expect.any(String) });
  });

  it("refuses future puzzles even when they exist", async () => {
    expect((await get("2")).status).toBe(200); // today in UTC+14
    const res = await get("3"); // exists in the fixtures, but is tomorrow's
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(await res.json())).not.toContain("senator");
  });

  it("opens the next puzzle once the date reaches it somewhere on Earth", async () => {
    setupMemoryBackend("2026-11-16T10:00:00Z"); // Nov 17 00:00 in UTC+14
    expect((await get("3")).status).toBe(200);
    setupMemoryBackend("2026-11-16T09:59:59Z");
    expect((await get("3")).status).toBe(404);
  });

  it("returns 404 for a valid number with no puzzle", async () => {
    setupMemoryBackend("2027-01-01T00:00:00Z");
    expect((await get("4")).status).toBe(404);
  });
});

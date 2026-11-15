/** Test helpers: a fresh fixture-backed memory store and a pinned clock. */
import { vi } from "vitest";
import { resetRateLimit } from "./rateLimit";
import { createMemoryStore, fixtureContent, setStore } from "./store";

/**
 * Fresh memory store on fixtures (3 puzzles, 20 authors) and the clock pinned so
 * that puzzles 1 and 2 are playable and puzzle 3 is still in the future.
 * LAUNCH_DATE defaults to 2026-11-15; at 12:00 UTC it is already Nov 16 in UTC+14.
 */
export function setupMemoryBackend(now = "2026-11-15T12:00:00Z") {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(now));
  setStore(createMemoryStore(fixtureContent()));
  resetRateLimit();
}

export function teardownMemoryBackend() {
  setStore(null);
  vi.useRealTimers();
}

export const params = (n: string) => ({ params: Promise.resolve({ n }) });

export const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

/**
 * Tiny in-memory fixed-window rate limiter. Per server instance only, so on
 * serverless it is a speed bump, not a guarantee. To remove it, delete this
 * file and the single `rateLimit(...)` call in app/api/result/route.ts.
 */
const WINDOW_MS = 60_000;
const MAX_KEYS = 10_000;

const hits = new Map<string, { windowStart: number; count: number }>();

/** Returns true when the request is allowed. */
export function rateLimit(key: string, limit = 30, nowMs: number = Date.now()): boolean {
  const entry = hits.get(key);
  if (!entry || nowMs - entry.windowStart >= WINDOW_MS) {
    if (hits.size >= MAX_KEYS) {
      for (const [k, v] of hits) if (nowMs - v.windowStart >= WINDOW_MS) hits.delete(k);
      if (hits.size >= MAX_KEYS) hits.clear();
    }
    hits.set(key, { windowStart: nowMs, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

export function resetRateLimit(): void {
  hits.clear();
}

import { timingSafeEqual } from "node:crypto";
import { error, guard, json } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never open, even when unconfigured
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** GET /api/cron/keepalive. Daily Vercel cron: one trivial query so a free Supabase project never idles out. */
export function GET(request: Request) {
  return guard(async () => {
    if (!authorized(request)) return error("Unauthorized.", 401);
    const store = getStore();
    await store.ping();
    return json({ ok: true, store: store.kind });
  });
}

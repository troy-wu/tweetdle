/** Small helpers shared by the route handlers. */

export const CACHE = {
  none: "no-store",
  authors: "public, s-maxage=3600, stale-while-revalidate=86400",
  puzzle: "public, s-maxage=86400, stale-while-revalidate=604800",
  minute: "public, s-maxage=60, stale-while-revalidate=60",
  privateNone: "private, no-store",
} as const;

export function json(data: unknown, init: { status?: number; cache?: string; headers?: Record<string, string> } = {}) {
  return Response.json(data, {
    status: init.status ?? 200,
    headers: { "Cache-Control": init.cache ?? CACHE.none, ...init.headers },
  });
}

export function error(message: string, status: number, headers?: Record<string, string>) {
  return json({ error: message }, { status, cache: CACHE.none, headers });
}

/** Runs a handler and turns unexpected failures into a JSON 500. */
export async function guard(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    console.error("[api]", err);
    return error("Something went wrong. Please try again.", 500);
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

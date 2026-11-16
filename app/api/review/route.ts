import { error, guard, json } from "@/lib/server/http";
import { parsePuzzleNumber } from "@/lib/server/clock";
import { RatingSchema, reviewEnabled, reviewList, writeRating } from "@/lib/server/review";

/** GET /api/review -> ReviewListItem[]. Local dev only. */
export function GET() {
  return guard(async () => {
    if (!reviewEnabled()) return error("Not found.", 404);
    return json(reviewList());
  });
}

/** POST /api/review { number, verdict, note, solved, guessesUsed } -> saved rating. Local dev only. */
export function POST(request: Request) {
  return guard(async () => {
    if (!reviewEnabled()) return error("Not found.", 404);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const n = parsePuzzleNumber(String(body?.number ?? ""));
    const parsed = RatingSchema.safeParse(body);
    if (n === null || !parsed.success) return error("Invalid rating.", 400);
    if (!reviewList().some((p) => p.number === n)) return error("Puzzle not found.", 404);
    return json(writeRating(n, parsed.data));
  });
}

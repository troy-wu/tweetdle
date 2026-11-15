import { maxValidPuzzleNumber, parsePuzzleNumber } from "@/lib/server/clock";
import { CACHE, error, guard, json } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

/** GET /api/stats/[n] -> DailyStats (all zeros when nobody has played). */
export function GET(_request: Request, { params }: { params: Promise<{ n: string }> }) {
  return guard(async () => {
    const n = parsePuzzleNumber((await params).n);
    if (n === null) return error("Puzzle number must be a whole number of 1 or more.", 400);
    if (n > maxValidPuzzleNumber()) return error("That puzzle is not available yet.", 404);
    return json(await getStore().getStats(n), { cache: CACHE.minute });
  });
}

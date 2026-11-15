import { maxValidPuzzleNumber, parsePuzzleNumber } from "@/lib/server/clock";
import { CACHE, error, guard, json } from "@/lib/server/http";
import { getRequestUser } from "@/lib/server/session";
import { getStore } from "@/lib/server/store";
import type { LeaderboardKind, LeaderboardRow } from "@/lib/types";

const KINDS: LeaderboardKind[] = ["today", "alltime", "streak"];

/** GET /api/leaderboard?kind=today|alltime|streak&n=<puzzle> -> top 100 LeaderboardRow[]. */
export function GET(request: Request) {
  return guard(async () => {
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") as LeaderboardKind | null;
    if (!kind || !KINDS.includes(kind)) return error("kind must be today, alltime or streak.", 400);
    const n = parsePuzzleNumber(url.searchParams.get("n"));
    if (n === null) return error("n must be a whole number of 1 or more.", 400);
    if (n > maxValidPuzzleNumber()) return error("That puzzle is not available yet.", 400);

    const [entries, user] = await Promise.all([getStore().getLeaderboard(kind, n), getRequestUser()]);

    // Entries arrive sorted; ties share nothing, rank is simply the position.
    const rows: LeaderboardRow[] = entries.slice(0, 100).map((e, i) => {
      const row: LeaderboardRow = { rank: i + 1, displayName: e.displayName, value: e.value };
      if (kind === "today") {
        row.guessesUsed = e.guessesUsed;
        row.durationMs = e.durationMs;
      }
      if (user && e.userId === user.id) row.isYou = true;
      return row;
    });

    // Signed-in responses carry isYou, so they must never be shared; Vary keeps
    // the CDN from handing a guest's cached copy to a signed-in player.
    return json(rows, { cache: user ? CACHE.privateNone : CACHE.minute, headers: { Vary: "Cookie" } });
  });
}

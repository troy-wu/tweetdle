import { z } from "zod";
import { MAX_GUESSES, SCORE_TABLE } from "@/lib/constants";
import { maxValidPuzzleNumber } from "@/lib/server/clock";
import { error, guard, json } from "@/lib/server/http";
import { getRequestUser } from "@/lib/server/session";
import { getStore } from "@/lib/server/store";
import type { HistoryEntry, SyncResponse } from "@/lib/types";

const bodySchema = z.object({ history: z.array(z.unknown()).max(5000) });

const entrySchema = z.object({
  puzzleNumber: z.number().int().min(1),
  guessesUsed: z.number().int().min(1).max(MAX_GUESSES),
  solved: z.boolean(),
  score: z.number().int(),
});

/** An entry is importable when it is in range and internally consistent. */
function isConsistent(e: HistoryEntry, maxValid: number): boolean {
  if (e.puzzleNumber > maxValid) return false;
  return e.solved ? e.score === SCORE_TABLE[e.guessesUsed - 1] : e.guessesUsed === MAX_GUESSES && e.score === 0;
}

/**
 * POST /api/sync (signed-in only). Merges guest history into the account:
 * inserts entries the user has no row for (flagged imported; server rows always
 * win), then returns the full server history. Bad entries are skipped, not fatal.
 */
export function POST(request: Request) {
  return guard(async () => {
    const user = await getRequestUser();
    if (!user) return error("Sign in to sync your history.", 401);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error("Body must be JSON.", 400);
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return error("Body must be { history: HistoryEntry[] }.", 400);

    const maxValid = maxValidPuzzleNumber();
    const byPuzzle = new Map<number, HistoryEntry>();
    for (const raw of parsed.data.history) {
      const entry = entrySchema.safeParse(raw);
      if (!entry.success || !isConsistent(entry.data, maxValid)) continue;
      if (!byPuzzle.has(entry.data.puzzleNumber)) byPuzzle.set(entry.data.puzzleNumber, entry.data);
    }

    const store = getStore();
    await store.importHistory(user.id, [...byPuzzle.values()]);
    const response: SyncResponse = { history: await store.getUserHistory(user.id) };
    return json(response, { cache: "private, no-store" });
  });
}

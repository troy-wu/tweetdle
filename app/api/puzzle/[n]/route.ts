import { isPracticeNumber } from "@/lib/constants";
import { maxValidPuzzleNumber, parsePuzzleNumber } from "@/lib/server/clock";
import { CACHE, error, guard, json } from "@/lib/server/http";
import { toPublicPuzzle } from "@/lib/server/puzzle";
import { getStore } from "@/lib/server/store";

/** GET /api/puzzle/[n] -> PublicPuzzle. Never includes the author id or tweet urls. */
export function GET(_request: Request, { params }: { params: Promise<{ n: string }> }) {
  return guard(async () => {
    const n = parsePuzzleNumber((await params).n);
    if (n === null) return error("Puzzle number must be a whole number of 1 or more.", 400);
    if (!isPracticeNumber(n) && n > maxValidPuzzleNumber()) return error("That puzzle is not available yet.", 404);

    const store = getStore();
    const puzzle = await store.getPuzzle(n);
    if (!puzzle) return error("Puzzle not found.", 404);
    const author = (await store.getAuthors()).find((a) => a.id === puzzle.authorId);
    if (!author) throw new Error(`puzzle ${n} references unknown author`);

    return json(toPublicPuzzle(puzzle, author), { cache: CACHE.puzzle });
  });
}

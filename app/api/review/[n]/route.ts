import { parsePuzzleNumber } from "@/lib/server/clock";
import { error, guard, json } from "@/lib/server/http";
import { toPublicPuzzle } from "@/lib/server/puzzle";
import { readRatings, reviewContent, reviewEnabled } from "@/lib/server/review";

/**
 * GET /api/review/[n] -> { puzzle, answer, tweetUrls, fullTexts, rating }.
 * Any puzzle number, no date gate. Local dev only: it returns the answer.
 */
export function GET(_request: Request, { params }: { params: Promise<{ n: string }> }) {
  return guard(async () => {
    if (!reviewEnabled()) return error("Not found.", 404);
    const n = parsePuzzleNumber((await params).n);
    if (n === null) return error("Puzzle number must be a whole number of 1 or more.", 400);

    const { authors, puzzles } = reviewContent();
    const puzzle = puzzles.find((p) => p.number === n);
    if (!puzzle) return error("Puzzle not found.", 404);
    const answer = authors.find((a) => a.id === puzzle.authorId);
    if (!answer) throw new Error(`puzzle ${n} references unknown author`);

    const numbers = puzzles.map((p) => p.number).sort((a, b) => a - b);
    const i = numbers.indexOf(n);
    return json({
      puzzle: toPublicPuzzle(puzzle, answer),
      answer,
      tweetUrls: puzzle.tweets.map((t) => t.url),
      // Brackets removed so you can check what the redaction hid.
      fullTexts: puzzle.tweets.map((t) => t.text.replace(/\[\[|\]\]/g, "")),
      rating: readRatings()[String(n)] ?? null,
      prev: numbers[i - 1] ?? null,
      next: numbers[i + 1] ?? null,
      total: numbers.length,
    });
  });
}

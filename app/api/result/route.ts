import { z } from "zod";
import { MAX_GUESSES, isPracticeNumber } from "@/lib/constants";
import { maxValidPuzzleNumber } from "@/lib/server/clock";
import { clientIp, error, guard, json } from "@/lib/server/http";
import { bucketToOutcome, hashDeviceId } from "@/lib/server/puzzle";
import { rateLimit } from "@/lib/server/rateLimit";
import { getRequestUser } from "@/lib/server/session";
import { getStore } from "@/lib/server/store";
import type { ResultResponse } from "@/lib/types";

const MAX_DURATION_MS = 7 * 86_400_000;

const payloadSchema = z.object({
  puzzleNumber: z.number().int().min(1).max(999_999),
  guesses: z
    .array(z.string().min(1).max(100))
    .min(1)
    .max(MAX_GUESSES)
    .refine((g) => new Set(g).size === g.length, "Guesses must be unique."),
  durationMs: z.number().finite().min(0).max(MAX_DURATION_MS),
  deviceId: z.string().min(1).max(64),
  casual: z.boolean().optional(),
});

/**
 * POST /api/result. The one write per player per day. The client's claim is
 * never trusted: the outcome is recomputed from the guess list.
 */
export function POST(request: Request) {
  return guard(async () => {
    // Per-IP speed bump. Remove this line (and lib/server/rateLimit.ts) to drop it.
    if (!rateLimit(clientIp(request))) return error("Too many requests. Try again in a minute.", 429, { "Retry-After": "60" });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error("Body must be JSON.", 400);
    }
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) return error(`Invalid result: ${parsed.error.issues[0]?.message ?? "bad payload"}`, 400);
    const { puzzleNumber, guesses, durationMs, deviceId } = parsed.data;

    // Unlimited and archive games: checked and revealed, never recorded.
    const casual = parsed.data.casual === true || isPracticeNumber(puzzleNumber);
    if (!casual && puzzleNumber > maxValidPuzzleNumber()) return error("That puzzle is not available yet.", 400);

    const store = getStore();
    const [puzzle, authors] = await Promise.all([store.getPuzzle(puzzleNumber), store.getAuthors()]);
    if (!puzzle) return error("Puzzle not found.", 404);
    const answer = authors.find((a) => a.id === puzzle.authorId);
    if (!answer) throw new Error(`puzzle ${puzzleNumber} references unknown author`);

    const known = new Set(authors.map((a) => a.id));
    // Skips ("skip:1"...) count as wrong guesses; they can never match the answer.
    if (!guesses.every((g) => known.has(g) || /^skip:[1-5]$/.test(g))) return error("Invalid result: unknown guess.", 400);

    // Solved only if the LAST guess is the answer (guesses are unique, so no earlier one is).
    const hitAt = guesses.indexOf(puzzle.authorId);
    let bucket: number;
    if (hitAt === -1) {
      if (guesses.length !== MAX_GUESSES) return error("Invalid result: the game is not finished.", 400);
      bucket = MAX_GUESSES;
    } else if (hitAt === guesses.length - 1) {
      bucket = hitAt;
    } else {
      return error("Invalid result: guesses continue after the correct answer.", 400);
    }

    if (casual) {
      const { solved, score } = bucketToOutcome(bucket);
      const stats = await store.getStats(puzzleNumber);
      const response: ResultResponse = { solved, score, answer, tweetUrls: puzzle.tweets.map((t) => t.url), stats };
      return json(response);
    }

    const user = await getRequestUser();
    const recorded = await store.submitPlay({
      puzzleNumber,
      deviceHash: hashDeviceId(deviceId),
      bucket,
      userId: user?.id ?? null,
      durationMs: Math.round(durationMs),
    });

    // A repeat submit gets the outcome already on record, not the new claim.
    const { solved, score } = bucketToOutcome(recorded.bucket);
    const response: ResultResponse = {
      solved,
      score,
      answer,
      tweetUrls: puzzle.tweets.map((t) => t.url),
      stats: recorded.stats,
    };
    return json(response);
  });
}

import { createHash, createHmac } from "node:crypto";
import { REDACTED_TOKEN, SCORE_TABLE } from "@/lib/constants";
import type { Author, Puzzle, PublicPuzzle } from "@/lib/types";

export const puzzleSalt = (n: number) => `tweetdle-${n}`;

/** sha256 hex of `${salt}:${authorId}`. The browser engine computes the same value. */
export function answerHash(salt: string, authorId: string): string {
  return createHash("sha256").update(`${salt}:${authorId}`).digest("hex");
}

/** Replaces every [[...]] span with the redaction token. */
export function redact(text: string): string {
  return text.replace(/\[\[[\s\S]*?\]\]/g, REDACTED_TOKEN);
}

/** Strips everything that identifies the author: bracketed spans, urls, the author id. */
export function toPublicPuzzle(puzzle: Puzzle, author: Author): PublicPuzzle {
  const salt = puzzleSalt(puzzle.number);
  return {
    number: puzzle.number,
    tweets: puzzle.tweets.map((t) => ({ text: redact(t.text), date: t.date })),
    hints: { category: author.category, descriptor: author.descriptor, initials: author.initials },
    salt,
    answerHash: answerHash(salt, puzzle.authorId),
  };
}

/** Device ids are never stored raw: only this keyed hash reaches the store. */
export function hashDeviceId(deviceId: string): string {
  const secret = process.env.TWEETDLE_SECRET || "tweetdle-dev-secret";
  return createHmac("sha256", secret).update(deviceId).digest("hex");
}

/** Bucket 0-4 = solved on guess 1-5, bucket 5 = missed. */
export function bucketToOutcome(bucket: number) {
  const solved = bucket >= 0 && bucket < SCORE_TABLE.length;
  return {
    solved,
    score: solved ? SCORE_TABLE[bucket] : 0,
    guessesUsed: solved ? bucket + 1 : SCORE_TABLE.length,
  };
}

export function outcomeToBucket(solved: boolean, guessesUsed: number): number {
  return solved ? guessesUsed - 1 : SCORE_TABLE.length;
}

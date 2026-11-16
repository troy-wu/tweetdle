/**
 * Review mode: lets the owner play every puzzle in content/private/ on a local
 * dev server and rate it. Never available in production, and never touches the
 * store, so reviewing does not count in stats, streaks or leaderboards.
 * Server only.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Author, Category } from "@/lib/types";
import { loadLocalContent } from "./store";

export const reviewEnabled = () => process.env.NODE_ENV !== "production";

const RATINGS_FILE = () => path.join(process.cwd(), "content", "private", "review-ratings.json");

export const VERDICTS = ["keep", "maybe", "cut"] as const;

export const RatingSchema = z.object({
  verdict: z.enum(VERDICTS),
  note: z.string().max(1000).default(""),
  solved: z.boolean(),
  guessesUsed: z.number().int().min(1).max(5),
});
export type Rating = z.infer<typeof RatingSchema> & { ratedAt: string };

export interface ReviewListItem {
  number: number;
  category: Category;
  rating: Rating | null;
}

/** Puzzles straight from content/private/puzzles.json, so edits show without reseeding. */
export function reviewContent() {
  return loadLocalContent();
}

export function readRatings(): Record<string, Rating> {
  try {
    return JSON.parse(fs.readFileSync(RATINGS_FILE(), "utf8")) as Record<string, Rating>;
  } catch {
    return {};
  }
}

export function writeRating(n: number, rating: z.infer<typeof RatingSchema>): Rating {
  const all = readRatings();
  const saved: Rating = { ...rating, ratedAt: new Date().toISOString() };
  all[String(n)] = saved;
  fs.writeFileSync(RATINGS_FILE(), JSON.stringify(all, null, 2) + "\n");
  return saved;
}

export function reviewList(): ReviewListItem[] {
  const { authors, puzzles } = reviewContent();
  const byId = new Map<string, Author>(authors.map((a) => [a.id, a]));
  const ratings = readRatings();
  return puzzles
    .map((p) => ({
      number: p.number,
      category: byId.get(p.authorId)?.category ?? ("Internet" as Category),
      rating: ratings[String(p.number)] ?? null,
    }))
    .sort((a, b) => a.number - b.number);
}

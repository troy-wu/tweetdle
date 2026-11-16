import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Game } from "@/components/Game";
import { parsePuzzleNumber } from "@/lib/server/clock";
import { reviewEnabled } from "@/lib/server/review";

export const metadata: Metadata = { title: "Review", robots: { index: false } };

export default async function ReviewPuzzlePage({ params }: { params: Promise<{ n: string }> }) {
  if (!reviewEnabled()) notFound();
  const n = parsePuzzleNumber((await params).n);
  if (n === null) notFound();
  // The key remounts the game when moving between puzzles.
  return <Game key={n} mode="review" reviewNumber={n} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Game } from "@/components/Game";
import { parsePuzzleNumber } from "@/lib/server/clock";

export const metadata: Metadata = { title: "Archive" };

export default async function ArchivePuzzlePage({ params }: { params: Promise<{ n: string }> }) {
  const n = parsePuzzleNumber((await params).n);
  if (n === null) notFound();
  // The key remounts the game when moving between puzzles.
  return <Game key={n} mode="archive" archiveNumber={n} />;
}

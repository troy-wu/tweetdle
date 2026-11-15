import { MAX_GUESSES, SITE_NAME } from "../constants";
import type { HistoryEntry } from "../types";

const WRONG = "🟥";
const RIGHT = "🟩";

/** Spoiler-free share text, e.g. "Tweetdle #42 3/5\n🟥🟥🟩\n🔥 7\nhttps://…". */
export function shareText(entry: HistoryEntry, streak: number, url: string): string {
  const used = Math.max(1, Math.min(entry.guessesUsed, MAX_GUESSES));
  const grid = entry.solved ? WRONG.repeat(used - 1) + RIGHT : WRONG.repeat(MAX_GUESSES);
  const lines = [
    `${SITE_NAME} #${entry.puzzleNumber} ${entry.solved ? used : "X"}/${MAX_GUESSES}`,
    grid,
  ];
  if (streak >= 2) lines.push(`🔥 ${streak}`);
  if (url) lines.push(url);
  return lines.join("\n");
}

import { SCORE_TABLE } from "../constants";

/** Points for a finished game. `guessesUsed` is 1-based. A miss scores 0. */
export function scoreFor(guessesUsed: number, solved: boolean): number {
  if (!solved) return 0;
  return SCORE_TABLE[guessesUsed - 1] ?? 0;
}

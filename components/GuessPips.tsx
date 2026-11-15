import { MAX_GUESSES } from "@/lib/constants";
import type { GameState } from "@/lib/types";

/** Five marks: red for a wrong guess, green for the winning one, empty for unused. */
export function GuessPips({ game }: { game: GameState }) {
  const used = game.guesses.length;
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      {game.status === "playing" && (
        <span className="label whitespace-nowrap">
          Guess {used + 1} of {MAX_GUESSES}
        </span>
      )}
      <div className="flex gap-1" role="img" aria-label={`${used} of ${MAX_GUESSES} guesses used`}>
        {Array.from({ length: MAX_GUESSES }, (_, i) => {
          const won = game.status === "won" && i === used - 1;
          const tone = i >= used ? "border-ink" : won ? "border-good bg-good" : "border-bad bg-bad";
          return <span key={i} className={`h-3 w-3 border ${tone}`} />;
        })}
      </div>
    </div>
  );
}

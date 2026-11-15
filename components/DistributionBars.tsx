import { MAX_GUESSES } from "@/lib/constants";

/** Guess-distribution bars. Index 0-4 = solved on guess 1-5, 5 = missed. */
export function DistributionBars({
  distribution,
  highlight,
}: {
  distribution: readonly number[];
  highlight?: number | null;
}) {
  const max = Math.max(1, ...distribution);
  return (
    <ol className="flex flex-col gap-1">
      {distribution.map((count, i) => {
        const mine = highlight === i;
        return (
          <li key={i} className="flex items-center gap-2 text-sm tabular-nums">
            <span className="w-4 text-center font-semibold" aria-label={i < MAX_GUESSES ? `Guess ${i + 1}` : "Missed"}>
              {i < MAX_GUESSES ? i + 1 : "X"}
            </span>
            <div className="flex-1">
              <div
                className={`flex h-6 min-w-7 items-center justify-end px-1.5 font-semibold ${
                  mine ? "bg-ink text-on-color" : "bg-soft"
                }`}
                style={{ width: `${Math.round((count / max) * 100)}%` }}
              >
                {count}
                {mine && <span className="sr-only"> (you)</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

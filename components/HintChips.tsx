import { HINT_SCHEDULE, type HintKind } from "@/lib/constants";
import type { PublicPuzzle } from "@/lib/types";

const LABELS: Record<HintKind, string> = {
  category: "Category",
  descriptor: "Who",
  initials: "Initials",
};

/** Clues earned so far. Renders nothing until the first one is unlocked. */
export function HintChips({
  hints,
  unlocked,
}: {
  hints: PublicPuzzle["hints"];
  unlocked: readonly HintKind[];
}) {
  const open = HINT_SCHEDULE.filter((kind) => unlocked.includes(kind));
  if (open.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1 border-b border-line pb-4" aria-label="Clues">
      {open.map((kind) => (
        <div key={kind} className="animate-pop contents">
          <dt className="label">{LABELS[kind]}</dt>
          <dd className="font-medium">{hints[kind]}</dd>
        </div>
      ))}
    </dl>
  );
}

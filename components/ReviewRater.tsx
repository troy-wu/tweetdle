"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type ReviewPuzzle, type ReviewVerdict, saveReviewRating } from "@/lib/api";
import { toHistoryEntry } from "@/lib/game";
import type { GameState } from "@/lib/types";

const VERDICTS: { value: ReviewVerdict; label: string }[] = [
  { value: "keep", label: "Keep" },
  { value: "maybe", label: "Maybe" },
  { value: "cut", label: "Cut" },
];

/** Review mode: rate a finished puzzle. Saved to content/private/review-ratings.json. */
export function ReviewRater({ data, game }: { data: ReviewPuzzle; game: GameState }) {
  const router = useRouter();
  const [verdict, setVerdict] = useState<ReviewVerdict | null>(data.rating?.verdict ?? null);
  const [note, setNote] = useState(data.rating?.note ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const n = data.puzzle.number;

  async function save(goNext: boolean) {
    if (!verdict) return;
    setState("saving");
    const entry = toHistoryEntry(game);
    try {
      await saveReviewRating(n, { verdict, note: note.trim(), solved: entry.solved, guessesUsed: entry.guessesUsed });
      setState("saved");
      router.push(goNext && data.next !== null ? `/review/${data.next}` : "/review");
    } catch {
      setState("error");
    }
  }

  return (
    <section className="card flex flex-col gap-4 p-5">
      <div>
        <h2 className="font-display text-xl font-bold">Is this one fun?</h2>
        <p className="text-sm text-muted">The tweets above now show the hidden words. Links open the originals.</p>
      </div>
      <div className="flex gap-2" role="radiogroup" aria-label="Verdict">
        {VERDICTS.map((v) => (
          <button
            key={v.value}
            type="button"
            role="radio"
            aria-checked={verdict === v.value}
            className={`btn flex-1 ${verdict === v.value ? "btn-accent" : ""}`}
            onClick={() => setVerdict(v.value)}
          >
            {v.label}
          </button>
        ))}
      </div>
      <textarea
        className="min-h-20 w-full rounded border border-line bg-bg p-3 text-sm"
        placeholder="Notes (optional): too easy, swap tweet 2, great final reveal…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-accent"
          disabled={!verdict || state === "saving"}
          onClick={() => save(true)}
        >
          {data.next !== null ? `Save and play No. ${data.next}` : "Save and finish"}
        </button>
        <button type="button" className="link text-sm" disabled={!verdict || state === "saving"} onClick={() => save(false)}>
          Save and go to list
        </button>
        {state === "error" && <span className="text-sm text-bad">Could not save. Is the dev server running?</span>}
      </div>
    </section>
  );
}

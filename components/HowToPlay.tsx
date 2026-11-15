"use client";
import { Modal } from "./Modal";

const STEPS = [
  "Every day there is one mystery author. You start with one of their tweets, with its date.",
  "Type a name and pick it from the list. You have five guesses.",
  "Each wrong guess shows another tweet by the same person and a clue: their category, who they are, then their initials.",
  "Fewer guesses means a higher score. Black bars hide words that would give the answer away.",
];

export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to play" onClose={onClose}>
      <ol className="flex flex-col gap-3">
        {STEPS.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-4 shrink-0 font-display text-lg font-bold leading-snug">{i + 1}</span>
            <p className="leading-snug">{step}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-muted">A new puzzle arrives at midnight, the same one for everyone.</p>
      <button type="button" className="btn btn-accent mt-6 w-full" onClick={onClose}>
        Got it
      </button>
    </Modal>
  );
}

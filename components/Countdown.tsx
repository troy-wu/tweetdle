"use client";
import { msUntilNextPuzzle } from "@/lib/game";
import { useNow } from "./hooks";

const pad = (n: number) => String(n).padStart(2, "0");

export function Countdown({ label = "Next puzzle in" }: { label?: string }) {
  const now = useNow();
  let text = "--:--:--";
  if (now > 0) {
    const s = Math.max(0, Math.floor(msUntilNextPuzzle(new Date(now)) / 1000));
    text = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }
  return (
    <div className="text-center">
      <div className="label">{label}</div>
      <div className="text-2xl font-semibold tabular-nums" role="timer">
        {text}
      </div>
    </div>
  );
}

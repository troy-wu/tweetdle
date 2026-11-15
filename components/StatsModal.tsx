"use client";
import Link from "next/link";
import { DistributionBars } from "./DistributionBars";
import { usePlayerStats, useTodayGame } from "./hooks";
import { Modal } from "./Modal";

export function StatsModal({ onClose }: { onClose: () => void }) {
  const stats = usePlayerStats();
  const today = useTodayGame();
  const played = stats?.played ?? 0;
  const winPct = played ? Math.round(((stats?.wins ?? 0) / played) * 100) : 0;
  // Highlight today's outcome in the player's own distribution.
  const highlight =
    today?.status === "won" ? today.guesses.length - 1 : today?.status === "lost" ? 5 : null;

  const tiles = [
    { label: "Played", value: played },
    { label: "Win %", value: winPct },
    { label: "Streak", value: stats?.currentStreak ?? 0 },
    { label: "Best", value: stats?.maxStreak ?? 0 },
  ];

  return (
    <Modal title="Your stats" onClose={onClose}>
      <dl className="grid grid-cols-4 divide-x divide-line border-y border-line text-center">
        {tiles.map((t) => (
          <div key={t.label} className="px-1 py-3">
            <dd className="font-display text-3xl font-bold tabular-nums">{t.value}</dd>
            <dt className="label">{t.label}</dt>
          </div>
        ))}
      </dl>

      <h3 className="label mb-2 mt-6">Your guesses</h3>
      {played > 0 && stats ? (
        <DistributionBars distribution={stats.distribution} highlight={highlight} />
      ) : (
        <p className="text-muted">Play your first puzzle to see your stats here.</p>
      )}
      <p className="mt-5 flex items-baseline justify-between text-sm">
        <span>{stats && played > 0 ? `Total score: ${stats.totalScore}` : ""}</span>
        <Link href="/leaderboard" className="link" onClick={onClose}>
          Leaderboard
        </Link>
      </p>
    </Modal>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { reviewEnabled, reviewList } from "@/lib/server/review";

export const metadata: Metadata = { title: "Review", robots: { index: false } };
export const dynamic = "force-dynamic";

const VERDICT_STYLE = { keep: "text-good", maybe: "text-muted", cut: "text-bad" } as const;

/** Local dev only: every puzzle in content/private/, with your verdicts. Answers are not shown here. */
export default function ReviewPage() {
  if (!reviewEnabled()) notFound();
  const items = reviewList();
  const counts = { keep: 0, maybe: 0, cut: 0 };
  for (const i of items) if (i.rating) counts[i.rating.verdict] += 1;
  const rated = counts.keep + counts.maybe + counts.cut;
  const firstUnrated = items.find((i) => !i.rating)?.number ?? items[0]?.number;

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div>
        <p className="label">Local review · not in the live game</p>
        <h1 className="font-display text-[2rem] font-bold leading-tight tracking-tight">All puzzles</h1>
        <p className="mt-1 text-sm text-muted">
          Play each one cold, then rate it. Nothing here counts toward stats, streaks or the leaderboard. Verdicts
          are saved to <code>content/private/review-ratings.json</code>.
        </p>
      </div>

      <dl className="flex divide-x divide-line border-y border-line text-center">
        {[
          ["Rated", `${rated}/${items.length}`],
          ["Keep", counts.keep],
          ["Maybe", counts.maybe],
          ["Cut", counts.cut],
        ].map(([label, value]) => (
          <div key={label} className="flex-1 px-1 py-2.5">
            <dd className="font-display text-2xl font-bold tabular-nums">{value}</dd>
            <dt className="label">{label}</dt>
          </div>
        ))}
      </dl>

      {firstUnrated !== undefined && (
        <Link href={`/review/${firstUnrated}`} className="btn btn-accent btn-xl w-full">
          {rated === 0 ? "Start with No. 1" : rated < items.length ? `Next unrated: No. ${firstUnrated}` : "Play No. 1 again"}
        </Link>
      )}

      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {items.map((i) => (
          <li key={i.number}>
            <Link href={`/review/${i.number}`} className="flex items-center gap-3 py-2.5 hover:bg-line/30">
              <span className="w-10 font-display font-bold tabular-nums">{i.number}</span>
              <span className="flex-1 text-sm text-muted">{i.category}</span>
              {i.rating ? (
                <span className="text-sm">
                  <span className="text-muted">
                    {i.rating.solved ? `${i.rating.guessesUsed}/5` : "X/5"}
                    {i.rating.note ? " · note" : ""} ·{" "}
                  </span>
                  <span className={`font-semibold capitalize ${VERDICT_STYLE[i.rating.verdict]}`}>{i.rating.verdict}</span>
                </span>
              ) : (
                <span className="text-sm text-muted">Not rated</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

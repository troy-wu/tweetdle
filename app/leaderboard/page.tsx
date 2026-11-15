import type { Metadata } from "next";
import { Leaderboard } from "@/components/Leaderboard";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Today's top Tweetdle scores, all-time totals and longest streaks.",
};

export default function LeaderboardPage() {
  return <Leaderboard />;
}

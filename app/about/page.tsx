import type { Metadata } from "next";
import Link from "next/link";
import { CREATOR_LINKEDIN } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About",
  description: "Who made Tweetdle.",
};

export default function AboutPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 pb-10 pt-6">
      <p className="label">About</p>
      <h1 className="font-display text-[2rem] font-bold leading-tight tracking-tight">Made by one software engineer</h1>
      <p className="text-muted">
        Tweetdle is a small side project: one mystery author a day, five real tweets, five guesses. Every tweet is
        real and links back to the original once the puzzle is over.
      </p>
      <p className="flex gap-5 text-sm">
        <a href={CREATOR_LINKEDIN} className="link" target="_blank" rel="noopener noreferrer">
          Say hi on LinkedIn
        </a>
        <Link href="/" className="link">
          Back home
        </Link>
      </p>
    </div>
  );
}

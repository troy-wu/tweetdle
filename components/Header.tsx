"use client";
import Link from "next/link";
import { useModals } from "./AppShell";
import { AuthButton } from "./AuthButton";
import { HelpIcon, StatsIcon } from "./icons";
import { Wordmark } from "./Wordmark";

export function Header() {
  const { open } = useModals();
  return (
    <header className="sticky top-0 z-30 border-b border-ink bg-bg">
      <div className="mx-auto flex h-14 w-full max-w-[560px] items-center justify-between gap-2 px-4">
        <Link href="/" aria-label="Tweetdle home">
          <Wordmark />
        </Link>
        <nav className="flex items-center" aria-label="Main">
          <Link href="/about" className="mr-1 px-1 text-xs text-muted hover:text-ink">
            About
          </Link>
          <button type="button" className="btn btn-icon" onClick={() => open("help")} aria-label="How to play">
            <HelpIcon />
          </button>
          <button type="button" className="btn btn-icon" onClick={() => open("stats")} aria-label="Your stats">
            <StatsIcon />
          </button>
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}

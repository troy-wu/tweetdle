import { REDACTED_TOKEN } from "@/lib/constants";
import type { PublicTweet } from "@/lib/types";
import { ExternalIcon } from "./icons";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : dateFormat.format(d);
}

/** Tweet text with hidden giveaway words drawn as blocked-out pills. */
export function TweetText({ text }: { text: string }) {
  const parts = text.split(REDACTED_TOKEN);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && (
            <span className="redacted" role="img" aria-label="hidden word" title="Hidden word" />
          )}
          {part}
        </span>
      ))}
    </>
  );
}

export function TweetCard({
  tweet,
  index,
  url,
  animate = true,
}: {
  tweet: PublicTweet;
  index: number;
  /** Link to the original post, shown once the game is over. */
  url?: string;
  animate?: boolean;
}) {
  return (
    <article className={`border-t border-line pt-4 first:border-t-0 first:pt-0 ${animate ? "animate-pop" : ""}`}>
      <header className="label mb-2 flex flex-wrap items-center justify-between gap-2">
        <span>
          Tweet {index + 1} &middot; <time dateTime={tweet.date}>{formatDate(tweet.date)}</time>
        </span>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="link inline-flex items-center gap-1"
          >
            Original <ExternalIcon />
          </a>
        )}
      </header>
      <p className="whitespace-pre-wrap break-words font-display text-[1.3rem] leading-[1.4]">
        <TweetText text={tweet.text} />
      </p>
    </article>
  );
}

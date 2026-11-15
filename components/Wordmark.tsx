/** The Tweetdle masthead: plain serif type, nothing else. */
export function Wordmark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span
      className={`font-display font-bold leading-none tracking-tight ${
        size === "lg" ? "text-[3.25rem] sm:text-6xl" : "text-2xl"
      }`}
    >
      Tweetdle
    </span>
  );
}

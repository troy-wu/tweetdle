import type { Author } from "@/lib/types";

/** Names the player has already guessed wrong. */
export function GuessList({ ids, authors }: { ids: string[]; authors: Author[] }) {
  if (ids.length === 0) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <span className="label">Not</span>
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Wrong guesses">
        {ids.map((id) => (
          <li key={id} className="animate-pop font-medium text-bad line-through decoration-1">
            {authors.find((a) => a.id === id)?.name ?? id}
          </li>
        ))}
      </ul>
    </div>
  );
}

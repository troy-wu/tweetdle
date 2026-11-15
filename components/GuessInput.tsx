"use client";
import { useId, useMemo, useRef, useState } from "react";
import { searchAuthors } from "@/lib/game";
import type { Author } from "@/lib/types";

const MAX_RESULTS = 6;

/**
 * Type-ahead combobox over the author list. Picking a name fills the field;
 * the Guess button (or Enter again) submits it, so a mis-tap never costs a guess.
 * Only names are shown: descriptors would be free hints.
 */
export function GuessInput({
  authors,
  excludeIds,
  disabled,
  onGuess,
}: {
  authors: Author[];
  excludeIds: string[];
  disabled?: boolean;
  onGuess: (author: Author) => void;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Author | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(
    () => (query.trim() ? searchAuthors(authors, query, excludeIds, MAX_RESULTS) : []),
    [authors, query, excludeIds],
  );
  const showList = open && !selected && query.trim().length > 0;
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  function choose(author: Author) {
    setSelected(author);
    setQuery(author.name);
    setOpen(false);
    inputRef.current?.focus();
  }

  function submit() {
    if (disabled) return;
    // Accept an exact typed name even if it was never picked from the list.
    const typed = query.trim().toLowerCase();
    const author =
      selected ??
      results.find((a) => a.name.toLowerCase() === typed) ??
      (results.length === 1 ? results[0] : null);
    if (!author) {
      setOpen(true);
      return;
    }
    setQuery("");
    setSelected(null);
    setOpen(false);
    onGuess(author);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!showList) setOpen(true);
      else if (results.length) setActive((activeIndex + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (showList && results.length)
        setActive((activeIndex - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showList && results[activeIndex]) choose(results[activeIndex]);
      else submit();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <form
      className="relative flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="relative min-w-0 flex-1">
        <input
          ref={inputRef}
          className="field"
          type="text"
          role="combobox"
          aria-label="Guess who tweeted this"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && results[activeIndex] ? `${listId}-${activeIndex}` : undefined
          }
          placeholder="Type a name"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          disabled={disabled}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching people"
          hidden={!showList}
          className="absolute bottom-full left-0 right-0 z-20 mb-1 max-h-[46dvh] overflow-y-auto border border-ink bg-card"
        >
          {results.map((author, i) => (
            <li
              key={author.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`cursor-pointer px-3 py-2.5 text-[1.05rem] font-medium ${
                i === activeIndex ? "bg-ink text-on-color" : ""
              }`}
              // Keep focus in the input so the keyboard stays open on phones.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(author)}
            >
              {author.name}
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-2.5 text-muted" role="presentation">
              No match. Try another name.
            </li>
          )}
        </ul>
      </div>
      <button type="submit" className="btn btn-accent" disabled={disabled || !query.trim()}>
        Guess
      </button>
    </form>
  );
}

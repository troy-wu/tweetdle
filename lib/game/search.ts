import type { Author } from "../types";

/** Lowercase, strip accents, drop apostrophes/periods, turn other punctuation into spaces. */
export function normalizeSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** 0 = prefix, 1 = word prefix, 2 = substring, -1 = no match. */
function matchRank(haystack: string, q: string): number {
  const i = haystack.indexOf(q);
  if (i === -1) return -1;
  if (i === 0) return 0;
  if (haystack.includes(" " + q)) return 1;
  return 2;
}

/**
 * Type-ahead over the author list. Ranking: name prefix, name word-prefix,
 * name substring, then alias matches (prefix before substring).
 */
export function searchAuthors(
  authors: Author[],
  query: string,
  excludeIds: string[] = [],
  limit: number = 8,
): Author[] {
  const q = normalizeSearch(query);
  if (!q) return [];
  const qCompact = q.replace(/ /g, "");
  const exclude = new Set(excludeIds);

  const hits: { author: Author; rank: number; name: string }[] = [];
  for (const author of authors) {
    if (exclude.has(author.id)) continue;
    const name = normalizeSearch(author.name);
    let rank = matchRank(name, q);
    if (rank === -1) {
      let best = -1;
      for (const alias of author.aliases) {
        const a = normalizeSearch(alias);
        let r = matchRank(a, q);
        // Handles are written without spaces: let "elon musk" find "elonmusk".
        if (r === -1) r = matchRank(a.replace(/ /g, ""), qCompact);
        if (r !== -1 && (best === -1 || r < best)) best = r;
      }
      if (best === -1) continue;
      rank = 3 + best;
    }
    hits.push({ author, rank, name });
  }

  hits.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return hits.slice(0, Math.max(0, limit)).map((h) => h.author);
}

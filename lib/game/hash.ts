import type { Author, PublicPuzzle } from "../types";

/** SHA-256 of the UTF-8 bytes of `input`, as lowercase hex. Works in browsers and Node. */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  let hex = "";
  for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Must stay byte-identical to the server's Node crypto version. */
export function answerHash(salt: string, authorId: string): Promise<string> {
  return sha256Hex(`${salt}:${authorId}`);
}

export async function isCorrectGuess(puzzle: PublicPuzzle, authorId: string): Promise<boolean> {
  return (await answerHash(puzzle.salt, authorId)) === puzzle.answerHash.toLowerCase();
}

/** Finds the answer by hashing every author. Used on the reveal screen. */
export async function findAnswerId(puzzle: PublicPuzzle, authors: Author[]): Promise<string | null> {
  const target = puzzle.answerHash.toLowerCase();
  const hashes = await Promise.all(authors.map((a) => answerHash(puzzle.salt, a.id)));
  const i = hashes.indexOf(target);
  return i === -1 ? null : authors[i].id;
}

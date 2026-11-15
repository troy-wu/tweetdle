import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Author, PublicPuzzle } from "../types";
import { answerHash, findAnswerId, isCorrectGuess, sha256Hex } from "./hash";

const nodeHex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

const author = (id: string): Author => ({
  id,
  name: id,
  aliases: [],
  category: "Tech",
  descriptor: "",
  initials: "",
});

const puzzle = (answerId: string): PublicPuzzle => ({
  number: 1,
  tweets: [],
  hints: { category: "Tech", descriptor: "d", initials: "X.Y." },
  salt: "s4lt",
  answerHash: nodeHex(`s4lt:${answerId}`),
});

describe("hash", () => {
  it("sha256Hex matches known vectors and Node crypto", async () => {
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    for (const s of ["hello", "Beyoncé ✨", "salt:barack-obama"]) {
      expect(await sha256Hex(s)).toBe(nodeHex(s));
    }
  });

  it("answerHash is sha256 of `${salt}:${authorId}`", async () => {
    expect(await answerHash("abc123", "elon-musk")).toBe(nodeHex("abc123:elon-musk"));
    expect(await answerHash("abc123", "elon-musk")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("isCorrectGuess checks against the puzzle hash", async () => {
    const p = puzzle("barack-obama");
    expect(await isCorrectGuess(p, "barack-obama")).toBe(true);
    expect(await isCorrectGuess(p, "elon-musk")).toBe(false);
  });

  it("findAnswerId finds the author or returns null", async () => {
    const authors = ["a", "barack-obama", "c"].map(author);
    expect(await findAnswerId(puzzle("barack-obama"), authors)).toBe("barack-obama");
    expect(await findAnswerId(puzzle("someone-else"), authors)).toBeNull();
    expect(await findAnswerId(puzzle("a"), [])).toBeNull();
  });
});

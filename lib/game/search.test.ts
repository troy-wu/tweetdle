import { describe, expect, it } from "vitest";
import type { Author } from "../types";
import { searchAuthors } from "./search";

const a = (id: string, name: string, aliases: string[] = []): Author => ({
  id,
  name,
  aliases,
  category: "Music",
  descriptor: "",
  initials: "",
});

const AUTHORS: Author[] = [
  a("kim-kardashian", "Kim Kardashian", ["kimkardashian"]),
  a("lil-kim", "Lil' Kim", ["queen bee"]),
  a("hakim-ziyech", "Hakim Ziyech"),
  a("jimmy-kimmel", "Jimmy Kimmel", ["jimmykimmel"]),
  a("beyonce", "Beyoncé", ["queen b", "bey"]),
  a("elon-musk", "Elon Musk", ["elonmusk", "kimbal's brother"]),
  a("kylian-mbappe", "Kylian Mbappé", ["KMbappe"]),
  a("jk-rowling", "J.K. Rowling", ["jk_rowling"]),
  a("the-rock", "Dwayne Johnson", ["The Rock", "TheRock"]),
];
const ids = (r: Author[]) => r.map((x) => x.id);

describe("searchAuthors", () => {
  it("returns [] for empty or whitespace queries", () => {
    expect(searchAuthors(AUTHORS, "")).toEqual([]);
    expect(searchAuthors(AUTHORS, "   ")).toEqual([]);
  });

  it("ranks name prefix, then word prefix, then substring, then alias", () => {
    expect(ids(searchAuthors(AUTHORS, "kim"))).toEqual([
      "kim-kardashian", // name prefix
      "jimmy-kimmel", // word prefix (alphabetical before Lil' Kim)
      "lil-kim", // word prefix
      "hakim-ziyech", // substring
      "elon-musk", // alias only
    ]);
  });

  it("is case-insensitive", () => {
    expect(ids(searchAuthors(AUTHORS, "ELON"))).toEqual(["elon-musk"]);
    expect(ids(searchAuthors(AUTHORS, "eLoN mUsK"))).toEqual(["elon-musk"]);
  });

  it("is accent-insensitive in both directions", () => {
    expect(ids(searchAuthors(AUTHORS, "beyonce"))).toEqual(["beyonce"]);
    expect(ids(searchAuthors(AUTHORS, "Beyoncé"))).toEqual(["beyonce"]);
    expect(ids(searchAuthors(AUTHORS, "mbappe"))).toEqual(["kylian-mbappe"]);
    expect(ids(searchAuthors(AUTHORS, "élon"))).toEqual(["elon-musk"]);
  });

  it("matches aliases and handles", () => {
    expect(ids(searchAuthors(AUTHORS, "the rock"))).toEqual(["the-rock"]);
    expect(ids(searchAuthors(AUTHORS, "therock"))).toEqual(["the-rock"]);
    expect(ids(searchAuthors(AUTHORS, "queen"))).toEqual(["beyonce", "lil-kim"]);
    expect(ids(searchAuthors(AUTHORS, "@kimkardashian"))).toEqual(["kim-kardashian"]);
  });

  it("ignores punctuation in names", () => {
    expect(ids(searchAuthors(AUTHORS, "jk rowling"))).toEqual(["jk-rowling"]);
    expect(ids(searchAuthors(AUTHORS, "j.k."))).toEqual(["jk-rowling"]);
    expect(ids(searchAuthors(AUTHORS, "lil kim"))).toEqual(["lil-kim"]);
  });

  it("excludes already-guessed ids", () => {
    expect(ids(searchAuthors(AUTHORS, "kim", ["kim-kardashian", "lil-kim"]))).toEqual([
      "jimmy-kimmel",
      "hakim-ziyech",
      "elon-musk",
    ]);
  });

  it("respects the limit, default 8", () => {
    expect(searchAuthors(AUTHORS, "kim", [], 2)).toHaveLength(2);
    const many = Array.from({ length: 20 }, (_, i) => a(`sam-${i}`, `Sam ${String(i).padStart(2, "0")}`));
    expect(searchAuthors(many, "sam")).toHaveLength(8);
    expect(searchAuthors(many, "sam", [], 50)).toHaveLength(20);
  });

  it("returns [] when nothing matches", () => {
    expect(searchAuthors(AUTHORS, "zzzz")).toEqual([]);
  });
});

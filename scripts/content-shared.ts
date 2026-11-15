/**
 * Helpers shared by scripts/validate-content.ts and scripts/verify-tweets.ts.
 * Pure functions only; importing this file has no side effects.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CATEGORIES } from "../lib/types";

export const ROOT = path.resolve(__dirname, "..");
export const AUTHORS_PATH = path.join(ROOT, "content", "authors.json");
export const PRIVATE_DIR = path.join(ROOT, "content", "private");
export const PUZZLES_PATH = path.join(PRIVATE_DIR, "puzzles.json");
export const OEMBED_CACHE_PATH = path.join(PRIVATE_DIR, ".oembed-cache.json");

export const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** https://x.com/<handle>/status/<id> or the twitter.com form. Nothing after the id. */
export const STATUS_URL_RE = /^https:\/\/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,20})$/;
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_TWEET_LENGTH = 280;
export const TWEETS_PER_PUZZLE = 5;

export const AuthorSchema = z.object({
  id: z.string().regex(KEBAB_RE, "id must be kebab-case"),
  name: z.string().trim().min(1, "name is empty"),
  aliases: z.array(z.string().trim().min(1, "empty alias")),
  category: z.enum(CATEGORIES),
  descriptor: z.string().trim().min(1, "descriptor is empty"),
  initials: z.string().trim().min(1, "initials are empty"),
}).strict();

export const TweetSchema = z.object({
  text: z.string().trim().min(1, "text is empty"),
  date: z.string().regex(ISO_DATE_RE, "date must be YYYY-MM-DD"),
  url: z.string().regex(STATUS_URL_RE, "url must be https://x.com/<handle>/status/<id> (or twitter.com)"),
}).strict();

export const PuzzleSchema = z.object({
  number: z.number().int().positive(),
  authorId: z.string().min(1),
  tweets: z.array(TweetSchema),
}).strict();

export type AuthorT = z.infer<typeof AuthorSchema>;
export type PuzzleT = z.infer<typeof PuzzleSchema>;

export function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function fileExists(file: string): boolean {
  return existsSync(file);
}

/** Returns null when the [[ ]] markers are balanced, otherwise a description of the problem. */
export function bracketProblem(text: string): string | null {
  let open = false;
  for (let i = 0; i < text.length - 1; i++) {
    const two = text.slice(i, i + 2);
    if (two === "[[") {
      if (open) return "nested or repeated [[";
      open = true;
      i++;
    } else if (two === "]]") {
      if (!open) return "]] without a matching [[";
      open = false;
      i++;
    }
  }
  if (open) return "[[ without a matching ]]";
  if (/\[\[\s*\]\]/.test(text)) return "empty [[ ]] span";
  return null;
}

/** Full tweet text with the markers removed (what was actually posted). */
export function stripMarkers(text: string): string {
  return text.replace(/\[\[|\]\]/g, "");
}

/** Text the player sees: bracketed spans replaced by a neutral block. */
export function visibleText(text: string): string {
  return text.replace(/\[\[.*?\]\]/gs, " █ ");
}

/** Tweet length the way X counts it, near enough: Unicode code points. */
export function tweetLength(text: string): number {
  return Array.from(stripMarkers(text).normalize("NFC")).length;
}

/** Lower-case, strip accents, so "Beyoncé" and "beyonce" compare equal. */
export function fold(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case- and accent-insensitive whole-term search. "west" matches "West!" but not "western". */
export function containsTerm(haystack: string, term: string): boolean {
  const t = fold(term).trim();
  if (!t) return false;
  const re = new RegExp(`(?<![a-z0-9])${escapeRe(t)}(?![a-z0-9])`, "i");
  return re.test(fold(haystack));
}

/** Terms that would give the answer away if left visible in a tweet. */
export function giveawayTerms(author: AuthorT): string[] {
  const terms = new Set<string>();
  terms.add(author.name);
  for (const part of author.name.split(/[^\p{L}\p{N}]+/u)) {
    if (Array.from(part).length > 3) terms.add(part);
  }
  for (const alias of author.aliases) terms.add(alias);
  return [...terms].filter((t) => t.trim().length > 0);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–",
  hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m;
  });
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export interface ParsedOEmbed {
  /** Tweet text with links as their visible text and <br> as newlines. */
  text: string;
  /** YYYY-MM-DD (UTC, as printed by X), or null if not found. */
  date: string | null;
  /** Handle of the real author as reported by X, without @. */
  handle: string | null;
  /** True when the tweet carries a photo/video (pic.twitter.com link). */
  hasMedia: boolean;
}

/** Pulls text, date and author out of the blockquote html returned by publish.x.com/oembed. */
export function parseOEmbedHtml(html: string, authorUrl?: string): ParsedOEmbed {
  const p = /<blockquote[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/i.exec(html);
  let body = p ? p[1] : "";
  const hasMedia = /pic\.(?:twitter|x)\.com\//i.test(body);
  body = body.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
  const text = decodeEntities(body);

  let date: string | null = null;
  const d = /<a href="[^"]*\/status\/\d+[^"]*">([A-Za-z]+) (\d{1,2}), (\d{4})<\/a>\s*<\/blockquote>/i.exec(html);
  if (d) {
    const month = MONTHS.indexOf(d[1].toLowerCase());
    if (month >= 0) date = `${d[3]}-${String(month + 1).padStart(2, "0")}-${d[2].padStart(2, "0")}`;
  }

  let handle: string | null = null;
  const h = authorUrl ? /(?:x|twitter)\.com\/([A-Za-z0-9_]+)/i.exec(authorUrl) : null;
  if (h) handle = h[1];
  else {
    const h2 = /\(@([A-Za-z0-9_]+)\)\s*<a href=/i.exec(html);
    if (h2) handle = h2[1];
  }
  return { text, date, handle, hasMedia };
}

const TRAILING_LINK_RE = /\s*(?:https?:\/\/t\.co\/[A-Za-z0-9]+|pic\.(?:twitter|x)\.com\/[A-Za-z0-9]+)\s*$/i;

/** Removes t.co / pic.twitter.com links from the end of a tweet. */
export function stripTrailingLinks(text: string): string {
  let out = text;
  while (TRAILING_LINK_RE.test(out)) out = out.replace(TRAILING_LINK_RE, "");
  return out;
}

/** Canonical form used to compare our stored text with what X returns. */
export function normalizeForCompare(text: string): string {
  return stripTrailingLinks(decodeEntities(stripMarkers(text)).normalize("NFC"))
    .replace(/[​-‍﻿️]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

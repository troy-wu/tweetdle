/**
 * npm run validate:content
 *
 * Validates content/authors.json and, when present, content/private/puzzles.json.
 * Offline: makes no network calls (see verify-tweets.ts for the oEmbed check).
 * Exits 1 if any error is found. Warnings do not fail the run.
 */
import path from "node:path";
import {
  AUTHORS_PATH, AuthorSchema, AuthorT, PUZZLES_PATH, PuzzleSchema, PuzzleT, ROOT, STATUS_URL_RE,
  MAX_TWEET_LENGTH, TWEETS_PER_PUZZLE, bracketProblem, containsTerm, fileExists, fold, giveawayTerms,
  readJson, todayIso, tweetLength, visibleText,
} from "./content-shared";
import { PRACTICE_BASE } from "../lib/constants";
import { CATEGORIES } from "../lib/types";

const errors: string[] = [];
const warnings: string[] = [];
const err = (where: string, msg: string) => errors.push(`${where}: ${msg}`);
const warn = (where: string, msg: string) => warnings.push(`${where}: ${msg}`);
const rel = (p: string) => path.relative(ROOT, p);

function isRealDate(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

function validateAuthors(): Map<string, AuthorT> {
  const byId = new Map<string, AuthorT>();
  const file = rel(AUTHORS_PATH);
  if (!fileExists(AUTHORS_PATH)) {
    err(file, "file is missing");
    return byId;
  }
  let raw: unknown;
  try {
    raw = readJson(AUTHORS_PATH);
  } catch (e) {
    err(file, `not valid JSON (${(e as Error).message})`);
    return byId;
  }
  if (!Array.isArray(raw)) {
    err(file, "top level must be an array of authors");
    return byId;
  }

  const names = new Map<string, string>();
  const aliasOwner = new Map<string, string>();
  raw.forEach((item, i) => {
    const label = `${file} [${i}]${typeof item === "object" && item && "id" in item ? ` "${String((item as { id: unknown }).id)}"` : ""}`;
    const parsed = AuthorSchema.safeParse(item);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) err(label, `${issue.path.join(".") || "(root)"}: ${issue.message}`);
      return;
    }
    const a = parsed.data;
    if (byId.has(a.id)) err(label, `duplicate author id "${a.id}"`);
    else byId.set(a.id, a);

    const nameKey = fold(a.name);
    if (names.has(nameKey)) err(label, `duplicate author name "${a.name}" (also ${names.get(nameKey)})`);
    else names.set(nameKey, a.id);

    const seen = new Set<string>();
    for (const alias of a.aliases) {
      const key = fold(alias);
      if (alias.startsWith("@")) err(label, `alias "${alias}" must not start with @`);
      if (seen.has(key)) warn(label, `alias "${alias}" is listed twice`);
      seen.add(key);
      const owner = aliasOwner.get(key);
      if (owner && owner !== a.id) warn(label, `alias "${alias}" is also used by "${owner}"`);
      else aliasOwner.set(key, a.id);
    }
    if (!/\p{L}|\p{N}/u.test(a.initials)) err(label, `initials "${a.initials}" contain no letters`);
  });

  for (const [key, id] of names) {
    const owner = aliasOwner.get(key);
    if (owner && owner !== id) warn(`${file} "${id}"`, `name is also an alias of "${owner}"`);
  }
  return byId;
}

function validatePuzzles(authors: Map<string, AuthorT>): PuzzleT[] | null {
  const file = rel(PUZZLES_PATH);
  if (!fileExists(PUZZLES_PATH)) return null;
  let raw: unknown;
  try {
    raw = readJson(PUZZLES_PATH);
  } catch (e) {
    err(file, `not valid JSON (${(e as Error).message})`);
    return [];
  }
  if (!Array.isArray(raw)) {
    err(file, "top level must be an array of puzzles");
    return [];
  }

  const today = todayIso();
  const puzzles: PuzzleT[] = [];
  const authorUse = new Map<string, number>();
  const urlUse = new Map<string, string>();
  const statusIdUse = new Map<string, string>();
  let practiceCount = 0;

  raw.forEach((item, i) => {
    const num = typeof item === "object" && item && "number" in item ? String((item as { number: unknown }).number) : "?";
    const label = `puzzle #${num}`;
    const parsed = PuzzleSchema.safeParse(item);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) err(label, `${issue.path.join(".") || "(root)"}: ${issue.message}`);
      return;
    }
    const p = parsed.data;
    puzzles.push(p);

    // Daily puzzles come first, numbered 1..N. Unlimited-mode puzzles follow, numbered PRACTICE_BASE+1...
    if (p.number > PRACTICE_BASE) {
      practiceCount += 1;
      if (p.number !== PRACTICE_BASE + practiceCount) err(label, `expected number ${PRACTICE_BASE + practiceCount} (unlimited puzzles must be contiguous from ${PRACTICE_BASE + 1}, after the daily ones)`);
    } else if (p.number !== i + 1) {
      err(label, `expected number ${i + 1} at position ${i} (daily numbers must be contiguous from 1)`);
    }

    const author = authors.get(p.authorId);
    if (!author) err(label, `authorId "${p.authorId}" is not in authors.json`);

    const prev = authorUse.get(p.authorId);
    if (prev !== undefined) err(label, `author "${p.authorId}" was already used in puzzle #${prev}`);
    else authorUse.set(p.authorId, p.number);

    if (p.tweets.length !== TWEETS_PER_PUZZLE) err(label, `has ${p.tweets.length} tweets, expected exactly ${TWEETS_PER_PUZZLE}`);

    const terms = author ? giveawayTerms(author) : [];
    // Accounts whose handle is just their name (e.g. @rihanna, @dril) need no separate alias.
    const handles = author
      ? new Set([...author.aliases, author.name].map((a) => a.replace(/[^A-Za-z0-9_]/g, "").toLowerCase()))
      : null;

    p.tweets.forEach((t, ti) => {
      const tl = `${label} tweet ${ti + 1}`;

      const bp = bracketProblem(t.text);
      if (bp) err(tl, `unbalanced redaction markers: ${bp}`);

      const len = tweetLength(t.text);
      if (len > MAX_TWEET_LENGTH) err(tl, `text is ${len} characters (max ${MAX_TWEET_LENGTH}, markers not counted)`);

      if (/(?:https?:\/\/t\.co\/\S+|pic\.twitter\.com\/\S+)\s*$/i.test(t.text.replace(/\]\]\s*$/, ""))) {
        err(tl, "text ends with a t.co / pic.twitter.com link; remove trailing media links");
      }
      if (!bp && visibleText(t.text).replace(/[\s█]/g, "") === "") err(tl, "nothing is left visible after redaction");

      if (!isRealDate(t.date)) err(tl, `date "${t.date}" is not a real calendar date`);
      else if (t.date > today) err(tl, `date ${t.date} is in the future`);
      else if (t.date < "2006-03-21") err(tl, `date ${t.date} is before Twitter existed`);

      const m = STATUS_URL_RE.exec(t.url);
      if (m) {
        const prevUrl = statusIdUse.get(m[2]);
        if (prevUrl) err(tl, `duplicate tweet (status ${m[2]} already used by ${prevUrl})`);
        else statusIdUse.set(m[2], tl);
        if (handles && !handles.has(m[1].toLowerCase())) {
          warn(tl, `url handle "${m[1]}" is not among the aliases of "${p.authorId}"`);
        }
      }
      const prevSame = urlUse.get(t.url);
      if (prevSame && !m) err(tl, `duplicate tweet url (already used by ${prevSame})`);
      urlUse.set(t.url, tl);

      if (!bp) {
        const visible = visibleText(t.text);
        for (const term of terms) {
          if (containsTerm(visible, term)) err(tl, `giveaway "${term}" is visible; wrap it in [[ ]]`);
        }
      }
    });

    for (let ti = 1; ti < p.tweets.length; ti++) {
      if (p.tweets[ti].text === p.tweets[ti - 1].text) err(label, `tweets ${ti} and ${ti + 1} have identical text`);
    }
  });

  for (let i = 1; i < puzzles.length; i++) {
    const a = authors.get(puzzles[i - 1].authorId);
    const b = authors.get(puzzles[i].authorId);
    if (a && b && a.category === b.category && puzzles[i].number <= PRACTICE_BASE) {
      warn(`puzzle #${puzzles[i].number}`, `same category (${b.category}) as the previous day`);
    }
  }
  return puzzles;
}

function main(): void {
  console.log("Tweetdle content validation");
  console.log("===========================");

  const authors = validateAuthors();
  const perCategory = new Map<string, number>();
  for (const a of authors.values()) perCategory.set(a.category, (perCategory.get(a.category) ?? 0) + 1);
  console.log(`\n${rel(AUTHORS_PATH)}: ${authors.size} valid authors`);
  for (const c of CATEGORIES) console.log(`  ${c.padEnd(10)} ${perCategory.get(c) ?? 0}`);

  const puzzles = validatePuzzles(authors);
  if (puzzles === null) {
    console.log(`\n${rel(PUZZLES_PATH)}: not present, skipping puzzle checks (the file is private and gitignored).`);
  } else {
    const tweets = puzzles.reduce((n, p) => n + p.tweets.length, 0);
    console.log(`\n${rel(PUZZLES_PATH)}: ${puzzles.length} puzzles, ${tweets} tweets`);
    const cats = new Map<string, number>();
    for (const p of puzzles) {
      const c = authors.get(p.authorId)?.category ?? "(unknown author)";
      cats.set(c, (cats.get(c) ?? 0) + 1);
    }
    for (const [c, n] of cats) console.log(`  ${c.padEnd(10)} ${n}`);
  }

  if (warnings.length) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
  if (errors.length) {
    console.log(`\nErrors (${errors.length}):`);
    for (const e of errors) console.log(`  x ${e}`);
    console.log(`\nFAILED: ${errors.length} error(s), ${warnings.length} warning(s).`);
    process.exit(1);
  }
  console.log(`\nOK: no errors, ${warnings.length} warning(s).`);
}

main();

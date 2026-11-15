/**
 * Upserts content/authors.json and content/private/puzzles.json into Supabase.
 * Run with `npm run seed`. Needs NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY (read from the environment or .env.local).
 * Re-running is safe: rows are upserted by primary key. Rows that are no longer
 * in the files are left alone.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Author, Puzzle } from "../lib/types";

const root = process.cwd();

function fail(message: string): never {
  console.error(`\nSeed failed: ${message}\n`);
  process.exit(1);
}

function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    try {
      process.loadEnvFile(full); // does not override variables that are already set
    } catch (err) {
      fail(`could not parse ${file}: ${(err as Error).message}`);
    }
  }
}

function readJsonArray<T>(relative: string, hint: string): T[] {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) fail(`${relative} does not exist. ${hint}`);
  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (err) {
    fail(`${relative} is not valid JSON: ${(err as Error).message}`);
  }
  if (!Array.isArray(data) || data.length === 0) fail(`${relative} must be a non-empty JSON array.`);
  return data as T[];
}

async function main() {
  loadEnvFiles();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [!url && "NEXT_PUBLIC_SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean);
  if (!url || !key) {
    fail(`missing ${missing.join(" and ")}. Set them in .env.local (see .env.example and supabase/README.md).`);
  }

  const authors = readJsonArray<Author>("content/authors.json", "It is produced by the content workstream.");
  const puzzles = readJsonArray<Puzzle>(
    "content/private/puzzles.json",
    "This file holds the answers and is gitignored, so it must be copied onto this machine by hand.",
  );

  // Catch broken content before touching the database.
  const authorIds = new Set<string>();
  for (const a of authors) {
    if (!a?.id || !a.name || !a.category || !a.descriptor || !a.initials || !Array.isArray(a.aliases)) {
      fail(`content/authors.json: malformed author ${JSON.stringify(a?.id ?? a)}.`);
    }
    if (authorIds.has(a.id)) fail(`content/authors.json: duplicate author id "${a.id}".`);
    authorIds.add(a.id);
  }
  const numbers = new Set<number>();
  for (const p of puzzles) {
    if (!Number.isInteger(p?.number) || p.number < 1) fail(`puzzles.json: bad puzzle number ${JSON.stringify(p?.number)}.`);
    if (numbers.has(p.number)) fail(`puzzles.json: duplicate puzzle number ${p.number}.`);
    numbers.add(p.number);
    if (!authorIds.has(p.authorId)) fail(`puzzle ${p.number}: author is not in content/authors.json.`);
    if (!Array.isArray(p.tweets) || p.tweets.length !== 5) fail(`puzzle ${p.number}: needs exactly 5 tweets.`);
    for (const t of p.tweets) {
      if (!t?.text || !t.date || !t.url) fail(`puzzle ${p.number}: every tweet needs text, date and url.`);
    }
  }

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const upsert = async (table: string, rows: Record<string, unknown>[], onConflict: string) => {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await db.from(table).upsert(rows.slice(i, i + 200), { onConflict });
      if (error) {
        const hint = /relation|schema cache|does not exist/i.test(error.message)
          ? " Did you run supabase/migrations/0001_init.sql?"
          : "";
        fail(`upsert into ${table}: ${error.message}.${hint}`);
      }
    }
  };

  // Authors first: puzzles.author_id references them.
  await upsert(
    "authors",
    authors.map(({ id, name, aliases, category, descriptor, initials }) => ({
      id,
      name,
      aliases,
      category,
      descriptor,
      initials,
    })),
    "id",
  );
  await upsert(
    "puzzles",
    puzzles.map((p) => ({
      number: p.number,
      author_id: p.authorId,
      tweets: p.tweets.map(({ text, date, url }) => ({ text, date, url })),
    })),
    "number",
  );

  const sorted = [...numbers].sort((a, b) => a - b);
  console.log(`Seeded ${authors.length} authors and ${puzzles.length} puzzles (#${sorted[0]} to #${sorted[sorted.length - 1]}).`);
  const gaps = sorted.filter((n, i) => i > 0 && n !== sorted[i - 1] + 1);
  if (sorted[0] !== 1 || gaps.length) console.warn("Warning: puzzle numbers are not a continuous run starting at 1.");
}

main().catch((err) => fail((err as Error).message));

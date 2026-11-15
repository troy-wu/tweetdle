/**
 * npm run verify:tweets [-- --refresh] [-- --puzzle 12]
 *
 * Checks every tweet in content/private/puzzles.json against X's free, keyless
 * oEmbed endpoint and compares text, date and author handle.
 *
 *   OK           text, date and handle match what X returns
 *   MISMATCH     X returned the tweet but something differs (or the tweet is gone: 404/403)
 *   UNREACHABLE  network error / rate limit after retries; nothing can be concluded
 *
 * Successful responses are cached in content/private/.oembed-cache.json so reruns are
 * cheap; pass --refresh to ignore the cache. Exit code: 1 if any MISMATCH, 2 if there
 * are no mismatches but some tweets were UNREACHABLE, 0 if every tweet is OK.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import {
  OEMBED_CACHE_PATH, PRIVATE_DIR, PUZZLES_PATH, PuzzleSchema, PuzzleT, STATUS_URL_RE, fileExists,
  normalizeForCompare, parseOEmbedHtml, readJson,
} from "./content-shared";

const ENDPOINTS = ["https://publish.x.com/oembed", "https://publish.twitter.com/oembed"];
const THROTTLE_MS = 350;
const MAX_ATTEMPTS = 4;
const TIMEOUT_MS = 15000;

interface CacheEntry { html: string; author_url?: string; fetchedAt: string }
type Cache = Record<string, CacheEntry>;
type Fetched =
  | { kind: "ok"; entry: CacheEntry; cached: boolean }
  | { kind: "gone"; status: number }
  | { kind: "unreachable"; reason: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadCache(): Cache {
  if (!fileExists(OEMBED_CACHE_PATH)) return {};
  try {
    return readJson(OEMBED_CACHE_PATH) as Cache;
  } catch {
    return {};
  }
}

function saveCache(cache: Cache): void {
  mkdirSync(PRIVATE_DIR, { recursive: true });
  writeFileSync(OEMBED_CACHE_PATH, JSON.stringify(cache, null, 1) + "\n");
}

let lastCall = 0;
async function fetchOEmbed(url: string, cache: Cache, refresh: boolean): Promise<Fetched> {
  const id = STATUS_URL_RE.exec(url)?.[2] ?? url;
  if (!refresh && cache[id]) return { kind: "ok", entry: cache[id], cached: true };

  let reason = "no attempt made";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    const wait = lastCall + THROTTLE_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    try {
      const res = await fetch(`${endpoint}?url=${encodeURIComponent(url)}&omit_script=true&dnt=true`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: "application/json", "user-agent": "tweet-verify/1.0" },
        redirect: "follow",
      });
      if (res.status === 404 || res.status === 403) return { kind: "gone", status: res.status };
      if (res.ok) {
        const json = (await res.json()) as { html?: string; author_url?: string };
        if (typeof json.html === "string" && json.html.includes("<blockquote")) {
          const entry: CacheEntry = { html: json.html, author_url: json.author_url, fetchedAt: new Date().toISOString() };
          cache[id] = entry;
          return { kind: "ok", entry, cached: false };
        }
        reason = "response had no tweet html";
      } else {
        reason = `HTTP ${res.status}`;
      }
    } catch (e) {
      reason = (e as Error).message || String(e);
    }
    await sleep(1000 * 2 ** attempt);
  }
  return { kind: "unreachable", reason };
}

function loadPuzzles(): PuzzleT[] {
  const raw = readJson(PUZZLES_PATH);
  if (!Array.isArray(raw)) throw new Error("puzzles.json must be an array");
  return raw.map((p, i) => {
    const parsed = PuzzleSchema.safeParse(p);
    if (!parsed.success) throw new Error(`puzzle at index ${i} is malformed; run npm run validate:content first`);
    return parsed.data;
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const refresh = args.includes("--refresh");
  const only = args.includes("--puzzle") ? Number(args[args.indexOf("--puzzle") + 1]) : null;

  console.log("Tweetdle tweet verification (X oEmbed)");
  console.log("======================================");
  if (!fileExists(PUZZLES_PATH)) {
    console.log("content/private/puzzles.json is not present; nothing to verify.");
    return;
  }

  const puzzles = loadPuzzles().filter((p) => only === null || p.number === only);
  const cache = loadCache();
  let ok = 0, mismatch = 0, unreachable = 0, fromCache = 0, total = 0;
  const problems: string[] = [];

  for (const p of puzzles) {
    console.log(`\n#${p.number} ${p.authorId}`);
    for (let i = 0; i < p.tweets.length; i++) {
      const t = p.tweets[i];
      total++;
      const where = `#${p.number} tweet ${i + 1}`;
      const m = STATUS_URL_RE.exec(t.url);
      if (!m) {
        mismatch++;
        console.log(`  MISMATCH     ${i + 1}. not a status url: ${t.url}`);
        problems.push(`${where}: not a status url`);
        continue;
      }
      const got = await fetchOEmbed(t.url, cache, refresh);
      if (got.kind === "unreachable") {
        unreachable++;
        console.log(`  UNREACHABLE  ${i + 1}. ${t.url} (${got.reason})`);
        continue;
      }
      if (got.kind === "gone") {
        mismatch++;
        console.log(`  MISMATCH     ${i + 1}. ${t.url} (X returned HTTP ${got.status}: deleted, protected or wrong id)`);
        problems.push(`${where}: X returned HTTP ${got.status}`);
        continue;
      }
      if (got.cached) fromCache++;
      else if (total % 10 === 0) saveCache(cache);

      const remote = parseOEmbedHtml(got.entry.html, got.entry.author_url);
      const diffs: string[] = [];
      const ours = normalizeForCompare(t.text);
      const theirs = normalizeForCompare(remote.text);
      if (ours !== theirs) diffs.push(`text differs\n        ours: ${JSON.stringify(ours)}\n        X:    ${JSON.stringify(theirs)}`);
      if (remote.date === null) diffs.push("could not read the date from X's response");
      else if (remote.date !== t.date) diffs.push(`date differs (ours ${t.date}, X ${remote.date})`);
      if (remote.handle && remote.handle.toLowerCase() !== m[1].toLowerCase()) {
        diffs.push(`author differs (url says ${m[1]}, X says ${remote.handle})`);
      }

      if (diffs.length) {
        mismatch++;
        console.log(`  MISMATCH     ${i + 1}. ${t.url}`);
        for (const d of diffs) console.log(`      - ${d}`);
        problems.push(`${where}: ${diffs.map((d) => d.split("\n")[0]).join("; ")}`);
      } else {
        ok++;
        console.log(`  OK           ${i + 1}. ${t.date} ${t.url}${got.cached ? " (cached)" : ""}`);
      }
    }
  }
  saveCache(cache);

  console.log("\nSummary");
  console.log("-------");
  console.log(`  puzzles:     ${puzzles.length}`);
  console.log(`  tweets:      ${total}`);
  console.log(`  OK:          ${ok} (${fromCache} from cache)`);
  console.log(`  MISMATCH:    ${mismatch}`);
  console.log(`  UNREACHABLE: ${unreachable}`);
  if (problems.length) {
    console.log("\nMismatches:");
    for (const p of problems) console.log(`  x ${p}`);
  }
  if (mismatch > 0) process.exit(1);
  if (unreachable > 0) {
    console.log("\nSome tweets could not be checked (network). Rerun before seeding.");
    process.exit(2);
  }
  console.log("\nAll tweets verified.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

# Tweetdle — build plan

## Context

Tweetdle is a daily "who tweeted this?" game in the Wordle family. Everyone gets the same mystery person each day and has 5 guesses. The goal is a dead-simple, slightly cartoonish, shareable game that can be advertised on Reddit and sent to streamers, running on free tiers at launch but designed so a traffic spike does not take it down.

Repo: `github.com/troy-wu/tweetdle` (public, contains only a one-line README). Nothing to reuse; this is greenfield.

### What already exists (and how we beat it)

| Game | What it is | Gap we exploit |
|---|---|---|
| guesswho.app "Who Tweeted" | One of six mini-games in a hub; 5 questions/day from a date seed, no sign-up | Not a focused brand; no progressive hints, no leaderboard, generic design |
| Who Said That? (Product Hunt) | Guess the author from recent tweets of popular accounts | Not daily, not shareable, depends on live Twitter API |
| Tweedle | Wordle for a *word* inside a profile's tweets | Different game |
| Utter | Party game with your friends' tweets | Different audience |

Nobody has the full Wordle loop (one daily puzzle, progressive hints, emoji share grid, streaks, global stats, leaderboard) for tweets. That is the product.

### Decisions confirmed with the user

- **Format:** one mystery author per day, up to 5 tweets. Tweet 1 is the most obscure; each wrong guess reveals another tweet by the same person plus a hint.
- **Guess input:** type-ahead search over a fixed list of famous accounts.
- **Stack:** Next.js (App Router, TypeScript, Tailwind) + Supabase + Vercel.
- **Login:** guest play saved in the browser; optional Google or email magic link to sync and join the leaderboard.

## Game design

**Round flow** (5 guesses max):

| After wrong guess | New tweet shown | Hint unlocked |
|---|---|---|
| start | Tweet 1 (obscure) | none |
| 1 | Tweet 2 | Dates of all shown tweets |
| 2 | Tweet 3 | Category (Politics, Music, Sports, Tech, Media, Internet...) |
| 3 | Tweet 4 | Descriptor ("American rapper", "Former head of state") |
| 4 | Tweet 5 (iconic) | Initials |

- **Score:** 100 / 80 / 60 / 40 / 20 for solving on guess 1–5, 0 for a miss. Leaderboard tie-break is solve time.
- **Tweets are sanitized:** the author's own name/handle and giveaway @-mentions are replaced with a blurred block. Tweets render in our own card (text + date once unlocked), never with avatar or handle.
- **Reveal screen:** confetti on a win, author name, link out to each original tweet, score, streak flame, global guess-distribution bars with "you beat X% of players", countdown to the next puzzle, Share button.
- **Share text:** `Tweetdle #42 3/5 🟥🟥🟩 🔥7` + URL, via Web Share API with clipboard fallback. No spoilers.
- **Screens:** Home (big START, Leaderboard, How to play), Game, Result, Leaderboard (Today / All-time / Streaks), Stats modal.
- **Look:** bold rounded display font (Fredoka for headings, Inter for body), thick 3px borders, hard offset shadows, one bright accent colour, chunky buttons, mobile-first single column. Light and dark themes.

## Where the tweets come from

There is no ready-made "important tweets" database, and live Twitter/X API access is paid, so the game uses a **curated, static content set that never calls X at runtime**.

- **`authors`** (~300 guessable people): id, display name, search aliases, category, descriptor, initials. Public.
- **`puzzles`**: puzzle number, author id, 5 tweets ordered obscure → iconic (text, date, original URL, redaction spans). **Private**: the repo is public, so puzzle answers must live only in Supabase and in a gitignored seed file, never in git.
- **Sources for candidates:** Wikipedia's most-liked / most-retweeted tweet lists, editorial "most iconic tweets" lists (NYT, TIME, Vice, Shortlist), the Trump Twitter Archive, per-celebrity Kaggle tweet datasets (text + like counts, good for finding obscure-but-characteristic tweets).
- **Verification:** every tweet must have a real status URL. A script checks each URL against X's free, keyless oEmbed endpoint (`publish.x.com/oembed`) and diffs the returned text against ours. Anything unverifiable is dropped. A human (the user) reads the final list before seeding; no invented tweets.
- **Launch target:** 45 puzzles (225 tweets), giving six weeks of runway. Adding more is a content task, not a code change.
- **Risk to know about:** quoting tweet text outside X's official embed is a grey area under X's terms. Mitigations: short quotes only, always link to the original on reveal, honour takedown requests, skip private individuals. Avoid profile photos entirely.

## Architecture (free-tier friendly)

- **Puzzle delivery:** `GET /api/puzzle/[n]` returns that day's 5 tweets, hints and a salted hash of the answer. Response is CDN-cached for a day, so a spike costs almost nothing. Requests for future puzzle numbers are refused.
- **Guess checking is client-side** against the hash (like Wordle), so guessing never touches the server.
- **One write per player per day:** `POST /api/result` sends the guess list; the server re-checks it against the real answer, updates the aggregate distribution (guests included, deduped by device id), and stores a leaderboard row for signed-in users.
- **Puzzle number** = days since launch in the player's local date; the server rejects anything ahead of the latest timezone on Earth.
- **Supabase tables:** `authors`, `puzzles` (service-role only), `profiles`, `results` (unique per user + puzzle), `daily_stats` (distribution counters updated through an RPC). RLS on; all writes go through server routes.
- **Leaderboards** are read from SQL views and cached 60 seconds.
- **Guest → account:** on first sign-in, local history is uploaded once and merged; from then on the server is the source of truth for streaks.
- **Keep-alive:** a daily Vercel cron pings Supabase, since free projects pause after 7 idle days.
- **Limits to watch:** Supabase free = 500 MB DB, 50k monthly signed-in users; Vercel Hobby is non-commercial, so move to Pro (or Cloudflare) before adding ads.

## Execution plan for subagents

Each workstream owns its own folders, so B–E can run in parallel after A. Every agent gets this file plus `lib/types.ts` as its contract.

**A. Scaffold (first, alone)**
- Clone the repo, create a Next.js App Router + TypeScript + Tailwind app, add Vitest and Playwright, ESLint, `.env.example`, `.gitignore` (including `content/private/`).
- Write `lib/types.ts` (Author, Puzzle, PublicPuzzle, GameState, ResultPayload, LeaderboardRow) and `lib/constants.ts` (launch date, max guesses, score table, hint order).
- Add `content/fixtures/` with 3 fake puzzles and 20 authors for everyone else to build against.
- Done when: `npm run dev`, `npm test`, `npm run lint` all pass on an empty home page.

**B. Game engine — `lib/game/`** (pure TypeScript, no React)
- `engine.ts` (state reducer: guess, reveal, win/lose), `score.ts`, `puzzleNumber.ts`, `hash.ts` (answer hashing), `storage.ts` (versioned localStorage: today's state, history, streak), `share.ts` (emoji string), `search.ts` (alias-aware, accent-insensitive type-ahead).
- Done when: unit tests cover all 6 outcomes, streak break/continue across dates, reload mid-game, and share strings.

**C. UI — `app/` pages and `components/`**
- Design tokens in Tailwind config; components: `TweetCard`, `HintChips`, `GuessInput` (keyboard and touch friendly combobox), `GuessList`, `ResultModal` (confetti, distribution bars, countdown, share), `StatsModal`, `Leaderboard`, `HowToPlay`, `AuthButton`, header/footer.
- Builds against fixtures and the engine's types; no direct Supabase calls (uses `lib/api.ts` stubs that D fills in).
- Done when: full game playable on fixtures at 375px width and desktop, light and dark, with reveal animations.

**D. Backend — `supabase/`, `app/api/`, `lib/supabase/`, `lib/api.ts`**
- SQL migrations for tables, RLS, the stats RPC and leaderboard views; seed script reading `content/private/puzzles.json`.
- Routes: `puzzle/[n]`, `result`, `stats/[n]`, `leaderboard`, `sync` (guest merge), `cron/keepalive`; auth callback for Google and magic link via `@supabase/ssr`.
- Input validation, per-device dedupe, basic IP rate limit, cache headers.
- Done when: route tests pass against a local Supabase (`supabase start`), including rejecting future puzzles, duplicate submits and forged scores.

**E. Content — `scripts/`, `content/authors.json`, `content/private/`**
- Build the ~300-author list with aliases, category, descriptor.
- Collect candidate tweets from the sources above, pick 5 per author ordered obscure → iconic, mark redaction spans.
- `scripts/validate-content.ts` (schema, ≤280 chars, no author name leaking in text, no duplicate authors within 60 days) and `scripts/verify-tweets.ts` (oEmbed check).
- Output a review sheet for the user to approve before seeding.
- Done when: 45 puzzles pass both scripts and are approved.

**F. Integration and launch (last, alone)**
- Wire UI to real API, remove stubs, add OG image and metadata, favicon, privacy page, analytics (Vercel Analytics).
- Playwright end-to-end: win on guess 1, win on guess 4, lose, reload mid-game, share, sign-in sync (mocked auth).
- Deploy to Vercel, run migrations and seed on the hosted Supabase project.

**Needed from the user** (accounts cannot be created on their behalf): a Supabase project, a Google OAuth client, a Vercel project linked to the repo, and optionally a domain. Agents will list the exact env vars in `.env.example`.

## Verification

- `npm test` — engine and route unit tests.
- `npm run validate:content` and `npm run verify:tweets` — content integrity.
- `npx playwright test` — the end-to-end flows listed in F, at mobile and desktop sizes.
- Manual pass in the browser on the deployed preview: play today's puzzle as a guest, refresh, finish, share, sign in, confirm the result appears on the leaderboard and the distribution updates; change the device date to confirm tomorrow's puzzle is refused.
- Load sanity check: hit `/api/puzzle/[n]` repeatedly and confirm responses are served from the CDN cache, not the function.

## Later (not in this build)

See `docs/IDEAS.md` for the open theming question (AI, NBA, an easy "anyone can get it" pool).

Archive of past puzzles, themed packs (music week, sports week), friend leagues, streamer mode with hidden answer overlay, ads/Pro hosting, user-submitted tweets with moderation.

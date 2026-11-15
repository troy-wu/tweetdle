# Tweetdle content

This folder holds the game's content: the people players can guess and the daily puzzles.
The repository is public, so puzzle answers live only in `content/private/`, which is gitignored.
Never commit anything from `content/private/`, and never paste real puzzle answers into this README,
issues, PRs or commit messages.

```
content/
  authors.json          # committed: every guessable person (public, shipped to the browser)
  fixtures/             # committed: fake sample data for tests (authors.json, puzzles.json)
  private/              # gitignored: real answers
    puzzles.json        # the puzzles (Puzzle[])
    REVIEW.md           # human review sheet: each tweet's text, date, link and source page
    .oembed-cache.json  # cache written by npm run verify:tweets
```

Types are defined in `lib/types.ts` (`Author`, `Tweet`, `Puzzle`).

## authors.json

An array of `Author`:

```json
{"id":"ada-mockwell","name":"Ada Mockwell","aliases":["adamockwell","Ada M"],"category":"Tech","descriptor":"Startup founder","initials":"A.M."}
```

- `id`: stable kebab-case, unique. Puzzles refer to it.
- `name`: display name, unique (accent- and case-insensitive).
- `aliases`: extra search terms: X handle without `@`, nicknames, alternate spellings. If the X handle
  differs from the name (ignoring spaces and punctuation), list it here; the validator warns when a
  tweet URL's handle matches neither the name nor an alias.
- `category`: one of the `CATEGORIES` in `lib/types.ts`.
- `descriptor`: short, spoiler-free hint ("American rapper"). Must not contain the name.
- `initials`: e.g. `"B.O."`.

The name, every alias and every word of the name longer than 3 letters count as giveaways (see below).

## private/puzzles.json

An array of `Puzzle`, numbered contiguously from 1 (position 0 is puzzle 1, and so on):

Unlimited-mode puzzles go after the daily ones in the same file, numbered contiguously from 100001
(`PRACTICE_BASE + 1` in `lib/constants.ts`). They are never a daily puzzle and never count for
streaks or leaderboards. Their authors must not also be a daily answer.

```json
{"number": 1, "authorId": "ada-mockwell", "tweets": [
  {"text": "Slept under my desk again. Worth it.", "date": "2012-03-04", "url": "https://x.com/adamockwell/status/123"},
  ...exactly 5 tweets...
]}
```

- Exactly 5 tweets, ordered from most obscure (shown first) to most iconic (shown last).
- `text`: the exact posted text, with trailing `t.co` / `pic.twitter.com` links removed and giveaways
  wrapped in `[[ ]]`. Max 280 characters, markers not counted.
- `date`: `YYYY-MM-DD`, as X reports it (the date in the oEmbed response, UTC).
- `url`: `https://x.com/<handle>/status/<id>` (or the `twitter.com` form), nothing after the id.
- Each author appears in at most one puzzle, each tweet at most once.
- Avoid the same category on consecutive days (the validator warns).

See `fixtures/puzzles.json` for a complete example with fake data.

### The bracket convention

Wrap anything that would give the answer away in double square brackets. The game replaces each span with a
neutral block before the tweet reaches the browser, and the full text is revealed after the game.

- The author's own name, handle or nickname: `"Sold out again. Love you all, [[Ada]]"`
- Their company, band, team or show: `"Proud to announce [[Mockwell Labs]] is hiring"`
- Their own album, song or product names: `"Pre-orders for [[Mockwell One]] open Friday."`

Rules: brackets must be balanced and not nested, a span must not be empty, and some text must remain visible.
The validator flags any visible occurrence of the name, a long word of the name or an alias, but it cannot know
product or company names, so check those by eye.

## Sourcing and verification rules

Every tweet must be real. Never write a tweet's text or status id from memory.

1. Find the tweet on a web page you actually open: list articles of a person's best or most famous tweets,
   news articles that embed or link the tweets they quote, Wikipedia articles and their references, tweet
   archives and public datasets. Many pages give text without a link; only keep a tweet if you find its
   status URL. Record the page in `REVIEW.md`.
2. Confirm it with X's public oEmbed endpoint (no key needed):

   ```sh
   curl -s "https://publish.x.com/oembed?url=https://x.com/<handle>/status/<id>&omit_script=true"
   ```

   The JSON `html` holds the tweet text, the author and the date; `author_url` is the real account.
   Keep the tweet only if the text matches yours (after normalising whitespace, HTML entities and trailing
   `t.co` links) and `author_url` is the expected account. Take the date from the oEmbed response.
   A 404/403 means the tweet was deleted, the account is protected or the id is wrong: drop it.
3. Watch for long posts: oEmbed truncates posts over 280 characters and ends them with `…`. Skip those.
4. Content guidelines: English, original tweets (not retweets or replies that need their context),
   tweets that make sense without their image or video, no slurs, no graphic content, no tragedies involving
   private people. Prefer authors with long, characterful histories where 5 good tweets are findable.

## Adding puzzles

1. Pick an author from `authors.json` (or add one; keep ids kebab-case and run the validator).
2. Find and confirm 5 tweets as above.
3. Append a puzzle to `content/private/puzzles.json` with the next `number`. Order the tweets obscure to iconic.
4. Add the author, tweets, dates, links and source pages to `content/private/REVIEW.md` for the owner to approve.
5. Run both scripts:

```sh
npm run validate:content   # offline: schema, numbering, giveaways, lengths, dates, duplicates, categories
npm run verify:tweets      # online: re-checks every tweet against X oEmbed (text, date, author)
```

`validate:content` exits 1 on any error (warnings do not fail it). `verify:tweets` caches successful lookups in
`content/private/.oembed-cache.json`; pass `-- --refresh` to ignore the cache or `-- --puzzle 12` to check one
puzzle. It exits 1 on any mismatch, 2 if some tweets could not be reached (rerun later), 0 when every tweet is OK.
Both must pass before puzzles are seeded.

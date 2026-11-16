# Ideas parked for later

## Theming (open question, 2026-11-15)

**Worry:** a general pool risks puzzles most players can't get. Plenty of people won't know the
rap industry, the music industry or the AI world well enough to guess from five tweets.

**Decision for now:** keep one theme. Use the review pass (`/review` on a local dev server) to judge
whether the current 30 are fun enough before restructuring anything.

**Directions to revisit:**

- **AI theme.** The most timely: outlandish things people tweet about AI (founders, researchers,
  investors, critics). Strong for Reddit and tech streamers right now.
- **NBA theme.** Players, owners and commentators. A big, very online fan base that knows these voices.
- **"Anyone can get it" tier.** Only hugely prominent, prolific tweeters (Kanye is the model: an
  enormous, unmistakable archive). Could be the default daily pool, with niche themes as packs.
- These can combine: an easy general daily plus themed packs (AI week, NBA week). `docs/PLAN.md`
  already lists themed packs under "Later".

**What the review data can tell us:** `content/private/review-ratings.json` records keep/maybe/cut,
whether you solved it and in how many guesses. Cuts that cluster in one category point to the
"too niche" problem.

# tweetdle

daily tweet guessing game. A new mystery tweeter every day: five tweets, five guesses.

## Develop

```bash
npm install
npm run dev
```

With no Supabase env vars set, the app runs on sample puzzles from `content/fixtures/`. See `.env.example` and `docs/PLAN.md`.

Real puzzle answers live in `content/private/` (gitignored) and in Supabase, never in git.

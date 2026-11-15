# Supabase setup

Tweetdle runs without Supabase (sample puzzles, in-memory stats, no accounts).
Follow these steps to turn on real puzzles, persistent stats, sign-in and the
leaderboard. Allow about 15 minutes.

## 1. Create the project

1. Go to <https://supabase.com/dashboard> and choose **New project** (the free plan is enough).
2. Pick a region close to your players and save the database password somewhere safe.
3. Open **Project Settings -> API** (or **API Keys**) and copy three values:
   - Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / publishable key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` / secret key -> `SUPABASE_SERVICE_ROLE_KEY` (server only, never share it)

## 2. Run the migration

1. Open **SQL Editor -> New query**.
2. Paste the whole of `supabase/migrations/0001_init.sql` and press **Run**.
3. It should finish with no errors. It is safe to run again.

With the Supabase CLI instead: `supabase link --project-ref <ref>` then `supabase db push`.

Check afterwards, in **Table Editor**: `authors`, `puzzles`, `profiles`, `results`,
`daily_stats` and `device_plays` exist and each shows "RLS enabled".

## 3. Set the redirect URLs

**Authentication -> URL Configuration**:

- **Site URL**: your production URL, e.g. `https://tweetdle.example`
- **Redirect URLs**, add each of:
  - `http://localhost:3000/auth/callback`
  - `https://<your-production-domain>/auth/callback`
  - `https://*-<your-vercel-team>.vercel.app/auth/callback` (only if you want sign-in on Vercel preview deploys)

## 4. Enable email magic links

**Authentication -> Sign In / Providers -> Email**: leave **Email** enabled. A password is never used; the app only sends magic links.

The default template works as is: the link returns to `/auth/callback?code=...`.
The link must be opened in the same browser that requested it.

The built-in email sender is limited to a few emails per hour. Before launch, add
your own SMTP provider under **Authentication -> Emails -> SMTP Settings**.

## 5. Enable Google sign-in

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an
   **OAuth client ID** of type **Web application** (set up the consent screen first if asked).
2. **Authorized JavaScript origins**: `http://localhost:3000` and your production URL.
3. **Authorized redirect URIs**: `https://<project-ref>.supabase.co/auth/v1/callback`
   (the exact value is shown on the Supabase Google provider page).
4. In Supabase, **Authentication -> Sign In / Providers -> Google**: enable it and paste the client ID and client secret.

## 6. Environment variables

Put these in `.env.local` for local work and in **Vercel -> Project -> Settings -> Environment Variables** for production:

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Your site URL, e.g. `https://tweetdle.example` |
| `NEXT_PUBLIC_LAUNCH_DATE` | Date of puzzle #1, `YYYY-MM-DD` |
| `NEXT_PUBLIC_SUPABASE_URL` | Step 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | Step 1. Server only |
| `TWEETDLE_SECRET` | Any long random string, e.g. `openssl rand -hex 32`. Do not change it after launch, or devices that already played could be counted again |
| `CRON_SECRET` | Any long random string. Vercel sends it with cron requests |

The server switches from the in-memory store to Supabase when both
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. Sign-in appears
when both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set.

## 7. Seed the content

The seed reads `content/authors.json` and `content/private/puzzles.json`. The
second file holds the answers and is gitignored, so copy it onto your machine by hand.

```sh
npm run seed
```

It reads the Supabase values from `.env.local`, upserts every author and puzzle,
and prints how many it wrote. Run it again whenever the content changes. It never
deletes rows: remove an old puzzle or author in the Table Editor if you need to.

## 8. Keep-alive

Free Supabase projects pause after a week without activity. `vercel.json` schedules
a daily request to `/api/cron/keepalive`, which runs one tiny query. It only works
once `CRON_SECRET` is set in Vercel. To test it by hand:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/keepalive
# {"ok":true,"store":"supabase"}
```

## How the data is protected

- The browser never gets the service-role key. It can read `profiles` and `results`
  and change its own display name. Nothing else.
- `puzzles` (the answers), `authors`, `daily_stats` and `device_plays` have RLS on
  with no policies and no grants: only the server can touch them.
- All writes go through the Next.js routes. `record_play` counts each device once
  per puzzle and stores a signed-in player's result, in one transaction.
- Device ids are stored only as a keyed hash (`TWEETDLE_SECRET`).

## Good to know

- Results imported from a guest's browser history (`imported = true`) are kept so
  the player's own history and streak follow them across devices, but they do not
  count on any public leaderboard, because the server cannot verify them.
- Display names are 3-20 characters (letters, numbers, spaces, underscores) and
  unique ignoring case. New players start as `Player 1a2b3c4d`.

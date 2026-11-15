-- Tweetdle schema. Run once in the Supabase SQL editor (or `supabase db push`).
-- Safe to re-run: every statement is idempotent.
--
-- Access model: the browser (anon / authenticated roles) may only READ profiles
-- and results, and UPDATE its own profile's display_name. Everything else goes
-- through the Next.js server using the service-role key, which bypasses RLS.

-- --------------------------------------------------------------------------
-- Tables
-- --------------------------------------------------------------------------

create table if not exists public.authors (
  id          text primary key,
  name        text not null,
  aliases     text[] not null default '{}',
  category    text not null,
  descriptor  text not null,
  initials    text not null
);

-- Contains the answers. Service role only.
create table if not exists public.puzzles (
  number     integer primary key check (number >= 1),
  author_id  text not null references public.authors (id),
  tweets     jsonb not null check (jsonb_typeof(tweets) = 'array')
);

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (display_name ~ '^[A-Za-z0-9_ ]{3,20}$'),
  created_at    timestamptz not null default now()
);
-- Names are unique ignoring case.
create unique index if not exists profiles_display_name_key on public.profiles (lower(display_name));

create table if not exists public.results (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  puzzle_number  integer not null check (puzzle_number >= 1),
  guesses_used   integer not null check (guesses_used between 1 and 5),
  solved         boolean not null,
  score          integer not null check (score in (0, 20, 40, 60, 80, 100)),
  -- Null for rows imported from guest history (no trustworthy time).
  duration_ms    integer check (duration_ms >= 0),
  -- True when the row came from a guest-history sync, not a verified submit.
  imported       boolean not null default false,
  created_at     timestamptz not null default now(),
  primary key (user_id, puzzle_number)
);
-- "Today" leaderboard: one puzzle, best score first, fastest first.
create index if not exists results_today_idx
  on public.results (puzzle_number, score desc, duration_ms asc, created_at asc)
  where not imported;
-- Streak leaderboard scans solved rows per user in puzzle order.
create index if not exists results_solved_idx
  on public.results (user_id, puzzle_number)
  where solved;

create table if not exists public.daily_stats (
  puzzle_number  integer primary key,
  plays          integer not null default 0,
  d1             integer not null default 0,
  d2             integer not null default 0,
  d3             integer not null default 0,
  d4             integer not null default 0,
  d5             integer not null default 0,
  dmiss          integer not null default 0
);

-- One row per device per puzzle: the dedupe ledger behind daily_stats.
create table if not exists public.device_plays (
  puzzle_number  integer not null,
  device_hash    text not null,
  -- 0-4 = solved on guess 1-5, 5 = missed.
  bucket         integer not null check (bucket between 0 and 5),
  created_at     timestamptz not null default now(),
  primary key (puzzle_number, device_hash)
);

-- --------------------------------------------------------------------------
-- Row level security
-- --------------------------------------------------------------------------

alter table public.authors       enable row level security;
alter table public.puzzles       enable row level security;
alter table public.profiles      enable row level security;
alter table public.results       enable row level security;
alter table public.daily_stats   enable row level security;
alter table public.device_plays  enable row level security;

-- No policies at all on authors, puzzles, daily_stats, device_plays: with RLS
-- on, that means anon/authenticated can do nothing. Revoke the table grants
-- too, so a policy added by mistake later still exposes nothing.
revoke all on public.authors, public.puzzles, public.daily_stats, public.device_plays from anon, authenticated;

-- The server's role gets full access explicitly (do not rely on default grants).
grant all on public.authors, public.puzzles, public.profiles, public.results,
             public.daily_stats, public.device_plays to service_role;

-- profiles: readable by everyone; the owner may change display_name only.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

drop policy if exists "profiles are readable by everyone" on public.profiles;
create policy "profiles are readable by everyone"
  on public.profiles for select to anon, authenticated using (true);

drop policy if exists "owners update their profile" on public.profiles;
create policy "owners update their profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- results: readable by everyone, written only by the server.
revoke all on public.results from anon, authenticated;
grant select on public.results to anon, authenticated;

drop policy if exists "results are readable by everyone" on public.results;
create policy "results are readable by everyone"
  on public.results for select to anon, authenticated using (true);

-- --------------------------------------------------------------------------
-- Profiles: created automatically on sign-up
-- --------------------------------------------------------------------------

-- Creates the profile row if missing, with a default "Player 1a2b3c4d" name.
create or replace function public.ensure_profile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hex text := replace(p_user_id::text, '-', '');
begin
  if exists (select 1 from public.profiles where id = p_user_id) then
    return;
  end if;
  begin
    insert into public.profiles (id, display_name)
    values (p_user_id, 'Player ' || substr(v_hex, 1, 8))
    on conflict (id) do nothing;
  exception when unique_violation then
    -- Someone already took that name: fall back to a longer suffix.
    insert into public.profiles (id, display_name)
    values (p_user_id, 'Player ' || substr(v_hex, 1, 13))
    on conflict (id) do nothing;
  end;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.ensure_profile(new.id);
  return new;
exception when others then
  -- Never block a sign-up over the profile row: the server creates it later
  -- (auth callback and record_play both call ensure_profile).
  raise warning 'handle_new_user: could not create profile for %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill for users that signed up before this migration.
select public.ensure_profile(u.id) from auth.users u;

-- --------------------------------------------------------------------------
-- record_play: the one write per player per day
-- --------------------------------------------------------------------------

-- Atomically:
--   1. if the signed-in user already has a result for this puzzle, change
--      nothing and report that result;
--   2. otherwise claim (puzzle, device) in device_plays, and ONLY if that row is
--      new, add one play to daily_stats;
--   3. store the signed-in user's result row (first submission wins).
-- Returns the bucket on record plus the day's totals. The server has already
-- verified p_bucket against the real answer.
create or replace function public.record_play(
  p_puzzle_number integer,
  p_device_hash   text,
  p_bucket        integer,
  p_user_id       uuid default null,
  p_duration_ms   integer default null
)
returns table (
  bucket integer,
  plays  integer,
  d1 integer, d2 integer, d3 integer, d4 integer, d5 integer,
  dmiss  integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket   integer := p_bucket;
  v_existing public.results%rowtype;
  v_inserted integer;
begin
  if p_bucket is null or p_bucket < 0 or p_bucket > 5 then
    raise exception 'record_play: bucket must be between 0 and 5';
  end if;

  if p_user_id is not null then
    select * into v_existing
      from public.results r
     where r.user_id = p_user_id and r.puzzle_number = p_puzzle_number;
    if found then
      v_bucket := case when v_existing.solved then v_existing.guesses_used - 1 else 5 end;
      return query
        select v_bucket, coalesce(s.plays, 0), coalesce(s.d1, 0), coalesce(s.d2, 0),
               coalesce(s.d3, 0), coalesce(s.d4, 0), coalesce(s.d5, 0), coalesce(s.dmiss, 0)
          from (select 1) one
          left join public.daily_stats s on s.puzzle_number = p_puzzle_number;
      return;
    end if;
  end if;

  insert into public.device_plays (puzzle_number, device_hash, bucket)
  values (p_puzzle_number, p_device_hash, p_bucket)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    insert into public.daily_stats as s (puzzle_number, plays, d1, d2, d3, d4, d5, dmiss)
    values (
      p_puzzle_number, 1,
      (p_bucket = 0)::int, (p_bucket = 1)::int, (p_bucket = 2)::int,
      (p_bucket = 3)::int, (p_bucket = 4)::int, (p_bucket = 5)::int
    )
    on conflict (puzzle_number) do update set
      plays = s.plays + 1,
      d1    = s.d1 + excluded.d1,
      d2    = s.d2 + excluded.d2,
      d3    = s.d3 + excluded.d3,
      d4    = s.d4 + excluded.d4,
      d5    = s.d5 + excluded.d5,
      dmiss = s.dmiss + excluded.dmiss;
  elsif p_user_id is null then
    -- Guest repeat from the same device: the first submission stands.
    select dp.bucket into v_bucket
      from public.device_plays dp
     where dp.puzzle_number = p_puzzle_number and dp.device_hash = p_device_hash;
  end if;

  if p_user_id is not null then
    perform public.ensure_profile(p_user_id);
    insert into public.results (user_id, puzzle_number, guesses_used, solved, score, duration_ms, imported)
    values (
      p_user_id,
      p_puzzle_number,
      case when v_bucket < 5 then v_bucket + 1 else 5 end,
      v_bucket < 5,
      case when v_bucket < 5 then 100 - 20 * v_bucket else 0 end,
      p_duration_ms,
      false
    )
    on conflict (user_id, puzzle_number) do nothing;
  end if;

  return query
    select v_bucket, coalesce(s.plays, 0), coalesce(s.d1, 0), coalesce(s.d2, 0),
           coalesce(s.d3, 0), coalesce(s.d4, 0), coalesce(s.d5, 0), coalesce(s.dmiss, 0)
      from (select 1) one
      left join public.daily_stats s on s.puzzle_number = p_puzzle_number;
end;
$$;

-- --------------------------------------------------------------------------
-- Leaderboards (functions rather than views, so they can stay service-role only)
-- --------------------------------------------------------------------------

-- Today: verified submits only (imported guest rows have no time and are not
-- server-checked). Best score first, then fastest.
create or replace function public.leaderboard_today(p_puzzle_number integer, p_limit integer default 100)
returns table (user_id uuid, display_name text, value integer, guesses_used integer, duration_ms integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.user_id, p.display_name, r.score, r.guesses_used, r.duration_ms
    from public.results r
    join public.profiles p on p.id = r.user_id
   where r.puzzle_number = p_puzzle_number
     and not r.imported
   order by r.score desc, r.duration_ms asc nulls last, r.created_at asc
   limit p_limit;
$$;

-- All-time: total score across server-verified puzzles (imported guest history
-- is self-reported, so it never counts on a public board).
create or replace function public.leaderboard_alltime(p_limit integer default 100)
returns table (user_id uuid, display_name text, value integer)
language sql
stable
security definer
set search_path = ''
as $$
  select t.user_id, p.display_name, t.total
    from (
      select r.user_id, sum(r.score)::integer as total, count(*) as played
        from public.results r
       where not r.imported
       group by r.user_id
    ) t
    join public.profiles p on p.id = t.user_id
   where t.total > 0
   order by t.total desc, t.played asc, p.display_name asc
   limit p_limit;
$$;

-- Streak: length of the run of consecutive solved puzzle numbers that ends at
-- p_puzzle_number, or at p_puzzle_number - 1 if the player has not played
-- p_puzzle_number yet. A loss on p_puzzle_number means no streak.
create or replace function public.leaderboard_streak(p_puzzle_number integer, p_limit integer default 100)
returns table (user_id uuid, display_name text, value integer)
language sql
stable
security definer
set search_path = ''
as $$
  with solved as (
    select r.user_id,
           r.puzzle_number,
           r.puzzle_number - (row_number() over (partition by r.user_id order by r.puzzle_number))::integer as run_id
      from public.results r
     where r.solved
       and not r.imported
       and r.puzzle_number <= p_puzzle_number
  ),
  runs as (
    select s.user_id, max(s.puzzle_number) as last_number, count(*)::integer as length
      from solved s
     group by s.user_id, s.run_id
  )
  select runs.user_id, p.display_name, runs.length
    from runs
    join public.profiles p on p.id = runs.user_id
   where runs.last_number >= p_puzzle_number - 1
     and not exists (
       select 1
         from public.results lost
        where lost.user_id = runs.user_id
          and lost.puzzle_number = p_puzzle_number
          and not lost.solved
     )
   order by runs.length desc, p.display_name asc
   limit p_limit;
$$;

-- --------------------------------------------------------------------------
-- Function permissions: service role only
-- --------------------------------------------------------------------------

revoke all on function public.ensure_profile(uuid)                              from public, anon, authenticated;
revoke all on function public.handle_new_user()                                 from public, anon, authenticated;
revoke all on function public.record_play(integer, text, integer, uuid, integer) from public, anon, authenticated;
revoke all on function public.leaderboard_today(integer, integer)               from public, anon, authenticated;
revoke all on function public.leaderboard_alltime(integer)                      from public, anon, authenticated;
revoke all on function public.leaderboard_streak(integer, integer)              from public, anon, authenticated;

grant execute on function public.ensure_profile(uuid)                              to service_role;
grant execute on function public.record_play(integer, text, integer, uuid, integer) to service_role;
grant execute on function public.leaderboard_today(integer, integer)               to service_role;
grant execute on function public.leaderboard_alltime(integer)                      to service_role;
grant execute on function public.leaderboard_streak(integer, integer)              to service_role;

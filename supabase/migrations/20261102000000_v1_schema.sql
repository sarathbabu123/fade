-- FADE v1 schema. The server (Edge Function, service role) is the only writer of
-- matches, moves, challenges and friendships. Clients only read through RLS.
-- Ratings are deferred (cut for the first APK, see BUILD_PLAN.md).

create extension if not exists citext;

-- Profiles -------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  avatar_glyph text not null default 'bolt' check (avatar_glyph ~ '^[a-z]{2,12}$'),
  avatar_color text not null default 'violet' check (avatar_color ~ '^[a-z]{2,12}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Public profile fields are readable by any signed-in user (usernames, avatars).
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);

-- You can create and edit only your own profile.
create policy "insert own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Friendships (ordered pair, user_a < user_b) ---------------------------------
create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index friendships_user_b on public.friendships (user_b);

alter table public.friendships enable row level security;
create policy "see own friendships" on public.friendships
  for select to authenticated using ((select auth.uid()) in (user_a, user_b));

-- Matches ----------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  player_x uuid not null references public.profiles (id),
  player_o uuid not null references public.profiles (id),
  time_control text not null check (time_control in ('blitz', 'rapid')),
  rated boolean not null default false,
  -- race: start race running; active: playing; finished / aborted: over.
  status text not null default 'race' check (status in ('race', 'active', 'finished', 'aborted')),
  -- Start race: GO time (server clock) and each player's tap.
  race jsonb not null default '{}'::jsonb,
  -- Engine MatchState (packages/engine), null until the race is resolved.
  state jsonb,
  turn_started_at timestamptz,
  turn_ms integer,
  -- When a finished round's pause ends and the next round starts.
  next_round_at timestamptz,
  winner text check (winner in ('X', 'O')),
  ended_reason text,
  rematch jsonb not null default '{}'::jsonb,
  rematch_id uuid references public.matches (id),
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (player_x <> player_o)
);
create index matches_player_x on public.matches (player_x, created_at desc);
create index matches_player_o on public.matches (player_o, created_at desc);

alter table public.matches enable row level security;
create policy "players read their matches" on public.matches
  for select to authenticated using ((select auth.uid()) in (player_x, player_o));

-- Moves (audit log of every ply) ----------------------------------------------
create table public.moves (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches (id) on delete cascade,
  round_no smallint not null,
  ply smallint not null,
  player text not null check (player in ('X', 'O')),
  kind text not null check (kind in ('move', 'timeout')),
  cell smallint,
  server_ts timestamptz not null default now(),
  unique (match_id, round_no, ply)
);

alter table public.moves enable row level security;
create policy "players read their moves" on public.moves
  for select to authenticated using (
    exists (
      select 1 from public.matches m
      where m.id = match_id and (select auth.uid()) in (m.player_x, m.player_o)
    )
  );

-- Challenges (6-letter codes shared on WhatsApp) -------------------------------
create table public.challenges (
  code text primary key check (code ~ '^[A-Z]{6}$'),
  from_id uuid not null references public.profiles (id) on delete cascade,
  -- Set when sent to a specific friend from the Friends list.
  to_id uuid references public.profiles (id) on delete cascade,
  time_control text not null check (time_control in ('blitz', 'rapid')),
  rated boolean not null default false,
  status text not null default 'open' check (status in ('open', 'accepted', 'cancelled', 'expired')),
  match_id uuid references public.matches (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes'
);
create index challenges_to on public.challenges (to_id, status);

alter table public.challenges enable row level security;
-- You see challenges you sent, and ones sent to you. Joining by code goes through the function.
create policy "see own challenges" on public.challenges
  for select to authenticated using ((select auth.uid()) in (from_id, to_id));

-- No insert/update/delete policies on friendships, matches, moves or challenges:
-- with RLS on, clients cannot write them. The Edge Function uses the service role.

-- Realtime: players get live match and challenge updates (filtered by RLS).
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.challenges;

-- Presence heartbeat: a client may only bump its own last_seen_at (via the update policy above).

-- Ratings and rating history (Glicko-2) for Blitz and Rapid time controls.
-- Server Edge Function (service role) is the only writer.
-- Authenticated users can read ratings (for profiles and leaderboards).
-- Users can read their own rating history.

create table if not exists public.ratings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  time_control text not null check (time_control in ('blitz', 'rapid')),
  rating integer not null default 1200,
  rd real not null default 350.0,
  volatility real not null default 0.06,
  games integer not null default 0,
  wins integer not null default 0,
  draws integer not null default 0,
  losses integer not null default 0,
  streak integer not null default 0,
  best_streak integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, time_control)
);

create index if not exists ratings_leaderboard on public.ratings (time_control, rating desc);

alter table public.ratings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'ratings' and policyname = 'ratings readable by signed-in users') then
    create policy "ratings readable by signed-in users" on public.ratings
      for select to authenticated using (true);
  end if;
end $$;

create table if not exists public.rating_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  time_control text not null check (time_control in ('blitz', 'rapid')),
  match_id uuid references public.matches (id) on delete cascade,
  rating_before integer not null,
  rating_after integer not null,
  rd_before real not null,
  rd_after real not null,
  created_at timestamptz not null default now()
);

create index if not exists rating_history_user on public.rating_history (user_id, time_control, created_at asc);

alter table public.rating_history enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'rating_history' and policyname = 'users read own rating history') then
    create policy "users read own rating history" on public.rating_history
      for select to authenticated using ((select auth.uid()) = user_id);
  end if;
end $$;


# FADE — Product Requirements Document

> **One line:** Blitz tic-tac-toe where your oldest mark vanishes, played on a shot clock. Has ratings, a bot, live friend challenges sent over WhatsApp, and spectating. Think chess.com / Matiks, but with a game that takes 10 seconds to learn.

- **Platform (v1):** Android APK (sideloaded) + a web version at the same link. iOS later, from the same codebase.
- **Stack:** Expo (React Native) + TypeScript + Supabase.
- **Owner:** Sarath
- **Status:** v1 spec

---

## 1. Goals and non-goals

### Goals
1. A game a new player understands in under 10 seconds and finds hard to master.
2. **Top-tier feel:** every tap, fade, win and loss has motion, sound and haptics. The game should feel alive at 60 fps on a mid-range Android phone.
3. Play a friend in **under 15 seconds** from a WhatsApp link, even if they don't have the app (the web version opens instantly).
4. Competitive depth: a rating per time control, rating history, head-to-head records, leaderboards.
5. Social: friends list, online status, see friends' live games, replays.

### Non-goals (v1)
- Free-text chat. Only preset emoji reactions, because family members of all ages (including kids) will play.
- Monetization, ads, in-app purchases.
- Play Store / App Store publishing (we ship an APK first; Play Store is a later step).
- GPS / location features.
- Tournaments.

---

## 2. Game rules (the engine must implement exactly this)

### 2.1 Board and pieces
- Board: **N×N**. Default N = 3.
- Each player may have at most **K** marks on the board. Default K = 3.
- Win: **L in a row** (row, column or diagonal). Default L = 3.
- N, K and L must be **config parameters** in the engine. Phase 0 may change the defaults (for example to 4×4, K=4, L=3) if the solver shows 3×3 is too shallow.

### 2.2 A move
1. The player to move picks an **empty** cell. A cell holding a mark that is about to fade is still occupied and cannot be played.
2. The mark is placed and added to the end of that player's queue (oldest first).
3. If the player now has more than K marks, their **oldest mark is removed** and its cell becomes empty.
4. **Then** check for a win, using only the marks still on the board.
5. Turn passes to the opponent.

The oldest mark of each player is the **"next to fade"** mark. It must always be visibly marked in the UI (see §7).

### 2.3 Shot clock
| Time control | Per-move clock | Sudden death (after 30 total moves in a round) |
|---|---|---|
| **Blitz** (default) | 3.0 s | 1.5 s |
| **Rapid** (family-friendly) | 8.0 s | 4.0 s |

- **Timeout:** the player's oldest mark fades (if they have any) and the turn passes. No mark is placed.
- **3 consecutive timeouts** by one player in a round = that player loses the round.
- **Hard cap:** 60 total moves in a round = round is a draw.

### 2.4 Match
- **Best of 5 rounds** (first to 3 round wins). A drawn round counts for neither player.
- The starting player alternates each round. Round 1 starter is random.
- If 5 rounds are played and the score is tied, the match is a draw.
- **Resign** is available at any time and loses the match.
- **Abort:** if a player makes no move in round 1 within 15 s of the match start, the match is aborted. No rating change.
- **Rematch** button after a match. Both players must accept.

### 2.5 Disconnects
- The clock keeps running while a player is disconnected (timeouts apply as normal).
- If a player is disconnected for 20 s in total during a round, they forfeit the match.
- Reconnecting players resume from server state with the correct remaining clock.

---

## 3. Game modes

| Mode | Opponent | Rated | Notes |
|---|---|---|---|
| **vs Bot** | Bot at 4 levels | No | Works fully offline. |
| **Pass & Play** | Same device | No | Offline, for playing with family in person. |
| **Challenge a Friend** | Friend, via in-app button or WhatsApp link | Toggle (default Rated) | Pick Blitz or Rapid. |
| **Quick Match** | Random player of similar rating | Yes | Matchmaking queue. |
| **Daily Fade** *(v1.1)* | Puzzle | Separate puzzle streak | Same puzzle for everyone each day. Share card. |
| **Ghost Chase** *(v1.1)* | Friends' recorded puzzle runs | No | "Your cousin beat your time by 2.1 s" push. |

### 3.1 Bot levels
| Level | Behaviour |
|---|---|
| Easy | Random legal move 70% of the time, best move 30%. |
| Medium | 2-ply search with noise. Always takes a win in one, sometimes misses blocks. |
| Hard | Perfect play from the solver's table, with a 10% chance of a second-best move. |
| Impossible | Perfect play from the solver's table. |

- The bot uses a human-like "think time" of 400–1500 ms (shorter in Blitz), always within the clock.
- For 3×3, the solver's full table (the result of every position under perfect play) is small. Ship it in the app as compressed JSON, so the bot is perfect without searching.

### 3.2 Quick Match matchmaking
- Queue per time control. Start by matching within ±100 rating, widen by 50 every 5 s, up to ±400.
- After 30 s with no match, offer "Play the bot while you wait". The player stays in the queue and is pulled out if a match is found. **Never disguise a bot as a human.**

---

## 4. Rating system

- Use **Glicko-2** (the system lichess uses), shown to users as "rating". It handles players with few games far better than plain Elo.
- Separate ratings for **Blitz** and **Rapid**.
- Start: rating 1200, RD 350, volatility 0.06.
- **Provisional** until 10 rated games: show the rating with a "?" (e.g. "1340?").
- Rating is updated on the **server** at match end, never on the client, inside the same transaction that finalizes the match.
- Store every change in `rating_history` for the profile graph.
- Only rated friend challenges and Quick Match affect rating. Bot and Pass & Play never do.

---

## 5. Social features

### 5.1 Identity
- First launch: **anonymous sign-in** (no friction), then pick a **username** (unique, 3–16 chars) and an **avatar** (from a built-in set of colour + emoji/shape combos).
- Prompt to link **Google** after the first online match so the account isn't lost on reinstall.

### 5.2 Friends via WhatsApp link
- Every user has a personal **invite link**: `https://<domain>/i/<inviteCode>`.
- Tapping it:
  - **App installed:** opens the app (Android App Link) → shows "Add <username> as a friend?" → one tap, both become friends.
  - **App not installed:** opens the web version → sign in anonymously → becomes friends → can play right away in the browser, with a "Get the Android app" button (APK download link).
- The link page must have **Open Graph tags** so WhatsApp shows a rich preview: "Sarath challenged you to FADE. Rating 1420."
- Sharing: a "Share on WhatsApp" button (opens WhatsApp with prefilled text and link), with the system share sheet as fallback.
- Friends can also be added by username search.

### 5.3 Challenges
- **From the app:** Friends list → friend → "Challenge" → choose Blitz/Rapid, Rated/Casual → friend gets a push notification and an in-app banner.
- **By link:** `https://<domain>/c/<challengeCode>`. Anyone who opens it joins that match (it's a one-time code). If they aren't friends yet, they become friends.
- A challenge expires after 10 minutes if not accepted.

### 5.4 Presence and spectating
- Friends list shows status: **Online**, **In a game** (with a "Watch" button), **Offline** (last seen).
- **Live now** strip on the Home screen: friends' ongoing matches.
- **Spectating:** read-only, real-time view of the board, both clocks, round score, and a spectator count. Spectators can send preset emoji reactions that float up on screen for everyone.
- **Replays:** every finished online match is viewable from either player's profile, with play/pause, step forward/back and a scrubber.

### 5.5 Profile
- Ratings (Blitz, Rapid) with a history graph.
- Win/draw/loss record, current win streak, best rating.
- Recent matches (tap to replay).
- **Head-to-head** record when viewing a friend's profile ("You 14 – 9 Rahul").

### 5.6 Leaderboards
- **Friends** leaderboard (default) and **Global** leaderboard, per time control.

### 5.7 Notifications (Expo push)
- Challenge received, friend request accepted, friend started a live match (opt-in), rematch offered.

---

## 6. Screens

| Screen | Contents |
|---|---|
| **Onboarding** | 3 animated cards teaching the rules (each card is a live mini board demo). Username + avatar picker. |
| **Home** | Animated background board (bot vs bot demo). Big **Play** buttons: Quick Match, Challenge a Friend, vs Bot, Pass & Play. Live-now strip. Rating chip. |
| **Time control sheet** | Bottom sheet: Blitz / Rapid, Rated / Casual. |
| **Matchmaking** | Radar sweep animation, rating range widening, cancel button, "play bot while you wait" after 30 s. |
| **Match** | Board, both players' avatars with clock rings, round score pips, resign, emoji reactions. |
| **Round / Match result** | Win/loss takeover animation, rating delta, rematch, share result card, view replay. |
| **Friends** | Invite card (share on WhatsApp), requests, list with presence, Watch/Challenge buttons, search. |
| **Profile** | Ratings, graph, stats, recent matches, head-to-head. |
| **Replay viewer** | Board with playback controls and scrubber. |
| **Spectate** | Match screen in read-only mode, spectator count, reactions. |
| **Leaderboards** | Friends / Global tabs, per time control. |
| **Settings** | Sound, haptics, reduce motion, account linking, sign out. |

---

## 7. UI and animation spec

**This is the most important section for quality.** The game is simple, so the feel *is* the product.

### 7.1 Art direction: "Neon Ink"
- **Background:** deep night `#0B0D17` with a slow-moving aurora gradient and fine film grain (subtle; must not distract).
- **X:** electric coral `#FF5A5F` with soft outer glow. **O:** cyan `#3DE0FF` with soft outer glow.
- **Accent:** gold `#FFC94A` for crowns, ratings up, wins. Muted red `#B33A3A` for rating down.
- **Board:** thin luminous grid lines that breathe very slightly (opacity 0.6 ↔ 0.8, 4 s loop).
- **Typography:** `Unbounded` (display: scores, ratings, titles) + `Space Grotesk` (UI text). Use tabular numbers for clocks and ratings.
- **Shape language:** rounded corners (16–24 px), glassy cards (blurred translucent surfaces), no hard drop shadows, glows instead.
- Dark theme only in v1.

### 7.2 Animation catalogue
All game animations run on the UI thread (Reanimated worklets / Skia). Durations are targets; tune on device.

| Moment | Animation | Haptic | Sound |
|---|---|---|---|
| Board appears | Cells stagger in (40 ms apart), scale 0.9→1 with spring | — | soft whoosh |
| Place X | Two strokes drawn with path trim (120 ms each) + scale pop 0.85→1 spring | light impact | pen stroke |
| Place O | Circle stroke sweeps 0→360° (220 ms) + scale pop | light impact | pen stroke |
| Next-to-fade mark | Pulses opacity 1→0.45 at ~1.2 Hz, slight desaturation, thin dotted ring around it | — | — |
| Mark fades | Dissolves into 12–20 glowing particles that drift up and fade (450 ms) | soft impact | airy dissolve |
| Shot clock | Ring around active avatar depletes; colour goes from player colour → amber (≤1 s) → red (≤0.5 s) | heartbeat pulse at 1 s left | quiet tick in last second |
| Last 0.5 s | Screen-edge vignette pulses in player colour | — | — |
| Timeout | Oldest mark cracks and shatters; "TIME" stamp slams in and fades | heavy impact | glass crack |
| Round win | Beam draws through the winning line (250 ms), cells flash, 6 px screen shake, particle burst in winner colour, round pip fills | success notification | chord hit |
| Round loss | Board dims, losing marks drain of colour | warning notification | low tone |
| Match win | Full-screen takeover: crown drops with bounce, confetti (Skia), rating delta rolls up like an odometer ("+14") | success | fanfare (short) |
| Match loss | Calm takeover, rating delta rolls down, "Rematch" pulses | — | soft low tone |
| Sudden death starts | Board border flashes red, "SUDDEN DEATH" banner sweeps across | rigid impact | alarm sting |
| Matchmaking | Radar sweep with avatars orbiting, rating range text widening | — | sonar ping |
| Opponent found | Both avatars fly to centre and clash, then shared-element transition into match screen | medium impact | impact |
| Emoji reaction | Emoji floats up with slight wobble and fades (1.2 s) | — | — |
| Rating graph | Line draws left to right, last point pulses | — | — |
| Buttons | Squash to 0.96 on press, spring back | selection | tap |
| Screen transitions | Shared-element avatar/board transitions; otherwise fade + 12 px slide | — | — |

### 7.3 Feel rules
- **Input latency:** a tap must show the mark immediately (optimistic), even online. If the server rejects the move, animate the mark out with a shake.
- **Performance budget:** 60 fps on a mid-range Android phone (e.g. a ₹12–15k phone). Cap particles at 200 on screen. No JS-thread animations during play.
- **Reduce motion** setting: replaces particles and shakes with simple fades. Also respect the OS setting.
- **Sound and haptics** each have their own toggle. Sounds must be original or properly licensed (CC0 / own).
- Every empty state and loading state has a designed animation, never a bare spinner.

---

## 8. Technical architecture

### 8.1 Stack
| Layer | Choice |
|---|---|
| App | **Expo** (latest stable SDK) + **React Native** + **TypeScript** (strict) |
| Navigation | **Expo Router** (file-based, handles deep links) |
| Animation | **react-native-reanimated**, **@shopify/react-native-skia** (particles, glows, paths), **react-native-gesture-handler** |
| Feedback | **expo-haptics**, **expo-audio** |
| State | **Zustand** (local/game UI state) + **TanStack Query** (server data) |
| Backend | **Supabase**: Postgres, Auth (anonymous + Google), Realtime, Edge Functions (Deno/TypeScript), RLS |
| Push | **Expo Notifications** |
| Web version | Expo web export, hosted on Vercel or Cloudflare Pages (also serves invite/challenge link pages and `assetlinks.json`) |
| Builds | **EAS Build**: `preview` profile → APK; `production` profile → AAB (later, Play Store) |
| Tests | Jest (engine, rating, server logic), Maestro (later, E2E on device) |

Use the latest stable versions at build time and check their current docs. Do not pin to versions from memory.

### 8.2 Repo layout (monorepo)
```
fade/
  CLAUDE.md
  PRD.md
  BUILD_PLAN.md
  app/                      # Expo app (Android + web)
    app/                    # Expo Router routes
    src/components/
    src/game/               # board UI, animations, sounds
    src/theme/              # colours, fonts, spacing tokens
    src/lib/                # supabase client, queries, stores
    assets/                 # fonts, sounds, bot table
  packages/
    engine/                 # PURE TypeScript game engine (no React, no I/O)
    rating/                 # Glicko-2 implementation
  tools/
    solver/                 # retrograde solver, puzzle generator, reports
  supabase/
    migrations/
    functions/
      _shared/engine/       # GENERATED copy of packages/engine (npm run sync-engine)
      _shared/rating/       # GENERATED copy of packages/rating
      submit-move/
      claim-timeout/
      create-challenge/
      accept-challenge/
      matchmake/
      resign/
      link-preview/         # optional: OG tags for invite links
```

### 8.3 Engine (`packages/engine`)
- Pure functions, deterministic, no dependencies.
- `createRound(config, starter)`, `applyMove(state, cell)`, `applyTimeout(state)`, `legalMoves(state)`, `winner(state)`, `nextToFade(state, player)`, `serialize/deserialize`.
- The **same code** runs on the client (optimistic moves, bot, pass & play), in the solver, and in Edge Functions (authoritative validation).
- 100% unit-test coverage of rules in §2, including: placing a 4th mark removes the oldest before the win check; can't place on a fading mark's cell; timeout fades oldest; 3 timeouts lose; 60-move cap draws.

### 8.4 Online match flow (server is the source of truth)
1. Client calls Edge Function `submit-move { matchId, roundNo, moveNo, cell }`.
2. Function loads the match, checks it's the caller's turn, the `moveNo` is expected, and the server time is within the turn deadline (+ **250 ms grace** for network lag).
3. Applies the move with the engine, writes the `moves` row and updated `matches` state **in one transaction**, sets the next `turn_deadline`.
4. All players and spectators subscribed to the match receive the change through **Supabase Realtime** (Postgres changes on `moves` / `matches` for the match id).
5. **Timeouts:** when a client sees the opponent's deadline pass, it calls `claim-timeout`. The server checks the deadline really passed and applies the timeout. Also run a `pg_cron` job every minute to clean up abandoned matches.
6. **Clock sync:** on joining a match, the client measures the offset between its clock and the server's, and renders clocks from server `turn_deadline` values.
7. At match end, the same function finalizes the result and updates ratings (Glicko-2) atomically.

### 8.5 Data model (Postgres)
| Table | Key columns |
|---|---|
| `profiles` | id (= auth uid), username (unique), avatar, created_at, last_seen_at, push_token |
| `ratings` | user_id, time_control, rating, rd, volatility, games, updated_at |
| `rating_history` | user_id, time_control, match_id, rating_before, rating_after, created_at |
| `friendships` | user_a, user_b (ordered pair), created_at |
| `invites` | code, owner_id, created_at (personal invite link) |
| `challenges` | code, from_id, to_id (nullable for link challenges), time_control, rated, status, expires_at, match_id |
| `matches` | id, player_x, player_o, time_control, rated, status (waiting/active/finished/aborted), round_no, score_x, score_o, state (jsonb engine state), turn_deadline, winner, ended_reason, started_at, ended_at |
| `moves` | match_id, round_no, move_no, player, cell (nullable for timeout), kind (move/timeout), server_ts |
| `matchmaking_queue` | user_id, time_control, rating, joined_at |
| `reactions` | match_id, user_id, emoji, created_at (preset emoji only) |
| `daily_puzzles` *(v1.1)* | date, position, solution, difficulty |
| `puzzle_attempts` *(v1.1)* | user_id, date, time_ms, mistakes, moves |

**Row Level Security on every table.** Clients may read public profile fields, their own data, friends' data, and matches they play or spectate. **Clients never write to `matches`, `moves` or `ratings` directly** — only Edge Functions (service role) do.

### 8.6 Deep links
- Domain: one HTTPS domain (e.g. a Vercel/Cloudflare Pages subdomain to start).
- Android App Links for `/i/*` and `/c/*`, verified via `/.well-known/assetlinks.json` hosted on that domain.
- The web version handles the same routes when the app isn't installed.

---

## 9. Non-functional requirements
- Cold start to Home < 2.5 s on a mid-range Android phone.
- Move round-trip (tap → opponent sees it) < 300 ms on decent 4G in India (Supabase project region: Mumbai `ap-south-1`).
- APK size target < 60 MB.
- Works on Android 10+.
- No secrets in the app bundle other than the Supabase anon key. Service-role key only in Edge Functions.
- Crash-free sessions > 99%.

## 10. Analytics (simple events table or PostHog later)
Track: install source (invite link vs other), onboarding complete, first match type, matches per day, invite links shared, invite links opened, friend added, D1/D7 return. The key metric is **invites sent per user and % that turn into a played match**.

## 11. Open decisions (defaults chosen; change if needed)
| Decision | Default |
|---|---|
| Board size / K / L | 3×3, K=3, L=3 — **subject to the Phase 0 solver report** |
| Default time control | Blitz 3 s |
| Friend challenges rated by default | Yes (toggle in sheet) |
| App name / domain / Android package | FADE / TBD / `com.<owner>.fade` |

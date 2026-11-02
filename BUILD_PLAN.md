# FADE — Build Plan for Claude Code

Read `PRD.md` first. This plan breaks the build into phases. **Finish one phase, pass its acceptance checks, commit, then start the next.** Each phase ends with something you can run.

The first APK you can install arrives at the end of **Phase 2** (offline: bot + pass & play). Online play arrives in Phase 4.

---

## v1 scope decisions (2026-11-01, override the phases below where they conflict)
- **First APK includes online play** with a friend. Phases 1–2 are trimmed to get there; full polish comes later.
- Friends join by a **6-letter challenge code** shared on WhatsApp with the APK link. No web version or https links in v1.
- In v1: anonymous auth + username, online friend matches, ratings (Glicko-2, rated challenges), profile with rating graph, friends leaderboard.
- Deferred: Quick Match, global leaderboard, push notifications, spectating/replays, Google linking, web version.
- Default time control: **Rapid 8 s**. Package: `com.sarath.fade`.
- Timeout rule kept as in PRD §2.3; the solver/bot treat a deliberate timeout as a legal action.
- Supabase: develop against the remote project (no Docker); deploy functions with `--use-api`. Project is in Frankfurt (kept by choice).
- Dev testing in Expo Go; final APK from EAS `preview`.
- APK is hosted in a permanent place (Supabase Storage public bucket), not only the EAS link.
- **Early clinch** (2026-11-02): a match ends as soon as the trailing player can no longer draw level (e.g. 2–0 after 4 rounds with 2 draws). Otherwise first to 3, or 5 rounds.
- **"Next to fade" pulse** (2026-11-02): only on a player's oldest mark when they hold K marks (it fades on their next placement). Departs from PRD §2.2 "always". A last-second timeout warning on the oldest mark is fine. Engine: `nextToFade()` (K marks) and `oldestMark()` (what a timeout fades).
- Engine details (picked, not debated): timeouts count as plies for the 30/60 thresholds; a win on ply 60 beats the cap; a 0-mark timeout still counts toward 3 consecutive; placing resets only your own counter; counters reset each round; the round-1 starter is passed in (the engine never calls `Math.random`).
- **Board: 3×3, K3, L3** (2026-11-02, after the solver report). It is a forced first-player win in 13 plies, but only via an edge opening and then a single winning move each turn. 4×4 L3 is a 5-ply win and 4×4 L4 is likely drawish with no perfect bot. See `tools/solver/REPORT.md`.
- **Round starters keep plain alternation** (2026-11-02), round 5 included. Revisit with real match data (options: round-4 loser starts, or a fresh coin flip).
- **Start race** (2026-11-02, Sarath's idea): the round-1 starter is decided by a "GET READY… GO!" tap race, not a coin flip; rounds 2–5 alternate. A tap before GO, or under 100 ms after it, is a false start and hands the first move to the opponent. Reactions within 10 ms are a tie, settled by a coin flip. Used in every mode: bot (human-like reaction), pass & play (split screen) and online. Engine: `resolveStartRace`.
- **Online start race uses reaction times measured on each phone** (2026-11-02): the server schedules GO at a server time, each phone measures its reaction from when GO appeared, and the server rejects implausible values. Fair across networks; cheatable by a hacked app, which is acceptable for friends-only v1.
- **Navigation** (2026-11-02): 3 bottom tabs, Play · Friends · Profile. Settings sits behind a gear on Profile.
- **Avatars** (2026-11-02): our own neon line-art SVG glyphs (~12) × 8 Neon Ink colours, not emoji. Emoji stay only for reactions.
- **Review screenshots** (2026-11-02): from Sarath's phone over USB debugging (adb screencap from Expo Go), which also lets us check performance on real hardware.
- **One APK at the end** (2026-11-02): no early offline test APK; ratings stay in v1. Estimate given: about 13–19 h of build time across sessions, plus review.
- **Expectations** (2026-11-02): Sarath asked whether a shareable APK could be ready in 20 minutes. Explained it can't; Sarath chose to keep the full plan over a fast offline APK or a no-frills online build.
- Glass cards use translucent fill, hairline edge and highlight, not real-time blur: blurring the animated aurora every frame is too costly on mid-range Android. Revisit on device.
- **Overnight build** (2026-11-02, Sarath asleep): Claude decides remaining calls itself (recommended option), skips review checkpoints, and logs each as "decided overnight". Authorised: Supabase migrations/functions, EAS init + cloud builds, a public Storage bucket for the APK, a locally generated Android keystore (gitignored), and Chrome for cloud dashboards if the CLIs can't do something. No phone overnight, so use an emulator. If time runs short, **cut ratings first**. PC sleep disabled on AC (`powercfg /change standby-timeout-ac 0`; Sarath restores with `powercfg /change standby-timeout-ac 30`).
- **Overnight session lost** (2026-11-02): the Claude Code session ended at ~01:35 and work stopped. At 21:00 Sarath chose to go straight to the full APK (no interim offline APK or early phone preview). Commit more often so a lost session costs little.
- **Full APK, ~7–9 h** (2026-11-02 21:10): re-estimated with ratings cut. Sarath turned down a web-link-first build (~2 h) and a trimmed APK (~5–6 h).
- Import style (verified 2026-11-02 in Jest/Babel, Node strip-types, Deno 2.9 and tsc 6): relative imports with explicit `.ts`, erasable TS only (no enums/namespaces). Metro verified 2026-11-02 (the Android export bundles `@fade/engine`).

## Road to the first APK (do in this order)
Each step uses the matching phase below, trimmed to the v1 scope. ⏸ marks a checkpoint: stop, show Sarath, and wait.

1. [x] **Phase 0: engine + solver.** Done 2026-11-02; see `tools/solver/REPORT.md`. Sarath chose 3×3.
   - Engine covers both round rules and match rules.
   - Timeout is a legal action in the solver, with per-player consecutive-timeout counters in the state.
   - The solver ignores the 30/60-move counters and treats unresolved cycles as draws; say so in the report.
   - 3×3 is required (the bot needs it). Time-box 4×4 and give partial or sampled numbers if it's slow.
   - Tests must cover: the 4th mark is removed before the win check; you can't play on your own about-to-fade cell.
   - ⏸ **Show REPORT.md**, then ask Sarath which board size to use. If 4×4 wins, discuss how the bot works without a full table.
2. [x] **Phase 1 (lite): app shell + Neon Ink theme.** Done 2026-11-02; checked on the emulator. Expo app, theme, core components, aurora background, Home/Onboarding/Profile/Settings layouts. ⏸ **Expo Go QR + screenshots** for Sarath.
3. [x] **Phase 2 (lite): offline game.** Done 2026-11-02. A full best-of-5 in pass & play and a bot match (Impossible) run on the emulator. Emulator frame times are poor (50–90 ms); real-phone performance still to be measured.
   - Skia board and match controller.
   - Core animations: placement strokes, next-to-fade pulse, particle fade, clock ring, timeout, win beam, result takeover.
   - Sounds, haptics, bot (4 levels), pass & play.
   - Remaining §7.2 polish can come after v1.
4. [ ] **Phase 3: Supabase.**
   - Migrations + strict RLS (only the tables v1 needs).
   - Anonymous auth + username/avatar onboarding.
   - sync-engine script and RLS tests, run against the remote project.
5. [ ] **Phase 4: online matches.**
   - Edge Functions for create/accept challenge, submit-move, claim-timeout, resign.
   - Server clocks, realtime, optimistic moves, rematch.
6. [ ] **Phase 5 (lite): challenge codes.**
   - 6-letter code with a "Share on WhatsApp" button: prefilled text, the code and the APK link.
   - "Enter code" screen. Joining by code makes you friends.
   - Friends list with presence and a Challenge button.
7. [ ] **Phase 6 (lite): ratings.**
   - Glicko-2 package with tests.
   - Server-side update at match end; rated/casual toggle.
   - Profile with rating graph and stats; friends leaderboard.
8. [ ] **APK.**
   - Icon, splash, app name.
   - EAS `preview` APK, uploaded to a public Supabase Storage bucket.
   - ⏸ **Send Sarath the link and the WhatsApp message text.**

---

## Before you start (manual steps for Sarath)

These need your accounts, so Claude Code can't do them for you:

1. **GitHub repo** named `fade` (private is fine).
2. **Supabase project** — region **Mumbai (ap-south-1)**. Note the project URL, anon key, service-role key. Enable **Anonymous sign-ins** and **Google** provider in Auth settings.
3. **Expo account** (free) — then run `npx eas login` once on your machine.
4. **Install locally:** Node LTS, Git, Docker (for local Supabase), Supabase CLI, Android phone with "Install unknown apps" allowed for your browser/file manager.
5. **Hosting for the web version and links:** a Vercel or Cloudflare Pages account. A custom domain is optional at first.
6. Put secrets in `app/.env` (never commit it):
   ```
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
   ```

---

## Phase 0 — Engine + solver (validate the game before building UI)

**Goal:** prove the rules are fun and deep enough, using data.

Tasks
1. Set up the monorepo (npm workspaces): `packages/engine`, `packages/rating`, `tools/solver`, `app` (empty for now).
2. Implement `packages/engine` exactly per PRD §2, with N, K, L as config.
3. Write Jest tests for every rule in PRD §2 and §8.3.
4. Build `tools/solver`: retrograde analysis over all reachable states (board + each player's fade order + side to move) for a given (N, K, L).
5. Solver report (`tools/solver/REPORT.md`) for 3×3/K3/L3, 4×4/K4/L3 and 4×4/K4/L4:
   - Number of reachable states.
   - Result of the starting position under perfect play (first player wins / second player wins / draw).
   - Distribution of "win in N moves" positions (how many puzzles of each difficulty exist).
   - Average branching factor; how often a random move is a blunder.
6. Export the 3×3 solved table as compressed JSON (`app/assets/bot/table-3x3.json`) for the bot.

Acceptance
- All engine tests pass.
- `REPORT.md` exists with a short recommendation: keep 3×3 or switch defaults.
- **Stop and show Sarath the report before Phase 1.**

Prompt for Claude Code
> Read CLAUDE.md, PRD.md and BUILD_PLAN.md. Do Phase 0 only. Set up the monorepo, implement the engine with full tests, build the solver, and write tools/solver/REPORT.md with a recommendation on board size. Stop when done and summarise the report.

---

## Phase 1 — App shell + design system

**Goal:** a good-looking app skeleton with the "Neon Ink" look in place.

Tasks
1. Create the Expo app in `app/` with TypeScript strict, Expo Router, Reanimated, Skia, Gesture Handler, expo-haptics, expo-audio, Zustand, TanStack Query.
2. Set up a **development build** (not Expo Go) via EAS so native modules work.
3. `src/theme`: colour tokens, typography (Unbounded + Space Grotesk via expo-google-fonts), spacing, radii, glow styles.
4. Reusable components: `GlowButton` (squash + haptic), `GlassCard`, `Avatar` (with clock ring slot), `RatingChip`, `BottomSheet`, `AnimatedNumber` (odometer roll).
5. Animated background: aurora gradient + grain (Skia), running cheaply.
6. Screens as placeholders with real layout: Onboarding, Home, Friends, Profile, Settings, Leaderboards.
7. A hidden `/dev/gallery` route showing every component and animation for review.

Acceptance
- Runs on an Android phone via the dev build at 60 fps (check with the performance monitor).
- Gallery screen shows all components.
- Screenshots of Home and Onboarding shared with Sarath.

Prompt
> Do Phase 1 from BUILD_PLAN.md. Focus on the design system and animated background. Follow PRD §7 closely. Show me screenshots of Home, Onboarding and the gallery when done.

---

## Phase 2 — Offline game: board, animations, bot, pass & play → **first APK**

**Goal:** the core game feels amazing offline.

Tasks
1. `src/game/Board`: Skia-rendered board. Taps on cells, optimistic placement.
2. Implement **every** animation in PRD §7.2 that applies to a match: placement strokes, next-to-fade pulse, particle fade, clock ring, last-second vignette, timeout shatter, win beam + shake + burst, sudden-death banner, match result takeover with odometer.
3. Sound effects (CC0 or generated) and haptics, both with toggles. Reduce-motion mode.
4. Local match controller using the engine: shot clock, timeouts, rounds, best of 5, resign, rematch.
5. Bot with 4 levels (PRD §3.1) using the solver table; human-like think time.
6. Pass & Play mode.
7. Onboarding: 3 cards with live mini-board demos of the rules. Home screen background plays a bot-vs-bot demo.
8. EAS `preview` profile that outputs an **APK** (`android.buildType: "apk"`). Run `eas build -p android --profile preview`.

Acceptance
- A full best-of-5 vs every bot level and in pass & play works without bugs.
- 60 fps during play on a mid-range phone; no dropped frames on fades or win animation.
- **APK installed on Sarath's phone.**

Prompt
> Do Phase 2. The goal is the best-feeling offline version of the game: implement every match animation in PRD §7.2, sounds, haptics, the bot and pass & play, then configure EAS to build an APK. Tell me the command to run for the APK build.

---

## Phase 3 — Supabase foundation: auth, profiles, schema, security

Tasks
1. `supabase/` with local dev (Supabase CLI + Docker).
2. Migrations for all v1 tables in PRD §8.5, with indexes and **RLS policies**.
3. Auth: anonymous sign-in on first launch, username + avatar onboarding, link Google later.
4. Presence: online / in-game / last seen (Realtime presence or `last_seen_at` heartbeat).
5. `npm run sync-engine` script that copies `packages/engine` and `packages/rating` into `supabase/functions/_shared/`.
6. SQL tests (or Jest against local Supabase) proving RLS: a user cannot write moves, matches or ratings directly, cannot read strangers' private data.

Acceptance
- Fresh install → anonymous account → username saved → visible on Profile.
- RLS tests pass.

Prompt
> Do Phase 3. Build the Supabase schema with migrations and strict RLS, anonymous auth plus username onboarding, presence, and the sync-engine script. Include tests that prove clients can't write to matches, moves or ratings.

---

## Phase 4 — Online play: challenges and live matches

Tasks
1. Edge Functions: `create-challenge`, `accept-challenge`, `submit-move`, `claim-timeout`, `resign`, using the shared engine (PRD §8.4).
2. Server-side clocks with `turn_deadline`, 250 ms grace, client clock-offset sync.
3. Realtime subscription for match updates; optimistic moves with rollback on rejection.
4. Disconnect handling, abort rule, rematch (PRD §2.4–2.5).
5. `pg_cron` job to close abandoned matches.
6. Match screen reused from Phase 2 with an online controller.

Acceptance
- Two phones play a full match over mobile data with no desync.
- Killing the app mid-match and reopening resumes with correct clocks.
- Move round-trip measured and logged (target < 300 ms).

Prompt
> Do Phase 4. Implement server-authoritative online matches with the Edge Functions in PRD §8.4. Reuse the Phase 2 match UI with an online controller. Add a debug overlay showing move round-trip time.

---

## Phase 5 — Friends, WhatsApp links, deep links, web version

Tasks
1. Personal invite links `/i/<code>` and challenge links `/c/<code>` (PRD §5.2–5.3).
2. "Share on WhatsApp" button with prefilled text; fallback to share sheet.
3. Expo Router routes for both links; Android App Links + `assetlinks.json`.
4. Web export of the app, deployed to Vercel/Cloudflare Pages, handling the same routes for people without the app. "Get the Android app" button pointing to the latest APK.
5. Open Graph tags on link pages for a rich WhatsApp preview.
6. Friends screen: requests, list with presence, search by username, Challenge button.
7. Push notifications for challenges and friend accepts.

Acceptance
- Sending your invite link on WhatsApp to a phone **without** the app → friend plays you in the browser within 15 s.
- Same link on a phone **with** the app → opens straight into the app.
- WhatsApp shows a rich preview card.

Prompt
> Do Phase 5. Build friend invites and challenge links that work from WhatsApp for both app users and browser users, deploy the web version, add Open Graph previews and push notifications.

---

## Phase 6 — Ratings, Quick Match, leaderboards, profile

Tasks
1. `packages/rating`: Glicko-2 with unit tests against published reference values.
2. Rating update inside match finalization (atomic), `rating_history` rows.
3. `matchmake` function + queue (PRD §3.2), with "play bot while you wait".
4. Profile: ratings with provisional "?", rating graph (animated draw-in), stats, recent matches, head-to-head.
5. Leaderboards: friends + global, per time control.

Acceptance
- Rating changes after a rated match on both players; casual and bot games don't change it.
- Quick Match pairs two test accounts of similar rating.

Prompt
> Do Phase 6. Implement Glicko-2 with tests, server-side rating updates, Quick Match matchmaking, profile stats with the rating graph, and leaderboards.

---

## Phase 7 — Spectating and replays

Tasks
1. "Live now" strip on Home and "Watch" button in Friends list.
2. Spectate screen: read-only live board, clocks, score, spectator count.
3. Preset emoji reactions (rate-limited) that float up for players and spectators.
4. Replay viewer with play/pause, step, scrubber, built from the `moves` table + engine.

Acceptance
- A third phone watches a live match between two others in real time.
- Every finished match is replayable from both profiles.

Prompt
> Do Phase 7. Add spectating of friends' live games, emoji reactions and the replay viewer.

---

## Phase 8 — Polish, performance and release APK

Tasks
1. Full animation and sound pass against PRD §7 on a real mid-range phone; fix any frame drops.
2. Designed empty and loading states everywhere.
3. App icon, splash screen, app name.
4. Error handling: offline banners, retry, server rejections.
5. Crash reporting (Sentry) and basic analytics events (PRD §10).
6. Build the release APK with EAS, upload it to the web version's download link.

Acceptance
- Sarath and 3 friends/family play for a week without blockers.
- APK < 60 MB, cold start < 2.5 s.

Prompt
> Do Phase 8. Do a full polish and performance pass on a mid-range Android device, add icon and splash, error states, Sentry and analytics, then build the release APK and publish it to the download link.

---

## Phase 9 (v1.1) — Daily Fade + Ghost Chase

1. Puzzle bank generated by the solver (forced win in N moves), one per day, difficulty rising through the week.
2. Daily Fade screen, timer, mistakes, spoiler-free share card (emoji grid image + text).
3. Puzzle streaks with freezes.
4. Ghost Chase: friends' run times shown racing alongside you; push when someone beats your time.
5. Daily crown per friend circle.

---

## How to work with Claude Code on this
- Start each phase in a fresh Claude Code session with the phase prompt. Use **plan mode** first for Phases 3–5 (backend-heavy) and approve the plan before it writes code.
- After each phase: run it on your phone, then ask Claude Code to commit with a clear message and tick the phase in this file.
- If something feels off in the game feel, describe it in plain words ("the fade feels slow and floaty") and ask it to tune the animation values.

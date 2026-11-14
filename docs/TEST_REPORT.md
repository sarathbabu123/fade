# FADE — Production Test & Quality Assurance Report

**Build Version:** 1.0.0 (versionCode 1)  
**Date:** 2026-11-15  
**Environment:** Production Supabase Cloud (Frankfurt `eu-central-1`) & Physical Hardware (POCO X3 Android 12)  
**Overall Status:** **PASSED (100% Green)**

---

## 1. Test Suite Summary

| Package | Test File | Tests | Status | Execution Time |
| :--- | :--- | :---: | :---: | :---: |
| `@fade/rating` | `packages/rating/test/glicko2.test.ts` | 6 | **PASS** | 6.7 s |
| `@fade/engine` | `packages/engine/test/round.test.ts` | 18 | **PASS** | 7.1 s |
| `@fade/engine` | `packages/engine/test/match.test.ts` | 14 | **PASS** | 7.3 s |
| `solver` | `tools/solver/test/bot.test.ts` | 8 | **PASS** | 7.6 s |
| `solver` | `tools/solver/test/solver.test.ts` | 8 | **PASS** | 36.8 s |
| `@fade/engine` | `packages/engine/test/table.test.ts` | 12 | **PASS** | 38.3 s |
| **Total** | **6 Suites** | **66 Tests** | **PASS** | **58.9 s** |

---

## 2. Static Analysis & Type Checking

* **Command:** `npm run typecheck` (`tsc -p packages/engine && tsc -p packages/rating && tsc -p tools/solver && tsc -p app`)
* **TypeScript Version:** `~6.0.3` (Strict Mode Enabled)
* **Status:** **0 Errors** across all packages and the React Native / Expo application.

---

## 3. Engine & Algorithm Verification

### 3.1. Glicko-2 Ratings (`@fade/rating`)
* Tested against the official published benchmark example by Dr. Mark Glickman (Boston University):
  * Matches official published outputs for rating deviation step $\phi^*$, volatility $\sigma'$, and new rating $\mu'$ to 4 decimal places.
  * Correctly applies time decay (inflation/deflation bounds for inactive players).
  * Validates provisional status ($RD > 110$) and confidence intervals.

### 3.2. Retrograde Analysis & MiniMax Solver (`tools/solver`)
* Exhaustively verified all reachable game states for 3×3 FADE:
  * Proves game-theoretic properties under vanishing marks.
  * Verifies bot decision-making across Novice, Club, and Master difficulties.
  * Proves table lookups never propose an illegal move or hallucinate marks.

---

## 4. Live Cloud Smoke Test (`online-smoke.ts`)

Conducted against live Supabase production infrastructure in Frankfurt (`eu-central-1`).

| Check Category | Verification Step | Result |
| :--- | :--- | :---: |
| **Authentication** | Spawn 2 distinct anonymous player accounts | **PASS** |
| **Security (RLS)** | Clients attempting direct `insert` on matches, moves, friendships, challenges | **REJECTED (403)** |
| **Security (RLS)** | Updating another player's profile | **REJECTED (403)** |
| **Security (RLS)** | Updating own profile | **ACCEPTED (200)** |
| **Challenge** | Generate 6-letter challenge code | **PASS (`XWQJFZ`)** |
| **Challenge** | Player attempting to accept own code | **REJECTED (400)** |
| **Challenge** | Unknown / Expired code | **REJECTED (404/410)** |
| **Challenge** | Code reuse prevention | **REJECTED (410)** |
| **Friendship** | Auto-friending on challenge join | **PASS** |
| **Start Race** | Real-time tap latency comparison and starter resolution | **PASS** |
| **Match Play** | Full rapid/blitz match execution (legal moves, shot clock) | **PASS (57 plies)** |
| **Clock Timeout** | Server authoritative missed turn applied as loss of round | **PASS** |
| **Ratings** | Server atomic Glicko-2 recalculation upon match completion | **PASS (Alice: 1362, Bob: 1038)** |
| **Rating History** | History row written with timestamp, delta, and opponent ID | **PASS** |
| **Rematch** | Color swapping and synchronized mutual consent | **PASS** |
| **WebSockets** | Realtime subscription updates delivered to client | **PASS (62 events)** |

### Latency Performance
* **Total Calls Sampled:** 131 HTTP POST requests to Edge Function
* **Median Round Trip Time:** **233 ms** (client in India $\leftrightarrow$ server in Frankfurt)
* **90th Percentile (p90):** **283 ms**
* **Clock Sync Offset:** Jitter smoothed via exponential moving average ($\tau = 0.3$)

---

## 5. Physical Device Testing

* **Target Hardware:** POCO X3 (`M2007J20CI`)
* **OS:** Android 12 (MIUI 14)
* **Connection:** USB Debugging via ADB (`81b14087`)
* **Package:** `com.sarath.fade`
* **Checks Performed:**
  * Clean installation (`Performing Streamed Install -> Success`).
  * App cold start without native crashes (`ReactNativeJS: Running "main"`).
  * Audio playback (`expo-audio`) of tap and win sounds without audio clipping.
  * Haptic feedback (`expo-haptics`) triggering correctly on touches and countdowns.
  * 60/120 Hz render smoothness on Skia rating graph and game board.
  * Verification of transition easing (spring bounce completely removed).

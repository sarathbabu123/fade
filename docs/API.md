# FADE — Game Backend & API Reference

This document provides a comprehensive technical reference for the FADE game backend, Supabase architecture, Edge Functions, real-time channels, and database schema.

---

## 1. Architecture Overview

```
                      ┌───────────────────────────────────────────────┐
                      │              Expo Mobile App (React Native)    │
                      └───────┬───────────────────────────────┬───────┘
                              │ HTTPS (POST /functions/v1/fade)│ WebSockets (Postgres Changes)
                              ▼                               ▼
                      ┌───────────────────────┐       ┌───────────────────────┐
                      │ Supabase Edge Function│       │   Supabase Realtime   │
                      │  (Deno, eu-central-1) │       │   (Phoenix Channels)  │
                      └───────┬───────────────┘       └───────┬───────────────┘
                              │ Service Role Key (admin)      │ Row Level Security (RLS)
                              ▼                               ▼
                      ┌───────────────────────────────────────────────┐
                      │         Supabase Postgres Database            │
                      │   (matches, profiles, ratings, challenges)    │
                      └───────────────────────────────────────────────┘
```

* **Region:** Frankfurt (`eu-central-1`) — directly next to the database to minimize round-trip times (median ~230 ms from India/Europe).
* **Security Model:** Clients never write directly to `matches`, `moves`, `challenges`, or `ratings`. All mutations are processed authoritatively by the `fade` Edge Function running with the `service_role` key. Clients read data via Supabase Row Level Security (RLS) policies.

---

## 2. Authentication

FADE uses Supabase Anonymous Authentication (`supabase.auth.signInAnonymously()`).
* Users are automatically assigned a persistent `UUID`.
* The `access_token` JWT is passed in the `Authorization: Bearer <token>` header for all API calls.
* If a player uninstalls or clears data, they can delete their account or start fresh. Google/Apple linking is supported on top of the same user ID.

---

## 3. Edge Function Endpoints: `POST /functions/v1/fade`

Every request must include:
* Headers:
  * `Content-Type: application/json`
  * `apikey: <SUPABASE_PUBLISHABLE_KEY>`
  * `Authorization: Bearer <USER_ACCESS_TOKEN>`
  * `x-region: eu-central-1`
* Body: JSON object containing an `action` string and action-specific fields.

### 3.1. `ping`
Heartbeat check to verify connection and clock sync.
* **Payload:** `{ "action": "ping" }`
* **Response:**
  ```json
  { "ok": true, "serverNow": 1763172000000 }
  ```

---

### 3.2. `create-challenge`
Creates a 6-letter challenge code. Cancels any previously open challenges created by the user.
* **Payload:**
  ```json
  {
    "action": "create-challenge",
    "timeControl": "rapid" | "blitz",
    "rated": true,
    "toId": "uuid" | null
  }
  ```
* **Response (HTTP 200):**
  ```json
  {
    "ok": true,
    "code": "XWQJFZ",
    "expiresInMs": 600000,
    "serverNow": 1763172000000
  }
  ```

---

### 3.3. `cancel-challenge`
Cancels an open challenge created by the user.
* **Payload:**
  ```json
  {
    "action": "cancel-challenge",
    "code": "XWQJFZ"
  }
  ```
* **Response:** `{ "ok": true, "serverNow": 1763172000000 }`

---

### 3.4. `accept-challenge`
Joins a challenge code, creates the match row, and establishes mutual friendship.
* **Payload:**
  ```json
  {
    "action": "accept-challenge",
    "code": "XWQJFZ"
  }
  ```
* **Response (HTTP 200):**
  ```json
  {
    "ok": true,
    "matchId": "c4d32e98-2b1a-4d7a-8f3b-0123456789ab",
    "serverNow": 1763172000000
  }
  ```
* **Errors:**
  * `404`: No challenge with that code
  * `400`: Joining own code
  * `410`: Code expired or already used
  * `403`: Challenge intended for a different user

---

### 3.5. `tick`
State synchronization and clock catch-up. Evaluates pending timeouts or round transitions overdue by server time.
* **Payload:**
  ```json
  {
    "action": "tick",
    "matchId": "uuid"
  }
  ```
* **Response:**
  ```json
  {
    "ok": true,
    "match": { ...MatchRow },
    "serverNow": 1763172000000
  }
  ```

---

### 3.6. `race-tap`
Submits the phone's reaction time for the start-race countdown.
* **Payload:**
  ```json
  {
    "action": "race-tap",
    "matchId": "uuid",
    "tap": {
      "kind": "tap" | "falseStart" | "none",
      "reactionMs": 312
    }
  }
  ```
* **Behavior:** When both players have submitted their taps (or the window expires), the server starts the match with a 600 ms start pause.

---

### 3.7. `move`
Submits a cell placement in the active round.
* **Payload:**
  ```json
  {
    "action": "move",
    "matchId": "uuid",
    "roundNo": 1,
    "ply": 4,
    "cell": 4
  }
  ```
* **Response (HTTP 200):**
  ```json
  {
    "ok": true,
    "match": { ...MatchRow },
    "serverNow": 1763172000000
  }
  ```
* **Validation & Concurrency:**
  * Validates that `round.toMove === me`.
  * Verifies `roundNo` and `ply` match current state (prevents double moves).
  * Validates move legality according to FADE engine rules.
  * Checks turn clock with an 800 ms network grace period.

---

### 3.8. `resign`
Forfeits the active match.
* **Payload:** `{ "action": "resign", "matchId": "uuid" }`

---

### 3.9. `rematch`
Requests a rematch. If both players request, automatically creates a new match with swapped colors.
* **Payload:** `{ "action": "rematch", "matchId": "uuid" }`
* **Response:** `{ "ok": true, "match": { ... }, "rematchId": "new-uuid" | null }`

---

### 3.10. `delete-account` (Google Play Compliance)
Permanently deletes the authenticated user, their profile, rating history, and friendships.
* **Payload:** `{ "action": "delete-account" }`
* **Response:** `{ "ok": true, "deleted": true }`

---

## 4. Database Schema (Postgres)

### 4.1. `public.profiles`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK, FK `auth.users.id` ON DELETE CASCADE | User ID |
| `username` | `citext` | UNIQUE, 3-16 chars `^[A-Za-z0-9_]{3,16}$` | Case-insensitive handle |
| `avatar_glyph` | `text` | 8 neon glyphs | Selected icon |
| `avatar_color` | `text` | 8 neon colors | Selected palette color |
| `last_seen_at` | `timestamptz` | Default `now()` | Online presence tracking |

### 4.2. `public.matches`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `player_x` | `uuid` | Player X user ID |
| `player_o` | `uuid` | Player O user ID |
| `time_control`| `text` | `'rapid'` (8s) or `'blitz'` (3s) |
| `rated` | `boolean` | Whether Glicko-2 updates apply |
| `status` | `text` | `'race'`, `'active'`, `'finished'`, `'aborted'` |
| `race` | `jsonb` | Scheduled `goAt` and player tap timestamps |
| `state` | `jsonb` | Serialized full engine `MatchState` |
| `version` | `bigint` | Monotonic incrementing state version for optimistic locking |
| `turn_started_at` | `timestamptz` | Current move clock start |

### 4.3. `public.ratings`
| Column | Type | Description |
| :--- | :--- | :--- |
| `user_id` | `uuid` | PK, references `profiles(id)` |
| `time_control`| `text` | PK, `'rapid'` or `'blitz'` |
| `rating` | `real` | Glicko-2 rating (Default 1200) |
| `rd` | `real` | Rating deviation (Default 350, decreases with games) |
| `volatility` | `real` | Rating volatility (Default 0.06) |
| `wins` | `integer` | Total wins |
| `losses` | `integer` | Total losses |
| `draws` | `integer` | Total draws |
| `streak` | `integer` | Current win streak |
| `best_streak` | `integer` | Highest win streak |

---

## 5. Realtime Subscriptions

Clients subscribe to Postgres Changes over WebSockets:
* **Match Updates:**
  ```typescript
  supabase
    .channel(`match-${matchId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'matches',
      filter: `id=eq.${matchId}`
    }, (payload) => accept(payload.new))
    .subscribe();
  ```
* **Incoming Challenges:**
  ```typescript
  supabase
    .channel(`incoming-${me}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'challenges',
      filter: `to_id=eq.${me}`
    }, (payload) => handleIncoming(payload.new))
    .subscribe();
  ```


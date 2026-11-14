# SOS — Engineering Architecture & Build Plan

This plan outlines the technical steps to integrate **SOS** as a first-class game in the FADE monorepo, supporting offline local play (Pass & Play, AI Bot) and online real-time multiplayer.

---

## 1. Engine Architecture (`@fade/engine/src/sos`)

### 1.1. Data Structures
```typescript
export type SosLetter = 'S' | 'O';
export type SosPlayer = 'X' | 'O'; // Reuses X (Player 1) and O (Player 2)

export interface SosCell {
  letter: SosLetter;
  player: SosPlayer; // Who placed it
  turnNo: number;
}

export interface SosLine {
  id: string; // e.g. "h-0-1-2"
  cells: [number, number, number]; // 3 cell indices
  player: SosPlayer; // Scored by
}

export interface SosConfig {
  size: 4 | 5; // 4x4 or 5x5
  timeControl: 'rapid' | 'blitz';
}

export interface SosState {
  config: SosConfig;
  board: (SosCell | null)[];
  scores: Record<SosPlayer, number>;
  lines: SosLine[];
  toMove: SosPlayer;
  status: 'playing' | 'finished';
  winner: SosPlayer | 'draw' | null;
  ply: number;
}
```

### 1.2. Precomputed SOS Windows (`lines.ts`)
For a grid of size $N$, compute all valid 3-cell collinear combinations:
* **Horizontal:** $(r, c), (r, c+1), (r, c+2)$ for $c \le N-3$.
* **Vertical:** $(r, c), (r+1, c), (r+2, c)$ for $r \le N-3$.
* **Diagonal (\):** $(r, c), (r+1, c+1), (r+2, c+2)$ for $r \le N-3, c \le N-3$.
* **Anti-Diagonal (/):** $(r, c), (r+1, c-1), (r+2, c-2)$ for $r \le N-3, c \ge 2$.

### 1.3. State Transition (`engine.ts`)
* `applySosMove(state: SosState, cell: number, letter: SosLetter): SosState`:
  1. Check cell is empty and game is `'playing'`.
  2. Place `{ letter, player: state.toMove, turnNo: state.ply }`.
  3. Scan all precomputed lines containing `cell`:
     * If cells match `['S', 'O', 'S']` and the line is not already in `state.lines`, record it as scored by `state.toMove`.
  4. If new lines formed $> 0$:
     * Add points to `scores[state.toMove]`.
     * `toMove` stays the same (EXTRA TURN).
  5. Else:
     * `toMove` swaps to other player.
  6. If board is full:
     * `status = 'finished'`.
     * Determine winner by comparing scores.

### 1.4. Bot AI (`bot.ts`)
* **Level 1 (Novice):** Random placement of S or O.
* **Level 2 (Club):**
  * Immediate scoring: if any cell + letter forms an SOS, pick it!
  * Avoid gifting: don't play an 'O' between two empty squares or adjacent to an existing 'S'.
* **Level 3 (Master):** Greedy point capture + heuristic minimax depth-limited search.

---

## 2. Frontend Components (`app/src/game/sos`)

1. **`SosBoard.tsx`:**
   * $N \times N$ interactive neon grid.
   * Renders glowing 'S' and 'O' in custom neon typography.
   * Renders laser strike lines connecting completed SOS triplets with glowing SVG / Skia paths.
2. **`SosLetterToggle.tsx`:**
   * A clean, quick-switch selector for `[ S ]` and `[ O ]` with haptic feedback.
3. **`SosScoreboard.tsx`:**
   * Displays Player 1 (Coral) vs Player 2 (Cyan) points with animated numbers and an "EXTRA TURN!" indicator.
4. **Game Mode Navigation:**
   * Add Game Mode Selector to Home screen:
     * **FADE** (Vanishing 3x3/4x4)
     * **SOS** (Grid Duel 4x4/5x5)

---

## 3. Multiplayer & Backend Integration

1. **Edge Function `supabase/functions/fade/index.ts`:**
   * Supports `game: 'fade' | 'sos'`.
   * When `game === 'sos'`, `createMatch` initializes `SosState`, and `action: 'move'` accepts `{ cell, letter }` to run `applySosMove`.
2. **Database:**
   * `matches.state` stores `SosState` natively as JSON.
   * Glicko-2 ratings update upon match conclusion using existing rating pipeline.

---

## 4. Phase Execution Plan

* [x] **Phase 1:** Rules & Architecture documentation (`SOS_RULES.md`, `SOS_BUILD_PLAN.md`).
* [ ] **Phase 2:** Engine implementation (`@fade/engine/src/sos/*`) with 100% unit test coverage.
* [ ] **Phase 3:** Frontend UI components (`SosBoard`, `SosLetterToggle`, `SosScoreboard`).
* [ ] **Phase 4:** Game Selector on Home screen + Pass & Play and Bot game modes.
* [ ] **Phase 5:** Backend Edge Function support for online SOS multiplayer.


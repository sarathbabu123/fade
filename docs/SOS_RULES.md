# SOS — Game Rules & Design Specification

**FADE Suite — Game 2: SOS Duel**  
*The classic pen-and-paper tactical grid duel, reimagined with neon lasers, shot clocks, and online multiplayer.*

---

## 1. Game Overview

**SOS** is a two-player turn-based connection game played on an $N \times N$ grid (Standard: $5 \times 5$, Blitz: $4 \times 4$).

Unlike Tic-Tac-Toe where Player 1 is locked to 'X' and Player 2 is locked to 'O', in **SOS**:
* **Both players can choose to place either an 'S' or an 'O' on any turn.**
* The goal is to form the three-letter sequence **"S-O-S"** in a straight line (horizontally, vertically, or diagonally).
* Completing an SOS awards **1 point** and a **bonus extra turn**.
* The game ends when the grid is completely full. The player with the highest score wins!

---

## 2. Formal Rules of Play

### 2.1. Board Setup
* **Grid:** $5 \times 5$ (25 cells) for standard play; $4 \times 4$ (16 cells) for lightning blitz.
* **Initial State:** All cells are empty.
* **Scores:** Player 1 starts at 0; Player 2 starts at 0.
* **First Move:** Decided by the FADE Start Race (fastest reaction after GO moves first).

### 2.2. Turn Structure
1. On their turn, the active player:
   * Selects letter **'S'** or **'O'**.
   * Taps an unoccupied cell to place the selected letter.
2. The game evaluates whether the newly placed letter completed any new 3-cell **S-O-S** sequences:
   * **Horizontal:** 3 consecutive cells in the same row ($c, c+1, c+2$).
   * **Vertical:** 3 consecutive cells in the same column ($r, r+1, r+2$).
   * **Diagonal:** 3 consecutive cells along a main or anti-diagonal.

### 2.3. Scoring & Laser Strike Lines
* For every new **S-O-S** formed by the move:
  * The active player receives **+1 point**.
  * A glowing neon laser strike line is drawn across the 3 cells in the scoring player's color:
    * **Coral (#FF5A5F)** for Player 1.
    * **Cyan (#3DE0FF)** for Player 2.
* **Multiple SOS in One Move:**
  * Placing a single letter (especially an 'O' between two 'S's, or an 'S' completing both a row and a diagonal) can form 2, 3, or even 4 SOS sequences simultaneously!
  * The player receives **+1 point for EACH valid sequence formed**, and multiple strike lines are drawn.

### 2.4. The "Extra Turn" Bonus (Combo Streak)
* **If a player scores $\ge 1$ point:**
  * They **keep their turn** and must immediately play again!
  * If their next move forms another SOS, they score again and keep playing.
  * This creates thrilling chain reactions where an observant player can sweep 4 or 5 points in a single combo.
* **If no SOS is formed:**
  * The turn passes to the opponent.

### 2.5. Clocks & Time Controls
To maintain the fast-paced FADE identity:
* **Rapid:** 8 seconds per move.
* **Blitz:** 4 seconds per move.
* If a player's shot clock expires:
  * In Pass & Play / Bot: Random legal placement.
  * In Online Match: The server applies a timeout penalty (random placement or pass).

### 2.6. Game End & Victory Condition
* The game ends immediately when **all cells on the board are occupied**.
* **Win:** The player with the highest total score wins the match.
* **Draw:** If both players finish with the exact same score, the match is declared a draw.

---

## 3. Tactical Depth & Strategy

1. **The "Bait & Trap":**
   * Placing an 'S' followed by an empty square and another 'S' creates an immediate trap: whoever plays 'O' in the middle scores!
   * Smart players avoid playing into traps unless forced, saving them for when the board tightens.
2. **Defensive S vs Defensive O:**
   * 'O' is often more dangerous than 'S' because 'O' is the center of every SOS. Placing an 'O' adjacent to an existing 'S' can immediately gift the opponent a score.
3. **Endgame Flooding:**
   * In the final turns, the player forced to break open a cluster often gives away a cascade of 3–5 consecutive points to the opponent.

---

## 4. Visual & Sound Identity (Neon Ink)

* **Grid:** Deep night obsidian (`#0B0D17`) with glass border glow.
* **Letters:**
  * 'S' and 'O' render in high-contrast futuristic typography.
  * Letters placed by Player 1 carry a subtle Coral underglow; letters by Player 2 carry a subtle Cyan underglow.
* **Laser Lines:**
  * Rendered with React Native Skia / SVG glow filters.
  * Laser strikes flash brightly on creation, accompanied by a sound effect.
* **Combo Counter:**
  * Floating "+1 SOS!" banner pops on each completed line with haptic impact.


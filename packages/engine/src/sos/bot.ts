import { applySosMove, legalSosMoves } from './engine.ts';
import type { SosLetter, SosState } from './types.ts';

export interface BotSosAction {
  cell: number;
  letter: SosLetter;
}

/** Check if placing letter at cell produces >= 1 point for the current player. */
function evaluatesScore(state: SosState, cell: number, letter: SosLetter): number {
  try {
    const next = applySosMove(state, cell, letter);
    return next.lastPointsEarned;
  } catch {
    return 0;
  }
}

/**
 * Intelligent bot for SOS.
 * Difficulties: 'easy' | 'medium' | 'hard'
 */
export function botSosMove(state: SosState, level: 'easy' | 'medium' | 'hard' = 'medium'): BotSosAction {
  const empty = legalSosMoves(state);
  if (empty.length === 0) throw new Error('No legal moves');

  const candidates: BotSosAction[] = [];
  for (const cell of empty) {
    candidates.push({ cell, letter: 'S' });
    candidates.push({ cell, letter: 'O' });
  }

  // 1. Check for immediate scoring moves
  const scoringMoves: { action: BotSosAction; points: number }[] = [];
  for (const act of candidates) {
    const pts = evaluatesScore(state, act.cell, act.letter);
    if (pts > 0) scoringMoves.push({ action: act, points: pts });
  }

  // Sort by highest points earned
  scoringMoves.sort((a, b) => b.points - a.points);

  if (scoringMoves.length > 0) {
    if (level === 'easy' && Math.random() < 0.35) {
      // Novice sometimes misses an immediate score
    } else {
      return scoringMoves[0].action;
    }
  }

  if (level === 'easy') {
    // Pick any random move
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // 2. Safe Move Filtering (Medium & Hard):
  // Filter out any move that leaves an immediate scoring reply for the opponent.
  const safeMoves: BotSosAction[] = [];

  for (const act of candidates) {
    let giftsScore = false;
    try {
      const nextState = applySosMove(state, act.cell, act.letter);
      const opponentMoves = legalSosMoves(nextState);
      for (const oppCell of opponentMoves) {
        if (evaluatesScore(nextState, oppCell, 'S') > 0 || evaluatesScore(nextState, oppCell, 'O') > 0) {
          giftsScore = true;
          break;
        }
      }
    } catch {
      giftsScore = true;
    }

    if (!giftsScore) safeMoves.push(act);
  }

  // If safe moves exist, choose from them!
  if (safeMoves.length > 0) {
    // Prefer corner or edge placements to minimize giving middle 'O' traps
    return safeMoves[Math.floor(Math.random() * safeMoves.length)];
  }

  // If forced to make an unsafe move, pick one that minimizes exposure
  return candidates[Math.floor(Math.random() * candidates.length)];
}


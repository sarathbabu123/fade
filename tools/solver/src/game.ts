/**
 * Solver-side view of a round: just the position (marks + timeout counters) from
 * the player to move. Uses the engine's rules (applyMove / applyTimeout) as the
 * reference via a test; this fast path exists because the solver visits millions
 * of positions.
 */
import { winningLines } from '@fade/engine';
import type { Position } from '@fade/engine';

export interface Rules {
  n: number;
  k: number;
  l: number;
  /** maxConsecutiveTimeouts */
  t: number;
  /** Allow a deliberate timeout as an action. */
  timeouts: boolean;
}

export const WIN_NOW = -1;
export const LOSE_NOW = -2;

export interface Action {
  /** Cell placed, or null for a timeout. */
  cell: number | null;
  /** WIN_NOW, LOSE_NOW or the next position (from the opponent's side). */
  result: typeof WIN_NOW | typeof LOSE_NOW | Position;
}

export function lineMasks(rules: Rules): number[] {
  return winningLines(rules.n, rules.l).map((line) => line.reduce((m, c) => m | (1 << c), 0));
}

export function maskOf(cells: readonly number[]): number {
  let m = 0;
  for (const c of cells) m |= 1 << c;
  return m;
}

function hasLine(mask: number, lines: readonly number[]): boolean {
  for (const l of lines) if ((mask & l) === l) return true;
  return false;
}

export function actions(rules: Rules, pos: Position, lines: readonly number[]): Action[] {
  const out: Action[] = [];
  const occupied = maskOf(pos.mover) | maskOf(pos.opp);
  const cells = rules.n * rules.n;
  for (let c = 0; c < cells; c++) {
    if (occupied & (1 << c)) continue;
    const mine = pos.mover.length >= rules.k ? [...pos.mover.slice(1), c] : [...pos.mover, c];
    if (hasLine(maskOf(mine), lines)) {
      out.push({ cell: c, result: WIN_NOW });
    } else {
      out.push({
        cell: c,
        result: { mover: pos.opp, opp: mine, moverTimeouts: pos.oppTimeouts, oppTimeouts: 0 },
      });
    }
  }
  if (rules.timeouts) {
    const count = pos.moverTimeouts + 1;
    if (count >= rules.t) {
      out.push({ cell: null, result: LOSE_NOW });
    } else {
      out.push({
        cell: null,
        result: { mover: pos.opp, opp: pos.mover.slice(1), moverTimeouts: pos.oppTimeouts, oppTimeouts: count },
      });
    }
  }
  return out;
}

export const START: Position = { mover: [], opp: [], moverTimeouts: 0, oppTimeouts: 0 };

/** Deterministic PRNG (mulberry32) so reports are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

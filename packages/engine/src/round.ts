import { findLine } from './lines.ts';
import { EngineError, other } from './types.ts';
import type { Player, RoundConfig, RoundState } from './types.ts';

export const DEFAULT_ROUND_CONFIG: RoundConfig = {
  n: 3,
  k: 3,
  l: 3,
  maxConsecutiveTimeouts: 3,
  maxPlies: 60,
  suddenDeathAfter: 30,
};

export function validateConfig(config: RoundConfig): void {
  const { n, k, l, maxConsecutiveTimeouts, maxPlies, suddenDeathAfter } = config;
  const ints = [n, k, l, maxConsecutiveTimeouts, maxPlies, suddenDeathAfter];
  if (!ints.every((v) => Number.isInteger(v) && v >= 1)) {
    throw new EngineError('config values must be positive integers');
  }
  if (n < 2) throw new EngineError('n must be at least 2');
  if (l > n) throw new EngineError('l cannot exceed n');
  if (k < l) throw new EngineError('k must be at least l, or nobody can win');
  // The player to move must always have an empty cell: both players can hold k marks.
  if (2 * k >= n * n) throw new EngineError('2k must be less than n*n');
}

export function createRound(config: RoundConfig, starter: Player): RoundState {
  validateConfig(config);
  return {
    config: { ...config },
    starter,
    toMove: starter,
    marks: { X: [], O: [] },
    timeouts: { X: 0, O: 0 },
    ply: 0,
    status: 'playing',
    winner: null,
    reason: null,
    line: null,
    last: null,
  };
}

export function cellOwner(state: RoundState, cell: number): Player | null {
  if (state.marks.X.includes(cell)) return 'X';
  if (state.marks.O.includes(cell)) return 'O';
  return null;
}

/** Board as an array of n*n cells. */
export function board(state: RoundState): (Player | null)[] {
  const cells: (Player | null)[] = new Array(state.config.n * state.config.n).fill(null);
  for (const c of state.marks.X) cells[c] = 'X';
  for (const c of state.marks.O) cells[c] = 'O';
  return cells;
}

/** Empty cells. A cell holding a mark that is about to fade is still occupied. */
export function legalMoves(state: RoundState): number[] {
  if (state.status !== 'playing') return [];
  const size = state.config.n * state.config.n;
  const moves: number[] = [];
  for (let c = 0; c < size; c++) if (cellOwner(state, c) === null) moves.push(c);
  return moves;
}

export function isLegalMove(state: RoundState, cell: number): boolean {
  return (
    state.status === 'playing' &&
    Number.isInteger(cell) &&
    cell >= 0 &&
    cell < state.config.n * state.config.n &&
    cellOwner(state, cell) === null
  );
}

/**
 * The mark that will fade when `player` next places a mark: their oldest mark,
 * but only once they hold k marks. Null otherwise.
 */
export function nextToFade(state: RoundState, player: Player): number | null {
  const q = state.marks[player];
  return q.length >= state.config.k ? q[0]! : null;
}

/** The player's oldest mark (what a timeout would fade), or null if they have none. */
export function oldestMark(state: RoundState, player: Player): number | null {
  return state.marks[player][0] ?? null;
}

export function isSuddenDeath(state: RoundState): boolean {
  return state.ply >= state.config.suddenDeathAfter;
}

export function winner(state: RoundState): Player | null {
  return state.winner;
}

function finishPly(next: RoundState): RoundState {
  if (next.status === 'playing' && next.ply >= next.config.maxPlies) {
    next.status = 'draw';
    next.reason = 'cap';
  }
  return next;
}

function cloneForPly(state: RoundState): RoundState {
  return {
    ...state,
    marks: { X: [...state.marks.X], O: [...state.marks.O] },
    timeouts: { ...state.timeouts },
  };
}

/**
 * Place a mark for the player to move:
 * 1. place on an empty cell, appended to the player's queue;
 * 2. if they now hold more than k marks, their oldest fades;
 * 3. then check for a win using only the marks still on the board;
 * 4. turn passes.
 */
export function applyMove(state: RoundState, cell: number): RoundState {
  if (state.status !== 'playing') throw new EngineError('round is over');
  if (!isLegalMove(state, cell)) throw new EngineError(`illegal move: ${cell}`);
  const p = state.toMove;
  const next = cloneForPly(state);
  const q = next.marks[p];
  q.push(cell);
  const faded = q.length > state.config.k ? q.shift()! : null;
  next.timeouts[p] = 0;
  next.ply = state.ply + 1;
  next.toMove = other(p);
  next.last = { kind: 'move', player: p, cell, faded };
  const line = findLine(q, state.config.n, state.config.l);
  if (line) {
    next.status = 'won';
    next.winner = p;
    next.reason = 'line';
    next.line = line;
    return next;
  }
  return finishPly(next);
}

/**
 * The player to move ran out of time: their oldest mark fades (if any), no mark
 * is placed and the turn passes. maxConsecutiveTimeouts in a row lose the round.
 */
export function applyTimeout(state: RoundState): RoundState {
  if (state.status !== 'playing') throw new EngineError('round is over');
  const p = state.toMove;
  const next = cloneForPly(state);
  const faded = next.marks[p].shift() ?? null;
  next.timeouts[p] = state.timeouts[p] + 1;
  next.ply = state.ply + 1;
  next.toMove = other(p);
  next.last = { kind: 'timeout', player: p, cell: null, faded };
  if (next.timeouts[p] >= state.config.maxConsecutiveTimeouts) {
    next.status = 'won';
    next.winner = other(p);
    next.reason = 'timeouts';
    return next;
  }
  return finishPly(next);
}

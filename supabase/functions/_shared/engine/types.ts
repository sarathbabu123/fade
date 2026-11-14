export type Player = 'X' | 'O';

export const PLAYERS: readonly Player[] = ['X', 'O'];

export function other(p: Player): Player {
  return p === 'X' ? 'O' : 'X';
}

/** Rules for a single round. Cells are numbered row-major: cell = row * n + col. */
export interface RoundConfig {
  /** Board is n×n. */
  n: number;
  /** Max marks per player on the board; placing the (k+1)th fades the oldest. */
  k: number;
  /** Marks in a row needed to win. */
  l: number;
  /** This many consecutive timeouts by one player lose them the round. */
  maxConsecutiveTimeouts: number;
  /** Round is a draw after this many plies (moves + timeouts) without a winner. */
  maxPlies: number;
  /** After this many plies the shorter sudden-death clock applies. */
  suddenDeathAfter: number;
}

export type RoundStatus = 'playing' | 'won' | 'draw';
export type RoundEndReason = 'line' | 'timeouts' | 'cap';

/** What the last ply did. Used by the UI for animations and by replays. */
export interface LastAction {
  kind: 'move' | 'timeout';
  player: Player;
  /** Cell placed on; null for a timeout. */
  cell: number | null;
  /** Cell whose mark faded during this ply, if any. */
  faded: number | null;
}

/** Plain JSON (stored in matches.state). */
export interface RoundState {
  config: RoundConfig;
  starter: Player;
  toMove: Player;
  /** Each player's marks on the board, oldest first. */
  marks: Record<Player, number[]>;
  /** Consecutive timeouts per player; reset when that player places a mark. */
  timeouts: Record<Player, number>;
  /** Plies played this round (moves and timeouts both count). */
  ply: number;
  status: RoundStatus;
  winner: Player | null;
  reason: RoundEndReason | null;
  /** Winning line cells when reason === 'line'. */
  line: number[] | null;
  last: LastAction | null;
}

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}

import { getLinesForSize } from './lines.ts';
import type { SosConfig, SosLetter, SosLine, SosPlayer, SosState } from './types.ts';

export const DEFAULT_SOS_CONFIG: SosConfig = {
  size: 5,
  timeControl: 'rapid',
};

export function sosTimeLimitMs(tc: 'rapid' | 'blitz'): number {
  return tc === 'blitz' ? 4000 : 8000;
}

export function createSosGame(config: Partial<SosConfig> = {}, starter: SosPlayer = 'X'): SosState {
  const fullConfig: SosConfig = { ...DEFAULT_SOS_CONFIG, ...config };
  const cellCount = fullConfig.size * fullConfig.size;
  return {
    config: fullConfig,
    board: new Array(cellCount).fill(null),
    scores: { X: 0, O: 0 },
    lines: [],
    toMove: starter,
    status: 'playing',
    winner: null,
    ply: 0,
    lastScoredBy: null,
    lastPointsEarned: 0,
  };
}

export function legalSosMoves(state: SosState): number[] {
  if (state.status !== 'playing') return [];
  const moves: number[] = [];
  for (let i = 0; i < state.board.length; i++) {
    if (state.board[i] === null) moves.push(i);
  }
  return moves;
}

/**
 * Apply a move in SOS.
 * If the move creates 1 or more S-O-S sequences, points are added and the player
 * retains their turn ("EXTRA TURN"). Otherwise, the turn passes to the opponent.
 */
export function applySosMove(state: SosState, cell: number, letter: SosLetter): SosState {
  if (state.status !== 'playing') throw new Error('Game is finished');
  if (cell < 0 || cell >= state.board.length) throw new Error(`Cell ${cell} out of bounds`);
  if (state.board[cell] !== null) throw new Error(`Cell ${cell} is already occupied`);
  if (letter !== 'S' && letter !== 'O') throw new Error(`Invalid letter: ${letter}`);

  const nextBoard = [...state.board];
  nextBoard[cell] = { letter, player: state.toMove, turnNo: state.ply };

  // Scan all triplets containing this cell
  const allLines = getLinesForSize(state.config.size);
  const existingLineIds = new Set(state.lines.map((l) => l.id));
  const newLines: SosLine[] = [];

  for (const [a, b, c] of allLines) {
    if (a !== cell && b !== cell && c !== cell) continue;
    const ca = nextBoard[a];
    const cb = nextBoard[b];
    const cc = nextBoard[c];
    if (ca?.letter === 'S' && cb?.letter === 'O' && cc?.letter === 'S') {
      const id = `${a}-${b}-${c}`;
      if (!existingLineIds.has(id)) {
        newLines.push({ id, cells: [a, b, c], player: state.toMove });
      }
    }
  }

  const pointsEarned = newLines.length;
  const nextScores = { ...state.scores };
  let nextToMove = state.toMove;

  if (pointsEarned > 0) {
    nextScores[state.toMove] += pointsEarned;
    // Player gets an EXTRA TURN when they score
    nextToMove = state.toMove;
  } else {
    // Pass turn to opponent
    nextToMove = state.toMove === 'X' ? 'O' : 'X';
  }

  const updatedLines = [...state.lines, ...newLines];
  const isFull = nextBoard.every((c) => c !== null);

  let nextStatus: 'playing' | 'finished' = 'playing';
  let nextWinner: SosPlayer | 'draw' | null = null;

  if (isFull) {
    nextStatus = 'finished';
    if (nextScores.X > nextScores.O) nextWinner = 'X';
    else if (nextScores.O > nextScores.X) nextWinner = 'O';
    else nextWinner = 'draw';
  }

  return {
    config: state.config,
    board: nextBoard,
    scores: nextScores,
    lines: updatedLines,
    toMove: nextToMove,
    status: nextStatus,
    winner: nextWinner,
    ply: state.ply + 1,
    lastScoredBy: pointsEarned > 0 ? state.toMove : null,
    lastPointsEarned: pointsEarned,
  };
}


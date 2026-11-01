import { describe, expect, it } from '@jest/globals';
import {
  applyMove,
  applyTimeout,
  board,
  createRound,
  DEFAULT_ROUND_CONFIG,
  EngineError,
  isLegalMove,
  isSuddenDeath,
  legalMoves,
  nextToFade,
  oldestMark,
  validateConfig,
  winningLines,
} from '../src/index.ts';
import type { RoundState } from '../src/index.ts';

/** Play cells in order (alternating, starting with the round's starter). */
function play(cells: number[], state = createRound(DEFAULT_ROUND_CONFIG, 'X')): RoundState {
  return cells.reduce((s, c) => applyMove(s, c), state);
}

// Cell layout on 3×3:
// 0 1 2
// 3 4 5
// 6 7 8

describe('board and lines', () => {
  it('3×3 has 8 winning lines', () => {
    expect(winningLines(3, 3)).toHaveLength(8);
  });
  it('4×4 with L=3 has 24 lines and L=4 has 10', () => {
    expect(winningLines(4, 3)).toHaveLength(24);
    expect(winningLines(4, 4)).toHaveLength(10);
  });
  it('new round is empty with the starter to move', () => {
    const s = createRound(DEFAULT_ROUND_CONFIG, 'O');
    expect(s.toMove).toBe('O');
    expect(board(s).every((c) => c === null)).toBe(true);
    expect(legalMoves(s)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('rejects configs where nobody can win or the board can fill up', () => {
    expect(() => validateConfig({ ...DEFAULT_ROUND_CONFIG, k: 2 })).toThrow(EngineError);
    expect(() => validateConfig({ ...DEFAULT_ROUND_CONFIG, l: 4 })).toThrow(EngineError);
    expect(() => validateConfig({ ...DEFAULT_ROUND_CONFIG, k: 5 })).toThrow(EngineError);
    expect(() => validateConfig({ ...DEFAULT_ROUND_CONFIG, n: 4, k: 4, l: 4 })).not.toThrow();
  });
});

describe('a move', () => {
  it('places on an empty cell and passes the turn', () => {
    const s = play([4]);
    expect(s.marks.X).toEqual([4]);
    expect(s.toMove).toBe('O');
    expect(s.ply).toBe(1);
    expect(s.last).toEqual({ kind: 'move', player: 'X', cell: 4, faded: null });
  });

  it('cannot play an occupied cell', () => {
    const s = play([4]);
    expect(isLegalMove(s, 4)).toBe(false);
    expect(() => applyMove(s, 4)).toThrow(EngineError);
    expect(() => applyMove(s, 9)).toThrow(EngineError);
    expect(() => applyMove(s, -1)).toThrow(EngineError);
    expect(() => applyMove(s, 1.5)).toThrow(EngineError);
  });

  it('does not mutate the input state', () => {
    const s = play([4, 0]);
    const copy = JSON.parse(JSON.stringify(s));
    applyMove(s, 8);
    applyTimeout(s);
    expect(s).toEqual(copy);
  });

  it('placing the 4th mark fades the oldest', () => {
    // X: 0, 2, 7 then 5 → 0 fades. O: 3, 4, 8 (no line for O: 3,4 + 8).
    const s = play([0, 3, 2, 4, 7, 8, 5]);
    expect(s.marks.X).toEqual([2, 7, 5]);
    expect(s.last?.faded).toBe(0);
    expect(board(s)[0]).toBeNull();
    expect(isLegalMove(s, 0)).toBe(true);
  });

  it('the 4th mark removes the oldest BEFORE the win check: a line that needs the faded mark is not a win', () => {
    // X: 0, 1, 6 (O blocks 2 never needed). X's 4th mark at 2 would make 0-1-2,
    // but 0 is X's oldest and fades first, so it is not a win.
    // O plays 3, 5, 7 (no line).
    const before = play([0, 3, 1, 5, 6, 7]);
    expect(before.marks.X).toEqual([0, 1, 6]);
    const s = applyMove(before, 2);
    expect(s.marks.X).toEqual([1, 6, 2]);
    expect(s.status).toBe('playing');
    expect(s.winner).toBeNull();
  });

  it('a line made of the three newest marks after a fade is a win', () => {
    // X: 6, 1, 2 then 0 → 6 fades, X holds 1, 2, 0 = top row.
    const before = play([6, 3, 1, 4, 2, 8]);
    // O holds 3, 4, 8 (no line); X holds 6, 1, 2.
    expect(before.status).toBe('playing');
    const s = applyMove(before, 0);
    expect(s.marks.X).toEqual([1, 2, 0]);
    expect(s.last?.faded).toBe(6);
    expect(s.status).toBe('won');
    expect(s.winner).toBe('X');
    expect(s.reason).toBe('line');
    expect(s.line).toEqual([0, 1, 2]);
  });

  it('wins with 3 in a row before any fade', () => {
    const s = play([0, 3, 1, 4, 2]);
    expect(s.status).toBe('won');
    expect(s.winner).toBe('X');
    expect(s.line).toEqual([0, 1, 2]);
    expect(legalMoves(s)).toEqual([]);
    expect(() => applyMove(s, 8)).toThrow(EngineError);
  });

  it('you cannot play on your own about-to-fade cell', () => {
    const s = play([0, 3, 1, 4, 8, 6]); // X: 0,1,8  O: 3,4,6
    expect(s.toMove).toBe('X');
    expect(nextToFade(s, 'X')).toBe(0);
    expect(isLegalMove(s, 0)).toBe(false);
    expect(legalMoves(s)).not.toContain(0);
    expect(() => applyMove(s, 0)).toThrow(EngineError);
  });

  it("you cannot play on the opponent's about-to-fade cell either", () => {
    const s = play([0, 3, 1, 4, 8, 6]);
    expect(nextToFade(s, 'O')).toBe(3);
    expect(isLegalMove(s, 3)).toBe(false);
    expect(legalMoves(s)).toEqual([2, 5, 7]);
  });
});

describe('next to fade', () => {
  it('is null until the player holds k marks, then the oldest', () => {
    let s = play([0]);
    expect(nextToFade(s, 'X')).toBeNull();
    expect(oldestMark(s, 'X')).toBe(0);
    s = play([0, 3, 1, 4]);
    expect(nextToFade(s, 'X')).toBeNull();
    s = play([0, 3, 1, 4, 8]);
    expect(nextToFade(s, 'X')).toBe(0);
    expect(nextToFade(s, 'O')).toBeNull();
    expect(oldestMark(s, 'O')).toBe(3);
  });
});

describe('timeouts', () => {
  it('a timeout fades the oldest mark, places nothing and passes the turn', () => {
    const s = applyTimeout(play([0, 3, 1, 4]));
    expect(s.marks.X).toEqual([1]);
    expect(s.marks.O).toEqual([3, 4]);
    expect(s.toMove).toBe('O');
    expect(s.ply).toBe(5);
    expect(s.timeouts.X).toBe(1);
    expect(s.last).toEqual({ kind: 'timeout', player: 'X', cell: null, faded: 0 });
  });

  it('a timeout with no marks just passes the turn (and still counts)', () => {
    const s = applyTimeout(createRound(DEFAULT_ROUND_CONFIG, 'X'));
    expect(s.marks.X).toEqual([]);
    expect(s.toMove).toBe('O');
    expect(s.timeouts.X).toBe(1);
    expect(s.last?.faded).toBeNull();
  });

  it('3 consecutive timeouts by one player lose them the round', () => {
    let s = createRound(DEFAULT_ROUND_CONFIG, 'X');
    s = applyTimeout(s); // X 1
    s = applyMove(s, 4); // O
    s = applyTimeout(s); // X 2
    s = applyMove(s, 0); // O
    expect(s.status).toBe('playing');
    s = applyTimeout(s); // X 3
    expect(s.status).toBe('won');
    expect(s.winner).toBe('O');
    expect(s.reason).toBe('timeouts');
  });

  it("placing a mark resets only that player's counter", () => {
    let s = createRound(DEFAULT_ROUND_CONFIG, 'X');
    s = applyTimeout(s); // X 1
    s = applyTimeout(s); // O 1
    s = applyTimeout(s); // X 2
    s = applyMove(s, 4); // O places → O reset
    expect(s.timeouts).toEqual({ X: 2, O: 0 });
    s = applyMove(s, 0); // X places → X reset
    expect(s.timeouts).toEqual({ X: 0, O: 0 });
    s = applyTimeout(s); // O 1
    s = applyTimeout(s); // X 1
    s = applyTimeout(s); // O 2
    s = applyTimeout(s); // X 2
    expect(s.status).toBe('playing');
    s = applyTimeout(s); // O 3
    expect(s.winner).toBe('X');
  });
});

describe('ply counters', () => {
  /** A drawless shuffle: X and O alternate on cells that never make a line. */
  function shuffle(plies: number): RoundState {
    // X only uses 0,5,7 and O only 1,3,8: neither set contains a line. A player
    // holding all three times out once (fading the oldest), then places again.
    let s = createRound(DEFAULT_ROUND_CONFIG, 'X');
    const xCells = [0, 5, 7];
    const oCells = [1, 3, 8];
    let xi = 0;
    let oi = 0;
    for (let i = 0; i < plies; i++) {
      if (s.toMove === 'X') {
        const free = xCells.filter((c) => !s.marks.X.includes(c));
        s = free.length ? applyMove(s, free[xi++ % free.length]!) : applyTimeout(s);
      } else {
        const free = oCells.filter((c) => !s.marks.O.includes(c));
        s = free.length ? applyMove(s, free[oi++ % free.length]!) : applyTimeout(s);
      }
    }
    return s;
  }

  it('sudden death starts after 30 plies', () => {
    expect(isSuddenDeath(shuffle(29))).toBe(false);
    expect(isSuddenDeath(shuffle(30))).toBe(true);
  });

  it('the round is a draw at the 60-ply cap', () => {
    const s59 = shuffle(59);
    expect(s59.status).toBe('playing');
    const s60 = shuffle(60);
    expect(s60.ply).toBe(60);
    expect(s60.status).toBe('draw');
    expect(s60.reason).toBe('cap');
    expect(s60.winner).toBeNull();
    expect(() => applyMove(s60, 2)).toThrow(EngineError);
  });

  it('a win on the 60th ply beats the cap', () => {
    // A short cap (6 plies) so the winning move lands exactly on the cap.
    const config = { ...DEFAULT_ROUND_CONFIG, maxPlies: 6 };
    let s = createRound(config, 'X');
    s = applyMove(s, 0); // X
    s = applyMove(s, 3); // O
    s = applyMove(s, 1); // X
    s = applyMove(s, 4); // O
    s = applyMove(s, 8); // X (ply 5)
    s = applyMove(s, 5); // O completes 3-4-5 on ply 6 = the cap
    expect(s.ply).toBe(6);
    expect(s.status).toBe('won');
    expect(s.winner).toBe('O');
  });
});

describe('4×4 config', () => {
  it('k=4, l=3: 4th mark is kept, 5th fades the oldest', () => {
    const config = { ...DEFAULT_ROUND_CONFIG, n: 4, k: 4, l: 3 };
    let s = createRound(config, 'X');
    for (const c of [0, 15, 5, 14, 3, 9, 12, 6]) s = applyMove(s, c);
    expect(s.marks.X).toEqual([0, 5, 3, 12]);
    expect(nextToFade(s, 'X')).toBe(0);
    s = applyMove(s, 10); // X 5th → 0 fades; 5-10-15? 15 is O. 0-5-10 would need 0, which faded.
    expect(s.marks.X).toEqual([5, 3, 12, 10]);
    expect(s.status).toBe('playing');
  });
});

import { describe, expect, it } from '@jest/globals';
import { applySosMove, botSosMove, createSosGame, generateSosLines, legalSosMoves } from '../src/index.ts';

describe('SOS Game Engine', () => {
  it('creates an empty board with correct dimensions', () => {
    const game4 = createSosGame({ size: 4 });
    expect(game4.board.length).toBe(16);
    expect(game4.scores).toEqual({ X: 0, O: 0 });
    expect(game4.status).toBe('playing');
    expect(game4.toMove).toBe('X');

    const game5 = createSosGame({ size: 5 });
    expect(game5.board.length).toBe(25);
  });

  it('precomputes lines correctly for 4x4 and 5x5', () => {
    const lines4 = generateSosLines(4);
    // In 4x4:
    // Rows: 4 * 2 = 8
    // Cols: 4 * 2 = 8
    // Diag: 2 * 2 = 4
    // Anti-Diag: 2 * 2 = 4
    // Total = 24 lines
    expect(lines4.length).toBe(24);

    const lines5 = generateSosLines(5);
    // In 5x5:
    // Rows: 5 * 3 = 15
    // Cols: 5 * 3 = 15
    // Diag: 3 * 3 = 9
    // Anti-Diag: 3 * 3 = 9
    // Total = 48 lines
    expect(lines5.length).toBe(48);
  });

  it('swaps turns when no SOS is formed', () => {
    let s = createSosGame({ size: 4 }, 'X');
    expect(s.toMove).toBe('X');

    s = applySosMove(s, 0, 'S');
    expect(s.board[0]?.letter).toBe('S');
    expect(s.scores.X).toBe(0);
    expect(s.toMove).toBe('O'); // Turn passed to O
  });

  it('scores a horizontal SOS and retains turn (extra turn)', () => {
    let s = createSosGame({ size: 4 }, 'X');
    s = applySosMove(s, 0, 'S'); // X plays S at 0 -> toMove = O
    expect(s.toMove).toBe('O');

    s = applySosMove(s, 1, 'O'); // O plays O at 1 -> toMove = X
    expect(s.toMove).toBe('X');

    s = applySosMove(s, 2, 'S'); // X plays S at 2 -> forms S-O-S (0, 1, 2)!
    expect(s.scores.X).toBe(1);
    expect(s.scores.O).toBe(0);
    expect(s.lines.length).toBe(1);
    expect(s.lines[0].cells).toEqual([0, 1, 2]);
    expect(s.lines[0].player).toBe('X');
    expect(s.lastPointsEarned).toBe(1);
    expect(s.toMove).toBe('X'); // X gets an EXTRA TURN!
  });

  it('scores a vertical SOS', () => {
    // 4x4 board: cells 0, 4, 8 form a column
    let s = createSosGame({ size: 4 }, 'X');
    s = applySosMove(s, 0, 'S'); // X
    s = applySosMove(s, 4, 'O'); // O
    s = applySosMove(s, 8, 'S'); // X forms vertical SOS 0-4-8
    expect(s.scores.X).toBe(1);
    expect(s.lines[0].cells).toEqual([0, 4, 8]);
    expect(s.toMove).toBe('X');
  });

  it('scores a diagonal SOS', () => {
    // 4x4 board: cells 0, 5, 10 form main diagonal
    let s = createSosGame({ size: 4 }, 'X');
    s = applySosMove(s, 0, 'S'); // X
    s = applySosMove(s, 5, 'O'); // O
    s = applySosMove(s, 10, 'S'); // X forms diagonal 0-5-10
    expect(s.scores.X).toBe(1);
    expect(s.lines[0].cells).toEqual([0, 5, 10]);
  });

  it('scores multiple SOS lines with a single move (cross formation)', () => {
    // In 5x5:
    // Place S at (0, 1), S at (2, 1) -> vertical pair
    // Place S at (1, 0), S at (1, 2) -> horizontal pair
    // Center is (1, 1) = cell 6!
    // When playing 'O' at cell 6, it completes BOTH horizontal (5-6-7) AND vertical (1-6-11)!
    let s = createSosGame({ size: 5 }, 'X');
    s = applySosMove(s, 1, 'S'); // X at (0, 1)
    s = applySosMove(s, 11, 'S'); // O at (2, 1)
    s = applySosMove(s, 5, 'S'); // X at (1, 0)
    s = applySosMove(s, 7, 'S'); // O at (1, 2)

    // Now X plays 'O' at 6 (center)
    s = applySosMove(s, 6, 'O');
    expect(s.scores.X).toBe(2); // Earned 2 points in one single move!
    expect(s.lastPointsEarned).toBe(2);
    expect(s.lines.length).toBe(2);
    expect(s.toMove).toBe('X'); // Retains turn
  });

  it('reaches finished status and declares winner when board is full', () => {
    let s = createSosGame({ size: 4 }, 'X');
    // Fill all 16 cells
    const letters: ('S' | 'O')[] = ['S', 'O', 'S', 'S', 'O', 'S', 'O', 'S', 'S', 'O', 'S', 'S', 'O', 'S', 'O', 'S'];
    for (let i = 0; i < 16; i++) {
      s = applySosMove(s, i, letters[i]);
    }
    expect(s.status).toBe('finished');
    expect(legalSosMoves(s).length).toBe(0);
    expect(s.winner).toBeDefined();
  });

  it('bot takes immediate scoring move when available', () => {
    let s = createSosGame({ size: 4 }, 'X');
    s = applySosMove(s, 0, 'S'); // X
    s = applySosMove(s, 1, 'O'); // O
    // Board has S at 0, O at 1. Cell 2 is empty. Playing 'S' at 2 will score!
    expect(s.toMove).toBe('X');

    const botAction = botSosMove(s, 'hard');
    expect(botAction).toEqual({ cell: 2, letter: 'S' });

    // Applying it scores
    s = applySosMove(s, botAction.cell, botAction.letter);
    expect(s.scores.X).toBe(1);
  });
});


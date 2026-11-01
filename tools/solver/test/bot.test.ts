import { beforeAll, describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  applyMove,
  applyTimeout,
  BOT_LEVELS,
  botThinkMs,
  chooseBotAction,
  createRound,
  DEFAULT_ROUND_CONFIG,
  legalMoves,
  loadSolvedTable,
  scoreActions,
} from '@fade/engine';
import type { BotAction, BotLevel, RoundState, SolvedTableFile } from '@fade/engine';
import { rng } from '../src/game.ts';

let table: Uint8Array;
beforeAll(() => {
  const file = JSON.parse(readFileSync(join(__dirname, '../../../app/assets/bot/table-3x3.json'), 'utf8')) as SolvedTableFile;
  table = loadSolvedTable(file);
});

function act(r: RoundState, a: BotAction): RoundState {
  return a === 'timeout' ? applyTimeout(r) : applyMove(r, a);
}

/** Play one round: X uses levelX, O uses levelO. */
function playRound(levelX: BotLevel, levelO: BotLevel, rand: () => number, starter: 'X' | 'O' = 'X'): RoundState {
  let r = createRound(DEFAULT_ROUND_CONFIG, starter);
  while (r.status === 'playing') r = act(r, chooseBotAction(r, r.toMove === 'X' ? levelX : levelO, table, rand));
  return r;
}

describe('bot', () => {
  it('Impossible opens on an edge (the only winning opening) and wins every round it starts', () => {
    const rand = rng(3);
    const first = chooseBotAction(createRound(DEFAULT_ROUND_CONFIG, 'X'), 'impossible', table, rand);
    expect([1, 3, 5, 7]).toContain(first);
    for (const opp of BOT_LEVELS) {
      for (let g = 0; g < 20; g++) {
        const r = playRound('impossible', opp, rand);
        expect(r.winner).toBe('X');
      }
    }
  });

  it('after a drawn opening (centre), Impossible as second player never loses', () => {
    // 3×3 is a first-player win, so a strong X can beat even perfect defence after an
    // edge opening. After the centre (a drawn position) perfect defence must hold.
    const rand = rng(4);
    for (const opp of BOT_LEVELS) {
      for (let g = 0; g < 15; g++) {
        let r = applyMove(createRound(DEFAULT_ROUND_CONFIG, 'X'), 4);
        while (r.status === 'playing') r = act(r, chooseBotAction(r, r.toMove === 'X' ? opp : 'impossible', table, rand));
        expect(r.winner).not.toBe('X');
      }
    }
  });

  it('every level always returns a legal action', () => {
    const rand = rng(5);
    for (const level of BOT_LEVELS) {
      let r = createRound(DEFAULT_ROUND_CONFIG, 'X');
      for (let i = 0; i < 40 && r.status === 'playing'; i++) {
        const a = chooseBotAction(r, level, table, rand);
        if (a !== 'timeout') expect(legalMoves(r)).toContain(a);
        r = act(r, a);
      }
    }
  });

  it('Medium always takes a win in one', () => {
    // X holds 0, 1 (with 2 empty); O holds 3, 4. X to move.
    let r = createRound(DEFAULT_ROUND_CONFIG, 'X');
    for (const c of [0, 3, 1, 4]) r = applyMove(r, c);
    const rand = rng(6);
    for (let i = 0; i < 50; i++) expect(chooseBotAction(r, 'medium', table, rand)).toBe(2);
  });

  it('harder levels beat easier ones more often (sanity of the ladder)', () => {
    const rand = rng(7);
    const winsAsSecond = (strong: BotLevel, weak: BotLevel) => {
      let w = 0;
      for (let g = 0; g < 60; g++) if (playRound(weak, strong, rand).winner === 'O') w++;
      return w;
    };
    expect(winsAsSecond('impossible', 'easy')).toBeGreaterThan(winsAsSecond('easy', 'impossible'));
  });

  it('scores rank a winning move above a drawing one', () => {
    const r = createRound(DEFAULT_ROUND_CONFIG, 'X');
    const scored = scoreActions(r, table);
    const edge = scored.find((s) => s.action === 1)!;
    const centre = scored.find((s) => s.action === 4)!;
    expect(edge.score).toBeGreaterThan(centre.score);
    expect(centre.score).toBe(0);
  });

  it('think time is human-like and inside the clock', () => {
    const rand = rng(8);
    for (let i = 0; i < 100; i++) {
      const rapid = botThinkMs(8000, rand);
      expect(rapid).toBeGreaterThanOrEqual(400);
      expect(rapid).toBeLessThanOrEqual(1500);
      const blitz = botThinkMs(1500, rand);
      expect(blitz).toBeLessThanOrEqual(900);
    }
  });
});

import { beforeAll, describe, expect, it } from '@jest/globals';
import {
  applyMove,
  applyTimeout,
  createRound,
  decodePosition,
  DEFAULT_ROUND_CONFIG,
  encodePosition,
  legalMoves,
  loadSolvedTable,
  positionOf,
  tableSize,
} from '@fade/engine';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Position, RoundState, SolvedTableFile } from '@fade/engine';
import { rng, START } from '../src/game.ts';
import type { Rules } from '../src/game.ts';
import { actionValue, DRAW, LOSS, solve, toTableBytes, WIN } from '../src/retrograde.ts';
import type { Solved } from '../src/retrograde.ts';
import { makeSearcher } from '../src/search.ts';

const RULES: Rules = { n: 3, k: 3, l: 3, t: 3, timeouts: true };

interface Value {
  kind: number;
  dist: number;
}

/** Engine RoundState for a solver table slot (X to move). */
function roundAt(sol: Solved, tableIndex: number): RoundState {
  const p = decodePosition(sol.shape, tableIndex);
  return {
    ...createRound(DEFAULT_ROUND_CONFIG, 'X'),
    marks: { X: [...p.mover], O: [...p.opp] },
    timeouts: { X: p.moverTimeouts, O: p.oppTimeouts },
  };
}

/** Value for the mover of every legal action, computed with the engine's own rules. */
function engineActionValues(sol: Solved, round: RoundState): Value[] {
  const after = [...legalMoves(round).map((c) => applyMove(round, c)), applyTimeout(round)];
  return after.map((next) => {
    if (next.status === 'won') return { kind: next.winner === round.toMove ? WIN : LOSS, dist: 1 };
    const id = sol.idOf[encodePosition(sol.shape, positionOf(next))]!;
    if (id < 0) throw new Error('engine reached a position the solver never saw');
    const k = sol.kind[id]!;
    return k === DRAW ? { kind: DRAW, dist: 0 } : { kind: k === WIN ? LOSS : WIN, dist: sol.dist[id]! + 1 };
  });
}

/** Fastest win, else draw, else slowest loss. */
function best(vals: Value[]): Value {
  const wins = vals.filter((v) => v.kind === WIN);
  if (wins.length) return { kind: WIN, dist: Math.min(...wins.map((v) => v.dist)) };
  if (vals.some((v) => v.kind === DRAW)) return { kind: DRAW, dist: 0 };
  return { kind: LOSS, dist: Math.max(...vals.map((v) => v.dist)) };
}

describe('3×3 solver', () => {
  let sol: Solved;
  beforeAll(() => {
    sol = solve(RULES);
  });

  it("the solver's fast move generation matches the engine on random positions", () => {
    const r = rng(1);
    for (let i = 0; i < 3000; i++) {
      const id = Math.floor(r() * sol.ids.length);
      const fast = [...sol.succ.subarray(sol.succStart[id]!, sol.succStart[id + 1]!)].map((e) => actionValue(sol, e));
      expect(fast).toEqual(engineActionValues(sol, roundAt(sol, sol.ids[id]!)));
    }
  });

  it('every value equals the best of its successors (computed via the engine)', () => {
    const r = rng(2);
    for (let i = 0; i < 5000; i++) {
      const id = Math.floor(r() * sol.ids.length);
      const k = sol.kind[id]!;
      const got = { kind: k, dist: k === DRAW ? 0 : sol.dist[id]! };
      expect(got).toEqual(best(engineActionValues(sol, roundAt(sol, sol.ids[id]!))));
    }
  });

  it('the empty board is a first-player win in 13 plies, and the proof search agrees', () => {
    expect(sol.kind[0]).toBe(WIN);
    expect(sol.dist[0]).toBe(13);
    const s = makeSearcher(RULES);
    expect(s.canWin(START, 11)).toBe(false);
    expect(s.canWin(START, 13)).toBe(true);
  });

  it('replayed through the engine, the perfect line beats every defence within 13 plies', () => {
    // X always plays a fastest win; O tries every legal action including timeouts.
    let leaves = 0;
    function explore(round: RoundState): void {
      if (round.status !== 'playing') {
        expect(round.winner).toBe('X');
        expect(round.ply).toBeLessThanOrEqual(13);
        leaves++;
        return;
      }
      if (round.toMove === 'X') {
        const vals = engineActionValues(sol, round);
        const target = best(vals);
        expect(target.kind).toBe(WIN);
        const pick = vals.findIndex((v) => v.kind === WIN && v.dist === target.dist);
        const cells = legalMoves(round);
        explore(pick < cells.length ? applyMove(round, cells[pick]!) : applyTimeout(round));
      } else {
        for (const c of legalMoves(round)) explore(applyMove(round, c));
        explore(applyTimeout(round));
      }
    }
    explore(createRound(DEFAULT_ROUND_CONFIG, 'X'));
    expect(leaves).toBeGreaterThan(100);
  });

  it('without deliberate timeouts the start is still a first-player win in 13', () => {
    const plain = solve({ ...RULES, timeouts: false });
    expect(plain.kind[0]).toBe(WIN);
    expect(plain.dist[0]).toBe(13);
    const p: Position = { mover: [], opp: [], moverTimeouts: 0, oppTimeouts: 0 };
    expect(plain.idOf[encodePosition(plain.shape, p)]).toBe(0);
  });

  it('the shipped bot table (app/assets/bot/table-3x3.json) matches a fresh solve', () => {
    const file = JSON.parse(
      readFileSync(join(__dirname, '../../../app/assets/bot/table-3x3.json'), 'utf8'),
    ) as SolvedTableFile;
    expect([file.n, file.k, file.l, file.t]).toEqual([3, 3, 3, 3]);
    expect(loadSolvedTable(file)).toEqual(toTableBytes(sol, tableSize(sol.shape)));
  });
});

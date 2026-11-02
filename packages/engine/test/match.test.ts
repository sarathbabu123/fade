import { describe, expect, it } from '@jest/globals';
import {
  abortMatch,
  canAbort,
  createMatch,
  DEFAULT_MATCH_CONFIG,
  deserialize,
  EngineError,
  forfeitDisconnect,
  MATCH_TIMING,
  matchMove,
  matchTimeout,
  resign,
  resolveStartRace,
  roundStarter,
  serialize,
  startNextRound,
  TIME_CONTROLS,
  turnClockMs,
} from '../src/index.ts';
import type { MatchConfig, MatchState, Player } from '../src/index.ts';

// A short cap so a drawn round takes 6 plies.
const CONFIG: MatchConfig = { ...DEFAULT_MATCH_CONFIG, round: { ...DEFAULT_MATCH_CONFIG.round, maxPlies: 6 } };

function moves(m: MatchState, cells: number[]): MatchState {
  return cells.reduce((s, c) => matchMove(s, c), m);
}

/** Play out the current round so `w` wins it (or draw it when w is null). */
function finishRound(m: MatchState, w: Player | null): MatchState {
  if (w === null) return moves(m, [0, 1, 2, 4, 3, 5]); // no line for anyone, hits the 6-ply cap
  // Winner takes the top row; the loser plays 3, 4, 8 (never a line).
  return m.round.starter === w ? moves(m, [0, 3, 1, 4, 2]) : moves(m, [3, 0, 4, 1, 8, 2]);
}

function playRounds(results: (Player | null)[], firstStarter: Player = 'X'): MatchState {
  let m = createMatch(CONFIG, firstStarter);
  results.forEach((w, i) => {
    if (i > 0) m = startNextRound(m);
    m = finishRound(m, w);
  });
  return m;
}

describe('match rules', () => {
  it('defaults: best of 5, Rapid 8 s', () => {
    expect(DEFAULT_MATCH_CONFIG.bestOf).toBe(5);
    expect(DEFAULT_MATCH_CONFIG.timeControl).toBe('rapid');
    expect(TIME_CONTROLS.rapid).toEqual({ moveMs: 8000, suddenDeathMs: 4000 });
    expect(TIME_CONTROLS.blitz).toEqual({ moveMs: 3000, suddenDeathMs: 1500 });
    expect(MATCH_TIMING).toEqual({ abortAfterMs: 15_000, disconnectForfeitMs: 20_000, moveGraceMs: 800 });
  });

  it('the starting player alternates every round, draws included', () => {
    expect([1, 2, 3, 4, 5].map((r) => roundStarter('O', r))).toEqual(['O', 'X', 'O', 'X', 'O']);
    let m = playRounds([null]);
    expect(m.status).toBe('roundOver');
    m = startNextRound(m);
    expect(m.roundNo).toBe(2);
    expect(m.round.starter).toBe('O');
    expect(m.round.toMove).toBe('O');
  });

  it('first to 3 round wins takes the match', () => {
    const m = playRounds(['X', 'O', 'X', 'X']);
    expect(m.score).toEqual({ X: 3, O: 1 });
    expect(m.status).toBe('finished');
    expect(m.winner).toBe('X');
    expect(m.reason).toBe('rounds');
    expect(m.history.map((r) => r.winner)).toEqual(['X', 'O', 'X', 'X']);
    expect(() => startNextRound(m)).toThrow(EngineError);
  });

  it('a drawn round counts for neither player', () => {
    const m = playRounds(['X', null]);
    expect(m.score).toEqual({ X: 1, O: 0 });
    expect(m.history[1]).toMatchObject({ winner: null, reason: 'cap' });
  });

  it('a tied score after 5 rounds is a drawn match', () => {
    const m = playRounds(['X', 'O', null, 'X', 'O']);
    expect(m.score).toEqual({ X: 2, O: 2 });
    expect(m.status).toBe('finished');
    expect(m.winner).toBeNull();
  });

  it('after 5 rounds the higher score wins even below 3', () => {
    const m = playRounds(['X', null, null, 'O', 'O']);
    expect(m.score).toEqual({ X: 1, O: 2 });
    expect(m.winner).toBe('O');
  });

  it('ends early once the trailing player cannot draw level', () => {
    // 2–0 after 4 rounds (2 drawn): one round left, O can reach 1–2 at best.
    const m = playRounds(['X', null, 'X', null]);
    expect(m.status).toBe('finished');
    expect(m.winner).toBe('X');
    expect(m.roundNo).toBe(4);
  });

  it('does not end early while the trailing player can still draw level', () => {
    // 1–0 after 4 rounds: O can still win round 5 and draw the match.
    let m = playRounds(['X', null, null, null]);
    expect(m.status).toBe('roundOver');
    m = finishRound(startNextRound(m), 'O');
    expect(m.score).toEqual({ X: 1, O: 1 });
    expect(m.winner).toBeNull();
    // 2–0 after 3 rounds with 2 left: still alive.
    expect(playRounds(['X', 'X', null]).status).toBe('roundOver');
  });

  it('a round lost on 3 timeouts counts for the opponent', () => {
    let m = createMatch(CONFIG, 'X');
    m = matchTimeout(m); // X
    m = matchMove(m, 4); // O
    m = matchTimeout(m); // X
    m = matchMove(m, 0); // O
    m = matchTimeout(m); // X third
    expect(m.score).toEqual({ X: 0, O: 1 });
    expect(m.history[0]).toMatchObject({ winner: 'O', reason: 'timeouts' });
  });

  it('cannot move between rounds', () => {
    const m = playRounds(['X']);
    expect(m.status).toBe('roundOver');
    expect(() => matchMove(m, 4)).toThrow(EngineError);
    expect(() => matchTimeout(m)).toThrow(EngineError);
  });
});

describe('start race (round 1 starter)', () => {
  const tap = (reactionMs: number) => ({ kind: 'tap' as const, reactionMs });
  const falseStart = { kind: 'falseStart' as const };
  const none = { kind: 'none' as const };

  it('the faster reaction starts', () => {
    expect(resolveStartRace(tap(240), tap(310), 'O')).toBe('X');
    expect(resolveStartRace(tap(400), tap(255), 'X')).toBe('O');
  });

  it('reactions within 10 ms are a tie settled by the coin', () => {
    expect(resolveStartRace(tap(250), tap(260), 'O')).toBe('O');
    expect(resolveStartRace(tap(250), tap(250), 'X')).toBe('X');
    expect(resolveStartRace(tap(250), tap(261), 'O')).toBe('X');
  });

  it('a false start hands the first move to the opponent', () => {
    expect(resolveStartRace(falseStart, tap(900), 'X')).toBe('O');
    expect(resolveStartRace(tap(900), falseStart, 'O')).toBe('X');
    expect(resolveStartRace(falseStart, none, 'X')).toBe('O');
  });

  it('a reaction under 100 ms counts as a false start', () => {
    expect(resolveStartRace(tap(60), tap(450), 'X')).toBe('O');
    expect(resolveStartRace(tap(100), tap(450), 'O')).toBe('X');
  });

  it('tapping beats not tapping; double false starts or no-shows go to the coin', () => {
    expect(resolveStartRace(none, tap(1200), 'X')).toBe('O');
    expect(resolveStartRace(none, none, 'O')).toBe('O');
    expect(resolveStartRace(falseStart, falseStart, 'X')).toBe('X');
  });
});

describe('clock', () => {
  it('uses the time control, switching to sudden death after 30 plies', () => {
    let m = createMatch({ ...DEFAULT_MATCH_CONFIG, timeControl: 'blitz' }, 'X');
    expect(turnClockMs(m)).toBe(3000);
    // X shuffles 0,5,7 and O 1,3,8 (no lines), timing out when they hold all three.
    const xs = [0, 5, 7];
    const os = [1, 3, 8];
    for (let i = 0; i < 30; i++) {
      const p = m.round.toMove;
      const free = (p === 'X' ? xs : os).filter((c) => !m.round.marks[p].includes(c));
      m = free.length ? matchMove(m, free[0]!) : matchTimeout(m);
    }
    expect(m.round.ply).toBe(30);
    expect(turnClockMs(m)).toBe(1500);
    expect(turnClockMs({ ...m, config: { ...m.config, timeControl: 'rapid' } })).toBe(4000);
  });
});

describe('resign, forfeit, abort', () => {
  it('resign loses the match at any time, even between rounds', () => {
    const m = resign(createMatch(CONFIG, 'X'), 'X');
    expect(m).toMatchObject({ status: 'finished', winner: 'O', reason: 'resign' });
    const between = resign(playRounds(['X']), 'O');
    expect(between).toMatchObject({ status: 'finished', winner: 'X', reason: 'resign' });
    expect(() => resign(m, 'O')).toThrow(EngineError);
  });

  it('disconnect forfeit loses the match', () => {
    expect(forfeitDisconnect(createMatch(CONFIG, 'O'), 'O')).toMatchObject({ winner: 'X', reason: 'disconnect' });
  });

  it('abort is possible only in round 1 before the player has placed a mark', () => {
    let m = createMatch(CONFIG, 'X');
    expect(canAbort(m, 'X')).toBe(true);
    expect(canAbort(m, 'O')).toBe(true);
    m = matchMove(m, 4);
    expect(canAbort(m, 'X')).toBe(false);
    expect(canAbort(m, 'O')).toBe(true);
    m = matchTimeout(m); // O times out: still hasn't placed
    expect(canAbort(m, 'O')).toBe(true);
    m = matchMove(m, 0); // X
    m = matchMove(m, 8); // O places
    expect(canAbort(m, 'O')).toBe(false);
    const a = abortMatch(createMatch(CONFIG, 'X'));
    expect(a).toMatchObject({ status: 'aborted', winner: null, reason: 'aborted' });
    expect(canAbort(startNextRound(playRounds(['X'])), 'O')).toBe(false);
    expect(canAbort(a, 'X')).toBe(false);
    expect(() => abortMatch(a)).toThrow(EngineError);
    expect(() => resign(a, 'X')).toThrow(EngineError);
  });

  it('rejects an even or non-integer best-of', () => {
    expect(() => createMatch({ ...CONFIG, bestOf: 4 }, 'X')).toThrow(EngineError);
    expect(() => createMatch({ ...CONFIG, bestOf: 0 }, 'X')).toThrow(EngineError);
    expect(createMatch({ ...CONFIG, bestOf: 3 }, 'X').status).toBe('playing');
  });
});

describe('serialization', () => {
  it('state is plain JSON and round-trips', () => {
    const m = playRounds(['X', null]);
    const back = deserialize(serialize(m));
    expect(back).toEqual(m);
    expect(JSON.parse(JSON.stringify(m))).toEqual(m);
    // A restored state keeps working.
    expect(startNextRound(back).roundNo).toBe(3);
  });

  it('rejects non-match JSON', () => {
    expect(() => deserialize('{"a":1}')).toThrow(TypeError);
  });
});

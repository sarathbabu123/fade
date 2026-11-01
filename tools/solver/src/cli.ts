/**
 * npm run solve [-- --budget-sec=300] [--skip-4x4]
 * Solves 3×3 exactly, writes app/assets/bot/table-3x3.json, runs time-boxed
 * proof searches + random playouts on 4×4, and writes tools/solver/out/results.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bytesToBase64, pairCount, rleEncode, TABLE_VERSION, tableSize } from '@fade/engine';
import type { Position, SolvedTableFile, TableShape } from '@fade/engine';
import { actions, LOSE_NOW, lineMasks, rng, START, WIN_NOW } from './game.ts';
import type { Rules } from './game.ts';
import { actionValue, DRAW, LOSS, solve, toTableBytes, WIN } from './retrograde.ts';
import type { Solved } from './retrograde.ts';
import { Budget, makeSearcher } from './search.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const skip4x4 = process.argv.includes('--skip-4x4');
const budgetSec = Number(process.argv.find((a) => a.startsWith('--budget-sec='))?.split('=')[1] ?? 300);
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

const kindName = (k: number) => (k === WIN ? 'win' : k === LOSS ? 'loss' : 'draw');

function exactStats(sol: Solved) {
  const n = sol.ids.length;
  const counts = { win: 0, loss: 0, draw: 0 };
  const winIn: Record<number, number> = {};
  const winInPuzzle: Record<number, number> = {};
  let puzzleCandidates = 0;
  let branching = 0;
  let mistakeSum = 0;
  let mistakeStates = 0;
  const t = sol.shape.t;
  for (let id = 0; id < n; id++) {
    const k = sol.kind[id]!;
    counts[kindName(k) as 'win' | 'loss' | 'draw']++;
    const counters0 = sol.ids[id]! % (t * t) === 0;
    if (counters0) puzzleCandidates++;
    if (k === WIN) {
      const moves = (sol.dist[id]! + 1) / 2;
      winIn[moves] = (winIn[moves] ?? 0) + 1;
      if (counters0) winInPuzzle[moves] = (winInPuzzle[moves] ?? 0) + 1;
    }
    const s = sol.succStart[id]!;
    const e = sol.succStart[id + 1]!;
    branching += e - s;
    if (k !== LOSS) {
      let bad = 0;
      for (let j = s; j < e; j++) if (actionValue(sol, sol.succ[j]!).kind !== k) bad++;
      mistakeSum += bad / (e - s);
      mistakeStates++;
    }
  }
  const opening = [] as { cell: number | null; result: string; plies: number }[];
  for (let j = sol.succStart[0]!; j < sol.succStart[1]!; j++) {
    const v = actionValue(sol, sol.succ[j]!);
    opening.push({ cell: j - sol.succStart[0]! < 9 ? j - sol.succStart[0]! : null, result: kindName(v.kind), plies: v.dist });
  }
  return {
    reachable: n,
    reachableCounters0: puzzleCandidates,
    passes: sol.passes,
    start: { result: kindName(sol.kind[0]!), plies: sol.dist[0]! },
    counts,
    winInMoves: winIn,
    winInMovesCounters0: winInPuzzle,
    avgBranching: branching / n,
    randomActionMistakeRate: mistakeSum / mistakeStates,
    opening,
  };
}

/** Random games (random legal placements, no deliberate timeouts) scored with the exact table. */
function exactPlayouts(sol: Solved, games: number) {
  const r = rng(7);
  let plies = 0;
  let decisions = 0;
  let mistakes = 0;
  let firstWins = 0;
  let capped = 0;
  for (let g = 0; g < games; g++) {
    let id = 0;
    let ply = 0;
    for (; ply < 60; ply++) {
      const k = sol.kind[id]!;
      const s = sol.succStart[id]!;
      const e = sol.succStart[id + 1]!;
      const placements = [] as number[];
      for (let j = s; j < e; j++) placements.push(j);
      // Drop the timeout action (last) when timeouts are on: random humans place marks.
      const choices = sol.rules.timeouts ? placements.slice(0, -1) : placements;
      const j = choices[Math.floor(r() * choices.length)]!;
      if (k !== LOSS) {
        decisions++;
        if (actionValue(sol, sol.succ[j]!).kind !== k) mistakes++;
      }
      const next = sol.succ[j]!;
      if (next === WIN_NOW) {
        if (ply % 2 === 0) firstWins++;
        ply++;
        break;
      }
      id = next;
    }
    if (ply >= 60) capped++;
    plies += ply;
  }
  return {
    games,
    avgPlies: plies / games,
    firstPlayerWinRate: firstWins / games,
    cappedRate: capped / games,
    randomMoveMistakeRate: mistakes / decisions,
  };
}

/** Per X turn on the fastest perfect line: how many of X's moves still win. */
function narrowness(sol: Solved) {
  const out: { ply: number; winning: number; legal: number }[] = [];
  let id = 0;
  for (let ply = 0; ply < 13; ply++) {
    const s = sol.succStart[id]!;
    const e = sol.succStart[id + 1]!;
    let pick = -1;
    let bestD = Infinity;
    let worstD = -1;
    let winning = 0;
    for (let j = s; j < e; j++) {
      const v = actionValue(sol, sol.succ[j]!);
      if (ply % 2 === 0) {
        if (v.kind === WIN) {
          winning++;
          if (v.dist < bestD) {
            bestD = v.dist;
            pick = j;
          }
        }
      } else if (v.dist > worstD) {
        // Defender picks the slowest loss.
        worstD = v.dist;
        pick = j;
      }
    }
    if (ply % 2 === 0) out.push({ ply: ply + 1, winning, legal: e - s });
    const next = sol.succ[pick]!;
    if (next < 0) break;
    id = next;
  }
  return out;
}

/** Compare values on positions with both counters 0 between the two 3×3 solves. */
function timeoutImpact(withT: Solved, without: Solved) {
  let compared = 0;
  let differ = 0;
  /** changes['draw→win'] = positions that are a draw without timeouts and a win with them. */
  const changes: Record<string, number> = {};
  const t = withT.shape.t;
  for (let id = 0; id < without.ids.length; id++) {
    // without.ids uses t=1, so its index is the pair index; with timeouts, counters 0 = pair * t * t.
    const wid = withT.idOf[without.ids[id]! * t * t];
    if (wid === undefined || wid < 0) continue;
    compared++;
    const a = without.kind[id]!;
    const b = withT.kind[wid]!;
    if (a !== b) {
      differ++;
      const key = `${kindName(a)}→${kindName(b)}`;
      changes[key] = (changes[key] ?? 0) + 1;
    }
  }
  return { compared, differ, changes };
}

function writeTable(sol: Solved) {
  const size = tableSize(sol.shape);
  const bytes = toTableBytes(sol, size);
  const packed = rleEncode(bytes);
  const file: SolvedTableFile = {
    version: TABLE_VERSION,
    n: sol.rules.n,
    k: sol.rules.k,
    l: sol.rules.l,
    t: sol.shape.t,
    size,
    encoding: 'rle-u8-base64',
    data: bytesToBase64(packed),
  };
  const path = join(root, 'app/assets/bot/table-3x3.json');
  mkdirSync(dirname(path), { recursive: true });
  const json = JSON.stringify(file);
  writeFileSync(path, json);
  return { path: 'app/assets/bot/table-3x3.json', slots: size, rawBytes: size, rleBytes: packed.length, jsonBytes: json.length };
}

// ---------- 4×4 (time-boxed) ----------

function deepen(rules: Rules, seconds: number) {
  const deadline = Date.now() + seconds * 1000;
  const s = makeSearcher(rules, deadline);
  const firstWin: { depth: number; result: boolean; ms: number }[] = [];
  const secondWin: { depth: number; result: boolean; ms: number }[] = [];
  let provenFirst: number | null = null;
  let provenSecond: number | null = null;
  try {
    for (let d = 1; d <= 59; d += 2) {
      const t0 = Date.now();
      const w = s.canWin(START, d);
      firstWin.push({ depth: d, result: w, ms: Date.now() - t0 });
      log(`  ${rules.n}x${rules.n} L${rules.l}${rules.timeouts ? '' : ' no-timeouts'}: first player wins within ${d}? ${w}`);
      if (w) {
        provenFirst = d;
        break;
      }
      const t1 = Date.now();
      const l = s.mustLose(START, d + 1);
      secondWin.push({ depth: d + 1, result: l, ms: Date.now() - t1 });
      if (l) {
        provenSecond = d + 1;
        break;
      }
    }
  } catch (e) {
    if (!(e instanceof Budget)) throw e;
  }
  return { budgetSec: seconds, provenFirstWinPlies: provenFirst, provenSecondWinPlies: provenSecond, firstWin, secondWin, nodes: s.nodes() };
}

/** Random placements; "blunder" = hands the opponent a forced win within 3 plies, or skips an immediate win. */
function sampledPlayouts(rules: Rules, games: number, seconds: number) {
  const lines = lineMasks(rules);
  const deadline = Date.now() + seconds * 1000;
  const s = makeSearcher(rules, Infinity, 4_000_000);
  const r = rng(11);
  let plies = 0;
  let branching = 0;
  let decisions = 0;
  let blunders = 0;
  let firstWins = 0;
  let secondWins = 0;
  let played = 0;
  for (let g = 0; g < games && Date.now() < deadline; g++, played++) {
    let p: Position = START;
    let ply = 0;
    for (; ply < 60; ply++) {
      const acts = actions(rules, p, lines);
      branching += acts.length;
      const placements = acts.filter((a) => a.cell !== null);
      const a = placements[Math.floor(r() * placements.length)]!;
      const hadWin = placements.some((x) => x.result === WIN_NOW);
      const alreadyLost = s.mustLose(p, 4);
      if (!alreadyLost) {
        decisions++;
        if (hadWin && a.result !== WIN_NOW) blunders++;
        else if (typeof a.result === 'object' && s.canWin(a.result, 3)) blunders++;
      }
      if (a.result === WIN_NOW) {
        if (ply % 2 === 0) firstWins++;
        else secondWins++;
        ply++;
        break;
      }
      if (a.result === LOSE_NOW) break;
      p = a.result;
    }
    plies += ply;
  }
  return {
    games: played,
    avgPlies: plies / played,
    avgBranching: branching / Math.max(1, plies),
    firstPlayerWinRate: firstWins / played,
    secondPlayerWinRate: secondWins / played,
    tacticalBlunderRate: blunders / decisions,
  };
}

function shapeFor(rules: Rules): TableShape {
  return { cells: rules.n * rules.n, k: rules.k, t: rules.t };
}

// ---------- run ----------

const results: Record<string, unknown> = { generatedAt: new Date().toISOString(), budgetSec };

log('3x3 exact solve (timeouts allowed)…');
const s3 = solve({ n: 3, k: 3, l: 3, t: 3, timeouts: true });
log('3x3 exact solve (no deliberate timeouts)…');
const s3plain = solve({ n: 3, k: 3, l: 3, t: 3, timeouts: false });
results['3x3'] = {
  withTimeouts: { ...exactStats(s3), playouts: exactPlayouts(s3, 20000), perfectLine: narrowness(s3) },
  withoutTimeouts: { ...exactStats(s3plain), playouts: exactPlayouts(s3plain, 20000), perfectLine: narrowness(s3plain) },
  timeoutImpact: timeoutImpact(s3, s3plain),
  tacticalCalibration: sampledPlayouts({ n: 3, k: 3, l: 3, t: 3, timeouts: true }, 5000, 60),
  table: writeTable(s3),
};
log('3x3 done', JSON.stringify((results['3x3'] as { table: unknown }).table));

const outPath = join(root, 'tools/solver/out/results.json');
if (skip4x4) {
  // Keep the previous (slow) 4×4 results.
  const prev = JSON.parse(readFileSync(outPath, 'utf8')) as Record<string, unknown>;
  for (const k of Object.keys(prev)) if (k.startsWith('4x4')) results[k] = prev[k];
  results['budgetSec'] = prev['budgetSec'];
}
for (const l of skip4x4 ? [] : [3, 4]) {
  const rules: Rules = { n: 4, k: 4, l, t: 3, timeouts: true };
  const key = `4x4-K4-L${l}`;
  log(`${key}: proof search (budget ${budgetSec}s)…`);
  const search = deepen(rules, budgetSec);
  log(`${key}: random playouts…`);
  const playouts = sampledPlayouts(rules, 3000, Math.min(120, budgetSec));
  results[key] = {
    positionSpaceUpperBound: tableSize(shapeFor(rules)),
    markArrangements: pairCount(shapeFor(rules)),
    search,
    playouts,
  };
  log(key, JSON.stringify(results[key]));
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(results, null, 2));
log('wrote', outPath);

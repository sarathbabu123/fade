/**
 * Exact retrograde solve of every position reachable from the empty board.
 * Positions that never resolve to a forced win or loss (cycles) are draws. The
 * 30-ply sudden death and 60-ply cap are ignored.
 */
import { encodePosition, encodeValue, VALUE_UNREACHABLE } from '@fade/engine';
import type { Position, TableShape } from '@fade/engine';
import { actions, LOSE_NOW, lineMasks, START, WIN_NOW } from './game.ts';
import type { Rules } from './game.ts';

export interface Solved {
  rules: Rules;
  shape: TableShape;
  /** Table index of each reachable position, in BFS order (0 = start). */
  ids: Int32Array;
  /** Table index → reachable id, or -1. */
  idOf: Int32Array;
  /** CSR successors per reachable id: WIN_NOW, LOSE_NOW or a reachable id. */
  succStart: Int32Array;
  succ: Int32Array;
  /** Per reachable id: 0 draw, 1 win, 2 loss (for the mover). */
  kind: Uint8Array;
  /** Plies to the end under perfect play (fastest win, slowest loss). */
  dist: Uint16Array;
  passes: number;
}

export const DRAW = 0;
export const WIN = 1;
export const LOSS = 2;

export function solve(rules: Rules): Solved {
  const shape: TableShape = { cells: rules.n * rules.n, k: rules.k, t: rules.timeouts ? rules.t : 1 };
  const lines = lineMasks(rules);
  const idOf = new Map<number, number>();
  const positions: Position[] = [];
  const ids: number[] = [];
  const succStart: number[] = [0];
  const succ: number[] = [];

  const startIdx = encodePosition(shape, START);
  idOf.set(startIdx, 0);
  positions.push(START);
  ids.push(startIdx);
  for (let i = 0; i < positions.length; i++) {
    for (const a of actions(rules, positions[i]!, lines)) {
      if (a.result === WIN_NOW || a.result === LOSE_NOW) {
        succ.push(a.result);
        continue;
      }
      const idx = encodePosition(shape, a.result);
      let id = idOf.get(idx);
      if (id === undefined) {
        id = positions.length;
        idOf.set(idx, id);
        positions.push(a.result);
        ids.push(idx);
      }
      succ.push(id);
    }
    succStart.push(succ.length);
  }

  const n = positions.length;
  const S = Int32Array.from(succStart);
  const E = Int32Array.from(succ);
  const kind = new Uint8Array(n);
  const dist = new Uint16Array(n);
  const resolved = new Uint8Array(n);

  // Pass 1: immediate wins.
  for (let s = 0; s < n; s++) {
    for (let j = S[s]!; j < S[s + 1]!; j++) {
      if (E[j] === WIN_NOW) {
        kind[s] = WIN;
        dist[s] = 1;
        resolved[s] = 1;
        break;
      }
    }
  }
  let passes = 1;
  for (let d = 2; ; d++) {
    let changed = 0;
    for (let s = 0; s < n; s++) {
      if (resolved[s]) continue;
      let win = false;
      let allLose = true;
      let maxLen = 0;
      for (let j = S[s]!; j < S[s + 1]!; j++) {
        const e = E[j]!;
        if (e === LOSE_NOW) {
          maxLen = Math.max(maxLen, 1);
          continue;
        }
        if (e === WIN_NOW) continue; // handled in pass 1
        if (!resolved[e] || dist[e] >= d) {
          allLose = false;
          continue;
        }
        if (kind[e] === LOSS && dist[e] === d - 1) {
          win = true;
          break;
        }
        if (kind[e] === WIN) maxLen = Math.max(maxLen, dist[e]! + 1);
        else allLose = false;
      }
      if (win) {
        kind[s] = WIN;
        dist[s] = d;
        resolved[s] = 1;
        changed++;
      } else if (allLose && maxLen === d) {
        kind[s] = LOSS;
        dist[s] = d;
        resolved[s] = 1;
        changed++;
      }
    }
    passes = d;
    if (changed === 0) break;
  }

  const idArr = Int32Array.from(ids);
  return {
    rules,
    shape,
    ids: idArr,
    idOf: mapToArray(idOf, idArr),
    succStart: S,
    succ: E,
    kind,
    dist,
    passes,
  };
}

function mapToArray(map: Map<number, number>, ids: Int32Array): Int32Array {
  let max = 0;
  for (const i of ids) if (i > max) max = i;
  const out = new Int32Array(max + 1).fill(-1);
  for (const [idx, id] of map) out[idx] = id;
  return out;
}

/** Value of an action for the mover: 'win' | 'loss' | 'draw' with plies to the end. */
export function actionValue(sol: Solved, e: number): { kind: number; dist: number } {
  if (e === WIN_NOW) return { kind: WIN, dist: 1 };
  if (e === LOSE_NOW) return { kind: LOSS, dist: 1 };
  const k = sol.kind[e]!;
  if (k === DRAW) return { kind: DRAW, dist: 0 };
  return { kind: k === WIN ? LOSS : WIN, dist: sol.dist[e]! + 1 };
}

/** One byte per table slot, in the engine's table encoding. */
export function toTableBytes(sol: Solved, tableSize: number): Uint8Array {
  const bytes = new Uint8Array(tableSize).fill(VALUE_UNREACHABLE);
  for (let id = 0; id < sol.ids.length; id++) {
    const k = sol.kind[id]!;
    bytes[sol.ids[id]!] =
      k === DRAW
        ? encodeValue({ kind: 'draw' })
        : encodeValue({ kind: k === WIN ? 'win' : 'loss', plies: sol.dist[id]! });
  }
  return bytes;
}

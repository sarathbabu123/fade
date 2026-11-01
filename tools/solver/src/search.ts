/**
 * Depth-limited proof search for boards too big to solve outright (4×4).
 * canWin(p, d): the mover can force a win within d plies.
 * mustLose(p, d): every action lets the opponent force a win within d-1 plies.
 * Both are exact for the given depth; a `false` says nothing about deeper play.
 */
import { encodePosition } from '@fade/engine';
import type { Position, TableShape } from '@fade/engine';
import { actions, LOSE_NOW, lineMasks, WIN_NOW } from './game.ts';
import type { Rules } from './game.ts';

export class Budget extends Error {
  constructor() {
    super('search budget exhausted');
  }
}

export interface Searcher {
  canWin(p: Position, depth: number): boolean;
  mustLose(p: Position, depth: number): boolean;
  nodes(): number;
}

/** TT value: >0 means true at that depth (and deeper); <0 means false at -value (and shallower). */
export function makeSearcher(rules: Rules, deadline = Infinity, maxEntries = 12_000_000): Searcher {
  const shape: TableShape = { cells: rules.n * rules.n, k: rules.k, t: rules.timeouts ? rules.t : 1 };
  const lines = lineMasks(rules);
  let win = new Map<number, number>();
  let lose = new Map<number, number>();
  let nodes = 0;

  function cached(tt: Map<number, number>, key: number, depth: number): boolean | undefined {
    const v = tt.get(key);
    if (v === undefined) return undefined;
    if (v > 0 && v <= depth) return true;
    if (v < 0 && -v >= depth) return false;
    return undefined;
  }

  function store(tt: Map<number, number>, key: number, depth: number, value: boolean): void {
    if (tt.size > maxEntries) {
      win = new Map();
      lose = new Map();
      return;
    }
    const v = tt.get(key);
    if (value) {
      if (v === undefined || v < 0 || depth < v) tt.set(key, depth);
    } else if (v === undefined || (v < 0 && depth > -v)) {
      tt.set(key, -depth);
    }
  }

  function canWin(p: Position, depth: number): boolean {
    if (depth < 1) return false;
    if ((++nodes & 0xffff) === 0 && Date.now() > deadline) throw new Budget();
    const key = encodePosition(shape, p);
    const hit = cached(win, key, depth);
    if (hit !== undefined) return hit;
    const acts = actions(rules, p, lines);
    let result = acts.some((a) => a.result === WIN_NOW);
    if (!result && depth >= 3) {
      for (const a of acts) {
        if (typeof a.result === 'object' && mustLose(a.result, depth - 1)) {
          result = true;
          break;
        }
      }
    }
    store(win, key, depth, result);
    return result;
  }

  function mustLose(p: Position, depth: number): boolean {
    if (depth < 1) return false;
    const key = encodePosition(shape, p);
    const hit = cached(lose, key, depth);
    if (hit !== undefined) return hit;
    const acts = actions(rules, p, lines);
    let result = true;
    for (const a of acts) {
      if (a.result === LOSE_NOW) continue;
      if (a.result === WIN_NOW || !canWin(a.result, depth - 1)) {
        result = false;
        break;
      }
    }
    store(lose, key, depth, result);
    return result;
  }

  return { canWin, mustLose, nodes: () => nodes };
}

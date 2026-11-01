/**
 * Perfect index of solver positions, shared by the solver (which writes the table)
 * and the bot (which reads it). A position is seen from the player to move:
 * (mover's marks oldest-first, opponent's marks oldest-first, mover's consecutive
 * timeouts, opponent's consecutive timeouts). The ply counters (sudden death, 60-ply
 * cap) are deliberately not part of the position.
 */
import { other } from './types.ts';
import type { RoundConfig, RoundState } from './types.ts';

export const TABLE_VERSION = 1;

export interface TableShape {
  /** n*n */
  cells: number;
  k: number;
  /** maxConsecutiveTimeouts: counters range over 0..t-1. */
  t: number;
}

export interface Position {
  mover: number[];
  opp: number[];
  moverTimeouts: number;
  oppTimeouts: number;
}

export function shapeOf(config: RoundConfig): TableShape {
  return { cells: config.n * config.n, k: config.k, t: config.maxConsecutiveTimeouts };
}

/** m! / (m-a)! */
function perm(m: number, a: number): number {
  let r = 1;
  for (let i = 0; i < a; i++) r *= m - i;
  return r;
}

/** Number of ordered sequences of distinct cells, length 0..k, from m cells. */
function seqTotal(m: number, k: number): number {
  let s = 0;
  for (let a = 0; a <= k; a++) s += perm(m, a);
  return s;
}

function seqOffset(m: number, a: number): number {
  let s = 0;
  for (let i = 0; i < a; i++) s += perm(m, i);
  return s;
}

function pairBase(shape: TableShape, a: number): number {
  let s = 0;
  for (let i = 0; i < a; i++) s += perm(shape.cells, i) * seqTotal(shape.cells - i, shape.k);
  return s;
}

export function pairCount(shape: TableShape): number {
  return pairBase(shape, shape.k + 1);
}

export function tableSize(shape: TableShape): number {
  return pairCount(shape) * shape.t * shape.t;
}

/** Mixed-radix rank of an ordered sequence of distinct values from 0..m-1. */
function rankSeq(seq: readonly number[], m: number): number {
  let r = 0;
  for (let i = 0; i < seq.length; i++) {
    let pos = seq[i]!;
    for (let j = 0; j < i; j++) if (seq[j]! < seq[i]!) pos--;
    r = r * (m - i) + pos;
  }
  return r;
}

function unrankSeq(rank: number, a: number, m: number): number[] {
  const digits: number[] = new Array(a);
  for (let i = a - 1; i >= 0; i--) {
    const radix = m - i;
    digits[i] = rank % radix;
    rank = Math.floor(rank / radix);
  }
  const used: boolean[] = new Array(m).fill(false);
  const seq: number[] = [];
  for (let i = 0; i < a; i++) {
    let d = digits[i]!;
    let v = 0;
    for (; v < m; v++) {
      if (used[v]) continue;
      if (d === 0) break;
      d--;
    }
    used[v] = true;
    seq.push(v);
  }
  return seq;
}

export function encodePosition(shape: TableShape, p: Position): number {
  const a = p.mover.length;
  const b = p.opp.length;
  const m = shape.cells - a;
  // Opponent cells are ranked among the cells the mover doesn't hold.
  const oppLocal = p.opp.map((c) => {
    let r = c;
    for (const x of p.mover) if (x < c) r--;
    return r;
  });
  const pair =
    pairBase(shape, a) +
    rankSeq(p.mover, shape.cells) * seqTotal(m, shape.k) +
    seqOffset(m, b) +
    rankSeq(oppLocal, m);
  return (pair * shape.t + p.moverTimeouts) * shape.t + p.oppTimeouts;
}

export function decodePosition(shape: TableShape, index: number): Position {
  const oppTimeouts = index % shape.t;
  index = Math.floor(index / shape.t);
  const moverTimeouts = index % shape.t;
  let pair = Math.floor(index / shape.t);
  let a = 0;
  while (a < shape.k && pair >= pairBase(shape, a + 1)) a++;
  pair -= pairBase(shape, a);
  const m = shape.cells - a;
  const per = seqTotal(m, shape.k);
  const mover = unrankSeq(Math.floor(pair / per), a, shape.cells);
  let rest = pair % per;
  let b = 0;
  while (b < shape.k && rest >= seqOffset(m, b + 1)) b++;
  rest -= seqOffset(m, b);
  const free: number[] = [];
  for (let c = 0; c < shape.cells; c++) if (!mover.includes(c)) free.push(c);
  const opp = unrankSeq(rest, b, m).map((i) => free[i]!);
  return { mover, opp, moverTimeouts, oppTimeouts };
}

export function positionOf(round: RoundState): Position {
  const me = round.toMove;
  const them = other(me);
  return {
    mover: [...round.marks[me]],
    opp: [...round.marks[them]],
    moverTimeouts: round.timeouts[me],
    oppTimeouts: round.timeouts[them],
  };
}

/**
 * One byte per position, from the mover's point of view:
 * 0 = draw, 1..127 = mover wins in that many plies, 128+d = mover loses in d plies,
 * 255 = unreachable / invalid.
 */
export const VALUE_DRAW = 0;
export const VALUE_UNREACHABLE = 255;

export type Outcome = { kind: 'win' | 'loss'; plies: number } | { kind: 'draw' } | { kind: 'unreachable' };

export function encodeValue(o: Outcome): number {
  switch (o.kind) {
    case 'draw':
      return VALUE_DRAW;
    case 'unreachable':
      return VALUE_UNREACHABLE;
    case 'win':
      if (o.plies < 1 || o.plies > 127) throw new RangeError('win distance out of range');
      return o.plies;
    case 'loss':
      if (o.plies < 1 || o.plies > 126) throw new RangeError('loss distance out of range');
      return 128 + o.plies;
  }
}

export function decodeValue(v: number): Outcome {
  if (v === VALUE_DRAW) return { kind: 'draw' };
  if (v === VALUE_UNREACHABLE) return { kind: 'unreachable' };
  if (v < 128) return { kind: 'win', plies: v };
  return { kind: 'loss', plies: v - 128 };
}

export interface SolvedTableFile {
  version: number;
  n: number;
  k: number;
  l: number;
  t: number;
  size: number;
  /** Values as bytes, run-length encoded (pairs of [count-1, value]), then base64. */
  encoding: 'rle-u8-base64';
  data: string;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    out += B64[b0 >> 2]! + B64[((b0 & 3) << 4) | (b1 >> 4)]!;
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)]! : '=';
    out += i + 2 < bytes.length ? B64[b2 & 63]! : '=';
  }
  return out;
}

export function base64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64.indexOf(clean[i]!);
    const c1 = B64.indexOf(clean[i + 1]!);
    const c2 = i + 2 < clean.length ? B64.indexOf(clean[i + 2]!) : 0;
    const c3 = i + 3 < clean.length ? B64.indexOf(clean[i + 3]!) : 0;
    out[o++] = (c0 << 2) | (c1 >> 4);
    if (i + 2 < clean.length) out[o++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (i + 3 < clean.length) out[o++] = ((c2 & 3) << 6) | c3;
  }
  return out;
}

export function rleEncode(values: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < values.length) {
    const v = values[i]!;
    let run = 1;
    while (i + run < values.length && values[i + run] === v && run < 256) run++;
    out.push(run - 1, v);
    i += run;
  }
  return Uint8Array.from(out);
}

export function rleDecode(packed: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(size);
  let o = 0;
  for (let i = 0; i < packed.length; i += 2) {
    const run = packed[i]! + 1;
    out.fill(packed[i + 1]!, o, o + run);
    o += run;
  }
  if (o !== size) throw new RangeError(`table size mismatch: ${o} != ${size}`);
  return out;
}

export function loadSolvedTable(file: SolvedTableFile): Uint8Array {
  if (file.version !== TABLE_VERSION) throw new RangeError(`unsupported table version ${file.version}`);
  return rleDecode(base64ToBytes(file.data), file.size);
}

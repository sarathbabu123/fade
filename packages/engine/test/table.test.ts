import { describe, expect, it } from '@jest/globals';
import {
  base64ToBytes,
  bytesToBase64,
  decodePosition,
  decodeValue,
  DEFAULT_ROUND_CONFIG,
  encodePosition,
  encodeValue,
  pairCount,
  rleDecode,
  rleEncode,
  shapeOf,
  tableSize,
} from '../src/index.ts';

const shape = shapeOf(DEFAULT_ROUND_CONFIG);

describe('position index', () => {
  it('3×3, K=3 has 102,043 mark arrangements and 9 counter combos each', () => {
    expect(pairCount(shape)).toBe(102_043);
    expect(tableSize(shape)).toBe(102_043 * 9);
  });

  it('is a bijection over the whole table', () => {
    const size = tableSize(shape);
    const seen = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      const p = decodePosition(shape, i);
      const j = encodePosition(shape, p);
      if (j !== i) throw new Error(`index ${i} decoded and re-encoded to ${j}`);
      const cells = [...p.mover, ...p.opp];
      if (new Set(cells).size !== cells.length) throw new Error(`overlap at ${i}`);
      seen[j] = 1;
    }
    expect(seen.every((v) => v === 1)).toBe(true);
  });

  it('order of marks matters', () => {
    const a = encodePosition(shape, { mover: [0, 1], opp: [4], moverTimeouts: 0, oppTimeouts: 0 });
    const b = encodePosition(shape, { mover: [1, 0], opp: [4], moverTimeouts: 0, oppTimeouts: 0 });
    expect(a).not.toBe(b);
  });
});

describe('value and file codecs', () => {
  it('values round-trip', () => {
    for (const o of [
      { kind: 'draw' as const },
      { kind: 'unreachable' as const },
      { kind: 'win' as const, plies: 1 },
      { kind: 'win' as const, plies: 127 },
      { kind: 'loss' as const, plies: 2 },
      { kind: 'loss' as const, plies: 126 },
    ]) {
      expect(decodeValue(encodeValue(o))).toEqual(o);
    }
  });

  it('base64 and RLE round-trip', () => {
    for (const len of [0, 1, 2, 3, 4, 300, 1001]) {
      const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 37 + (i >> 4)) % 256);
      expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
      const runs = Uint8Array.from({ length: len }, (_, i) => (i < len / 2 ? 0 : i % 3));
      expect(rleDecode(rleEncode(runs), len)).toEqual(runs);
    }
  });
});

export * from './types.ts';
export * from './lines.ts';
export * from './round.ts';
export * from './match.ts';
export * from './table.ts';

import type { MatchState } from './match.ts';

/** Engine state is plain JSON. */
export function serialize(state: MatchState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): MatchState {
  const s = JSON.parse(json) as MatchState;
  if (!s || typeof s !== 'object' || !s.round || !s.config || !s.score) {
    throw new TypeError('not a match state');
  }
  return s;
}

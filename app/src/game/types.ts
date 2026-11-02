import type { BotLevel, MatchState, Player } from '@fade/engine';

export type MatchPhase = 'race' | 'playing' | 'roundOver' | 'finished';

/** What the match screen needs, whether the match is local or online. */
export interface MatchController {
  kind: 'bot' | 'pass' | 'online';
  match: MatchState | null;
  phase: MatchPhase;
  /** The local player, or null in pass & play (both players are local). */
  me: Player | null;
  /** When the current turn's clock started (local ms epoch). */
  turnStartedAt: number;
  turnMs: number;
  botLevel: BotLevel | null;
  /** Start race resolved: begin the match with this starter. */
  begin: (starter: Player) => void;
  /** Returns false if the move was rejected. */
  play: (cell: number) => boolean;
  resign: () => void;
  rematch: () => void;
}

export type SosLetter = 'S' | 'O';
export type SosPlayer = 'X' | 'O'; // Reuses X (Player 1) and O (Player 2)

export interface SosCell {
  letter: SosLetter;
  player: SosPlayer;
  turnNo: number;
}

export interface SosLine {
  id: string;
  cells: [number, number, number];
  player: SosPlayer;
}

export interface SosConfig {
  size: 4 | 5; // 4x4 (16 cells) or 5x5 (25 cells)
  timeControl: 'rapid' | 'blitz';
}

export interface SosState {
  config: SosConfig;
  board: (SosCell | null)[];
  scores: Record<SosPlayer, number>;
  lines: SosLine[];
  toMove: SosPlayer;
  status: 'playing' | 'finished';
  winner: SosPlayer | 'draw' | null;
  ply: number;
  lastScoredBy: SosPlayer | null;
  lastPointsEarned: number;
}


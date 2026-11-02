import { loadSolvedTable } from '@fade/engine';
import type { SolvedTableFile } from '@fade/engine';

let table: Uint8Array | null = null;

/** The 3×3 perfect-play table, decoded on first use (~918 KB in memory). */
export function botTable(): Uint8Array {
  if (!table) {
    const file = require('../../assets/bot/table-3x3.json') as SolvedTableFile;
    table = loadSolvedTable(file);
  }
  return table;
}

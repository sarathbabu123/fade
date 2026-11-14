export type Triplet = [number, number, number];

/** Precompute all possible 3-in-a-row lines on an N x N board. */
export function generateSosLines(size: number): Triplet[] {
  const lines: Triplet[] = [];
  const at = (r: number, c: number) => r * size + c;

  // 1. Horizontal
  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - 3; c++) {
      lines.push([at(r, c), at(r, c + 1), at(r, c + 2)]);
    }
  }

  // 2. Vertical
  for (let r = 0; r <= size - 3; r++) {
    for (let c = 0; c < size; c++) {
      lines.push([at(r, c), at(r + 1, c), at(r + 2, c)]);
    }
  }

  // 3. Main Diagonal (\)
  for (let r = 0; r <= size - 3; r++) {
    for (let c = 0; c <= size - 3; c++) {
      lines.push([at(r, c), at(r + 1, c + 1), at(r + 2, c + 2)]);
    }
  }

  // 4. Anti-Diagonal (/)
  for (let r = 0; r <= size - 3; r++) {
    for (let c = 2; c < size; c++) {
      lines.push([at(r, c), at(r + 1, c - 1), at(r + 2, c - 2)]);
    }
  }

  return lines;
}

export const SOS_LINES_4X4: Triplet[] = generateSosLines(4);
export const SOS_LINES_5X5: Triplet[] = generateSosLines(5);

export function getLinesForSize(size: number): Triplet[] {
  return size === 4 ? SOS_LINES_4X4 : SOS_LINES_5X5;
}


import { describe, expect, it } from '@jest/globals';
import { defaultRating, isProvisional, rateMatch, updateRating } from '../src/index.ts';

describe('Glicko-2 implementation', () => {
  it('default rating matches PRD §4', () => {
    const r = defaultRating();
    expect(r.rating).toBe(1200);
    expect(r.rd).toBe(350);
    expect(r.volatility).toBe(0.06);
  });

  it('provisional threshold is 10 games', () => {
    expect(isProvisional(0)).toBe(true);
    expect(isProvisional(9)).toBe(true);
    expect(isProvisional(10)).toBe(false);
    expect(isProvisional(25)).toBe(false);
  });

  it('matches Mark Glickman published example', () => {
    // Reference example from "Example of the Glicko-2 system" by Mark E. Glickman:
    // Initial: rating = 1500, RD = 200, volatility = 0.06, tau = 0.5.
    // Opponent 1: rating 1400, RD 30, outcome: 1 (win)
    // Opponent 2: rating 1550, RD 100, outcome: 0 (loss)
    // Opponent 3: rating 1700, RD 300, outcome: 0 (loss)
    // Target results:
    // Rating = 1464.06
    // RD = 151.52
    // Volatility = 0.05999
    const initial = { rating: 1500, rd: 200, volatility: 0.06 };
    const outcomes = [
      { opponent: { rating: 1400, rd: 30, volatility: 0.06 }, score: 1 },
      { opponent: { rating: 1550, rd: 100, volatility: 0.06 }, score: 0 },
      { opponent: { rating: 1700, rd: 300, volatility: 0.06 }, score: 0 },
    ];

    const result = updateRating(initial, outcomes, { tau: 0.5, baseRating: 1500 });
    expect(result.rating).toBe(1464);
    expect(Math.abs(result.rd - 151.5)).toBeLessThanOrEqual(0.1);
    expect(result.volatility).toBeCloseTo(0.05999, 4);
  });

  it('rateMatch updates both players appropriately for win, loss and draw', () => {
    const p1 = defaultRating();
    const p2 = defaultRating();

    const [w1, l2] = rateMatch(p1, p2, 1);
    expect(w1.rating).toBeGreaterThan(1200);
    expect(l2.rating).toBeLessThan(1200);
    expect(w1.rd).toBeLessThan(350);
    expect(l2.rd).toBeLessThan(350);

    const [d1, d2] = rateMatch(p1, p2, 0.5);
    expect(d1.rating).toBe(1200);
    expect(d2.rating).toBe(1200);
    expect(d1.rd).toBeLessThan(350);
    expect(d2.rd).toBeLessThan(350);
  });
});

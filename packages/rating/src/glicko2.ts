// Pure TypeScript implementation of Glicko-2 (Mark Glickman).
// Matches the reference specification used by Lichess and PRD §4.

export interface RatingState {
  rating: number;
  rd: number;
  volatility: number;
}

export interface MatchOutcome {
  opponent: RatingState;
  score: number; // 1 = win, 0.5 = draw, 0 = loss
}

export interface GlickoOptions {
  tau?: number; // system constant, default 0.5
  baseRating?: number; // default 1200 (PRD §4)
}

export const GLICKO_DEFAULTS = {
  rating: 1200,
  rd: 350,
  volatility: 0.06,
  tau: 0.5,
  scale: 173.7178,
  provisionalGames: 10,
} as const;

export function defaultRating(): RatingState {
  return {
    rating: GLICKO_DEFAULTS.rating,
    rd: GLICKO_DEFAULTS.rd,
    volatility: GLICKO_DEFAULTS.volatility,
  };
}

export function isProvisional(games: number): boolean {
  return games < GLICKO_DEFAULTS.provisionalGames;
}

const SCALE = GLICKO_DEFAULTS.scale;
const PI_SQ = Math.PI * Math.PI;

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / PI_SQ);
}

function expectScore(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/**
 * Updates a player's rating after one or more match outcomes in a rating period.
 */
export function updateRating(
  player: RatingState,
  outcomes: MatchOutcome[],
  options?: GlickoOptions,
): RatingState {
  const tau = options?.tau ?? GLICKO_DEFAULTS.tau;
  const base = options?.baseRating ?? GLICKO_DEFAULTS.rating;

  // Step 1: convert to Glicko-2 scale
  const mu = (player.rating - base) / SCALE;
  const phi = player.rd / SCALE;
  const sigma = player.volatility;

  // If no matches were played, only increase rating deviation (Step 6)
  if (outcomes.length === 0) {
    const phiPrime = Math.sqrt(phi * phi + sigma * sigma);
    return {
      rating: player.rating,
      rd: phiPrime * SCALE,
      volatility: sigma,
    };
  }

  // Step 2 & 3: compute estimated variance v
  let vInv = 0;
  for (const o of outcomes) {
    const muJ = (o.opponent.rating - base) / SCALE;
    const phiJ = o.opponent.rd / SCALE;
    const gJ = g(phiJ);
    const e = expectScore(mu, muJ, phiJ);
    vInv += gJ * gJ * e * (1 - e);
  }
  const v = 1 / vInv;

  // Step 4: compute delta
  let sumDelta = 0;
  for (const o of outcomes) {
    const muJ = (o.opponent.rating - base) / SCALE;
    const phiJ = o.opponent.rd / SCALE;
    const gJ = g(phiJ);
    const e = expectScore(mu, muJ, phiJ);
    sumDelta += gJ * (o.score - e);
  }
  const delta = v * sumDelta;

  // Step 5: solve for new volatility sigma'
  const a = Math.log(sigma * sigma);
  const phiSq = phi * phi;
  const deltaSq = delta * delta;

  const f = (x: number): number => {
    const ex = Math.exp(x);
    const denom = phiSq + v + ex;
    const term1 = (ex * (deltaSq - phiSq - v - ex)) / (2 * denom * denom);
    const term2 = (x - a) / (tau * tau);
    return term1 - term2;
  };

  let A = a;
  let B: number;
  if (deltaSq > phiSq + v) {
    B = Math.log(deltaSq - phiSq - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) {
      k++;
    }
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);

  // Illinois secant algorithm
  const EPSILON = 1e-6;
  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }

  const sigmaPrime = Math.exp(A / 2);

  // Step 6: update phi to pre-rating period value
  const phiStar = Math.sqrt(phiSq + sigmaPrime * sigmaPrime);

  // Step 7: update phi' and mu'
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muPrime = mu + phiPrime * phiPrime * sumDelta;

  // Step 8: convert back to Glicko scale
  return {
    rating: Math.round(muPrime * SCALE + base),
    rd: Math.round(phiPrime * SCALE * 10) / 10,
    volatility: Math.round(sigmaPrime * 100000) / 100000,
  };
}

/**
 * Updates both players' ratings after a head-to-head match.
 * @param scoreA 1 if player A won, 0.5 for draw, 0 if player B won
 */
export function rateMatch(
  playerA: RatingState,
  playerB: RatingState,
  scoreA: number,
  options?: GlickoOptions,
): [RatingState, RatingState] {
  const newA = updateRating(playerA, [{ opponent: playerB, score: scoreA }], options);
  const newB = updateRating(playerB, [{ opponent: playerA, score: 1 - scoreA }], options);
  return [newA, newB];
}


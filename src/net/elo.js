// Standard Elo for ranked quick-match. Pure math — no I/O.

export const DEFAULT_ELO = 1000;
export const ELO_K = 32;

export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/** @param {number} score 1 win, 0.5 draw, 0 loss */
export function nextElo(rating, opponentRating, score, k = ELO_K) {
  const exp = expectedScore(rating, opponentRating);
  return Math.round(rating + k * (score - exp));
}

export function eloDelta(rating, opponentRating, score, k = ELO_K) {
  return nextElo(rating, opponentRating, score, k) - rating;
}

/**
 * Apply a 1v1 result.
 * @returns {{ a: number, b: number, deltaA: number, deltaB: number }}
 */
export function applyEloPair(ratingA, ratingB, winner /* 'a' | 'b' | 'draw' */) {
  const scoreA = winner === 'draw' ? 0.5 : winner === 'a' ? 1 : 0;
  const scoreB = 1 - scoreA;
  const a = nextElo(ratingA, ratingB, scoreA);
  const b = nextElo(ratingB, ratingA, scoreB);
  return { a, b, deltaA: a - ratingA, deltaB: b - ratingB };
}

export function formatElo(n) {
  return String(Math.round(n ?? DEFAULT_ELO));
}

export function formatDelta(d) {
  if (!d) return '±0';
  return d > 0 ? `+${d}` : `${d}`;
}

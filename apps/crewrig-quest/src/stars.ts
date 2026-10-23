// Star rule of an attempt (spec 0278 R6), kept pure so it is unit-tested alone.

export const MAX_STARS = 5;

/**
 * Stars earned by `correct` right answers out of `total`: the ratio scaled to
 * five and rounded half up, except that five stars are awarded if and only if
 * every answer was correct and zero stars if none was.
 */
export function computeStars(correct: number, total: number): number {
  if (!Number.isInteger(correct) || !Number.isInteger(total) || total <= 0) return 0;
  if (correct <= 0) return 0;
  if (correct >= total) return MAX_STARS;
  // Integer form of round-half-up(correct * 5 / total): no floating-point drift.
  const rounded = Math.floor((10 * correct + total) / (2 * total));
  return Math.min(rounded, MAX_STARS - 1);
}

import type { ItemKind } from './hurdleFlow';

const COIN_CHANCE = 0.3;

export function nextKind(rng: () => number): ItemKind {
  return rng() < COIN_CHANCE ? 'coin' : 'hurdle';
}

export const LANES = [-1, 0, 1] as const;
export type Lane = (typeof LANES)[number];
const MAX_SAME_LANE = 2;

/**
 * Picks the lane of the next hurdle so that no lane holds more than MAX_SAME_LANE hurdles in a
 * row. One obstacle spawns per row, so the three lanes can never be blocked at once.
 * `rng` returns a value in [0, 1).
 */
export function nextLane(history: readonly Lane[], rng: () => number): Lane {
  const recent = history.slice(-MAX_SAME_LANE);
  const repeated = recent.length === MAX_SAME_LANE && recent.every((lane) => lane === recent[0]) ? recent[0] : undefined;
  const open = LANES.filter((lane) => lane !== repeated);
  return open[Math.floor(rng() * open.length)]!;
}

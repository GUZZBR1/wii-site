const BASE_FOV = 52;
const SPEED_FOV = 6;
export const MAX_BOOST = 2;
const BOOST_RAMP_S = 120;

/** The world speeds up the longer the run lasts: from 1× to MAX_BOOST over BOOST_RAMP_S. */
export function timeBoost(seconds: number): number {
  return 1 + (MAX_BOOST - 1) * Math.min(1, Math.max(0, seconds / BOOST_RAMP_S));
}

/** Moves a recycled scenery piece toward the camera, wrapping it inside [minZ, maxZ). */
export function scrollZ(z: number, distance: number, minZ: number, maxZ: number): number {
  const span = maxZ - minZ;
  return minZ + ((((z + distance - minZ) % span) + span) % span);
}

/** The field of view opens a little with speed. */
export function fovFor(speed01: number): number {
  return BASE_FOV + SPEED_FOV * Math.min(1, Math.max(0, speed01));
}

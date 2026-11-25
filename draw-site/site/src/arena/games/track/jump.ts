export const JUMP_DURATION_S = 0.72;
const JUMP_HEIGHT = 1.35;

/** Height of a jump with `remaining` seconds left in the air. */
export function jumpHeight(remaining: number): number {
  return Math.sin((1 - remaining / JUMP_DURATION_S) * Math.PI) * JUMP_HEIGHT;
}

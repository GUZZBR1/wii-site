// The pace cycle is a discrete toggle: holding the key must not fire extra presses.
const TOGGLE_KEYS = new Set(['arrowdown', 's']);

export function forwardKeyDown(key: string, repeat: boolean): boolean {
  return !repeat || !TOGGLE_KEYS.has(key.toLowerCase());
}

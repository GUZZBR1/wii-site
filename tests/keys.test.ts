import { describe, expect, it } from 'vitest';
import { forwardKeyDown } from '../src/ui/keys';

describe('key forwarding', () => {
  it.each(['ArrowDown', 's', 'S'])('drops auto-repeated %s but keeps real presses', (key) => {
    expect(forwardKeyDown(key, true)).toBe(false);
    expect(forwardKeyDown(key, false)).toBe(true);
  });

  it.each(['ArrowLeft', 'ArrowUp', 'a', 'w', ' '])('still forwards repeated %s', (key) => {
    expect(forwardKeyDown(key, true)).toBe(true);
  });
});

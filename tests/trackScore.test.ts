import { describe, expect, it } from 'vitest';
import { TrackScore } from '../src/games/track/trackScore';

describe('track score', () => {
  it('accumulates sub-point increments across fixed steps', () => {
    const score = new TrackScore();
    for (let i = 0; i < 60; i += 1) score.advance(1 / 60, 0.32);
    expect(score.display).toBe(16);
  });

  it('scores nothing when idle and the most at full sprint', () => {
    const idle = new TrackScore();
    const sprint = new TrackScore();
    for (let i = 0; i < 60; i += 1) {
      idle.advance(1 / 60, 0);
      sprint.advance(1 / 60, 1);
    }
    expect(idle.display).toBe(0);
    expect(sprint.display).toBeGreaterThanOrEqual(49);
    expect(sprint.display).toBeLessThanOrEqual(50);
  });

  it('awards hurdle bonuses and never drops below zero', () => {
    const score = new TrackScore();
    score.hurdleCleared();
    expect(score.display).toBe(100);
    score.hurdleHit();
    score.hurdleHit();
    expect(score.display).toBe(30);
    score.hurdleHit();
    expect(score.display).toBe(0);
  });

  it('ignores malformed speed values', () => {
    const score = new TrackScore();
    score.advance(1 / 60, Number.NaN);
    score.advance(1 / 60, Number.POSITIVE_INFINITY);
    expect(score.display).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { HurdleFlow, type HurdleBody, RUNNER_Z } from '../src/games/track/hurdleFlow';

const hurdle = (lane: number, z: number): HurdleBody => ({ lane, z, passed: false });

describe('hurdle flow', () => {
  it('judges a hurdle only when it crosses the runner plane, exactly once', () => {
    const flow = new HurdleFlow();
    const hurdles = [hurdle(0, -2)];
    // Braking leaves the hurdle short of the runner: not judged yet.
    expect(flow.advance(hurdles, 2, 0, false).judged).toHaveLength(0);
    expect(hurdles[0]!.z).toBe(0);
    // On resume it is judged at the contact plane and never again.
    const resumed = flow.advance(hurdles, RUNNER_Z + 0.5, 0, false);
    expect(resumed.judged).toEqual([{ hurdle: hurdles[0], cleared: false }]);
    expect(flow.advance(hurdles, 1, 0, false).judged).toHaveLength(0);
  });

  it('clears the hurdle when the runner is airborne or in another lane', () => {
    const flow = new HurdleFlow();
    const jumping = [hurdle(0, RUNNER_Z - 0.5)];
    expect(flow.advance(jumping, 1, 0, true).judged[0]!.cleared).toBe(true);
    const dodged = [hurdle(1, RUNNER_Z - 0.5)];
    expect(flow.advance(dodged, 1, 0, false).judged[0]!.cleared).toBe(true);
    const hit = [hurdle(-1, RUNNER_Z - 0.5)];
    expect(flow.advance(hit, 1, -1, false).judged[0]!.cleared).toBe(false);
  });

  it('spawns on travelled distance: a pause adds nothing and progress survives it', () => {
    const flow = new HurdleFlow();
    expect(flow.advance([], 20, 0, false).spawn).toBe(false);
    for (let i = 0; i < 60; i += 1) expect(flow.advance([], 0, 0, false).spawn).toBe(false);
    expect(flow.advance([], 7, 0, false).spawn).toBe(true);
    expect(flow.advance([], 26, 0, false).spawn).toBe(false);
    expect(flow.advance([], 0.5, 0, false).spawn).toBe(true);
  });

  it('recycles hurdles once they are well behind the runner', () => {
    const flow = new HurdleFlow();
    const behind = hurdle(0, 7.9);
    const ahead = hurdle(0, -5);
    const { despawned } = flow.advance([behind, ahead], 0.5, 0, false);
    expect(despawned).toEqual([behind]);
  });
});

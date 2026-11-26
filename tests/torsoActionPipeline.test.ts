import { describe, expect, it } from 'vitest';
import { ActionPipeline } from '../src/arena/kinematics/actionPipeline';
import { calibration, poseWithHipBounce } from './fixtures/syntheticPose';

const TORSO_HEIGHT = 0.4;

function jumpRise(timeMs: number): number {
  const t = timeMs - 3000;
  if (t < 0) return 0;
  if (t < 250) return (-0.1 * (1 - Math.cos((Math.PI * t) / 250))) / 2;
  if (t < 430) {
    const progress = (t - 250) / 180;
    return -0.1 + 0.3 * progress * progress;
  }
  if (t < 700) return 0.2;
  if (t < 1000) return 0.2 * (1 - (t - 700) / 300);
  return 0;
}

function runningRise(timeMs: number): number {
  if (timeMs < 500) return 0;
  return 0.04 * Math.sin((2 * Math.PI * 2.5 * (timeMs - 500)) / 1000);
}

describe('torso action pipeline integration', () => {
  it('keeps cadence alive when a jump overlaps continuous running', () => {
    const pipeline = new ActionPipeline();
    const frames = [];

    for (let timeMs = 0; timeMs <= 7200; timeMs += 33) {
      const rise = runningRise(timeMs) + jumpRise(timeMs);
      const result = pipeline.update(poseWithHipBounce(timeMs, -rise * TORSO_HEIGHT), calibration());
      frames.push({ timeMs, ...result });
    }

    const jumps = frames.flatMap((frame) => frame.events).filter((event) => event.type === 'jump');
    expect(jumps).toHaveLength(1);

    const runningAfterLanding = frames.filter((frame) => frame.timeMs >= 4500 && frame.timeMs <= 6200);
    expect(runningAfterLanding.every((frame) => frame.controls.sprintSpeed01 > 0)).toBe(true);
  });

  it('does not interpret a high but continuous 3 Hz bounce as repeated jumps', () => {
    const pipeline = new ActionPipeline();
    const jumps = [];

    for (let timeMs = -600; timeMs <= 6000; timeMs += 33) {
      const rise = timeMs < 0 ? 0 : 0.14 * Math.sin((2 * Math.PI * 3 * timeMs) / 1000);
      const result = pipeline.update(poseWithHipBounce(timeMs, -rise * TORSO_HEIGHT), calibration());
      jumps.push(...result.events.filter((event) => event.type === 'jump'));
    }

    expect(jumps).toHaveLength(0);
  });
});

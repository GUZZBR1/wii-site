import { describe, expect, it } from 'vitest';
import { applySprint, applyStep, gaitFor, type Gait, nextPace, type Pace } from '../src/games/track/gait';
import { CadenceTracker, type CadenceResult } from '../src/kinematics/cadenceTracker';
import { calibration, pose } from './fixtures/syntheticPose';

const START = 500;
const STOP = 8000;

/** Marches in place at `spm` steps per minute from START to STOP, then stands still. */
function march(spm: number): (CadenceResult & { time: number })[] {
  const tracker = new CadenceTracker();
  const profile = calibration();
  const step = 60_000 / spm;
  return Array.from({ length: 320 }, (_, frame) => {
    const time = frame * 33;
    const elapsed = time - START;
    const lift = elapsed >= 0 && time <= STOP ? 0.25 * Math.sin((Math.PI * (elapsed % step)) / step) : 0;
    const left = Math.floor(elapsed / step) % 2 === 0;
    return { time, ...tracker.update(pose(time, { kneeLeft: left ? lift : 0, kneeRight: left ? 0 : lift }), profile) };
  });
}

describe('pace from marching in place', () => {
  it.each([40, 60, 90, 110, 130, 160, 190])('keeps moving without dropouts at %i steps per minute', (spm) => {
    const steady = march(spm).filter((r) => r.time > 3000 && r.time <= STOP);
    expect(steady.filter((r) => r.speed01 === 0)).toHaveLength(0);
    for (const r of steady) expect(Math.abs(r.cadenceSpm - spm) / spm).toBeLessThan(0.15);
  });

  it('goes faster the faster the player steps', () => {
    const speeds = [60, 90, 120, 150, 180].map((spm) => march(spm).find((r) => r.time > 6000)!.speed01);
    expect(speeds).toEqual([...speeds].sort((a, b) => a - b));
    expect(new Set(speeds).size).toBe(speeds.length);
  });

  it.each([60, 110, 180])('stops soon after the player stops at %i steps per minute', (spm) => {
    expect(march(spm).filter((r) => r.time > STOP + 1700).every((r) => r.speed01 === 0)).toBe(true);
  });

  it('does not move for a single knee raise or for standing still', () => {
    const tracker = new CadenceTracker();
    const speeds = Array.from({ length: 90 }, (_, i) => tracker.update(pose(i * 33, { kneeLeft: i > 10 && i < 30 ? 0.25 : 0 }), calibration()).speed01);
    expect(Math.max(...speeds)).toBe(0);
  });

  /** Feeds a square-wave march: legs alternate lifts of `halfMs`, so step events land every `halfMs`. */
  function drive(tracker: CadenceTracker, profile: ReturnType<typeof calibration>, schedule: { from: number; until: number; halfMs: number }[], results: { time: number; speed01: number; cadenceSpm: number; step?: string }[]) {
    const feed = (time: number, kneeLeft: number, kneeRight: number) =>
      results.push({ time, ...tracker.update(pose(time, { kneeLeft, kneeRight }), profile) });
    let time = 0;
    for (const { from, until, halfMs } of schedule) {
      for (; time < from; time += 33) feed(time, 0, 0);
      for (; time <= until; time += 33) {
        const phase = (time - from) % (halfMs * 2);
        feed(time, phase < halfMs ? 0.25 : 0, phase >= halfMs ? 0.25 : 0);
      }
    }
    return { results, feed: (t: number, kl: number, kr: number) => feed(t, kl, kr), time };
  }

  it('re-measures pace on a late step instead of resurrecting the old cadence', () => {
    const tracker = new CadenceTracker();
    const profile = calibration();
    const results: { time: number; speed01: number; cadenceSpm: number; step?: string }[] = [];
    const { feed } = drive(tracker, profile, [{ from: 500, until: 4500, halfMs: 400 }], results);
    expect(results.at(-1)!.speed01).toBeGreaterThan(0);
    for (let time = 4533; time <= 5267; time += 33) feed(time, 0, 0);
    expect(results.at(-1)!.speed01).toBe(0);
    // One isolated step ~1.1 s after the last: within the interval ceiling but past the stop deadline.
    for (let t = 5300; t < 5500; t += 33) feed(t, 0.25, 0);
    for (let time = 5500; time < 5700; time += 33) feed(time, 0, 0);
    const isolated = results.filter((r) => r.time >= 5300 && r.time < 5700);
    expect(isolated.some((r) => r.step === 'left')).toBe(true);
    // The old ~150 spm is gone; the measured ~1.1 s interval only supports a slow walk speed.
    expect(isolated.every((r) => r.speed01 < 0.3)).toBe(true);
    expect(isolated.some((r) => r.cadenceSpm > 0 && r.cadenceSpm < 80)).toBe(true);
  });

  it('needs two fresh steps to move again after a real stop', () => {
    const tracker = new CadenceTracker();
    const profile = calibration();
    const results: { time: number; speed01: number; cadenceSpm: number; step?: string }[] = [];
    const { feed } = drive(tracker, profile, [{ from: 500, until: 4500, halfMs: 400 }], results);
    for (let time = 4533; time <= 6467; time += 33) feed(time, 0, 0);
    expect(results.at(-1)!.speed01).toBe(0);
    // A step more than 1.8 s after the last is too old to pair with: it only re-arms the tracker.
    for (let t = 6500; t < 6700; t += 33) feed(t, 0.25, 0);
    for (let time = 6700; time < 6900; time += 33) feed(time, 0, 0);
    const isolated = results.filter((r) => r.time >= 6500 && r.time < 6900);
    expect(isolated.some((r) => r.step === 'left')).toBe(true);
    expect(isolated.every((r) => r.speed01 === 0)).toBe(true);
    // The second step completes one interval and movement resumes.
    for (let t = 6900; t < 7100; t += 33) feed(t, 0, 0.25);
    expect(results.at(-1)!.speed01).toBeGreaterThan(0);
  });

  it('keeps moving while marching slowly near the low cadence limit', () => {
    const tracker = new CadenceTracker();
    const results: { time: number; speed01: number; cadenceSpm: number; step?: string }[] = [];
    // Steps every 1.65 s (~36 spm): each one arrives past the 1.6 s stop deadline.
    drive(tracker, calibration(), [{ from: 500, until: 12000, halfMs: 1650 }], results);
    const steady = results.filter((r) => r.time > 4000);
    const moving = steady.filter((r) => r.speed01 > 0).length / steady.length;
    expect(moving).toBeGreaterThan(0.9);
  });

  it('keeps moving through a direct run-to-walk transition', () => {
    const tracker = new CadenceTracker();
    const results: { time: number; speed01: number; cadenceSpm: number; step?: string }[] = [];
    // ~182 spm run, then straight into a ~91 spm walk without standing still.
    drive(tracker, calibration(), [{ from: 500, until: 3000, halfMs: 330 }, { from: 3033, until: 12000, halfMs: 660 }], results);
    const walkSteps = results.filter((r) => r.time > 3200 && r.step);
    expect(walkSteps.length).toBeGreaterThan(4);
    for (const s of walkSteps) expect(s.speed01).toBeGreaterThan(0);
    const settled = results.filter((r) => r.time > 5000);
    expect(settled.every((r) => r.speed01 > 0)).toBe(true);
    const cadence = results.at(-1)!.cadenceSpm;
    expect(cadence).toBeGreaterThan(60);
    expect(cadence).toBeLessThan(120);
  });

  it.each([[0, 'idle'], [90, 'walk'], [120, 'walk'], [160, 'run'], [190, 'run']] as const)('reads %i steps per minute as %s', (spm, gait) => {
    const speed = spm === 0 ? 0 : march(spm).find((r) => r.time > 6000)!.speed01;
    expect(gaitFor(speed, 'idle')).toBe(gait);
  });

  it('does not flicker between walking and running near the transition', () => {
    let gait: Gait = 'run';
    for (const speed of [0.56, 0.52, 0.56, 0.52]) gait = gaitFor(speed, gait);
    expect(gait).toBe('run');
    expect(gaitFor(0.45, gait)).toBe('walk');
  });

  it('cycles stopped, walking and running on distinct key presses', () => {
    expect(nextPace(0)).toBe(0.3);
    expect(nextPace(0.3)).toBe(0.8);
    expect(nextPace(0.8)).toBe(0);
    expect(nextPace(0.64)).toBe(0);
  });
});

describe('pace ownership between camera and keyboard', () => {
  const still = { speed01: 0, cadenceSpm: 0 };
  const press = (pace: Pace): Pace => ({ owner: 'keyboard', speed01: nextPace(pace.speed01), cadenceSpm: 0 });

  it('lets the camera stop a run it is pacing', () => {
    const pace = applySprint({ owner: 'camera', speed01: 0.8, cadenceSpm: 160 }, still);
    expect(pace).toEqual({ owner: 'camera', speed01: 0, cadenceSpm: 0 });
  });

  it('keeps the keyboard pick through frames of measured still', () => {
    const pace = applySprint({ owner: 'keyboard', speed01: 0.8, cadenceSpm: 0 }, still);
    expect(pace).toEqual({ owner: 'keyboard', speed01: 0.8, cadenceSpm: 0 });
  });

  it('hands the pace to the camera on a measured step, then follows its cadence', () => {
    const pace = applyStep({ owner: 'keyboard', speed01: 0.8, cadenceSpm: 0 });
    expect(pace.owner).toBe('camera');
    expect(applySprint(pace, { speed01: 0.6, cadenceSpm: 150 })).toEqual({ owner: 'camera', speed01: 0.6, cadenceSpm: 150 });
  });

  it('keeps the keyboard pick while the cadence decays without new steps', () => {
    let pace: Pace = { owner: 'keyboard', speed01: 0.3, cadenceSpm: 0 };
    // Residual positive cadence between the last step and the stop deadline.
    for (const cadenceSpm of [120, 90, 60, 30]) pace = applySprint(pace, { speed01: 0.4, cadenceSpm });
    expect(pace).toEqual({ owner: 'keyboard', speed01: 0.3, cadenceSpm: 0 });
  });

  it('keeps camera pace when measured cadence decays while the camera owns it', () => {
    const pace = applySprint({ owner: 'camera', speed01: 0.6, cadenceSpm: 150 }, { speed01: 0.4, cadenceSpm: 120 });
    expect(pace).toEqual({ owner: 'camera', speed01: 0.4, cadenceSpm: 120 });
  });

  it('reaches running on two presses separated by still frames', () => {
    let pace: Pace = { owner: 'camera', speed01: 0, cadenceSpm: 0 };
    for (const target of [0.3, 0.8]) {
      pace = press(pace);
      pace = applySprint(pace, still);
      expect(pace.speed01).toBe(target);
    }
  });

  it('stops when the keyboard cycles back to zero and stays stopped', () => {
    let pace: Pace = { owner: 'keyboard', speed01: 0, cadenceSpm: 0 };
    pace = press(press(pace));
    pace = press(pace);
    pace = applySprint(pace, still);
    expect(pace.speed01).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { TorsoVerticalChannel, type TorsoVerticalSample } from '../src/arena/kinematics/torsoVertical';
import { pose, poseWithHipBounce } from './fixtures/syntheticPose';

const TORSO = 0.4; // fixture torsoHeight in image units

function sine(opts: { amplitude: number; frequencyHz: number; fps: number; durationMs: number; offset?: number }) {
  const frames = [];
  const dt = 1000 / opts.fps;
  for (let t = 0; t <= opts.durationMs; t += dt) {
    const torsoUnits = (opts.offset ?? 0) + opts.amplitude * Math.sin((2 * Math.PI * opts.frequencyHz * t) / 1000 - Math.PI / 2) + opts.amplitude;
    frames.push(poseWithHipBounce(Math.round(t), torsoUnits * TORSO));
  }
  return frames;
}

function run(channel: TorsoVerticalChannel, frames: ReturnType<typeof pose>[]) {
  const out: TorsoVerticalSample[] = [];
  for (const frame of frames) {
    const sample = channel.update(frame);
    if (sample) out.push(sample);
  }
  return out;
}

function semiAmplitude(values: number[]): number {
  return (Math.max(...values) - Math.min(...values)) / 2;
}

describe('TorsoVerticalChannel', () => {
  it('returns undefined when the torso core is below confidence or missing', () => {
    const channel = new TorsoVerticalChannel();
    const hidden = pose(0, { hiddenLandmarks: [11] });
    expect(channel.update(hidden)).toBeUndefined();
    expect(channel.update({ ...pose(33), landmarks: [] })).toBeUndefined();
    expect(channel.update(pose(66))).toBeDefined();
  });

  it('stays near zero rise and amplitude at rest after the baseline converges', () => {
    const channel = new TorsoVerticalChannel();
    const frames = [];
    for (let t = 0; t <= 5000; t += 33) frames.push(pose(t));
    const out = run(channel, frames);
    const tail = out.filter((s) => s.timestampMs > 4000);
    expect(Math.max(...tail.map((s) => Math.abs(s.rise)))).toBeLessThan(0.005);
    expect(Math.max(...tail.map((s) => s.oscillationAmplitude))).toBeLessThan(0.01);
  });

  it('follows a 0.05 torso sine at 2.8 Hz with most of its amplitude', () => {
    const channel = new TorsoVerticalChannel();
    const out = run(channel, sine({ amplitude: 0.05, frequencyHz: 2.8, fps: 30, durationMs: 6000 }));
    const tail = out.filter((s) => s.timestampMs > 4000);
    expect(semiAmplitude(tail.map((s) => s.rise))).toBeGreaterThan(0.05 * 0.6);
    const amp = tail.map((s) => s.oscillationAmplitude);
    expect(amp[amp.length - 1]!).toBeGreaterThan(0.05 * 0.6);
    expect(amp[amp.length - 1]!).toBeLessThan(0.05 * 1.5);
  });

  it('produces velocity peaks within 40% of the sine A·2πf', () => {
    const channel = new TorsoVerticalChannel();
    const out = run(channel, sine({ amplitude: 0.05, frequencyHz: 2.8, fps: 30, durationMs: 6000 }));
    const tail = out.filter((s) => s.timestampMs > 4000);
    const peak = Math.max(...tail.map((s) => Math.abs(s.velocityUp)));
    const expected = 0.05 * 2 * Math.PI * 2.8; // ≈ 0.88 torso/s
    expect(peak).toBeGreaterThan(expected * 0.6);
    expect(peak).toBeLessThan(expected * 1.4);
  });

  it('adapts the baseline to a posture shift with roughly the production tau', () => {
    const channel = new TorsoVerticalChannel();
    const frames = [];
    for (let t = 0; t <= 3000; t += 33) frames.push(pose(t));
    // Posture drops 0.1 torso (image y grows) at t=3000 and holds.
    for (let t = 3033; t <= 8000; t += 33) frames.push(poseWithHipBounce(t, 0.1 * TORSO));
    const out = run(channel, frames);
    const at = (ms: number) => out.filter((s) => Math.abs(s.timestampMs - ms) < 50).at(-1)!;
    const initial = Math.abs(at(3150).rise);
    expect(initial).toBeGreaterThan(0.05);
    // After one tau (1 s) the residual should be well under half the initial deviation.
    expect(Math.abs(at(4150).rise)).toBeLessThan(initial * 0.45);
    // And after ~3 tau it is practically gone.
    expect(Math.abs(at(6100).rise)).toBeLessThan(0.02);
  });

  it('normalizes per frame: the same torso-unit bounce reads the same at a 30% larger torso height', () => {
    const bigTorso = (t: number, torsoUnits: number) => {
      const snapshot = poseWithHipBounce(t, torsoUnits * 0.52);
      // enlarge torsoHeight to 0.52 by moving the hips down relative to the shoulders
      const landmarks = snapshot.landmarks.map((point, index) =>
        [23, 24].includes(index) ? { ...point, y: point.y + 0.12 } : point);
      return { ...snapshot, landmarks };
    };
    const measure = (makeFrame: (t: number, u: number) => ReturnType<typeof pose>, scale: number) => {
      const channel = new TorsoVerticalChannel();
      const frames = [];
      for (let t = 0; t <= 6000; t += 33) {
        const u = 0.05 * Math.sin((2 * Math.PI * 2.8 * t) / 1000 - Math.PI / 2) + 0.05;
        frames.push(makeFrame(t, u * scale));
      }
      const out = run(channel, frames);
      return semiAmplitude(out.filter((s) => s.timestampMs > 4000).map((s) => s.rise));
    };
    // poseWithHipBounce already expects torso units × TORSO(0.4) — the big variant scales by 0.52.
    const normal = measure((t, u) => poseWithHipBounce(t, u), TORSO);
    const big = measure((t, u) => bigTorso(t, u), 1);
    expect(big).toBeGreaterThan(normal * 0.85);
    expect(big).toBeLessThan(normal * 1.15);
  });

  it('produces equivalent rise and velocity for the same sine at 15 and 60 fps', () => {
    const measure = (fps: number) => {
      const channel = new TorsoVerticalChannel();
      const out = run(channel, sine({ amplitude: 0.05, frequencyHz: 2.8, fps, durationMs: 6000 }));
      const tail = out.filter((s) => s.timestampMs > 4000);
      return { rise: semiAmplitude(tail.map((s) => s.rise)), vel: Math.max(...tail.map((s) => Math.abs(s.velocityUp))) };
    };
    const slow = measure(15);
    const fast = measure(60);
    expect(slow.rise).toBeGreaterThan(fast.rise * 0.7);
    expect(slow.rise).toBeLessThan(fast.rise * 1.3);
    expect(slow.vel).toBeGreaterThan(fast.vel * 0.7);
    expect(slow.vel).toBeLessThan(fast.vel * 1.3);
  });
});

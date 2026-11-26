import { median } from './math';
import type { TorsoVerticalSample } from './torsoVertical';

export interface CadenceResult { cadenceSpm: number; speed01: number; step?: 'left' | 'right' }

const MIN_STEP_INTERVAL_MS = 220;
/**
 * Hard ceiling for one inter-step interval: ~33 steps/min plus margin for the frame-sampled
 * observation of a step crossing. The adaptive stop rule below ends a stepping session well
 * before this; the ceiling only keeps a very late step from reusing a stale timestamp.
 */
const MAX_STEP_INTERVAL_MS = 1800;
/** The player has stopped once the next step is this many periods late. */
const STOP_AFTER_PERIODS = 1.6;
const MAX_STOP_DELAY_MS = 1600;
/** A long or stuck jump must not keep a stale run cadence alive indefinitely. */
const MAX_JUMP_CADENCE_HOLD_MS = 1200;
/**
 * Smallest torso oscillation that counts as stepping, in torsoHeights semi-amplitude.
 * Below this the motion is posture sway or estimator noise. The running literature puts real
 * bouncing at 0.11–0.29 torso peak-to-peak (semi-amplitude ~0.05–0.15); marching in place is
 * smaller but still well above this floor — the adaptive hysteresis scales with the measured
 * amplitude, so the floor only decides whether ANY stepping exists.
 */
const MIN_OSCILLATION_TORSO = 0.012;
/**
 * Crossing hysteresis as a fraction of the measured oscillation amplitude. Fixed bands either
 * miss small-amplitude marching or double-count noise near the band edge; scaling the band
 * with the measured amplitude keeps the crossing point at a consistent phase of each cycle.
 */
const HYSTERESIS_RATIO = 0.35;
/**
 * Hysteresis band limits, in torsoHeights. The floor is the noise-immunity guarantee: a full
 * Schmitt cycle needs a swing of twice the band, so noise below ~0.024 torso peak-to-peak
 * (~11 mm) can never produce a step no matter its frequency content — without it, the band
 * would shrink with the decaying amplitude envelope right after the player stops, opening a
 * window where post-exercise sway could be miscounted as steps. The ceiling keeps the band
 * crossable when the measured amplitude is very large.
 */
const MIN_BAND_TORSO = 0.012;
const MAX_BAND_TORSO = 0.05;
/**
 * Steps/min to game speed, interpolated. Anchors follow the CADENCE-Adults studies (100 steps/min is a
 * moderate walk; walking turns into running around 135-140). Those were measured moving forward, not in place.
 */
const SPEED_BY_CADENCE = [[40, 0.1], [100, 0.3], [137.5, 0.55], [200, 1]] as const;

export function speedFromCadence(spm: number): number {
  if (spm <= 0) return 0;
  let [fromSpm, fromSpeed]: readonly [number, number] = SPEED_BY_CADENCE[0];
  for (const [toSpm, toSpeed] of SPEED_BY_CADENCE) {
    if (spm <= toSpm) return toSpm === fromSpm ? toSpeed : fromSpeed + (toSpeed - fromSpeed) * Math.min(1, Math.max(0, (spm - fromSpm) / (toSpm - fromSpm)));
    [fromSpm, fromSpeed] = [toSpm, toSpeed];
  }
  return fromSpeed;
}

/**
 * Step cadence from the vertical oscillation of the torso: running and marching bounce the
 * torso once per step, so the oscillation frequency IS the step frequency. Self-referencing —
 * the rise is measured against the channel's own adaptive baseline, so no calibration is
 * needed. Consumes the pipeline's shared TorsoVerticalChannel sample; frames without a sample
 * still advance the stop deadline. Step side cannot be told apart from torso motion alone,
 * so left/right alternate per step; consumers only use it for the run cycle animation.
 *
 * Startup: movement begins once two steps form one interval (~1.6 periods after the bounce
 * starts — inherent to interval measurement, on par with the old knee-lift tracker). Engaging
 * mid-bounce can phase-shift the first interval; the median-of-three absorbs it within three
 * steps, and since the player is genuinely bouncing in that scenario the error is small.
 */
export class CadenceTracker {
  private high = false;
  private lastSteps: number[] = [];
  private lastStepAt = Number.NEGATIVE_INFINITY;
  private lastStepSide?: 'left' | 'right';
  private previous?: { rise: number; timeMs: number };
  private pausedAt?: number;

  update(sample: TorsoVerticalSample | undefined, nowMs: number, suspendCrossings = false): CadenceResult {
    let step: 'left' | 'right' | undefined;
    let resumed = false;
    if (suspendCrossings) {
      this.pausedAt ??= nowMs;
    } else if (this.pausedAt !== undefined) {
      const pausedMs = Math.min(Math.max(0, nowMs - this.pausedAt), MAX_JUMP_CADENCE_HOLD_MS);
      if (Number.isFinite(this.lastStepAt)) this.lastStepAt += pausedMs;
      this.pausedAt = undefined;
      resumed = true;
    }
    if (sample && !suspendCrossings && !resumed) {
      const active = sample.oscillationAmplitude >= MIN_OSCILLATION_TORSO;
      const band = Math.min(Math.max(sample.oscillationAmplitude * HYSTERESIS_RATIO, MIN_BAND_TORSO), MAX_BAND_TORSO);
      if (!this.high && sample.rise >= band) {
        this.high = true;
        if (active) {
          step = this.lastStepSide === 'left' ? 'right' : 'left';
          // Linear interpolation of the crossing time: frame-quantized step times would
          // dominate the interval error at high cadence (a 400 ms period is only ~12 frames).
          let crossTime = sample.timestampMs;
          if (this.previous && this.previous.rise < band && sample.rise > this.previous.rise) {
            const fraction = (band - this.previous.rise) / (sample.rise - this.previous.rise);
            crossTime = this.previous.timeMs + fraction * (sample.timestampMs - this.previous.timeMs);
          }
          const interval = crossTime - this.lastStepAt;
          // A step later than the session's stop deadline opens a fresh interval window: the old
          // cadence is dropped, but the measured interval still estimates the new pace. A step
          // beyond the acceptance ceiling is too old to pair with, so it only re-arms the tracker.
          const deadline = Math.min(median(this.lastSteps) * STOP_AFTER_PERIODS, MAX_STOP_DELAY_MS);
          if (interval > deadline) this.lastSteps = [];
          if (interval >= MIN_STEP_INTERVAL_MS && interval <= MAX_STEP_INTERVAL_MS) this.lastSteps = [...this.lastSteps, interval].slice(-3);
          this.lastStepAt = crossTime;
          this.lastStepSide = step;
        }
      } else if (this.high && sample.rise <= -band) {
        this.high = false;
      }
      this.previous = { rise: sample.rise, timeMs: sample.timestampMs };
    } else if (sample && resumed) {
      const band = Math.min(Math.max(sample.oscillationAmplitude * HYSTERESIS_RATIO, MIN_BAND_TORSO), MAX_BAND_TORSO);
      if (sample.rise >= band) this.high = true;
      else if (sample.rise <= -band) this.high = false;
      this.previous = { rise: sample.rise, timeMs: sample.timestampMs };
    }
    // One interval (two steps) is enough to start moving. A late step slows the pace before it stops it.
    const period = median(this.lastSteps);
    const suspendedMs = suspendCrossings && this.pausedAt !== undefined
      ? Math.min(Math.max(0, nowMs - this.pausedAt), MAX_JUMP_CADENCE_HOLD_MS)
      : 0;
    const elapsed = nowMs - this.lastStepAt - suspendedMs;
    const moving = period > 0 && elapsed <= Math.min(period * STOP_AFTER_PERIODS, MAX_STOP_DELAY_MS);
    const cadenceSpm = moving ? 60_000 / Math.max(period, elapsed) : 0;
    return { cadenceSpm, speed01: speedFromCadence(cadenceSpm), step };
  }

  reset(): void {
    this.high = false;
    this.lastSteps = [];
    this.lastStepAt = Number.NEGATIVE_INFINITY;
    this.lastStepSide = undefined;
    this.previous = undefined;
    this.pausedAt = undefined;
  }
}

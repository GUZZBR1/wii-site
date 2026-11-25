import type { CalibrationProfile, PoseSnapshot } from '../cv/protocol';
import { OneEuroFilter } from '../cv/oneEuroFilter';
import { SchmittTrigger } from './schmittTrigger';
import { clamp, median, midpoint } from './math';

export interface CadenceResult { cadenceSpm: number; speed01: number; step?: 'left' | 'right' }

const KNEE_ON_THRESHOLD = 0.1;
const KNEE_OFF_THRESHOLD = 0.05;
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
/**
 * Steps/min to game speed, interpolated. Anchors follow the CADENCE-Adults studies (100 steps/min is a
 * moderate walk; walking turns into running around 135-140). Those were measured moving forward, not in place.
 */
const SPEED_BY_CADENCE = [[40, 0.1], [100, 0.3], [137.5, 0.55], [200, 1]] as const;

export function speedFromCadence(spm: number): number {
  if (spm <= 0) return 0;
  let [fromSpm, fromSpeed]: readonly [number, number] = SPEED_BY_CADENCE[0];
  for (const [toSpm, toSpeed] of SPEED_BY_CADENCE) {
    if (spm <= toSpm) return toSpm === fromSpm ? toSpeed : fromSpeed + (toSpeed - fromSpeed) * clamp((spm - fromSpm) / (toSpm - fromSpm));
    [fromSpm, fromSpeed] = [toSpm, toSpeed];
  }
  return fromSpeed;
}

export class CadenceTracker {
  private readonly left = new SchmittTrigger(KNEE_ON_THRESHOLD, KNEE_OFF_THRESHOLD, 220);
  private readonly right = new SchmittTrigger(KNEE_ON_THRESHOLD, KNEE_OFF_THRESHOLD, 220);
  private readonly leftFilter = new OneEuroFilter({ minCutoff: 1, beta: 0.5, derivativeCutoff: 1 });
  private readonly rightFilter = new OneEuroFilter({ minCutoff: 1, beta: 0.5, derivativeCutoff: 1 });
  private lastSteps: number[] = [];
  private lastStepAt = Number.NEGATIVE_INFINITY;
  private lastStepSide?: 'left' | 'right';
  private needsNeutral = true;

  update(snapshot: PoseSnapshot, calibration: CalibrationProfile): CadenceResult {
    const l = snapshot.landmarks;
    const hip = midpoint(l[23]!, l[24]!);
    const scale = calibration.image.torsoHeight;
    const leftLift = this.leftFilter.filter((hip.y - l[25]!.y) / scale - calibration.image.kneeToHipY0.left, snapshot.timestampMs);
    const rightLift = this.rightFilter.filter((hip.y - l[26]!.y) / scale - calibration.image.kneeToHipY0.right, snapshot.timestampMs);
    if (this.needsNeutral) {
      if (leftLift <= KNEE_OFF_THRESHOLD && rightLift <= KNEE_OFF_THRESHOLD) this.needsNeutral = false;
      else return { cadenceSpm: 0, speed01: 0 };
    }
    const leftStep = this.left.update(leftLift, snapshot.timestampMs);
    const rightStep = this.right.update(rightLift, snapshot.timestampMs);
    let step: 'left' | 'right' | undefined;
    if (leftStep && rightStep) {
      if (leftLift === rightLift) step = this.lastStepSide === 'left' ? 'right' : 'left';
      else step = leftLift > rightLift ? 'left' : 'right';
    } else if (leftStep) step = 'left';
    else if (rightStep) step = 'right';
    if (step) {
      const interval = snapshot.timestampMs - this.lastStepAt;
      // A step later than the session's stop deadline opens a fresh interval window: the old cadence
      // is dropped, but the measured interval still estimates the new pace. A step beyond the
      // acceptance ceiling is too old to pair with, so it only re-arms the tracker.
      const deadline = Math.min(median(this.lastSteps) * STOP_AFTER_PERIODS, MAX_STOP_DELAY_MS);
      if (interval > deadline) this.lastSteps = [];
      if (interval >= MIN_STEP_INTERVAL_MS && interval <= MAX_STEP_INTERVAL_MS) this.lastSteps = [...this.lastSteps, interval].slice(-3);
      this.lastStepAt = snapshot.timestampMs;
      this.lastStepSide = step;
    }
    // One interval (two steps) is enough to start moving. A late step slows the pace before it stops it.
    const period = median(this.lastSteps);
    const elapsed = snapshot.timestampMs - this.lastStepAt;
    const moving = period > 0 && elapsed <= Math.min(period * STOP_AFTER_PERIODS, MAX_STOP_DELAY_MS);
    const cadenceSpm = moving ? 60_000 / Math.max(period, elapsed) : 0;
    return { cadenceSpm, speed01: speedFromCadence(cadenceSpm), step };
  }

  reset(): void {
    this.left.reset(); this.right.reset(); this.leftFilter.reset(); this.rightFilter.reset(); this.lastSteps = []; this.lastStepAt = Number.NEGATIVE_INFINITY; this.lastStepSide = undefined; this.needsNeutral = true;
  }
}

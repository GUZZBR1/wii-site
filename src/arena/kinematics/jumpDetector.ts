import type { CalibrationProfile, PoseSnapshot } from '../cv/protocol';
import { OneEuroFilter } from '../cv/oneEuroFilter';
import { midpoint } from './math';

const MIN_TAKEOFF_RISE = 0.08;
const MIN_UPWARD_SPEED_PER_TORSO = 0.5;
const TAKEOFF_CONFIRM_MS = 30;

export class JumpDetector {
  private readonly riseFilter = new OneEuroFilter({ minCutoff: 1, beta: 0.5, derivativeCutoff: 1 });
  private previousRise?: number;
  private previousTimeMs?: number;
  private risingSince?: number;
  private airborne = false;
  private armed = false;
  private neutralSince?: number;
  private lastJumpAt = Number.NEGATIVE_INFINITY;

  update(snapshot: PoseSnapshot, calibration: CalibrationProfile): boolean {
    if (calibration.image.hipY0 === undefined) return false;
    const hips = midpoint(snapshot.landmarks[23]!, snapshot.landmarks[24]!);
    const rise = this.riseFilter.filter((calibration.image.hipY0 - hips.y) / calibration.image.torsoHeight, snapshot.timestampMs);
    const dtSeconds = this.previousTimeMs === undefined ? undefined : Math.max((snapshot.timestampMs - this.previousTimeMs) / 1000, 1 / 120);
    const velocityUp = this.previousRise === undefined || dtSeconds === undefined ? 0 : (rise - this.previousRise) / dtSeconds;
    if (!this.armed) {
      if (rise <= 0.03) {
        this.neutralSince ??= snapshot.timestampMs;
        if (snapshot.timestampMs - this.neutralSince >= 160) {
          this.armed = true;
          this.neutralSince = undefined;
        }
      } else this.neutralSince = undefined;
      this.previousRise = rise;
      this.previousTimeMs = snapshot.timestampMs;
      return false;
    }

    if (rise >= MIN_TAKEOFF_RISE && velocityUp >= MIN_UPWARD_SPEED_PER_TORSO) this.risingSince ??= snapshot.timestampMs;
    else this.risingSince = undefined;

    let fired = false;
    if (!this.airborne && this.risingSince !== undefined && snapshot.timestampMs - this.risingSince >= TAKEOFF_CONFIRM_MS && snapshot.timestampMs - this.lastJumpAt >= 400) {
      this.airborne = true;
      this.lastJumpAt = snapshot.timestampMs;
      this.neutralSince = undefined;
      this.risingSince = undefined;
      fired = true;
    }
    if (this.airborne) {
      if (rise <= 0.03) {
        this.neutralSince ??= snapshot.timestampMs;
        if (snapshot.timestampMs - this.neutralSince >= 160) {
          this.airborne = false;
        }
      } else this.neutralSince = undefined;
    }
    this.previousRise = rise;
    this.previousTimeMs = snapshot.timestampMs;
    return fired;
  }

  reset(): void {
    this.riseFilter.reset(); this.previousRise = undefined; this.previousTimeMs = undefined; this.risingSince = undefined;
    this.airborne = false; this.armed = false; this.neutralSince = undefined; this.lastJumpAt = Number.NEGATIVE_INFINITY;
  }
}

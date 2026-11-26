import type { CalibrationProfile, PoseSnapshot } from '../cv/protocol';
import { OneEuroFilter } from '../cv/oneEuroFilter';
import { torsoLeanRad } from './bodyFrame';

export function torsoLeanDeltaRad(snapshot: PoseSnapshot, calibration: CalibrationProfile): number {
  const angle = torsoLeanRad(snapshot, calibration.world.leanUp0) ?? calibration.world.torsoLeanRad0;
  const delta = angle - calibration.world.torsoLeanRad0;
  return Math.atan2(Math.sin(delta), Math.cos(delta));
}

export class LaneLeanDetector {
  private readonly angleFilter = new OneEuroFilter({ minCutoff: 1, beta: 0.5, derivativeCutoff: 1 });
  private armed = false;
  private active?: 'left' | 'right';
  private lastChangeAt = Number.NEGATIVE_INFINITY;

  update(snapshot: PoseSnapshot, calibration: CalibrationProfile): 'left' | 'right' | undefined {
    const delta = this.angleFilter.filter(torsoLeanDeltaRad(snapshot, calibration), snapshot.timestampMs);
    if (!this.armed) {
      if (Math.abs(delta) <= 0.1) this.armed = true;
      return undefined;
    }
    const direction = delta < 0 ? 'left' : 'right';
    if (this.active && Math.abs(delta) <= 0.1) this.active = undefined;
    if (Math.abs(delta) < 0.15 || snapshot.timestampMs - this.lastChangeAt < 350 || direction === this.active) return undefined;
    this.active = direction;
    this.lastChangeAt = snapshot.timestampMs;
    return direction;
  }

  reset(): void { this.angleFilter.reset(); this.armed = false; this.active = undefined; this.lastChangeAt = Number.NEGATIVE_INFINITY; }
}

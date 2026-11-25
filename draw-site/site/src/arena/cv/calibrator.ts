import type { CalibrationProfile, Hand, Point3, PoseSnapshot } from './protocol';
import { distance2, distance3, landmarkConfidence, median, midpoint } from '../kinematics/math';
import { bodyLocalPoint, legsVertical, torsoLeanRad } from '../kinematics/bodyFrame';

const IDX = { leftShoulder: 11, rightShoulder: 12, leftWrist: 15, rightWrist: 16, leftHip: 23, rightHip: 24, leftKnee: 25, rightKnee: 26 } as const;

function point(points: readonly Point3[], index: number): Point3 | undefined { return points[index]; }

export class Calibrator {
  private startedAt?: number;
  private samples: PoseSnapshot[] = [];

  start(timestampMs: number): void {
    this.startedAt = timestampMs;
    this.samples = [];
  }

  add(snapshot: PoseSnapshot): void {
    if (this.startedAt !== undefined) this.samples.push(snapshot);
  }

  finish(): CalibrationProfile | null {
    if (this.startedAt === undefined || this.samples.length < 12) return null;
    const first = this.samples[0]!.timestampMs;
    const last = this.samples.at(-1)!.timestampMs;
    if (last - first < 2800) return null;

    // The stance gate needs body geometry only; the racket gate adds both wrists
    // (the dominant hand is detected at runtime, so each side needs its own
    // reference). They are counted separately — frames where the wrists and the
    // ankles drop out on different frames must not sink both references.
    const stance: { up: Point3; hipY: number; sample: PoseSnapshot }[] = [];
    const valid: {
      torsoHeight: number;
      shoulderWidth: number;
      kneeLeft: number;
      kneeRight: number;
      worldShoulderWidth: number;
      left: Point3;
      right: Point3;
      confidence: number;
    }[] = [];
    for (const sample of this.samples) {
      const l = sample.landmarks;
      const w = sample.worldLandmarks;
      const leftShoulder = point(l, IDX.leftShoulder);
      const rightShoulder = point(l, IDX.rightShoulder);
      const leftHip = point(l, IDX.leftHip);
      const rightHip = point(l, IDX.rightHip);
      const leftKnee = point(l, IDX.leftKnee);
      const rightKnee = point(l, IDX.rightKnee);
      const leftWrist = point(w, IDX.leftWrist);
      const rightWrist = point(w, IDX.rightWrist);
      const worldLeftShoulder = point(w, IDX.leftShoulder);
      const worldRightShoulder = point(w, IDX.rightShoulder);
      const worldLeftHip = point(w, IDX.leftHip);
      const worldRightHip = point(w, IDX.rightHip);
      if (!leftShoulder || !rightShoulder || !leftHip || !rightHip || !leftKnee || !rightKnee || !worldLeftShoulder || !worldRightShoulder || !worldLeftHip || !worldRightHip) continue;
      const bodyConfidence = landmarkConfidence(leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, worldLeftShoulder, worldRightShoulder, worldLeftHip, worldRightHip);
      if (bodyConfidence < 0.55) continue;
      const shoulderCenter = midpoint(leftShoulder, rightShoulder);
      const hipCenter = midpoint(leftHip, rightHip);
      const shoulderWidth = distance2(leftShoulder, rightShoulder);
      const torsoHeight = Math.abs(hipCenter.y - shoulderCenter.y);
      const worldShoulderWidth = distance3(worldLeftShoulder, worldRightShoulder);
      if (torsoHeight < 0.03 || shoulderWidth < 0.03 || worldShoulderWidth < 0.03) continue;
      const up = legsVertical(sample);
      if (up) stance.push({ up, hipY: hipCenter.y, sample });
      if (!leftWrist || !rightWrist || landmarkConfidence(leftWrist, rightWrist) < 0.55) continue;
      const confidence = Math.min(bodyConfidence, landmarkConfidence(leftWrist, rightWrist));
      const left = bodyLocalPoint(leftWrist, worldLeftShoulder, worldLeftShoulder, worldRightShoulder, worldLeftHip, worldRightHip, 1);
      const right = bodyLocalPoint(rightWrist, worldRightShoulder, worldLeftShoulder, worldRightShoulder, worldLeftHip, worldRightHip, 1);
      if (!left || !right) continue;
      valid.push({ torsoHeight, shoulderWidth, kneeLeft: (hipCenter.y - leftKnee.y) / torsoHeight, kneeRight: (hipCenter.y - rightKnee.y) / torsoHeight, worldShoulderWidth, left, right, confidence });
    }
    if (valid.length < this.samples.length * 0.65) return null;
    // The lean and jump references are only trusted when the leg geometry verified an extended,
    // fully visible stance — a trunk-direction or bent-stance fallback would store the player's
    // posture and replay it as ghost lean or a jump baseline that never re-arms, so those
    // detectors simply stay disabled instead.
    const stanceVerified = stance.length >= this.samples.length * 0.65;
    let leanUp0: Point3 | undefined;
    let torsoLeanRad0 = 0;
    if (stanceVerified) {
      const upMedian = {
        x: median(stance.map((v) => v.up.x)),
        y: median(stance.map((v) => v.up.y)),
        z: median(stance.map((v) => v.up.z)),
      };
      const upMagnitude = Math.hypot(upMedian.x, upMedian.y, upMedian.z);
      if (upMagnitude >= 1e-6) {
        leanUp0 = { x: upMedian.x / upMagnitude, y: upMedian.y / upMagnitude, z: upMedian.z / upMagnitude };
        torsoLeanRad0 = median(stance.map((v) => torsoLeanRad(v.sample, leanUp0!) ?? 0));
      }
    }
    const values = <K extends keyof (typeof valid)[number]>(key: K): number[] => valid.map((item) => item[key] as number);
    const worldShoulderWidth = median(values('worldShoulderWidth'));
    const readyWrist = (hand: Hand): Point3 => ({
      x: median(valid.map((v) => v[hand].x)) / worldShoulderWidth,
      y: median(valid.map((v) => v[hand].y)) / worldShoulderWidth,
      z: median(valid.map((v) => v[hand].z)) / worldShoulderWidth,
    });
    const profile: CalibrationProfile = {
      version: 1,
      completedAtMs: last,
      image: {
        torsoHeight: median(values('torsoHeight')),
        hipY0: stanceVerified ? median(stance.map((v) => v.hipY)) : undefined,
        kneeToHipY0: { left: median(values('kneeLeft')), right: median(values('kneeRight')) },
        shoulderWidth: median(values('shoulderWidth')),
      },
      world: { shoulderWidth: worldShoulderWidth, leanUp0, torsoLeanRad0, readyWristLocal: { left: readyWrist('left'), right: readyWrist('right') } },
      quality: { validFrameRatio: valid.length / this.samples.length, medianConfidence: median(values('confidence')) },
    };
    this.startedAt = undefined;
    this.samples = [];
    return profile;
  }

  reset(): void { this.startedAt = undefined; this.samples = []; }
}

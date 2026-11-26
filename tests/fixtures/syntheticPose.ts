import type { CalibrationProfile, Point3, PoseSnapshot } from '../../src/arena/cv/protocol';

export function pose(timestampMs: number, options: {
  kneeLeft?: number;
  kneeRight?: number;
  hipRise?: number;
  wristLateral?: number;
  leftWristLateral?: number;
  wristVertical?: number;
  wristDepth?: number;
  leanRad?: number;
  confidence?: number;
  hiddenLandmarks?: readonly number[];
} = {}): PoseSnapshot {
  const points: Point3[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: options.confidence ?? 0.95, presence: options.confidence ?? 0.95 }));
  const hipY = 0.55 - (options.hipRise ?? 0) * 0.4;
  points[11] = { ...points[11]!, x: 0.43, y: hipY - 0.4 };
  points[12] = { ...points[12]!, x: 0.57, y: hipY - 0.4 };
  points[23] = { ...points[23]!, x: 0.46, y: hipY };
  points[24] = { ...points[24]!, x: 0.54, y: hipY };
  points[25] = { ...points[25]!, x: 0.46, y: hipY + 0.2 - (options.kneeLeft ?? 0) * 0.4 };
  points[26] = { ...points[26]!, x: 0.54, y: hipY + 0.2 - (options.kneeRight ?? 0) * 0.4 };
  points[27] = { ...points[27]!, x: 0.46, y: hipY + 0.4 };
  points[28] = { ...points[28]!, x: 0.54, y: hipY + 0.4 };
  points[15] = { ...points[15]!, x: 0.39, y: hipY - 0.12 };
  points[16] = { ...points[16]!, x: 0.61, y: hipY - 0.12 };
  options.hiddenLandmarks?.forEach((index) => {
    if (points[index]) points[index] = { ...points[index]!, visibility: 0, presence: 0 };
  });

  // MediaPipe world axes: +x image right (the player's left), +y down.
  const world: Point3[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: options.confidence ?? 0.95, presence: options.confidence ?? 0.95 }));
  const leanOffset = Math.tan(options.leanRad ?? 0) * 0.4;
  world[11] = { ...world[11]!, x: 0.2 - leanOffset, y: -0.4 };
  world[12] = { ...world[12]!, x: -0.2 - leanOffset, y: -0.4 };
  world[15] = { ...world[15]!, x: 0.2 - (options.leftWristLateral ?? 0), y: 0.1 };
  world[16] = {
    ...world[16]!,
    x: -0.2 - (options.wristLateral ?? 0),
    y: 0.1 - (options.wristVertical ?? 0),
    z: options.wristDepth ?? 0,
  };
  world[23] = { ...world[23]!, x: 0.1, y: 0 };
  world[24] = { ...world[24]!, x: -0.1, y: 0 };
  world[25] = { ...world[25]!, x: 0.1, y: 0.45 };
  world[26] = { ...world[26]!, x: -0.1, y: 0.45 };
  world[27] = { ...world[27]!, x: 0.1, y: 0.9 };
  world[28] = { ...world[28]!, x: -0.1, y: 0.9 };
  return { timestampMs, landmarks: points, worldLandmarks: world, trackingState: 'tracked', bodyConfidence: options.confidence ?? 0.95 };
}

export function calibration(): CalibrationProfile {
  return {
    version: 2, completedAtMs: 3000,
    world: { shoulderWidth: 0.4, leanUp0: { x: 0, y: -1, z: 0 }, torsoLeanRad0: 0, readyWristLocal: { left: { x: 0, y: -1.25, z: 0 }, right: { x: 0, y: -1.25, z: 0 } } },
    quality: { validFrameRatio: 1, medianConfidence: 0.95 },
  };
}

/** Translates the torso core (shoulders + hips) vertically in image space, torso height unchanged. */
export function poseWithHipBounce(timestampMs: number, hipYOffset: number, confidence?: number) {
  const snapshot = pose(timestampMs, { confidence });
  const landmarks = snapshot.landmarks.map((point, index) =>
    [11, 12, 23, 24].includes(index) ? { ...point, y: point.y + hipYOffset } : point);
  return { ...snapshot, landmarks };
}

export type Hand = 'left' | 'right';
export type Delegate = 'GPU' | 'CPU';
export type VisionMode = 'pose' | 'hand';
export type Handedness = 'Left' | 'Right';
export type TrackingState = 'calibrating' | 'tracked' | 'degraded' | 'lost';

export interface Point3 {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
}

export interface PoseSnapshot {
  timestampMs: number;
  landmarks: readonly Point3[];
  worldLandmarks: readonly Point3[];
  /** Core shoulders/hips status; each sport action carries confidence from its own landmark gate. */
  trackingState: TrackingState;
  bodyConfidence: number;
}

export interface HandSnapshot {
  timestampMs: number;
  landmarks: readonly Point3[];
  handedness?: Handedness;
  /** bitmap.height / bitmap.width; corrige distâncias normalizadas fora do quadrado. */
  aspectY?: number;
}

export interface CalibrationProfile {
  version: 1;
  completedAtMs: number;
  image: {
    torsoHeight: number;
    /**
     * Standing hip height — the jump baseline. Absent when the legs could not be verified as
     * extended, because a bent-knee stance stores a low baseline that never re-arms the jump
     * detector once the player lands upright; jumps then stay disabled instead.
     */
    hipY0?: number;
    kneeToHipY0: { left: number; right: number };
    shoulderWidth: number;
  };
  world: {
    shoulderWidth: number;
    /**
     * Standing vertical captured at calibration from the extended legs (≈ gravity) — the fixed
     * lean reference, absorbing camera roll/pitch without inheriting the player's habitual trunk
     * posture or rotating with a lean. Absent when the legs could not be verified; the lane
     * detector then stays disabled rather than approving a posture-tainted reference, while the
     * rest of the profile (swings, cadence, jumps) still applies.
     */
    leanUp0?: Point3;
    /** Lateral trunk lean of the neutral calibration pose; runtime lean is reported as the delta from it. */
    torsoLeanRad0: number;
    /** Each wrist relative to its shoulder in a body-local frame, normalized by calibrated shoulder width. */
    readyWristLocal: Record<Hand, Point3>;
  };
  quality: { validFrameRatio: number; medianConfidence: number };
}

export interface WorkerInit {
  type: 'INIT';
  wasmBaseUrl: string;
  modelUrl: string;
  delegate: Delegate;
  mode: VisionMode;
}

export interface WorkerSetMode {
  type: 'SET_MODE';
  mode: VisionMode;
  modelUrl: string;
}

export interface WorkerFrame {
  type: 'FRAME';
  /** Monotonic within a PoseClient; identifies this inference request. */
  requestId: number;
  /** Changes for each capture session; stale replies must not reach the active session. */
  captureEpoch: number;
  timestampMs: number;
  bitmap: ImageBitmap;
}

export type WorkerRequest = WorkerInit | WorkerSetMode | WorkerFrame | { type: 'DISPOSE' };

export type WorkerReply =
  | { type: 'READY'; mode: VisionMode; delegate: Delegate }
  | {
      type: 'POSE';
      requestId: number;
      captureEpoch: number;
      timestampMs: number;
      landmarks: Point3[];
      worldLandmarks: Point3[];
    }
  | {
      type: 'HAND';
      requestId: number;
      captureEpoch: number;
      timestampMs: number;
      landmarks: Point3[];
      handedness?: Handedness;
      aspectY?: number;
    }
  | { type: 'FALLBACK'; from: 'GPU'; to: 'CPU'; reason: string }
  | { type: 'ERROR'; stage: 'init'; fatal: boolean; message: string }
  | { type: 'ERROR'; stage: 'detect'; fatal: boolean; message: string; requestId: number; captureEpoch: number };

export type AimZone = 'cross' | 'center' | 'line';
export type SportActionEvent =
  | (ActionBase & { type: 'sprint'; speed01: number; cadenceSpm: number })
  | (ActionBase & { type: 'step'; side: Hand })
  | (ActionBase & { type: 'jump' })
  | (ActionBase & { type: 'lane'; direction: 'left' | 'right' })
  | (ActionBase & {
      type: 'swing';
      side: 'forehand' | 'backhand';
      power01: number;
      aimZone: AimZone;
      peakTimestampMs?: number;
    });

export interface ContinuousControls {
  /** Always neutral when cadence tracking is degraded or lost. */
  sprintSpeed01: number;
  cadenceSpm: number;
  trackingState: TrackingState;
}

interface ActionBase {
  id: number;
  /**
   * 'tracked' events carry the video-frame timestamp that confirmed the action; swing also carries its estimated
   * peak-frame timestamp. Control events — emitted because the action's landmarks could not be confirmed — are
   * stamped with the frame that revealed the loss, or the capture-stop time when no frame exists. Injected
   * 'keyboard' events carry their injection time.
   */
  timestampMs: number;
  /** Confidence is the minimum visibility/presence for landmarks used by this action; 0 when no frame contributed. */
  confidence: number;
  /**
   * 'tracked' marks an action measured on a tracked pose; any other state marks a control event emitted because
   * the action's landmarks could not be confirmed — the sprint stop is 'degraded'/'lost' when tracking decays,
   * and 'lost' when calibration is absent (e.g. after a dominant-hand change) or capture stops.
   */
  trackingState: TrackingState;
  /** 'cv' events come from the pose pipeline; 'keyboard' events are injected controls, not pose measurements. */
  source: 'cv' | 'keyboard';
}

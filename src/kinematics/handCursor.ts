import type { HandSnapshot, Point3 } from '../cv/protocol';
import { OneEuroFilter, type OneEuroOptions } from '../cv/oneEuroFilter';
import { clamp } from './math';
import { SchmittTrigger } from './schmittTrigger';

export interface HandCursorZone {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface HandCursorOptions {
  activeZone?: HandCursorZone;
  syncDurationMs?: number;
  syncTolerance?: number;
  maxFrameGapMs?: number;
  lossGraceMs?: number;
  pointerAnchor?: 'tip' | 'midIndex';
  smoothing?: OneEuroOptions;
  pinchOnRatio?: number;
  pinchOffRatio?: number;
  pinchCooldownMs?: number;
  backHoldMs?: number;
  fistEnterStraightness?: number;
  fistReleaseStraightness?: number;
}

export interface HandCursorState {
  visible: boolean;
  /** Posição horizontal normalizada da tela; a UI multiplica pela largura da viewport. */
  x: number;
  /** Posição vertical normalizada da tela; a UI multiplica pela altura da viewport. */
  y: number;
  syncProgress: number;
  synced: boolean;
  pinching: boolean;
  /** Pulso de clique confirmado na ativação da pinça; não indica a soltura física dos dedos. */
  pinchRelease: boolean;
  backProgress: number;
  activeZone: HandCursorZone;
}

const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_PIP = 6;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const FINGERS = [
  [INDEX_MCP, INDEX_PIP, 7, INDEX_TIP],
  [MIDDLE_MCP, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
] as const;
const DEFAULT_ZONE: HandCursorZone = { minX: 0.2, maxX: 0.8, minY: 0.2, maxY: 0.8 };

function finite(point: Point3 | undefined): point is Point3 {
  return point !== undefined && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function imageDistance(a: Point3, b: Point3, aspectY: number): number {
  return Math.hypot(a.x - b.x, (a.y - b.y) * aspectY);
}

function usableHand(points: readonly Point3[], aspectY: number): boolean {
  if (points.length < 21) return false;
  for (let index = 0; index < 21; index++) if (!finite(points[index])) return false;
  return imageDistance(points[WRIST]!, points[MIDDLE_MCP]!, aspectY) > 1e-6;
}

function pinchRatio(points: readonly Point3[], aspectY: number): number {
  const scale = imageDistance(points[WRIST]!, points[MIDDLE_MCP]!, aspectY);
  if (scale <= 1e-6) return Number.POSITIVE_INFINITY;
  return imageDistance(points[THUMB_TIP]!, points[INDEX_TIP]!, aspectY) / scale;
}

function fingerStraightness(
  points: readonly Point3[],
  chain: readonly [number, number, number, number],
  aspectY: number,
): number | undefined {
  const [mcp, pip, dip, tip] = chain;
  const segments =
    imageDistance(points[mcp]!, points[pip]!, aspectY) +
    imageDistance(points[pip]!, points[dip]!, aspectY) +
    imageDistance(points[dip]!, points[tip]!, aspectY);
  if (segments <= 1e-6) return undefined;
  return imageDistance(points[mcp]!, points[tip]!, aspectY) / segments;
}

function maxFingerStraightness(points: readonly Point3[], aspectY: number): number | undefined {
  const values = FINGERS.map((chain) => fingerStraightness(points, chain, aspectY));
  if (values.some((value) => value === undefined)) return undefined;
  return Math.max(...(values as number[]));
}

function closedFist(
  points: readonly Point3[],
  active: boolean,
  enterStraightness: number,
  releaseStraightness: number,
  aspectY: number,
): boolean {
  const straightness = maxFingerStraightness(points, aspectY);
  if (straightness === undefined) return false;
  if (active) return straightness < releaseStraightness;
  return straightness < enterStraightness;
}

function validZone(zone: HandCursorZone): boolean {
  return (
    zone.minX >= 0 &&
    zone.minX < zone.maxX &&
    zone.maxX <= 1 &&
    zone.minY >= 0 &&
    zone.minY < zone.maxY &&
    zone.maxY <= 1
  );
}

export class HandCursorDetector {
  private readonly activeZone: HandCursorZone;
  private readonly syncDurationMs: number;
  private readonly syncTolerance: number;
  private readonly maxFrameGapMs: number;
  private readonly lossGraceMs: number;
  private readonly pointerAnchor: 'tip' | 'midIndex';
  private readonly backHoldMs: number;
  private readonly fistEnterStraightness: number;
  private readonly fistReleaseStraightness: number;
  private readonly xFilter: OneEuroFilter;
  private readonly yFilter: OneEuroFilter;
  private readonly pinch: SchmittTrigger;
  private readonly pinchOffRatio: number;
  private readonly pinchCooldownMs: number;
  private syncStartMs?: number;
  private syncOriginX = 0;
  private syncOriginY = 0;
  private synced = false;
  private lostSinceMs?: number;
  private lastTimestampMs?: number;
  private frozenPosition?: { x: number; y: number };
  private lastFreePosition?: { x: number; y: number };
  private backSinceMs?: number;
  private fistActive = false;
  private pinchNeedsRelease = false;
  private lastPinchClickAt = Number.NEGATIVE_INFINITY;

  constructor(options: HandCursorOptions = {}) {
    this.activeZone = { ...(options.activeZone ?? DEFAULT_ZONE) };
    if (!validZone(this.activeZone)) throw new Error('Hand cursor active zone must be inside 0..1 with min < max');
    this.syncDurationMs = options.syncDurationMs ?? 1000;
    this.syncTolerance = options.syncTolerance ?? 0.04;
    this.maxFrameGapMs = options.maxFrameGapMs ?? 250;
    this.lossGraceMs = options.lossGraceMs ?? 750;
    this.pointerAnchor = options.pointerAnchor ?? 'midIndex';
    this.backHoldMs = options.backHoldMs ?? 500;
    this.fistEnterStraightness = options.fistEnterStraightness ?? 0.65;
    this.fistReleaseStraightness = options.fistReleaseStraightness ?? 0.8;
    if (this.fistEnterStraightness >= this.fistReleaseStraightness)
      throw new Error('Fist enter straightness must be below release straightness');
    const pinchOnRatio = options.pinchOnRatio ?? 0.38;
    const pinchOffRatio = options.pinchOffRatio ?? 0.55;
    if (pinchOnRatio >= pinchOffRatio) throw new Error('Pinch on-ratio must be below the off-ratio');
    this.pinchOffRatio = pinchOffRatio;
    this.pinchCooldownMs = options.pinchCooldownMs ?? 250;
    this.pinch = new SchmittTrigger(1 - pinchOnRatio, 1 - pinchOffRatio);
    this.xFilter = new OneEuroFilter(options.smoothing);
    this.yFilter = new OneEuroFilter(options.smoothing);
  }

  update(snapshot: HandSnapshot): HandCursorState {
    const aspectY = snapshot.aspectY ?? 1;
    const present = usableHand(snapshot.landmarks, aspectY);
    if (!present) return this.missing(snapshot.timestampMs);

    const points = snapshot.landmarks;
    const timestampMs = snapshot.timestampMs;
    if (this.lostSinceMs !== undefined && timestampMs - this.lostSinceMs >= this.lossGraceMs) {
      this.synced = false;
      this.syncStartMs = undefined;
    }
    const raw = this.pointer(points);
    const gap = this.lastTimestampMs === undefined ? 0 : timestampMs - this.lastTimestampMs;
    const brokenTimeline = this.lastTimestampMs !== undefined && (gap < 0 || gap > this.maxFrameGapMs);
    if (brokenTimeline) {
      this.xFilter.reset();
      this.yFilter.reset();
      if (!this.synced) this.syncStartMs = undefined;
      this.lastFreePosition = undefined;
    }
    this.lastTimestampMs = timestampMs;
    this.lostSinceMs = undefined;

    if (!this.synced) this.updateSync(raw, timestampMs, aspectY);

    const mapped = this.mapToScreen(raw);
    const smoothX = this.xFilter.filter(mapped.x, timestampMs);
    const smoothY = this.yFilter.filter(mapped.y, timestampMs);

    let pinching = false;
    let pinchRelease = false;
    let backProgress = 0;
    let fist = false;
    if (this.synced) {
      const updatePinch = () => {
        const ratio = pinchRatio(points, aspectY);
        if (this.pinchNeedsRelease) {
          this.pinch.resetActive();
          if (ratio >= this.pinchOffRatio) this.pinchNeedsRelease = false;
        } else {
          const pinchStarted = this.pinch.update(1 - ratio, timestampMs);
          pinching = this.pinch.isActive;
          if (pinchStarted && timestampMs - this.lastPinchClickAt >= this.pinchCooldownMs) {
            this.lastPinchClickAt = timestampMs;
            pinchRelease = true;
          }
        }
      };
      if (this.fistActive) {
        this.fistActive = closedFist(points, true, this.fistEnterStraightness, this.fistReleaseStraightness, aspectY);
        fist = this.fistActive;
        if (fist) {
          this.pinch.resetActive();
          this.pinchNeedsRelease = true;
          this.backSinceMs ??= timestampMs;
          backProgress = clamp((timestampMs - this.backSinceMs) / this.backHoldMs);
        } else {
          this.backSinceMs = undefined;
          updatePinch();
        }
      } else {
        updatePinch();
        this.backSinceMs = undefined;
        if (!pinching) {
          this.fistActive = closedFist(
            points,
            false,
            this.fistEnterStraightness,
            this.fistReleaseStraightness,
            aspectY,
          );
          fist = this.fistActive;
          if (fist) {
            this.pinch.resetActive();
            this.pinchNeedsRelease = true;
            this.backSinceMs = timestampMs;
          }
        }
      }
    } else {
      this.pinch.resetActive();
      this.pinchNeedsRelease = true;
      this.backSinceMs = undefined;
      this.fistActive = false;
    }

    if (pinching || fist) this.frozenPosition ??= this.lastFreePosition ?? { x: smoothX, y: smoothY };
    else this.frozenPosition = undefined;
    const position = this.frozenPosition ?? { x: smoothX, y: smoothY };
    if (!pinching && !fist) this.lastFreePosition = { x: smoothX, y: smoothY };
    return {
      visible: true,
      x: position.x,
      y: position.y,
      syncProgress: this.synced ? 1 : this.syncProgress(timestampMs),
      synced: this.synced,
      pinching,
      pinchRelease,
      backProgress,
      activeZone: { ...this.activeZone },
    };
  }

  reset(): void {
    this.synced = false;
    this.syncStartMs = undefined;
    this.lostSinceMs = undefined;
    this.lastTimestampMs = undefined;
    this.frozenPosition = undefined;
    this.lastFreePosition = undefined;
    this.backSinceMs = undefined;
    this.fistActive = false;
    this.pinchNeedsRelease = false;
    this.lastPinchClickAt = Number.NEGATIVE_INFINITY;
    this.xFilter.reset();
    this.yFilter.reset();
    this.pinch.reset();
  }

  private missing(timestampMs: number): HandCursorState {
    if (!this.synced) {
      this.syncStartMs = undefined;
    } else {
      this.lostSinceMs ??= timestampMs;
      if (timestampMs - this.lostSinceMs >= this.lossGraceMs) {
        this.synced = false;
        this.syncStartMs = undefined;
      }
    }
    this.xFilter.reset();
    this.yFilter.reset();
    this.pinch.resetActive();
    this.pinchNeedsRelease = true;
    this.frozenPosition = undefined;
    this.lastFreePosition = undefined;
    this.backSinceMs = undefined;
    this.fistActive = false;
    return {
      visible: false,
      x: 0,
      y: 0,
      syncProgress: this.synced ? 1 : 0,
      synced: this.synced,
      pinching: false,
      pinchRelease: false,
      backProgress: 0,
      activeZone: { ...this.activeZone },
    };
  }

  private pointer(points: readonly Point3[]): { x: number; y: number } {
    const tip = points[INDEX_TIP]!;
    const base = points[INDEX_MCP]!;
    const cameraX = this.pointerAnchor === 'tip' ? tip.x : (tip.x + base.x) / 2;
    const cameraY = this.pointerAnchor === 'tip' ? tip.y : (tip.y + base.y) / 2;
    return { x: 1 - cameraX, y: cameraY };
  }

  private mapToScreen(point: { x: number; y: number }): { x: number; y: number } {
    return {
      x: clamp((point.x - this.activeZone.minX) / (this.activeZone.maxX - this.activeZone.minX)),
      y: clamp((point.y - this.activeZone.minY) / (this.activeZone.maxY - this.activeZone.minY)),
    };
  }

  private updateSync(point: { x: number; y: number }, timestampMs: number, aspectY: number): void {
    if (this.syncStartMs === undefined) {
      this.syncStartMs = timestampMs;
      this.syncOriginX = point.x;
      this.syncOriginY = point.y;
      return;
    }
    if (Math.hypot(point.x - this.syncOriginX, (point.y - this.syncOriginY) * aspectY) > this.syncTolerance) {
      this.syncStartMs = timestampMs;
      this.syncOriginX = point.x;
      this.syncOriginY = point.y;
      return;
    }
    if (timestampMs - this.syncStartMs >= this.syncDurationMs) this.synced = true;
  }

  private syncProgress(timestampMs: number): number {
    if (this.syncStartMs === undefined) return 0;
    return clamp((timestampMs - this.syncStartMs) / this.syncDurationMs);
  }
}

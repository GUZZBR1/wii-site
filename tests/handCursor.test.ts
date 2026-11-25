import { describe, expect, it } from 'vitest';
import { HandCursorDetector } from '../src/arena/kinematics/handCursor';
import { emptyHand, hand } from './fixtures/syntheticHand';

function synched(detector = new HandCursorDetector()) {
  for (let time = 0; time <= 1000; time += 100) detector.update(hand(time));
  return detector;
}

function syncedForGestureTiming() {
  return synched(new HandCursorDetector({ maxFrameGapMs: 1000 }));
}

function pinchSeries(detector: HandCursorDetector, frames: readonly [time: number, ratio: number][]) {
  return frames.map(([time, ratio]) => detector.update(hand(time, { pinchRatio: ratio })));
}

describe('hand cursor synchronization and active zone', () => {
  it('mirrors x and maps the whole camera frame to the whole screen', () => {
    const leftImage = new HandCursorDetector().update(hand(0, { tipX: 0.2, tipY: 0.5 }));
    const rightImage = new HandCursorDetector().update(hand(0, { tipX: 0.8, tipY: 0.5 }));
    expect(leftImage.x).toBeCloseTo(0.8);
    expect(rightImage.x).toBeCloseTo(0.2);
    expect(leftImage.y).toBeCloseTo(0.5);
    expect(rightImage.y).toBeCloseTo(0.5);
  });

  it('clamps positions outside the camera frame instead of leaving the screen', () => {
    expect(new HandCursorDetector().update(hand(0, { tipX: 1.2, tipY: -0.2 }))).toMatchObject({ x: 0, y: 0 });
    expect(new HandCursorDetector().update(hand(0, { tipX: -0.2, tipY: 1.2 }))).toMatchObject({ x: 1, y: 1 });
  });

  it('syncs after 200ms of hand presence without requiring the hand to stay still', () => {
    const detector = new HandCursorDetector();
    const states = [
      detector.update(hand(0, { tipX: 0.3 })),
      detector.update(hand(100, { tipX: 0.5 })),
      detector.update(hand(200, { tipX: 0.7 })),
    ];
    expect(states[0]).toMatchObject({ syncProgress: 0, synced: false, visible: true });
    expect(states[1]).toMatchObject({ syncProgress: 0.5, synced: false, visible: true });
    expect(states[2]).toMatchObject({ syncProgress: 1, synced: true, visible: true });
  });

  it('keeps the active zone covering the whole camera after synchronization', () => {
    const detector = new HandCursorDetector();
    let completed = detector.update(hand(0, { tipX: 0.9, tipY: 0.8 }));
    for (let time = 100; time <= 300; time += 100) completed = detector.update(hand(time, { tipX: 0.9, tipY: 0.8 }));
    expect(completed).toMatchObject({
      synced: true,
      activeZone: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
    });
    expect(completed.x).toBeCloseTo(0.1);
    expect(completed.y).toBeCloseTo(0.8);
  });

  it('accumulates presence across brief detection gaps', () => {
    const detector = new HandCursorDetector();
    detector.update(hand(0));
    detector.update(hand(100));
    detector.update(emptyHand(150));
    expect(detector.update(hand(200))).toMatchObject({ synced: true, visible: true });
  });

  it('caps long observation gaps instead of counting time with no observed hand', () => {
    const detector = new HandCursorDetector();
    detector.update(hand(0));
    expect(detector.update(hand(1000))).toMatchObject({ syncProgress: 0.5, synced: false });
    expect(detector.update(hand(1100))).toMatchObject({ synced: true });
  });

  it('keeps the cursor visible at the last position through a brief loss', () => {
    const detector = synched();
    const before = detector.update(hand(1100, { tipX: 0.4, tipY: 0.4 }));
    expect(before.synced).toBe(true);
    expect(detector.update(emptyHand(1200))).toMatchObject({ visible: true, synced: true, x: before.x, y: before.y });
    const reacquired = detector.update(hand(1450, { tipX: 0.7, tipY: 0.7 }));
    expect(reacquired).toMatchObject({ visible: true, synced: true });
    expect(reacquired.x).toBeCloseTo(0.3);
    expect(reacquired.y).toBeCloseTo(0.7);
  });

  it('requires synchronization again after a long loss', () => {
    const detector = synched();
    expect(detector.update(emptyHand(1100)).synced).toBe(true);
    expect(detector.update(emptyHand(1850)).synced).toBe(false);
    expect(detector.update(hand(1900))).toMatchObject({ synced: false, syncProgress: 0 });
  });

  it('expires the loss grace even when reacquisition is the next frame after one empty snapshot', () => {
    const detector = synched();
    expect(detector.update(emptyHand(1100))).toMatchObject({ visible: true, synced: true });
    const reacquired = detector.update(hand(2000));
    expect(reacquired).toMatchObject({ visible: true, synced: false, syncProgress: 0 });
  });

  it('does not reuse a stale frozen position after a long tracking loss', () => {
    const detector = synched();
    const oldPosition = detector.update(hand(1100, { tipX: 0.4, tipY: 0.4 }));
    detector.update(emptyHand(1200));
    detector.update(hand(2000, { tipX: 0.8, tipY: 0.8, pinchRatio: 0.8 }));
    detector.update(hand(2100, { tipX: 0.8, tipY: 0.8, pinchRatio: 0.8 }));
    detector.update(hand(2200, { tipX: 0.8, tipY: 0.8, pinchRatio: 0.8 }));
    detector.update(hand(2300, { tipX: 0.8, tipY: 0.8, pinchRatio: 0.2 }));
    const click = detector.update(hand(2400, { tipX: 0.8, tipY: 0.8, pinchRatio: 0.2 }));
    expect(click.pinchRelease).toBe(true);
    expect(click.x).not.toBeCloseTo(oldPosition.x);
    expect(click.x).toBeLessThan(0.4);
  });

  it('synchronizes at equivalent times across frame rates', () => {
    const syncTimes = [16, 33, 66].map((step) => {
      const detector = new HandCursorDetector();
      for (let time = 0; time <= 500; time += step) {
        if (detector.update(hand(time)).synced) return time;
      }
      throw new Error('hand did not synchronize');
    });
    expect(Math.max(...syncTimes) - Math.min(...syncTimes)).toBeLessThanOrEqual(70);
  });
});

describe('hand cursor smoothing', () => {
  it('attenuates alternating fingertip jitter without leaving the active zone', () => {
    const detector = synched();
    const outputs = [];
    for (let index = 0; index < 12; index++) {
      const dx = index % 2 === 0 ? 0.02 : -0.02;
      outputs.push(detector.update(hand(1100 + index * 33, { dx })));
    }
    const xs = outputs.map((state) => state.x);
    const inputSpread = 0.04;
    const outputSpread = Math.max(...xs) - Math.min(...xs);
    expect(outputSpread).toBeLessThan(inputSpread * 0.45);
    expect(outputs.every((state) => state.x >= 0 && state.x <= 1)).toBe(true);
  });

  it('remains responsive to a deliberate step movement', () => {
    const detector = synched();
    const start = detector.update(hand(1100, { tipX: 0.5 })).x;
    let latest = start;
    for (let time = 1133; time <= 1800; time += 33) latest = detector.update(hand(time, { tipX: 0.7 })).x;
    const target = 1 - 0.7;
    const initialDistance = Math.abs(target - start);
    const remainingDistance = Math.abs(target - latest);
    expect(remainingDistance).toBeLessThan(initialDistance * 0.35);
  });
});

describe('hand cursor pinch click', () => {
  it('suppresses pinch and back gestures before synchronization', () => {
    const detector = new HandCursorDetector();
    const pinched = detector.update(hand(0, { pinchRatio: 0.2 }));
    const fist = detector.update(hand(100, { curl: 1, pinchRatio: 0.2 }));
    expect(pinched).toMatchObject({ pinching: false, pinchRelease: false });
    expect(fist).toMatchObject({ backProgress: 0, pinchRelease: false });
  });

  it('ignores a one-frame pinch blip instead of clicking on noise', () => {
    const detector = synched();
    detector.update(hand(1100, { pinchRatio: 0.8 }));
    expect(detector.update(hand(1200, { pinchRatio: 0.2 }))).toMatchObject({ pinching: false, pinchRelease: false });
    detector.update(hand(1300, { pinchRatio: 0.8 }));
    detector.update(hand(1400, { pinchRatio: 0.2 }));
    expect(detector.update(hand(1500, { pinchRatio: 0.2 }))).toMatchObject({ pinching: true, pinchRelease: true });
  });

  it('fires once through the hysteresis cycle and freezes the cursor while pinching', () => {
    const detector = syncedForGestureTiming();
    const target = detector.update(hand(1100, { tipX: 0.4, tipY: 0.4, pinchRatio: 0.8 }));
    detector.update(hand(1150, { tipX: 0.4, tipY: 0.4, pinchRatio: 0.2 }));
    const press = detector.update(hand(1250, { tipX: 0.4, tipY: 0.4, pinchRatio: 0.2 }));
    expect(press).toMatchObject({ pinching: true, pinchRelease: true, x: target.x, y: target.y });
    const held = detector.update(hand(1250, { tipX: 0.7, tipY: 0.7, pinchRatio: 0.35 }));
    expect(held).toMatchObject({ pinching: true, pinchRelease: false, x: target.x, y: target.y });
    const released = detector.update(hand(1300, { tipX: 0.7, tipY: 0.7, pinchRatio: 0.6 }));
    expect(released).toMatchObject({ pinching: false, pinchRelease: false });
    expect(released.x).not.toBeCloseTo(target.x);
  });

  it('keeps the click cooldown and re-arm requirement across a tracking-loss frame', () => {
    const detector = synched();
    detector.update(hand(1100, { pinchRatio: 0.8 }));
    detector.update(hand(1150, { pinchRatio: 0.2 }));
    expect(detector.update(hand(1250, { pinchRatio: 0.2 })).pinchRelease).toBe(true);
    detector.update(hand(1230, { pinchRatio: 0.6 }));
    detector.update(emptyHand(1260));
    expect(detector.update(hand(1290, { pinchRatio: 0.2 }))).toMatchObject({ pinching: false, pinchRelease: false });
    detector.update(hand(1320, { pinchRatio: 0.6 }));
    detector.update(hand(1360, { pinchRatio: 0.2 }));
    expect(detector.update(hand(1460, { pinchRatio: 0.2 })).pinchRelease).toBe(false);
    detector.update(hand(1490, { pinchRatio: 0.6 }));
    detector.update(hand(1530, { pinchRatio: 0.2 }));
    expect(detector.update(hand(1630, { pinchRatio: 0.2 })).pinchRelease).toBe(true);
  });

  it('enforces the click cooldown between presses', () => {
    const detector = synched();
    const states = pinchSeries(detector, [
      [1100, 0.8],
      [1150, 0.2],
      [1250, 0.2],
      [1300, 0.6],
      [1350, 0.2],
      [1400, 0.2],
      [1450, 0.6],
      [1500, 0.2],
      [1600, 0.2],
    ]);
    expect(states.map((state) => state.pinchRelease)).toEqual([false, false, true, false, false, false, false, false, true]);
  });

  it('aspect-corrects vertical geometry instead of assuming square normalized coordinates', () => {
    const square = synched();
    square.update(hand(1100, { pinchRatio: 0.8 }));
    square.update(hand(1150, { pinchRatio: 0.24 }));
    expect(square.update(hand(1250, { pinchRatio: 0.24 })).pinchRelease).toBe(true);

    const wide = synched();
    wide.update(hand(1100, { pinchRatio: 0.8 }));
    wide.update({ ...hand(1150, { pinchRatio: 0.24 }), aspectY: 0.75 });
    expect(wide.update({ ...hand(1250, { pinchRatio: 0.24 }), aspectY: 0.75 }).pinchRelease).toBe(false);
  });

  it('keeps the same pinch threshold invariant across hand scales', () => {
    for (const scale of [0.05, 0.1, 0.2]) {
      const detector = new HandCursorDetector();
      for (let time = 0; time <= 1000; time += 100) detector.update(hand(time, { scale, pinchRatio: 0.8 }));
      detector.update(hand(1100, { scale, pinchRatio: 0.2 }));
      expect(detector.update(hand(1200, { scale, pinchRatio: 0.2 })).pinchRelease).toBe(true);
    }
  });

  it('ignores degenerate hand scale without producing NaN or a click', () => {
    const detector = synched();
    const state = detector.update(hand(1100, { pinchRatio: 0.2, scale: 0 }));
    expect(state.pinchRelease).toBe(false);
    expect(Number.isFinite(state.x)).toBe(true);
    expect(Number.isFinite(state.y)).toBe(true);
  });
});

describe('hand cursor integrated gesture session', () => {
  it('syncs, clicks once at the frozen target, then completes a back gesture', () => {
    const detector = syncedForGestureTiming();
    const target = detector.update(hand(1100, { tipX: 0.4, tipY: 0.4, pinchRatio: 0.8 }));
    detector.update(hand(1150, { tipX: 0.4, tipY: 0.4, pinchRatio: 0.2 }));
    const clickStates = [
      detector.update(hand(1250, { tipX: 0.4, tipY: 0.4, pinchRatio: 0.2 })),
      detector.update(hand(1300, { tipX: 0.65, tipY: 0.65, pinchRatio: 0.35 })),
      detector.update(hand(1350, { tipX: 0.65, tipY: 0.65, pinchRatio: 0.7 })),
    ];
    expect(clickStates.map((state) => state.pinchRelease)).toEqual([true, false, false]);
    expect(clickStates[0]).toMatchObject({ x: target.x, y: target.y });
    expect(clickStates[1]).toMatchObject({ x: target.x, y: target.y });

    detector.update(hand(1400, { curl: 1 }));
    expect(detector.update(hand(1900, { curl: 1 }))).toMatchObject({
      backProgress: 1,
      pinchRelease: false,
      pinching: false,
    });
  });
});

describe('hand cursor closed-fist back gesture', () => {
  it('ramps progress while the fist is held and resets when the hand opens', () => {
    const detector = syncedForGestureTiming();
    expect(detector.update(hand(1100, { curl: 1 })).backProgress).toBe(0);
    expect(detector.update(hand(1300, { curl: 1 })).backProgress).toBeCloseTo(0.4);
    expect(detector.update(hand(1600, { curl: 1 })).backProgress).toBe(1);
    expect(detector.update(hand(1700, { curl: 1 })).backProgress).toBe(1);
    expect(detector.update(hand(1800, { curl: 0 })).backProgress).toBe(0);
  });

  it('tolerates a partial geometric flicker but releases when the hand fully opens', () => {
    const detector = syncedForGestureTiming();
    detector.update(hand(1100, { curl: 1 }));
    expect(detector.update(hand(1200, { curl: 1 })).backProgress).toBeCloseTo(0.2);
    expect(detector.update(hand(1300, { curl: 0.55 })).backProgress).toBeCloseTo(0.4);
    expect(detector.update(hand(1400, { curl: 1 })).backProgress).toBeCloseTo(0.6);
    expect(detector.update(hand(1500, { curl: 0 })).backProgress).toBe(0);
  });

  it('resets progress when the fist is interrupted before completion', () => {
    const detector = syncedForGestureTiming();
    detector.update(hand(1100, { curl: 1 }));
    expect(detector.update(hand(1300, { curl: 1 })).backProgress).toBeCloseTo(0.4);
    expect(detector.update(hand(1400, { curl: 0 })).backProgress).toBe(0);
    expect(detector.update(hand(1500, { curl: 1 })).backProgress).toBe(0);
  });

  it('keeps active gestures dominant and treats simultaneous new pinch-plus-fist geometry as a fist', () => {
    const fistFirst = syncedForGestureTiming();
    fistFirst.update(hand(1100, { curl: 1 }));
    const held = fistFirst.update(hand(1200, { curl: 1, pinchRatio: 0.1 }));
    expect(held).toMatchObject({ pinching: false, pinchRelease: false });
    expect(fistFirst.update(hand(1600, { curl: 1, pinchRatio: 0.1 })).backProgress).toBe(1);

    const pinchFirst = syncedForGestureTiming();
    pinchFirst.update(hand(1100, { pinchRatio: 0.8 }));
    pinchFirst.update(hand(1150, { pinchRatio: 0.2 }));
    expect(pinchFirst.update(hand(1250, { pinchRatio: 0.2 })).pinchRelease).toBe(true);
    expect(pinchFirst.update(hand(1350, { curl: 1, pinchRatio: 0.1 }))).toMatchObject({
      pinching: true,
      backProgress: 0,
    });

    const neutral = syncedForGestureTiming();
    const ambiguous = neutral.update(hand(1100, { curl: 1, pinchRatio: 0.1 }));
    expect(ambiguous).toMatchObject({ pinching: false, pinchRelease: false, backProgress: 0 });
    expect(neutral.update(hand(1600, { curl: 1, pinchRatio: 0.1 })).backProgress).toBe(1);
  });

  it('cancels and rearms an incomplete back gesture across a long observation gap', () => {
    const detector = synched();
    detector.update(hand(1100, { curl: 1 }));
    expect(detector.update(hand(1500, { curl: 1 })).backProgress).toBe(0);
    detector.update(hand(1600, { curl: 0 }));
    detector.update(hand(1700, { curl: 1 }));
    for (const time of [1800, 1900, 2000, 2100]) detector.update(hand(time, { curl: 1 }));
    expect(detector.update(hand(2200, { curl: 1 })).backProgress).toBe(1);
  });

  it('does not start the back gesture when the hand was already closed during synchronization', () => {
    const detector = new HandCursorDetector({ maxFrameGapMs: 1000 });
    for (let time = 0; time <= 1000; time += 100) detector.update(hand(time, { curl: 1 }));
    expect(detector.update(hand(1100, { curl: 1 })).backProgress).toBe(0);
    expect(detector.update(hand(1600, { curl: 1 })).backProgress).toBe(0);

    detector.update(hand(1700, { curl: 0 }));
    expect(detector.update(hand(1800, { curl: 1 })).backProgress).toBe(0);
    expect(detector.update(hand(2300, { curl: 1 })).backProgress).toBe(1);
  });

  it('freezes the cursor while the fist progress is being held', () => {
    const detector = syncedForGestureTiming();
    const before = detector.update(hand(1100, { tipX: 0.4, tipY: 0.4 }));
    const held = detector.update(hand(1200, { tipX: 0.7, tipY: 0.7, curl: 1 }));
    expect(held).toMatchObject({ x: before.x, y: before.y, backProgress: 0 });
  });
});

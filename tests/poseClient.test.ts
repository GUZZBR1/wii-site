import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Point3, WorkerReply, WorkerRequest } from '../src/cv/protocol';
import { PoseClient } from '../src/cv/poseClient';

class FakeWorker {
  static instance: FakeWorker | undefined;
  onmessage: ((event: MessageEvent<WorkerReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly sent: WorkerRequest[] = [];
  readonly transfers: Transferable[][] = [];
  throwOnNextFrame = false;

  constructor(_url: URL, _options: WorkerOptions) {
    FakeWorker.instance = this;
  }

  postMessage(message: WorkerRequest, transfer: Transferable[] = []): void {
    if (message.type === 'FRAME' && this.throwOnNextFrame) {
      this.throwOnNextFrame = false;
      throw new Error('DataCloneError');
    }
    this.sent.push(message);
    this.transfers.push(transfer);
    if (message.type === 'INIT') {
      queueMicrotask(() =>
        this.onmessage?.({
          data: { type: 'READY', mode: message.mode, delegate: message.delegate },
        } as MessageEvent<WorkerReply>),
      );
    }
  }

  terminate(): void {}

  reply(message: WorkerReply): void {
    this.onmessage?.({ data: message } as MessageEvent<WorkerReply>);
  }
}

function makeVideo(): HTMLVideoElement & { fireFrame(now: number): void } {
  let nextId = 0;
  let callback: ((now: number, metadata: VideoFrameCallbackMetadata) => void) | undefined;
  return {
    readyState: HTMLMediaElement.HAVE_CURRENT_DATA,
    requestVideoFrameCallback: (nextCallback: (now: number, metadata: VideoFrameCallbackMetadata) => void) => {
      callback = nextCallback;
      return ++nextId;
    },
    cancelVideoFrameCallback: () => {
      callback = undefined;
    },
    fireFrame(now: number) {
      const frameCallback = callback;
      callback = undefined;
      frameCallback?.(now, {} as VideoFrameCallbackMetadata);
    },
  } as unknown as HTMLVideoElement & { fireFrame(now: number): void };
}

function visibleLandmarks(): Point3[] {
  return Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
}

function visibleHandLandmarks(): Point3[] {
  return Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
}

async function flushCapture(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('PoseClient capture sessions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    FakeWorker.instance = undefined;
  });

  it('discards an old pose after restart and releases backpressure for the new session', async () => {
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('location', { origin: 'http://localhost' });
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal('HTMLMediaElement', { HAVE_CURRENT_DATA: 2 });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    );

    const client = new PoseClient();
    const oldOnPose = vi.fn();
    const newOnPose = vi.fn();
    const onStatus = vi.fn();
    await client.init({ onPose: oldOnPose, onStatus });
    const worker = FakeWorker.instance!;
    const video = makeVideo();

    client.beginCapture(video, { onPose: oldOnPose, onStatus });
    video.fireFrame(10);
    await flushCapture();
    const oldFrame = worker.sent.find((message) => message.type === 'FRAME');
    expect(oldFrame?.type).toBe('FRAME');
    if (oldFrame?.type !== 'FRAME') throw new Error('Expected an old-session frame');
    video.fireFrame(15);
    await flushCapture();
    expect(worker.sent.filter((message) => message.type === 'FRAME')).toHaveLength(1);

    client.pauseCapture();
    client.beginCapture(video, { onPose: newOnPose, onStatus });
    worker.reply({
      type: 'POSE',
      requestId: oldFrame.requestId,
      captureEpoch: oldFrame.captureEpoch,
      timestampMs: 10,
      landmarks: visibleLandmarks(),
      worldLandmarks: visibleLandmarks(),
    });

    expect(oldOnPose).not.toHaveBeenCalled();
    expect(newOnPose).not.toHaveBeenCalled();

    video.fireFrame(20);
    await flushCapture();
    const frames = worker.sent.filter((message) => message.type === 'FRAME');
    const newFrame = frames.at(-1);
    expect(newFrame?.type).toBe('FRAME');
    if (newFrame?.type !== 'FRAME') throw new Error('Expected a new-session frame');
    expect(newFrame.captureEpoch).toBeGreaterThan(oldFrame.captureEpoch);
    expect(newFrame.requestId).toBeGreaterThan(oldFrame.requestId);
    expect(worker.transfers.at(-1)).toEqual([bitmap]);

    const poseReply = {
      type: 'POSE' as const,
      requestId: newFrame.requestId,
      captureEpoch: newFrame.captureEpoch,
      timestampMs: 20,
      landmarks: visibleLandmarks(),
      worldLandmarks: visibleLandmarks(),
    };
    worker.reply({ ...poseReply, requestId: poseReply.requestId + 1 });
    expect(newOnPose).not.toHaveBeenCalled();
    worker.reply(poseReply);
    worker.reply(poseReply);
    expect(newOnPose).toHaveBeenCalledOnce();
    expect(newOnPose).toHaveBeenCalledWith({
      timestampMs: 20,
      landmarks: visibleLandmarks(),
      worldLandmarks: visibleLandmarks(),
      trackingState: 'degraded',
      bodyConfidence: 1,
    });

    client.dispose();
  });

  it('releases the pending frame on a non-fatal error from the old session without notifying the new one', async () => {
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('location', { origin: 'http://localhost' });
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal('HTMLMediaElement', { HAVE_CURRENT_DATA: 2 });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    );

    const client = new PoseClient();
    const onStatus = vi.fn();
    await client.init({ onPose: vi.fn(), onStatus });
    const worker = FakeWorker.instance!;
    const video = makeVideo();

    client.beginCapture(video, { onPose: vi.fn(), onStatus });
    video.fireFrame(10);
    await flushCapture();
    const oldFrame = worker.sent.find((message) => message.type === 'FRAME');
    if (oldFrame?.type !== 'FRAME') throw new Error('Expected an old-session frame');

    client.pauseCapture();
    client.beginCapture(video, { onPose: vi.fn(), onStatus });
    onStatus.mockClear();
    video.fireFrame(15);
    await flushCapture();
    expect(worker.sent.filter((message) => message.type === 'FRAME')).toHaveLength(1);

    worker.reply({
      type: 'ERROR',
      stage: 'detect',
      fatal: false,
      requestId: oldFrame.requestId,
      captureEpoch: oldFrame.captureEpoch,
      message: 'GPU falhou; próxima captura será processada em CPU.',
    });
    expect(onStatus).not.toHaveBeenCalled();

    video.fireFrame(20);
    await flushCapture();
    const newFrame = worker.sent.filter((message) => message.type === 'FRAME').at(-1);
    if (newFrame?.type !== 'FRAME') throw new Error('Expected a new-session frame');
    expect(newFrame.captureEpoch).toBeGreaterThan(oldFrame.captureEpoch);

    worker.reply({
      type: 'ERROR',
      stage: 'detect',
      fatal: false,
      requestId: newFrame.requestId + 1,
      captureEpoch: newFrame.captureEpoch,
      message: 'Erro de outro quadro.',
    });
    video.fireFrame(25);
    await flushCapture();
    expect(onStatus).not.toHaveBeenCalled();
    expect(worker.sent.filter((message) => message.type === 'FRAME')).toHaveLength(2);

    worker.reply({
      type: 'ERROR',
      stage: 'detect',
      fatal: false,
      requestId: newFrame.requestId,
      captureEpoch: newFrame.captureEpoch,
      message: 'GPU falhou; próxima captura será processada em CPU.',
    });
    expect(onStatus).toHaveBeenCalledWith('fallback', 'GPU falhou; próxima captura será processada em CPU.');
    video.fireFrame(30);
    await flushCapture();
    expect(worker.sent.filter((message) => message.type === 'FRAME')).toHaveLength(3);

    client.dispose();
  });

  it('closes a bitmap created for a session that ended before the async copy finished', async () => {
    let resolveBitmap: ((value: ImageBitmap) => void) | undefined;
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('location', { origin: 'http://localhost' });
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal('HTMLMediaElement', { HAVE_CURRENT_DATA: 2 });
    vi.stubGlobal(
      'createImageBitmap',
      () =>
        new Promise<ImageBitmap>((resolve) => {
          resolveBitmap = resolve;
        }),
    );

    const client = new PoseClient();
    const onPose = vi.fn();
    const onStatus = vi.fn();
    await client.init({ onPose, onStatus });
    const worker = FakeWorker.instance!;
    const video = makeVideo();

    client.beginCapture(video, { onPose, onStatus });
    video.fireFrame(10);
    client.pauseCapture();
    client.beginCapture(video, { onPose, onStatus });
    resolveBitmap?.(bitmap);
    await flushCapture();

    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(worker.sent.filter((message) => message.type === 'FRAME')).toHaveLength(0);

    client.dispose();
  });

  it('closes a bitmap if postMessage fails before transferring ownership', async () => {
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('location', { origin: 'http://localhost' });
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal('HTMLMediaElement', { HAVE_CURRENT_DATA: 2 });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    );

    const client = new PoseClient();
    const onStatus = vi.fn();
    await client.init({ onPose: vi.fn(), onStatus });
    const worker = FakeWorker.instance!;
    const video = makeVideo();
    worker.throwOnNextFrame = true;

    client.beginCapture(video, { onPose: vi.fn(), onStatus });
    video.fireFrame(10);
    await flushCapture();

    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(worker.sent.filter((message) => message.type === 'FRAME')).toHaveLength(0);

    client.dispose();
  });

  it('releases backpressure after an ImageBitmap copy rejects', async () => {
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    let copies = 0;
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('location', { origin: 'http://localhost' });
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal('HTMLMediaElement', { HAVE_CURRENT_DATA: 2 });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => {
        copies += 1;
        return copies === 1 ? Promise.reject(new Error('bitmap copy failed')) : Promise.resolve(bitmap);
      }),
    );

    const client = new PoseClient();
    const onStatus = vi.fn();
    await client.init({ onPose: vi.fn(), onStatus });
    const worker = FakeWorker.instance!;
    const video = makeVideo();
    client.beginCapture(video, { onPose: vi.fn(), onStatus });
    video.fireFrame(10);
    await flushCapture();

    expect(onStatus).toHaveBeenCalledWith('error', 'bitmap copy failed');
    video.fireFrame(20);
    await flushCapture();
    expect(worker.sent.filter((message) => message.type === 'FRAME')).toHaveLength(1);

    client.dispose();
  });

  it('closes a bitmap copied before a mode change instead of queueing it behind the transition', async () => {
    let resolveBitmap: ((value: ImageBitmap) => void) | undefined;
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('location', { origin: 'http://localhost' });
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal('HTMLMediaElement', { HAVE_CURRENT_DATA: 2 });
    vi.stubGlobal(
      'createImageBitmap',
      () =>
        new Promise<ImageBitmap>((resolve) => {
          resolveBitmap = resolve;
        }),
    );

    const client = new PoseClient();
    const onStatus = vi.fn();
    await client.init({ onPose: vi.fn(), onStatus });
    const worker = FakeWorker.instance!;
    const video = makeVideo();
    client.beginCapture(video, { onPose: vi.fn(), onStatus });
    video.fireFrame(10);
    await flushCapture();
    expect(worker.sent.filter((message) => message.type === 'FRAME')).toHaveLength(0);

    const switching = client.setMode('hand');
    await flushCapture();
    resolveBitmap?.(bitmap);
    await flushCapture();

    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(worker.sent.filter((message) => message.type === 'FRAME')).toHaveLength(0);

    worker.reply({ type: 'READY', mode: 'hand', delegate: 'GPU' });
    await switching;
    client.dispose();
  });

  it('does not queue frames while a mode change is pending', async () => {
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('location', { origin: 'http://localhost' });
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal('HTMLMediaElement', { HAVE_CURRENT_DATA: 2 });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    );

    const client = new PoseClient();
    const onStatus = vi.fn();
    await client.init({ onPose: vi.fn(), onStatus });
    const worker = FakeWorker.instance!;
    const video = makeVideo();
    client.beginCapture(video, { onPose: vi.fn(), onStatus });

    const switching = client.setMode('hand');
    await flushCapture();
    video.fireFrame(10);
    await flushCapture();
    expect(worker.sent.filter((message) => message.type === 'FRAME')).toHaveLength(0);

    worker.reply({ type: 'READY', mode: 'hand', delegate: 'GPU' });
    await switching;
    video.fireFrame(20);
    await flushCapture();
    expect(worker.sent.filter((message) => message.type === 'FRAME')).toHaveLength(1);

    client.dispose();
  });

  it('switches to hand mode without resetting the capture epoch and delivers hand snapshots', async () => {
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('location', { origin: 'http://localhost' });
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal('HTMLMediaElement', { HAVE_CURRENT_DATA: 2 });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    );

    const client = new PoseClient();
    const onPose = vi.fn();
    const onHand = vi.fn();
    const onStatus = vi.fn();
    await client.init({ onPose, onHand, onStatus });
    const worker = FakeWorker.instance!;
    const video = makeVideo();
    const initRequest = worker.sent.find((message) => message.type === 'INIT');
    expect(initRequest).toMatchObject({ type: 'INIT', mode: 'pose' });

    client.beginCapture(video, { onPose, onHand, onStatus });
    video.fireFrame(10);
    await flushCapture();
    const firstFrame = worker.sent.find((message) => message.type === 'FRAME');
    if (firstFrame?.type !== 'FRAME') throw new Error('Expected a pose frame');

    const switching = client.setMode('hand');
    await flushCapture();
    const modeRequest = worker.sent.find((message) => message.type === 'SET_MODE');
    expect(modeRequest).toMatchObject({ type: 'SET_MODE', mode: 'hand' });
    if (modeRequest?.type !== 'SET_MODE') throw new Error('Expected a hand mode request');
    expect(modeRequest.modelUrl).toContain('hand_landmarker.fbc2a300.task');

    worker.reply({
      type: 'POSE',
      requestId: firstFrame.requestId,
      captureEpoch: firstFrame.captureEpoch,
      timestampMs: 10,
      landmarks: visibleLandmarks(),
      worldLandmarks: visibleLandmarks(),
    });
    expect(onPose).not.toHaveBeenCalled();

    worker.reply({ type: 'READY', mode: 'hand', delegate: 'GPU' });
    await switching;
    video.fireFrame(20);
    await flushCapture();
    const frames = worker.sent.filter((message) => message.type === 'FRAME');
    const handFrame = frames.at(-1);
    if (handFrame?.type !== 'FRAME') throw new Error('Expected a hand frame');
    expect(frames).toHaveLength(2);
    expect(handFrame.captureEpoch).toBe(firstFrame.captureEpoch);
    expect(handFrame.requestId).toBeGreaterThan(firstFrame.requestId);

    worker.reply({
      type: 'HAND',
      requestId: handFrame.requestId,
      captureEpoch: handFrame.captureEpoch,
      timestampMs: 20,
      landmarks: visibleHandLandmarks(),
      handedness: 'Left',
      aspectY: 0.75,
    });
    expect(onHand).toHaveBeenCalledOnce();
    expect(onHand).toHaveBeenCalledWith({
      timestampMs: 20,
      landmarks: visibleHandLandmarks(),
      handedness: 'Left',
      aspectY: 0.75,
    });

    client.dispose();
  });

  it('releases an exact-ID reply from the wrong mode without invoking either callback', async () => {
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('location', { origin: 'http://localhost' });
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal('HTMLMediaElement', { HAVE_CURRENT_DATA: 2 });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    );

    const client = new PoseClient();
    const onPose = vi.fn();
    const onHand = vi.fn();
    const onStatus = vi.fn();
    await client.init({ onPose, onHand, onStatus });
    const worker = FakeWorker.instance!;
    const video = makeVideo();
    client.beginCapture(video, { onPose, onHand, onStatus });
    video.fireFrame(10);
    await flushCapture();
    const frame = worker.sent.find((message) => message.type === 'FRAME');
    if (frame?.type !== 'FRAME') throw new Error('Expected a frame');

    worker.reply({
      type: 'HAND',
      requestId: frame.requestId,
      captureEpoch: frame.captureEpoch,
      timestampMs: 10,
      landmarks: visibleHandLandmarks(),
      handedness: 'Right',
    });
    expect(onPose).not.toHaveBeenCalled();
    expect(onHand).not.toHaveBeenCalled();

    video.fireFrame(20);
    await flushCapture();
    expect(worker.sent.filter((message) => message.type === 'FRAME')).toHaveLength(2);

    client.dispose();
  });

  it('can initialize directly in hand mode without requesting the pose model', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('location', { origin: 'http://localhost' });
    vi.stubGlobal('window', { setTimeout, clearTimeout });

    const client = new PoseClient();
    await client.init({ onHand: vi.fn(), onStatus: vi.fn() }, 'GPU', 'hand');
    const worker = FakeWorker.instance!;
    const initRequest = worker.sent.find((message) => message.type === 'INIT');

    expect(initRequest).toMatchObject({ type: 'INIT', mode: 'hand' });
    if (initRequest?.type !== 'INIT') throw new Error('Expected a hand initialization');
    expect(initRequest.modelUrl).toContain('hand_landmarker.fbc2a300.task');
    expect(initRequest.modelUrl).not.toContain('pose_landmarker_lite');

    client.dispose();
  });

  it('serializes mode changes in request order', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('location', { origin: 'http://localhost' });
    vi.stubGlobal('window', { setTimeout, clearTimeout });

    const client = new PoseClient();
    await client.init({ onPose: vi.fn(), onStatus: vi.fn() });
    const worker = FakeWorker.instance!;

    const toHand = client.setMode('hand');
    const backToPose = client.setMode('pose');
    await flushCapture();
    let modeRequests = worker.sent.filter((message) => message.type === 'SET_MODE');
    expect(modeRequests).toHaveLength(1);
    expect(modeRequests[0]).toMatchObject({ mode: 'hand' });

    worker.reply({ type: 'READY', mode: 'hand', delegate: 'GPU' });
    await toHand;
    await flushCapture();
    modeRequests = worker.sent.filter((message) => message.type === 'SET_MODE');
    expect(modeRequests).toHaveLength(2);
    expect(modeRequests[1]).toMatchObject({ mode: 'pose' });

    worker.reply({ type: 'READY', mode: 'pose', delegate: 'GPU' });
    await backToPose;

    client.dispose();
  });

  it('rejects a pending mode change when the worker reports a fatal initialization error', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('location', { origin: 'http://localhost' });
    vi.stubGlobal('window', { setTimeout, clearTimeout });

    const client = new PoseClient();
    await client.init({ onPose: vi.fn(), onStatus: vi.fn() });
    const worker = FakeWorker.instance!;
    const switching = client.setMode('hand');
    await flushCapture();

    worker.reply({ type: 'ERROR', stage: 'init', fatal: true, message: 'modelo de mão ausente' });
    await expect(switching).rejects.toThrow('modelo de mão ausente');
    expect(client.isReady).toBe(false);
  });

  it('warms only the requested vision model asset', () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL) => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }) as Response,
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', { origin: 'http://localhost' });

    PoseClient.warmVisionAssets('hand');
    let urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.includes('hand_landmarker.fbc2a300.task'))).toBe(true);
    expect(urls.some((url) => url.includes('pose_landmarker_lite'))).toBe(false);
    expect(urls.filter((url) => url.includes('vision_wasm_module_internal'))).toHaveLength(2);

    fetchMock.mockClear();
    PoseClient.warmVisionAssets();
    urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.includes('pose_landmarker_lite.59929e1d.task'))).toBe(true);
    expect(urls.some((url) => url.includes('hand_landmarker'))).toBe(false);
  });
});

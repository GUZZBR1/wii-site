import type { Delegate, HandSnapshot, PoseSnapshot, VisionMode, WorkerReply, WorkerRequest } from './protocol';
import { HAND_MODEL_SHA8, MEDIAPIPE_WASM_VERSION, POSE_MODEL_SHA8 } from './mediapipeAssets';

export interface PoseClientCallbacks {
  onPose?(snapshot: PoseSnapshot): void;
  onHand?(snapshot: HandSnapshot): void;
  onStatus(status: 'loading' | 'ready' | 'fallback' | 'error', detail: string): void;
}

interface PendingModeChange {
  mode: VisionMode;
  resolve(): void;
  reject(error: Error): void;
  timeoutId: number;
}

function mediapipeAssetUrls() {
  const base = `${import.meta.env.BASE_URL}mediapipe`;
  const wasmBaseUrl = new URL(`${base}/wasm-${MEDIAPIPE_WASM_VERSION}`, location.origin).href;
  return {
    wasmBaseUrl,
    wasmModuleUrls: [
      `${wasmBaseUrl}/vision_wasm_module_internal.js`,
      `${wasmBaseUrl}/vision_wasm_module_internal.wasm`,
    ],
    modelUrls: {
      pose: new URL(`${base}/models/pose_landmarker_lite.${POSE_MODEL_SHA8}.task`, location.origin).href,
      hand: new URL(`${base}/models/hand_landmarker.${HAND_MODEL_SHA8}.task`, location.origin).href,
    } satisfies Record<VisionMode, string>,
  };
}

export class PoseClient {
  private worker?: Worker;
  private ready = false;
  private activeDelegate?: Delegate;
  private activeMode?: VisionMode;
  private desiredMode: VisionMode = 'pose';
  private initPromise?: Promise<void>;
  private modeChangeQueue: Promise<void> = Promise.resolve();
  private pendingModeChange?: PendingModeChange;
  private inFlight?: { requestId: number; captureEpoch: number };
  private nextRequestId = 1;
  private captureEpoch = 0;
  private capturing = false;
  private lastTimestamp = 0;
  private callbackId?: number;
  private rafId?: number;
  private lastVideoTime = -1;
  private video?: HTMLVideoElement;
  private callbacks?: PoseClientCallbacks;
  private resolveInitialization?: () => void;
  private rejectInitialization?: (error: Error) => void;

  static warmVisionAssets(mode: VisionMode = 'pose'): void {
    const { wasmModuleUrls, modelUrls } = mediapipeAssetUrls();
    for (const url of [...wasmModuleUrls, modelUrls[mode]]) {
      void fetch(url)
        .then((response) => (response.ok ? response.arrayBuffer() : undefined))
        .catch(() => undefined);
    }
  }

  get isReady(): boolean {
    return this.ready;
  }

  get delegate(): Delegate | undefined {
    return this.activeDelegate;
  }

  async init(
    callbacks: PoseClientCallbacks,
    preferred: Delegate = 'GPU',
    initialMode: VisionMode = 'pose',
  ): Promise<void> {
    this.callbacks = callbacks;
    if (this.ready) return;
    let initialization = this.initPromise;
    if (!initialization) {
      this.desiredMode = initialMode;
      initialization = this.spawn(preferred, initialMode);
      this.initPromise = initialization;
    }
    try {
      await initialization;
    } catch (error) {
      if (this.initPromise === initialization) this.initPromise = undefined;
      throw error;
    }
  }

  setMode(mode: VisionMode): Promise<void> {
    if (!this.worker || !this.ready)
      return Promise.reject(new Error('O MediaPipe ainda não está pronto para trocar de modo.'));
    this.desiredMode = mode;
    const change = this.modeChangeQueue.then(() => this.requestMode(mode));
    this.modeChangeQueue = change.catch(() => undefined);
    return change;
  }

  beginCapture(video: HTMLVideoElement, callbacks: PoseClientCallbacks): void {
    this.callbacks = callbacks;
    if (!this.worker || !this.ready || this.capturing) return;
    this.captureEpoch += 1;
    this.capturing = true;
    this.video = video;
    this.lastVideoTime = -1;
    this.callbacks?.onStatus('ready', `MediaPipe pronto · ${this.activeDelegate} · capturando`);
    const schedule = () => {
      if (!this.capturing) return;
      const supportsVideoFrameCallback =
        typeof (video as HTMLVideoElement & { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback ===
        'function';
      if (supportsVideoFrameCallback) {
        this.callbackId = video.requestVideoFrameCallback((now) => {
          schedule();
          void this.capture(video, now);
        });
      } else {
        this.rafId = requestAnimationFrame(() => {
          schedule();
          if (video.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = video.currentTime;
            void this.capture(video, performance.now());
          }
        });
      }
    };
    schedule();
  }

  pauseCapture(): void {
    this.capturing = false;
    if (this.callbackId !== undefined) this.video?.cancelVideoFrameCallback?.(this.callbackId);
    this.callbackId = undefined;
    if (this.rafId !== undefined) cancelAnimationFrame(this.rafId);
    this.rafId = undefined;
    this.video = undefined;
  }

  dispose(): void {
    this.pauseCapture();
    this.rejectModeChange(new Error('Cliente de visão encerrado.'));
    this.worker?.postMessage({ type: 'DISPOSE' } satisfies WorkerRequest);
    this.worker?.terminate();
    this.worker = undefined;
    this.ready = false;
    this.activeDelegate = undefined;
    this.activeMode = undefined;
    this.desiredMode = 'pose';
    this.inFlight = undefined;
    this.initPromise = undefined;
    this.modeChangeQueue = Promise.resolve();
    this.completeInitialization(new Error('Cliente de visão encerrado antes da inicialização concluir.'));
    this.callbacks = undefined;
  }

  private async requestMode(mode: VisionMode): Promise<void> {
    const worker = this.worker;
    if (!worker || !this.ready) throw new Error('O MediaPipe ainda não está pronto para trocar de modo.');
    if (this.activeMode === mode) return;
    const acknowledged = new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        const error = new Error('Troca de modo do MediaPipe excedeu 30 segundos.');
        this.rejectModeChange(error);
        this.callbacks?.onStatus('error', error.message);
        this.dispose();
      }, 30_000);
      this.pendingModeChange = { mode, resolve, reject, timeoutId };
    });
    try {
      worker.postMessage({
        type: 'SET_MODE',
        mode,
        modelUrl: mediapipeAssetUrls().modelUrls[mode],
      } satisfies WorkerRequest);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      this.rejectModeChange(failure);
      this.callbacks?.onStatus('error', failure.message);
      this.dispose();
      throw failure;
    }
    await acknowledged;
  }

  private completeModeChange(mode: VisionMode): boolean {
    const pending = this.pendingModeChange;
    if (!pending || pending.mode !== mode) return false;
    window.clearTimeout(pending.timeoutId);
    this.pendingModeChange = undefined;
    this.activeMode = mode;
    pending.resolve();
    return true;
  }

  private rejectModeChange(error: Error): void {
    const pending = this.pendingModeChange;
    if (!pending) return;
    window.clearTimeout(pending.timeoutId);
    this.pendingModeChange = undefined;
    pending.reject(error);
  }

  private async spawn(preferred: Delegate, initialMode: VisionMode): Promise<void> {
    this.callbacks?.onStatus('loading', 'Carregando MediaPipe e modelo local…');
    const { wasmBaseUrl, modelUrls } = mediapipeAssetUrls();
    const worker = new Worker(new URL('./pose.worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    const initialized = new Promise<void>((resolve, reject) => {
      this.resolveInitialization = resolve;
      this.rejectInitialization = reject;
    });
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      if (this.worker !== worker) return;
      const message = event.data;
      if (message.type === 'READY') {
        this.activeDelegate = message.delegate;
        if (!this.ready) {
          this.ready = true;
          this.activeMode = message.mode;
          this.desiredMode = message.mode;
          this.completeInitialization();
          this.callbacks?.onStatus('ready', `MediaPipe pronto · ${message.delegate}`);
        } else if (this.completeModeChange(message.mode)) {
          this.callbacks?.onStatus('ready', `MediaPipe pronto · ${message.delegate} · modo ${message.mode}`);
        }
      } else if (message.type === 'FALLBACK') {
        this.activeDelegate = message.to;
        this.callbacks?.onStatus('fallback', 'GPU indisponível; usando CPU.');
      } else if (message.type === 'ERROR') {
        if (message.stage === 'detect') {
          if (this.inFlight?.requestId !== message.requestId || this.inFlight.captureEpoch !== message.captureEpoch)
            return;
          this.releaseFrame(message.requestId, message.captureEpoch);
          if (!message.fatal && message.captureEpoch !== this.captureEpoch) return;
        }
        if (message.fatal) this.rejectModeChange(new Error(message.message));
        this.callbacks?.onStatus(message.fatal ? 'error' : 'fallback', message.message);
        if (message.fatal) {
          this.completeInitialization(new Error(message.message));
          this.dispose();
        }
      } else if (message.type === 'POSE') {
        if (this.inFlight?.requestId !== message.requestId || this.inFlight.captureEpoch !== message.captureEpoch)
          return;
        this.releaseFrame(message.requestId, message.captureEpoch);
        if (!this.capturing || message.captureEpoch !== this.captureEpoch || this.desiredMode !== 'pose') return;
        this.callbacks?.onPose?.({
          timestampMs: message.timestampMs,
          landmarks: message.landmarks,
          worldLandmarks: message.worldLandmarks,
          trackingState: 'degraded',
          bodyConfidence: this.confidence(message.landmarks),
        });
      } else if (message.type === 'HAND') {
        if (this.inFlight?.requestId !== message.requestId || this.inFlight.captureEpoch !== message.captureEpoch)
          return;
        this.releaseFrame(message.requestId, message.captureEpoch);
        if (!this.capturing || message.captureEpoch !== this.captureEpoch || this.desiredMode !== 'hand') return;
        this.callbacks?.onHand?.({
          timestampMs: message.timestampMs,
          landmarks: message.landmarks,
          handedness: message.handedness,
          aspectY: message.aspectY,
        });
      }
    };
    worker.onerror = (event) => {
      if (this.worker !== worker) return;
      const error = new Error(event.message || 'Falha no Worker de visão.');
      this.callbacks?.onStatus('error', error.message);
      this.completeInitialization(error);
      this.dispose();
    };
    worker.postMessage({
      type: 'INIT',
      delegate: preferred,
      wasmBaseUrl,
      modelUrl: modelUrls[initialMode],
      mode: initialMode,
    } satisfies WorkerRequest);
    let initializationTimeout: number | undefined;
    try {
      await Promise.race([
        initialized,
        new Promise<never>((_resolve, reject) => {
          initializationTimeout = window.setTimeout(() => {
            const error = new Error('Inicialização do MediaPipe excedeu 30 segundos.');
            if (this.worker === worker) {
              this.callbacks?.onStatus('error', error.message);
              this.completeInitialization(error);
              this.dispose();
            }
            reject(error);
          }, 30_000);
        }),
      ]);
    } catch (error) {
      if (this.worker === worker) this.dispose();
      throw error;
    } finally {
      if (initializationTimeout !== undefined) window.clearTimeout(initializationTimeout);
    }
  }

  private completeInitialization(error?: Error): void {
    const resolve = this.resolveInitialization;
    const reject = this.rejectInitialization;
    this.resolveInitialization = undefined;
    this.rejectInitialization = undefined;
    if (error) reject?.(error);
    else resolve?.();
  }

  private async capture(video: HTMLVideoElement, now: number): Promise<void> {
    if (this.inFlight || this.activeMode !== this.desiredMode || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)
      return;
    const requestId = this.nextRequestId++;
    const captureEpoch = this.captureEpoch;
    const frameRequest = { requestId, captureEpoch };
    this.inFlight = frameRequest;
    const timestampMs = Math.max(now, this.lastTimestamp + 0.01);
    this.lastTimestamp = timestampMs;
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(video, { resizeWidth: 640, resizeQuality: 'low' });
      if (
        !this.capturing ||
        captureEpoch !== this.captureEpoch ||
        !this.worker ||
        this.activeMode !== this.desiredMode
      ) {
        bitmap.close();
        this.releaseFrame(requestId, captureEpoch);
        return;
      }
      this.worker.postMessage({ type: 'FRAME', ...frameRequest, timestampMs, bitmap } satisfies WorkerRequest, [
        bitmap,
      ]);
      bitmap = undefined;
    } catch (error) {
      bitmap?.close();
      this.releaseFrame(requestId, captureEpoch);
      if (this.capturing && captureEpoch === this.captureEpoch) {
        this.callbacks?.onStatus('error', error instanceof Error ? error.message : String(error));
      }
    }
  }

  private releaseFrame(requestId: number, captureEpoch: number): void {
    if (this.inFlight?.requestId === requestId && this.inFlight.captureEpoch === captureEpoch)
      this.inFlight = undefined;
  }

  private confidence(points: PoseSnapshot['landmarks']): number {
    const indices = [11, 12, 23, 24];
    if (indices.some((index) => !points[index])) return 0;
    return Math.min(
      ...indices.map((index) => {
        const point = points[index]!;
        const visibility = point.visibility ?? point.presence ?? 0;
        const presence = point.presence ?? point.visibility ?? 0;
        return Math.min(visibility, presence);
      }),
    );
  }
}

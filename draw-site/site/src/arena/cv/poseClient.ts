import type { Delegate, PoseSnapshot, WorkerReply, WorkerRequest } from './protocol';
import { MEDIAPIPE_WASM_VERSION, POSE_MODEL_SHA8 } from './mediapipeAssets';

export interface PoseClientCallbacks {
  onPose(snapshot: PoseSnapshot): void;
  onStatus(status: 'loading' | 'ready' | 'fallback' | 'error', detail: string): void;
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
    modelUrl: new URL(`${base}/models/pose_landmarker_lite.${POSE_MODEL_SHA8}.task`, location.origin).href,
  };
}

export class PoseClient {
  private worker?: Worker;
  private ready = false;
  private activeDelegate?: Delegate;
  private initPromise?: Promise<void>;
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
  private onReady?: () => void;

  static warmVisionAssets(): void {
    const { wasmModuleUrls, modelUrl } = mediapipeAssetUrls();
    for (const url of [...wasmModuleUrls, modelUrl]) void fetch(url).then((response) => (response.ok ? response.arrayBuffer() : undefined)).catch(() => undefined);
  }

  get isReady(): boolean {
    return this.ready;
  }

  get delegate(): Delegate | undefined {
    return this.activeDelegate;
  }

  async init(callbacks: PoseClientCallbacks, preferred: Delegate = 'GPU'): Promise<void> {
    this.callbacks = callbacks;
    if (this.ready) return;
    this.initPromise ??= this.spawn(preferred);
    await this.initPromise;
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
      const supportsVideoFrameCallback = typeof (video as HTMLVideoElement & { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback === 'function';
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
    this.worker?.postMessage({ type: 'DISPOSE' } satisfies WorkerRequest);
    this.worker?.terminate();
    this.worker = undefined;
    this.ready = false;
    this.activeDelegate = undefined;
    this.inFlight = undefined;
    this.initPromise = undefined;
    this.onReady?.();
    this.onReady = undefined;
    this.callbacks = undefined;
  }

  private async spawn(preferred: Delegate): Promise<void> {
    this.callbacks?.onStatus('loading', 'Carregando MediaPipe e modelo local…');
    const { wasmBaseUrl, modelUrl } = mediapipeAssetUrls();
    const worker = new Worker(new URL('./pose.worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    const initialized = new Promise<void>((resolve) => { this.onReady = resolve; });
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      if (this.worker !== worker) return;
      const message = event.data;
      if (message.type === 'READY') {
        this.ready = true;
        this.activeDelegate = message.delegate;
        this.onReady?.();
        this.callbacks?.onStatus('ready', `MediaPipe pronto · ${message.delegate}`);
      } else if (message.type === 'FALLBACK') {
        this.activeDelegate = message.to;
        this.callbacks?.onStatus('fallback', 'GPU indisponível; usando CPU.');
      } else if (message.type === 'ERROR') {
        if (message.stage === 'detect') {
          if (this.inFlight?.requestId !== message.requestId || this.inFlight.captureEpoch !== message.captureEpoch) return;
          this.releaseFrame(message.requestId, message.captureEpoch);
          if (!message.fatal && message.captureEpoch !== this.captureEpoch) return;
        }
        this.callbacks?.onStatus(message.fatal ? 'error' : 'fallback', message.message);
        if (message.fatal) { this.onReady?.(); this.dispose(); }
      } else if (message.type === 'POSE') {
        if (this.inFlight?.requestId !== message.requestId || this.inFlight.captureEpoch !== message.captureEpoch) return;
        this.releaseFrame(message.requestId, message.captureEpoch);
        if (!this.capturing || message.captureEpoch !== this.captureEpoch) return;
        this.callbacks?.onPose({
          timestampMs: message.timestampMs,
          landmarks: message.landmarks,
          worldLandmarks: message.worldLandmarks,
          trackingState: 'degraded',
          bodyConfidence: this.confidence(message.landmarks),
        });
      }
    };
    worker.onerror = (event) => {
      if (this.worker !== worker) return;
      this.callbacks?.onStatus('error', event.message || 'Falha no Worker de visão.');
      this.onReady?.();
      this.dispose();
    };
    worker.postMessage({ type: 'INIT', delegate: preferred, wasmBaseUrl, modelUrl } satisfies WorkerRequest);
    let initializationTimeout: number | undefined;
    await Promise.race([
      initialized,
      new Promise<void>((resolve) => { initializationTimeout = window.setTimeout(resolve, 30_000); }),
    ]);
    if (initializationTimeout !== undefined) window.clearTimeout(initializationTimeout);
    this.onReady = undefined;
    if (this.worker !== worker) return;
    if (!this.ready) { this.callbacks?.onStatus('error', 'Inicialização do MediaPipe excedeu 30 segundos.'); this.dispose(); }
  }

  private async capture(video: HTMLVideoElement, now: number): Promise<void> {
    if (this.inFlight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const requestId = this.nextRequestId++;
    const captureEpoch = this.captureEpoch;
    const frameRequest = { requestId, captureEpoch };
    this.inFlight = frameRequest;
    const timestampMs = Math.max(now, this.lastTimestamp + 0.01);
    this.lastTimestamp = timestampMs;
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(video, { resizeWidth: 640, resizeQuality: 'low' });
      if (!this.capturing || captureEpoch !== this.captureEpoch || !this.worker) {
        bitmap.close();
        this.releaseFrame(requestId, captureEpoch);
        return;
      }
      this.worker.postMessage({ type: 'FRAME', ...frameRequest, timestampMs, bitmap } satisfies WorkerRequest, [bitmap]);
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
    if (this.inFlight?.requestId === requestId && this.inFlight.captureEpoch === captureEpoch) this.inFlight = undefined;
  }

  private confidence(points: PoseSnapshot['landmarks']): number {
    const indices = [11, 12, 23, 24];
    if (indices.some((index) => !points[index])) return 0;
    return Math.min(...indices.map((index) => {
      const point = points[index]!;
      const visibility = point.visibility ?? point.presence ?? 0;
      const presence = point.presence ?? point.visibility ?? 0;
      return Math.min(visibility, presence);
    }));
  }
}

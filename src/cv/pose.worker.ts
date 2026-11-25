/// <reference lib="webworker" />
import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Delegate, Handedness, Point3, VisionMode, WorkerReply, WorkerRequest, WorkerSetMode } from './protocol';

type VisionFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
type ActiveTask = { mode: 'pose'; landmarker: PoseLandmarker } | { mode: 'hand'; landmarker: HandLandmarker };
type PreparedTask = { vision: VisionFileset; modelBytes: Uint8Array };

let activeTask: ActiveTask | undefined;
let visionFileset: Promise<VisionFileset> | undefined;
let moduleFactory: Promise<unknown> | undefined;
let wasmBaseUrl = '';
let mode: VisionMode = 'pose';
let modelUrl = '';
let delegate: Delegate = 'GPU';
let attemptedFallback = false;
let queue: Promise<void> = Promise.resolve();

function enqueue(job: () => Promise<void>): void {
  queue = queue.then(job).catch((error) => {
    self.postMessage({
      type: 'ERROR',
      stage: 'init',
      fatal: true,
      message: error instanceof Error ? error.message : String(error),
    } satisfies WorkerReply);
  });
}

function getVisionFileset(): Promise<VisionFileset> {
  visionFileset ??= FilesetResolver.forVisionTasks(wasmBaseUrl, true).catch((error) => {
    visionFileset = undefined;
    throw error;
  });
  return visionFileset;
}

async function ensureModuleFactory(): Promise<void> {
  const scope = self as typeof self & { ModuleFactory?: unknown };
  if (scope.ModuleFactory) return;
  moduleFactory ??= import(/* @vite-ignore */ `${wasmBaseUrl}/vision_wasm_module_internal.js`)
    .then((module) => module.default as unknown)
    .catch((error) => {
      moduleFactory = undefined;
      throw error;
    });
  scope.ModuleFactory = await moduleFactory;
}

function closeActiveTask(): void {
  if (!activeTask) return;
  activeTask.landmarker.close();
  activeTask = undefined;
}

async function prepareTask(modeToCreate: VisionMode, taskModelUrl: string): Promise<PreparedTask> {
  const [vision, response] = await Promise.all([getVisionFileset(), fetch(taskModelUrl)]);
  if (!response.ok)
    throw new Error(`${modeToCreate === 'pose' ? 'Pose' : 'Hand'} model request failed (${response.status})`);
  return { vision, modelBytes: new Uint8Array(await response.arrayBuffer()) };
}

async function createLandmarker(
  modeToCreate: VisionMode,
  prepared: PreparedTask,
  nextDelegate: Delegate,
): Promise<ActiveTask> {
  const baseOptions = { modelAssetBuffer: prepared.modelBytes, delegate: nextDelegate };
  if (modeToCreate === 'pose') {
    return {
      mode: modeToCreate,
      landmarker: await PoseLandmarker.createFromOptions(prepared.vision, {
        baseOptions,
        runningMode: 'VIDEO',
        numPoses: 1,
        outputSegmentationMasks: false,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      }),
    };
  }
  return {
    mode: modeToCreate,
    landmarker: await HandLandmarker.createFromOptions(prepared.vision, {
      baseOptions,
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    }),
  };
}

async function createWithFallback(
  modeToCreate: VisionMode,
  prepared: PreparedTask,
  preferred: Delegate,
): Promise<{ task: ActiveTask; delegate: Delegate }> {
  try {
    return { task: await createLandmarker(modeToCreate, prepared, preferred), delegate: preferred };
  } catch (error) {
    if (preferred !== 'GPU' || attemptedFallback) throw error;
    attemptedFallback = true;
    const reason = error instanceof Error ? error.message : String(error);
    try {
      await ensureModuleFactory();
      const task = await createLandmarker(modeToCreate, prepared, 'CPU');
      self.postMessage({ type: 'FALLBACK', from: 'GPU', to: 'CPU', reason } satisfies WorkerReply);
      return { task, delegate: 'CPU' };
    } catch (cpuError) {
      const cpuReason = cpuError instanceof Error ? cpuError.message : String(cpuError);
      throw new Error(`GPU falhou (${reason}); fallback CPU também falhou (${cpuReason}).`);
    }
  }
}

async function initialize(
  modeToCreate: VisionMode,
  nextModelUrl: string,
  preferred: Delegate,
  nextWasmBaseUrl?: string,
): Promise<void> {
  try {
    if (nextWasmBaseUrl !== undefined && nextWasmBaseUrl !== wasmBaseUrl) {
      wasmBaseUrl = nextWasmBaseUrl;
      visionFileset = undefined;
      moduleFactory = undefined;
    }
    const prepared = await prepareTask(modeToCreate, nextModelUrl);
    await ensureModuleFactory();
    closeActiveTask();
    const created = await createWithFallback(modeToCreate, prepared, preferred);
    activeTask = created.task;
    mode = modeToCreate;
    modelUrl = nextModelUrl;
    delegate = created.delegate;
    self.postMessage({ type: 'READY', mode, delegate } satisfies WorkerReply);
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      stage: 'init',
      fatal: true,
      message: error instanceof Error ? error.message : String(error),
    } satisfies WorkerReply);
  }
}

async function setMode(request: WorkerSetMode): Promise<void> {
  if (request.mode === mode && request.modelUrl === modelUrl && activeTask) {
    self.postMessage({ type: 'READY', mode, delegate } satisfies WorkerReply);
    return;
  }
  await initialize(request.mode, request.modelUrl, delegate);
}

async function fallback(reason: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (delegate !== 'GPU' || attemptedFallback) return { ok: false, message: reason };
  attemptedFallback = true;
  try {
    const prepared = await prepareTask(mode, modelUrl);
    await ensureModuleFactory();
    closeActiveTask();
    activeTask = await createLandmarker(mode, prepared, 'CPU');
    delegate = 'CPU';
    self.postMessage({ type: 'FALLBACK', from: 'GPU', to: 'CPU', reason } satisfies WorkerReply);
    return { ok: true };
  } catch (error) {
    const cpuReason = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `GPU falhou (${reason}); fallback CPU também falhou (${cpuReason}).` };
  }
}

function simplify(
  points: readonly { x: number; y: number; z: number; visibility?: number; presence?: number }[] | undefined,
): Point3[] {
  return (points ?? []).map(({ x, y, z, visibility, presence }) => ({ x, y, z, visibility, presence }));
}

function handednessOf(categories: readonly { categoryName: string }[][]): Handedness | undefined {
  const categoryName = categories[0]?.[0]?.categoryName;
  return categoryName === 'Left' || categoryName === 'Right' ? categoryName : undefined;
}

async function detect(
  bitmap: ImageBitmap,
  timestampMs: number,
  requestId: number,
  captureEpoch: number,
): Promise<void> {
  if (!activeTask) {
    bitmap.close();
    self.postMessage({
      type: 'ERROR',
      stage: 'detect',
      fatal: true,
      requestId,
      captureEpoch,
      message: `${mode === 'pose' ? 'PoseLandmarker' : 'HandLandmarker'} is not initialized`,
    } satisfies WorkerReply);
    return;
  }

  let complete: (() => void) | undefined;
  let inferenceError: unknown;
  try {
    if (activeTask.mode === 'pose') {
      const result = activeTask.landmarker.detectForVideo(bitmap, timestampMs);
      complete = () => {
        self.postMessage({
          type: 'POSE',
          requestId,
          captureEpoch,
          timestampMs,
          landmarks: simplify(result.landmarks[0]),
          worldLandmarks: simplify(result.worldLandmarks[0]),
        } satisfies WorkerReply);
      };
    } else {
      const result = activeTask.landmarker.detectForVideo(bitmap, timestampMs);
      complete = () => {
        self.postMessage({
          type: 'HAND',
          requestId,
          captureEpoch,
          timestampMs,
          landmarks: simplify(result.landmarks[0]),
          handedness: handednessOf(result.handedness),
        } satisfies WorkerReply);
      };
    }
  } catch (error) {
    inferenceError = error;
  } finally {
    bitmap.close();
  }

  if (!inferenceError) {
    complete?.();
    return;
  }

  const message = inferenceError instanceof Error ? inferenceError.message : String(inferenceError);
  const fallbackResult = await fallback(message);
  if (fallbackResult.ok) {
    self.postMessage({
      type: 'ERROR',
      stage: 'detect',
      fatal: false,
      requestId,
      captureEpoch,
      message: 'GPU falhou; próxima captura será processada em CPU.',
    } satisfies WorkerReply);
  } else {
    self.postMessage({
      type: 'ERROR',
      stage: 'detect',
      fatal: true,
      requestId,
      captureEpoch,
      message: fallbackResult.message,
    } satisfies WorkerReply);
  }
}

self.onmessage = ({ data }: MessageEvent<WorkerRequest>) => {
  if (data.type === 'INIT') {
    enqueue(() => initialize(data.mode, data.modelUrl, data.delegate, data.wasmBaseUrl));
  } else if (data.type === 'SET_MODE') {
    enqueue(() => setMode(data));
  } else if (data.type === 'DISPOSE') {
    enqueue(async () => closeActiveTask());
  } else {
    enqueue(() => detect(data.bitmap, data.timestampMs, data.requestId, data.captureEpoch));
  }
};

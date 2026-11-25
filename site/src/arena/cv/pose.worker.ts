/// <reference lib="webworker" />
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Delegate, Point3, WorkerReply, WorkerRequest } from './protocol';

let landmarker: PoseLandmarker | undefined;
let wasmBaseUrl = '';
let modelUrl = '';
let delegate: Delegate = 'GPU';
let attemptedFallback = false;

async function createTask(nextDelegate: Delegate): Promise<void> {
  const vision = await FilesetResolver.forVisionTasks(wasmBaseUrl, true);
  const response = await fetch(modelUrl);
  if (!response.ok) throw new Error(`Pose model request failed (${response.status})`);
  const modelBytes = new Uint8Array(await response.arrayBuffer());
  landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetBuffer: modelBytes, delegate: nextDelegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    outputSegmentationMasks: false,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  delegate = nextDelegate;
}

function simplify(points: readonly { x: number; y: number; z: number; visibility?: number; presence?: number }[] | undefined): Point3[] {
  return (points ?? []).map(({ x, y, z, visibility, presence }) => ({ x, y, z, visibility, presence }));
}

async function fallback(reason: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (delegate !== 'GPU' || attemptedFallback) return { ok: false, message: reason };
  attemptedFallback = true;
  try { landmarker?.close(); } catch { /* task may have failed before initialization */ }
  landmarker = undefined;
  try {
    await createTask('CPU');
    self.postMessage({ type: 'FALLBACK', from: 'GPU', to: 'CPU', reason } satisfies WorkerReply);
    return { ok: true };
  } catch (error) {
    landmarker = undefined;
    const cpuReason = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `GPU falhou (${reason}); fallback CPU também falhou (${cpuReason}).` };
  }
}

self.onmessage = async ({ data }: MessageEvent<WorkerRequest>) => {
  if (data.type === 'INIT') {
    wasmBaseUrl = data.wasmBaseUrl;
    modelUrl = data.modelUrl;
    try {
      try {
        await createTask(data.delegate);
      } catch (error) {
        if (data.delegate !== 'GPU') throw error;
        const reason = error instanceof Error ? error.message : String(error);
        const fallbackResult = await fallback(reason);
        if (!fallbackResult.ok) throw new Error(fallbackResult.message);
      }
      self.postMessage({ type: 'READY', delegate } satisfies WorkerReply);
    } catch (error) {
      self.postMessage({ type: 'ERROR', stage: 'init', fatal: true, message: error instanceof Error ? error.message : String(error) } satisfies WorkerReply);
    }
    return;
  }

  if (data.type === 'DISPOSE') {
    landmarker?.close();
    landmarker = undefined;
    return;
  }

  const { bitmap, timestampMs, requestId, captureEpoch } = data;
  if (!landmarker) {
    bitmap.close();
    self.postMessage({ type: 'ERROR', stage: 'detect', fatal: true, requestId, captureEpoch, message: 'PoseLandmarker is not initialized' } satisfies WorkerReply);
    return;
  }
  try {
    const result = landmarker.detectForVideo(bitmap, timestampMs);
    self.postMessage({
      type: 'POSE', requestId, captureEpoch, timestampMs,
      landmarks: simplify(result.landmarks[0]),
      worldLandmarks: simplify(result.worldLandmarks[0]),
    } satisfies WorkerReply);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fallbackResult = await fallback(message);
    if (fallbackResult.ok) {
      self.postMessage({ type: 'ERROR', stage: 'detect', fatal: false, requestId, captureEpoch, message: 'GPU falhou; próxima captura será processada em CPU.' } satisfies WorkerReply);
    } else {
      self.postMessage({ type: 'ERROR', stage: 'detect', fatal: true, requestId, captureEpoch, message: fallbackResult.message } satisfies WorkerReply);
    }
  } finally {
    bitmap.close();
  }
};

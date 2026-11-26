import { describe, expect, it } from 'vitest';
import { AutoCalibrator } from '../src/arena/cv/autoCalibrator';
import { Calibrator } from '../src/arena/cv/calibrator';
import { pose } from './fixtures/syntheticPose';

const lostPose = (time: number) => ({ ...pose(time), landmarks: [], worldLandmarks: [], trackingState: 'lost' as const });

function hiddenWorld(time: number, indices: readonly number[]) {
  const snapshot = pose(time, { hiddenLandmarks: indices });
  return {
    ...snapshot,
    worldLandmarks: snapshot.worldLandmarks.map((point, index) => (
      indices.includes(index) ? { ...point, visibility: 0, presence: 0 } : point
    )),
  };
}

describe('calibração pelo torso', () => {
  it('completa a calibração de corrida sem joelhos, tornozelos ou punhos', () => {
    const auto = new AutoCalibrator();
    const steps = Array.from({ length: 61 }, (_, i) => auto.update(hiddenWorld(i * 100, [15, 16, 25, 26, 27, 28])));
    const done = steps.find((step) => step.profile);

    expect(done?.profile).toBeDefined();
    expect(done?.profile?.world.leanUp0).toBeDefined();
    expect(done?.profile?.world.readyWristLocal).toBeUndefined();
  });

  it('conclui para tênis com punhos visíveis mesmo sem joelhos nem tornozelos', () => {
    const auto = new AutoCalibrator();
    const steps = Array.from({ length: 61 }, (_, i) => auto.update(hiddenWorld(i * 100, [25, 26, 27, 28]), { needsWrists: true }));
    const done = steps.find((step) => step.profile);

    expect(done?.profile).toBeDefined();
    expect(done?.profile?.world.readyWristLocal).toBeDefined();
  });

  it('não conclui para tênis quando os punhos somem durante a coleta', () => {
    const auto = new AutoCalibrator();
    const frame = (i: number) => (i <= 12 ? pose(i * 100) : hiddenWorld(i * 100, [15, 16]));
    const steps = Array.from({ length: 61 }, (_, i) => auto.update(frame(i), { needsWrists: true }));

    expect(steps.some((step) => step.profile)).toBe(false);
  });

  it('converge perto de dois segundos com sinal contínuo e estende após um blackout curto', () => {
    const continuous = new AutoCalibrator();
    const continuousSteps = Array.from({ length: 61 }, (_, i) => continuous.update(pose(i * 100)));
    expect(continuousSteps[19]?.phase).toBe('collecting');
    expect(continuousSteps[20]?.phase).toBe('done');

    const interrupted = new AutoCalibrator();
    const interruptedSteps = Array.from({ length: 61 }, (_, i) => interrupted.update(i >= 10 && i < 15 ? lostPose(i * 100) : pose(i * 100)));
    expect(interruptedSteps[20]?.phase).toBe('collecting');
    expect(interruptedSteps.findIndex((step) => step.phase === 'done')).toBe(25);
  });

  it('absorve uma perda curta de rastreamento na cobertura da coleta', () => {
    const auto = new AutoCalibrator();
    const steps = Array.from({ length: 61 }, (_, i) => auto.update(i >= 20 && i < 26 ? lostPose(i * 100) : pose(i * 100)));

    expect(steps.some((step) => step.profile)).toBe(true);
  });

  it('não calibra enquanto a pessoa se mexe', () => {
    const auto = new AutoCalibrator();
    const steps = Array.from({ length: 61 }, (_, i) => auto.update(pose(i * 100, { hipRise: i % 10 < 5 ? 0 : 0.3 })));

    expect(steps.some((step) => step.profile)).toBe(false);
  });

  it('rejeita confiança não finita em vez de contar esses quadros como válidos', () => {
    const auto = new AutoCalibrator();
    const nanPose = (time: number) => {
      const snapshot = pose(time);
      return {
        ...snapshot,
        landmarks: snapshot.landmarks.map((point, index) => (
          [11, 12, 23, 24].includes(index) ? { ...point, visibility: Number.NaN, presence: Number.NaN } : point
        )),
      };
    };
    const steps = Array.from({ length: 61 }, (_, i) => auto.update(nanPose(i * 100)));

    expect(steps.some((step) => step.profile)).toBe(false);
  });

  it('não credita um intervalo longo sem callbacks como sinal válido', () => {
    const calibrator = new Calibrator();
    calibrator.start(0, 1000);
    for (let index = 0; index < 12; index += 1) calibrator.add(pose(index * 20));
    calibrator.add(pose(2000));

    expect(calibrator.finish()).toBeNull();
  });
});

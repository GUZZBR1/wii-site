import type { CalibrationProfile, Point3, PoseSnapshot } from './protocol';
import { Calibrator } from './calibrator';
import { distance2, distance3, isFinitePoint, landmarkConfidence } from '../kinematics/math';

const SETTLE_MS = 1000;
const COLLECT_MS = 3000;
/** Movimento máximo em coordenadas normalizadas da imagem para os joints usados no perfil. */
const STILL_TOLERANCE = 0.04;
/** Movimento 3D máximo relativo à largura do ombro; piso para não amplificar escalas degeneradas. */
const WORLD_STILL_FRACTION = 0.2;
const MIN_WORLD_STILL_METERS = 0.08;
/** Ombros e quadris formam o núcleo necessário para todos os esportes. */
const REQUIRED_CORE = [11, 12, 23, 24] as const;
/** Punhos entram no gate somente para o tênis, que precisa de referência para os swings. */
const REQUIRED_WRISTS = [15, 16] as const;
/** Pontos opcionais que podem contribuir para a referência neutra quando estão visíveis. */
const BODY_AND_LEGS = [11, 12, 23, 24, 25, 26, 27, 28] as const;
const CALIBRATION_LANDMARKS = [...BODY_AND_LEGS, ...REQUIRED_WRISTS] as const;

export type CalibrationPhase = 'framing' | 'settling' | 'collecting' | 'done';
export interface CalibrationStep { phase: CalibrationPhase; progress: number; profile?: CalibrationProfile }

/** Calibra sozinho: espera o corpo enquadrado e parado, coleta e tenta de novo se falhar. */
export class AutoCalibrator {
  private readonly calibrator = new Calibrator();
  private anchor?: {
    imageLandmarks: Map<number, Point3>;
    worldLandmarks: Map<number, Point3>;
    worldMovementTolerance: number;
    since: number;
  };

  update(snapshot: PoseSnapshot, options: { needsWrists?: boolean } = {}): CalibrationStep {
    const required = options.needsWrists ? [...REQUIRED_CORE, ...REQUIRED_WRISTS] : [...REQUIRED_CORE];
    const visible = required.every((index) => snapshot.landmarks[index]) && landmarkConfidence(...required.map((index) => snapshot.landmarks[index]!)) >= 0.55;
    // Sem âncora não há investimento a proteger: quadro ruim é só enquadramento.
    if (!this.anchor && (snapshot.trackingState !== 'tracked' || !visible)) {
      return { phase: 'framing', progress: 0 };
    }
    // Ancorado, todo quadro ruim conta no denominador de cobertura e no prazo — inclusive no
    // repouso, porque com a fusão o investimento começa na âncora, não na coleta. Mesmo quando
    // um joint exigido some, os outros pontos ancorados ainda podem provar movimento; ignorar
    // essa evidência deixaria o usuário mover o torso enquanto tornozelos ou punhos estão fora
    // do quadro e voltar antes de contaminar as medianas. Pontos ausentes são ignorados por
    // moved(); qualquer movimento observável invalida a tentativa.
    if (snapshot.trackingState !== 'tracked' || !visible) {
      if (this.moved(snapshot, options)) {
        this.reset();
        return { phase: 'framing', progress: 0 };
      }
      this.calibrator.add(snapshot);
      return this.advance(snapshot, options);
    }

    if (!this.anchor || this.moved(snapshot, options)) {
      this.reset();
      this.anchor = this.createAnchor(snapshot, options);
      // A coleta começa na âncora, não no fim do repouso: os frames do settling já são
      // verificados como parados, então contam como sinal válido — a invariante de
      // qualidade é tempo de sinal válido, e o repouso é o trecho mais estável da janela.
      this.calibrator.start(snapshot.timestampMs, SETTLE_MS);
    }
    this.calibrator.add(snapshot);
    return this.advance(snapshot, options);
  }

  /** Sonda a convergência em cada frame; cobertura boa encerra cedo e gaps estendem até o prazo. */
  private advance(snapshot: PoseSnapshot, options: { needsWrists?: boolean }): CalibrationStep {
    const stillMs = snapshot.timestampMs - this.anchor!.since;
    if (stillMs < SETTLE_MS) return { phase: 'settling', progress: 0 };
    const probe = this.calibrator.finish();
    if (probe && (!options.needsWrists || probe.world.readyWristLocal)) return this.complete(probe, options);
    const progress = Math.min(1, (stillMs - SETTLE_MS) / COLLECT_MS);
    if (progress < 1) return { phase: 'collecting', progress };
    return this.conclude(options);
  }

  /** Alguma articulação usada no perfil mudou em imagem ou em espaço mundial. */
  private moved(snapshot: PoseSnapshot, options: { needsWrists?: boolean }): boolean {
    const landmarks = options.needsWrists ? CALIBRATION_LANDMARKS : BODY_AND_LEGS;
    for (const index of landmarks) {
      const imagePoint = this.confidentPoint(snapshot.landmarks, index);
      const anchoredImagePoint = this.anchor!.imageLandmarks.get(index);
      if (!anchoredImagePoint && imagePoint) return true;
      if (anchoredImagePoint && imagePoint && distance2(imagePoint, anchoredImagePoint) > STILL_TOLERANCE) return true;

      const worldPoint = this.confidentPoint(snapshot.worldLandmarks, index);
      const anchoredWorldPoint = this.anchor!.worldLandmarks.get(index);
      if (!anchoredWorldPoint && worldPoint) return true;
      if (anchoredWorldPoint && worldPoint && distance3(worldPoint, anchoredWorldPoint) > this.anchor!.worldMovementTolerance) return true;
    }
    return false;
  }

  private createAnchor(snapshot: PoseSnapshot, options: { needsWrists?: boolean }) {
    const imageLandmarks = new Map<number, Point3>();
    const worldLandmarks = new Map<number, Point3>();
    const landmarks = options.needsWrists ? CALIBRATION_LANDMARKS : BODY_AND_LEGS;
    for (const index of landmarks) {
      const imagePoint = this.confidentPoint(snapshot.landmarks, index);
      if (imagePoint) imageLandmarks.set(index, imagePoint);
      const worldPoint = this.confidentPoint(snapshot.worldLandmarks, index);
      if (worldPoint) worldLandmarks.set(index, worldPoint);
    }
    const leftShoulder = worldLandmarks.get(11);
    const rightShoulder = worldLandmarks.get(12);
    const shoulderWidth = leftShoulder && rightShoulder ? distance3(leftShoulder, rightShoulder) : 0;
    return {
      imageLandmarks,
      worldLandmarks,
      worldMovementTolerance: Math.max(MIN_WORLD_STILL_METERS, shoulderWidth * WORLD_STILL_FRACTION),
      since: snapshot.timestampMs,
    };
  }

  private confidentPoint(points: readonly (Point3 | undefined)[], index: number): Point3 | undefined {
    const point = points[index];
    return isFinitePoint(point) && landmarkConfidence(point) >= 0.55 ? point : undefined;
  }

  private conclude(options: { needsWrists?: boolean }): CalibrationStep {
    const profile = this.calibrator.finish();
    // Sem referência dos punhos o tênis não consegue registrar swing; corrida, salto e raia
    // usam apenas o perfil do torso e continuam sem exigir pernas ou pés no quadro.
    if (profile && (!options.needsWrists || profile.world.readyWristLocal)) return this.complete(profile, options);
    this.reset();
    return { phase: 'framing', progress: 0 };
  }

  private complete(profile: CalibrationProfile, options: { needsWrists?: boolean }): CalibrationStep {
    this.reset();
    // Corrida não pede mãos estáticas. Omitir uma referência incidental faz o tênis solicitar
    // a calibração de punhos quando o usuário trocar de modalidade.
    const completed = options.needsWrists
      ? profile
      : { ...profile, world: { ...profile.world, readyWristLocal: undefined } };
    return { phase: 'done', progress: 1, profile: completed };
  }

  reset(): void { this.calibrator.reset(); this.anchor = undefined; }
}

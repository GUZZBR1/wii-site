/** Qualidade adaptativa da abertura. Lógica pura: nada aqui sai do aparelho. */

export type Tier = 'lite' | 'medium' | 'ultra';
export type Mode = 'auto' | Tier;

export const TIERS: Record<Tier, { dpr: number; octaves: number; taps: number; bloom: boolean; warp: boolean; particles: number }> = {
  lite: { dpr: 1, octaves: 2, taps: 6, bloom: false, warp: false, particles: 30 },
  medium: { dpr: 1.25, octaves: 3, taps: 10, bloom: true, warp: true, particles: 60 },
  ultra: { dpr: 1.75, octaves: 5, taps: 20, bloom: true, warp: true, particles: 90 },
};

/** Degraus do mais leve ao mais pesado: primeiro muda a resolução, depois o perfil. */
export const LADDER: ReadonlyArray<{ tier: Tier; scale: number }> = [
  { tier: 'lite', scale: .6 },
  { tier: 'lite', scale: .85 },
  { tier: 'medium', scale: .8 },
  { tier: 'medium', scale: 1 },
  { tier: 'ultra', scale: .85 },
  { tier: 'ultra', scale: 1 },
];

const HOME: Record<Tier, number> = { lite: 1, medium: 3, ultra: 5 };
export const levelOf = (tier: Tier) => HOME[tier];

export interface Hardware {
  cores?: number;
  memory?: number;
  renderer: string;
}

export const isSoftware = (renderer: string) => /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);

/**
 * `frameMs` é o custo medido de um quadro do perfil médio. A medida decide;
 * o hardware declarado só impõe um teto em casos claramente fracos.
 */
export function classify(frameMs: number, hardware: Hardware): number {
  if (isSoftware(hardware.renderer)) return levelOf('lite');
  const measured = frameMs <= 5 ? levelOf('ultra') : frameMs <= 11 ? levelOf('medium') : frameMs <= 18 ? 2 : frameMs <= 28 ? 1 : 0;
  const weak = (hardware.cores ?? 8) <= 2 || (hardware.memory ?? 8) <= 2;
  return weak ? Math.min(measured, levelOf('medium')) : measured;
}

const WINDOW_MS = 1500;
const SLOW_MS = 22; // abaixo de ~45 quadros por segundo
const SMOOTH_MS = 18; // acompanhando uma tela de 60 Hz

export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
}

/**
 * Ajusta o degrau pelo tempo real entre quadros. Contra oscilação: desce só após duas janelas
 * lentas, sobe só após quatro janelas fluidas, e nunca volta a um degrau que já falhou.
 */
export function createGovernor(start: number) {
  let level = start;
  let ceiling = LADDER.length - 1;
  let samples: number[] = [];
  let elapsed = 0;
  let slow = 0;
  let smooth = 0;
  let settle = 1000; // ignora o começo e o engasgo de cada troca
  let fps = 0;
  return {
    get level() { return level; },
    get fps() { return fps; },
    sample(ms: number): number {
      if (ms > 250) return level; // aba escondida ou pausa, não é desempenho
      if (settle > 0) { settle -= ms; return level; }
      samples.push(ms);
      elapsed += ms;
      if (elapsed < WINDOW_MS) return level;
      const p75 = percentile(samples, .75);
      fps = Math.round((samples.length * 1000) / elapsed);
      samples = [];
      elapsed = 0;
      slow = p75 > SLOW_MS ? slow + 1 : 0;
      smooth = p75 <= SMOOTH_MS ? smooth + 1 : 0;
      // Muito lento não espera confirmação.
      if (level > 0 && (slow >= 2 || p75 > SLOW_MS * 2)) {
        ceiling = level - 1;
        level -= 1;
        slow = smooth = 0;
        settle = 1000;
      } else if (smooth >= 4 && level < ceiling) {
        level += 1;
        slow = smooth = 0;
        settle = 1000;
      }
      return level;
    },
  };
}

export interface Saved {
  mode: Mode;
  level?: number;
  /** GPU e tamanho de tela da medição: se mudarem, mede de novo. */
  signature?: string;
  at?: number;
}

const KEY = 'wii-quality';
const MAX_AGE = 7 * 24 * 3600 * 1000;
const isMode = (value: unknown): value is Mode => value === 'auto' || value === 'lite' || value === 'medium' || value === 'ultra';

export function parseSaved(raw: string | null): Saved {
  try {
    const data = JSON.parse(raw ?? '') as Saved;
    if (isMode(data.mode)) return data;
  } catch {
    /* ausente ou corrompido */
  }
  return { mode: 'auto' };
}

export function reusableLevel(saved: Saved, signature: string, now: number): number | undefined {
  const { level, at } = saved;
  if (saved.signature !== signature || at === undefined || now - at > MAX_AGE) return undefined;
  return level !== undefined && Number.isInteger(level) && level >= 0 && level < LADDER.length ? level : undefined;
}

export function loadQuality(): Saved {
  // ?quality=auto|lite|medium|ultra força um modo; "auto" também mede de novo.
  const forced = new URLSearchParams(window.location.search).get('quality');
  if (isMode(forced)) return { mode: forced };
  try {
    return parseSaved(localStorage.getItem(KEY));
  } catch {
    return { mode: 'auto' };
  }
}

export function saveQuality(saved: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* sem armazenamento: mede de novo na próxima visita */
  }
}

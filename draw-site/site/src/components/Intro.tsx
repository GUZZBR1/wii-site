import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { historicDrawings } from '../data/historic-drawings';
import { useLang } from '../i18n';
import { createIntroScene, type Frame, type Layer } from '../lib/introScene';
import { classify, createGovernor, isSoftware, LADDER, levelOf, loadQuality, percentile, reusableLevel, saveQuality, type Mode } from '../lib/quality';

// Timeline única, em segundos: perguntas, um plano por marco, marca final e saída.
const LEAD = 7;
const SHOT = 4.2;
const OUTRO = 4;
const FADE = 1.5;
const VEIL = .5; // primeiro o conteúdo da abertura some; só então a página é revelada
const MOVE = 1.5; // quanto do plano a câmera leva viajando até o próximo marco

const OPENING = [
  { pt: 'Como fazer um computador enxergar o corpo?', en: 'How do you make a computer see the body?' },
  { pt: 'Gente de todas as épocas tentou responder.', en: 'People from every era tried to answer.' },
];

const total = historicDrawings.length;
const OUTRO_AT = LEAD + total * SHOT;
const FADE_AT = OUTRO_AT + OUTRO;
const END = FADE_AT + FADE;

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (v: number) => { const x = clamp(v); return x * x * x * (x * (x * 6 - 15) + 10); };
const side = (index: number) => (index % 2 ? 1 : -1);

type Scene = NonNullable<ReturnType<typeof createIntroScene>>;

const MODES: Mode[] = ['auto', 'lite', 'medium', 'ultra'];
const BENCH_FRAMES = 14;
const BENCH_LIMIT_MS = 900;

// A carga do benchmark imita o plano mais pesado: três obras grandes desfocadas, luz, poeira e película, sob preto.
function benchFrame(index: number): Frame {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const layers = [.9, .7, .5].map((size) => ({
    texture: total, x: width / 2, y: height / 2, w: (width * size) / 2, h: (height * size) / 2,
    alpha: 1, blur: .03, gain: .86, feather: 1,
  }));
  return { time: index / 60, travel: index / 30, lightX: 0, lightY: 0, glow: 1, fade: 1, layers };
}

/** Um quadro por vez, sem travar a página; devolve o degrau medido. */
function benchmark(scene: Scene, done: (level: number) => void) {
  const hardware = {
    cores: navigator.hardwareConcurrency,
    memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    renderer: scene.renderer,
  };
  if (isSoftware(hardware.renderer)) { done(classify(Infinity, hardware)); return () => {}; }
  const times: number[] = [];
  const started = performance.now();
  let count = 0;
  let raf = requestAnimationFrame(function step() {
    const before = performance.now();
    scene.render(benchFrame(count), levelOf('medium'));
    scene.sync();
    if (count++ >= 3) times.push(performance.now() - before); // os primeiros aquecem a GPU
    if (count < BENCH_FRAMES && (performance.now() - started < BENCH_LIMIT_MS || !times.length)) raf = requestAnimationFrame(step);
    else done(classify(percentile(times, .5), hardware));
  });
  return () => cancelAnimationFrame(raf);
}

/** Posição da câmera em "marcos": viaja, assenta e segue avançando devagar. */
function cameraAt(t: number, calm: boolean) {
  const shot = (t - LEAD) / SHOT;
  if (calm) return Math.min(total - 1, Math.max(0, Math.floor(shot)));
  if (t >= OUTRO_AT - .4) return total - 1 + ease((t - OUTRO_AT + .4) / 2.4) * 1.2;
  const index = Math.max(0, Math.floor(shot));
  const local = (t - LEAD - index * SHOT) / MOVE;
  const arrive = index === 0 ? -1 + ease((t - LEAD + .8) / 2.2) : index - 1 + ease(local);
  return arrive + clamp(shot - index) * .06;
}

/** Abertura: a câmera atravessa os marcos do movimento como controle, até o Kinect. */
export default function Intro({ onDone }: { onDone: () => void }) {
  const { tr } = useLang();
  const [calm] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // -1: perguntas; 0..total-1: cada marco; total: marca Wii.
  const [step, setStep] = useState(-1);
  const [leaving, setLeaving] = useState(false);
  const [flat, setFlat] = useState(false); // sem WebGL: as obras entram como imagens
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [saved] = useState(loadQuality);
  const [mode, setMode] = useState<Mode>(saved.mode);
  const modeRef = useRef(mode);
  const [level, setLevel] = useState<number>();
  const remembered = useRef(saved);
  const clock = useRef(0);
  const done = useRef(onDone);
  done.current = onDone;

  const skip = useCallback(() => { clock.current = Math.max(clock.current, FADE_AT); }, []);

  useEffect(() => {
    document.body.classList.add('intro-active');
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') skip(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('intro-active');
      window.removeEventListener('keydown', onKey);
    };
  }, [skip]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = createIntroScene(canvas, historicDrawings.map((item) => item.image), 'Wii');
    if (!scene) setFlat(true);
    const lost = () => setFlat(true);
    canvas.addEventListener('webglcontextlost', lost);

    let raf = 0;
    let last = performance.now();
    const signature = scene ? `${scene.renderer}|${window.screen.width}x${window.screen.height}@${window.devicePixelRatio}` : '';
    let governor = createGovernor(levelOf('medium'));
    let applied: Mode | undefined;
    let measured: number | undefined;
    const keep = (next: number) => {
      measured = next;
      remembered.current = { mode: modeRef.current, level: next, signature, at: Date.now() };
      saveQuality(remembered.current);
    };
    const tick = (now: number) => {
      const elapsed = now - last;
      clock.current += Math.min(elapsed / 1000, .1); // aba escondida não pula a história
      last = now;
      const t = clock.current;
      if (t >= END) { done.current(); return; }
      raf = requestAnimationFrame(tick);
      // Na saída o quadro e o texto ficam congelados e apenas se apagam, mesmo ao pular no meio.
      if (t >= FADE_AT) {
        setLeaving(true);
        if (t >= FADE_AT + VEIL) document.body.classList.remove('intro-active'); // solta a entrada da página
        return;
      }
      setStep(t >= OUTRO_AT ? total : t >= LEAD ? Math.floor((t - LEAD) / SHOT) : -1);
      if (!scene) return;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const tall = width < height;
      const camera = cameraAt(t, calm);
      const motion = calm ? 0 : t;
      // Câmera na mão: um balanço lento, que cresce nas camadas próximas.
      const swayX = calm ? 0 : Math.sin(t * .23) * .012 + Math.sin(t * .51) * .005;
      const swayY = calm ? 0 : Math.cos(t * .19) * .01;
      const layers: Layer[] = [];

      // De trás para a frente, para as próximas cobrirem as distantes.
      for (let index = total - 1; index >= 0; index--) {
        const ahead = index - camera;
        const depth = 1 + ahead * (ahead > 0 ? 1.15 : .62);
        if (depth < .22 || depth > 5) continue;
        const aspect = scene.aspect(index) ?? 1.5;
        const maxW = width * (tall ? .96 : .5);
        const maxH = height * (tall ? .46 : .74);
        const w = Math.min(maxW, maxH * aspect);
        const scale = (1 / depth) * (1 + (calm ? 0 : clamp((t - LEAD) / SHOT - index) * .05));
        const x = tall ? side(index) * width * .04 : side(index) * width * .19;
        const y = tall ? -height * .14 : -height * .02;
        const shown = clamp((t - LEAD + .6) / 1.6) * (1 - clamp((t - OUTRO_AT + .2) / 1.4));
        const presence = ahead >= 0 ? Math.exp(-ahead * 1.5) : clamp(1 + ahead * 1.5);
        layers.push({
          texture: index,
          x: width / 2 + (x + swayX * width) * scale,
          y: height / 2 + (y + swayY * height) * scale,
          w: (w / 2) * scale,
          h: (w / aspect / 2) * scale,
          alpha: presence * shown,
          blur: Math.min(.05, Math.abs(ahead) * .032),
          gain: .86,
          feather: 1,
        });
      }

      // A marca abre a história, recua para a névoa e volta no fim.
      const opening = ease(t / 2.4) * (1 - ease((t - LEAD + 1.6) / 1.6));
      const closing = ease((t - OUTRO_AT - .5) / 1.8);
      const strength = Math.max(opening * .9, closing);
      const markW = Math.min(width * .8, height * 1.1) * (closing ? .9 + closing * .1 : .82 + clamp(t / LEAD) * .18);
      layers.push({
        texture: total,
        x: width / 2 + swayX * width * .6,
        y: height * (closing ? .5 : .4) + swayY * height * .6,
        w: markW / 2,
        h: markW / 4,
        alpha: strength,
        blur: calm ? 0 : (1 - (closing || ease(t / 2.4))) * .045,
        gain: .94,
        feather: 0,
      });

      const index = Math.round(Math.min(total - 1, Math.max(0, camera)));
      const lit = t >= LEAD && t < OUTRO_AT;
      const chosen = modeRef.current;
      if (chosen !== applied) {
        applied = chosen;
        if (chosen === 'auto') governor = createGovernor(measured ?? levelOf('medium'));
        saveQuality({ ...remembered.current, mode: chosen });
      }
      let quality: number;
      if (chosen === 'auto') {
        const before = governor.level;
        quality = governor.sample(elapsed);
        if (quality !== before) keep(quality);
      } else quality = levelOf(chosen);
      setLevel(quality);
      scene.render({
        time: motion,
        travel: calm ? 0 : camera + Math.min(t, LEAD) * .04,
        lightX: lit && !tall ? side(index) * .36 * (width / height) * .6 : 0,
        lightY: lit && tall ? -.14 : -.03,
        glow: .8 + strength * .5,
        fade: Math.max(1 - clamp(t / 1.4), 0),
        layers,
      }, quality);
    };
    // Sem perfil válido salvo, mede antes de começar a história (a tela ainda está preta).
    const start = (first: number | undefined) => {
      if (first !== undefined) { measured = first; governor = createGovernor(first); }
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const reused = reusableLevel(remembered.current, signature, Date.now());
    let cancel = () => {};
    if (scene && modeRef.current === 'auto' && reused === undefined) cancel = benchmark(scene, (found) => { keep(found); start(found); });
    else start(reused);
    return () => {
      cancel();
      cancelAnimationFrame(raf);
      canvas.removeEventListener('webglcontextlost', lost);
      scene?.dispose();
    };
  }, [calm]);

  // Trocar o modo vale na hora; voltar para "auto" descarta a medida e mede de novo na próxima abertura.
  const cycleMode = () => {
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    if (next === 'auto') remembered.current = { mode: next };
    modeRef.current = next;
    setMode(next);
    saveQuality({ ...remembered.current, mode: next });
  };
  const shownTier = level === undefined ? undefined : LADDER[level].tier;

  const current = step >= 0 && step < total ? historicDrawings[step] : undefined;

  return (
    <div
      className={`intro${leaving ? ' is-leaving' : ''}${calm ? ' is-calm' : ''}${flat ? ' is-flat' : ''}`}
      role="dialog"
      aria-label={tr('Abertura do Wii', 'Wii opening')}
      data-quality={level === undefined ? undefined : `${shownTier}:${level}`}
      style={{ '--shot': `${SHOT}s`, '--lead': `${LEAD}s` } as CSSProperties}
    >
      <canvas className="intro-canvas" ref={canvasRef} aria-hidden="true" />
      {flat && (step === -1 || step === total) && <div className="intro-flat-mark" aria-hidden="true">Wii</div>}

      {step === -1 && OPENING.map((line, index) => (
        <p className="intro-line" key={line.pt} style={{ '--n': index } as CSSProperties}>{tr(line.pt, line.en)}</p>
      ))}

      <div aria-live="polite">
        {current && (
          <div className={`intro-shot${step % 2 ? ' is-right' : ''}`} key={step}>
            <img className="intro-art" src={current.image} alt={tr(current.alt.pt, current.alt.en)} />
            <p className="intro-year">{current.year}</p>
            <p className="intro-thought">{tr(current.thought.pt, current.thought.en)}</p>
            <p className="intro-credit">{tr(current.title.pt, current.title.en)} — {tr(current.artist.pt, current.artist.en)}</p>
          </div>
        )}
      </div>

      <p className="intro-note">{tr('Falas imaginadas, inspiradas nos criadores e nas obras.', 'Imagined lines, inspired by the creators and their work.')}</p>
      {!flat && <button className="intro-quality" type="button" onClick={cycleMode}>
        {tr('qualidade', 'quality')}: {mode}{mode === 'auto' && shownTier ? ` · ${shownTier}` : ''}
      </button>}
      <button className="intro-skip" type="button" onClick={skip}>{tr('pular', 'skip')} <span aria-hidden="true">→</span></button>
    </div>
  );
}

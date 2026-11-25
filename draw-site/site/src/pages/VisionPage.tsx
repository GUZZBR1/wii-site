import { useEffect, useRef } from 'react';
import VisionAsciiPortrait from '../components/VisionAsciiPortrait';
import { useLang } from '../i18n';
import type { Bilingual } from '../i18n';

const TITLE_ONE: Bilingual = { pt: 'O controle é só', en: 'The controller is just' };
const TITLE_TWO: Bilingual = { pt: 'o começo.', en: 'the beginning.' };
const SIGNOFF: Bilingual = { pt: 'do corpo ao jogo, sem nada na mão.', en: 'from body to game, nothing in your hand.' };

const PARAGRAPHS: Bilingual[] = [
  {
    pt: 'A gente brinca com o corpo antes de aprender qualquer regra. Antes de decorar botões, ler tutoriais ou ligar um console, vem um gesto simples: correr, pular, bater na bola.',
    en: 'We play with our bodies before learning any rule. Before memorizing buttons, reading tutorials or plugging in a console, there is a simple gesture: running, jumping, hitting the ball.',
  },
  {
    pt: 'Wii transforma esse gesto em controle em tempo real. A webcam acompanha o seu corpo; visão computacional estima a pose e a converte em ações — andar, saltar, trocar de raia, dar uma raquetada — sem controle, sem cabo e sem instalar nada.',
    en: 'Wii turns that gesture into real-time control. The webcam follows your body; computer vision estimates your pose and converts it into actions — walking, jumping, switching lanes, swinging a racket — with no controller, no cable and nothing to install.',
  },
  {
    pt: 'A visão é que o corpo não seja só um sensor. Uma corrida no lugar vira velocidade, um salto vira obstáculo vencido, uma raquetada vira ponto. Tudo roda no navegador, e o vídeo é processado no seu dispositivo, sem sair dele.',
    en: 'The vision is that the body is more than a sensor. Running in place becomes speed, a jump becomes a cleared hurdle, a swing becomes a point. It all runs in the browser, and your video is processed on your device and never leaves it.',
  },
  {
    pt: 'Começamos pela fundação: uma arena arcade com corrida e tênis, rastreamento estável e detecção confiável de cada movimento. O destino é mais ambicioso: mais esportes, mais jogadores e uma arena em que qualquer pessoa joga com o corpo inteiro.',
    en: 'We start with the foundation: an arcade arena with running and tennis, stable tracking and reliable detection of every movement. The destination is more ambitious: more sports, more players and an arena where anyone plays with their whole body.',
  },
];

export default function VisionPage() {
  const { tr } = useLang();
  const titleLineOne = useRef<HTMLSpanElement>(null);
  const titleLineTwo = useRef<HTMLSpanElement>(null);
  const paragraphRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const signoff = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const segments: Array<{ element: HTMLElement; text: string; pace: number }> = [];
    if (titleLineOne.current) segments.push({ element: titleLineOne.current, text: tr(TITLE_ONE.pt, TITLE_ONE.en), pace: 62 });
    if (titleLineTwo.current) segments.push({ element: titleLineTwo.current, text: tr(TITLE_TWO.pt, TITLE_TWO.en), pace: 62 });
    PARAGRAPHS.forEach((paragraph, index) => {
      const element = paragraphRefs.current[index];
      if (element) segments.push({ element, text: tr(paragraph.pt, paragraph.en), pace: 32 });
    });
    if (signoff.current) segments.push({ element: signoff.current, text: tr(SIGNOFF.pt, SIGNOFF.en), pace: 34 });
    // Idioma trocado: apaga o que já foi escrito (inclusive a névoa da revelação) antes de digitar de novo.
    segments.forEach(({ element }) => { element.textContent = ''; });

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reducedMotion = motionPreference.matches;
    if (reducedMotion) {
      segments.forEach(({ element, text }) => { element.textContent = text; });
      return;
    }

    let segmentIndex = 0;
    let letterIndex = 0;
    let timer = 0;
    let revealed = false;

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      window.clearTimeout(timer);
      removeIntent();
      const mists: HTMLSpanElement[] = [];
      segments.forEach(({ element, text }, index) => {
        if (index < segmentIndex) return;
        const rest = index === segmentIndex ? text.slice(letterIndex) : text;
        if (!rest) return;
        const mist = document.createElement('span');
        mist.className = 'vision-mist';
        mist.textContent = rest;
        mist.style.transitionDelay = `${mists.length * 70}ms`;
        element.append(mist);
        mists.push(mist);
      });
      requestAnimationFrame(() => requestAnimationFrame(() => mists.forEach((mist) => mist.classList.add('is-clear'))));
    };

    const RESISTANCE = 260;
    let travel = 0;
    let idle = 0;
    let lastTouchY = 0;
    const push = (distance: number) => {
      if (distance <= 0) return;
      travel += distance;
      window.clearTimeout(idle);
      idle = window.setTimeout(() => { travel = 0; }, 450);
      if (travel >= RESISTANCE) reveal();
    };
    const onWheel = (event: WheelEvent) => {
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      push(event.deltaY * unit);
    };
    const onTouchStart = (event: TouchEvent) => { lastTouchY = event.touches[0].clientY; };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0].clientY;
      push(lastTouchY - y);
      lastTouchY = y;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (['PageDown', 'End', ' ', 'ArrowDown'].includes(event.key)) push(event.key === 'ArrowDown' ? 60 : RESISTANCE);
    };
    const onScroll = () => { if (window.scrollY > 700) reveal(); };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    function removeIntent() {
      window.clearTimeout(idle);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    }

    const writeNext = () => {
      if (motionPreference.matches) {
        removeIntent();
        segments.forEach(({ element, text }) => { element.textContent = text; });
        return;
      }
      const segment = segments[segmentIndex];
      if (!segment) return;
      if (letterIndex >= segment.text.length) {
        segmentIndex += 1;
        letterIndex = 0;
        timer = window.setTimeout(writeNext, segmentIndex < segments.length ? 260 : 0);
        return;
      }

      const letter = segment.text[letterIndex];
      segment.element.append(document.createTextNode(letter));
      letterIndex += 1;
      const pause = letter === '.' || letter === '!' || letter === '?' ? 310
        : letter === ',' ? 150
          : letter === ';' || letter === ':' || letter === '—' ? 190 : 0;
      timer = window.setTimeout(writeNext, (letter === ' ' ? 12 : segment.pace) + pause);
    };

    timer = window.setTimeout(writeNext, 1200);
    return () => { window.clearTimeout(timer); removeIntent(); };
  }, [tr]);

  const titleText = `${tr(TITLE_ONE.pt, TITLE_ONE.en)} ${tr(TITLE_TWO.pt, TITLE_TWO.en)}`;
  const signoffText = tr(SIGNOFF.pt, SIGNOFF.en);

  return (
    <main className="vision-page" id="page-content">
      <VisionAsciiPortrait />
      <header className="vision-intro">
        <h1 className="vision-headline" aria-label={titleText}>
          <span className="vision-title-line" aria-hidden="true" ref={titleLineOne} />
          <span className="vision-title-line" aria-hidden="true" ref={titleLineTwo} />
        </h1>
      </header>

      <div className="vision-copy">
        {PARAGRAPHS.map((paragraph, index) => {
          const text = tr(paragraph.pt, paragraph.en);
          return (
            <p aria-label={text} key={text} ref={(element) => { paragraphRefs.current[index] = element; }} />
          );
        })}
      </div>

      <p className="vision-signoff" aria-label={signoffText}>
        <span aria-hidden="true" ref={signoff} />
      </p>
    </main>
  );
}

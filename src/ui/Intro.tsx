import { useEffect, useState } from 'react';

type Milestone = { year: string; name: string; quote: string; x: number; y: number };

// Falas reimaginadas (não são citações literais), no espírito de cada inventor.
const MILESTONES: Milestone[] = [
  { year: '1490', name: 'Homem Vitruviano', x: 18, y: 30, quote: 'Se o corpo cabe num círculo e num quadrado, dá para medi-lo.' },
  { year: '1878', name: 'Eadweard Muybridge', x: 72, y: 24, quote: 'Um galope só existe em partes. Vou fotografar cada uma.' },
  { year: '1882', name: 'Étienne-Jules Marey', x: 30, y: 68, quote: 'Movimento é uma linha no tempo. Eu só preciso registrá-la.' },
  { year: '1915', name: 'Rotoscópio · Fleischer', x: 78, y: 62, quote: 'E se o desenho seguisse o gesto de uma pessoa de verdade?' },
  { year: '1984', name: 'Captura com marcadores', x: 14, y: 52, quote: 'Pontos de luz no corpo, câmeras em volta. Estúdio inteiro para um passo.' },
  { year: '2006', name: 'Wii Remote', x: 62, y: 40, quote: 'Ninguém precisa de botões. Balance o braço e jogue.' },
  { year: '2010', name: 'Kinect', x: 44, y: 46, quote: 'Sem controle nenhum: você é o controle.' },
];

const ICONS: Record<string, string> = {
  '1490': 'M32 6a26 26 0 1 0 0 52 26 26 0 0 0 0-52ZM8 8h48v48H8ZM32 12v40M12 32h40M32 24l-16 8M32 24l16 8M32 40l-10 12M32 40l10 12',
  '1878': 'M6 14h52v36H6ZM22 14v36M38 14v36M10 38l6-8 4 8M26 38l6-8 4 8M42 38l6-8 4 8',
  '1882': 'M8 52c8-30 14-30 16-10s10 12 14-14 12-10 18 10M12 14h40',
  '1915': 'M32 8a24 24 0 1 0 0 48 24 24 0 0 0 0-48ZM32 8v48M16 20l32 24M16 44l32-24',
  '1984': 'M32 10a5 5 0 1 0 0 .1ZM32 18v20M32 24l-14 8M32 24l14 8M32 38l-10 16M32 38l10 16M18 32h.1M46 32h.1M22 54h.1M42 54h.1',
  '2006': 'M24 6h16a4 4 0 0 1 4 4v44a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4ZM32 18a5 5 0 1 0 0 .1ZM32 34v4M32 44v4',
  '2010': 'M6 22h52v18H6ZM18 31a4 4 0 1 0 0 .1ZM34 31h18M32 40v10M22 54h20',
};

const THOUGHTS = [
  'Como medir um corpo em movimento?',
  'E se uma câmera bastasse?',
  'Cada articulação é só um ponto no espaço.',
  'Será que dá para jogar sem tocar em nada?',
  'Quantos quadros por segundo para capturar um passo?',
  'O corpo já é a interface.',
  'Tem que funcionar no navegador, sem instalar nada.',
];

const STEP_MS = 3200;
const FINALE_MS = 2600;

export function Intro({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(-1);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const ms = reduced ? 1500 : STEP_MS;
    if (step >= MILESTONES.length) return;
    const t = window.setTimeout(() => setStep((s) => s + 1), step < 0 ? 1200 : ms);
    return () => window.clearTimeout(t);
  }, [step]);

  const finale = step >= MILESTONES.length - 1 && step >= 0;
  useEffect(() => {
    if (!finale) return;
    const t1 = window.setTimeout(() => setLeaving(true), FINALE_MS);
    const t2 = window.setTimeout(onDone, FINALE_MS + 1200);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [finale, onDone]);

  const skip = () => { setLeaving(true); window.setTimeout(onDone, 600); };
  const current = MILESTONES[Math.min(step, MILESTONES.length - 1)];
  const spot = step >= 0 ? current : undefined;

  return <div className={`intro${leaving ? ' leaving' : ''}`} role="dialog" aria-label="Apresentação">
    <div className="intro-shade" style={spot ? { ['--sx' as string]: `${spot.x}%`, ['--sy' as string]: `${spot.y}%` } : undefined} />
    {MILESTONES.slice(0, step + 1).map((m, i) => <div key={m.year}
      className={`intro-item${i === step ? ' focus' : ''}`} style={{ left: `${m.x}%`, top: `${m.y}%` }}>
      <svg className="intro-glyph" viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[m.year]} /></svg>
      <small>{m.year}</small>
      <strong>{m.name}</strong>
      {i === step && <p className="intro-bubble" key={m.year}>“{m.quote}”</p>}
    </div>)}
    {step >= 0 && !leaving && <p className="intro-thought" key={`t${step}`} style={step % 2 ? { left: '6%', bottom: '10%' } : { right: '6%', bottom: '14%' }}>{THOUGHTS[step % THOUGHTS.length]}</p>}
    {step < 0 && <p className="intro-lead">Como um corpo vira controle?</p>}
    <button type="button" className="intro-skip" onClick={skip}>PULAR ›</button>
  </div>;
}

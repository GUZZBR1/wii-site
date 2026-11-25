import { type Ref, useEffect, useImperativeHandle, useState } from 'react';
import type { Sport } from './GameCanvas';

type Screen = 'channels' | 'title' | 'sports';

const SPORTS: { id: Sport; name: string; hint: string }[] = [
  { id: 'track', name: 'Corrida', hint: 'Corra no lugar, salte e troque de raia' },
  { id: 'tennis', name: 'Tênis', hint: 'Balance o braço para rebater' },
];

const EMPTY_SLOTS = Array.from({ length: 11 }, (_, i) => `slot-${i}`);

function Logo() {
  return <span className="logo"><b>Wii</b> <i>Sports</i></span>;
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 10_000);
    return () => window.clearInterval(timer);
  }, []);
  return <div className="wii-clock">
    <strong>{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
    <span>{now.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'numeric' })}</span>
  </div>;
}

export interface WiiMenuHandle {
  /** Volta uma tela; devolve false quando já está na primeira. */
  back(): boolean;
}

export function WiiMenu({ ref, initial, onPlay }: { ref?: Ref<WiiMenuHandle>; initial: Screen; onPlay: (sport: Sport) => void }) {
  const [screen, setScreen] = useState<Screen>(initial);
  useImperativeHandle(ref, () => ({
    back() {
      if (screen === 'channels') return false;
      setScreen(screen === 'sports' ? 'title' : 'channels');
      return true;
    },
  }), [screen]);
  const [preview, setPreview] = useState<Sport>('tennis');
  const hint = SPORTS.find((s) => s.id === preview)?.hint;

  if (screen === 'channels') return <section className="menu channels" aria-label="Menu de canais">
    <div className="channel-grid">
      <button type="button" className="channel sports" onClick={() => setScreen('title')}><Logo /></button>
      {EMPTY_SLOTS.map((slot) => <div key={slot} className="channel empty" aria-hidden="true">Wii</div>)}
    </div>
    <footer className="wii-bar">
      <svg viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 20H150C250 20 270 120 380 120H620C730 120 750 20 850 20H1000V200H0Z" />
      </svg>
      <span className="wii-title">Wii Menu</span>
      <Clock />
    </footer>
  </section>;

  if (screen === 'title') return <section className="menu title" aria-label="Wii Sports">
    <div className="title-card">
      <Logo />
      <div className="stripes" />
    </div>
    <div className="title-actions">
      <button type="button" className="wii-btn pill" onClick={() => setScreen('channels')}>Wii Menu</button>
      <button type="button" className="wii-btn pill" onClick={() => setScreen('sports')}>Start</button>
    </div>
  </section>;

  return <section className="menu sports-menu" aria-label="Escolha a modalidade">
    <header className="menu-header">
      <h1>Menu Principal</h1>
      <Logo />
    </header>
    <div className="menu-body">
      <div className="sport-list">
        {SPORTS.map((s) => <button key={s.id} type="button" className={preview === s.id ? 'wii-btn selected' : 'wii-btn'}
          onPointerEnter={() => setPreview(s.id)} onFocus={() => setPreview(s.id)} onClick={() => onPlay(s.id)}>{s.name}</button>)}
        <button type="button" className="wii-btn back" onClick={() => setScreen('title')}>Voltar</button>
      </div>
      <figure className={`preview ${preview}`}>
        <div className="scene" />
        <figcaption>{hint}</figcaption>
      </figure>
    </div>
  </section>;
}

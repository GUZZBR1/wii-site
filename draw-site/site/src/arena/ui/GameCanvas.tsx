import { useEffect, useRef, useState } from 'react';
import type { SportActionEvent } from '../cv/protocol';
import type { GameHudState } from '../games/track/TrackGame';
import { forwardKeyDown } from './keys';

export type Sport = 'track' | 'tennis';
export interface GameEngineHandle { onAction(event: SportActionEvent): void; onKey(key: string): void; setTracking?(tracking: string): void; dispose(): void }

interface Props {
  sport: Sport;
  onEngine: (engine: GameEngineHandle | null) => void;
  tracking: string;
}

/** Restarting remounts the whole run, so a new game starts from a clean engine and canvas. */
export function GameCanvas(props: Props) {
  const [run, setRun] = useState(0);
  return <GameRun key={run} {...props} onRestart={() => setRun((value) => value + 1)} />;
}

function GameRun({ sport, onEngine, tracking, onRestart }: Props & { onRestart: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState<GameHudState>({ score: 0, label: '00000', speed01: 0, status: 'Pronto para jogar' });
  const hudRef = useRef(setHud);
  hudRef.current = setHud;
  const engineRef = useRef<GameEngineHandle | null>(null);
  const trackingRef = useRef(tracking);
  trackingRef.current = tracking;

  useEffect(() => { engineRef.current?.setTracking?.(tracking); }, [tracking]);

  useEffect(() => {
    if (!canvasRef.current) return;
    let game: GameEngineHandle | undefined;
    let disposed = false;
    const keydown = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) event.preventDefault();
      if (!forwardKeyDown(event.key, event.repeat)) return;
      game?.onKey(event.key);
    };
    window.addEventListener('keydown', keydown);
    const mount = async () => {
      try {
        const Game = sport === 'track'
          ? (await import('../games/track/TrackGame')).TrackGame
          : (await import('../games/tennis/TennisGame')).TennisGame;
        const canvas = canvasRef.current;
        if (disposed || !canvas) return;
        const engine: GameEngineHandle = new Game(canvas, (state) => hudRef.current(state));
        if (disposed) { engine.dispose(); return; }
        game = engine;
        engineRef.current = engine;
        engine.setTracking?.(trackingRef.current);
        onEngine(engine);
      } catch (error) {
        if (!disposed) hudRef.current({ score: 0, label: '—', speed01: 0, status: error instanceof Error ? error.message : 'WebGL indisponível' });
      }
    };
    void mount();
    return () => {
      disposed = true;
      window.removeEventListener('keydown', keydown);
      game?.dispose();
      engineRef.current = null;
      onEngine(null);
    };
  }, [sport, onEngine]);

  return <div className="game-viewport">
    <canvas ref={canvasRef} />
    <div className="game-hud"><div><span>{sport === 'track' ? 'SCORE' : 'PONTOS'}</span><strong>{hud.label}</strong>{(hud.combo ?? 0) > 1 && <em>COMBO {hud.combo}</em>}</div><div className="game-speed"><span>{sport === 'track' ? 'RITMO' : 'MIRA'}</span><strong>{sport === 'track' ? `${Math.round(hud.speed01 * 100)}%` : hud.status.split(' · ').at(-1)}</strong></div></div>
    {hud.feedback && <div key={hud.feedback.id} className={`game-feedback ${hud.feedback.kind}`}>
      <span>{hud.feedback.text}</span>
    </div>}
    {hud.banner && <div className="game-banner" role="status"><strong>{hud.banner.title}</strong>{hud.banner.detail && <span>{hud.banner.detail}</span>}</div>}
    {hud.result && <div className="game-over" role="dialog" aria-label="Fim de corrida">
      <h2>Você perdeu!</h2>
      <p>Sua melhor marca nesta corrida: <strong>{hud.result.points}</strong> pontos</p>
      <h3>Seu ranking</h3>
      <ol>{hud.result.ranking.map((points, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the place is the row's identity and scores may repeat
        <li key={index} className={hud.result?.position === index + 1 ? 'current' : ''}><span>{index + 1}º</span><span>{points}</span></li>
      ))}</ol>
      <button type="button" ref={(button) => button?.focus()} onClick={onRestart}>Jogar de novo</button>
    </div>}
    <div className="game-ready"><i className={tracking === 'TRACKING' ? 'ready' : ''} />{hud.status}</div>
    <div className="game-controls">{sport === 'track' ? '← → trocar raia  ·  ↑ / espaço saltar  ·  ↓ andar / correr / parar' : 'espaço bater  ·  ← → escolher direção'}</div>
  </div>;
}

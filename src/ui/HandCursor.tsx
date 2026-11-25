import { useEffect, useState } from 'react';
import type { HandCursorInput } from './handCursorTypes';
import { useHandHitTest } from './useHandHitTest';

const RADIUS = 34;
const LENGTH = 2 * Math.PI * RADIUS;

interface Props {
  input: HandCursorInput;
  /** Falso fora dos menus com a aba de mão: o cursor se despede e deixa de interagir. */
  active: boolean;
  onBack: () => void;
}

export function HandCursor({ input, active, onBack }: Props) {
  useHandHitTest(input, active, onBack);
  // A confirmação dura mais que o frame do pinchRelease; cada clique reinicia a animação pela key.
  const [flash, setFlash] = useState(0);
  useEffect(() => { if (input.pinchRelease) setFlash((count) => count + 1); }, [input.pinchRelease]);

  if (!input.visible) return null;

  const back = input.backProgress > 0;
  const progress = Math.min(1, Math.max(0, back ? input.backProgress : input.synced ? 0 : input.syncProgress));
  const classes = ['hand-cursor', back ? 'back' : '', input.pinching ? 'pinching' : '', active ? '' : 'leaving'].filter(Boolean).join(' ');

  return <div className="hand-layer" aria-hidden="true">
    <div className={classes} style={{ transform: `translate3d(${input.x}px, ${input.y}px, 0)` }}>
      <div className="hand-body">
        <svg className="hand-ring" viewBox="0 0 80 80" aria-hidden="true">
          <circle className="track" cx="40" cy="40" r={RADIUS} />
          <circle className="fill" cx="40" cy="40" r={RADIUS} strokeDasharray={LENGTH} strokeDashoffset={LENGTH * (1 - progress)} />
        </svg>
        {/* A ponta do indicador fica exatamente em (x, y). */}
        <svg className="hand-icon" viewBox="0 0 32 40" aria-hidden="true">
          <path d="M11 4a3 3 0 0 1 6 0v13l2-1a3 3 0 0 1 4 1 3 3 0 0 1 4 1c3 0 4 2 4 5v5c0 7-4 11-11 11-5 0-7-2-10-6l-6-9c-2-3 2-6 4-3l3 3z" />
        </svg>
        {back && <span className="hand-badge">↩</span>}
      </div>
      {flash > 0 && <span className="hand-flash" key={flash} />}
    </div>
  </div>;
}

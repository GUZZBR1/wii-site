import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLang } from '../i18n';

// Frases dos balões: cada ocorrência de "Wii" ganha a próxima frase ainda não usada.
const TIPS: { pt: string; en: string }[] = [
  { pt: 'Seu corpo é o controle.', en: 'Your body is the controller.' },
  { pt: 'Sem fio, sem controle, só você.', en: 'No cable, no controller, just you.' },
  { pt: 'Salte de verdade.', en: 'Jump for real.' },
  { pt: 'Incline o tronco para trocar de raia.', en: 'Lean your torso to switch lanes.' },
  { pt: 'Corra no lugar, o corpo faz o resto.', en: 'Run in place, the body does the rest.' },
  { pt: 'Fique parado quatro segundos e a câmera calibra.', en: 'Stand still for four seconds and the camera calibrates.' },
  { pt: 'Uma raquetada vale mais que mil cliques.', en: 'One racket swing beats a thousand clicks.' },
  { pt: 'O vídeo nunca sai do seu dispositivo.', en: 'The video never leaves your device.' },
  { pt: 'Enquadre o corpo inteiro para correr.', en: 'Frame your whole body to run.' },
  { pt: 'No tênis, chegue mais perto da câmera.', en: 'In tennis, step closer to the camera.' },
  { pt: 'Sem câmera? Setas e espaço também jogam.', en: 'No camera? Arrow keys and space play too.' },
  { pt: 'Trinta e três pontos, um jogador.', en: 'Thirty-three landmarks, one player.' },
  { pt: 'Aqueça antes de jogar.', en: 'Warm up before you play.' },
  { pt: 'Mão firme, raquetada limpa.', en: 'Steady hand, clean swing.' },
  { pt: 'Todo recorde começa no primeiro passo.', en: 'Every record starts with a first step.' },
  { pt: 'Mais um round?', en: 'One more round?' },
  { pt: 'Bata na bola, não na parede.', en: 'Hit the ball, not the wall.' },
  { pt: 'Respire entre as barreiras.', en: 'Breathe between hurdles.' },
  { pt: 'Tropeçar na barreira também ensina.', en: 'Hitting a hurdle teaches too.' },
  { pt: 'Pose é só um jeito de dizer movimento.', en: 'Pose is just a way of saying movement.' },
  { pt: 'Luz boa, rastreio melhor.', en: 'Good light, better tracking.' },
  { pt: 'Dê espaço antes de pular.', en: 'Make room before you jump.' },
  { pt: 'A arena abre no navegador, sem instalar nada.', en: 'The arena opens in the browser, nothing to install.' },
  { pt: 'Hoje é dia de bater o seu recorde.', en: 'Today is a good day to beat your record.' },
];

const WORD = 'Wii';

type Hit = { rect: DOMRect; node: Node; offset: number };

function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  const r = doc.caretRangeFromPoint?.(x, y);
  return r ? { node: r.startContainer, offset: r.startOffset } : null;
}

// Acha a palavra "Wii" sob o ponteiro, em qualquer texto da página (sem marcar nada no HTML).
function findWord(x: number, y: number, target: EventTarget | null): Hit | null {
  const el = target instanceof Element ? target : null;
  if (!el || el.closest('.draw-tip, .wordmark, input, textarea, canvas')) return null;
  const caret = caretAt(x, y);
  if (!caret || caret.node.nodeType !== Node.TEXT_NODE) return null;
  // Junta os nós de texto vizinhos (a máquina de escrever da Vision deixa uma letra por nó).
  const run: Text[] = [];
  let first: Node = caret.node;
  while (first.previousSibling?.nodeType === Node.TEXT_NODE) first = first.previousSibling;
  for (let n: Node | null = first; n?.nodeType === Node.TEXT_NODE; n = n.nextSibling) run.push(n as Text);
  const starts: number[] = [];
  let text = '';
  for (const n of run) { starts.push(text.length); text += n.data; }
  const at = run.indexOf(caret.node as Text);
  const isLetter = (c: string) => /\p{L}/u.test(c);
  let a = Math.min(starts[at] + caret.offset, text.length);
  let b = a;
  while (a > 0 && isLetter(text[a - 1])) a--;
  while (b < text.length && isLetter(text[b])) b++;
  if (text.slice(a, b) !== WORD) return null;
  const locate = (pos: number, end: boolean) => {
    let k = starts.length - 1;
    while (k > 0 && (end ? starts[k] >= pos : starts[k] > pos)) k--;
    return { node: run[k], offset: pos - starts[k] };
  };
  const from = locate(a, false);
  const to = locate(b, true);
  const range = document.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  const rect = range.getBoundingClientRect();
  const slack = 3;
  if (x < rect.left - slack || x > rect.right + slack || y < rect.top - slack || y > rect.bottom + slack) return null;
  // Identidade estável: primeiro nó da sequência + deslocamento (não depende de outros textos da página).
  return { rect, node: run[0], offset: a };
}

export default function DrawTip() {
  const { lang } = useLang();
  const [tip, setTip] = useState<{ left: number; top: number; below: boolean; index: number } | null>(null);
  const assigned = useRef(new WeakMap<Node, Map<number, number>>());
  const used = useRef(0);
  const keyRef = useRef<{ node: Node; offset: number } | null>(null);

  useEffect(() => {
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const hit = findWord(e.clientX, e.clientY, e.target);
        if (!hit) { keyRef.current = null; setTip((t) => (t ? null : t)); return; }
        if (keyRef.current?.node === hit.node && keyRef.current.offset === hit.offset) return;
        keyRef.current = { node: hit.node, offset: hit.offset };
        let byOffset = assigned.current.get(hit.node);
        if (!byOffset) { byOffset = new Map(); assigned.current.set(hit.node, byOffset); }
        let index = byOffset.get(hit.offset);
        if (index === undefined) {
          index = used.current++ % TIPS.length;
          byOffset.set(hit.offset, index);
        }
        const below = hit.rect.top < 70;
        const left = Math.min(Math.max(hit.rect.left + hit.rect.width / 2, 130), window.innerWidth - 130);
        setTip({ left, top: below ? hit.rect.bottom + 12 : hit.rect.top - 12, below, index });
      });
    };
    const hide = () => { keyRef.current = null; setTip(null); };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', hide);
    window.addEventListener('scroll', hide, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', hide);
      window.removeEventListener('scroll', hide);
    };
  }, []);

  if (!tip) return null;
  const phrase = TIPS[tip.index];
  return (
    <div
      className={`draw-tip${tip.below ? ' is-below' : ''}`}
      style={{ left: tip.left, top: tip.top, '--tint': `${12 + (tip.index % 6) * 5}%` } as CSSProperties}
      aria-hidden="true"
    >
      {lang === 'en' ? phrase.en : phrase.pt}
    </div>
  );
}

// Entrada na arena: túnel de dobra radial. Riscos coloridos em perspectiva avançam para a câmera,
// o rastro (quadro anterior só parcialmente apagado) faz o desfoque de movimento, e tudo termina
// em branco, emendando no flash da arena.
const DURATION = 2300;
const STREAKS = 620;
// Paleta do projeto (design.md): azuis do site, com o laranja do Wii em poucos riscos.
const COLORS = ['#34beed', '#34beed', '#34beed', '#1a8fc4', '#1a8fc4', '#ade4f8', '#0b6f9e', '#f59b3c'];
const FAR = 3;
const NEAR = .06;

type Streak = { angle: number; radius: number; z: number; color: string; width: number };

const clamp = (v: number) => Math.min(1, Math.max(0, v));

const spawn = (z: number): Streak => ({
  angle: Math.random() * Math.PI * 2,
  radius: .12 + Math.random() ** .7 * .9, // miolo vazio: é o fundo do túnel
  z,
  color: COLORS[Math.floor(Math.random() * COLORS.length)],
  width: .6 + Math.random() * 1.8,
});

export function runWarp(onCovered: () => void): () => void {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:90;opacity:0';
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const cx = w / 2;
  const cy = h / 2;
  const focal = Math.hypot(cx, cy) * .55;

  const streaks = Array.from({ length: STREAKS }, () => spawn(NEAR + Math.random() * FAR));
  let raf = 0;
  let start = 0;
  let last = 0;
  let covered = false;
  let twist = 0;

  const finish = () => {
    cancelAnimationFrame(raf);
    canvas.remove();
  };

  const frame = (now: number) => {
    if (!start) { start = now; last = now; }
    const dt = Math.min((now - last) / 1000, .05);
    last = now;
    const t = clamp((now - start) / DURATION);
    canvas.style.opacity = String(clamp(t / .14));
    const speed = .25 + 5.5 * t ** 2.4; // acelera até o salto
    twist += dt * (.15 + t * .5);

    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      // apaga só em parte: o que sobra do quadro anterior é o borrão
      ctx.fillStyle = `rgba(244, 248, 250, ${1 - Math.exp(-dt * (22 - 12 * t))})`;
      ctx.fillRect(0, 0, w, h);
      ctx.lineCap = 'round';
      for (let i = 0; i < streaks.length; i += 1) {
        const s = streaks[i];
        s.z -= speed * dt;
        if (s.z <= NEAR) { streaks[i] = spawn(FAR * (.7 + Math.random() * .3)); continue; }
        const angle = s.angle + twist;
        const head = (s.radius * focal) / s.z;
        const tail = (s.radius * focal) / Math.min(FAR, s.z + speed * .07);
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = clamp((FAR - s.z) / 1.2);
        ctx.lineWidth = Math.min(7, s.width / s.z);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * tail, cy + Math.sin(angle) * tail);
        ctx.lineTo(cx + Math.cos(angle) * head, cy + Math.sin(angle) * head);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // clarão no fim do túnel, que cresce até tomar a tela
      const flare = clamp((t - .72) / .28) ** 2;
      const radius = 40 + t * 90 + flare * Math.hypot(w, h);
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      glow.addColorStop(0, `rgba(255, 255, 255, ${.8 + .2 * flare})`);
      glow.addColorStop(1, 'rgba(173, 228, 248, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = `rgba(255, 255, 255, ${clamp((t - .82) / .18)})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (t < 1) raf = requestAnimationFrame(frame);
    else if (!covered) { covered = true; onCovered(); }
  };

  raf = requestAnimationFrame(frame);
  return finish;
}

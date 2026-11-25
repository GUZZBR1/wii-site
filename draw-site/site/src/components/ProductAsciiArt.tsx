import { useEffect, useRef } from 'react';
import { cellNoise, chooseGlyph, cssColor, inkOnLight, luminance, parseRgb, rankGlyphs } from '../lib/ascii';

const SAMPLE_SIZE = 3;
const REVEAL_DURATION = 4.6;
const REVEAL_FADE = 0.09;
const ALT = 'Um macaco de capacete conversa com um australopiteco sobre uma planta de obra, enquanto um neandertal segura uma britadeira ao lado de uma maquete.';

// Cor da tinta no tema claro: tons naturais (marrons e pele nao viram preto)
// e branco trocado por um cinza suave.
function lightInk(red: number, green: number, blue: number, ink: string, muted: string, deep = false) {
  if (Math.max(red, green, blue) < 45) return ink;
  if (luminance([red, green, blue]) > 0.72) return deep ? 'rgb(96, 76, 56)' : muted;
  if (deep) return inkOnLight(red, green, blue, 0.05, 1.7);
  // Mesma paleta do tema escuro, so um pouco mais profunda para ler no papel.
  const tone = (value: number) => Math.round(Math.max(0, Math.min(255, (value * 1.3 + 30) * (deep ? 0.55 : 0.8))));
  return `rgb(${tone(red)}, ${tone(green)}, ${tone(blue)})`;
}

type Cell = { character: string; fill: string; appearAt: number; x: number; y: number };

type Props = { src?: string; alt?: string; className?: string; decorative?: boolean; richLight?: boolean };

export default function ProductAsciiArt({ src = '/images/product-construction-diorama.png', alt = ALT, className = 'construction-ascii', decorative = false, richLight = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const output = canvas?.getContext('2d');
    if (!canvas || !host || !output) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const image = new Image();
    image.src = src;
    const source = document.createElement('canvas');
    const sourceContext = source.getContext('2d', { willReadFrequently: true });
    if (!sourceContext) return;

    let cells: Cell[] = [];
    let cursor = 0;
    let firstActive = 0;
    let frame = 0;
    let startTime = 0;
    let disposed = false;
    let cellW = 0;
    let cellH = 0;
    let fontSize = 0;
    let lastWidth = 0;
    let lastLight: boolean | null = null;
    let outputWidth = 0;
    let outputHeight = 0;

    const layout = () => {
      const box = canvas.getBoundingClientRect();
      if (!box.width || !image.naturalWidth) return false;
      const light = luminance(parseRgb(cssColor(host, '--paper', '#f7f7f4'))) > 0.5;
      lastWidth = box.width;
      lastLight = light;
      fontSize = Math.max(4.5, Math.min(7, box.width * 0.0072));
      output.font = `${fontSize}px "DM Mono", monospace`;
      cellW = output.measureText('M').width;
      cellH = fontSize * 1.12;
      const cols = Math.floor(box.width / cellW);
      const rows = Math.max(1, Math.round((cols * cellW * image.naturalHeight) / (image.naturalWidth * cellH)));
      outputWidth = box.width;
      outputHeight = rows * cellH;
      canvas.style.height = `${outputHeight}px`;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(outputWidth * dpr);
      canvas.height = Math.round(outputHeight * dpr);
      output.setTransform(dpr, 0, 0, dpr, 0, 0);
      output.font = `${fontSize}px "DM Mono", monospace`;
      output.textBaseline = 'top';
      const glyphs = rankGlyphs(output.font, cellW, cellH);

      source.width = cols * SAMPLE_SIZE;
      source.height = rows * SAMPLE_SIZE;
      sourceContext.clearRect(0, 0, source.width, source.height);
      sourceContext.imageSmoothingQuality = 'high';
      sourceContext.drawImage(image, 0, 0, source.width, source.height);
      const pixels = sourceContext.getImageData(0, 0, source.width, source.height).data;
      const total = cols * rows;
      const tones = new Float32Array(total);
      const coverage = new Float32Array(total);
      const rgb = new Float32Array(total * 3);
      const samples = SAMPLE_SIZE * SAMPLE_SIZE;

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          let red = 0;
          let green = 0;
          let blue = 0;
          let alpha = 0;
          for (let sy = 0; sy < SAMPLE_SIZE; sy += 1) {
            let offset = ((row * SAMPLE_SIZE + sy) * source.width + col * SAMPLE_SIZE) * 4;
            for (let sx = 0; sx < SAMPLE_SIZE; sx += 1) {
              const weight = pixels[offset + 3] / 255;
              red += pixels[offset] * weight;
              green += pixels[offset + 1] * weight;
              blue += pixels[offset + 2] * weight;
              alpha += weight;
              offset += 4;
            }
          }
          const index = row * cols + col;
          coverage[index] = alpha / samples;
          if (coverage[index] < 0.3) continue;
          rgb[index * 3] = red / alpha;
          rgb[index * 3 + 1] = green / alpha;
          rgb[index * 3 + 2] = blue / alpha;
          tones[index] = luminance([rgb[index * 3], rgb[index * 3 + 1], rgb[index * 3 + 2]]) ** (1 / 2.2);
        }
      }

      const solid = new Float32Array(total);
      let solidCount = 0;
      for (let index = 0; index < total; index += 1) if (coverage[index] >= 0.3) solid[solidCount++] = tones[index];
      const sorted = solid.subarray(0, solidCount).sort();
      const low = sorted[Math.floor(solidCount * 0.02)] ?? 0;
      const high = sorted[Math.floor(solidCount * 0.98)] ?? 1;

      const horizontal = new Float32Array(total);
      const weights = new Float32Array(total);
      const sums = new Float32Array(total);
      const counts = new Float32Array(total);
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          let sum = 0;
          let count = 0;
          for (let dx = -2; dx <= 2; dx += 1) {
            const x = col + dx;
            if (x < 0 || x >= cols || coverage[row * cols + x] < 0.3) continue;
            sum += tones[row * cols + x];
            count += 1;
          }
          horizontal[row * cols + col] = sum;
          weights[row * cols + col] = count;
        }
      }
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          let sum = 0;
          let count = 0;
          for (let dy = -2; dy <= 2; dy += 1) {
            const y = row + dy;
            if (y < 0 || y >= rows) continue;
            sum += horizontal[y * cols + col];
            count += weights[y * cols + col];
          }
          sums[row * cols + col] = sum;
          counts[row * cols + col] = count;
        }
      }

      const ink = cssColor(host, '--ink', '#22231f');
      const muted = cssColor(host, '--muted', '#777870');
      const maxDarkness = glyphs[0].darkness;
      const channel = (value: number) => Math.round(Math.max(0, Math.min(255, value * 1.3 + 30)));
      const next: Cell[] = [];
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const index = row * cols + col;
          if (coverage[index] < 0.3) continue;
          const stretched = Math.max(0, Math.min(1, (tones[index] - low) / Math.max(0.01, high - low)));
          const detail = tones[index] - (counts[index] ? sums[index] / counts[index] : 0);
          const base = light ? 1 - stretched : 0.18 + 0.82 * stretched;
          const density = Math.max(light ? (richLight ? 0.75 : 0.22) : 0.08, Math.min(1, base + (light ? -4 : 4) * detail)) * Math.min(1, coverage[index] * 1.4);
          const glyph = chooseGlyph(glyphs, density * maxDarkness);
          if (glyph.darkness < (light ? 0.004 : 0.012)) continue;
          next.push({
            character: glyph.character,
            fill: light
              ? lightInk(rgb[index * 3], rgb[index * 3 + 1], rgb[index * 3 + 2], ink, muted, richLight)
              : `rgb(${channel(rgb[index * 3])}, ${channel(rgb[index * 3 + 1])}, ${channel(rgb[index * 3 + 2])})`,
            appearAt: (row / rows) * 0.55 + cellNoise(col, row) * 0.4,
            x: col * cellW,
            y: row * cellH,
          });
        }
      }
      cells = next.sort((a, b) => a.appearAt - b.appearAt);
      return true;
    };

    const drawCell = (cell: Cell, alpha: number) => {
      output.clearRect(cell.x, cell.y, cellW, cellH);
      output.globalAlpha = alpha;
      output.fillStyle = cell.fill;
      output.fillText(cell.character, cell.x, cell.y);
    };

    const draw = (timestamp: number) => {
      frame = 0;
      const reveal = reducedMotion.matches ? 1 : Math.min(1, (timestamp - startTime) / 1000 / REVEAL_DURATION);
      const threshold = reveal * (1 + REVEAL_FADE);
      while (cursor < cells.length && cells[cursor].appearAt <= threshold) cursor += 1;
      while (firstActive < cursor && (threshold - cells[firstActive].appearAt) / REVEAL_FADE >= 1) {
        drawCell(cells[firstActive], 1);
        firstActive += 1;
      }
      for (let index = firstActive; index < cursor; index += 1) drawCell(cells[index], (threshold - cells[index].appearAt) / REVEAL_FADE);
      output.globalAlpha = 1;
      if (firstActive < cells.length) frame = requestAnimationFrame(draw);
    };

    const begin = (keepProgress: boolean) => {
      cancelAnimationFrame(frame);
      if (!layout()) return;
      cursor = 0;
      firstActive = 0;
      if (!keepProgress) startTime = performance.now();
      frame = requestAnimationFrame(draw);
    };

    const start = () => {
      if (disposed) return;
      window.setTimeout(() => {
        if (!disposed) begin(false);
      }, 120);
    };

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (cells.length && Math.abs(entry.contentRect.width - lastWidth) > 0.5) begin(true);
    });
    resizeObserver.observe(host);

    const themeObserver = new MutationObserver(() => {
      if (!cells.length) return;
      const light = luminance(parseRgb(cssColor(host, '--paper', '#f7f7f4'))) > 0.5;
      if (light !== lastLight) begin(true);
    });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    void Promise.all([document.fonts.ready, image.decode()]).then(start).catch(() => undefined);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
    };
  }, [src]);

  return (
    <div className={className} {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': alt })}>
      <canvas aria-hidden="true" className="construction-ascii-canvas" ref={canvasRef} />
    </div>
  );
}

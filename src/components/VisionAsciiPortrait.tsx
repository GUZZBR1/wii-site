import { useEffect, useRef } from 'react';

import { cellNoise, chooseGlyph, cssColor, interpolateInto, luminance, parseRgb, portraitColor, rankGlyphs, smoothstep, type RankedGlyph } from '../lib/ascii';

const SAMPLE_SIZE = 3;
const REVEAL_DURATION = 2.8;
const REVEAL_LEAD = 2.1;
const REVEAL_FADE = 0.09;

function eyeMask(x: number, y: number, centerX: number) {
  const distance = Math.hypot((x - centerX) / 0.052, (y - 0.432) / 0.067);
  return 1 - smoothstep(0.72, 1.08, distance);
}

function motionPulse(elapsed: number, start: number, duration: number, period: number) {
  const phase = ((elapsed - start) % period + period) % period;
  if (elapsed < start || phase >= duration) return 0;
  return smoothstep(0, 0.13, phase) * (1 - smoothstep(duration - 0.13, duration, phase));
}

export default function VisionAsciiPortrait() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const output = canvas?.getContext('2d');
    if (!canvas || !host || !output) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const closedImage = new Image();
    const openImage = new Image();
    closedImage.src = '/images/vision/sailor-moon-eyes-closed.png';
    openImage.src = '/images/vision/sailor-moon-eyes-open.png';
    const source = document.createElement('canvas');
    const sourceContext = source.getContext('2d', { willReadFrequently: true });
    if (!sourceContext) return;

    let ink = '';
    let muted = '';
    let paper = [247, 247, 244];
    let paperLightness = luminance(paper);
    let closedPixels: Uint8ClampedArray | null = null;
    let openPixels: Uint8ClampedArray | null = null;
    let glyphs: RankedGlyph[] = [];
    const scratchClosed = [0, 0, 0, 0];
    const scratchOpen = [0, 0, 0, 0];
    let frame = 0;
    let lastPaint = 0;
    let startTime = performance.now();
    let inView = true;
    let disposed = false;
    let cols = 0;
    let rows = 0;
    let cellW = 0;
    let cellH = 0;
    let outputWidth = 0;
    let outputHeight = 0;
    let fontSize = 0;

    const updatePalette = () => {
      ink = cssColor(host, '--ink', '#22231f');
      muted = cssColor(host, '--muted', '#777870');
      paper = parseRgb(cssColor(host, '--paper', '#f7f7f4'));
      paperLightness = luminance(paper);
    };

    const layout = () => {
      const box = canvas.getBoundingClientRect();
      if (!box.width) return;
      fontSize = Math.max(6, Math.min(10, box.width * 0.02));
      output.font = `${fontSize}px "DM Mono", monospace`;
      cellW = output.measureText('M').width;
      cellH = fontSize * 1.12;
      cols = Math.floor(box.width / cellW);
      const aspect = closedImage.naturalWidth && closedImage.naturalHeight
        ? closedImage.naturalWidth / closedImage.naturalHeight
        : 1.1;
      rows = Math.max(1, Math.round((cols * cellW) / (aspect * cellH)));
      outputWidth = box.width;
      outputHeight = rows * cellH;
      canvas.style.height = `${outputHeight}px`;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(outputWidth * dpr);
      canvas.height = Math.round(outputHeight * dpr);
      output.setTransform(dpr, 0, 0, dpr, 0, 0);
      output.font = `${fontSize}px "DM Mono", monospace`;
      output.textBaseline = 'top';
      glyphs = rankGlyphs(output.font, cellW, cellH);

      source.width = cols * SAMPLE_SIZE;
      source.height = rows * SAMPLE_SIZE;
      if (closedImage.complete && openImage.complete && closedImage.naturalWidth && openImage.naturalWidth) {
        sourceContext.clearRect(0, 0, source.width, source.height);
        sourceContext.drawImage(closedImage, 0, 0, source.width, source.height);
        closedPixels = sourceContext.getImageData(0, 0, source.width, source.height).data;
        sourceContext.clearRect(0, 0, source.width, source.height);
        sourceContext.drawImage(openImage, 0, 0, source.width, source.height);
        openPixels = sourceContext.getImageData(0, 0, source.width, source.height).data;
      }
    };

    const draw = (timestamp: number) => {
      frame = 0;
      if (!closedPixels || !openPixels || !glyphs.length) return;
      if (!reducedMotion.matches && timestamp - lastPaint < 45) {
        frame = requestAnimationFrame(draw);
        return;
      }
      lastPaint = timestamp;
      const clock = (timestamp - startTime) / 1000;
      const elapsed = Math.max(0, clock - REVEAL_LEAD);
      const reveal = reducedMotion.matches ? 1 : Math.min(1, clock / REVEAL_DURATION);
      const opening = reducedMotion.matches ? 1 : Math.max(0, Math.min(1, (elapsed - 0.35) / 1.05));
      const eyeOpen = opening * opening * (3 - 2 * opening);
      const hairFlow = reducedMotion.matches ? 0 : Math.min(1, smoothstep(1.1, 2.5, elapsed));
      const blink = reducedMotion.matches ? 0 : motionPulse(elapsed, 2.8, 0.34, 5.4);
      const wink = reducedMotion.matches ? 0 : motionPulse(elapsed, 4.2, 0.58, 8.2);
      const errors = new Float32Array(cols * rows);
      const densities = new Float32Array(cols * rows);
      const colors = new Array<string>(cols * rows);
      const closed = scratchClosed;
      const open = scratchOpen;
      const paperLum = paperLightness;
      let previousFill = '';
      let previousAlpha = 1;

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const horizontal = (col + 0.5) / cols;
          const vertical = (row + 0.5) / rows;
          let red = 0;
          let green = 0;
          let blue = 0;
          let alpha = 0;
          let samples = 0;

          const cellX = (col + 0.5) / cols;
          const cellY = (row + 0.5) / rows;
          const side = cellX < 0.5 ? -1 : 1;
          const hairBand = Math.max(
            1 - smoothstep(0.16, 0.39, cellX),
            smoothstep(0.61, 0.84, cellX),
          ) * smoothstep(0.34, 0.53, cellY) * (1 - smoothstep(0.94, 1, cellY));
          let hairShift = 0;
          if (hairBand > 0 && hairFlow > 0 && !reducedMotion.matches) {
            const wave = Math.sin(elapsed * 0.78 - cellY * 17 + side * 0.6) * 0.5
              + Math.sin(elapsed * 1.13 - cellY * 29 - side * 0.9) * 0.3
              + Math.sin(elapsed * 0.49 - cellY * 9 + side * 1.8) * 0.2;
            hairShift = wave * hairBand * hairFlow * source.width * 0.03;
          }
          const closedBlend = Math.max(
            eyeMask(cellX, cellY, 0.416) * Math.max(1 - eyeOpen, blink, wink),
            eyeMask(cellX, cellY, 0.579) * Math.max(1 - eyeOpen, blink),
          );
          const bodyCurve = smoothstep(0.77, 1, cellY);
          const halfWidth = 0.48 * Math.sqrt(1 - bodyCurve);
          const sideFade = 1 - smoothstep(halfWidth - 0.025, halfWidth + 0.025, Math.abs(cellX - 0.5));
          const alphaMask = (1 - bodyCurve * (1 - sideFade)) * (1 - smoothstep(0.985, 1, cellY));
          if (alphaMask <= 0.001) continue;

          for (let sy = 0; sy < SAMPLE_SIZE; sy += 1) {
            for (let sx = 0; sx < SAMPLE_SIZE; sx += 1) {
              const x = col * SAMPLE_SIZE + sx;
              const y = row * SAMPLE_SIZE + sy;
              const sampleX = Math.max(0, Math.min(source.width - 1, x + hairShift));
              let closedAlpha = 0;
              let openAlpha = 0;
              if (closedBlend > 0) {
                interpolateInto(closed, closedPixels, source.width, source.height, sampleX, y);
                closedAlpha = closed[3] / 255;
              }
              if (closedBlend < 1) {
                interpolateInto(open, openPixels, source.width, source.height, sampleX, y);
                openAlpha = open[3] / 255;
              }
              const closedWeight = closedAlpha * closedBlend;
              const openWeight = openAlpha * (1 - closedBlend);
              alpha += (closedWeight + openWeight) * alphaMask;
              if (closedBlend > 0) {
                red += closed[0] * closedWeight * alphaMask;
                green += closed[1] * closedWeight * alphaMask;
                blue += closed[2] * closedWeight * alphaMask;
              }
              if (closedBlend < 1) {
                red += open[0] * openWeight * alphaMask;
                green += open[1] * openWeight * alphaMask;
                blue += open[2] * openWeight * alphaMask;
              }
              samples += 1;
            }
          }

          alpha /= samples;
          if (alpha < 0.035) continue;
          red /= Math.max(0.001, alpha * samples);
          green /= Math.max(0.001, alpha * samples);
          blue /= Math.max(0.001, alpha * samples);
          const sourceLum = luminance([red, green, blue]);
          const compositeLum = sourceLum * alpha + paperLum * (1 - alpha);
          let darkness = paperLum > 0.5
            ? Math.max(0, (paperLum - compositeLum) / paperLum)
            : Math.max(0, (compositeLum - paperLum) / (1 - paperLum));
          if (paperLum <= 0.5 && sourceLum < 0.2) darkness = Math.max(darkness, 0.72 * alpha);
          const index = row * cols + col;
          densities[index] = Math.min(1, darkness * 1.38);
          const eyeDetail = horizontal > 0.36 && horizontal < 0.64 && vertical > 0.36 && vertical < 0.55;
          if (eyeDetail && blue > red * 1.1 && blue > green * 1.08) darkness = Math.max(darkness, 0.62);
          colors[index] = portraitColor(red, green, blue, ink, muted, paper, eyeDetail);
        }
      }

      output.clearRect(0, 0, outputWidth, outputHeight);
      output.font = `${fontSize}px "DM Mono", monospace`;
      output.textBaseline = 'top';
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const index = row * cols + col;
          const target = Math.max(0, Math.min(1, densities[index] + errors[index]));
          const glyph = chooseGlyph(glyphs, target);
          const error = target - glyph.darkness;
          if (col + 1 < cols) errors[index + 1] += error * (7 / 16);
          if (row + 1 < rows) {
            if (col > 0) errors[index + cols - 1] += error * (3 / 16);
            errors[index + cols] += error * (5 / 16);
            if (col + 1 < cols) errors[index + cols + 1] += error * (1 / 16);
          }
          const fill = colors[index];
          if (!fill || glyph.darkness < 0.012) continue;
          const appearAt = (row / rows) * 0.55 + cellNoise(col, row) * 0.4;
          const appeared = (reveal * (1 + REVEAL_FADE) - appearAt) / REVEAL_FADE;
          if (appeared <= 0) continue;
          const alpha = Math.min(1, appeared);
          if (alpha !== previousAlpha) {
            output.globalAlpha = alpha;
            previousAlpha = alpha;
          }
          if (fill !== previousFill) {
            output.fillStyle = fill;
            previousFill = fill;
          }
          output.fillText(glyph.character, col * cellW, row * cellH);
        }
      }

      output.globalAlpha = 1;
      output.save();
      output.font = `bold ${fontSize * 1.6}px "DM Mono", monospace`;
      output.textBaseline = 'middle';
      const eyeBlue = paperLum > 0.5 ? 'rgb(42, 83, 142)' : 'rgb(136, 181, 241)';
      [
        { x: 0.409, close: Math.max(1 - eyeOpen, blink, wink) },
        { x: 0.579, close: Math.max(1 - eyeOpen, blink) },
      ].forEach(({ x, close }) => {
        if (reveal < 1) return;
        const centerX = x * outputWidth;
        const centerY = 0.432 * outputHeight;
        if (close > 0.52) {
          output.fillStyle = ink;
          output.fillText('-', centerX - fontSize * 0.34, centerY);
          return;
        }
        output.fillStyle = eyeBlue;
        output.fillText('@', centerX - fontSize * 0.45, centerY);
        if (!reducedMotion.matches && close < 0.12) {
          output.fillStyle = paperLum > 0.5 ? '#fff' : ink;
          output.fillText('.', centerX + fontSize * 0.12, centerY - fontSize * 0.38);
        }
      });
      output.restore();

      if (!reducedMotion.matches) frame = requestAnimationFrame(draw);
    };

    const start = () => {
      if (disposed) return;
      updatePalette();
      layout();
      startTime = performance.now();
      if (inView) frame = requestAnimationFrame(draw);
      else draw(startTime + 50);
    };

    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView && !frame && !reducedMotion.matches) frame = requestAnimationFrame(draw);
      if (!inView && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    }, { threshold: 0.01 });
    observer.observe(host);

    let observedWidth = 0;
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (Math.abs(entry.contentRect.width - observedWidth) < 0.5) return;
      observedWidth = entry.contentRect.width;
      layout();
      if (!frame && inView && !reducedMotion.matches) frame = requestAnimationFrame(draw);
      else if (reducedMotion.matches) draw(performance.now());
    });
    resizeObserver.observe(host);

    const themeObserver = new MutationObserver(() => {
      updatePalette();
      if (reducedMotion.matches) draw(performance.now());
    });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    const onMotionPreference = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      startTime = performance.now();
      if (reducedMotion.matches) draw(startTime + 50);
      else if (inView) frame = requestAnimationFrame(draw);
    };
    reducedMotion.addEventListener('change', onMotionPreference);

    layout();
    void Promise.all([document.fonts.ready, closedImage.decode(), openImage.decode()]).then(start).catch(() => undefined);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      reducedMotion.removeEventListener('change', onMotionPreference);
    };
  }, []);

  return (
    <div className="vision-portrait" role="img" aria-label="Retrato em ASCII da Sailor Moon; ela abre e pisca os olhos, dá uma piscadela, e as mechas do cabelo se movem.">
      <canvas aria-hidden="true" className="vision-portrait-canvas" ref={canvasRef} />
    </div>
  );
}

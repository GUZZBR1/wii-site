import { useCallback, useEffect, useRef, useState } from 'react';
import { useLang, type Bilingual } from '../i18n';

type Point = { x: number; y: number; pressure: number };
type Tool = 'pen' | 'eraser';
type Stroke = { color: string; width: number; tool: Tool; points: Point[] };

const COLORS: { name: Bilingual; value: string; display?: string }[] = [
  { name: { pt: 'Grafite', en: 'Graphite' }, value: 'graphite', display: 'var(--ink)' },
  { name: { pt: 'Terracota', en: 'Terracotta' }, value: '#c65d45' },
  { name: { pt: 'Azul', en: 'Blue' }, value: '#527c91' },
  { name: { pt: 'Verde', en: 'Green' }, value: '#78885a' },
  { name: { pt: 'Ocre', en: 'Ochre' }, value: '#c49a3a' },
  { name: { pt: 'Violeta', en: 'Violet' }, value: '#8c719a' },
];
const SIZES = [
  { name: { pt: 'Fino', en: 'Thin' }, value: 2, icon: 4 },
  { name: { pt: 'Médio', en: 'Medium' }, value: 4, icon: 7 },
  { name: { pt: 'Grosso', en: 'Thick' }, value: 8, icon: 11 },
  { name: { pt: 'Enorme', en: 'Huge' }, value: 36, icon: 19 },
];
const POINT_LIMIT = 5000;

function resolveStrokeColor(color: string, element: HTMLElement) {
  if (color !== 'graphite') return color;
  return getComputedStyle(element).getPropertyValue('--ink').trim() || '#22231f';
}

function pressureWidth(stroke: Stroke, pressure: number) {
  return stroke.width * (0.55 + Math.max(0.1, pressure) * 0.9);
}

function ToolIcon({ tool }: { tool: Tool }) {
  return tool === 'pen' ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 20 4.2-1 10.9-10.9a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
      <path d="m14.8 6.5 3 3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 15 8.8-9a2 2 0 0 1 2.9 0l4.1 4.2a2 2 0 0 1 0 2.8L13 20H8l-4-4a.7.7 0 0 1 0-1Z" />
      <path d="m8 20 8-8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}

export default function SketchPad() {
  const { tr } = useLang();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const activeBoundsRef = useRef<DOMRect | null>(null);
  const [color, setColor] = useState(COLORS[0].value);
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState<Tool>('pen');
  const previewRef = useRef<HTMLSpanElement>(null);
  const previewTimerRef = useRef(0);

  const movePreview = useCallback((x: number, y: number) => {
    const preview = previewRef.current;
    if (!preview) return;
    preview.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    preview.classList.add('is-visible');
  }, []);

  const hidePreview = useCallback(() => {
    window.clearTimeout(previewTimerRef.current);
    previewRef.current?.classList.remove('is-visible');
  }, []);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    movePreview(canvas.clientWidth / 2, canvas.clientHeight / 2);
    window.clearTimeout(previewTimerRef.current);
    previewTimerRef.current = window.setTimeout(hidePreview, 1100);
    return () => window.clearTimeout(previewTimerRef.current);
  }, [brushSize, tool, movePreview, hidePreview]);

  function trackPointer(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === 'touch' && activePointerRef.current === null) return;
    window.clearTimeout(previewTimerRef.current);
    const bounds = event.currentTarget.getBoundingClientRect();
    movePreview(event.clientX - bounds.left, event.clientY - bounds.top);
  }

  const paintStroke = useCallback((
    context: CanvasRenderingContext2D,
    stroke: Stroke,
    width: number,
    height: number,
  ) => {
    const points = stroke.points;
    if (!points.length) return;
    const paintColor = resolveStrokeColor(stroke.color, context.canvas);
    context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    context.strokeStyle = paintColor;
    context.fillStyle = paintColor;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    if (points.length === 1) {
      const point = points[0];
      const radius = pressureWidth(stroke, point.pressure) / 2;
      context.beginPath();
      context.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2);
      context.fill();
    } else {
      for (let index = 1; index < points.length; index += 1) {
        const from = points[index - 1];
        const to = points[index];
        context.lineWidth = pressureWidth(stroke, (from.pressure + to.pressure) / 2);
        context.beginPath();
        context.moveTo(from.x * width, from.y * height);
        context.lineTo(to.x * width, to.y * height);
        context.stroke();
      }
    }
    context.globalCompositeOperation = 'source-over';
  }, []);

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    context.clearRect(0, 0, width, height);
    for (const stroke of strokesRef.current) paintStroke(context, stroke, width, height);
    if (activeStrokeRef.current) paintStroke(context, activeStrokeRef.current, width, height);
  }, [paintStroke]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * pixelRatio);
    const pixelHeight = Math.round(height * pixelRatio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    canvas.getContext('2d')?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    repaint();
  }, [repaint]);

  useEffect(() => {
    let wasDark = document.body.classList.contains('dark');
    const themeObserver = new MutationObserver(() => {
      // So repinta quando o tema muda; outras classes (is-sketching) nao importam.
      const isDark = document.body.classList.contains('dark');
      if (isDark === wasDark) return;
      wasDark = isDark;
      repaint();
    });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => themeObserver.disconnect();
  }, [repaint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [resizeCanvas]);

  // Com o primeiro risco o header sobe e libera a folha; volta quando o
  // ponteiro encosta no topo da janela ou a pagina rola.
  useEffect(() => {
    const body = document.body;
    const reveal = () => body.classList.remove('is-sketching');
    const onMove = (event: PointerEvent) => {
      if (event.clientY <= 48 && activePointerRef.current === null) reveal();
    };
    let lastY = window.scrollY;
    const onScroll = () => {
      if (!body.classList.contains('is-sketching')) {
        lastY = window.scrollY;
        return;
      }
      if (Math.abs(window.scrollY - lastY) > 24) reveal();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      reveal();
    };
  }, []);

  function makePoint(clientX: number, clientY: number, pressure: number, bounds: DOMRect): Point {
    return {
      x: Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height)),
      pressure: pressure || 0.5,
    };
  }

  function beginStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = event.currentTarget.getBoundingClientRect();
    activeBoundsRef.current = bounds;
    const point = makePoint(event.clientX, event.clientY, event.pressure, bounds);
    activePointerRef.current = event.pointerId;
    if (!document.body.classList.contains('is-sketching')) {
      document.body.classList.add('is-sketching');
    }
    activeStrokeRef.current = { color, width: brushSize, tool, points: [point] };
    paintStroke(event.currentTarget.getContext('2d')!, activeStrokeRef.current, event.currentTarget.clientWidth, event.currentTarget.clientHeight);
  }

  function continueStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    let stroke = activeStrokeRef.current;
    if (!stroke || activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    const context = event.currentTarget.getContext('2d');
    const { clientWidth: width, clientHeight: height } = event.currentTarget;
    const bounds = activeBoundsRef.current;
    if (!bounds) return;
    for (const sample of samples) {
      const point = makePoint(sample.clientX, sample.clientY, sample.pressure, bounds);
      const previous: Point = stroke.points[stroke.points.length - 1];
      if (stroke.points.length >= POINT_LIMIT) {
        strokesRef.current.push(stroke);
        stroke = { color: stroke.color, width: stroke.width, tool: stroke.tool, points: [previous] };
        activeStrokeRef.current = stroke;
      }
      stroke.points.push(point);
      if (context) paintStroke(context, { ...stroke, points: [previous, point] }, width, height);
    }
  }

  function finishStroke(event?: React.PointerEvent<HTMLCanvasElement>) {
    if (event && activePointerRef.current !== event.pointerId) return;
    const stroke = activeStrokeRef.current;
    if (!stroke) return;
    activeStrokeRef.current = null;
    activePointerRef.current = null;
    activeBoundsRef.current = null;
    strokesRef.current.push(stroke);
  }

  function clearAll() {
    activeStrokeRef.current = null;
    activePointerRef.current = null;
    activeBoundsRef.current = null;
    strokesRef.current = [];
    repaint();
  }

  return (
    <section className="sketch-section" aria-label={tr('Folha para desenhar', 'Sheet to draw on')}>
      <div className="sketch-toolbar" aria-label={tr('Ferramentas de desenho', 'Drawing tools')}>
        <div className="sketch-tool-switch" role="group" aria-label={tr('Ferramenta', 'Tool')}>
          {(['pen', 'eraser'] as const).map((option) => (
            <button
              className={`sketch-tool-button${tool === option ? ' is-selected' : ''}`}
              key={option}
              type="button"
              aria-label={option === 'pen' ? tr('Caneta', 'Pen') : tr('Borracha', 'Eraser')}
              aria-pressed={tool === option}
              title={option === 'pen' ? tr('Caneta', 'Pen') : tr('Borracha', 'Eraser')}
              onClick={() => setTool(option)}
            >
              <ToolIcon tool={option} />
            </button>
          ))}
        </div>
        <span className="sketch-toolbar-divider" aria-hidden="true" />
        <div className="sketch-palette" role="group" aria-label={tr('Cor do traço', 'Stroke color')}>
          {COLORS.map((swatch) => (
            <button
              className={`sketch-swatch${color === swatch.value ? ' is-selected' : ''}`}
              key={swatch.value}
              type="button"
              style={{ '--swatch': swatch.display ?? swatch.value } as React.CSSProperties}
              aria-label={tr(
                `${swatch.name.pt}${color === swatch.value ? ', selecionada' : ''}`,
                `${swatch.name.en}${color === swatch.value ? ', selected' : ''}`,
              )}
              aria-pressed={color === swatch.value}
              title={tr(swatch.name.pt, swatch.name.en)}
              onClick={() => {
                setColor(swatch.value);
                setTool('pen');
              }}
            />
          ))}
        </div>
        <span className="sketch-toolbar-divider sketch-size-divider" aria-hidden="true" />
        <div className="sketch-size-options" role="group" aria-label={tr('Espessura do traço', 'Stroke width')}>
          {SIZES.map((size) => (
            <button
              className={`sketch-size${brushSize === size.value ? ' is-selected' : ''}`}
              key={size.value}
              type="button"
              aria-label={tr(`Traço ${size.name.pt.toLowerCase()}`, `${size.name.en} stroke`)}
              aria-pressed={brushSize === size.value}
              title={tr(`Traço ${size.name.pt.toLowerCase()}`, `${size.name.en} stroke`)}
              onClick={() => setBrushSize(size.value)}
            >
              <span style={{ width: size.icon, height: size.icon }} />
            </button>
          ))}
        </div>
        <span className="sketch-toolbar-divider sketch-clear-divider" aria-hidden="true" />
        <button
          className="sketch-tool-button sketch-clear-button"
          type="button"
          aria-label={tr('Apagar tudo', 'Clear all')}
          title={tr('Apagar tudo', 'Clear all')}
          onClick={clearAll}
        >
          <TrashIcon />
        </button>
      </div>
      <button
        className="sketch-show-nav"
        type="button"
        onClick={(event) => {
          document.body.classList.remove('is-sketching');
          // Acionado pelo teclado (detail 0): leva o foco ao menu que voltou.
          if (event.detail === 0) {
            requestAnimationFrame(() =>
              document.querySelector<HTMLElement>('.site-header a[href], .site-header button')?.focus(),
            );
          }
        }}
      >
        {tr('Mostrar menu', 'Show menu')}
      </button>
      <p className="sketch-hint" aria-hidden="true">{tr('Toque e arraste, solte quando terminar', 'Touch and drag, release when done')}</p>
      <span
        ref={previewRef}
        className="sketch-brush-preview"
        aria-hidden="true"
        style={{ width: Math.max(brushSize, 6), height: Math.max(brushSize, 6) }}
      />
      <canvas
        ref={canvasRef}
        className="sketch-canvas"
        aria-label={tr('Folha de desenho em branco. Use mouse, toque ou caneta para desenhar.', 'Blank drawing sheet. Use mouse, touch or pen to draw.')}
        tabIndex={0}
        onPointerDown={beginStroke}
        onPointerMove={(event) => { trackPointer(event); continueStroke(event); }}
        onPointerEnter={trackPointer}
        onPointerLeave={(event) => { if (activePointerRef.current === null || event.pointerType !== 'mouse') hidePreview(); }}
        onPointerUp={(event) => { finishStroke(event); if (event.pointerType !== 'mouse') hidePreview(); }}
        onPointerCancel={(event) => { finishStroke(event); hidePreview(); }}
        onLostPointerCapture={finishStroke}
        onContextMenu={(event) => event.preventDefault()}
      >
        {tr('Canvas indisponível neste navegador.', 'Canvas unavailable in this browser.')}
      </canvas>
    </section>
  );
}

const SOURCE_GLYPHS = Array.from("$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ");

export type RankedGlyph = { character: string; darkness: number };

export function cellNoise(col: number, row: number) {
  const value = Math.sin(col * 127.1 + row * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export function cssColor(element: Element, token: string, fallback: string) {
  return getComputedStyle(element).getPropertyValue(token).trim() || fallback;
}

export function parseRgb(color: string) {
  const hex = color.match(/^#([\da-f]{6})$/i)?.[1];
  if (hex) return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const values = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  return values?.length === 3 ? values : [34, 35, 31];
}

export function luminance([red, green, blue]: number[]) {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return channel(red) * 0.2126 + channel(green) * 0.7152 + channel(blue) * 0.0722;
}

export function smoothstep(edge0: number, edge1: number, value: number) {
  const progress = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return progress * progress * (3 - 2 * progress);
}

const rankCache = new Map<string, RankedGlyph[]>();

export function rankGlyphs(font: string, cellW: number, cellH: number): RankedGlyph[] {
  const key = `${font}|${Math.ceil(cellW)}|${Math.ceil(cellH)}`;
  const cached = rankCache.get(key);
  if (cached) return cached;
  const ranked = rankGlyphsUncached(font, cellW, cellH);
  if (document.fonts.check(font)) rankCache.set(key, ranked);
  return ranked;
}

function rankGlyphsUncached(font: string, cellW: number, cellH: number): RankedGlyph[] {
  const measure = document.createElement('canvas');
  measure.width = Math.ceil(cellW);
  measure.height = Math.ceil(cellH);
  const context = measure.getContext('2d', { willReadFrequently: true });
  if (!context) return SOURCE_GLYPHS.map((character, index) => ({ character, darkness: 1 - index / SOURCE_GLYPHS.length }));

  context.font = font;
  context.textBaseline = 'top';
  return SOURCE_GLYPHS.map((character) => {
    context.fillStyle = '#fff';
    context.fillRect(0, 0, measure.width, measure.height);
    context.fillStyle = '#000';
    context.fillText(character, 0, 0);
    const pixels = context.getImageData(0, 0, measure.width, measure.height).data;
    let darkness = 0;
    for (let index = 0; index < pixels.length; index += 4) darkness += 255 - pixels[index];
    return { character, darkness: darkness / (measure.width * measure.height * 255) };
  }).sort((a, b) => b.darkness - a.darkness);
}

export function chooseGlyph(glyphs: RankedGlyph[], target: number) {
  let low = 0;
  let high = glyphs.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (glyphs[middle].darkness > target) low = middle + 1;
    else high = middle;
  }
  if (low === 0) return glyphs[0];
  const before = glyphs[low - 1];
  const after = glyphs[low];
  return Math.abs(before.darkness - target) < Math.abs(after.darkness - target) ? before : after;
}

export function interpolateInto(output: number[], pixels: Uint8ClampedArray, width: number, height: number, x: number, y: number) {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = x - Math.floor(x);
  const ty = y - Math.floor(y);
  const a = (y0 * width + x0) * 4;
  const b = (y0 * width + x1) * 4;
  const c = (y1 * width + x0) * 4;
  const d = (y1 * width + x1) * 4;
  for (let channel = 0; channel < 4; channel += 1) {
    const top = pixels[a + channel] * (1 - tx) + pixels[b + channel] * tx;
    const bottom = pixels[c + channel] * (1 - tx) + pixels[d + channel] * tx;
    output[channel] = top * (1 - ty) + bottom * ty;
  }
  return output;
}

/**
 * Cor de tinta para fundo claro: mantem o matiz da imagem, aprofunda o tom ate
 * ter contraste de leitura e realca a saturacao, para o papel nao "lavar" as
 * cores como acontece com o simples escurecimento proporcional.
 */
export function inkOnLight(red: number, green: number, blue: number, maxLuminance = 0.2, saturation = 1.3) {
  const lum = luminance([red, green, blue]);
  const scale = lum > maxLuminance ? (maxLuminance / lum) ** (1 / 2.2) : 1;
  const darkened = [red, green, blue].map((value) => value * scale);
  const gray = darkened[0] * 0.2126 + darkened[1] * 0.7152 + darkened[2] * 0.0722;
  const [r, g, b] = darkened.map((value) => Math.round(Math.max(0, Math.min(255, gray + (value - gray) * saturation))));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Paleta do retrato (ouro, pele, azul, branco, tinta) compartilhada pelas artes ASCII. */
export function portraitColor(red: number, green: number, blue: number, ink: string, muted: string, paper: number[], eyeDetail: boolean) {
  const pixel = [red, green, blue];
  const lightBackground = luminance(paper) > 0.5;
  const sourceLightness = luminance(pixel);
  const goldHair = red > green * 1.08 && green > blue * 1.25;
  const blueEye = blue > red * 1.1 && blue > green * 1.08;
  const warmSkin = red > green * 1.06 && green > blue * 1.04 && !goldHair;

  if (blueEye && eyeDetail) return lightBackground ? 'rgb(42, 83, 142)' : 'rgb(136, 181, 241)';
  if (blueEye) return lightBackground ? inkOnLight(red, green, blue, 0.3, 1.6) : `rgb(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)})`;
  if (sourceLightness < 0.16) return ink;
  // Tons azulados fora do detalhe do olho tambem mantem o azul.
  const bluish = blue > red * 1.02 && blue > green;
  if (lightBackground && bluish) return inkOnLight(red, green, blue, 0.3, 1.6);
  if (lightBackground) {
    if (sourceLightness > 0.88) return muted;
    // Ouro e pele ganham tons profundos e saturados (ocre, terracota)
    // em vez de cinza lavado; o resto so e aprofundado.
    if (goldHair) return inkOnLight(red, green, blue, 0.22, 1.45);
    if (warmSkin) return inkOnLight(red, green, blue, 0.34, 1.35);
    return inkOnLight(red, green, blue, 0.24, 1.25);
  }
  return `rgb(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)})`;
}

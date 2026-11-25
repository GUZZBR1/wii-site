import { LADDER, TIERS, type Tier } from './quality';

/** Cena WebGL da abertura: névoa de luz, obras em profundidade, foco, bloom, vinheta e grão. */

const QUAD_VS = `
attribute vec2 p;
uniform vec4 rect; // centro e meia largura/altura, em pixels
uniform mediump vec2 view;
varying vec2 uv;
void main() {
  uv = p * .5 + .5;
  vec2 px = rect.xy + p * rect.zw;
  gl_Position = vec4(px / view * 2. - 1., 0., 1.);
  gl_Position.y *= -1.;
}`;

const NOISE = `
precision mediump float;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < OCTAVES; i++) { v += a * noise(p); p *= 2.03; a *= .5; } return v; }`;

// Luz difusa: duas manchas distorcidas por ruído, sem contorno perceptível.
const SKY_FS = `${NOISE}
uniform vec2 view; uniform float time; uniform float travel; uniform vec2 light; uniform float glow;
void main() {
  vec2 q = (gl_FragCoord.xy - .5 * view) / view.y;
#if WARP
  vec2 warp = vec2(fbm(q * 1.6 + vec2(time * .025, travel * .12)), fbm(q * 1.6 + vec2(7.3, -time * .02))) - .5;
#else
  vec2 warp = vec2(noise(q * 1.6 + time * .025), noise(q * 1.6 + 7.3)) * .6 - .3;
#endif
  vec2 l = q - vec2(light.x, -light.y) + warp * .75;
  float key = exp(-dot(l, l) * 2.2);
  float haze = fbm(q * 2.4 + warp * 1.8 + vec2(-travel * .2, time * .015));
  vec3 color = mix(vec3(.91, .945, .965), vec3(1.), clamp(key * glow * (.8 + .4 * haze), 0., 1.));
  color = mix(color, vec3(.68, .88, .97), clamp(haze * haze * 1.1 - key * .5 + max(-q.y, 0.) * .5, 0., .75));
  gl_FragColor = vec4(color, 1.);
}`;

// Obra sem moldura: bordas dissolvidas por ruído, desfoque de lente e bloom nas altas luzes.
const ART_FS = `${NOISE}
uniform sampler2D tex; uniform float alpha; uniform float blur; uniform float gain; uniform float seed; uniform float feather;
varying vec2 uv;
vec4 tap(vec2 o, float bias) { return texture2D(tex, uv + o, bias); }
void main() {
  vec4 sum = vec4(0.); vec3 halo = vec3(0.);
  float angle = hash(gl_FragCoord.xy) * 6.2831;
  for (int i = 0; i < TAPS; i++) {
    float f = (float(i) + .5) / float(TAPS);
    float a = angle + float(i) * 2.39996;
    vec2 dir = vec2(cos(a), sin(a)) * sqrt(f);
    sum += tap(dir * blur, blur * 40.);
#if BLOOM
    vec4 far = tap(dir * .06, 3.);
    halo += max(far.rgb * far.a - .5, 0.);
#endif
  }
  sum /= float(TAPS);
  float lum = dot(sum.rgb, vec3(.299, .587, .114));
  lum = smoothstep(.02, 1.05, lum) * gain;
  vec2 c = (uv - .5) * 2.;
  float edge = max(abs(c.x), abs(c.y)) * .55 + length(c) * .45 + (fbm(uv * 5. + seed) - .5) * .3;
  // some antes da borda do quadro, para nunca aparecer um corte reto
  float inside = 1. - smoothstep(.72, 1., max(abs(c.x), abs(c.y)));
  float mask = mix(1., (1. - smoothstep(.55, 1.08, edge)) * inside, feather);
  vec3 bloom = halo / float(TAPS) * .7 * mask;
  float a = sum.a * mask * alpha;
  // obras em tom azulado; a marca (sem bordas dissolvidas) no cinza do Wii
  vec3 color = mix(vec3(.5, .55, .6), mix(vec3(.04, .15, .25), vec3(.98, .995, 1.), clamp(lum, 0., 1.)), step(.5, feather));
  gl_FragColor = vec4(color * a + bloom * alpha, a); // alfa pré-multiplicado
}`;

const DUST_VS = `
attribute vec3 seed;
uniform vec2 view; uniform float time; uniform float travel; uniform float dpr;
varying float soft;
void main() {
  float z = fract(seed.z - travel * .22);
  float depth = .25 + z * 1.75;
  vec2 pos = (seed.xy - .5) * 1.5 + vec2(sin(time * .11 + seed.z * 30.), cos(time * .09 + seed.x * 30.)) * .025;
  gl_Position = vec4(pos / depth, 0., 1.);
  gl_PointSize = dpr * (1.5 + 3. / depth);
  soft = smoothstep(0., .15, z) * (1. - smoothstep(.7, 1., z)) * .22;
}`;

const DUST_FS = `
precision mediump float;
varying float soft;
void main() {
  float d = length(gl_PointCoord - .5) * 2.;
  float a = soft * max(0., 1. - d * d);
  gl_FragColor = vec4(vec3(.1, .6, .86) * a * 1.8, a * 1.8);
}`;

const FILM_FS = `${NOISE}
uniform vec2 view; uniform float time; uniform float fade;
void main() {
  vec2 c = gl_FragCoord.xy / view - .5;
  float veil = smoothstep(.38, .9, length(c)) * .5;
  float g = hash(gl_FragCoord.xy + fract(time * vec2(37.7, 19.3)) * 191.) - .5;
  float grain = abs(g) * .05 * (1. - fade);
  vec3 tint = mix(vec3(.74, .88, .96), vec3(.957, .973, .98), fade);
  float cover = clamp(veil + fade, 0., 1.);
  vec3 speck = vec3(step(0., g)) * vec3(1.) + vec3(1. - step(0., g)) * vec3(.2, .35, .48);
  gl_FragColor = vec4(tint * cover * (1. - grain) + speck * grain, cover + grain * (1. - cover));
}`;

export interface Layer {
  /** Índice da textura: 0..n-1 são as obras; n é a marca. */
  texture: number;
  /** Centro e meia largura/altura em pixels CSS. */
  x: number; y: number; w: number; h: number;
  alpha: number;
  blur: number;
  gain: number;
  feather: number;
}

export interface Frame {
  time: number;
  travel: number;
  /** Posição da luz em unidades da altura da tela, a partir do centro. */
  lightX: number; lightY: number; glow: number;
  fade: number;
  layers: Layer[];
}

const SIZE = 1024;

const defines = (tier: Tier) => {
  const t = TIERS[tier];
  return `#define OCTAVES ${t.octaves}\n#define TAPS ${t.taps}\n#define BLOOM ${t.bloom ? 1 : 0}\n#define WARP ${t.warp ? 1 : 0}\n`;
};

export function createIntroScene(canvas: HTMLCanvasElement, sources: string[], mark: string) {
  const context = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'high-performance' });
  if (!context) return null;
  const gl: WebGLRenderingContext = context;

  const program = (vs: string, fs: string) => {
    const p = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(p, shader);
      gl.deleteShader(shader);
    }
    gl.bindAttribLocation(p, 0, 'p');
    gl.bindAttribLocation(p, 0, 'seed');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn('Abertura: shader não compilou', gl.getProgramInfoLog(p));
      return null;
    }
    const cache = new Map<string, WebGLUniformLocation | null>();
    const at = (name: string) => {
      if (!cache.has(name)) cache.set(name, gl.getUniformLocation(p, name));
      return cache.get(name) ?? null;
    };
    return { p, at };
  };

  type Program = NonNullable<ReturnType<typeof program>>;
  // Céu e obra são compilados por perfil, sob demanda.
  const variants = new Map<Tier, { sky: Program; art: Program } | null>();
  const variant = (tier: Tier) => {
    let found = variants.get(tier);
    if (found === undefined) {
      const sky = program(QUAD_VS, defines(tier) + SKY_FS);
      const art = program(QUAD_VS, defines(tier) + ART_FS);
      found = sky && art ? { sky, art } : null;
      variants.set(tier, found);
    }
    return found;
  };
  const dust = program(DUST_VS, DUST_FS);
  const film = program(QUAD_VS, defines('lite') + FILM_FS);
  const base = variant('lite');
  if (!base || !dust || !film) return null;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  const pixel = new Uint8Array(4);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const motes = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, motes);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(Array.from({ length: 270 }, () => Math.random())), gl.STATIC_DRAW);

  let disposed = false;
  const textures: Array<{ texture: WebGLTexture; aspect: number } | undefined> = [];
  // A fonte é esticada para um quadrado potência de dois (mipmaps); a proporção volta no retângulo.
  const upload = (index: number, source: CanvasImageSource, aspect: number) => {
    const square = document.createElement('canvas');
    square.width = square.height = SIZE;
    square.getContext('2d')?.drawImage(source, 0, 0, SIZE, SIZE);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, square);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    textures[index] = { texture, aspect };
  };

  sources.forEach((src, index) => {
    const image = new Image();
    image.onload = () => { if (!disposed) upload(index, image, image.naturalWidth / image.naturalHeight); };
    image.src = src;
  });

  const word = document.createElement('canvas');
  word.width = 1200;
  word.height = 600;
  const pen = word.getContext('2d');
  if (pen) {
    pen.font = '600 380px Manrope, Arial, sans-serif';
    pen.textAlign = 'center';
    pen.textBaseline = 'middle';
    pen.fillStyle = '#fff';
    pen.fillText(mark, 600, 310);
  }
  upload(sources.length, word, 2);

  return {
    renderer,
    aspect: (index: number) => textures[index]?.aspect,
    /** Espera a GPU terminar: só o benchmark usa. */
    sync: () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel),
    render(frame: Frame, level: number) {
      const { tier, scale } = LADDER[level];
      const { sky, art } = variant(tier) ?? base;
      // Só a resolução interna muda: a composição é calculada em pixels CSS.
      const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr) * scale;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.enableVertexAttribArray(0);

      const full = (shader: Program) => {
        gl.useProgram(shader.p);
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.uniform4f(shader.at('rect'), width / 2, height / 2, width / 2, height / 2);
        gl.uniform2f(shader.at('view'), width, height);
      };

      gl.disable(gl.BLEND);
      full(sky);
      gl.uniform2f(sky.at('view'), canvas.width, canvas.height); // o fragmento mede em pixels reais
      // o vértice usa a mesma uniforme: o retângulo acompanha a escala
      gl.uniform4f(sky.at('rect'), canvas.width / 2, canvas.height / 2, canvas.width / 2, canvas.height / 2);
      gl.uniform1f(sky.at('time'), frame.time);
      gl.uniform1f(sky.at('travel'), frame.travel);
      gl.uniform2f(sky.at('light'), frame.lightX, frame.lightY);
      gl.uniform1f(sky.at('glow'), frame.glow);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      full(art);
      for (const layer of frame.layers) {
        const loaded = textures[layer.texture];
        if (!loaded || layer.alpha <= .004) continue;
        gl.bindTexture(gl.TEXTURE_2D, loaded.texture);
        gl.uniform4f(art.at('rect'), layer.x, layer.y, layer.w, layer.h);
        gl.uniform1f(art.at('alpha'), layer.alpha);
        gl.uniform1f(art.at('blur'), layer.blur);
        gl.uniform1f(art.at('gain'), layer.gain);
        gl.uniform1f(art.at('feather'), layer.feather);
        gl.uniform1f(art.at('seed'), layer.texture * 3.7);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      gl.useProgram(dust.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, motes);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.uniform1f(dust.at('time'), frame.time);
      gl.uniform1f(dust.at('travel'), frame.travel);
      gl.uniform1f(dust.at('dpr'), dpr);
      gl.drawArrays(gl.POINTS, 0, TIERS[tier].particles);

      full(film);
      gl.uniform2f(film.at('view'), canvas.width, canvas.height);
      gl.uniform4f(film.at('rect'), canvas.width / 2, canvas.height / 2, canvas.width / 2, canvas.height / 2);
      gl.uniform1f(film.at('time'), frame.time);
      gl.uniform1f(film.at('fade'), frame.fade);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      disposed = true;
      for (const loaded of textures) if (loaded) gl.deleteTexture(loaded.texture);
      gl.deleteBuffer(quad);
      gl.deleteBuffer(motes);
      for (const found of variants.values()) if (found) { gl.deleteProgram(found.sky.p); gl.deleteProgram(found.art.p); }
      for (const shader of [dust, film]) gl.deleteProgram(shader.p);
    },
  };
}

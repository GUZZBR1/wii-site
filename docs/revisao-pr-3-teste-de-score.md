# Revisão de PR — cobertura de teste para o novo cálculo de pontuação

Data: 26 de novembro de 2026 · Branch: `fix/cv-pipeline-bottlenecks` · Diff analisado: `git diff main...HEAD`

**Apontamento da revisão:** "Novo cálculo da pontuação sem teste de regressão — o guia de testes (AGENTS.md) exige cobertura para mudanças nas regras do jogo. Falta um teste que mostre que vários passos com ganho inferior a um ponto aumentam o placar."

O apontamento é procedente: o AGENTS.md manda "Add a test for every new detector behavior or gameplay rule change", e a mudança em `src/games/track/TrackGame.ts:95` é exatamente uma regra de jogo (quanto o placar cresce por segundo). O bloqueio prático é real: `new TrackGame()` cria `new GameLoop(canvas, ...)` (`TrackGame.ts:32`), que executa `new THREE.WebGLRenderer({ canvas, ... })` (`src/games/core/GameLoop.ts:34`) + `ResizeObserver` (`GameLoop.ts:37`) + `window.devicePixelRatio` (`GameLoop.ts:35`), e o próprio `TrackGame` usa `window.setInterval` (`TrackGame.ts:33`). Nada disso existe no ambiente `node` do Vitest (`vite.config.ts:8`). Este documento avalia os caminhos e propõe o refactor mínimo + o teste.

---

## 1. O que a correção mudou (matemática do bug)

Antes: `this.score += Math.round(dt * (5 + this.speed01 * 45))` — arredondava **cada tick**.
Depois: acumula o valor fracionário (`TrackGame.ts:95`) e aplica `Math.floor` só na hora de publicar o HUD (`TrackGame.ts:126`).

O `GameLoop` roda passo fixo `dt = 1/60` (`GameLoop.ts:48`), então o incremento por tick é `(5 + speed01·45)/60`:

| `speed01` | pontos/s (regra) | incremento/tick | `Math.round` por tick (código antigo) | pontos/s efetivos (antigo) |
|---|---|---|---|---|
| 0 (parado) | 5 | 0,083 | 0 | **0** |
| 0,32 (padrão) | 19,4 | 0,323 | 0 | **0** |
| 0,55 | 29,75 | 0,496 | 0 | **0** |
| 0,56 | 30,2 | 0,503 | 1 | **60** |
| 1 (máx.) | 50 | 0,833 | 1 | **60** (+20%) |

O código antigo zerava a pontuação por distância para qualquer `speed01 < 25/45 ≈ 0,556` — ou seja, o jogador só pontuava em barreiras — e **superpontuava** 60 pts/s (em vez de 50) acima disso. Era uma função-degrau, não a taxa 5–50 pts/s pretendida. Verificado em Node 24: 60 ticks a `speed01 = 0,32` somam `19,400000000000027`; com `Math.round` por tick somavam `0`.

**Cuidado de ponto flutuante para o teste:** a soma fracionária deriva alguns ULPs ao longo de muitos ticks. Medido: 240 ticks a `speed01 = 0` somam `19,999999999999986` → `floor = 19` (e não 20); 600 ticks a `speed01 = 1` → `499,9999999999956` → `floor = 499`. Conclusão: **não** escrever asserções exatas de `floor(n·taxa)` quando o valor analítico cai em cima de um inteiro; usar contagens cujo resultado fique a margem segura do inteiro (ex.: 19,4) ou desigualdades/`toBeCloseTo`.

---

## 2. Opções para tornar a regra testável sem Three.js/WebGL

### (a) Extrair a regra de pontuação para um módulo puro — **recomendado**

Toda a matemática de placar do `update()` é independente de Three.js: o tick de distância (`TrackGame.ts:95`) e as consequências de barreira (`+100` / `max(0, −35)`, `TrackGame.ts:110-111`). O que permanece 3D é só a *condição* de passagem da barreira (raia, `jumpTime`, `runner.position.y`). Extrai-se, portanto, quase 100% da regra de score:

```ts
// src/games/track/trackScore.ts — módulo puro, sem imports (convenção dos
// detectores de src/kinematics/: classes pequenas com estado, sem DOM/Three)
export class TrackScore {
  private value = 0;

  /** Pontuação por distância: 5 a 50 pontos/segundo conforme o ritmo. */
  advance(dt: number, speed01: number): void {
    this.value += dt * (5 + speed01 * 45);
  }

  /** Barreira superada (raia livre ou salto). */
  hurdleCleared(): void { this.value += 100; }

  /** Colisão com a barreira: −35, sem nunca ficar negativo. */
  hurdleHit(): void { this.value = Math.max(0, this.value - 35); }

  /** Valor bruto (fracionário) — útil para asserções precisas em teste. */
  get raw(): number { return this.value; }

  /** Placar exibido no HUD: parte inteira por floor. */
  get display(): number { return Math.floor(this.value); }
}
```

Mudanças no `TrackGame` (5 linhas):

```ts
private readonly score = new TrackScore();          // era `private score = 0`
// update():        this.score.advance(dt, this.speed01);
// barreira:        if (...) this.score.hurdleCleared(); else this.score.hurdleHit();
// publishHud():    const score = this.score.display;
```

Nome/local: `src/games/track/trackScore.ts` segue a convenção dos módulos de lógica pura do repo (`cadenceTracker.ts`, `oneEuroFilter.ts`, `poseClient.ts` — camelCase) e a regra "sem imports de DOM/Three" que o AGENTS.md já exige para `src/kinematics/`. A linha `distance` (`TrackGame.ts:94`) fica no jogo — ela alimenta a animação de passada, não o placar. Opcional: um getter `label` com `padStart(5,'0')` se quiserem testar também a formatação, mas é dispensável.

### (b) Injetar o loop/renderer no construtor — possível, mas desproporcional agora

`constructor(canvas, onHud, makeLoop = (c, s, cam, u) => new GameLoop(c, s, cam, u))` permitiria capturar o callback de `update` e dirigir o jogo inteiro em teste — inclusive a ramificação de barreira e o `jumpTime`. Mas: `update()` é `private`, seus efeitos observáveis moram em objetos Three (`hurdles`, `runner`), e o construtor ainda chamaria `window.setInterval` (`TrackGame.ts:33`) — exigiria `vi.stubGlobal('window', ...)` ou mais uma costura. É um diff maior na assinatura de produção para ganhar cobertura que a revisão não pediu. Vale registrar como caminho futuro **se** um dia quiserem testar interação barreira×salto×raia.

### (c) Ambiente jsdom/happy-dom no Vitest — não resolve

`vite.config.ts:8` usa `environment: 'node'` (default do Vitest — vitest.dev/guide/environment). Nem jsdom nem happy-dom dão contexto WebGL: `canvas.getContext('webgl'/'webgl2')` retorna `null` no jsdom (issue jsdom/jsdom#3617, aberta, "Implement WebGL"). E o `WebGLRenderer` do three r187 **só tenta `'webgl2'`** — WebGL 1 foi removido no r163 (threejs.org/docs WebGLRenderer) — e lança `THREE.WebGLRenderer: Error creating WebGL context.` quando o contexto vem `null` (`node_modules/three/build/three.module.js:16224-16246`). Ou seja, trocar o ambiente para jsdom **não** instancia o renderer; falharia do mesmo jeito (e ainda faltariam `ResizeObserver` e `window`).

A única rota "real" seria `gl` (headless-gl) + jsdom: o pacote implementa WebGL 1.0.3 conformante e um WebGL2 experimental via `createWebGL2Context` (não testado contra a conformance suite 2.0 — README do stackgl/headless-gl), exigindo build nativo, remendo do `getContext` do canvas, polyfill de `ResizeObserver` e stub de `requestAnimationFrame` para o `setAnimationLoop`. Maquinário pesado e frágil para testar uma regra de placar — descartado.

**Recomendação: (a).** Espelha o que o repo já faz com os detectores (lógica pura em classes pequenas, testada em `node` com fixtures) e satisfaz exatamente o ponto da revisão com ~30 linhas.

---

## 3. O teste de regressão proposto

Arquivo `tests/trackScore.test.ts`, mesmo estilo de `tests/kinematics.test.ts` (imports do vitest, `describe`/`it`, instanciação direta da classe pura). Números abaixo verificados em Node:

```ts
import { describe, expect, it } from 'vitest';
import { TrackScore } from '../src/games/track/trackScore';

const DT = 1 / 60; // passo fixo do GameLoop (src/games/core/GameLoop.ts:48)

describe('track score', () => {
  it('turns many sub-point ticks into visible points', () => {
    // Regra da revisão: cada passo soma < 1 ponto; o placar tem de crescer.
    const score = new TrackScore();
    for (let i = 0; i < 60; i += 1) score.advance(DT, 0.32); // +0,323 por tick
    // Código antigo (Math.round por tick) terminaria em 0; o correto é ~19,4.
    expect(score.display).toBe(19);
  });

  it('shows the first point after a few sub-point ticks', () => {
    const score = new TrackScore();
    for (let i = 0; i < 3; i += 1) score.advance(DT, 0.32);
    expect(score.display).toBe(0); // 0,97 — floor ainda em zero
    score.advance(DT, 0.32);       // 1,29 — cruza o primeiro ponto visível
    expect(score.display).toBe(1);
  });

  it('keeps the idle trickle at minimum speed', () => {
    const score = new TrackScore();
    for (let i = 0; i < 12; i += 1) score.advance(DT, 0);
    expect(score.raw).toBeCloseTo(1, 10); // 5 pts/s ÷ 60 ticks × 12
  });

  it('applies the hurdle bonus on top of the fractional total', () => {
    const score = new TrackScore();
    for (let i = 0; i < 60; i += 1) score.advance(DT, 0.32); // 19,4
    score.hurdleCleared();
    expect(score.raw).toBeCloseTo(119.4, 10);
    expect(score.display).toBe(119);
  });

  it('clamps the hurdle penalty at zero and keeps floor semantics', () => {
    const score = new TrackScore();
    for (let i = 0; i < 60; i += 1) score.advance(DT, 0.32); // 19,4
    score.hurdleHit();
    expect(score.raw).toBe(0); // 19,4 − 35 → max(0, ·)
    score.hurdleCleared();
    score.hurdleHit();
    expect(score.display).toBe(65); // 100 − 35, fronteira inteira exata
  });
});
```

Observações de design: `expect(score.display).toBe(19)` é seguro porque o bruto é 19,4 — a margem de 0,4 não pode ser cruzada por erro de ULP. Evitar casos cuja expectativa analítica seja inteira exata (ver §1: 240 ticks a `speed01 = 0` dão `floor = 19` e não 20).

---

## 4. Sanity check do restante do placar (TrackGame)

- **`Math.max(0, score − 35)` em placar fracionário** (`TrackGame.ts:111`): correto. Subtrai do bruto e prende em zero — impossível o placar ficar negativo (tick só soma, `hurdleCleared` só soma, penalidade prende). Mesma semântica do código antigo.
- **Formato do label** `String(Math.floor(score)).padStart(5, '0')` (`TrackGame.ts:126-127`): não produz `"-0001"` porque o score nunca é negativo. Acima de 99 999 o `padStart` não trunca — label cresce, comportamento aceitável para arcade.
- **NaN**: só entraria via `speed01` ou `dt` não finitos. `dt` é a constante `1/60` do `GameLoop` (`GameLoop.ts:48`) e `speed01` vem de `event.speed01` (o `CadenceTracker` já prende em `[0,1]` via `clamp`, `src/kinematics/cadenceTracker.ts:36`) ou de `Math.min(1, speed01 + 0.15)` no teclado (`TrackGame.ts:90`) — NaN exigiria um evento malformado. Se virar `NaN`, `Math.floor(NaN)` → label `"00NaN"` — lixo cosmético, sem crash. Guarda de uma linha (`if (!Number.isFinite(event.speed01)) return;` em `onAction`, `TrackGame.ts:81`) é hardening opcional, não exigido pela revisão.
- **Fora do escopo**: a condição de "passou a barreira" (`z > 0.2`, `jumpTime > 0.15 || runner.y > 0.45`, `TrackGame.ts:108-110`) não mudou neste PR — mas é a próxima candidata a teste se a opção (b) for adotada no futuro.

## 5. TennisGame — veredito

**Sem o bug.** O placar do tênis é inteiro por construção: `this.score += 1` por ponto ganho (`src/games/tennis/TennisGame.ts:66`) e `publishHud` imprime o inteiro direto com `padStart(2, '0')` (`TennisGame.ts:74`). Não há acumulação fracionária nem `Math.round` sobre incremento < 1 — a classe de defeito corrigida no track não existe aqui. `grep` por `Math.round|Math.floor` em `src/` confirma: os únicos usos são o `Math.floor` correto do HUD (`TrackGame.ts:126`), sorteio de raia (`TrackGame.ts:121`), `median` (`src/kinematics/math.ts:10`) e formatação de UI (`GameCanvas.tsx:55`, `CameraPip.tsx:36`). Nenhum teste novo necessário para o tênis neste PR.

## 6. Outros itens do diff que poderiam ganhar teste (avaliação)

`git diff main...HEAD --stat`: 12 arquivos; além do score, o grosso é o split do `PoseClient` (165 linhas reescritas), slim do protocolo do worker, `useModule: true` no worker, cópia só da variante module do WASM e headers `immutable` na Vercel.

- **`PoseClient` (`src/cv/poseClient.ts`)** — node-testável com stubs, esforço médio. Em ambiente `node`: `import.meta.env.BASE_URL` resolve (o Vitest injeta `import.meta.env`); precisaria de `vi.stubGlobal` para `Worker` (classe fake que dispara `onmessage` com `READY`/`ERROR`/`POSE`), `location` (`location.origin`, usado em `poseClient.ts:11-16`), `window` (`setTimeout` do timeout de 30 s, `poseClient.ts:132`, dirigível com `vi.useFakeTimers`) e `fetch` (para `warmVisionAssets`, `poseClient.ts:34-37`). O que daria para prender: `init()` idempotente via `initPromise` (linhas 43-48), `beginCapture` antes de `ready` é no-op (linha 52), `ERROR fatal` → `dispose()` (linha 116), `pauseCapture` zera `busy` (linhas 77-85), `dispose` posta `DISPOSE` + `terminate()` + reseta `initPromise` (linhas 87-97). **Avaliação:** é lógica real reescrita neste PR, mas é cola de orquestração, o AGENTS.md declara o caminho de CV como verificado manualmente ("The CV worker path has no automated coverage — verify camera flow manually"), e cobrir o loop de captura exigiria stubs crescentes (`createImageBitmap`, `requestAnimationFrame`/`requestVideoFrameCallback`, `HTMLMediaElement.HAVE_CURRENT_DATA`). **Sugestão: opcional, baixa prioridade** — se feito, limitar ao state machine de `init`/`beginCapture`/`pauseCapture`/`dispose` com um `FakeWorker` de ~50 linhas; não tentar o caminho de frames. Não é necessário para fechar o apontamento da revisão.
- **`pose.worker.ts` (`useModule: true`, `pose.worker.ts:12`)** — só testável com worker de verdade; exigiria Vitest Browser Mode ou Playwright (o repo não tem nenhum dos dois). O `docs/analise-de-gargalos.md` já recomendou um smoke test de `INIT` — fora do escopo do suite `node`.
- **`scripts/copy-mediapipe-wasm.mjs`** — é script Node (rodaria em vitest), mas é exercido a cada `prebuild`/`predev` e falha ruidosamente; valor marginal.
- **`actionPipeline.ts` (remoção de `kinematicsMs`) e `protocol.ts`/fixtures (slim de tipos)** — mudanças de forma, não de regra; os testes existentes já consomem `.events` (`tests/kinematics.test.ts:83,94`) e `tsc -b` cobre a compatibilidade de tipos.
- **`vercel.json` / README / AGENTS.md** — configuração e docs; sem teste.

---

## Fontes

- Vitest, *Test Environment* — `node` é o ambiente default; `jsdom`/`happy-dom` emulam API de browser via pacotes: https://vitest.dev/guide/environment.html
- three.js, *WebGLRenderer* — "This renderer uses WebGL 2… WebGL 1 is not supported since r163": https://threejs.org/docs/pages/WebGLRenderer.html
- Código local three 0.187: `node_modules/three/build/three.module.js:16224-16246` — tenta apenas `getContext('webgl2')` e lança `THREE.WebGLRenderer: Error creating WebGL context.` se vier `null`.
- jsdom, issue aberta *Implement WebGL* (#3617) — `canvas.getContext('webgl')` retorna `null` no jsdom: https://github.com/jsdom/jsdom/issues/3617
- headless-gl (`gl`) — WebGL 1.0.3 conformante; WebGL2 experimental via `createWebGL2Context` sem validação na conformance suite 2.0: https://github.com/stackgl/headless-gl
- Regra do repo: AGENTS.md — "Detectors in `src/kinematics/` must stay pure (no DOM/Three.js imports)" e "Add a test for every new detector behavior or gameplay rule change".

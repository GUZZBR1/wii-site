# Análise de gargalos — Wii Web Sports Arena

Data: 25 de novembro de 2026 · Commit analisado: `d455ebc` ("Make the game the whole site")

---

## O que é este projeto

**Wii Web Sports Arena** é um arcade de navegador ("seu corpo é o controle") com dois mini-jogos — **Hurdle Rush** (corrida com obstáculos, 3 raias) e **Baseline Rally** (tênis arcade) — controlados pela pose do corpo capturada via webcam, sem envio de vídeo ao servidor. Stack: Vite 8 + React 19 + TypeScript estrito + Three.js 0.187 + `@mediapipe/tasks-vision` 1.2.3 (`package.json`), deploy estático na Vercel (`vercel.json`).

A pipeline de ponta a ponta, conforme o código:

1. **Câmera** — `startCamera()` (`src/App.tsx:79-117`) pede `getUserMedia` a 640×480 @ 30 fps (`src/App.tsx:82-85`), liga o `<video>` do PiP (`src/ui/CameraPip.tsx:23`) e espera `loadeddata`.
2. **Cliente de captura** — `PoseClient.start()` (`src/cv/poseClient.ts:20-89`) cria um **module worker** (`new Worker(..., { type: 'module' })`, `poseClient.ts:28`), envia `INIT` com as URLs do WASM local e do modelo Lite hospedado em `public/mediapipe/` (`poseClient.ts:56-60`) e agenda a captura por `requestVideoFrameCallback` (rVFC), com fallback para `requestAnimationFrame` + comparação de `video.currentTime` (`poseClient.ts:70-88`). A política é **um frame em trânsito**: enquanto `busy`, novos frames são descartados silenciosamente (`poseClient.ts:94-96`).
3. **Worker de visão** — `pose.worker.ts` faz `FilesetResolver.forVisionTasks(wasmBaseUrl)` + `PoseLandmarker.createFromOptions` com `delegate: 'GPU'`, `runningMode: 'VIDEO'`, `numPoses: 1` (`src/cv/pose.worker.ts:11-24`), com fallback automático para CPU (`pose.worker.ts:32-46`). Cada mensagem `FRAME` carrega um `ImageBitmap` transferido por `postMessage` (`poseClient.ts:101-104`); o worker chama `detectForVideo(bitmap, timestampMs)`, mede `inferenceMs`, devolve 33+33 landmarks simplificados (`pose.worker.ts:80-88`) e fecha o bitmap no `finally` (`pose.worker.ts:98`).
4. **Cinemática** — no main thread, `ActionPipeline.update()` (`src/kinematics/actionPipeline.ts:17-37`) aplica `TrackingGate` (3 frames bons → `tracked`, 4 ruins → `lost`, `trackingGate.ts:13-24`), depois detectores puros: `CadenceTracker` (passos/cadência → velocidade do corredor, `cadenceTracker.ts`), `JumpDetector` (salto por subida do quadril, `jumpDetector.ts`), `LaneLeanDetector` (troca de raia por inclinação de tronco, `postureSignals.ts:11-28`) e `SwingDetector` (raquetada por velocidade do punho em coordenadas de mundo, `swingDetector.ts`). Todos usam filtro 1-Euro (`src/cv/oneEuroFilter.ts`) e histerese (`schmittTrigger.ts`) — matemática barata e sem dependência de Three.js.
5. **Jogos** — `GameCanvas` faz code-split por modalidade via `import()` dinâmico (`src/ui/GameCanvas.tsx:31-33`) e instancia `TrackGame`/`TennisGame`, que rodam num `GameLoop` de passo fixo 1/60 com acumulador limitado e `renderer.setAnimationLoop` (`src/games/core/GameLoop.ts:43-56`). Eventos CV viram `onAction` nos jogos; HUD é publicado a 5 Hz com detecção de mudança (`TrackGame.ts:125-131`, `TennisGame.ts:73-79`).
6. **UI** — tela cheia: canvas do jogo, seletor de modalidade + mudo (`hud-dock`), e PiP de câmera com esqueleto sobre o vídeo (`drawPose`, `src/ui/PoseOverlay.ts`) e botões de calibração. A calibração grava 3 s de pose neutra e exige ≥12 amostras `tracked`, ≥2,8 s de span e ≥65% de frames válidos (`src/cv/calibrator.ts:22-51`).

Testes: `tests/kinematics.test.ts` cobre os detectores com fixtures sintéticas (7 testes, todos passando nesta análise).

---

## Resumo executivo

| # | Gargalo | Gravidade | Confiança |
|---|---------|-----------|-----------|
| 1 | **A câmera nunca inicializa**: `forVisionTasks` chamado sem `useModule` dentro de um module worker → `importScripts` lança `TypeError` → `await import` do loader clássico não define `self.ModuleFactory` → INIT falha em GPU e em CPU. Verificado ao vivo no build de produção em Chromium real. | **Crítica (funcionalidade morta)** | Certa (reproduzido) |
| 2 | **~20 MB de ativos de CV + cadeia de inicialização serial** (clique → permissão → play → worker → fetch+compile WASM 14,7 MB → fetch modelo 5,8 MB → init de grafo → calibração 3 s). | Alta | Certa (medido em `dist/`) |
| 3 | **Cache fraco na Vercel para `/mediapipe/*`**: arquivos sem hash no nome → `max-age=0, must-revalidate` por padrão; `.task` fora da lista de compressão → ~5,8 MB sem gzip. | Alta (visitas recorrentes) | Alta (docs oficiais) |
| 4 | **Safari < 17 continua sem CV mesmo após o fix**: o GraphRunner do MediaPipe exige `OffscreenCanvas` em worker para Safari ≥ 17; abaixo disso cai num caminho que usa `document`, inexistente em worker. | Alta (iOS < 17) | Alta (código do bundle) |
| 5 | **Respawn do worker a cada liga/desliga**: `stop()` termina o worker; cada `start()` refaz fetch do WASM, recompila 14,7 MB e refaz init do grafo. | Média | Certa (código) |
| 6 | **Peso morto no deploy**: a segunda variante WASM (`vision_wasm_module_internal.*`, ~15 MB) é copiada e publicada sem nunca ser carregada na configuração atual (e a clássica se torna a morta após o fix). | Média (deploy) | Certa |
| 7 | **Teto de throughput do CV por design**: um frame em trânsito + `detectForVideo` síncrono → fps efetivo ≈ min(30, 1000/round-trip); em fallback CPU ou GPU fraca o jogo passa a receber ~10–25 poses/s. | Média | Alta |
| 8 | **`createImageBitmap` por frame** na thread principal antes do envio — cópia de 640×480 por quadro; hoje majoritariamente no-op de redimensionamento. | Baixa | Certa |

> Nota de honestidade: o achado #1 é um **bug de correção**, não apenas desempenho — mas é de longe o maior "gargalo" do produto: 0% do pipeline CV funciona hoje.

---

## Gargalos

### 1. (BLOQUEIO TOTAL) `forVisionTasks` sem `useModule` dentro de module worker — a câmera nunca liga

**O que é.** `poseClient.ts:28` cria o worker com `{ type: 'module' }`. O worker chama `FilesetResolver.forVisionTasks(wasmBaseUrl)` com um único argumento (`src/cv/pose.worker.ts:12`). Em `node_modules/@mediapipe/tasks-vision/vision.d.ts:819`, a assinatura é `forVisionTasks(basePath?, useModule?)`. Com `useModule` omitido (`false`), o resolver aponta para `vision_wasm_internal.js` — a variante **clássica** do loader.

**Cadeia da falha (verificada no código do bundle `vision_bundle.mjs` e no build `dist/`):**

1. O loader chama `importScripts(url)` para carregar `vision_wasm_internal.js`. `importScripts` existe em todo `WorkerGlobalScope`, mas **lança `TypeError` em module workers** — MDN: "TypeError — Thrown if the current WorkerGlobalScope is a module"; HTML Standard: "the `importScripts()` method will automatically fail inside module workers".
2. O `catch` do MediaPipe trata `TypeError` como "ambiente de módulo" e faz fallback para `await import(url)` do **mesmo arquivo**.
3. `vision_wasm_internal.js` declara `var ModuleFactory = (() => { ... })()` + exports UMD (`module.exports`/`define`), **sem** `export` ESM. Importado como módulo, o `var` fica restrito ao escopo do módulo e o namespace retornado é vazio — `self.ModuleFactory` nunca é definido (verificado em Node 24: `await import(...)` → `globalThis.ModuleFactory === undefined`, namespace `{}`).
4. O resolver então lança `Error("ModuleFactory not set.")` → `createTask('GPU')` falha → `fallback()` tenta `createTask('CPU')` → mesmo ponto de falha → `ERROR fatal init`.

**Evidência empírica (Chromium headless real via Playwright, `dist/` servido por HTTP):** instanciando o `pose.worker` compilado com a mensagem `INIT` exata do app, a resposta é:

```json
{ "type": "ERROR", "stage": "init", "fatal": true,
  "message": "GPU falhou (ModuleFactory not set.); fallback CPU também falhou (ModuleFactory not set.)." }
```

e o probe confirma `importScripts` lançando `TypeError: Module scripts don't support importScripts()` no module worker. Na UI, `onStatus('error')` → `stopCamera()` (`src/App.tsx:102`) — o usuário vê a mensagem de erro e a câmera permanece desligada. O bug existe desde o primeiro commit (`git log`), em dev e em produção — o caminho de câmera provavelmente nunca foi exercitado de ponta a ponta.

**Prova da correção:** no mesmo harness, um module worker executando `FilesetResolver.forVisionTasks(wasmBaseUrl, /* useModule */ true)` + `PoseLandmarker.createFromOptions` com `delegate: 'GPU'` inicializou com sucesso ("Graph successfully started running", ~228 ms após o fetch do modelo, WebGL2/SwiftShader). A variante `vision_wasm_module_internal.js` existe exatamente para isso: `async function ModuleFactory(...)`, `globalThis.ModuleFactory = ModuleFactory` e `export default` — verificado em `node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_module_internal.js` (cabeçalho e rodapé do arquivo).

**Impacto:** 100% da funcionalidade-carro-chefe (controle por corpo) indisponível; só o teclado funciona.

**Direção de correção:** passar `true` como segundo argumento de `forVisionTasks` — um parâmetro resolve. Alternativa: instanciar o worker como clássico, mas o padrão `{ type: 'module' }` é o recomendado pelo Vite e mantém os `import` do bundle (vite.dev/guide/features → "Web Workers"). Vale também um teste de fumaça que envie `INIT` ao worker compilado para impedir regressão.

### 2. Cadeia de inicialização serial + ~20 MB de ativos de CV por visita fria

**O que é.** O caminho até a primeira pose é estritamente serial (`src/App.tsx:81-99`, `src/cv/poseClient.ts:20-70`):

clique → `audio.unlock()` → `getUserMedia` (permissão + probe de dispositivo) → `video.play()` → espera `loadeddata` → `new Worker` (parse de 156 KB) → `importScripts`/import do loader WASM (337 KB) → **fetch do `.wasm` (14 665 716 B)** → compilação → **`fetch(modelUrl)` (5 777 746 B)** → `createFromOptions` → `READY` → gate de 3 frames → calibração de 3 s.

**Números medidos no `dist/` e em `public/`:**

| Ativo | Tamanho bruto | gzip -9 |
|---|---|---|
| `mediapipe/wasm/vision_wasm_internal.wasm` | 14 665 716 B (14,0 MiB) | 4 147 452 B |
| `mediapipe/wasm/vision_wasm_internal.js` | 336 624 B | 80 992 B |
| `mediapipe/models/pose_landmarker_lite.task` | 5 777 746 B (5,5 MiB) | 4 969 689 B (~14% menor) |
| `assets/pose.worker-*.js` | 155 905 B | ~45,4 KB |
| `mediapipe/wasm/vision_wasm_module_internal.{js,wasm}` | 15 002 362 B | publicado, não usado |

Total a buscar para ativar a câmera (visitante frio): ~9,3 MB comprimidos / ~20,7 MB brutos — só começando depois que o usuário autoriza a câmera. Em conexão móvel mediana (~10 Mb/s), são ~7–8 s de rede + ~0,5–2 s de compilação WASM + init de grafo + 3 s de calibração. Nada disso é paralelizado com a espera de permissão de câmera, que normalmente já é a parte mais lenta e não depende dos arquivos.

**Por que é gargalo:** tempo até o primeiro input jogável facilmente passa de 5–10 s; cada segundo extra de espera no fluxo de "ativar câmera" é abandono puro em demo de hackathon.

**Direção de correção:**
- Iniciar o worker (fetch + compile WASM + fetch do modelo) **em paralelo ao `getUserMedia`** — a inicialização do MediaPipe não precisa de frames de câmera.
- Pré-aquecer o cache com `<link rel="preload" as="fetch">` ou `fetch()` ocioso após o primeiro paint para `vision_wasm_internal.wasm` e o `.task` — a compressão streaming de WASM (`compileStreaming`) depende de MIME `application/wasm` (Vercel serve corretamente).
- O modelo pode ser buscado pelo próprio MediaPipe via `modelAssetPath` (o bundle já implementa `fetch` interno, `vision_bundle.mjs`) — permite descartar a cópia manual para `Uint8Array` + `FS_createDataFile` (~5,8 MB de memcpy), ou manter `modelAssetBuffer` para controle — custo baixo de qualquer forma.

### 3. Cache e compressão na Vercel para `/mediapipe/*`

**O que é.** `vercel.json` (`vercel.json:1-5`) define só framework/build/output — nenhum `headers`. Os ativos de CV vivem em `public/mediapipe/` e são copiados sem hash no nome para `dist/`.

**Evidência externa (docs oficiais da Vercel, lidas nesta análise):**

- `vercel.com/docs/caching/cache-control-headers`: **"The default value is `cache-control: public, max-age=0, must-revalidate`"** — navegador e CDN não retêm o recurso; cada visita revalida (304 com sorte, download frio com azar).
- `vercel.com/docs/edge-network/caching` (canonical `/docs/caching/cdn-cache`): arquivos estáticos são cacheados na CDN "for the lifetime of the deployment after the first request" — ou seja, o primeiro usuário de cada POP paga o custo total de origem.
- `vercel.com/docs/how-vercel-cdn-works/compression`: a lista de MIME comprimíveis inclui **`application/wasm`** → o `.wasm` de 14,7 MB viaja a ~4,1 MB (gzip medido localmente; brotli tende a ser menor). Arquivos `.task` não constam na lista → `pose_landmarker_lite.task` provavelmente vai **sem compressão** nos 5,78 MB brutos (marcação: provável, não verificado num deploy real — ver seção de perguntas abertas).

**Impacto:** toda visita paga pelo menos uma revalidação de ~20 MB de binários; e o modelo viaja ~16% maior do que poderia.

**Direção de correção:**
- Adicionar `headers` no `vercel.json`: `Cache-Control: public, max-age=31536000, immutable` para `/mediapipe/(.*)` — é seguro porque o conteúdo é versionado de fato: o `prebuild` pinha a versão do pacote e valida o SHA-256 do modelo (`scripts/copy-mediapipe-wasm.mjs`), ou seja, mudança de conteúdo implica mudança de deploy.
- Alternativa/robustez: nomear o modelo com o hash (`pose_landmarker_lite.59929e1d.task`) — conteúdo endereçado como os assets do Vite.
- O `.task` comprime pouco (~14%); se quiser otimizar, avalie servir `.task.br`/`gzip` com `Content-Encoding` via headers — provavelmente não vale o esforço.

### 4. Safari < 17 continua sem CV mesmo após o fix do `useModule`

**O que é.** O `GraphRunner` do MediaPipe (dentro de `vision_bundle.mjs`, função `Oh()` + construtor `Gh`) decide o canvas GL assim: se `OffscreenCanvas` existe **e** (não é Safari **ou** versão ≥ 17) → `new OffscreenCanvas(1,1)`; senão → `document.createElement("canvas")`. Dentro de um worker, `document` não existe → `ReferenceError` → `createFromOptions` falha → e o fallback CPU passa pelo **mesmo** construtor → também falha.

**Evidência:** código do bundle `node_modules/@mediapipe/tasks-vision/vision_bundle.mjs` (função `Oh` = gate explícito `Version >= 17` para Safari; construtor `Gh` com o fallback para `document`). `OffscreenCanvas` é baseline desde mar/2023 (MDN), mas o WebGL dentro de OffscreenCanvas só chegou ao Safari 17 — daí o gate deles. Somado ao achado #1, a matriz hoje é: Chrome/Edge/Firefox → falha (bug do `useModule`); Safari ≥ 17 → falha (mesmo bug); Safari < 17 → falha dupla (bug + OffscreenCanvas ausente).

**Impacto:** iPhone com iOS < 17 (parcela relevante da base instalada) não tem caminho de correção por parâmetro — precisaria de um fallback que rode o landmarker na thread principal (onde `document` existe) ou de um alerta de compatibilidade.

**Direção de correção:** após o fix #1, detectar `OffscreenCanvas`/versão antes de spawnar o worker; se indisponível, rodar `PoseLandmarker` no main thread (a API aceita isso — `document.createElement("canvas")` funciona lá) ou exibir mensagem de requisito (Safari 17+/Chromium). O WASM em si é single-thread e não exige `SharedArrayBuffer`/COOP-COEP — verificado: a seção de memória do `.wasm` tem flag `0x01` (não-compartilhada) e o loader JS não contém caminho de pthread.

### 5. Worker recriado do zero a cada liga/desliga de câmera

**O que é.** `PoseClient.stop()` (`src/cv/poseClient.ts:111-118`) manda `DISPOSE` e chama `worker.terminate()` no mesmo tick — o `DISPOSE` quase certamente nunca é processado (irrelevante: o teardown do worker libera tudo). O custo real está no caminho de volta: `startCamera` → `new Worker` → `INIT` completo — refetch do loader + do `.wasm` de 14,7 MB (cache HTTP, mas ainda revalida/parseia), **recompilação WASM**, refetch + recópia do modelo (5,8 MB) e recriação do grafo — alguns segundos a cada toggle, e uma pausa perceptível na UI.

**Impacto:** usuário que desliga a câmera (bateria/privacidade) e religa paga o boot inteiro de novo; numa demo ao vivo isso é ruim.

**Direção de correção:** manter o worker quente — separar "ciclo de vida do landmarker" de "ciclo de vida da captura": `stop()` cancela o rVFC/rAF e pausa a câmera, mas o worker (e o grafo) permanece pronto; religar vira custo ~0. Também vale considerar desligar o landmarker só por inatividade longa (ex.: > 2 min).

### 6. Teto de throughput do CV: um frame em trânsito + inferência síncrona

**O que é.** O design "um frame em trânsito" (`busy`, `poseClient.ts:10,94-96`) + `detectForVideo` **síncrono** no worker (`pose.worker.ts:82`) impõe o teto:

```
fps_efetivo ≤ min(30 (câmera), 1000 / (t_bitmap + t_postMessage + t_inferência + t_retorno))
```

Cada `FRAME` faz `createImageBitmap(video, { resizeWidth: 640, resizeQuality: 'low' })` (`poseClient.ts:101`) — uma cópia do quadro — e o MediaPipe sobe o bitmap para a GPU via `texImage2D` no caminho GPU (verificado no bundle: `addGpuBufferToStream` → `texImage2D` → `_addBoundTextureAsImageToStream`) e, no caminho CPU, faz `drawImage` + `getImageData` + cópia para o heap WASM (~1,2 MB por quadro a 640×480).

**Números de referência (fontes primárias):** a model card oficial `litert-community/MediaPipe-PoseLandmarker-Lite` (Hugging Face, SHA-256 idêntico ao do `SHA256SUMS` do repo — `59929e1d…574a`) cita do model card BlazePose **≈44 FPS em CPU (XNNPACK) e ≈49 FPS em GPU num Pixel 3** — ~20–23 ms/frame num telefone de 2018. O WASM do pacote usa SIMD (≈150 mil instruções `0xFD` contadas na seção de código) e é single-threaded (memória não-compartilhada). As docs oficiais (`ai.google.dev/mediapipe/solutions/vision/pose_landmarker`) descrevem o modo `VIDEO` como "processes every frame in order and never drops frames" e recomendam exatamente o padrão adotado aqui para livestream (processar só o frame mais recente).

**Impacto:** em desktop com GPU discreta/integrada moderna, 30 fps de CV é atingível; em fallback CPU ou GPU integrada fraca, a cadência efetiva cai para ~10–25 poses/s — ainda jogável (cadência de corrida ~120–180 spm = 2–3 Hz pede só ~6+ fps pelo critério de Nyquist), mas saltos/raquetadas rápidos ficam mais grossos. **Isso é trade-off intencional correto** — melhor frame fresco atrasando do que fila crescente — mas é o gargalo estrutural do produto.

**Direção de correção (se precisar de mais throughput/latência):**
- Reduzir `resizeWidth` no modo CPU (ex.: 320 px) — o modelo recebe 224²/256² internamente de qualquer forma; menos upload/leitura por quadro.
- `VideoFrame` (WebCodecs) em vez de `ImageBitmap` — também transferível e mais barato de produzir — mas `detectForVideo` aceita os dois; ganho pequeno.
- Aceitar timestamp do `rVFC` `metadata.captureTime` para medir latência fim-a-fim real (hoje `capturedAtMs` usa o `now` do rVFC = instante de submissão ao compositor, que **subestima** a latência fóton→ação; MDN lista `captureTime` para fontes locais).
- Aumentar para 2 frames em trânsito trocaria latência por throughput — não recomendo: frescor importa mais neste jogo.

### 7. Cópia `createImageBitmap` por frame na thread principal

**O que é.** `poseClient.ts:101` gera um `ImageBitmap` novo por quadro capturado. `createImageBitmap` é baseline (MDN, set/2021) e `ImageBitmap` é transferível — o `postMessage(..., [bitmap])` é zero-copy na fronteira do worker (MDN "Transferable objects"). O custo é a produção do bitmap em si (conversão/cópia, alguns ms assíncronos), somada ao `texImage2D` interno do MediaPipe.

**Impacto:** ~1–4 ms por frame na prática — pequeno, mas está no caminho crítico do round-trip. `resizeWidth: 640` hoje é quase sempre no-op (a constraint `ideal: 640` tende a ser atendida); se a câmera entregar 1080p, o resize na GPU é a coisa certa a fazer.

**Direção de correção:** nada urgente. Se otimizar: `VideoFrame` direto ou enviar o bitmap sem resize quando `videoWidth === 640`. Manter o `bitmap.close()` — já feito no worker (`pose.worker.ts:98`) e no caminho de descarte (`poseClient.ts:76,102`).

---

## Descartados ou menores

- **Loop do jogo** — passo fixo 1/60 com acumulador limitado a 0,1 s e teto de 5 substeps (`GameLoop.ts:46-55`), `setAnimationLoop` (loop compatível com XR), `setPixelRatio ≤ 1,5` (`GameLoop.ts:35`), resize via `ResizeObserver`. Correto e sem churn por frame — descartado como gargalo.
- **Alocações Three.js** — cenas montadas uma vez; hurdles reciclados com `disposeObjectTree` no despawn (`TrackGame.ts:114-117`), materiais compartilhados com dedupe por `Set` (`GameLoop.ts:4-18`); `TennisGame` reusa `Vector3` (`addScaledVector`, `TennisGame.ts:62`). A doc do three.js confirma que dispose explícito é a prática correta — cumprida. Descartado.
- **React a ~30 Hz** — `setTracking` e `setCameraStatus` são chamados por frame de pose (`App.tsx:107`), mas React pula o re-render quando o valor é `Object.is`-idêntico (react.dev/reference/react/useState). Os demais setState são ≤5 Hz (calibração 200 ms, HUD 200 ms com comparação de string). Descartado — não há re-render a 60 Hz.
- **Overlay de pose (canvas 2D)** — ~26 linhas/círculos por frame a 640×480 (`PoseOverlay.ts:18-27`); `getContext('2d')` por chamada retorna contexto cacheado. Espelho por CSS (`scaleX(-1)`) é grátis. Descartado.
- **Code splitting** — Three.js isolado no chunk lazy `GameLoop-*.js` (538 KB / ~132 KB gz) carregado só pelo `import()` do `GameCanvas`; worker isolado (156 KB) só no "Ativar câmera"; bundle principal 243 KB / ~77 KB gz (React + app). Saudável — descartado. Oportunidade cosmética: `modulepreload` do chunk do jogo no `index.html`.
- **Structured clone do resultado** — 66 objetos pequenos por frame (`simplify`, `pose.worker.ts:28-30`) — desprezível. Descartado.
- **Single-threaded WASM, sem COOP/COEP** — verificado na seção de memória do `.wasm` (flag não-compartilhada) e ausência de pthreads no loader → nenhum header de isolamento necessário. Descartado.
- **SIMD** — ~150 mil opcodes `0xFD` na seção de código: build SIMD confirmado; bom para CPU fallback. Browsers pré-2021 não rodam, mas o gate do item #4 já os exclui.
- **DISPOSE + terminate imediato** (`poseClient.ts:115-116`) — `landmarker.close()` provavelmente não roda, mas o kill do worker libera memória/GL de qualquer forma. Cosmético.
- **Código morto pós-telemetria** — `inferenceMs`/`receivedAtMs`/`bodyConfidence`/`capturedAtById`/`frameId` continuam sendo computados e transportados sem consumidor (`poseClient.ts:17,44-48`, `pose.worker.ts:83`); `CalibrationProfile.swing` nunca é preenchido (`protocol.ts:37`) e `SwingDetector.setPowerAnchors` só é chamado em teste — os anchors de potência são sempre os defaults 2/7 (`swingDetector.ts:15-16`). Pequena limpeza pendente.
- **Quirk de score** — `this.score += Math.round(dt * (5 + speed01 * 45))` (`TrackGame.ts:95`): a dt = 1/60 s o termo é 0,08–0,83 → arredonda para 0 na maioria dos frames; o placar quase só anda pelos bônus de hurdle (+100/−35). Provável bug de gameplay (acumular fração), não de perf.
- **Beacon do MediaPipe** — o bundle envia métricas para `https://odml.pa.googleapis.com/v1/log` (string encontrada em `vision_bundle.mjs`), coerente com o aviso de privacidade do README — tráfego minúsculo, mas é uma chamada externa que os headers de CSP (se vierem a existir) precisam permitir.
- **Remount do `GameCanvas` por modalidade** (`key={sport}`, `App.tsx:140`) — destrói e recria contexto WebGL a cada troca; disposal correto, custo de dezenas de ms — aceitável.
- **StrictMode** (`main.tsx:5`) — double-mount só em dev; o flag `disposed` em `GameCanvas` lida corretamente com a corrida do `import()` assíncrono (`GameCanvas.tsx:23,35-38`).
- **`frameRate: { max: 30 }`** — limita a câmera a 30 fps por decisão consciente (CV não acompanha mais que isso); `ideal` em vez de `exact` tolera câmeras que entregam outra resolução. Descartado.
- **Pausa em aba oculta** — rAF/rVFC pausam naturalmente; o clamp de 0,1 s do acumulador evita salto de simulação no retorno. Descartado.

---

## Perguntas em aberto / não verificado

- **MIME e compressão do `.task` na Vercel** — a allowlist oficial de compressão não cita `application/octet-stream` nem `.task`; provável que vá sem gzip (5,78 MB brutos). Não medido num deploy real — verificar `curl -H 'Accept-Encoding: br' -I` na URL de produção.
- **`Cache-Control` efetivo para `/assets/*-hash.js` no deploy Vite** — as docs cobrem `_next/static`/`/_vercel/immutable` e o default `max-age=0`; para assets hasheados do Vite há persistência na CDN, mas o header para o navegador depende do preset — confirmar no deploy real.
- **Latência real fóton→tela da câmera** — `getUserMedia` entrega frames com ~30–80 ms de atraso de pipeline (sensor/ISP/compositor), não medido aqui; `metadata.captureTime` do rVFC é o instrumento correto (MDN) caso a telemetria volte.
- **Ms/frame de inferência em GPU real** — só inicialização foi exercida (228 ms, SwiftShader); latência de `detectForVideo` em hardware real não medida. Referência externa: ≈20–23 ms/frame no Pixel 3 (model card).
- **`resizeWidth`/`resizeQuality` de `createImageBitmap` no Safari** — MDN marca suporte variável para as opções; se ignoradas, o bitmap sai em resolução cheia (mais upload, ainda funcional).
- **Se `worker.terminate()` antes do DISPOSE deixa recursos WASM** — teardown do worker deve liberar tudo; não instrumentado.

---

## Fontes

Código (citações `path:line` neste repo): `src/App.tsx`, `src/cv/{poseClient,pose.worker,protocol,calibrator,oneEuroFilter}.ts`, `src/kinematics/*`, `src/games/{core/GameLoop,track/TrackGame,tennis/TennisGame,audio}.ts`, `src/ui/{CameraPip,GameCanvas,PoseOverlay}.{tsx,ts}`, `scripts/copy-mediapipe-wasm.mjs`, `vite.config.ts`, `vercel.json`, `index.html`, `package.json`, `tests/kinematics.test.ts`, `public/mediapipe/models/SHA256SUMS`. Código-fonte de terceiros lido em `node_modules/@mediapipe/tasks-vision/`: `vision.d.ts:819` (assinatura `useModule`), `vision_bundle.mjs` (`importScripts`+fallback `await import`, gate `Oh()` Safari ≥ 17, caminho `texImage2D` GPU, `getImageData` CPU, endpoint de telemetria), `wasm/vision_wasm_{internal,module_internal}.{js,wasm}` (cabeçalhos/footers, seção de memória, contagem SIMD). Build medido em `dist/` após `npm run build`. Reprodução em Chromium headless (Playwright) com o worker compilado e com o `INIT` real do app.

Documentos (todos lidos nesta análise):

- https://ai.google.dev/mediapipe/solutions/vision/pose_landmarker — running modes, monotonic timestamps, padrão livestream "latest frame", inputs 224×224/256×256 fp16.
- https://ai.google.dev/mediapipe/solutions/vision/pose_landmarker/web_js — exemplo oficial de livestream `VIDEO` + rAF.
- https://huggingface.co/litert-community/MediaPipe-PoseLandmarker-Lite — tamanho/SHA-256 do `.task` (bate com o repo), ≈44 FPS CPU / ≈49 FPS GPU no Pixel 3, sub-modelos detector 224² / landmarker 256².
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback — dispara por frame em min(fps do vídeo, refresh), pode chegar um vsync atrasado, metadados `captureTime`/`mediaTime`.
- https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts — `TypeError` em module workers.
- https://html.spec.whatwg.org/multipage/workers.html — "importScripts() will automatically fail inside module workers".
- https://developer.mozilla.org/en-US/docs/Web/API/createImageBitmap — baseline 2021, opções `resizeWidth`/`resizeQuality`.
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects — `ImageBitmap`/`VideoFrame` transferíveis, transferência zero-copy.
- https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas — baseline mar/2023.
- https://react.dev/reference/react/useState — bail-out por `Object.is`.
- https://vite.dev/guide/features — Web Workers, `type: 'module'` como padrão recomendado.
- https://vercel.com/docs/caching/cache-control-headers — default `public, max-age=0, must-revalidate`.
- https://vercel.com/docs/edge-network/caching — cache de estáticos na CDN por deployment.
- https://vercel.com/docs/how-vercel-cdn-works/compression — `application/wasm` na lista de comprimíveis.
- https://threejs.org/manual/pages/how-to-dispose-of-objects.html — dispose explícito de geometria/material/textura é responsabilidade da aplicação.

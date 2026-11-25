# Auditoria profunda — uso do MediaPipe/`@mediapipe/tasks-vision`

Data: 25 de novembro de 2026 · Estado auditado: `main` pós-merge (`fc3e6a4`, PR #1) · Pacote: `@mediapipe/tasks-vision@1.2.3` (`package.json:18`)

Esta auditoria foi feita contra **fontes primárias**: o código do repo, os `.d.ts` e o bundle compilado em `node_modules/@mediapipe/tasks-vision/`, o binário `.wasm` (seções de memória/código inspecionadas), o registry do npm (`npm view`), as docs oficiais (ai.google.dev), o código-fonte C++/proto/TS no GitHub `google-ai-edge/mediapipe` e MDN. Ela complementa `docs/analise-de-gargalos.md` (análise de gargalos de novembro) — itens já corrigidos no merge são marcados.

---

## 1. Resumo executivo

**Veredito geral: o uso do MediaPipe está correto e atual.** O pin `1.2.3` é exatamente o último estável publicado (`dist-tags.latest = "1.2.3"`; acima só existem `1.2.4-rc.*` e `1.3.0-rc.*` no canal nightly — `npm view @mediapipe/tasks-vision dist-tags`). Não há versão estável mais nova para subir. As decisões centrais (module worker + `useModule: true`, `runningMode: 'VIDEO'`, `numPoses: 1`, `outputSegmentationMasks: false`, um frame em trânsito, `ImageBitmap` transferido) correspondem ao padrão oficial recomendado para livestream.

Os achados materiais, em ordem de impacto:

| # | Achado | Impacto | Tipo |
|---|--------|---------|------|
| 1 | **O modelo já devolve landmarks suavizados por um 1-Euro interno** (VIDEO + `numPoses: 1` liga `smooth_landmarks` automaticamente no grafo C++). Os `OneEuroFilter` do app operam sobre dados pré-suavizados — dupla filtragem com atraso extra que ninguém calibrou. | Médio-Alto (latência/tuning de todos os detectores) | Desconhecimento da API |
| 2 | **O fallback CPU não é um caminho sem GPU**: o input de *todo* frame sobe ao grafo via `texImage2D` no WebGL do `OffscreenCanvas` — inclusive no delegate CPU (upload + readback interno por frame). Navegador sem WebGL alguma falha nos dois delegates — no primeiro *frame*, não no init. | Médio-Alto (compat + custo real do modo CPU) | Footgun de API |
| 3 | **Safari < 17 morre no init do worker, nos dois delegates** — o `GraphRunner` exige `OffscreenCanvas` para Safari ≥ 17 e cai em `document.createElement` (inexistente em worker) abaixo disso. iOS < 17 fica sem CV, sem mensagem de compatibilidade. | Médio-Alto (parcela iOS) | Compat |
| 4 | **Pipeline estritamente serial**: `busy` bloqueia até a *criação* do `ImageBitmap`; criar o bitmap do frame N+1 durante a inferência do N recuperaria ~2–6 ms/frame de latência. | Médio-Baixo (throughput/latência) | Oportunidade |
| 5 | **Fallback GPU→CPU instancia um segundo módulo WASM inteiro** (segundo heap de ~15–20 MB, refetch do loader e do modelo via cache HTTP). `setOptions({baseOptions: {delegate: 'CPU'}})` reconstruiria o grafo no mesmo heap — caminho mais barato, porém não documentado; exige validação. | Baixo-Médio | Oportunidade |
| 6 | **`new VideoFrame(video)` pode substituir `createImageBitmap` por frame** — aceito por `detectForVideo` (`TexImageSource`), copia GPU→GPU, transferível, baseline set/2024. | Baixo-Médio | Oportunidade (benchmark) |
| 7 | **Sem frame de aquecimento**: a primeira `detectForVideo` paga alocação lazy do TFLite; um frame dummy pós-READY tiraria o spike do primeiro gesto do usuário. | Baixo | Oportunidade |
| 8 | Opções nunca ajustadas (confidências todas no default 0.5), `metadata.captureTime` do rVFC não aproveitado para telemetria de latência, `worldLandmarks`/`presence` subutilizados no gate. | Baixo | Oportunidade |
| 9 | Telemetria do bundle (`odml.pa.googleapis.com/v1/log`, flush a 60 s) roda por frame no worker — divulgada em THIRD_PARTY_NOTICES; se um dia houver CSP, `connect-src` precisa admiti-la. | Informativo | OK c/ ressalva |

Coisas que **não** são problema (verificadas): `detectForVideo` não tem variante async na web (sincronia é obrigatória — um frame em trânsito é o design certo); `LIVE_STREAM` não existe no modo web (VIDEO + frame-mais-recente é o padrão oficial); não há `smoothLandmarks`/`smoothSegmentation` na API JS — e não faria falta, porque a suavização interna já vem ligada (achado #1); `ImageBitmap`/`VideoFrame`/`OffscreenCanvas`/`ImageData` são os únicos tipos válidos no worker e `ImageBitmap` é uma escolha sólida; o `.wasm` é SIMD128 e single-threaded; `forVisionTasks` só monta paths (o fetch do loader/modelo acontece depois, na criação da task).

---

## 2. Como o código usa o MediaPipe hoje — mapa por arquivo

### `src/cv/pose.worker.ts` (module worker, lado do modelo)

| Linha | Uso | Verificado |
|-------|-----|------------|
| `12` | `FilesetResolver.forVisionTasks(wasmBaseUrl, true)` | `useModule` no 2º arg (assinatura `vision.d.ts:819`). No bundle compilado, `forVisionTasks → nh("vision", base, useModule)` → paths `{wasmLoaderPath, wasmBinaryPath}` para `vision_wasm_module_internal.{js,wasm}` — **não faz fetch**, só monta URLs (`vision_bundle.mjs`, função `nh`, offset ~49305) |
| `13-15` | `fetch(modelUrl)` manual → `Uint8Array` → `modelAssetBuffer` | Alternativa seria `modelAssetPath` (o lib faz `fetch` interno — `ru.l()` no bundle, offset ~68400: `fetch(e.modelAssetPath.toString())`). Equivalente; o fetch manual dá checagem de status explícita |
| `16-24` | `PoseLandmarker.createFromOptions(vision, { baseOptions: {modelAssetBuffer, delegate}, runningMode:'VIDEO', numPoses:1, outputSegmentationMasks:false, minPoseDetectionConfidence:.5, minPosePresenceConfidence:.5, minTrackingConfidence:.5 })` | Os únicos campos que a API JS de pose aceita — `PoseLandmarkerOptions` (`vision.d.ts:2745-2768`). Os três thresholds são os defaults (0.5) escritos à mão — sem efeito, mas explícito |
| `28-30` | `simplify()` → `{x,y,z,visibility?,presence?}` ×2 arrays | `Qa`/`th` no bundle (offset ~48461) emitem exatamente esses campos do proto; `presence` só é setado quando presente no proto — o modelo emite (split tensor 2 = presence scores) |
| `32-46` | `fallback()`: `landmarker?.close()` → `createTask('CPU')` → msg `FALLBACK` | `close()` existe (`vision.d.ts:2880`) e chama `closeGraph()` + libera texturas de máscara (`ea.close()`). Um **segundo** `ModuleFactory` é criado → segundo heap wasm (~15–20 MB) — ver achado #5 |
| `48-98` | `onmessage`: `INIT` → `createTask` (+fallback) → `READY`; `DISPOSE` → `close()`; `FRAME` → `detectForVideo(bitmap, timestampMs)` → `POSE`; erro de detect → `fallback()`; `finally` → `bitmap.close()` | `detectForVideo` é **síncrona** (`vision.d.ts:2717`; internamente `finishProcessing → _waitUntilIdle()`, offset ~89005). `bitmap.close()` no `finally` é obrigatório e correto — a posse passou para o worker via transfer |
| `81` | `detectForVideo(bitmap, timestampMs)` | Sem validação de timestamp no JS — o `timestamp` vira o timestamp do packet no stream `image_in` (`Da` → `_addBoundTextureAsImageToStream`, offset ~87692). A monotonicidade exigida pelo framework C++ é garantida do lado do cliente |

### `src/cv/poseClient.ts` (main thread, ciclo de vida + transporte)

| Linha | Uso | Verificado |
|-------|-----|------------|
| `37-40` | `warmVisionAssets()`: `fetch()` + `arrayBuffer()` do `.js`, `.wasm` e `.task` | Aquece o **cache HTTP**; depois o worker consome: `import()` do loader (`Mh`, offset ~56115 — módulo usa `await import` após `importScripts` lançar `TypeError`), `instantiateStreaming(fetch(.wasm))` do Emscripten, `fetch(modelUrl)`. Todos batem no cache — eficaz |
| `50-55` | `init()` com dedup via `initPromise` | Um spawn por vez; `ready` curto-circuita reinits |
| `57-83` | `beginCapture`: rVFC quando existe (dispara por frame novo do vídeo — baseline out/2024, MDN), senão rAF + `video.currentTime !== lastVideoTime` | O fallback rAF replica o padrão oficial das docs (ai.google.dev: "VIDEO + rAF — each paint inspects only the latest camera frame"). rVFC é estritamente melhor: casa o cadastro com o frame, não com o vsync |
| `85-92` | `pauseCapture()`: `cancelVideoFrameCallback`/`cancelAnimationFrame` | POSE tardia descartada por `if (!this.capturing) return` (linha 130) — sem efeito colateral |
| `94-106` | `dispose()`: `pauseCapture` + `DISPOSE` + `terminate()` | `DISPOSE` quase certamente perde a corrida com `terminate()` — inócuo: o teardown do worker libera heap WASM + contexto GL de qualquer forma |
| `108-150` | `spawn()`: `new Worker(url, {type:'module'})` → `INIT` → `READY/ERROR/FALLBACK/POSE` + timeout 30 s | `{type:'module'}` é o padrão Vite e o motivo de `useModule: true` ser obrigatório (bug já corrigido no merge — `9c76399`) |
| `152-165` | `capture()`: `busy` (um frame em trânsito) → `createImageBitmap(video, {resizeWidth:640, resizeQuality:'low'})` → `postMessage(FRAME, [bitmap])` | Transfer = zero-copy na fronteira (MDN Transferable). `resizeWidth`/`resizeQuality` suportados em Chrome 54+/FF 98+/Safari 15+ (caniuse); ignorados onde ausentes — degrada graciosamente |
| `155-156` | `Math.max(now, lastTimestamp + 0.01)` | Garante timestamps **estritamente crescentes** — exigência do framework MediaPipe (streams não admitem timestamp que regride; violação emerge como erro de grafo via `attachErrorListener → Jh`). Correto e necessário |
| `167-170` | `confidence()`: `min(visibility)` em [11,12,15,16,23,24,25,26] | `visibility` é o único campo garantido; o gate usa `min(vis, presence)` (`math.ts:16`) — composição consistente |

### `src/cv/protocol.ts`, `calibrator.ts`, `oneEuroFilter.ts`, `src/kinematics/*`

- `PoseSnapshot` carrega `landmarks` (33 normalizados) + `worldLandmarks` (33 em metros, origem no quadril) + `timestampMs` = timestamp do frame enviado.
- Consumo real de campos: `landmarks` → gate/cadência/salto/lean/overlay; `worldLandmarks` → `SwingDetector` (velocidade 3D do punho — boa escolha, coordenadas métricas independentes de enquadramento) e `Calibrator` (`shoulderWidth`, `readyWristLocal`); `visibility`/`presence` → confiança.
- `OneEuroFilter` (minCutoff 1, beta 0.5, dCutoff 1) aplica **segunda camada de suavização** — o input já vem suavizado pelo grafo (achado #1).
- Landmarks auxiliares do modelo (índices 33–38 de 39; `ConfigureSplitNormalizedLandmarkListCalculator` corta `[0,33)` + `[33,35)` em `pose_landmarks_detector_graph.cc`) **não são expostos** pela API JS — nada perdido.

### `src/App.tsx`, `scripts/copy-mediapipe-wasm.mjs`, `vercel.json`

- `init()` (worker + WASM + modelo) inicia em paralelo ao `getUserMedia` (`App.tsx:117-121`) — a maior fatia da latência fria agora corre sob o prompt de permissão.
- `warmVisionAssets()` só roda se `permissions.query({name:'camera'}) === 'granted'` (`App.tsx:38-39`) — não baixa ~20 MB para quem nunca autorizou câmera. `.catch` cobre Firefox/Safari sem a query.
- Script de build: pin exato de versão (`!== '1.2.3'` quebra o build), copia **só** a variante module para `wasm-1.2.3/`, verifica SHA-256 do modelo e exige o hash no nome (`59929e1d`). URLs versionadas + `Cache-Control: immutable` em `/mediapipe/*` (`vercel.json:5-14`) — correto.
- O modelo local `pose_landmarker_lite.59929e1d.task` (5 777 746 B) bate com o servido upstream (`mediapipe-models/.../pose_landmarker_lite/float16/1/`); provenance em `THIRD_PARTY_NOTICES.md`.

---

## 3. Achados rankeados por impacto

### #1 — Os landmarks já chegam suavizados: o grafo aplica um 1-Euro interno (VIDEO + numPoses=1)

**O que é.** A API JS do `PoseLandmarker` não expõe `smoothLandmarks` (a interface `PoseLandmarkerOptions`, `vision.d.ts:2745-2768`, tem só 5 campos). Mas a suavização existe e está **ligada** na configuração atual:

1. `runningMode: 'VIDEO'` faz o JS setar `base_options.use_stream_mode = true` — campo 2 do proto (`base_options.proto`: `optional bool use_stream_mode = 2`); no bundle, `ec.l()`: `if("runningMode"in t){var i=this.K=!!t.runningMode&&"IMAGE"!==t.runningMode;sr(this.baseOptions,2,…)}` (offset ~89400).
2. No C++, `PoseLandmarkerGraph` decide: `if (pose_detector_options.num_poses() == 1) { pose_landmarks_detector_graph_options.set_smooth_landmarks(tasks_options.base_options().use_stream_mode()); }` — `mediapipe/tasks/cc/vision/pose_landmarker/pose_landmarker_graph.cc` (~L307).
3. Com `smooth_landmarks()` true, o subgrafo aplica, por frame (`pose_landmarks_detector_graph.cc` ~L774-816): `SmoothLandmarksVisibility(α=0.1)` sobre `visibility`/`presence` e **`SmoothLandmarks` = OneEuroFilter** com `min_cutoff=0.05, beta=80, derivate_cutoff=1` nos landmarks normalizados e `min_cutoff=0.1, beta=40, derivate_cutoff=1` nos world landmarks (comentários no código confirmam a parametrização EMA do filtro de velocidade).

**Consequência.** `SwingDetector`, `CadenceTracker`, `JumpDetector` e `LaneLeanDetector` filtram `OneEuroFilter(minCutoff=1, beta=0.5)` em cima de dados já EMA-filtrados. Não é bug — mas é dupla amortecimento nunca medida: o filtro interno é bem mais agressivo no repouso (α≈0.01–0.02) e quase transparente no movimento rápido (α≈0.8–0.94). O efeito líquido sobre latência percebida e sobre os limiares dos detectores (que foram calibrados presumivelmente contra essa saída, sem saber) é um item de benchmark — e uma informação que muda o tuning ideal dos filtros próprios (provavelmente podem ser mais leves, ou ser removidos onde só servem para suavizar).

**Evidência:** `pose_landmarker_graph.cc` (google-ai-edge/mediapipe), `pose_landmarks_detector_graph.cc` ~L774-816, `pose_landmarks_detector_graph_options.proto` (campo `smooth_landmarks` — não exposto em JS), `vision_bundle.mjs` `ec.l()` (offset ~89400), `base_options.proto` campo 2.

### #2 — O delegate "CPU" ainda exige WebGL: todo input sobe via `texImage2D`

**O que é.** Não existe caminho de input sem GPU nessa API. O `Da` do GraphRunner (`Yu`, offset ~87638) faz sempre: `$h()` → `canvas.getContext('webgl2') || getContext('webgl')` → `texImage2D(...)` → `_addBoundTextureAsImageToStream` (offset ~56905). O delegate só muda onde o TFLite executa; a entrada do frame é sempre uma textura WebGL. No delegate CPU, o download GPU→CPU acontece dentro do WASM (conversores do grafo) — ou seja, o modo CPU paga **upload para textura + readback interno** por frame, não "CPU puro".

**Consequências práticas.**

- `getContext` só é chamado no primeiro *frame* (lazy em `$h`), não no init. Num navegador sem WebGL nenhuma (blocklist de GPU, `--disable-webgl`, alguns ambientes de política corporativa), `createFromOptions` **sucede** e o primeiro `detectForVideo` lança `"Failed to obtain WebGL context…"` → `fallback()` → CPU → mesmo erro → `ERROR fatal`. A mensagem final ("GPU falhou; fallback CPU também falhou") é honesta, mas a premissa "CPU funciona sem GPU" não existe nessa API.
- No fallback CPU, o custo por frame inclui readback GPU→CPU interno — soma-se à inferência XNNPACK. É o que é; só não assumir que o modo CPU evita o pipeline gráfico.

**Evidência:** `vision_bundle.mjs` `Yu.Da`/`$h`/`_addBoundTextureAsImageToStream` (offsets ~56905, ~87638); `Dh` (dims de `videoWidth`/`naturalWidth`/`displayWidth`/`width`, ~56536); ausência de qualquer outro caminho `Da` no bundle (o `drawImage`+`getImageData` em ~144300 é do `InteractiveSegmenter`, engine nativo diferente).

### #3 — Safari < 17: o worker inteiro morre no init (GPU e CPU)

**O que é.** A função `Oh()` do bundle (offset ~55876): usa `OffscreenCanvas` **somente** se existir *e* (não-Safari *ou* `Version ≥ 17` via UA). Abaixo disso, o construtor do `GraphRunner` faz `document.createElement("canvas")` (offset ~58325) — `document` não existe em worker → `ReferenceError` → `createTask` falha → `fallback('CPU')` → passa pelo mesmo construtor (`qu()` avalia `r.canvas ?? (Oh() ? void 0 : document.createElement("canvas"))` ansiosamente, offset ~87965) → falha de novo → `ERROR fatal` → câmera nunca liga. E não só o canvas: `Mh`/`qu` usam `document` no mesmo predicado. O gate existe porque o WebGL em OffscreenCanvas só chegou ao Safari 17 (Safari 16.4 tem `OffscreenCanvas` mas o gate os exclui mesmo assim).

**Impacto.** iOS/iPadOS < 17 (base instalada relevante) recebe `ERROR fatal` → `stopCamera` + mensagem técnica. Não há fallback de main-thread nem mensagem de requisito. A decisão consciente seria: detectar `OffscreenCanvas`/UA antes de spawnar e (a) rodar o landmarker no main thread nesses casos (a API aceita — `document.createElement` existe lá), ou (b) mostrar mensagem de compatibilidade clara.

**Evidência:** `vision_bundle.mjs` `Oh` (~55876), `Gh` ctor (~58325), `qu` (~87965); também documentado em `docs/analise-de-gargalos.md` item 4 — **ainda aberto pós-merge**.

### #4 — `busy` serializa criação de bitmap + inferência (teto de throughput por design)

**O que é.** `capture()` seta `busy=true` **antes** de `await createImageBitmap` (`poseClient.ts:153-158`), e só é liberado na resposta `POSE`/`ERROR`. O round-trip por frame é estritamente serial: `bitmap(2-6 ms) → postMessage → detectForVideo(5-25 ms) → resposta`. Como `schedule()` re-registra o rVFC antes de capturar, frames novos durante `busy` são descartados — correto para frescor, mas a criação do bitmap poderia ocorrer em paralelo à inferência do frame anterior (o bitmap é só um snapshot do `<video>`), recuperando alguns ms de latência de ponta a ponta sem mudar a semântica "um frame em trânsito no worker".

**Impacto.** Pequeno: em GPU saudável o pipeline já fecha <33 ms. No fallback CPU (~20-25 ms de inferência em hardware fraco), overlap de ~3-6 ms pode significar 30 vs ~24 poses/s efetivas. Trade-off: um bitmap "especulativo" envelhece ~uma inferência — aceitável.

**Evidência:** `poseClient.ts:152-165`; não existe API de pipelining — `PoseLandmarker` no `.d.ts` expõe apenas `detect`/`detectForVideo` síncronas (linhas 2631-2733); não há `detectForVideoAsync` em todo o `.d.ts` (as tasks web são síncronas por design; LIVE_STREAM/detectAsync só existem em Android/iOS — `ai.google.dev/.../pose_landmarker`).

### #5 — Fallback GPU→CPU cria um segundo módulo WASM completo

**O que é.** `fallback()` chama `landmarker?.close()` (fecha o *grafo*, não o módulo) e `createTask('CPU')` → `createFromOptions` → `ModuleFactory(module)` de novo (`Wh`, offset ~66905). Cada `ModuleFactory` instancia um heap WASM novo (~19 MB inicial + crescimento); o heap do delegate falho fica alocado até o worker morrer. Também refaz `import()` do loader (barato — módulo cacheado) e `fetch(modelUrl)` (cache HTTP).

**Nota da implementação dual-mode.** Em um module worker, o `import()` cacheado do loader não reexecuta o script; `createFromOptions` consome e limpa `self.ModuleFactory` após cada instanciação. Por isso `pose.worker.ts` re-semeia `self.ModuleFactory` a partir do `export default` do próprio loader antes de cada criação de landmarker. Sem esse reseed, a primeira troca pose↔mão ou o fallback GPU→CPU falharia com `ModuleFactory not set` mesmo com o arquivo JS já cacheado.

**Alternativa (requer validação).** `PoseLandmarker.setOptions` (`vision.d.ts:2618`) → `A(t)` → `l(t)` remapeia `delegate` no proto de aceleração e `u()` regenera + `setGraph` recria o grafo **no mesmo módulo** — trocar delegate sem segundo heap. Não é documentado que `setOptions` suporte troca de delegate pós-falha (o `l()` tem path explícito de `"delegate"in e`), então é hipótese plausível a verificar, não recomendação.

**Evidência:** `pose.worker.ts:32-46`; `vision_bundle.mjs` `Wh`/`ModuleFactory` (~66905), `ru.l` delegate→proto (~68400+); `vision.d.ts:2618`.

### #6 — `new VideoFrame(video)` como alternativa ao `createImageBitmap`

**O que é.** `detectForVideo` aceita `TexImageSource` (`vision.d.ts:1862` — `ImageSource = TexImageSource`, union DOM que inclui `VideoFrame`). No bundle, `Dh` lê `displayWidth`/`displayHeight` (branch de `VideoFrame`, offset ~56536), e `texImage2D` aceita `VideoFrame` nos três motores. `new VideoFrame(video)` copia GPU→GPU sem decode/resize (`VideoFrame` "is tied to data on graphics memory", MDN WebCodecs) e é `Transferable` — passaria para o worker com menos trabalho na main thread que `createImageBitmap` (que rasteriza YUV→RGB + escala).

**Impacto.** Potencial de tirar ~1-4 ms/frame da main thread e dar ao `texImage2D` um caminho mais direto. Ressalvas: baseline set/2024 (Chrome 94/FF 130/Safari 16.4) — dentro do nosso piso Safari ≥ 17; perderia o `resizeWidth` (mas a câmera já pede 640, e o modelo corta para 224²/256² internamente de qualquer forma — resolução extra só custa upload); precisa de `frame.close()` no worker como hoje `bitmap.close()`.

**Evidência:** `vision.d.ts:1862,2717`; `vision_bundle.mjs` `Dh` (~56536); MDN `VideoFrame` (baseline, Transferable, cópia GPU→GPU em construtores de fonte de imagem).

### #7 — Sem aquecimento: o primeiro `detectForVideo` paga o custo lazy

**O que é — agora medido** (`pesquisa-pipeline-cv.md` §7.5, Chromium 159): o primeiro `detectForVideo` após `READY` custou **≈142 ms no delegate CPU** e **≈2 016 ms no GPU** (SwiftShader — compilação de programas GL + alocação lazy), contra ~16/~96 ms do regime. Com pessoa na entrada, a pose já saiu nesse primeiro frame (`firstPoseIndex = 0`) — o "warmup" é puro custo wall-clock, não frames perdidos.

**Ressalva de cobertura** (do review): um frame dummy 1×1/vazio aquece a alocação do grafo e o **detector de pessoa**, mas não entrega ROI alguma ao estágio landmarker — a aquisição de tracking do landmarker só se aquece com um frame que contenha pessoa. Se a intenção for esconder também esse custo, o warmup precisa de um bitmap com figura humana (ou aceitar que só a parte de alocação/detecção é coberta).

**Impacto.** Um `detectForVideo` num `OffscreenCanvas` logo após `READY`, com timestamp crescente, absorveria a fatia de alocação antes do primeiro gesto — trivial dentro do `createTask`; a parte de aquisição só é eliminável com frame contendo pessoa.

### #8 — Menores

- **`presence` subutilizado**: `poseClient.confidence()` usa só `visibility` (linha 167-170); o gate usa `min(vis, presence)` — coerente, mas o `bodyConfidence` do snapshot poderia já vir com `presence` composto. Cosmético.
- **`metadata.captureTime`/`presentedFrames` do rVFC não aproveitados** — o callback já recebe `(now, metadata)` mas só usa `now` (linha 68). `captureTime` mediria a latência fóton→ação real; `presentedFrames` detectaria frames pulados. Telemetria útil se voltar a existir.
- **`worldLandmarks` chega sempre** — a stream `WORLD_LANDMARKS` é incondicional no grafo (não há flag para desligar); usar (como o swing usa) é "de graça".
- **Telemetria ODML**: `Nh`/`xh` no bundle (~52447) acumula histograma de latência por frame (`za`/`ya`) e dá flush a cada 60 s / no `close` para `https://odml.pa.googleapis.com/v1/log` com api-key embutida — tráfego minúsculo dentro do worker, já divulgado em `THIRD_PARTY_NOTICES.md`. Se um dia houver CSP, `connect-src` precisa permiti-lo.
- **`getContext` por frame** em `$h` — retorna contexto cacheado, ~ns. Irrelevante.
- **`INIT` duplicado** vazaria o landmarker antigo (não é fechado antes de `createTask` reatribuir) — inalcançável pelo protocolo atual (`initPromise`/`ready` deduplicam). Anotado.

---

## 4. Oportunidades de configuração/API que não usamos

| Recurso | Status | Vale a pena? |
|---------|--------|--------------|
| `outputSegmentationMasks` (máscara do corpo) | `false` — correto | Só se quisermos efeito visual (silhueta no PiP) ou hitbox; custa uma stream extra + conversão `MPMask` por frame (`vision.d.ts:2766-2767`; o subgrafo emite `SEGMENTATION_MASK` só com a flag — `pose_landmarks_detector_graph.cc` ~L758). Hoje: certo desligado |
| `numPoses > 1` | `1` | **Manter 1** — além de economizar detecção, é a condição que habilita o smoothing interno (`pose_landmarker_graph.cc` ~L307); multiplayer nem existe |
| `minPoseDetectionConfidence` / `minPosePresenceConfidence` / `minTrackingConfidence` | 0.5 = defaults | `detection` governa o detector full-frame (roda quando o tracking se perde); `presence` decide se uma pose é emitida; `tracking` é o `min_similarity_threshold` do `AssociationNormRectCalculator` (`pose_landmarker_graph.cc` ~L361-368). Baixar `presence` para ~0.3 daria frames "degradados" em vez de `[]` — micro-tuning possível, ganho duvidoso |
| `ImageProcessingOptions` (`regionOfInterest`, `rotationDegrees`) | não usado | ROI fixo não ajuda corpo inteiro em movimento; rotação não se aplica a webcam frontal |
| `smooth_landmarks` proto | **já ativo** via VIDEO+numPoses 1 | Não configurável por JS — ver achado #1 |
| `canvas` (`VisionTaskOptions`) | não passado | O runner cria `OffscreenCanvas(1,1)` próprio no worker (offset ~58325) — passar um não mudaria nada |
| `setOptions` | não usado | Candidato para o fallback de delegate sem segundo módulo wasm (achado #5) — validar |
| `LIVE_STREAM` + callback async | **não existe na web** | `RunningMode` JS só tem `IMAGE`/`VIDEO` (`vision.d.ts:2852`); o padrão "latest frame + busy" é o documentado para livestream — já implementado |
| `detectForVideoAsync` / `detectAsync` | **não existe** | Sincronia é a única opção — serialização necessária, já feita |
| `POSE_CONNECTIONS` / `DrawingUtils` | não usados | `BONES` próprio + drawPose manual — ok; os exports não usados saem do bundle via tree-shake |
| `enableLogging` | não usado | Debug only |
| Modelo **full** (~9,4 MB) / **heavy** (~30,7 MB) | Lite (5,8 MB) | Model card: PDJ 87,0% (lite) / 91,8% (full) / 94,2% (heavy); Pixel 3 CPU/GPU: lite 44/49 FPS, full 18/40, heavy 4/19. Para jogo arcade a 30 fps, Lite é a escolha certa; **full** é o único upgrade plausível se a detecção de raquetada/salto se provar fraca no benchmark — heavy é inviável para gameplay |
| `VideoFrame` / `OffscreenCanvas→transferToImageBitmap` / `MediaStreamTrackProcessor` | `ImageBitmap` atual | `VideoFrame`: viável, benchmark (achado #6). `transferToImageBitmap`: drawImage 2D + move zero-copy — alternativa a medir. `MediaStreamTrackProcessor` (frames direto da track): Chrome 94 window-only / Safari 18 workers / **sem Firefox** — não é baseline, descartável |
| Dummy frame de aquecimento | não usado | Achado #7 |

---

## 5. O que está correto/bem implementado (verificado)

- **`useModule: true` + module worker + cópia só da variante module** — o trio se fecha: `forVisionTasks(base, true)` → `vision_wasm_module_internal.js` (que define `globalThis.ModuleFactory` + `export default`); em module worker `importScripts` lança `TypeError` → o `catch` do loader cai em `await import` do **mesmo** arquivo — funciona só porque a variante module é a importada (fix do merge `9c76399`; cadeia verificada em `Mh`/`Wh`, offsets ~56115/66905).
- **Pin = último estável**: `1.2.3` é `dist-tags.latest`; histórico `0.10.x → 1.0.0 → 1.2.0 → 1.2.2 → 1.2.3` (1.2.1 e 1.2.4/1.3.0 só existem como RC) — `npm view`.
- **WASM SIMD128, single-thread**: 152 109 opcodes `0xFD` na seção de código do `.wasm` (~13 MB); seção de memória flag `0x01` (não-compartilhada — sem `SharedArrayBuffer`, sem necessidade de COOP/COEP). Não há `_nosimd` no pacote 1.2.3 — SIMD é requisito absoluto (baseline desde 2021).
- **`runningMode: 'VIDEO'`**: mantém estado de tracking e liga `use_stream_mode` (que habilita o smoothing); `IMAGE` re-faria detecção+reset a cada frame — a escolha certa.
- **Monotonicidade de timestamp**: `Math.max(now, lastTimestamp + 0.01)` é exatamente o que o framework exige (o JS não valida; o grafo C++ falha com timestamps que regridem).
- **`numPoses: 1` + confidências defaults + `outputSegmentationMasks: false`**: configuração mínima correta; o mapeamento `A(t)` no bundle (offset ~153000) confirma que são os únicos 5 campos efetivos.
- **Um frame em trânsito + frame fresco**: implementa o padrão oficial de livestream ("processar só o frame mais recente, descartar intermediários quando ocupado" — ai.google.dev), com a melhoria rVFC > rAF.
- **`ImageBitmap` transferido + `close()` no `finally`**: posse e liberação corretas; transfer zero-copy.
- **Fallback GPU→CPU** nos dois pontos de falha (init e detect) com `attemptedFallback` impedindo loop infinito; `FALLBACK`/`ERROR` não-fatal preserva a sessão e o delegate efetivo é rastreado (`f5611ca`).
- **Escolha de campos consumidos**: `worldLandmarks` (metros) para velocidade de swing; `landmarks` (normalizado) para cadência/salto/lean; `min(visibility, presence)` no gate.
- **Sem `result.close()`**: só libera máscaras (`Bc.prototype.close` → `segmentationMasks.close()`); inexistentes aqui — correto.
- **Warm worker + `init` paralelo ao `getUserMedia` + `warmVisionAssets` condicional**: resolve os gargalos #2/#5 da análise anterior com boa economia de banda.
- **Build com verificação**: versão do pacote + SHA-256 do modelo conferidos no `prebuild`; URLs com versão/hash sustentam `immutable` com segurança.

---

## 6. Perguntas que exigem benchmark real

1. **`new VideoFrame(video)` vs `createImageBitmap(video, {resizeWidth:640})`** — ms/frame na main thread e latência total até `POSE`, em Chrome/Firefox/Safari 17+. (VideoFrame é baseline set/2024 — medir também o custo de `texImage2D` com cada tipo.)
2. **Overlap bitmap↔inferência** — criar o bitmap do frame N+1 enquanto o worker processa N: quanto reduz o intervalo médio entre respostas no fallback CPU?
3. ~~Custo do primeiro `detectForVideo`~~ — **medido**: ~142 ms CPU / ~2 016 ms GPU(SwiftShader) após READY vs ~16/~96 ms de regime (`pesquisa-pipeline-cv.md` §7.5). Dummy frame cobre a alocação; a aquisição do landmarker pede frame com pessoa.
4. **`setOptions({baseOptions:{delegate:'CPU'}})` reconstrói o grafo no mesmo módulo?** Medir memória do worker e latência do fallback vs `createFromOptions` novo.
5. **Dupla suavização** (interna + `OneEuroFilter` próprio): medir atraso efetivo marcadores→evento em gesto rápido; re-tunar `minCutoff`/`beta` sabendo que o input já é EMA-filtrado — talvez filtros mais leves ou elimináveis em alguns detectores.
6. **Lite vs Full** na taxa real de detecção de swing/jump (F1 em sessões reais) — se Full for viável (~18 FPS CPU é pouco, ~40 GPU é ok), o ganho de PDJ pode valer 3,6 MB a mais de download.
7. **`resizeWidth` 640 vs 320 vs desligado** no throughput do fallback CPU e na estabilidade dos landmarks (o detector roda a 224², o landmarker a 256² — 320 px pode ser suficiente e corta ~75% do upload/readback).
8. **Safari < 17**: fatia real de usuários para decidir entre fallback em main thread vs mensagem de requisito.
9. **Comportamento do `texImage2D` com `ImageBitmap` quando a câmera entrega resolução ≠ 640×480** (câmeras 720p/1080p): o resize está sendo feito no bitmap ou delegado à textura?

---

## Fontes

**Código do repo** (`path:line`): `src/cv/pose.worker.ts`, `src/cv/poseClient.ts`, `src/cv/protocol.ts`, `src/cv/calibrator.ts`, `src/cv/oneEuroFilter.ts`, `src/cv/mediapipeAssets.ts`, `src/kinematics/*`, `src/App.tsx`, `src/ui/{CameraPip,PoseOverlay,GameCanvas}`, `scripts/copy-mediapipe-wasm.mjs`, `vercel.json`, `package.json`, `THIRD_PARTY_NOTICES.md`, `public/mediapipe/models/SHA256SUMS`.

**Bundle empacotado** (`node_modules/@mediapipe/tasks-vision/`):
- `vision.d.ts` — `forVisionTasks` :819; `PoseLandmarkerOptions` :2745-2768; `BaseOptions.delegate` :17-29; `RunningMode` :2852; `VisionTaskOptions.canvas` :2898-2912; `detectForVideo` :2717; `ImageSource=TexImageSource` :1860-1862; `Landmark`/`NormalizedLandmark` (presence?) :2180-2194, :2469-2483; `PoseLandmarkerResult` :2774-2810; `WasmFileset` :2941-2950.
- `vision_bundle.mjs` — `nh`/`forVisionTasks` (~49305); `Mh` loader `importScripts`→`await import` (~56115); `Wh`/`ModuleFactory` (~66905); `Oh()` gate OffscreenCanvas/Safari≥17 (~55876); `Gh` ctor canvas fallback (~58325); `$h`/`texImage2D`/`_addBoundTextureAsImageToStream` (~56905, ~87638); `Ju`/`Qu`/`finishProcessing→_waitUntilIdle` (~89005, ~89211); `Jh` coleta de erros de grafo; `ec.l()` runningMode→`use_stream_mode` campo 2 (~89400); `A(t)` mapeamento das 5 opções de pose (~153000); `jc`/`Gc` resultado + `eu` free_memory (~152447); `Qa`/`th` conversão landmark→JS (~48461); telemetria `Nh`/`xh`/`odml.pa.googleapis.com/v1/log` flush 60 s (~52447, ~49950+); `Dh` dims `videoWidth/naturalWidth/displayWidth/width` (~56536).
- `wasm/` — `vision_wasm_module_internal.js` (ModuleFactory + `export default` + `globalThis.ModuleFactory`); `vision_wasm_module_internal.wasm` — memória flag 0x01, 152 109 prefixos SIMD `0xFD` na seção de código; o pacote só traz 4 arquivos wasm (sem `_nosimd`).

**npm/registry** — `npm view @mediapipe/tasks-vision {versions,dist-tags,time}`: `latest=1.2.3` (publicado 2026-11-11), `nightly=1.3.0-rc.20261122`; estáveis publicadas: `0.10.x…0.10.35, 1.0.0, 1.0.1, 1.1.0, 1.1.1, 1.2.0, 1.2.2, 1.2.3`.

**Docs oficiais** — `ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker{,/web_js}`: modos IMAGE/VIDEO na web (síncronos; VIDEO exige timestamps monotônicos), padrão livestream = VIDEO + frame mais recente, modelos detector 224² + landmarker 256² fp16.
- Model card BlazePose GHUM 3D (`developers.google.com/static/ml-kit/images/vision/pose-detection/pose_model_card.pdf`): Lite ~44 CPU/~49 GPU FPS Pixel 3; Full ~18/~40; Heavy ~4/~19; PDJ 87,0/91,8/94,2%.
- `aifitnessapi.com/motion/mediapipe-pose-landmarker-models`: `.task` servidos — lite 5 777 746 B (== SHA256SUMS local), full ~9,4 MB, heavy ~30,7 MB; bundle contém `pose_detector.tflite` + `pose_landmarks_detector.tflite`.

**GitHub `google-ai-edge/mediapipe`** — `mediapipe/tasks/cc/vision/pose_landmarker/pose_landmarker_graph.cc` (`set_smooth_landmarks(use_stream_mode)` para `num_poses==1`; `AssociationNormRectCalculator.min_similarity_threshold = min_tracking_confidence`); `pose_landmarks_detector_graph.cc` (`smooth_landmarks` → `SmoothLandmarks` OneEuro min_cutoff/beta/derivate_cutoff + `SmoothLandmarksVisibility` α=0.1; `kLandmarksNum=39`, split [0,33)+aux); `proto/pose_landmarks_detector_graph_options.proto` (campo `smooth_landmarks`); `proto/pose_landmarker_graph_options.proto`; `tasks/cc/core/proto/base_options.proto` (`use_stream_mode` campo 2); `tasks/web/core/fileset_resolver.ts.template` (sufixos `wasm[_module][_nosimd]_internal`; na versão empacotada o sufixo nosimd não existe).

**MDN/WHATWG/caniuse** — `HTMLVideoElement.requestVideoFrameCallback` (baseline out/2024; `now`=timestamp do callback, `metadata.captureTime/presentedFrames`); `createImageBitmap` (baseline 2021; `resizeWidth` Ch54+/FF98+/Sf15+; `resizeQuality` Ch54+/FF149+/Sf15+); `VideoFrame` (baseline set/2024; Transferable; construtor de `HTMLVideoElement` copia GPU→GPU); `WorkerGlobalScope.importScripts` (`TypeError` em module workers); `OffscreenCanvas` (baseline mar/2023); Transferable objects.

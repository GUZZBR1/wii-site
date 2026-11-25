# Pesquisa profunda — pipeline câmera → pose → jogo e o panorama CV no navegador

Data: 25 de novembro de 2026 · Branch: `main` pós-merge (`fc3e6a4`)
Escopo: mecânica **por frame** do pipeline (rVFC → bitmap/VideoFrame → worker → `detectForVideo` → POSE → detectores → jogo), capacidades reais do WASM do `@mediapipe/tasks-vision@1.2.3`, e panorama de bibliotecas de CV/pose para o navegador. Não repete a análise de bundle/cache/respawn de `docs/analise-de-gargalos.md` — aqui o foco é o que acontece *dentro* de cada frame.

Método: todas as afirmações sobre o comportamento interno do MediaPipe foram verificadas nos arquivos do pacote instalado (`node_modules/@mediapipe/tasks-vision/`), não em documentação de segunda mão. Afirmações externas citam MDN/caniuse, espec WICG/W3C, docs oficiais (ai.google.dev, docs.opencv.org, blog.tensorflow.org) e fontes de projeto (GitHub releases, npm registry).

---

## 1. Resumo executivo

1. **O pipeline atual está arquiteturalmente correto e próximo do ótimo da API.** A recomendação oficial do Google para câmera ao vivo na web é exatamente `runningMode: 'VIDEO'` + processar só o frame mais recente (ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker, seção "Livestream"). O design de um frame em trânsito + worker + `busy` flag (`src/cv/poseClient.ts:27,152-160`) implementa isso.
2. **O WASM é compilado com SIMD128 e é estritamente single-threaded** — medido no binário: ~152 mil opcodes `0xFD` (v128.*) na seção de código; seção de memória não-compartilhada (flag `0x01`, min 291 páginas ≈ 18,2 MiB, max 2 GiB); o glue JS não contém `SharedArrayBuffer`/`Atomics`/pool de workers. Não existe build "threaded" do tasks-vision — portanto **nenhum ganho viria de COOP/COEP** (`crossOriginIsolated`) nesta biblioteca.
3. **Todo frame — GPU ou CPU delegate — entra no grafo como textura WebGL** via `gl.texImage2D` num `OffscreenCanvas` dentro do worker (função `$h` em `vision_bundle.mjs`). Consequência: no fallback CPU o pixel sobe à GPU só para ser lido de volta à CPU dentro do próprio grafo — um roundtrip forçado que a API não permite evitar.
4. **`detectForVideo` aceita `VideoFrame` diretamente** (`ImageSource = TexImageSource`, `vision.d.ts:1862`), e `new VideoFrame(video)` é síncrono, transferível e Baseline 2024 — elimina a etapa `createImageBitmap` (~1–4 ms/frame na main thread) sem mudar o resto. É a única melhoria "grátis" identificada no caminho de dados.
5. **O gargalo dominante é a própria inferência** (estimado 70–90% do round-trip por frame): BlazePose Lite roda ~44 fps CPU / ~49 fps GPU num *Pixel 3 de 2018* (model card oficial). Todo o resto — bitmap, `postMessage`, clone da resposta (~3 KB), detectores, dispatch ao jogo — soma poucos ms.
6. **OpenCV.js é peso morto aqui**: 8–16 MB de WASM para um toolbox de CV clássico cujas únicas funções relevantes (segmentação, calibração) já existem no stack atual em forma mais adequada. Veredicto detalhado na seção 4.
7. **Nenhuma alternativa de pose bate o MediaPipe para este caso** (1 pessoa, webcam, gameplay): MoveNet perde `worldLandmarks` (quebra `swingDetector`/`calibrator` que usam metros); RTMPose/ONNX custa ~15 MB de runtime + pipeline DIY de dois estágios; YOLO-pose é AGPL-3.0; LiteRT.js é runtime puro sem API de pose pronta. Tabela na seção 5.
8. **Achado surpresa**: o WASM já contém maquinaria WebGPU completa (`MlDriftWebGpu`, `webgpu_service.h`, bindings Emscripten `_emwgpu*` incluindo `importJsExternalTexture`), mas o bundle JS de visão nunca toca `navigator.gpu` — WebGPU está **dormente para as tasks de visão** em 1.2.3; o delegate `GPU` roda via WebGL2.

---

## 2. Mapa custo-por-estágio do pipeline atual

Pipeline real (código): `getUserMedia(640×480@30)` (`src/App.tsx:118-120`) → `<video>` → `requestVideoFrameCallback` (fallback rAF) (`src/cv/poseClient.ts:64-82`) → `createImageBitmap(video,{resizeWidth:640,resizeQuality:'low'})` (`poseClient.ts:158`) → `postMessage` com transfer (`poseClient.ts:160`) → `detectForVideo(bitmap,ts)` síncrono no worker (`src/cv/pose.worker.ts:81`) → `POSE` com 33+33 pontos (`pose.worker.ts:82-86`) → `ActionPipeline`/detectores → jogo.

### 2.1 Agendamento: `requestVideoFrameCallback` vs fallback rAF

**Semântica (spec WICG video-rvfc, wicg.github.io/video-rvfc):**
- O callback roda nos *rendering steps* quando um novo frame é enviado ao compositor, **imediatamente antes dos callbacks de `requestAnimationFrame`** do mesmo passo — mudanças feitas em ambos aparecem no mesmo vsync (§1 da spec).
- Taxa efetiva = `min(taxa do vídeo, taxa de pintura do browser)` — para uma câmera a 30 fps num monitor de 60/120 Hz, ~30 callbacks/s (web.dev/articles/requestvideoframecallback-rvfc).
- Cada registro é one-shot; o código re-registra dentro do callback (`poseClient.ts:68-71`) — padrão correto segundo a spec.
- **Sob carga na main thread o browser pode pular frames** (a spec recomenda detectar via `metadata.presentedFrames`, contador monotônico — hoje ignorado).
- O primeiro argumento `now` é um `DOMHighResTimeStamp` do passo de renderização; **`metadata.captureTime` — "the time at which the frame was captured by the camera" — a spec diz SHOULD (não MUST) para fontes getUserMedia/WebRTC** (spec §2.2: "SHOULD be present for WebRTC or getUserMedia applications, and absent otherwise"). O código usa só `now` (`poseClient.ts:68`) — a latência real fóton→pose não é medida hoje. Como é SHOULD, a telemetria tem que tratar `captureTime === undefined` (navegadores que não o expõem) caindo para `now` — sem o campo, o callback mede só apresentação→pose, não captura→pose.

**Matriz de suporte (caniuse/mdn-api_htmlvideoelement_requestvideoframecallback):** Chrome/Edge 83 (mai/2020), Safari 15.4 incl. iOS (mar/2022), **Firefox 132 (out/2024)** — Baseline desde out/2024, ~96,8% de uso global. O fallback rAF só é exercido em Firefox ≤131 e Safari ≤15.3.

**Problemas do caminho rAF + `video.currentTime` (`poseClient.ts:72-80`):**
- Para `MediaStream` (srcObject), `currentTime` é um **relógio de tempo real**, não um PTS por frame: a spec mediacapture-main define que a timeline "starts at 0 and increments linearly in real time as long as the MediaStream is playing" (w3c/mediacapture-main#615). Chrome de fato incrementa `currentTime` *por frame* (bug de interop documentado, issuetracker.google.com/issues/413061418) enquanto Firefox e Safari incrementam por tarefa/tempo real.
- **Consequência**: no Firefox/Safari antigos, `currentTime !== lastVideoTime` dispara em praticamente todo tick de rAF (até 60 Hz), capturando repetidamente o *mesmo* frame apresentado — até ~2× trabalho redundante de bitmap+inferência (o `busy` flag absorve parte). Em Chrome antigo funciona por acidente (um passo por frame).
- MDN em `HTMLMediaElement.currentTime`: "The update frequency depends on the browser and media playback pipeline… successive reads can return the same `currentTime` even when `Date.now()` has advanced" — granularidade é definida pela implementação, sem garantia de um passo por frame.
- Impacto hoje: baixo (parcela de browsers sem rVFC é pequena e caindo), mas é o único ponto do pipeline que pode *desperdiçar* inferência em frames idênticos.

### 2.2 `createImageBitmap(video, {resizeWidth:640, resizeQuality:'low'})` — o que custa e o que ele faz

- **Semântica**: produz um `ImageBitmap` novo a cada chamada — um snapshot do frame corrente, opcionalmente reescalonado. Com só `resizeWidth`, a altura é derivada preservando o aspecto (HTML Standard, `ImageBitmapOptions`). Como a constraint pede 640×480 (`App.tsx:120`), o resize é no-op no caso nominal; para câmeras que ignorem `ideal` e entreguem 1080p, o downscale aqui é o que protege o `texImage2D` interno de subir 1920×1080.
- **Conversão de cor**: o bitmap sai normalizado para o espaço de saída padrão (`colorSpaceConversion:'default'` implica conversão do formato nativo da câmera, tipicamente I420/NV12 → RGBA). Essa conversão é inevitável — o modelo consome RGB; a questão é só *onde* ela acontece.
- **Backing**: em Chrome, `ImageBitmap` oriundo de `<video>` é tipicamente GPU-residente, o que torna o upload `texImage2D` posterior uma cópia GPU→GPU (detalhe de implementação, confiança média — a spec não obriga).
- **Suporte das options**: `resizeWidth` em Chrome 54 / Firefox 98 / Safari 15; `resizeQuality` chegou ao Firefox só na **149** (mar/2026, bug 2010125) — antes era ignorado (inócuo: o default da spec já é `'low'`). caniuse `mdn-api_createimagebitmap_options_*`.
- **Custo estimado**: ~1–4 ms assíncronos na main thread por frame (decode/conversão/cópia). É a única etapa do pipeline que executa na thread que também roda o jogo.

**Alternativas verificadas (o que `detectForVideo` aceita):** `ImageSource` é alias deprecated de `TexImageSource` (`vision.d.ts:1862`) = `ImageBitmap | ImageData | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | OffscreenCanvas | VideoFrame`. O extrator de dimensões do bundle (`Dh()` em `vision_bundle.mjs`) trata explicitamente `displayWidth/displayHeight` — campo exclusivo de `VideoFrame` — confirmando suporte de primeira classe.

| Fonte | Como obter | Suporte (caniuse/BCD) | Custo por frame | Observação |
|---|---|---|---|---|
| `ImageBitmap` (atual) | `createImageBitmap(video,{resizeWidth})` | Baseline; `resizeWidth` FF98+/S15+/C54 | ~1–4 ms (async, main) | único com downscale embutido |
| **`VideoFrame`** | `new VideoFrame(video)` dentro do rVFC | C94/S16.4/FF130 — Baseline set/2024 | ~síncrono, handle refcounted | sem resize (só `visibleRect` crop); `frame.timestamp` = PTS em µs — reinicia ao reabrir a câmera, manter o ms monotônico do PoseClient |
| `VideoFrame` via `MediaStreamTrackProcessor` | track → ReadableStream de frames | C94 (contexto parcial), Safari 18+, **Firefox: não** | zero-cópia do pipe | poderia alimentar o worker direto, mas é Chromium/Safari-18+ |
| `ImageBitmap` via `ImageCapture.grabFrame()` | `new ImageCapture(track).grabFrame()` | C59+, **FF só flag, Safari só 26+** | igual ou pior (full-res, sem resize) | sem vantagem |
| `ImageData`/buffer cru | `ctx.getImageData` | universal | readback GPU→CPU ~2–6 ms + cópia de 1,2 MB | estritamente pior — perde o caminho GPU |
| `OffscreenCanvas` | transfer + drawImage | universal | não resolve: quem desenha o `<video>` é a main thread; o canvas só pode viver num contexto por vez | — |

> **Conclusão prática**: `new VideoFrame(video)` dentro do rVFC é a melhor troca disponível — remove o `await createImageBitmap` da main thread, preserva o PTS real (`frame.timestamp`, microssegundos) e para a constraint atual (640) entrega exatamente a mesma resolução ao `texImage2D`. Cuidados: chamar `frame.close()` no `finally` do worker (como já se faz com `bitmap.close()`, `pose.worker.ts:96`) e, para câmeras >640 px de largura, manter o caminho bitmap-resize (ou aceitar upload maior). **Caveat do PTS**: `frame.timestamp` é o relógio de mídia da track — reinicia ao reabrir a câmera e pode divergir do relógio de rastreamento do `PoseClient` (`poseClient.ts:154-155` mantém `lastTimestamp` monotônico via `Math.max`). Como `stopCamera` preserva o worker quente (`App.tsx:76-81`), a troca deve manter `timestampMs` gerado pelo cliente (ou rebasear o PTS com offset) — nunca alimentar o grafo direto de `frame.timestamp` sem a monotonicidade que o MediaPipe exige.

### 2.3 `postMessage` / structured clone / transferables

- `ImageBitmap` e `VideoFrame` são `[Transferable]` (MDN "Transferable objects"; WebIDL do Firefox: `[Serializable, Transferable]`) — `postMessage(msg,[bitmap])` **move o objeto**, sem cópia de pixels na fronteira do worker (custo ~dezenas de µs, metadados apenas).
- A resposta `POSE` clona 66 pontos `{x,y,z,visibility,presence}` — ~2–3 KB de structured clone por frame, desprezível.
- Semântica a respeitar: objetos transferidos ficam neutros na origem — o `bitmap.close()` do worker (`pose.worker.ts:96`) libera o recurso GL associado; esquecer fecha-recurso em `VideoFrame` igualmente (`frame.close()`).

### 2.4 Dentro do worker: o que `detectForVideo` realmente faz por frame

Evidência em `node_modules/@mediapipe/tasks-vision/vision_bundle.mjs` (bundle minificado; identificadores citados pelo nome observado):

1. `$h(t, e, r)` — *a única via de entrada de imagem para as tasks de visão*: exige `t.j.canvas` (OffscreenCanvas no worker — `Oh()` permite OffscreenCanvas exceto Safari <17, onde cairia em `document.createElement` inexistente em worker), chama `t.j._bindTextureToCanvas()` (função exportada do WASM, `vision.d.ts:2967`), obtém `canvas.getContext("webgl2") || getContext("webgl")`, executa **`gl.texImage2D(TEXTURE_2D, 0, RGBA, RGBA, UNSIGNED_BYTE, fonte)`** e ajusta `canvas.width/height` para `Dh(fonte)`. Ou seja: **qualquer `TexImageSource` vira uma textura GL** — inclusive no delegate CPU.
2. `Yu.prototype.Da` → `this.oa._addBoundTextureAsImageToStream(stream, w, h, timestamp)` — entrega a textura ao grafo com o timestamp.
3. `finishProcessing()` → `this.j._waitUntilIdle()` (`vision.d.ts:2975`) — **bloqueia** até o grafo produzir as saídas.
4. Saídas chegam via listeners proto → montados em `PoseLandmarkerResult` (`landmarks` 33×`NormalizedLandmark`, `worldLandmarks` 33×`Landmark` em metros com origem no ponto médio do quadril — `vision.d.ts:2176-2193`).

**Leituras internas do grafo:**
- O delegate `GPU` mantém os tensores na GPU; os landmarks saem como pacotes proto pequenos — **não há readback de frame inteiro por frame**. Os `readPixels` do bundle existem para conversões `MPImage/MPMask → ImageData` (incl. um caminho de textura float p/ macOS/Safari) — só custam se você pedir a máscara como dados de CPU.
- No delegate `CPU` (XNNPACK, confirmado por strings `xnnpack` no `.wasm`), a textura de entrada precisa virar `ImageFrame` de CPU — a conversão GL→CPU acontece **dentro do WASM** (não há segunda via de entrada: o bundle tem exatamente um caminho de imagem para `detectForVideo`; o único caminho de pixels crus — `drawImage`+`getImageData`→heap — pertence ao `InteractiveSegmenter`, não às tasks de visão). Ou seja, o fallback CPU paga upload GL + readback interno + inferência escalar-paralela XNNPACK.

### 2.5 `detectForVideo` síncrono no worker — bem ou mal?

- **Bom para este caso**: a sincronicidade só seria problema se bloqueasse a main thread — dentro do worker ela *é* o mecanismo de backpressure (junto ao `busy` flag). Um `detectForVideo` hipoteticamente async não melhoraria throughput: o WASM é single-threaded e o grafo serializa num único contexto GL — a liberação do thread do worker não compraria paralelismo nenhum.
- A API web não expõe modo `LIVE_STREAM`/async — `RunningMode = "IMAGE" | "VIDEO"` apenas (`vision.d.ts:2852`); LIVE_STREAM existe só nas APIs Android/iOS (ai.google.dev pose_landmarker, abas de plataforma). Portanto "síncrono ou nada" é restrição da plataforma, não escolha do app.
- `VIDEO` exige timestamps estritamente crescentes — o código garante com `Math.max(now, lastTimestamp+0.01)` (`poseClient.ts:155`). A doc oficial descreve o modo como "processes every frame in order and never drops frames" — a política de descarte é do `busy` flag, corretamente colocado *fora* da biblioteca.
- Custo real da etapa: dominado por `texImage2D` (~0,5–2 ms a 640×480) + `_waitUntilIdle` = inferência completa do grafo (detector de pose só quando o tracking falha + landmarker a cada frame — pipeline de dois estágios do BlazePose, ai.google.dev "Models").

### 2.6 POSE → detectores → jogo

`worker.postMessage` volta ~66 pontos (clone ~KBs); `PoseClient` deriva `bodyConfidence` = `min(visibility)` sobre 8 índices (`poseClient.ts:167-170`) — critério conservador (um punho ocluído derruba o min). Detectores consomem os índices 11,12,15,16,23,24,25,26 normalizados (cadência/salto/lean/gate) e `worldLandmarks` 11,12,15,16 (`swingDetector.ts:25-28`, `calibrator.ts:29`). Custo: microssegundos de matemática pura — irrelevante no mapa de gargalos.

---

## 3. Capacidades WASM — presente vs ausente (evidência nos arquivos)

Arquivo analisado: `node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_module_internal.{js,wasm}` (o par efetivamente carregado: `pose.worker.ts:12` chama `forVisionTasks(base, true)` e o resolver monta `vision_wasm_module_internal.*` — `vision_bundle.mjs`, função `nh`).

### 3.1 SIMD128 — **presente e, desde 1.2.2, obrigatório**

Contagem de opcodes com prefixo `0xFD` (vetor de 128 bits) na seção de código do `.wasm` (offset 63297, 13 033 271 B):

| Padrão | Instrução | Ocorrências |
|---|---|---|
| `FD 0C` | `v128.const` | 29 827 |
| `FD 0B` | `v128.store` | 16 222 |
| `FD 00` | `v128.load` | 15 627 |
| `FD 0D` | `i8x16.shuffle` | 11 693 |
| `FD E6 01` | `f32x4.mul` | 7 383 |
| `FD E4 01` | `f32x4.add` | 5 378 |
| `FD AE 01` | `i32x4.add` | 4 506 |
| `FD E5 01` | `f32x4.sub` | 1 038 |

(Contagem bruta de bytes — falso-positivo possível dentro de imediatos, mas a ordem de grandeza e a distribuição concentrada nos subopcodes clássicos de NN só admitem uma leitura: o binário foi compilado com `-msimd128`.)

Corroboração externa: **release notes do v1.2.2** — *"Remove non-SIMD WebAssembly builds from the MediaPipe Tasks Web SDK"* (github.com/google-ai-edge/mediapipe/releases). Ou seja, nem existe mais variante não-SIMD para cair: **browsers sem WASM SIMD não instanciam o módulo** — piso de Safari **16.4** (SIMD: Chrome 91, FF 89, Safari 16.4 — caniuse wasm-simd; Baseline desde mar/2023). Isso soma-se ao gate `Oh()` (OffscreenCanvas+WebGL em worker exige Safari ≥17): na prática, Safari <17 fica sem CV de qualquer forma.

### 3.2 Threads / pthreads / SharedArrayBuffer — **ausente**

- Seção de memória do `.wasm` (offset 23722): `01 01 a3 02 80 80 02` → 1 memória, **flags `0x01` (min+max, não-compartilhada)**, min 291 páginas ≈ **18,2 MiB de heap inicial**, max 32 768 páginas = 2 GiB. Memória compartilhada teria flag `0x02`/`0x03`.
- Glue `vision_wasm_module_internal.js`: **0 ocorrências** de `SharedArrayBuffer`, `Atomics`, `wasmWorkers`, `pthreadPool` — `pthread` aparece só em 6 comentários do runtime Emscripten (linhas 96, 377, 385, 5349, 7566, 7676).
- A interface `WasmModule` (`vision.d.ts:2956-3048`) não expõe nenhuma API de pool de threads.
- O pacote `wasm/` só contém `vision_wasm_internal.*` (clássico) e `vision_wasm_module_internal.*` (ES module) — **não existe build threaded do MediaPipe Tasks para web**. Nada a habilitar com `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy` nesta dependência (SAB exige `crossOriginIsolated`, MDN SharedArrayBuffer — requisito que valeria para ONNX Runtime multithread ou OpenCV `--threads`, ver §4 e §5).

### 3.3 WebGPU — **presente no binário, dormente para as tasks de visão**

- O `.wasm` contém a stack "drishti/aimatter" completa (1 687 strings `drishti`), incluindo `MlDriftWebGpu`, `JointBilateralFilterCalculatorWebGpu`, `third_party/mediapipe/gpu/webgpu/webgpu_service.h`, `canvas_webgpu` — e as release notes do v1.0.0 registram *"Store wgpu::Instance in WebGpuService"*.
- O glue JS traz a camada de importação Emscripten WebGPU (`vision_wasm_module_internal.js:5570-5689`): `importJsDevice`, `importJsComputePipeline`, **`importJsExternalTexture`** — bindings para *receber* objetos WebGPU já criados pelo lado JS.
- **Mas** `vision_bundle.mjs` tem **0 referências** a `navigator.gpu`/`webgpu`/`requestAdapter`: o bundle de visão nunca cria device nem external texture. A recomendação oficial de setup ("WebGPU-enabled browser recommended for **large generative, retrieval, and decision models**" — developers.google.com/edge/mediapipe/solutions/setup_web) confirma: WebGPU atende às tasks genai; para visão, o delegate `GPU` executa via **WebGL2** (contexto criado em `$h` + calculadoras GL no WASM).

### 3.4 Outros fatos do runtime

- `WebAssembly.instantiateStreaming` é usada quando possível (`vision_wasm_module_internal.js:~340`) — a compilação overlapa o download se o servidor responder `application/wasm` (Vercel responde).
- O `.wasm` é o **mesmo fileset para todas as tasks de visão** — strings mostram `PoseLandmarkerGraphOptions`, `FaceLandmarkerGraphOptions`, `HandLandmarkerGraphOptions`, `HolisticLandmarkerGraphOptions`, `HandRoiRefinementGraphOptions` etc. Adicionar outra task não baixa mais WASM nenhum — só o `.task` correspondente (preços na seção 6).
- Modelo atual: `pose_landmarker_lite.59929e1d.task` = 5 777 746 B; entrada do landmarker 256×256×3 com crop alinhado no centro do quadril (model card BlazePose GHUM, developers.google.com/static/ml-kit/.../pose_model_card.pdf).

---

## 4. Veredito OpenCV.js — necessário ou peso morto?

**O que é oficialmente oferecido (docs.opencv.org/4.x tutorial_js_setup):**
- Não há distribuição oficial de produção: o `opencv.js` servido em `docs.opencv.org/{versão}/opencv.js` é um **build reduzido de tutorial** ("size vs functionality compromise") — mantenedor do OpenCV na issue opencv/opencv#25425: *"there is no official OpenCV JS release. We don't recommend to use that file directly in your projects"* (citado no README de `@haoking/opencvjs`). Para produção, o caminho oficial é compilar o seu (`platforms/js/build_js.py`).
- Tamanhos reais do arquivo oficial (medições publicadas de `opencv-{versão}-docs.zip`, issoh.co.jp, out/2026): **4.14.0 = 11 059 007 B; 5.0.0 = 16 211 109 B** — arquivo único com o WASM em base64 (inflação ~1,33×). `@techstark/opencv-js` no npm: **14,7 MB descompactado**. Build histórico wasm-only ≈ 8,1 MB; threads+SIMD ≈ 9,0 MB (intel/webml-polyfill#1348).
- **Builds com SIMD e threads existem**: `--simd` (`-msimd128`), `--threads` (pool pthread → `SharedArrayBuffer` → **exige `crossOriginIsolated`**, i.e., headers `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`, viáveis no `vercel.json`), e `--build_loader` produz um `loader.js` com feature-detection que escolhe entre `wasm`/`simd`/`threads`/`threadsSimd` (tutorial_js_setup, item 2–3). Reduzir a whitelist de módulos (`opencv_js.config.py`) é a alavanca de tamanho.
- O módulo `dnn` do opencv.js roda em WASM de CPU — sem delegate GL/WebGPU: para inferência de rede neural seria mais lento que o pipeline MediaPipe atual.

**O que ele adicionaria a este app — honestamente nada que falte:**
| Necessidade hipotética | Cobertura hoje |
|---|---|
| Keypoints de pose | `PoseLandmarker` (já em produção) |
| Máscara/silhueta | `outputSegmentationMasks` no próprio PoseLandmarker (custo: uma flag, seção 6) |
| Subtração de fundo/máscara | idem — `MPMask` como `WebGLTexture` sem readback |
| Calibração de postura | `src/cv/calibrator.ts` próprio, sobre landmarks métricos |
| Filtros/resize/YUV→RGB | `createImageBitmap`/`texImage2D` já fazem na GPU |
| `cv.dnn` para outro modelo | CPU-only, mais lento que o delegate atual; ORT/LiteRT.js seriam a ferramenta |

**Veredicto: peso morto.** Seriam +8–16 MB de download, +um segundo runtime WASM para compilar/inicializar, gerenciamento manual de `cv.Mat` (sem GC — `mat.delete()`), e zero capacidade que falte ao jogo. OpenCV.js só se justificaria por funcionalidades que este produto não tem — fiduciais ArUco, homografia/calibração de câmera, feature matching, morfologia pesada — e mesmo nessas, um build customizado com whitelist mínima, não o arquivo de documentação.

---

## 5. Alternativas de pose — comparativo honesto

| Solução | Peso entregue | Saída | Latência (evidência primária) | Licença | Status do projeto |
|---|---|---|---|---|---|
| **MediaPipe tasks-vision 1.2.3 + pose_landmarker_lite (ATUAL)** | wasm 14,7 MB + `.task` 5,78 MB + bundle JS ~156 KB | 33 kp norm. + 33 kp mundo (metros, origem no quadril) + visibility/presence + máscara opcional | Model card: ~44 fps CPU (XNNPACK)/~49 fps GPU num **Pixel 3**; TF blog: MediaPipe runtime WASM+GPU 92 fps (MBP 2019) / 160 fps (i9+GTX1070) no Lite | Apache-2.0 | **Ativo** — 1.2.3 é a latest (11/nov/2026); nightly 1.3.0-rc; versões estáveis 1.0→1.2.3 desde jul/2026 |
| TF.js MoveNet (Lightning/Thunder) via `@tensorflow-models/pose-detection` | JS ~1,5 MB + tfjs core/backend + pesos 2,9–4,8 MB (L) / 7,1–12,6 MB (T) | **17 kp 2D apenas — sem z nem mundo** | TF blog: 104 fps WebGL (MBP), 42 fps WASM+SIMD+MT; "30+ fps na maioria dos desktops" | Apache-2.0 | **Manutenção** — `@tensorflow/tfjs` 4.22.0 parado desde jan/2025; Google migrou para LiteRT.js (developers.googleblog.com LiteRT.js, jul/2026) |
| BlazePose via runtime TF.js (`tfjs-models`) | similar ao acima | 33 kp (sem world meters confiável no runtime tfjs) | **Estritamente dominada**: no mesmo paper do blog, TF.js WebGL deu 44 fps desktop vs 160 do runtime MediaPipe no mesmo modelo Lite | Apache-2.0 | manutenção (mesmo pacote) |
| RTMPose (mmpose) via `onnxruntime-web` | `ort-wasm-simd-threaded.wasm` **14,8 MB** (npm 1.31.1; `.jsep` WebGPU = 29,5 MB) + RTMPose-s fp32 ~22 MB (mirrors HF/EZ-MMLA); -m = 13,6 M params | 17 kp COCO (SimCC) — **sem mundo**, pipeline two-stage | mmpose README: latência/pessoa 4,5 ms(-s)/11,1 ms(-m) em ORT nativo i7-11700 + detector RTMDet — números nativos, wasm-web será mais lento; exige DIY: detector→crop→infer→decode SimCC→tracking próprio | Apache-2.0 | ativo (mmpose); sem API web turnkey |
| YOLO-pose (Ultralytics v8/11/26) via ORT | modelo ~6 MB (n) + runtime ORT | 17 kp | comparável à classe nano | **AGPL-3.0** — ultralytics.com/license: exige abrir o projeto inteiro sob AGPL ou licença Enterprise paga, cobrindo inclusive pesos retreinados | ativo, mas **bloqueio de licença** para qualquer uso não-AGPL |
| **LiteRT.js** (`@litertjs/core` 2.6.0) | runtime WASM (XNNPACK) + WebGPU/WebNN | nenhuma — é runtime puro | promissor (sucessor oficial do TF.js, anunciado jul/2026, Google AI Edge) | Apache-2.0 | ativo; **mas exige montar todo o pipeline**: modelo `.tflite` + pré/pós-processamento + tracking + métricas de mundo — tudo o que o tasks-vision entrega pronto |
| pose_landmarker_full / heavy (mesmo stack) | `.task` 9,4 MB / 30,7 MB | idêntica | model card: ~18/~40 fps e ~4/~19 fps Pixel3 (full/heavy); PDJ 91,8/94,2 vs 87,0 do lite | Apache-2.0 | troca por config — **alavanca de precisão**, não de velocidade |

**Conclusão**: para *uma pessoa numa webcam controlando um arcade*, nenhuma alternativa entrega simultaneamente (a) landmarks de mundo em metros (que `swingDetector`/`calibrator` já consomem), (b) pipeline de dois estágios com tracking temporal resolvido, (c) delegate GPU na web, (d) projeto mantido ativamente. O caminho racional de evolução é dentro do próprio MediaPipe (seção 6) — ou, no horizonte, reimplementar sobre LiteRT.js quando/SE ele ganhar uma API de pose pronta.

---

## 6. Capacidades MediaPipe subutilizadas que enriqueceriam o jogo barato

Ordenadas por custo/benefício:

1. **`metadata` do rVFC — telemetria de latência real (custo: zero, só leitura).** O callback recebe `(now, metadata)` e o código usa só `now` (`poseClient.ts:68`). `metadata.captureTime` ("time at which the frame was captured by the camera", SHOULD para getUserMedia — spec WICG §2.2) permite medir fóton→pose ponta a ponta; `metadata.presentedFrames` (monotônico) conta frames apresentados perdidos entre callbacks — hoje perdas só são inferidas pelo `busy`. Bônus: com `VideoFrame`, `frame.timestamp` dá o PTS do próprio frame em µs — **mas reinicia a cada nova sessão de câmera** (origem por track), então o `timestampMs` monotônico do PoseClient deve seguir sendo o relógio oficial (ver caveat em §2.2).
2. **`presence` per-landmark (exposto na web desde tasks-vision 1.1.0, release notes).** Semanticamente distinto de `visibility` (`vision.d.ts:2187-2193`): *presence* = "o ponto está presente na cena (dentro dos limites da imagem)"; *visibility* = "está visível (não ocluído)". `math.ts:16` já usa `presence ?? visibility` como fallback; o `TrackingGate`/`bodyConfidence` poderiam distinguir "saiu do enquadramento" (presence baixo → provavelmente parou de jogar/saiu) de "só está ocluído" (visibility baixo → degrade suave) — hoje os dois casos viram o mesmo 'degraded'.
3. **`outputSegmentationMasks` (hoje `false`, `pose.worker.ts:20`).** Liga uma saída de máscara por pose (`PoseLandmarkerResult.segmentationMasks: MPMask[]`, `vision.d.ts:2786-2810`). Custo: um decodificador a mais no grafo; a máscara fica como `WebGLTexture` — **barata se mantida em GPU**; caro é convertê-la (`getAsImageData()` faz "expensive GPU to CPU transfer", `vision.d.ts:2272-2279`; `getAsImageBitmap()` idem). Deve-se chamar `result.close()` para liberar (d.ts:2806-2810). Casos: silhueta/"fantasma" do jogador no PiP, recorte de fundo, máscara para efeitos de velocidade. Pode ligar/desligar em runtime via `setOptions` (`vision.d.ts:2618`) — sem custo quando desligada.
4. **`GestureRecognizer` / `HandLandmarker` / `FaceLandmarker` — mesmo fileset já baixado.** As três classes vivem no mesmo WASM de 14,7 MB (classes exportadas em `vision.d.ts:884,1028,659`; strings do binário confirmam os grafos). O custo incremental é só o `.task`: `face_landmarker.task` ≈ 3,8 MB (478 kp + 52 blendshapes), `hand_landmarker.task` ≈ 7,8 MB (21 kp×2), `gesture_recognizer.task` ≈ 8,4 MB (gestos nomeados — `Open_Palm`, `Thumb_Up`…), `holistic_landmarker.task` ≈ 13,7 MB (tudo num só grafo). URLs oficiais `storage.googleapis.com/mediapipe-models/...` (medições citadas em fontes de terceiros verificadas contra o CDN). **Atenção ao orçamento**: cada task extra adiciona um `detectForVideo` por frame na *mesma* thread WASM single-core — decimar (ex.: gestos a cada N frames) ou worker separado (aí paga +14,7 MB de WASM + compile). Caso de uso natural: palma aberta → pausar/recalibrar; punho fechado → "segurar raquete"; mão como cursor para os menus (hoje exigem clique — contraditório num jogo de corpo).
5. **Tuning dos thresholds (`pose.worker.ts:21-23`) — com correção de semântica** (review): `minTrackingConfidence` **não** é o gatilho de re-detecção — no tasks-vision ele alimenta `AssociationNormRectCalculator.min_similarity_threshold` (dedup por IoU + propagação de identidade entre ROIs, `pose_landmarker_graph.cc` ~L376-379). Quem decide re-rodar o detector é a contagem de rects do frame anterior (`has_enough_poses`/`DisallowIf` no subgrafo), alimentada por poses com `presence ≥ minPosePresenceConfidence`. Consequência prática: **com `numPoses: 1` o `minTrackingConfidence` é inerte** — as duas entradas da associação nunca estão não-vazias ao mesmo tempo (verificado em `docs/revisao-pr2-verificacao.md`, achado 8). Os knobs que de fato importam aqui: `minPosePresenceConfidence` (0,5→0,4 emite mais poses em frames marginais — mais re-detecções, não menos; subir endurece a emissão) e `minPoseDetectionConfidence` (aceitação do detector quando ele roda). A redação anterior atribuía a semântica do `solutions/pose` legado (`pose.py`) — não vale para tasks-vision.
6. **`numPoses` (hoje 1).** A option aceita >1 (`vision.d.ts:2746-2750`) — o detector acha ROIs extras e o landmarker roda por ROI — caminho habilitado para co-op futuro, custo ~linear no nº de pessoas.
7. **worldLandmarks — já consumido**, vale registrar: `swingDetector.ts:25-28` lê punho/ombro em metros e então **normaliza pela largura dos ombros** (`swingDetector.ts:29-33` — cada eixo `/ width`) antes de derivar a velocidade (`:38-42`) → os limiares de raquetada (`speed >= 2`, `softSpeed=2`, `strongSpeed=7`) são em **larguras-de-ombro por segundo**, não em m/s — invariante a distância e ao físico do jogador. `calibrator.ts:29` grava `world.shoulderWidth` e `readyWristLocal` já nas mesmas unidades normalizadas. Extensões baratas: amplitude de passada em metros (corrida), profundidade z do tronco (inclinação para frente/trás — hoje o lean usa só xy normalizado em `postureSignals.ts`).

---

## 7. Ranqueamento final de gargalos do pipeline por frame

Impacto = fração estimada do round-trip câmera→pose-usável; confiança reflete a força da evidência primária.

| # | Gargalo | Onde | Impacto estimado | Confiança |
|---|---|---|---|---|
| 1 | **Inferência síncrona do grafo (detect+landmark+tracking) no WASM single-thread** | `_waitUntilIdle` dentro de `detectForVideo` | ~70–90% do round-trip; define o teto `fps ≤ min(30, 1000/rt)`. Referência: ~20–23 ms/frame num Pixel 3 GPU (model card); CPU fallback é 2–4× mais lento e ainda paga upload GL + readback interno (única via de entrada = textura, ver §2.4) | **Alta** (arquitetura + model card) |
| 2 | **Latência estrutural do agendamento**: rVFC dispara na *apresentação* do frame; bitmap é etapa async extra; `busy`-drop significa que a pose devolvida descreve um frame de 1–2 quadros atrás no pior caso | `poseClient.ts:64-82,152-165` | +0,5–1 frame de latência além da inferência (~16–33 ms a 30 fps); somando exposição/ISP da câmera (invisível sem `captureTime`), o lag total fóton→ação típico é ~50–120 ms | Média-alta (semântica da spec) |
| 3 | **`createImageBitmap` por frame na main thread** | `poseClient.ts:158` | ~1–4 ms/frame e compete com o jogo pela main thread; eliminável via `new VideoFrame(video)` (§2.2) | Alta (API) / magnitude pequena |
| 4 | **`texImage2D` interno no worker** | `$h` em `vision_bundle.mjs` | ~0,5–2 ms a 640×480; cresce quadrático se a câmera entregar >640 e o resize for removido — **o resize atual é a proteção certa**, não removê-lo sem contramedida | Alta (código do bundle) |
| 5 | **Fallback rAF+`currentTime` processa frames duplicados** em browsers onde `currentTime` é relógio real (Firefox/Safari antigos) | `poseClient.ts:73-80` | até ~2× capturas redundantes de pixels idênticos; absorção parcial pelo `busy` | Média (semântica mediacapture + bug Chrome documentado; share de browsers afetados pequena) |
| 6 | **`postMessage` + structured clone da resposta POSE** | ambos os lados | <0,5 ms total; ~3 KB clonados — irrelevante | Alta |
| 7 | **Contenção GPU**: o `OffscreenCanvas` WebGL2 do worker e o renderer Three.js da main disputam o mesmo subsistema GL em iGPUs fracas | transversal | não medido — suspeita, não fato | Baixa |
| 8 | Detectores/GameLoop/dispatch | `src/kinematics/*` | microssegundos — desprezível por design | Alta |

## 7.5 Benchmark local medido (Chromium 159 headless, 25/nov/2026)

Metodologia: `scripts/pose-bench.html` spawna o **worker real do `dist/`** (`pose.worker-*.js` pós-build), faz `INIT` GPU e CPU e envia 60 frames após 8 de warmup, medindo o round-trip `postMessage(FRAME) → POSE` (inclui transfer e clone — o número "inferência" da linha 1 do ranking + transporte). Inputs: foto real de pessoa redimensionada a 640 px (`detected` = POSE com landmarks não-vazios; origem: `curl -o dist/pose.jpg https://storage.googleapis.com/mediapipe-assets/pose.jpg` — imagem oficial de demo do MediaPipe; sem o arquivo, o script roda só a figura sintética) e figura sintética 640×480 (nunca detectada → detector de pessoa roda todo frame = caminho mais caro). Browser: Chromium headless 159 **sem GPU dedicada** — WebGL via SwiftShader (GL de software). Reprodução completa: `npm run build && cp scripts/pose-bench.html dist/bench.html && curl -o dist/pose.jpg https://storage.googleapis.com/mediapipe-assets/pose.jpg && npm run preview` → `http://localhost:4173/bench.html`.

| Input | Delegate | Init (ms) | p50 (ms/frame) | p90 | Detectado | Poses/s (≈1000/p50) |
|---|---|---|---|---|---|---|
| foto com pessoa | GPU (SwiftShader) | 351–467 | **96,2–133,4** | 111–148 | 60/60 | ~7–10 |
| foto com pessoa | **CPU (XNNPACK+SIMD)** | 251–301 | **16,0–20,3** | 16,8–23,9 | 60/60 | **~49–62** |
| figura sintética | CPU | 238–322 | **13,3–17,7** | 14,0–19,7 | 0/60 | ~57–75 |
| figura sintética | GPU (SwiftShader) | 252 | **168,9–196,7** | 242,7 | 0/60 | ~5–6 |

**Leituras:**

1. **CPU nesta máquina entrega ~16–21 ms/frame (≈48–62 poses/s) mesmo no caminho mais caro** — folga ampla sobre a câmera de 30 fps. Coerente com o model card (~44 fps num Pixel 3 de 2018) escalado para um core de desktop moderno (o WASM é single-thread; `hwc=16` não importa).
2. **"GPU" em GL de software é 6–12× pior que CPU** (~96–243 ms/frame ≈ 5–10 fps). O delegate GPU só é rápido com aceleração real — em SwiftShader/llvmpipe/VMs/RDP ele é *dramaticamente* pior, e **o app nunca cai para CPU nesse caso**: `fallback()` só dispara em exceção, não em lentidão. Ação derivada: detectar renderer de software via `WEBGL_debug_renderer_info` (`gl.getParameter` — strings tipo "WebKit WebGL"/"SwiftShader"/"llvmpipe") e preferir CPU, ou medir o primeiro `detectForVideo` e fazer fallback por latência. Hoje um usuário com GPU blocklistada recebe ~7 fps em vez de ~50.
3. **Warmup real — medido**: com pessoa na entrada, a **primeira** pose chegou já no frame 0 (`firstPoseIndex`, registrado pelo script — antes a contagem só existia pós-warmup), mas o custo é de relógio, não de contagem: primeiro frame ≈ **142 ms no CPU** e ≈ **2 016 ms no GPU** (vs p50 ~16/~96 dos demais). Ou seja, a latência de "primeira pose" é um spike da primeira inferência (alocação lazy + compilação de programas GL no grafo), não ~8 frames perdidos como leu a versão anterior desta seção — corrigido após registrar `firstPoseIndex` no harness. Um frame dummy no init cobriria a parte do detector/alocação; a aquisição de tracking do estágio landmarker só se aquece com um frame que contenha pessoa.
4. **`createImageBitmap` custa ~0,05 ms** a partir de canvas (de `<video>` será um pouco mais) — confirma que a etapa não é gargalo; a inferência responde ~95%+ do round-trip medido.
5. Detector-todo-frame (stick, 0/60) é *mais barato* que tracked (foto): ~13–18 vs ~16–20 ms no CPU — a detecção não domina no modelo Lite a 640 px.

**Caveats**: o número "GPU" mede **apenas** renderização por software (SwiftShader) — ele **não estabelece faixa nem limite** para latência com aceleração gráfica real no navegador: nem o piso (uma GPU real provavelmente é muito mais rápida) nem o teto. O que o dado estabelece é só a observação acionável do item 2 — GL de software torna o delegate GPU péssimo *e indetectável pelo fallback*. Latência fóton→pose ponta a ponta também não é medida (precisa de `metadata.captureTime` — SHOULD na spec, pode ausentar — + câmera real).

---

**Direções de melhoria ordenadas por ROI:**
1. **Detectar GL de software (SwiftShader/llvmpipe/"Software") e preferir CPU ou fallback por latência** — achado novo do benchmark §7.5: GPU-delegate em GL não acelerado entrega ~7 fps vs ~50 do CPU, sem nunca cair no fallback por exceção.
2. `new VideoFrame(video)` no rVFC (corta o estágio 3; exige `frame.close()` no worker — §2.2). Se `videoWidth > 640`, manter `createImageBitmap` com resize (o upload 1080p custaria mais que o bitmap).
3. Ler `metadata.captureTime`/`presentedFrames` para telemetria de latência real e contagem de drops (§6.1).
4. Em fallback CPU, reduzir `resizeWidth` para ~320 (o landmarker consome 256² — a resolução extra só paga upload+readback).
5. Features gratuitas: `outputSegmentationMasks` para silhueta no PiP; `GestureRecognizer` para gestos de menu (§6.3–6.4).
6. Não perseguir: build threaded (não existe), WebGPU na task de visão (dormente em 1.2.3), OpenCV.js (veredicto §4), troca de modelo de pose (tabela §5).

---

## Fontes principais

**Repo / node_modules (evidência primária de implementação):**
- `src/cv/poseClient.ts:57-83` (rVFC + fallback), `:152-165` (busy/bitmap/transfer), `:167-170` (confidence)
- `src/cv/pose.worker.ts:12` (`forVisionTasks(_,true)`), `:16-24` (options), `:81-97` (`detectForVideo`/`close`)
- `src/App.tsx:118-120` (constraints 640×480@30)
- `node_modules/@mediapipe/tasks-vision/vision.d.ts:1862` (`ImageSource=TexImageSource`), `:2717` (`detectForVideo`), `:2852` (RunningMode), `:2176-2193` e `:2462-2483` (semântica visibility/presence), `:2766-2810` (masks+close), `:2956-3048` (`WasmModule`: `_bindTextureToCanvas`, `_addBoundTextureAsImageToStream`… `_waitUntilIdle`)
- `node_modules/@mediapipe/tasks-vision/vision_bundle.mjs` (minificado): `$h` (texImage2D+contexto GL), `Yu.prototype.Da` (`_addBoundTextureAsImageToStream`), `finishProcessing`→`_waitUntilIdle`, `Dh` (displayWidth=VideoFrame), `Oh` (OffscreenCanvas/Safari≥17), `Mh` (loader), `eb` do InteractiveSegmenter (único caminho `getImageData`)
- `node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_module_internal.wasm` — seções parseadas à mão (offset/flag), contagem de opcodes SIMD, strings (`xnnpack`, `drishti`, `MlDriftWebGpu`, `webgpu_service.h`)
- `node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_module_internal.js:5570-5689` (bindings `_emwgpu*`/import Js WebGPU), `:96,377,385,5349,7566,7676` (`pthread` só em comentários), ~`:340` (`instantiateStreaming`)

**Specs e docs de browser:**
- wicg.github.io/video-rvfc (metadados, `captureTime` SHOULD p/ gUM, callbacks antes de rAF, `presentedFrames`)
- MDN/caniuse: `requestVideoFrameCallback` (C83/S15.4/FF132), `VideoFrame` ctor (C94/S16.4/FF130), `MediaStreamTrackProcessor` (C94 parcial/S18/FF✗), `ImageCapture.grabFrame` (C59/FF flag/S26), `createImageBitmap` options (`resizeWidth` FF98+/S15+/C54; `resizeQuality` FF149), `wasm-simd` (C91/FF89/S16.4), OffscreenCanvas
- web.dev/articles/requestvideoframecallback-rvfc (taxa = min vídeo/browser)
- MDN `HTMLMediaElement.currentTime` (frequência de atualização impl-defined); w3c/mediacapture-main#615 (timeline de MediaStream = tempo real); issuetracker.google.com/issues/413061418 (bug interop Chrome por-frame)
- MDN `SharedArrayBuffer` (`crossOriginIsolated` exigido)

**Docs e releases de projeto:**
- ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker (modos, world landmarks em metros/origem quadril, dois estágios detector+landmarker, livestream guidance)
- developers.google.com/edge/mediapipe/solutions/setup_web (WebGPU recomendado p/ genai; fileset de visão compartilhado)
- Model card BlazePose GHUM (developers.google.com/static/ml-kit/images/vision/pose-detection/pose_model_card.pdf): Lite 44 fps CPU/49 GPU Pixel3, input 256², saída 33×5 + 33×3 mundo
- github.com/google-ai-edge/mediapipe/releases: v1.2.2 "Remove non-SIMD WebAssembly builds"; v1.0.0 "Store wgpu::Instance in WebGpuService"; v1.1.0 "Expose per-landmark presence scores on the Web Tasks API"
- npm registry (`npm view`): tasks-vision latest=1.2.3 (11/nov/2026), nightly 1.3.0-rc.20261122; onnxruntime-web 1.31.1 (ort-wasm-simd-threaded.wasm=14,8 MB, .jsep=29,5 MB, unpacked 150,6 MB); @tensorflow/tfjs 4.22.0 (jan/2025); @tensorflow-models/pose-detection 2.1.3; @techstark/opencv-js 5.0.0-release.1 (14,7 MB)
- docs.opencv.org/4.12.0 tutorial_js_setup (`--threads`, `--simd`, `--build_loader`, `--disable_single_file`); tamanhos oficiais 4.14.0/5.0.0 via issoh.co.jp (out/2026); opencv/opencv#25425 (sem release JS oficial) via README @haoking/opencvjs; intel/webml-polyfill#1348 (8,1/9,0 MB histórico)
- blog.tensorflow.org (mai/2021): MoveNet 104 fps WebGL MBP, BlazePose MediaPipe-runtime 160 fps desktop vs 44 TF.js WebGL Lite
- github.com/open-mmlab/mmpose RTMPose README (latências i7-11700, AP, RTMDet two-stage); ultralytics.com/license (AGPL-3.0 cobre código+modelos+pesos)
- developers.googleblog.com LiteRT.js (jul/2026) + developers.google.com/edge/litert/web (WebGPU/WebNN/XNNPACK wasm; sucessor TF.js)
- Tamanhos `.task` (face 3,8 MB / hand 7,8 MB / gesture 8,4 MB / holistic 13,7 MB / pose_full 9,4 MB / pose_heavy 30,7 MB): fontes de catálogo verificadas contra `storage.googleapis.com/mediapipe-models` (sanderdesnaijer.com 15/nov/2026, issoh.co.jp out/2026, LocalMode-AI models.ts com sizeBytes)

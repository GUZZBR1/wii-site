# Verificação dos achados de code review — PR #2 (`docs/mediapipe-cv-research`)

Data: 25 de novembro de 2026 · Repo: `/home/lucas_coimbra/projects/wii` · Branch verificada: `docs/mediapipe-cv-research` (`fd69a8d`)
Método: cada achado foi conferido contra **fontes primárias** — o código do repo, os arquivos do pacote instalado (`node_modules/@mediapipe/tasks-vision/`), o código-fonte upstream (`google-ai-edge/mediapipe` no GitHub, branch master), as especificações WICG/W3C e MDN/BCD. Nenhuma afirmação foi validada por fonte secundária.

Legenda: **confirmado** / **parcialmente confirmado** / **refutado**.

> **Nota de concorrência (25/nov/2026):** durante esta verificação, edições **não commitadas** apareceram na working tree (`git status` estava limpo no início da sessão; ao final, `scripts/pose-bench.html` e `docs/pesquisa-pipeline-cv.md` constam modificados sem commit). Os veredictos abaixo descrevem o estado **commitado `fd69a8d`** — que é o que estava sob review. O diff em andamento já implementa, parcialmente, as correções deste relatório: `firstPoseIndex`/`firstPoseMsAfterReady` + `readyAt` (achado 1), `resolve({type:'FELL_BACK'})` + `out.invalid` + break no fallback mid-run (achado 3), URL da foto no header do script (achado 2), "SHOULD (não MUST)" para `captureTime` (achado 7) e "larguras-de-ombro por segundo" no item worldLandmarks (achado 6). Seguem **pendentes** no diff observado: achados 4 (caveat do intervalo GPU), 5 (PTS do `VideoFrame`), 8 (semântica de `minTrackingConfidence` — o texto antigo continua na linha) e 9 (warmup da auditoria).

---

## Achado 1 — O benchmark não registra quando a primeira pose aparece

**Veredicto: confirmado.**

**Evidência (mecânica do código):**
- `scripts/pose-bench.html:57` — o objeto `out` tem `times: [], bitmapMs: [], detected: 0, empty: 0, errors: []`; não existe campo para o índice da primeira detecção.
- `scripts/pose-bench.html:88-94` — o contador `out.detected` só é incrementado quando `i >= WARMUP` (=8): `if (res.type === 'POSE') { out.times.push(dt); if (res.landmarks?.length) out.detected++; else out.empty++; }`. Nos frames de warmup (`i < 8`) o único teste é `res.type !== 'POSE'` → erro; `res.landmarks?.length` nunca é inspecionado. Ou seja: uma POSE com landmarks durante o warmup é consumida em silêncio e não registrada em lugar nenhum.
- Consequência documental: a afirmação de `docs/pesquisa-pipeline-cv.md:223` ("a primeira pose não-vazia apareceu ~8 frames após READY") **não é reproduzível a partir de `window.BENCH`** — o número coincide exatamente com `WARMUP = 8` (`pose-bench.html:28`), o que levanta a hipótese de que o "~8" seja artefato do próprio cutoff do warmup, não uma medição.

**Correção necessária (trivial, confirmada como mecanicamente viável):** adicionar ao `out` um campo tipo `firstPoseIndex`, capturado dentro do loop antes do branch de warmup, p.ex. `if (out.firstPoseIndex === undefined && res.type === 'POSE' && res.landmarks?.length) out.firstPoseIndex = i;` — duas linhas bastam para sustentar a afirmação do §7.5.

---

## Achado 2 — Comando de reprodução omite a foto (só a figura sintética roda)

**Veredicto: parcialmente confirmado.**

**Evidência:**
- `docs/pesquisa-pipeline-cv.md:210` — a metodologia **nomeia** a origem ("foto real de pessoa redimensionada a 640 px (`mediapipe-assets/pose.jpg`...)"), mas o comando de reprodução na mesma linha é apenas `` `npm run build && cp scripts/pose-bench.html dist/bench.html && npm run preview` `` — **sem URL completa e sem passo de download/cópia**.
- `scripts/pose-bench.html:2-5` — o cabeçalho do script diz só "Opcional: copie uma foto com pessoa para `dist/pose.jpg`", também sem URL.
- `scripts/pose-bench.html:104-111` — mecânica confirmada: sem `/pose.jpg`, `img.decode()` falha → `catch` → `console.log('sem /pose.jpg — rodando só a figura sintética')` → `photo` fica `null` → o bloco `if (photo)` em `:118-121` é pulado e as linhas "foto com pessoa" da tabela do §7.5 **não são reproduzidas** num build limpo (onde `dist/pose.jpg` não existe).
- A URL primária existe e responde: `https://storage.googleapis.com/mediapipe-assets/pose.jpg` → HTTP 200, 44 100 bytes (HEAD verificado em 25/nov/2026). É a imagem de exemplo usada nas demos/docs do MediaPipe.

**Correção necessária:** incluir na §7.5 (e idealmente no comentário do script) o passo explícito, p.ex. `curl -sL -o dist/pose.jpg https://storage.googleapis.com/mediapipe-assets/pose.jpg`, e observar que a foto é redimensionada para 640 px pelo próprio script (`pose-bench.html:108-110`).

---

## Achado 3 — Fallback GPU→CPU no meio do run mistura timings sob o rótulo do delegate pedido

**Veredicto: confirmado** (com nuances que refinam a descrição do achado).

**Evidência (worker):**
- `src/cv/pose.worker.ts:87-93` — em exceção de `detectForVideo`, o worker faz `await fallback(message)`; se ok, posta `FALLBACK` (`:39`, dentro de `fallback()`) e depois `ERROR` com `fatal: false` (`:91`). A instância `landmarker` é reatribuída em `createTask('CPU')` (`:16`, chamada em `:38`) — **frames seguintes passam por um landmarker CPU real, na mesma thread do worker**.
- Confirmado: `FRAME` pós-fallback atinge um landmarker de verdade (`:74-86` — o caminho não muda; só o objeto apontado mudou).

**Evidência (bench):**
- `scripts/pose-bench.html:83` — a promessa por frame resolve em `POSE` **ou** `ERROR`. No frame do fallback, chegam `FALLBACK` (marca `out.fellBack = true`, `:84`) e depois `ERROR` → o frame é contado em `out.errors`, não em `out.times`.
- **Nuance A (não mencionada no achado):** se o fallback cair durante o warmup (`i < 8`), o branch `else if (res.type !== 'POSE') { out.errors.push('warmup: ' + …); break; }` (`:94`) **aborta o run inteiro** — não mistura timings, mata o run (`perFrame` sai `{n: 0}`).
- **Nuance B:** se o fallback cair em `i ≥ 8`, o loop segue (`:93` só quebra com `errors > 3`) e os frames seguintes — agora inferidos em CPU — têm `dt` empilhados no mesmo `out.times` dos frames GPU anteriores. `out.perFrame` (`:96`) agrega a população mista.
- `out.delegate` é fixado uma única vez, na mensagem `READY` (`:63`), e `out.requested` guarda o pedido (`:57`). A mensagem `FALLBACK` carrega `to: 'CPU'` (`protocol.ts:59`), mas o bench **não atualiza `out.delegate`** — só seta `fellBack`. Logo: resumo misto e mal rotulado — confirmado.

**Correção necessária:** a flag `fellBack` já existe (`:64`, `:84`) — o que falta é usá-la: (a) separar `times` por delegate efetivo (ex.: `times` → `timesByDelegate` ou marcar cada frame com o delegate corrente, atualizando `out.delegate = m.to` no handler de `FALLBACK`), e/ou (b) invalidar `perFrame` quando `fellBack` (a população mista não representa nenhum delegate). O achado também sustenta registrar `initMs` do segundo módulo — o fallback mid-run paga `createTask('CPU')` inteiro (~250–350 ms medidos) dentro de um único frame.

---

## Achado 4 — "a faixa GPU-real fica entre o CPU medido e o model card" (caveat do §7.5)

**Veredicto: parcialmente confirmado** — a direção do caveat está certa (SwiftShader ≠ GPU real), mas o enquadramento como intervalo delimitado é um overclaim.

**Evidência:**
- O que o benchmark estabelece de fato (`docs/pesquisa-pipeline-cv.md:210-217` + `pose-bench.html`): (a) CPU/XNNPACK nesta máquina ≈ 13–21 ms/frame; (b) o delegate `GPU` **sob GL de software** (SwiftShader) ≈ 96–243 ms/frame. Nada além disso foi medido.
- A frase `docs/pesquisa-pipeline-cv.md:227` propõe um intervalo `[CPU medido, model card]` para o GPU-real. Dois problemas:
  1. **O model card não é um teto**: os próprios dados citados no doc contradizem o bound — `docs/pesquisa-pipeline-cv.md:167` cita o blog do TF medindo o runtime MediaPipe WASM+GPU a **92 fps (MBP 2019) e 160 fps (i9+GTX1070)** no modelo Lite, ambos *mais rápidos* que o model card (~49 fps num Pixel 3 de 2018). Um GPU desktop real pode ficar **abaixo** (melhor) do número do model card — ele é um piso de um celular antigo, não uma fronteira superior.
  2. **O CPU medido não é um piso garantido**: nada no benchmark impede que um GPU real fraco (iGPU disputada, driver ruim) fique *pior* que o delegate CPU. É improvável vs. SwiftShader, mas "improvável" não é "medido".
- Formulação honesta do que o benchmark sustenta: GPU-real **não foi medida**; a expectativa (âncoras externas: model card + números de desktop citados em §5) é que fique muito abaixo do SwiftShader e plausivelmente comparável ou mais rápida que o CPU medido — mas isso é inferência, não resultado.

**Correção necessária:** reescrever o caveat para não apresentar o intervalo como delimitado, p.ex.: "o benchmark não mede GPU real — a expectativa por fontes externas (model card ~49 fps num Pixel 3; até 92–160 fps em desktops citados em §5) é que fique comparável ou mais rápida que o CPU medido, mas isso não é resultado deste benchmark."

---

## Achado 5 — `frame.timestamp` como `timestampMs`: PTS real, mas com origem por fonte (reseta entre sessões)

**Veredicto: confirmado** — a sugestão do doc precisa de caveat/correção; manter o relógio ms próprio do `PoseClient` (ou rebasear o PTS por sessão) é o correto.

**Evidência (specs):**
- WebCodecs, `VideoFrame(image, init)`, branch `HTMLVideoElement`: "Let currentPlaybackFrame be the `VideoFrame` at the current playback position" → `Initialize Frame From Other Frame` (https://w3c.github.io/webcodecs/#dom-videoframe-videoframe-image-init). No algoritmo, passo 13: "If `timestamp` exists in init, assign it…; Otherwise, assign otherFrame's `[[timestamp]]` to frame's `[[timestamp]]`" — ou seja, `new VideoFrame(video)` herda o PTS do frame interno do elemento. O atributo é "the presentation timestamp, given in microseconds" — **sem época definida**.
- mediacapture-extensions, seção "Video timestamp concepts" (https://w3c.github.io/mediacapture-extensions/#video-timestamp-concepts, merge do PR w3c/mediacapture-extensions#156): "**Each video frame must have a presentation timestamp which is relative to a source specific origin.** A source of frames can define how this timestamp is set." E em "Local video capture timestamps": "Local capture tracks have a **fixed offset between presentation timestamp and capture timestamp**. The user agent may let this be zero…" — ou seja, o PTS de um frame de câmera é **relativo a uma origem por track/fonte**, com offset arbitrário definido pelo UA. Um novo `getUserMedia` = nova track = nova origem → o PTS pode (e tipicamente vai) reiniciar perto de 0.
- Corroboração: o próprio rVFC spec diz que `mediaTime` "MAY have a zero value for live-streams or WebRTC applications" (wicg.github.io/video-rvfc §2.2) — relógios relativos por stream são a norma para fontes ao vivo.

**Evidência (código):**
- `src/cv/poseClient.ts:29` — `private lastTimestamp = 0` é estado do cliente, **nunca resetado** em `beginCapture` (só `lastVideoTime` é, `:62`) nem em `pauseCapture` (`:85-92`).
- `src/App.tsx:76-90` — `stopCamera()` chama `clientRef.current?.pauseCapture()` e para as tracks, mas **não chama `dispose()`**; `startCamera` reutiliza a mesma instância via `clientRef.current ??= new PoseClient()` (`:115`). Ou seja: o worker e o `lastTimestamp` sobrevivem ao ciclo parar→religar da câmera (dispose só existe no cleanup de unmount, `:43`).
- `src/cv/poseClient.ts:155-156` — `Math.max(now, lastTimestamp + 0.01)`: se `now` passar a vir de um PTS que resetou para ~0 na nova sessão, o clamp impede regressão (a exigência "estritamente crescente" do modo VIDEO é preservada), mas **todos os frames seguintes serão carimbados em passos de +0,01 ms** — os deltas temporais viram sintéticos. Consequência concreta: o smoothing OneEuro interno do grafo (dt-dependente) e os detectores do app que usam `snapshot.timestampMs` em intervalos reais (`cadenceTracker.ts:26-34` — janelas de 450 ms; `jumpDetector.ts:19,28` — 400/160 ms; `postureSignals.ts:19` — 350 ms; `swingDetector.ts:38,47` — dt com piso de 1/120 s e cooldown de 400 ms) passam a operar sobre deltas de 0,01 ms → cooldowns na prática nunca expiram e velocidades ficam infladas/distópicas.
- `now` do rVFC e `performance.now()` compartilham o relógio monotônico do documento — não resetam entre sessões de câmera. É por isso que o clamp atual é robusto: a base dele é monotônica *por página*, não por track.

**Correção necessária em `docs/pesquisa-pipeline-cv.md:63`:** a afirmação "`frame.timestamp` = PTS real em µs — melhor que `performance.now()` para `timestampMs`" deve ser qualificada: o PTS é real, mas tem **origem por fonte** (mediacapture-extensions) e reinicia entre tracks/sessões — o que, combinado com o warm worker e o `lastTimestamp` persistente, corromperia os deltas usados por detectores e pelo smoothing interno. Recomendar: manter o relógio ms do `PoseClient` (rVFC `now`/`performance.now()`) para `timestampMs`, e usar `frame.timestamp` apenas com rebase por sessão (subtrair o PTS do primeiro frame da captura corrente) ou como metadado de telemetria.

---

## Achado 6 — Velocidade de swing está em larguras-de-ombro/s, não em m/s

**Veredicto: confirmado.**

**Evidência (código completo):**
- `src/kinematics/swingDetector.ts:25-26` — entradas `worldLandmarks` do punho/ombro, que são metros (confirmado: ai.google.dev pose_landmarker, tabela "Task output" — `worldLandmarks` em "meters… midpoint of the hips"; `vision.d.ts` `PoseLandmarkerResult`).
- `src/kinematics/swingDetector.ts:29-30` — `lateral` = vetor ombro→ombro em metros; `width` = `|lateral|` (metros) com fallback `calibration.world.shoulderWidth` (metros, `calibrator.ts:45,69`).
- `src/kinematics/swingDetector.ts:32-34` — `current` = `(wrist − shoulder) / width` por componente → **adimensional, em "larguras de ombro"** — normalizado *antes* da diferenciação.
- `src/kinematics/swingDetector.ts:38-42` — `v = Δcurrent/dt`, `speed = |v|` → **larguras-de-ombro por segundo**, não m/s.
- Thresholds nessas unidades: gatilho `speed >= 2` (`:47`), `softSpeed = 2`/`strongSpeed = 7` (`:15-16`, ajustáveis por `setPowerAnchors`), `lateralSpeed` também em larguras/s (`:43` — projeção de `v` sobre o eixo ombro→ombro normalizado), `readyDistance < 0.35` (`:62`) e `aimValue` ±0,2 (`:52`) em larguras-de-ombro — consistente com `calibration.world.readyWristLocal`, que o calibrador grava já normalizado por `worldShoulderWidth` (`calibrator.ts:48` — mesmo denominador).
- Referência de escala: com ombros ~0,4 m, "speed 2" ≈ 0,8 m/s e "speed 7" ≈ 2,8 m/s — plausível para raquetada, mas a unidade gravada no código é adimensional.

**Correção necessária em `docs/pesquisa-pipeline-cv.md:189`:** a frase "usa punho/ombro em **metros** (velocidade de raquetada em m/s reais)" está meio certa — os *inputs* são metros, mas a *velocidade* é em larguras-de-ombro/s. Sugestão: "usa punho/ombro em metros, mas normaliza o deslocamento pela largura dos ombros **antes** de derivar — velocidade e thresholds (`speed ≥ 2`, soft/strong 2/7) são em larguras-de-ombro/s, adimensionais — é isso que torna o detector invariante à distância da câmera, junto com `readyWristLocal` na mesma unidade (`calibrator.ts:48`)". A mesma correção vale para `docs/auditoria-mediapipe.md:62` ("velocidade 3D do punho — coordenadas métricas"), que também sugere velocidade em m/s.

---

## Achado 7 — `captureTime` é SHOULD na spec, não "DEVE"

**Veredicto: confirmado** — e o doc é internamente inconsistente.

**Evidência:**
- Spec WICG video-rvfc §2.2 (https://wicg.github.io/video-rvfc/#dom-videoframecallbackmetadata-capturetime), texto normativo literal de `captureTime`: "**SHOULD be present for WebRTC or getUserMedia applications, and absent otherwise.**" Na WebIDL, o membro aparece sem `required` (`[DOMHighResTimeStamp] captureTime;`) — ou seja, é um campo **opcional** que vem `undefined` quando ausente.
- `docs/pesquisa-pipeline-cv.md:34` — diz "`metadata.captureTime` — 'the time at which the frame was captured by the camera' — **DEVE estar presente para fontes getUserMedia** (spec §2.2)". "DEVE" = MUST — **exagera a normatividade**.
- Inconsistência interna: o próprio doc diz o correto em dois outros lugares — `docs/pesquisa-pipeline-cv.md:183` ("SHOULD para getUserMedia — spec WICG §2.2") e `:253` ("`captureTime` SHOULD p/ gUM").
- Suporte real quando presente (fontes primárias): Chromium popula `captureTime` para fontes gUM/WebRTC via metadados de captura do `VideoFrame`; Firefox implementou `captureTime`/`receiveTime`/`rtpTimestamp`/`processingDuration` no rVFC no **Firefox 132** (bug 1908245, bugzilla.mozilla.org — "for WebRTC related elements", incluindo câmera — arquivos `PCameras.ipdl`, `MediaEngineRemoteVideoSource.cpp` no patch). Quando o campo está ausente (fonte não-gUM, browser sem suporte), o valor é `undefined` — telemetria precisa de guarda; não é erro.

**Correção necessária:** em `pesquisa-pipeline-cv.md:34`, trocar "DEVE" por "deveria (SHOULD) estar presente — campo opcional; vem `undefined` quando a fonte/UA não o provê". Alinha a linha 34 com as linhas 183/253.

---

## Achado 8 — Semântica de `minTrackingConfidence`: a auditoria tem razão, a pesquisa não

**Veredicto: confirmado** — para a API tasks usada pelo app, a descrição da auditoria (`min_similarity_threshold` do `AssociationNormRectCalculator`) é a mecanicamente correta; a da pesquisa (confiança de tracking que re-dispara o detector) descreve a **API legada** `solutions/pose`.

**Evidência (upstream, `google-ai-edge/mediapipe` master):**
1. Mapeamento JS→proto (`mediapipe/tasks/web/vision/pose_landmarker/pose_landmarker.ts`, `setOptions`): `minTrackingConfidence` → `PoseLandmarkerGraphOptions.min_tracking_confidence`; `minPosePresenceConfidence` → `PoseLandmarksDetectorGraphOptions.min_detection_confidence`; `minPoseDetectionConfidence` → `PoseDetectorGraphOptions.min_detection_confidence`; `numPoses` → `PoseDetectorGraphOptions.num_poses`.
2. Único consumo no grafo tasks (`mediapipe/tasks/cc/vision/pose_landmarker/pose_landmarker_graph.cc:376-379`): `pose_association.GetOptions<AssociationCalculatorOptions>().set_min_similarity_threshold(tasks_options.min_tracking_confidence())` — igual ao que diz `docs/auditoria-mediapipe.md:155`. O `.d.ts` local (`vision.d.ts:2762-2765`) e a doc oficial (ai.google.dev pose_landmarker, "Configuration options") só dizem "minimum confidence score for the pose tracking to be considered successful" — vago, não decide a questão.
3. O que decide re-rodar o detector de pessoa (`pose_landmarker_graph.cc:353-371`): `prev_pose_rects` (loopback do frame anterior) → `NormalizedRectVectorHasMinSizeCalculator` com `min_size = num_poses` → `has_enough_poses` → `DisallowIf(image_in/norm_rect_in, has_enough_poses)` **pula o `PoseDetectorGraph`** quando há rects suficientes. Ou seja, o gatilho é **contagem** de rects do frame anterior, não um score vs. `minTrackingConfidence`.
4. O que esvazia `prev_pose_rects` (`pose_landmarks_detector_graph.cc`): dentro de `SinglePoseLandmarksDetectorGraph`, `pose_presence = presence_score > min_detection_confidence` (`:393-398`, onde `min_detection_confidence` do subgrafo = **JS `minPosePresenceConfidence`**) → `GateCalculator` com `ALLOW=pose_presence` (`:401-406`) barra os tensores → sem landmarks → `POSE_RECT_NEXT_FRAME` não é emitido (`:560-586`) → vetor vazio → detector roda no próximo frame. **O threshold que governa re-detecção é `minPosePresenceConfidence`, não `minTrackingConfidence`.**
5. O que o threshold faz de fato (`mediapipe/calculators/util/association_calculator.h`): IoU > `min_similarity_threshold` entre rects de streams distintos → dedup (o elemento do stream posterior substitui o anterior) e propagação de `id` — associação espacial entre rects do frame anterior e novas detecções, não "confiança do tracker".
6. Bônus para a config do app: com `numPoses=1` (`pose.worker.ts:19`), `has_enough_poses = (prev.size ≥ 1)` — o detector só roda quando `prev` está **vazio**, logo as duas entradas do association nunca estão não-vazias ao mesmo tempo → **`minTrackingConfidence` é efetivamente inerte nesta configuração** (só atua com `numPoses ≥ 2` e tracking parcial). A sugestão "0,5→0,4 diminui re-detecções" (`pesquisa-pipeline-cv.md:187`) é duplamente equivocada: threshold errado e opção inerte.
7. Origem da confusão: na API legada (`mediapipe/python/solutions/pose.py`, v0.10.14), `min_tracking_confidence` era mapeado para `…ThresholdingCalculator.threshold` — um threshold sobre o score do próprio landmark, que ao falhar produzia frame vazio → detecção no próximo frame. A semântica "tracking fraco → re-detecta" existia lá; a API tasks reaproveitou o nome do campo para o IoU de associação.

**Correção necessária:**
- `pesquisa-pipeline-cv.md:187` — reescrever o item: "`minTrackingConfidence` é o IoU mínimo (`min_similarity_threshold`) do `AssociationNormRectCalculator` que casa novas detecções com os rects do frame anterior (dedup/herança de track id — `pose_landmarker_graph.cc:376-379`); quem dispara re-detecção é a **contagem** de rects do frame anterior (`DisallowIf`/`has_enough_poses`), alimentada pela presença — o threshold efetivo para 'tracking perdido' é `minPosePresenceConfidence` (score de presença dentro do landmarker). Com `numPoses=1`, `minTrackingConfidence` é praticamente inerte." A alavanca real para "menos re-detecções" é baixar `minPosePresenceConfidence` — com o trade-off de aceitar poses de presença marginal.
- `auditoria-mediapipe.md:155` — a descrição está correta; opcionalmente adicionar a nota de inércia para `numPoses=1`.

---

## Achado 9 — Warmup com frame vazio não cobre o estágio do landmarker

**Veredicto: parcialmente confirmado** — o mecanismo apontado está certo, mas o doc da auditoria já mitiga parcialmente com a alternativa "(ou no primeiro bitmap)"; e a atribuição do "~8 frames" à primeira detecção continua hipótese não medida (amarra com o achado 1).

**Evidência:**
- Pipeline de dois estágios confirmado no upstream (`pose_landmarker_graph.cc`): `PoseDetectorGraph` → rects → `MultiplePoseLandmarksDetectorGraph` (loop por ROI via `BeginLoopNormalizedRectCalculator`, `pose_landmarks_detector_graph.cc:697`). Com `pose_rects` **vazio**, o begin-loop itera zero vezes → o `SinglePoseLandmarksDetectorGraph` **nunca é invocado** — o caminho warp/crop 256², o interpreter do landmarker, `TensorsToLandmarks`, `RefineLandmarksFromHeatmap`, `ThresholdingCalculator` de presença, `LandmarksToDetection`→`AlignmentPointsRects`→`RectTransformation` (emissor do `POSE_RECT_NEXT_FRAME`) e os nós de smoothing não executam nenhuma vez.
- Consequência: um `detectForVideo` sobre `OffscreenCanvas` 1×1 (sugestão de `docs/auditoria-mediapipe.md:134`) aquece o grafo, a conversão de entrada e o **interpreter do detector** — mas deixa *intocados* os custos lazy do estágio landmarker, que incidiriam no primeiro frame **com pessoa**. Ou seja, o frame vazio não cobre a latência de primeira detecção — confirmado.
- Mitigação já presente: a mesma linha sugere "(ou no primeiro bitmap)" — o primeiro bitmap real da câmera tem pessoa e cobre os dois estágios (com a ressalva de que o spike ainda existe; só é antecipado para dentro da janela de init).
- Consistência com o dado: a primeira pose em ~frame 8 (`pesquisa-pipeline-cv.md:223`) é *plausível* como mistura de primeiro-detector + primeiro landmarker + aquisição de tracking — mas, conforme o achado 1, o harness não registra `firstPoseIndex`, e o valor coincide com `WARMUP = 8`; a hipótese "parte do ~8 é latência de primeira detecção" não pode ser confirmada nem refutada sem instrumentar o bench.

**Correção necessária em `auditoria-mediapipe.md:134`:** qualificar a sugestão — um frame **vazio** aquece apenas o estágio do detector; para cobrir também os custos lazy do landmarker (crop/warp + interpreter + presença + rect-para-próximo-frame), o warmup precisa ser num frame **com pessoa** (o próprio primeiro bitmap, como já sugerido em parêntese, ou uma imagem sintética que passe pelo detector). Conectar a observação à instrumentação do achado 1: `firstPoseIndex` no bench mediria de fato quantos frames a primeira detecção custa.

---

## Verificações baratas pedidas (fatos de suporte)

| Fato | Verificado em | Resultado |
|---|---|---|
| `FRAME` pós-fallback atinge landmarker real | `pose.worker.ts:32-46,74-86` | Sim — `landmarker` reatribuído por `createTask('CPU')`; caminho `detectForVideo` idêntico |
| `FALLBACK` precede `ERROR` não-fatal; bench resolve em `ERROR` | `pose.worker.ts:39,89-91`; `pose-bench.html:64,83-84` | Sim — `out.fellBack` já é setado; `delegate`/`requested` ficam 'GPU' |
| Relógio monotônico ms do `PoseClient` | `poseClient.ts:29,155-156` | `Math.max(now, lastTimestamp+0.01)`; `lastTimestamp` nunca resetado fora de construção/dispose |
| `stopCamera` preserva o worker/cliente | `App.tsx:76-90,115` | Sim — só `pauseCapture()` + `track.stop()`; `clientRef.current ??=` reutiliza; `dispose` só no unmount (`:43`) |
| `captureTime` = SHOULD, campo opcional | wicg.github.io/video-rvfc §2.2 | Confirmado literal; doc :183 e :253 já dizem SHOULD — só a :34 diz "DEVE" |
| `frame.timestamp` = PTS herdado, origem por fonte | webcodecs §9.4.2/9.4.6; mediacapture-extensions "Video timestamp concepts" | Confirmado — origem `source specific`, offset fixo por track |
| URL `mediapipe-assets/pose.jpg` | HEAD `storage.googleapis.com/mediapipe-assets/pose.jpg` | HTTP 200, 44 100 B — existe |
| `min_tracking_confidence` → `min_similarity_threshold` | upstream `pose_landmarker_graph.cc:376-379` | Confirmado — auditoria :155 correta |
| Gate de re-detecção = contagem de rects anteriores | upstream `pose_landmarker_graph.cc:353-371` (`DisallowIf`/`has_enough_poses`) | Confirmado — não é score vs. tracking confidence |
| Swing: divisão por largura do ombro antes da derivada | `swingDetector.ts:30-42`; `calibrator.ts:48` | Confirmado — unidades = larguras-de-ombro/s e larguras-de-ombro |

---

## Tabela resumo

| # | Local | Veredicto | Correção necessária |
|---|---|---|---|
| 1 | `pesquisa-pipeline-cv.md:223` / `pose-bench.html` | Confirmado | Script: registrar `firstPoseIndex` em `out` (2 linhas) |
| 2 | `pesquisa-pipeline-cv.md:210` / `pose-bench.html:2-5` | Parcialmente confirmado | Doc (e header do script): URL completa + passo `curl -o dist/pose.jpg` |
| 3 | `pose-bench.html:81` (worker `pose.worker.ts:87-93`) | Confirmado | Script: usar `fellBack` para separar `times` por delegate (atualizar `out.delegate` no FALLBACK) e/ou invalidar `perFrame`; warmup já aborta o run — documentar |
| 4 | `pesquisa-pipeline-cv.md:227` | Parcialmente confirmado | Reescrever caveat: GPU-real não medida; expectativa externa sem bound rígido (desktop citado excede o model card) |
| 5 | `pesquisa-pipeline-cv.md:63` | Confirmado | Qualificar: `frame.timestamp` é PTS real em µs, mas com origem por fonte (reinicia entre tracks); manter relógio ms do cliente p/ `timestampMs` ou rebasear por sessão |
| 6 | `pesquisa-pipeline-cv.md:189` (código `swingDetector.ts:30-42`) | Confirmado | Corrigir "m/s reais" → "larguras-de-ombro/s (adimensional)"; idem `auditoria-mediapipe.md:62` |
| 7 | `pesquisa-pipeline-cv.md:34` | Confirmado | "DEVE" → "SHOULD/deveria; ausente = `undefined`" (alinha com :183/:253) |
| 8 | `pesquisa-pipeline-cv.md:187` vs `auditoria-mediapipe.md:155` | Confirmado | Pesquisa: reescrever com semântica tasks (IoU de associação; re-detecção governada por `minPosePresenceConfidence`/contagem de rects; inerte com `numPoses=1`). Auditoria: correta; opcional nota de inércia |
| 9 | `auditoria-mediapipe.md:134` | Parcialmente confirmado | Qualificar: frame vazio só aquece o estágio do detector; warmup completo exige frame com pessoa ("primeiro bitmap" já cobre); ligar à instrumentação do achado 1 |

---

## Lista concreta de correções

### `docs/pesquisa-pipeline-cv.md`
1. **L34**: `DEVE estar presente` → `deveria (SHOULD) estar presente … campo opcional; vem \`undefined\` quando ausente` (spec video-rvfc §2.2; alinha com L183/L253).
2. **L63** (conclusão §2.2): qualificar `frame.timestamp` — PTS real em µs, origem **por fonte/track** (mediacapture-extensions): reinicia a cada novo `getUserMedia`; com o worker quente e `lastTimestamp` persistente (`poseClient.ts:29,155`), usar raw achataria os deltas após reabrir a câmera. Manter o relógio ms do `PoseClient` para `timestampMs`; `frame.timestamp` só com rebase por sessão ou como telemetria.
3. **L187** (item 5 da §6): trocar a semântica de `minTrackingConfidence` — é `min_similarity_threshold` (IoU) do `AssociationNormRectCalculator` (`pose_landmarker_graph.cc:376-379`), inerte com `numPoses=1`; a alavanca real de re-detecção é `minPosePresenceConfidence` (presença → `POSE_RECT_NEXT_FRAME` → `has_enough_poses` → `DisallowIf` do detector).
4. **L189** (item 7 da §6): "m/s reais" → velocidade em **larguras-de-ombro/s** (`swingDetector.ts:30-42`), consistente com `readyWristLocal`/`world.shoulderWidth`.
5. **L210** (§7.5 metodologia): adicionar passo de obtenção da foto — `curl -sL -o dist/pose.jpg https://storage.googleapis.com/mediapipe-assets/pose.jpg` — antes de `npm run preview`.
6. **L223** (leitura 3): condicionar a afirmação "~8 frames" à instrumentação (`firstPoseIndex`) ou rotulá-la como observação; notar que coincide com `WARMUP=8`.
7. **L227** (caveats): remover a delimitação "entre o CPU medido e o model card" — GPU-real não medida; âncoras externas (model card Pixel 3; 92–160 fps desktop em §5) sugerem comparável/mais rápida que CPU, sem bound do benchmark.

### `docs/auditoria-mediapipe.md`
8. **L62**: "velocidade 3D do punho — coordenadas métricas" → esclarecer que a velocidade é em larguras-de-ombro/s após normalização (`swingDetector.ts:30-34`).
9. **L134**: especificar que `OffscreenCanvas 1×1` aquece só o estágio do detector (landmarker nunca roda sem ROI — `BeginLoopNormalizedRectCalculator` itera zero vezes); para warmup completo, frame com pessoa (o "primeiro bitmap" já citado).
10. **L155** (opcional): acrescentar que, com `numPoses=1`, `min_tracking_confidence` é praticamente inerte (association só casa rects quando detector e rects anteriores coexistem — só com `numPoses>1`/tracking parcial).

### `scripts/pose-bench.html`
11. Registrar a primeira pose: `if (out.firstPoseIndex === undefined && res.type === 'POSE' && res.landmarks?.length) out.firstPoseIndex = i;` dentro do loop (`:72-95`), e documentar no header/`out`.
12. Fallback mid-run: no handler de `FALLBACK` (`:64`, `:84`), além de `out.fellBack = true`, atualizar `out.delegate = m.to` e separar/invalidar os timings — p.ex. `times` por delegate efetivo ou `perFrame` anotado com `mixed: true`/`invalid`. Nota: fallback no warmup já aborta o run (`:94`) — o misto só ocorre pós-warmup.
13. Header (`:2-5`): incluir a URL concreta da foto de exemplo (`https://storage.googleapis.com/mediapipe-assets/pose.jpg`) para reprodução idêntica da §7.5.

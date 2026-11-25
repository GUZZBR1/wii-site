# Revisão do PR — corridas de ciclo de vida no pipeline câmera/visão

Data: 24 de novembro de 2026 · Commit analisado: `3319e38` (branch `fix/cv-pipeline-bottlenecks`) · Escopo: `src/App.tsx`, `src/cv/poseClient.ts`, `src/cv/pose.worker.ts`, `src/cv/protocol.ts`, `src/ui/CameraPip.tsx` — ciclo de vida introduzido no commit `e5d9bf0` ("Split PoseClient lifecycle and slim the worker protocol").

---

## Contexto do design

A intenção declarada do PR é separar **ciclo de vida do landmarker** de **ciclo de vida da captura** (`e5d9bf0`, mensagem do commit): `init()` sobe o worker em paralelo ao `getUserMedia` (`src/App.tsx:104-108`), o worker fica quente entre desliga/liga de câmera (`stopCamera` chama só `pauseCapture`, `src/App.tsx:70-71`), e `dispose()` só roda em erro fatal ou desmontagem (`poseClient.ts:113-116`, `poseClient.ts:123-127`, `src/App.tsx:40`). O design em si é correto e resolve o gargalo #5 do `docs/analise-de-gargalos.md`. Os achados abaixo são **corridas nas bordas** desse novo ciclo de vida — não no design, mas na falta de um identificador de "tentativa" que invalide continuações atrasadas.

Esta revisão foi feita contra fontes primárias: o próprio código e, onde o comportamento externo importa, as especificações (W3C mediacapture, HTML Standard) e MDN — ver **Fontes** ao final.

## Resumo executivo

| # | Achado | Veredito | Gravidade |
|---|--------|----------|-----------|
| 1 | **Stream vazado**: erro de init (falta WASM/modelo ou timeout de 30 s) durante o prompt de permissão → `stopCamera` roda antes do stream existir → usuário clica "Permitir" → `getUserMedia` resolve tarde e o stream fica **preso ao `<video>` com tracks vivas (LED aceso), `cameraOn=true`, sem captura**. Dobras: 2º `getUserMedia` sobrescreve `streamRef` sem parar as tracks do 1º; cleanup de unmount não para tracks em nenhum caso. | **Confirmado** | Alta |
| 2 | Religar a câmera com worker quente não emite nenhum `onStatus` → PiP fica com **'Câmera desligada' enquanto TRACKING funciona**. | **Confirmado** | Média |
| 3 | `pauseCapture` zera `busy` com um FRAME ainda no worker → retomada posta 2º frame → invariante "um frame em trânsito" degrada (e piora a cada toggle); resposta POSE tardia executa `onPose` em câmera desligada (alimenta gate/detectores; pode escalar a eventos de jogo se várias respostas acumularem). | **Confirmado** | Média |
| A | Adjacentes: hang no `await loadeddata` se `srcObject` for zerado no meio; `worker.onerror` durante captura mata o worker quente (correto, mas `busy` precisa ser zerado no `dispose`); `init()` concorrente faz dedup correto; `visionReady` pode gerar `unhandledrejection` se `init()` rejeitar cedo. | Confirmados (variados) | Baixa–Média |

---

## Achado 1 — câmera ligada sem rastreamento quando o init falha com a permissão pendente

**Veredito: confirmado**, em todas as partes, inclusive o segundo clique (vazamento por sobrescrita) e o unmount (nenhum `track.stop()` no cleanup).

### O que é

`startCamera` dispara `client.init(callbacks)` **em paralelo** ao `await getUserMedia(...)` (`src/App.tsx:104-108`). O prompt de permissão pode ficar aberto por tempo arbitrário — o algoritmo do `getUserMedia` na spec trava se o usuário nunca responder: *"If the user never responds, this algorithm stalls on this step."* (w3c.github.io/mediacapture-main, passo 11.5.1 do método getUserMedia). Nesse intervalo, dois caminhos produzem `onStatus('error')` no cliente:

1. **ERROR fatal de init** (`pose.worker.ts:63`) — ex.: fetch do `.wasm`/`.task` falha → `worker.onmessage` ramo `ERROR` com `fatal: true` (`poseClient.ts:113-116`) → `onStatus('error', …)` → `onReady?.()` → `dispose()` (termina o worker, `ready=false`, `initPromise=undefined`, `poseClient.ts:87-97`).
2. **Timeout de 30 s do `spawn`** (`poseClient.ts:130-137`) — `Promise.race` vence sem `READY` → `onStatus('error', 'Inicialização do MediaPipe excedeu 30 segundos.')` → `dispose()`.

No App, o handler (`src/App.tsx:87-90`) faz `setCameraStatus(detail)` → `status === 'error'` → `setTracking('SEM POSE')` → **`stopCamera()`** → `setCameraStatus(detail)` de novo (a segunda escrita é deliberada e preserva a mensagem de erro sobre o `'Câmera desligada'` do `stopCamera`, `src/App.tsx:77`).

### A corrida, passo a passo

1. `stopCamera()` roda enquanto `getUserMedia` está pendente → `streamRef.current` ainda é `undefined` → `streamRef.current?.getTracks()` (`src/App.tsx:72`) **não para nada**; `video.srcObject = null`, `setCameraOn(false)`.
2. Usuário clica "Permitir" → `getUserMedia` resolve com um `MediaStream` vivo → `streamRef.current = stream` (`src/App.tsx:109`) → `video.srcObject = stream` (`src/App.tsx:112`) → `await video.play()` → `loadeddata` → `setCameraOn(true)` (`src/App.tsx:118`).
3. `await visionReady` (`src/App.tsx:119`) já resolveu (o `onReady` foi chamado no caminho de erro) → `if (!client.isReady || streamRef.current !== stream) return;` (`src/App.tsx:120`) → `client.isReady === false` (dispose zerou `ready`) → **return silencioso**.

### Estado final exato da UI

- `cameraOn === true` → `CameraPip` renderiza o `<video>` ao vivo, o chip de tracking `'SEM POSE'` (`src/ui/CameraPip.tsx:26`) e a barra com `⏻`, seletor L/R e `CALIBRAR` desabilitado (`src/ui/CameraPip.tsx:29-37`) — **não** o botão ATIVAR.
- Linha de status (`src/ui/CameraPip.tsx:40`): a **mensagem de erro do init** (ex.: `GPU falhou (…); fallback CPU também falhou (…).`) — a segunda `setCameraStatus(detail)` de `src/App.tsx:89` vence o `'Câmera desligada'`.
- **Tracks vivas e LED da webcam acesa** — o stream está anexado e alimentando o `<video>`; só nada consome os frames porque `beginCapture` nunca rodou e o worker foi terminado.
- Vazamento só é resolvido quando o usuário aperta `⏻` (aí `stopCamera` para as tracks de `streamRef`) — ou nunca, se ele apenas sair da página pensando que "a câmera falhou".

Base normativa: um `MediaStreamTrack` de câmera só solta o dispositivo quando **todos** os tracks daquela fonte param/terminam — *"A source that is notified of a track ending will be stopped, unless other MediaStreamTrack objects depend on it."* (w3c.github.io/mediacapture-main, método `stop()`), e a spec incentiva explicitamente `stop()` porque o recurso é caro e afeta os indicadores de privacidade (seção "Garbage Collection" de MediaStreamTrack).

### Dobra 1 — segundo clique em ATIVAR / clique duplo

Dois cenários, ambos confirmados:

- **Depois do estado vazado**, o botão visível é `⏻`, não ATIVAR — o usuário precisa parar antes (e aí `stopCamera` limpa o stream vazado). Mas o caso real de sobrescrita existe:
- **Clique duplo em ATIVAR durante o start** — `cameraOn` só vira `true` na linha 118, perto do fim; durante todo o `getUserMedia` o botão ATIVAR continua na tela e clicável (`src/ui/CameraPip.tsx:29`). Duas invocações concorrentes de `startCamera` fazem dois `getUserMedia` — e cada chamada cria **um novo `MediaStreamTrack` sobre a mesma fonte** (w3c.github.io/mediacapture-main: *"Several MediaStreamTrack objects can represent the same media source, e.g., when the user chooses the same camera in the UI shown by two consecutive calls to getUserMedia()."*). A tentativa que resolver por último executa `streamRef.current = stream2` (`src/App.tsx:109`) **sem parar as tracks de `stream1`** — que ficam inalcançáveis. Como a fonte só para quando todos os tracks terminam, a **LED da webcam permanece acesa mesmo depois de `⏻`** (que só para `stream2`). A única guarda anti-corrida existente hoje, `streamRef.current !== stream` (`src/App.tsx:120`), faz a tentativa perdedora dar `return` — mas não para os tracks dela.
- **`init()` concorrente em si é seguro**: `initPromise ??=` faz dedup (`poseClient.ts:46`) e `this.callbacks = callbacks` (`poseClient.ts:44`) é atribuído antes de qualquer early-return, então o **último** chamador é quem recebe `READY`/erros — correto, porque a última tentativa é a corrente.

### Dobra 2 — unmount no meio do `getUserMedia`

O cleanup do efeito de montagem é `return () => { clientRef.current?.dispose(); };` (`src/App.tsx:40`) — **não toca em `streamRef` em hipótese alguma**, nem para uma câmera totalmente ligada, nem para o caso da resolução tardia: se o componente desmonta com o prompt pendente e o usuário depois permite, `streamRef.current = stream` roda em componente morto, `setCameraOn(true)` dispara estado em componente desmontado e o stream vaza até a navegação da página. Verificado: nenhuma linha do arquivo para tracks fora de `stopCamera` (`src/App.tsx:72`).

### Causa-raiz

`startCamera` não tem noção de "a tentativa já morreu" **entre** o `await getUserMedia` e o `streamRef.current = stream`. Todas as condições de aborto existentes (`streamRef.current !== stream`, `!client.isReady`) só são testadas **depois** de o stream já ter sido anexado ao `<video>` e `setCameraOn(true)` já ter rodado — e nenhuma delas para os tracks no caminho de saída. `stopCamera` só sabe parar `streamRef.current`, o que é estruturalmente incapaz de pegar um stream que ainda não foi atribuído.

### Correção proposta — contador de tentativa (attempt generation)

Tratar **init + permissão + attach como uma única tentativa**: um `attemptRef` incrementado por `stopCamera` e pelo cleanup de unmount; `startCamera` captura o id no início e revalida após cada `await` — incluindo **antes** de `streamRef.current = stream`. Pseudo-diff:

```ts
const attemptRef = useRef(0);

// efeito de montagem — cleanup também para tracks e invalida tentativas em voo
return () => {
  attemptRef.current += 1;
  clientRef.current?.dispose();
  streamRef.current?.getTracks().forEach((t) => { t.stop(); });
  streamRef.current = undefined;
};

const stopCamera = useCallback(() => {
  attemptRef.current += 1;                 // invalida qualquer startCamera em voo
  clientRef.current?.pauseCapture();
  streamRef.current?.getTracks().forEach((t) => { t.stop(); });
  streamRef.current = undefined;
  /* ...restante inalterado... */
}, []);

const startCamera = useCallback(async () => {
  stopCamera();                            // cancela tentativa anterior + tracks pendentes
  const attempt = ++attemptRef.current;
  const isStale = () => attemptRef.current !== attempt;
  const callbacks: PoseClientCallbacks = {
    onStatus: (status, detail) => {
      if (isStale()) return;               // status de tentativa morta não pisa na UI
      setCameraStatus(detail);
      if (status === 'error') { setTracking('SEM POSE'); stopCamera(); setCameraStatus(detail); }
    },
    onPose: (raw) => { if (isStale()) return; /* inalterado */ },
  };
  try {
    await audioRef.current.unlock();
    if (isStale()) return;
    clientRef.current ??= new PoseClient();
    const client = clientRef.current;
    const visionReady = client.init(callbacks);
    const stream = await navigator.mediaDevices.getUserMedia({ /* inalterado */ });
    if (isStale()) {                       // erro/stop chegou durante o prompt
      stream.getTracks().forEach((t) => { t.stop(); });
      return;
    }
    streamRef.current = stream;
    /* video.srcObject = stream; await video.play(); */
    if (isStale()) return;
    await new Promise<void>((resolve) => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) resolve();
      else {
        video.addEventListener('loadeddata', () => resolve(), { once: true });
        video.addEventListener('emptied', () => resolve(), { once: true }); // ver achado A
      }
    });
    if (isStale()) return;
    setCameraOn(true);
    await visionReady;
    if (!client.isReady || isStale() || streamRef.current !== stream) return;
    client.beginCapture(video, callbacks);
  } catch (error) {
    if (isStale()) return;                 // ex.: AbortError de play() interrompido por stop
    stopCamera();
    setCameraStatus(error instanceof Error ? error.message : 'Não foi possível iniciar a câmera.');
  }
}, [stopCamera, dispatchEvent]);
```

Observações de desenho:

- **Incrementar no `stopCamera` e no unmount** é o que torna `isStale()` verdadeiro exatamente nos cenários do bug — todo caminho fatal de init passa por `onStatus('error')` → `stopCamera` → `attemptRef++`, então qualquer continuação tardia de `getUserMedia`/`play()`/`visionReady` é detectada.
- **`stopCamera()` no topo do `startCamera`** resolve a dobra do clique duplo: para `streamRef` pendente, para tracks de uma tentativa anterior já anexada e reseta pipeline/calibrador — tudo o que a nova tentativa precisa de qualquer forma. Custo: um flash de `'Câmera desligada'` antes de `'Carregando…'`; se incomodar, extrair só a parte de tracks em vez do `stopCamera` completo.
- **`if (isStale()) return` no `catch`** evita que um `AbortError` — inevitável quando `stopCamera` zera `video.srcObject` durante `await video.play()` (ver achado A) — sobrescreva a mensagem de erro original com *"The play() request was interrupted…"*.
- **Por que não `AbortSignal`?** `getUserMedia` não aceita sinal de cancelamento (a API não tem parâmetro para isso na spec), então o contador é necessário de qualquer forma — e ele também decide o que fazer com o stream **já resolvido** (parar os tracks), coisa que um abort não faria.
- **Preservação do status de erro:** confirmada — `src/App.tsx:89` já re-escreve `setCameraStatus(detail)` depois de `stopCamera()`; com o gate `isStale`, erros de tentativas mortas nem chegam à UI. Os outros efeitos de `stopCamera` mid-attempt (`pauseCapture`, `pipeline.reset()`, `calibrator.reset()`, `drawPose` sem snapshot) são inócuos ou desejáveis.

### Casos de borda cobertos pelo desenho

- Erro **antes** de `getUserMedia` resolver → stream novo é parado no `isStale()` pós-await; LED nem chega a acender de forma permanente.
- Erro **depois** de `streamRef` atribuído → `stopCamera` já para os tracks; os checks `isStale()` subsequentes abortam antes de `setCameraOn(true)`/`beginCapture`.
- ATIVAR duas vezes rápido → a 2ª chamada invalida a 1ª; a 1ª para seu próprio stream ao resolver e sai cedo.
- Unmount mid-flight → cleanup incrementa o contador e para `streamRef`; resolução tardia para os tracks novos e retorna antes de mexer no `<video>`/estado.
- Timeout de 30 s **depois** de o usuário já ter desligado manualmente → callbacks da tentativa morta são descartados pelo gate `isStale` → status fica `'Câmera desligada'` (o `dispose()` interno do cliente ainda roda — correto, o worker travado não deve ficar quente).
- `READY` tardio com câmera desligada (init completou após o stop) → `onStatus('ready')` filtrado pelo gate → não sobrescreve `'Câmera desligada'`.

### Verificação

Sem cobertura automatizada no caminho de câmera (AGENTS.md). Repro manual: `npm run dev` → DevTools → Network → *Request blocking* para `**/mediapipe/models/*.task` (ou `*.wasm`) → ATIVAR CÂMERA → **não responder** ao prompt de permissão por alguns segundos (o init falha rápido por fetch) → clicar "Permitir" → hoje: LED acesa + vídeo vivo + 'SEM POSE' + erro no status + nunca rastreia; com a correção: LED apaga imediatamente ao permitir e o status permanece com a mensagem de erro, `cameraOn` continua `false`.

---

## Achado 2 — status preso em 'Câmera desligada' ao religar com worker quente

**Veredito: confirmado.**

### O que é

Segunda ativação com worker quente: `init(callbacks)` faz `this.callbacks = callbacks; if (this.ready) return;` (`poseClient.ts:44-45`) — retorna imediatamente, **sem** reemitir `onStatus('loading')` nem `onStatus('ready')` (o `spawn` inteiro é pulado — a mensagem `READY` só existe uma vez por worker, `poseClient.ts:107-110`). O fluxo continua: `getUserMedia` (permissão já concedida), `play()`, `loadeddata`, `setCameraOn(true)`, `await visionReady` (resolvido), `beginCapture(video, callbacks)` (`src/App.tsx:121`) — e `beginCapture` **não emite `onStatus` em nenhum caminho** (`poseClient.ts:50-75`). Resultado: a última escrita em `cameraStatus` foi o `'Câmera desligada'` do `stopCamera` (`src/App.tsx:77`) e ela permanece na linha de status do PiP enquanto o chip vai a `TRACKING` — UI inconsistente: vídeo ao vivo, poses fluindo, status dizendo que a câmera está desligada.

### Correção proposta

A revisão sugere `setCameraStatus('MediaPipe pronto · capturando')` antes de `beginCapture` — funciona, mas **perde o delegate** (`GPU`/`CPU`) que o label do `READY` carrega (`poseClient.ts:110`). Melhor: emitir o status de dentro do `beginCapture`, que é o único lugar que sabe que a captura realmente começou (os early-returns de `poseClient.ts:52` significam "não começou"):

```ts
private delegate: Delegate = 'GPU';

// spawn — READY (poseClient.ts:107-110):
this.ready = true;
this.delegate = message.delegate;                       // NOVO
this.onReady?.();
this.callbacks?.onStatus('ready', `MediaPipe pronto · ${message.delegate}`);

// spawn — FALLBACK (poseClient.ts:111-112): manter o label correto pós-fallback
this.delegate = message.to;                             // NOVO
this.callbacks?.onStatus('fallback', 'GPU indisponível; usando CPU.');

// beginCapture — depois de this.capturing = true:
this.callbacks?.onStatus('ready', `MediaPipe pronto · ${this.delegate} · capturando`);
```

Isso mantém **todas** as transições de status de visão dentro do `PoseClient` (um único ponto de emissão, consistente com `loading`/`ready`/`fallback`/`error`) e funciona tanto no primeiro start quanto em religamentos. Alternativa menor: expor `get delegate()` e compor o label no App — mais acoplamento por menos ganho.

### Ordenação de `onStatus('ready')` tardio

Pergunta da revisão: um `READY` chegando **depois** de um stop está corretamente ordenado? Hoje: init ainda em voo → usuário desliga → init completa → `READY` → `onStatus('ready', 'MediaPipe pronto · GPU')` (`poseClient.ts:110`) sobrescreve `'Câmera desligada'` → PiP mostra SEM SINAL + "MediaPipe pronto". Não quebra nada (o worker quente é intencional), mas é cosmético-inconsistente; o gate `isStale` do achado 1 resolve de graça — READY de tentativa morta é descartado e o próximo ATIVAR mostra `'… · capturando'` via `beginCapture`.

---

## Achado 3 — `pauseCapture` quebra "um frame em trânsito" e entrega pose em câmera desligada

**Veredito: confirmado**, com um agravante a mais que a revisão não explicitou: o excesso de frames em trânsito **se acumula a cada ciclo pausa/retomada**, não é só transitório.

### O que é

`pauseCapture` (`poseClient.ts:77-85`) faz `this.busy = false` (linha 84) enquanto o worker pode ainda estar processando o último `FRAME` postado (`poseClient.ts:148`). Na retomada, `capture()` vê `busy === false` e posta um **segundo** frame. Quando a resposta do primeiro chega, `this.busy = false` (`poseClient.ts:118`) de novo — agora com o segundo ainda em voo → na prática o invariante "um frame em trânsito" passa a admitir **dois** permanentemente após um toggle. E piora: cada `pauseCapture` no meio de N frames em voo adiciona +1 ao teto do próximo ciclo — a dívida de latência (um frame velho enfileirado atrás do atual) cresce a cada desliga/liga.

Segunda metade: uma resposta `POSE` aterrissando durante a pausa executa `this.callbacks?.onPose(...)` incondicionalmente (`poseClient.ts:117-121`) → no App isso roda `pipeline.update`, `setTracking`, `drawPose` e o loop de eventos `dispatchEvent` (`src/App.tsx:91-98`) que dispara `engine.onAction` e **sons** (`audioRef.hit/jump/step`, `src/App.tsx:65-67`) — com a câmera desligada.

**Quão nocivo é hoje, na prática:** `stopCamera` roda `pipelineRef.current.reset()` (`src/App.tsx:78`), o `TrackingGate` precisa de 3 frames bons consecutivos para `tracked` (`src/kinematics/trackingGate.ts:13-17`) e `ActionPipeline.update` só emite eventos com `tracked` + calibração — então **uma** resposta tardia isolada chega a `'degraded'`: nenhum evento/som, só `setTracking` invisível (o chip nem renderiza com `cameraOn=false`, `src/ui/CameraPip.tsx:26`), `drawPose` invisível, e **poluição do estado do gate** que vaza para a sessão seguinte (o próximo start não reseta o pipeline — um frame velho conta como "frame bom" da nova sessão). O cenário de eventos/som de verdade exige ≥3 respostas tardias acumuladas — possível justamente por causa da degradação do invariante. Ou seja: o dano direto hoje é limitado, mas a combinação das duas metades torna o dano real cumulativo. **Drop é o comportamento correto; entregar é errado** — uma pose de frame capturado antes do stop não deve dirigir jogo nem overlay.

Garantia de que a resposta sempre chega (para `busy` não travar): o worker responde **exatamente uma vez** por `FRAME` — `!landmarker` → `bitmap.close()` + `ERROR` (`pose.worker.ts:75-78`); `try` → `POSE` (`pose.worker.ts:82-86`); `catch` → `ERROR` fatal ou não (`pose.worker.ts:87-94`); `finally` → `bitmap.close()` (`pose.worker.ts:95-97`). Exceção: `worker.terminate()` — a spec esvazia a fila de mensagens da porta ("*empty the port message queue of the port that the worker's implicit port is entangled with*", html.spec.whatwg.org/multipage/workers.html#terminate-a-worker), então uma resposta postada e não entregue **morre** — mas nesse caso o cliente também está morto; por isso o reset correto é no `dispose` (abaixo).

### Correção proposta

```ts
pauseCapture(): void {
  this.capturing = false;
  if (this.callbackId !== undefined) this.video?.cancelVideoFrameCallback?.(this.callbackId);
  this.callbackId = undefined;
  if (this.rafId !== undefined) cancelAnimationFrame(this.rafId);
  this.rafId = undefined;
  this.video = undefined;
  // NÃO zerar busy: o worker ainda pode estar processando um FRAME;
  // a resposta (POSE ou ERROR) é quem zera — invariante "um em trânsito" preservado.
}

// POSE handler (poseClient.ts:117-121):
} else if (message.type === 'POSE') {
  this.busy = false;                       // sempre: sinaliza que o worker terminou o frame
  if (!this.capturing) return;             // NOVO: descarta pose de câmera já parada
  const { type: _type, ...data } = message;
  this.callbacks?.onPose({ /* inalterado */ });
}

// dispose (poseClient.ts:87-97): ADICIONAR
this.busy = false;                         // worker terminado: resposta nunca chega (terminate esvazia a fila)
```

Notas de desenho:

- **`busy=false` tem que sair de `pauseCapture` e ir para `dispose`** — não é opcional: o mesmo `PoseClient` é reutilizado (`clientRef.current ??=`, `src/App.tsx:102`) após `dispose` (que zera `initPromise`, permitindo re-spawn). Se `busy` ficar `true` num dispose durante captura, o próximo `beginCapture`→`capture()` sai cedo em `if (this.busy) return` (`poseClient.ts:141`) e **nunca mais envia frame** — trava silenciosa de tracking.
- `beginCapture` **não deve** zerar `busy` — é o mesmo bug do `pauseCapture` sob outro nome (a resposta pendente zeraria depois, reabrindo a janela de 2-em-voo).
- Timestamps continuam monotônicos mesmo com frames extra em voo — vêm do `now` crescente do rVFC e o `Math.max(now, lastTimestamp + 0.01)` (`poseClient.ts:143-144`) garante monotonicidade estrita, exigida pelo modo `VIDEO` do MediaPipe (ai.google.dev/mediapipe/solutions/vision/pose_landmarker/web_js: "monotonic timestamps"). Ou seja: o bug degrada latência/throughput, não causa exceção — por isso passou despercebido.
- **Hardening opcional:** se quiser também descartar pose de uma **sessão anterior** (pausa → retomada rápida: a resposta antiga chega com `capturing === true`), guardar `this.busyEpoch` ao postar o FRAME e incrementar um `captureEpoch` no `pauseCapture`; no handler, comparar. Hoje essa pose velha só adiciona um frame com `dt` estranho aos detectores — aceitável.

### Casos de borda

- Pausa durante `await createImageBitmap` (`poseClient.ts:146-147`): o check `!this.capturing` já fecha o bitmap e zera `busy` — correto, nada foi postado; sem mudança.
- Pausa → retomada antes da resposta: com o fix, `capture()` pula frames enquanto `busy` estiver `true`; quando a resposta chega, `busy` limpa e o próximo rVFC envia — exatamente um em voo o tempo todo.
- `ERROR` não-fatal durante pausa → `busy=false` (correto, é a resposta do frame) + `onStatus('fallback')` — status cosmético em câmera desligada; worker sobrevive para a próxima sessão.
- `worker.onerror` → `dispose` → com o fix, `busy` zera no dispose; sem ele, deadlock silencioso na reativação.

### Verificação

- **Unit-testável** (ver seção seguinte): com `Worker`/`createImageBitmap`/rVFC falsos, dá para asserir em Vitest que após `pauseCapture`+`beginCapture` existe **no máximo 1 FRAME sem resposta** e que `onPose` não é chamado para respostas durante pausa.
- Manual: ligar tracking → alternar ⏻/ATIVAR várias vezes rápido → contar `FRAME` vs `POSE`/`ERROR` no `onmessage` (um `console.debug` temporário basta); antes do fix, o delta cresce a cada ciclo.

---

## Achados adjacentes

1. **Unmount não para tracks** — já coberto no achado 1 (dobra 2): `src/App.tsx:40` precisa parar `streamRef` no cleanup, não apenas `dispose()` do cliente.
2. **Hang no `await loadeddata`** (`src/App.tsx:114-117`): se `stopCamera` roda durante a espera, `video.srcObject = null` invoca o *media element load algorithm* (srcObject setter → "Invoke this's media element load algorithm", html.spec.whatwg.org/multipage/media.html), que dispara `emptied` e zera `readyState` → `loadeddata` nunca mais dispara → `startCamera` fica pendurado para sempre (sem vazamento de tracks — `stopCamera` já as parou — mas a função nunca termina). O patch do achado 1 adiciona um listener `emptied` ao lado do `loadeddata`, coberto. Em paralelo: `await video.play()` **não** trava nessa janela — o algoritmo de load resolve/rejeita pending play promises imediatamente ("reject pending play promises with AbortError"), o que no Chrome vira o `AbortError` "The play() request was interrupted by a new load request" — daí a importância do `if (isStale()) return` no `catch`.
3. **`worker.onerror` durante captura** (`poseClient.ts:123-127`): status `error` + `dispose` — mata o worker quente e desliga a câmera. Comportamento coerente com "dispose só em fatal" (um erro de script no worker é fatal para aquela instância), mas reforça a necessidade do `busy=false` dentro de `dispose`.
4. **`init()` concorrente**: dedup correto via `initPromise ??=` e callbacks do último chamador vencem — combinado com o contador de tentativa, fica totalmente correto.
5. **`unhandledrejection` potencial**: `const visionReady = client.init(callbacks)` (`src/App.tsx:104`) só é aguardado na linha 119 — se `init()` rejeitar cedo (ex.: `new Worker` lançar `SecurityError`), a janela entre as duas linhas pode gerar `Uncaught (in promise)` no console. Mitigação barata: `const visionReady = client.init(callbacks); visionReady.catch(() => {});` ou aguardar via `Promise.all([visionReady, getUserMedia...])` — opcional.
6. **`stopCamera` dentro de `onStatus('error')`**: `pipeline.reset()`, `calibrator.reset()`, `drawPose` — inócuos mid-attempt (reset desejável de qualquer forma); `'Câmera desligada'` não clobbera o erro porque `src/App.tsx:89` re-escreve `detail` depois — verificado.

---

## O que é testável neste repo

O `npm test` roda Vitest em **ambiente node** (`vite.config.ts`, `test.environment: 'node'`, `include: tests/**/*.test.ts`) e o AGENTS.md explicita que o caminho de worker/câmera não tem cobertura automatizada — verificação manual via `npm run dev` → ATIVAR CÂMERA → TRACKING.

**Unit-testável em node puro** (proposta: `tests/poseClient.test.ts` + stubs de globais):

- `vi.stubGlobal('Worker', FakeWorker)` — classe falsa que grava `postMessage` e expõe `emit(reply)` para injetar `READY`/`POSE`/`ERROR`/`FALLBACK` sob demanda;
- `vi.stubGlobal('createImageBitmap', async () => ({ close: vi.fn() }))`, `requestAnimationFrame`/`cancelAnimationFrame` falsos, `vi.stubGlobal('window', { setTimeout })`, `vi.stubGlobal('location', { origin: 'http://localhost' })` (`mediapipeAssetUrls` usa `location.origin`, `poseClient.ts:11-16`); `import.meta.env.BASE_URL` vem do transform do Vitest (Vite) — `'/'` por `base: '/'`;
- vídeo falso `{ readyState: 4, requestVideoFrameCallback: (cb) => id, cancelVideoFrameCallback: vi.fn() }`.

Com isso dá para cobrir **deterministicamente**: dedup de `init()` (duas chamadas → um `Worker` construído, ambas resolvem), invariante de um-em-trânsito após `pauseCapture`+`beginCapture`, drop de `POSE` com `!capturing`, `busy=false` garantido por `dispose`, timeout de 30 s com `vi.useFakeTimers()`, e o `delegate` exposto/emítido após `READY`/`FALLBACK`. Não cobre: comportamento real de `getUserMedia`, rVFC real, `MediaStreamTrack` — esses ficam para a verificação manual descrita em cada achado. Alternativa com dependência nova: `happy-dom`/`jsdom` + `@testing-library/react` para o `App` — provavelmente desproporcional para este projeto.

---

## Fontes

**Código (path:linha):**

- `src/App.tsx:36-41` — efeito de montagem: `warmVisionAssets` + cleanup só com `dispose()`.
- `src/App.tsx:70-83` — `stopCamera`: `pauseCapture` (71), `getTracks().stop()` (72), `srcObject = null` (74), `'Câmera desligada'` (77), resets (78-82).
- `src/App.tsx:85-126` — `startCamera`: callbacks (86-99, erro em 89), `init` paralelo (104), `getUserMedia` (105-108), `streamRef` (109), `srcObject`/`play`/`loadeddata` (112-117), `setCameraOn` (118), `await visionReady` + bail (119-120), `beginCapture` (121), `catch` (122-125).
- `src/cv/poseClient.ts:43-48` — `init`/`initPromise` dedup; `50-75` — `beginCapture` (sem `onStatus`); `77-85` — `pauseCapture` (`busy=false` na 84); `87-97` — `dispose`; `99-138` — `spawn` (`READY` 107-110, `FALLBACK` 111-112, `ERROR` 113-116, `POSE` 117-121, `onerror` 123-127, race/timeout 130-137); `140-153` — `capture`.
- `src/cv/pose.worker.ts:48-66` — `INIT`→`READY`/`ERROR`; `68-72` — `DISPOSE`; `74-98` — `FRAME`→`POSE`/`ERROR` + `bitmap.close()` no `finally`.
- `src/cv/protocol.ts:49-60` — `WorkerRequest`/`WorkerReply`.
- `src/ui/CameraPip.tsx:25-40` — SEM SINAL (25), chip de tracking (26), ATIVAR vs controles (29-39), linha de status (40).
- `src/kinematics/trackingGate.ts:13-27` — 3 frames bons → `tracked`, 4 ruins → `lost`, `reset()`.
- `src/kinematics/actionPipeline.ts` — eventos só com `tracked` + calibração.
- `src/App.tsx:63-68` — `dispatchEvent` → `engine.onAction` + `audio.hit/jump/step`.

**Especificações/docs (URL):**

- https://w3c.github.io/mediacapture-main/#dom-mediadevices-getusermedia — algoritmo getUserMedia: *"If the user never responds, this algorithm stalls on this step."* (permissão pendente indefinida); criação de novo `MediaStreamTrack` por chamada (passo 9.5).
- https://w3c.github.io/mediacapture-main/#mediastreamtrack — *"Several MediaStreamTrack objects can represent the same media source, e.g., when the user chooses the same camera in the UI shown by two consecutive calls to getUserMedia()."*
- https://w3c.github.io/mediacapture-main/#dom-mediastreamtrack-stop — `stop()`: *"A source that is notified of a track ending will be stopped, unless other MediaStreamTrack objects depend on it."*
- https://w3c.github.io/mediacapture-main/#life-cycle-and-media-flow — *"Authors are encouraged to call stop() on MediaStreamTrack, especially capture tracks since the underlying resource are costly and it can have effects on the privacy indicators presented to the user."* (GC de track ≠ `stop()` garantido).
- https://html.spec.whatwg.org/multipage/workers.html#terminate-a-worker — terminate: descarta tasks enfileiradas e *"empty the port message queue of the port that the worker's implicit port is entangled with"* (resposta em trânsito morre).
- https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate — *"the worker is terminated immediately without any chance to complete its ongoing operations."*
- https://html.spec.whatwg.org/multipage/media.html — setter de `srcObject` → *"Invoke this's media element load algorithm"*; load algorithm: pending play promises resolvidas/rejeitadas imediatamente (AbortError) e evento `emptied` quando o provider é removido; `loadeddata` só dispara quando `readyState` atinge `HAVE_CURRENT_DATA` pela 1ª vez após cada load.
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play — `play()` retorna Promise rejeitada em falha de reprodução.
- https://ai.google.dev/mediapipe/solutions/vision/pose_landmarker/web_js — modo `VIDEO`: *"Synchronous tracking across decoded video frames with monotonic timestamps."*

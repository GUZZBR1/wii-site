# Plano de Implementação — Controle por Mão nos Menus (estilo Wii)

Documento consolidado a partir das 3 baterias de pesquisa sobre o repositório e o pacote `@mediapipe/tasks-vision@1.2.3`.

---

## 1. Diagnóstico do Estado Atual

- **SPA única**: não existe rota `/app` separada. [src/App.tsx](file:///home/gusta/wii/src/App.tsx) alterna entre `<Intro />`, `<WiiMenu />` (`channels` → `title` → `sports`) e `<GameCanvas />` (`track` / `tennis`).
- **HUD e câmera**: [src/ui/CameraPip.tsx](file:///home/gusta/wii/src/ui/CameraPip.tsx) fica oculto nos menus enquanto a câmera está desligada (`hidden={!playing && !cameraOn}`).
- **Worker e assets**: [src/cv/poseClient.ts](file:///home/gusta/wii/src/cv/poseClient.ts) e [src/cv/pose.worker.ts](file:///home/gusta/wii/src/cv/pose.worker.ts) usam `@mediapipe/tasks-vision@1.2.3` (`vision_wasm_module_internal.{js,wasm}`), que já exporta `HandLandmarker` e `GestureRecognizer` além de `PoseLandmarker`.
- **Utilitários existentes**: [src/cv/oneEuroFilter.ts](file:///home/gusta/wii/src/cv/oneEuroFilter.ts) (`OneEuroFilter`) e [src/kinematics/schmittTrigger.ts](file:///home/gusta/wii/src/kinematics/schmittTrigger.ts) (`SchmittTrigger` com histerese e cooldown).
- **Decisão de modelo**: usar `HandLandmarker` (`hand_landmarker.task`, ~7,5–7,8 MB), alternando no mesmo worker entre `mode: 'hand'` (menus) e `mode: 'pose'` (jogos), fechando a task anterior com `.close()` para não rodar os dois modelos simultaneamente.

---

## 2. Fase 1 — Pipeline CV e Detector Puro de Mão (`cv/` e `kinematics/`)

### 2.1 Assets e Worker Dual-Mode (`src/cv/`)
1. **Modelo local**:
   - Adicionar `hand_landmarker.<sha8>.task` em `public/mediapipe/models/`.
   - Atualizar `public/mediapipe/models/SHA256SUMS`, [src/cv/mediapipeAssets.ts](file:///home/gusta/wii/src/cv/mediapipeAssets.ts) (`HAND_MODEL_SHA8`) e [scripts/copy-mediapipe-wasm.mjs](file:///home/gusta/wii/scripts/copy-mediapipe-wasm.mjs) para validar os dois `.task` no `predev` e `prebuild`.
2. **Protocolo** ([src/cv/protocol.ts](file:///home/gusta/wii/src/cv/protocol.ts)):
   - Definir `VisionMode = 'pose' | 'hand'`.
   - Adicionar `SET_MODE` em `WorkerRequest` (`{ type: 'SET_MODE'; mode: VisionMode; modelUrl: string }`) e `HAND` em `WorkerReply` (`{ type: 'HAND'; requestId; captureEpoch; timestampMs; landmarks: Point3[]; handedness?: 'Left' | 'Right' }`).
3. **Worker** ([src/cv/pose.worker.ts](file:///home/gusta/wii/src/cv/pose.worker.ts)) e **Client** ([src/cv/poseClient.ts](file:///home/gusta/wii/src/cv/poseClient.ts)):
   - Suportar troca de task (`PoseLandmarker` ↔ `HandLandmarker`) no mesmo worker, reaproveitando o `FilesetResolver` e mantendo o fallback `GPU` → `CPU`.
   - Expor `setMode(mode)` e callback `onHand` no `PoseClient`, preservando `captureEpoch` e o limite de 1 frame em trânsito (`inFlight`).
   - Aquecer/baixar `hand_landmarker.<sha8>.task` sob demanda ao abrir a aba da câmera nos menus.

### 2.2 Detector Puro, Sincronização e Gestos (`src/kinematics/handCursor.ts`)
Módulo puro (sem DOM/Three.js) para manter testabilidade em Vitest:
1. **Espelhamento**: inverter coordenada X (`1 - x`) para alinhamento natural com o movimento da mão.
2. **Sincronização rápida da mão (~0,8–1,2 s)**:
   - Exigir mão presente e estável; calcular uma zona ativa confortável (sub-retângulo mapeado para `0..1` da tela) para o usuário não precisar esticar o braço até as bordas da webcam.
3. **Suavização do ponteiro**:
   - `OneEuroFilter` em X e Y sobre o indicador (`#8`, com opção de âncora entre `#5` e `#8` para reduzir tremor durante a pinça).
4. **Clique (Pinça)**:
   - Razão normalizada `dist(#4, #8) / dist(#0, #9)` filtrada por `SchmittTrigger` (histerese + cooldown ~250 ms) para evitar clique duplo.
   - Congelar brevemente a posição do cursor ao iniciar a pinça para o ponteiro não escapar do botão.
5. **Voltar / Fechar**:
   - Detecção geométrica de punho fechado (ou palma aberta, conforme escolha final) sustentada por ~450–600 ms contínuos, emitindo progresso `0..1` para feedback visual antes de disparar.

---

## 3. Fase 2 — Troca de HUD, Cursor Wii, Transição e Testes (`ui/`, `App.tsx`, `tests/`)

### 3.1 Botão no HUD e Aba de Câmera nos Menus
1. **Botão `"CÂMERA"`** no `.hud-dock` ([src/App.tsx](file:///home/gusta/wii/src/App.tsx)) ou `.wii-bar` ([src/ui/WiiMenu.tsx](file:///home/gusta/wii/src/ui/WiiMenu.tsx)) quando `!playing`.
2. **Troca do HUD**: ao clicar em `"CÂMERA"`, substituir o HUD padrão por uma aba compacta de controle por mão contendo:
   - Botão `"Ligar câmera"` (aciona `getUserMedia` no clique).
   - Mini-prévia + status de sincronização (`"Mostre a mão para sincronizar…"` → `"Mão sincronizada ✓"`).
   - Legenda curta dos gestos (`Pinça = clicar`, `Fechar/Voltar`) e botão para desligar.

### 3.2 Cursor Estilo Wii e Hit-Testing no DOM (`src/ui/HandCursor.tsx`)
1. Overlay `pointer-events: none` no topo da viewport com ícone de mão estilo Wii, anel de progresso (sincronização e gesto de fechar/voltar) e feedback visual na pinça.
2. Hit-testing via `document.elementsFromPoint(px, py)` buscando o ancestral interativo mais próximo (`button, [role="button"], a`):
   - Atualizar estado visual de hover (`data-hand-hover="true"`) e disparar `pointerenter` (para atualizar o preview dos esportes em [src/ui/WiiMenu.tsx](file:///home/gusta/wii/src/ui/WiiMenu.tsx)).
   - Na confirmação da pinça, executar `.click()` no elemento alvo.
   - No gesto de voltar/fechar, acionar `Voltar` / `Wii Menu` ou fechar a aba da câmera conforme a tela ativa.

### 3.3 Transição Automática Menu (Mão) ↔ Jogo (Corpo)
- Ao iniciar `Corrida` ou `Tênis` com a câmera ligada, [src/App.tsx](file:///home/gusta/wii/src/App.tsx) alterna o `PoseClient` para `mode: 'pose'`, oculta o `HandCursor` e exibe `<CameraPip />` com a calibração corporal.
- Ao clicar em `‹ Menu` durante o jogo, retorna para `mode: 'hand'` automaticamente.

### 3.4 Testes e Verificação
1. **Testes unitários** (`tests/handCursor.test.ts`): fixtures sintéticas de 21 landmarks cobrindo espelhamento, calibração de zona ativa, histerese da pinça, trava de posição e timer de voltar/fechar.
2. **Portão de qualidade**: `npm test && npm run lint && npm run build`.
3. **Validação manual em browser** (`npm run dev`): ativar câmera pela nova aba, sincronizar mão, navegar pelos menus (`channels` → `title` → `sports` → jogo) e validar transição mão ↔ corpo.

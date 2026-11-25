<div align="center">

<img src="assets/caution-tape.svg" alt="Wii Web Sports" width="720" />

# Wii Web Sports Arena

**Seu corpo é o controle.** Uma arena arcade no navegador com corrida de obstáculos e tênis, controlada por pose via webcam.

</div>

## Requisitos

- Node.js 24 LTS e npm 11 ou compatível.
- Navegador desktop moderno (Chrome, Edge ou Firefox) com câmera e WebGL 2; publicação e uso da câmera exigem HTTPS (localhost funciona em desenvolvimento).
- Câmera enquadrando o corpo inteiro para corrida e salto. O Tênis funciona com enquadramento mais próximo.

## Desenvolvimento

```bash
npm ci
npm run dev
```

O servidor local imprime a URL de desenvolvimento. A primeira ação **Ativar câmera** solicita permissão; a câmera abre em tela grande e calibra sozinha quando você fica parado e enquadrado (cerca de quatro segundos). A mão da raquete é detectada pelo movimento. Se a câmera não estiver disponível, setas e espaço continuam funcionando.

```bash
npm test
npm run build
npm run preview
npm run lint
```

O build copia a variante module do WASM do MediaPipe fixado no lockfile para `public/mediapipe/wasm-<versão>/` e verifica o SHA-256 dos modelos locais — servidos com o hash no nome — antes de compilar. Os ativos de `mediapipe/` e `assets/` são servidos com `Cache-Control: immutable` (ver `vercel.json`).

## Arquitetura

- `src/cv/`: Worker de visão com Pose Landmarker e Hand Landmarker (variante WASM module, `useModule`), cliente de captura com um frame em trânsito que mantém o worker quente entre liga/desliga e carrega os ativos em paralelo à permissão de câmera; calibração.
- `src/kinematics/`: filtro 1-Euro, histerese, gating de confiança e detectores puros.
- `src/games/`: loop fixo Three.js e cenas arcade desacopladas da câmera.
- `src/ui/`: canvas do jogo em tela cheia, seletor de modalidade e PiP da câmera.
- `tests/`: fixtures sintéticas e testes determinísticos dos detectores.

O vídeo é processado no dispositivo e não é enviado ao servidor do jogo. O MediaPipe informa que pode enviar métricas de desempenho e utilização da API ao Google. Os modelos Pose Landmarker Lite e Hand Landmarker são hospedados localmente com o app. Consulte [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Deploy

Com o Vercel CLI autenticado, execute `npx vercel --prod`. O projeto usa `dist/` como saída estática; a URL HTTPS resultante permite o acesso à webcam sem instalação. O comando de build verifica a versão e o SHA-256 dos modelos e publica também os arquivos WASM locais.

## Controles

| Ação | Webcam | Teclado |
| --- | --- | --- |
| Correr | Ande ou corra no lugar | Seta para baixo alterna andar / correr / parar |
| Pular | Salto vertical | Espaço ou seta para cima |
| Trocar de raia | Incline o tronco | Setas esquerda/direita |
| Bater no tênis | Raquetada dominante | Espaço |

<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/credits-dark.png?v=2" />
  <img src="assets/credits-light.png?v=2" alt="Design: Gustavo Moreira e Lucas Coimbra" width="640" />
</picture>
</div>

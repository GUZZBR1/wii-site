# Revisão de PR — cache anual sem versão nas URLs do MediaPipe

Data: 24 de novembro de 2026 · Branch: `fix/cv-pipeline-bottlenecks` · Commit analisado: `3319e38`

**Apontamento da revisão:** "Cache anual sem versão nas URLs do MediaPipe — a versão e o checksum são verificados no build, mas não fazem parte das URLs dos arquivos. Use URLs vinculadas à versão do WASM e ao hash do modelo antes de depender de `immutable`."

**Veredito: procedente — vale corrigir antes de mergear, mantendo `immutable`.** O `vercel.json` deste PR aplica `Cache-Control: public, max-age=31536000, immutable` a `/mediapipe/(.*)` e `/assets/(.*)` (`vercel.json:5-14`). Para `/assets/*` o cabeçalho está correto (nomes com hash de conteúdo, §3). Para `/mediapipe/*` não está: os três arquivos servidos (`vision_wasm_module_internal.js` ~337 KB, `.wasm` ~14,7 MB, `pose_landmarker_lite.task` ~5,8 MB) têm URL fixa e conteúdo que muda quando a dependência é atualizada. Isso é exatamente o anti-padrão que a documentação do próprio `immutable` proíbe — MDN: "`immutable` […] evita requisições condicionais desnecessárias […] **quando você usa o padrão cache-busting** para os recursos" — e que a própria Vercel condiciona a "Content-hashed assets" na tabela de recomendações de `Cache-Control`. O risco é real mas limitado: materializa-se só em usuários que retornam após uma mudança legítima de conteúdo (bump de `tasks-vision` ou troca do modelo), falha provavelmente de forma ruidosa (init do CV morre, não pose errada silenciosa — na maioria dos cenários), e tem correção barata porque o script que gera os arquivos já conhece os dois identificadores necessários (versão e SHA-256).

---

## 1. Quão real é o risco?

### 1.1 O que está em jogo — três URLs fixas, conteúdo mutável

`mediapipeAssetUrls()` (`src/cv/poseClient.ts:8-18`) monta hoje:

- `wasmBaseUrl` = `…/mediapipe/wasm/` → o worker passa a `FilesetResolver.forVisionTasks(wasmBaseUrl, true)` (`src/cv/pose.worker.ts:12`);
- `modelUrl` = `…/mediapipe/models/pose_landmarker_lite.task` → `fetch()` direto no worker (`pose.worker.ts:13`);
- `wasmModuleUrls` (loader + binário) para o prefetch de `warmVisionAssets()` (`poseClient.ts:34-37`).

Dentro do bundle da dependência, `forVisionTasks` é só um montador de URL: `nh("vision", basePath, useModule)` retorna `{ wasmLoaderPath: `${base}/vision_wasm_module_internal.js`, wasmBinaryPath: `${base}/vision_wasm_module_internal.wasm` }` (`vision_bundle.mjs`, `nh()` ~caractere 49305; assinatura `forVisionTasks(basePath?, useModule?)` em `vision.d.ts:819`). O `basePath` é **qualquer diretório** — interpolado literalmente — e o nome do arquivo é fixo por contrato: `vision.d.ts:733` diz que "the returned filesets require that the Wasm files are published **without renaming**" (o que exclui versionar o nome do arquivo WASM, mas não o diretório — ver §2a).

### 1.2 Cenários concretos de skew

O estado stale vive no **cache HTTP do navegador** (e em proxies intermediários), não na Vercel — ver 1.4. Assumindo um usuário que visitou antes do deploy:

**Cenário A — bump de `@mediapipe/tasks-vision` (ex.: 1.2.3 → 1.2.x).**
O pin `packageJson.version !== '1.2.3'` (`copy-mediapipe-wasm.mjs:8`) torna o bump um ato deliberado de PR (quem subir a dependência atualiza o pin no script). Nesse deploy: `index.html` novo → bundle e worker com **glue code novo** da dependência → worker pede as **mesmas** URLs `/mediapipe/wasm/vision_wasm_module_internal.{js,wasm}` → navegador serve o loader **antigo** do cache → `await import(loaderAntigo)` registra `self.ModuleFactory` antigo → `locateFile` mapeia para o `.wasm` antigo, também em cache. Resultado: **glue novo + loader/wasm antigos**. O acoplamento é de fato triplo:

- loader ↔ binário são um par Emscripten: o loader é gerado com `MODULARIZE` e faz `wasmExports = await createWasm()` contra as import/exports específicas daquele `.wasm` (visível em `vision_wasm_module_internal.js`);
- bundle ↔ loader: o bundle chama `self.ModuleFactory(self.Module || i)` e depois usa a superfície privada do `Module` (`_changeBinaryGraph`, `_processFrame`, `_malloc`… — `vision.d.ts:2941+`), via `Wh()` em `vision_bundle.mjs` ~caractere 66900;
- tudo sai do **mesmo tarball versionado** do npm (`node_modules/@mediapipe/tasks-vision/wasm/`), ou seja, são artefatos de uma única release.

Cross-versão pode inicializar por acidente (a API de grafo MediaPipe é serializada por protos e razoavelmente estável) ou quebrar ruidosamente (export ausente, `ModuleFactory` incompatível, abort no init do grafo). Em ambos os casos o modo de falha é não determinístico e atinge **todos** os usuários recorrentes na janela de 1 ano. O sintoma visível: `ERROR fatal` de init (caminho `pose.worker.ts:62-64` → `poseClient.ts:113-116`) ou timeout de 30 s (`poseClient.ts:129-137`) — o CV fica morto até o usuário fazer hard-refresh, coisa que ninguém sabe fazer.

**Cenário B — modelo `.task` substituído na mesma URL** (SHA256SUMS atualizado, `copy-mediapipe-wasm.mjs:16-20`).
Usuário recorrente baixa os bytes **antigos** do modelo: se o formato continuar compatível, o app roda silenciosamente o modelo defasado; se divergir do grafo esperado, init falha. Não determinístico por usuário, invisível no deploy.

**Cenário C — desalinhamento por eviction parcial.**
O cache HTTP do navegador evicta entradas individualmente sob pressão (LRU/tamanho). Um `.wasm` de 14,7 MB é candidato primário a eviction, enquanto o loader de 337 KB e o modelo de 5,8 MB podem sobreviver — ou qualquer combinação inversa. Após um deploy, o mix pode ser `loader novo + wasm novo + modelo antigo`, `loader velho + modelo novo`, etc. — qualquer um dos 2³ estados, incluindo os inconsistentes entre si.

**O que NÃO gera skew:** dentro de uma mesma sessão — os três ativos são carregados uma única vez por `INIT`; e o código do app (`/assets/*`, `index.html`) — ver §3.

### 1.3 O cache stale sobrevive a deploys? Sim — e `immutable` é quase irrelevante aqui

- **`max-age=31536000` é o dente real.** Enquanto a entrada estiver "fresh", o navegador a reusa sem nenhuma requisição de rede — durante até um ano. web.dev (Grigorik/Posnick): "How do you notify browsers to update the 'stale' cached copy? You can't, at least not without changing the URL" e "different users might end up using **different versions of the file when the page is constructed**" — a descrição exata do skew acima.
- **Reload normal não salva em nenhum browser moderno.** Desde o Chrome 56 (2017, post "Reload, reloaded" no blog do Chromium), o reload comum revalida **apenas o recurso principal** — sub-recursos dentro de `max-age` saem do cache sem revalidar. Ou seja: no Chrome, `immutable` não muda nada porque o comportamento desejado já é o default para sub-recursos.
- **`immutable` não tem suporte no Chrome** (`version_added: false`, crbug.com/41253661 — mdn/browser-compat-data). Suporta: Firefox ≥ 49, Safari ≥ 11; Edge legado 15–79 perdeu ao virar Chromium; **Firefox Android não suporta**. Onde suporta, `immutable` apenas suprime a revalidação de sub-recursos no reload — torna o stale ainda mais "pegajoso" em Firefox/Safari desktop.
- **Saída de emergência existe mas não é confiável:** hard reload (Ctrl+Shift+R / "Empty cache and hard reload") bypassa tudo — em todos os browsers — porém é ação manual que o usuário afetado não sabe que precisa.

### 1.4 Onde NÃO está o risco: a CDN da Vercel

Duas garantias nas docs da Vercel delimitam o problema ao lado do cliente:

- A chave de cache do CDN inclui "**the unique deployment URL**" (vercel.com/docs/caching/cdn-cache/purge) → cada deploy é um namespace novo de cache; entries antigas não vazam para o deployment seguinte;
- "Static files are automatically cached on Vercel's global network **for the lifetime of the deployment**" (cdn-cache) e "Vercel doesn't allow bypassing the cache for static files by design" — ou seja, dentro de um deployment a resposta é sempre a do build atual; através de deploys, o namespace troca.

Conclusão: o cache stale que o apontamento teme é o do **navegador** (mais proxies/AVs transparentes no caminho). E justamente o navegador é onde `immutable`+`max-age` sem versionamento faz estrago.

---

## 2. Desenho da correção — URLs endereçadas por versão/conteúdo

### 2.a Diretório versionado para o WASM: `/mediapipe/wasm-1.2.3/`

Viável sem tocar no contrato do MediaPipe: `nh()` interpola `${base}/vision_wasm_module_internal.{js,wasm}` com o nome fixo e o **diretório livre** (a exigência do `vision.d.ts:733` é só não renomear os arquivos). Basta copiar para `public/mediapipe/wasm-${version}/` e passar a base correspondente.

**Como o cliente aprende a versão sem hardcoding — três candidatos:**

1. **`import pkg from '@mediapipe/tasks-vision/package.json'`** — ❌ morto. O `exports` do pacote (`node_modules/@mediapipe/tasks-vision/package.json`) lista apenas `"."`, `"./vision_bundle.js"` e os quatro caminhos de wasm — **não exporta `./package.json`**. Verificado em Node 24: `import('@mediapipe/tasks-vision/package.json')` → `ERR_PACKAGE_PATH_NOT_EXPORTED`. O Vite resolve specifiers de dependência pelo mesmo `exports` map → mesmo erro em dev/build; e o `tsc` com `moduleResolution: "Bundler"` (`tsconfig.json:14`) também falha em compile-time — verificado: `TS2307: Cannot find module '@mediapipe/tasks-vision/package.json'`, mesmo com `resolveJsonModule: true` (`tsconfig.json:10`). Ou seja, a opção morre nas três camadas (typecheck, dev, build).
2. **`manifest.json` em `public/mediapipe/` buscado em runtime** — ❌ pior. Cairia sob `/mediapipe/(.*)` → herdaria `immutable` → o próprio manifest ficaria stale (auto-derrotante) ou exigiria exceção de header + um round-trip extra antes do INIT. Complexidade para zero ganho.
3. **Módulo TS gerado em build-time** — ✅ recomendado. `copy-mediapipe-wasm.mjs` já roda em `predev`/`prebuild` (`package.json`), já lê o `package.json` da dependência por caminho de filesystem (linha 7 — leitura direta ignora o `exports`, é assim que o pin funciona) e já calcula o SHA-256 do modelo (linha 17). Escrever `src/cv/mediapipe-assets.ts` (gitignored, mesma convenção do `public/mediapipe/wasm/` gerado) custa ~10 linhas e coloca versão+hash **dentro do bundle content-hashed** — sempre consistente com o código, sem RTT extra e sem header especial.

   - Alternativa equivalente: `define` no `vite.config.ts` lendo o `package.json` via fs — funciona, mas duplica a leitura/SHA que já vive no script e exige `declare global` para o `tsc`. Mais partes móveis; o arquivo gerado é a fonte única.

### 2.b URL do modelo endereçada por conteúdo

- **`?v=<sha8>` — ❌ descartado.** A chave de cache do CDN Vercel ignora query string para arquivos estáticos (docs: "The request URL (**query strings are ignored for static files**)"). Para o navegador funcionaria (a URI completa é a chave), mas versionamento por query depende de cada intermediário incluir query na chave — sinal fraco e inconsistente com o padrão dos demais assets. Caminho versionado é unívoco.
- **Diretório com hash** `/mediapipe/m-<sha8>/pose_landmarker_lite.task` — válido, simétrico ao `wasm-<ver>/`.
- **Sufixo no nome** `/mediapipe/models/pose_landmarker_lite.<sha8>.task` — ✅ recomendado. Espelha a convenção `[name]-[hash]` do próprio Vite, mantém o nome autodescritivo, e o `.task` final preserva o content-type (irrelevante — octet-stream não é comprimido de qualquer forma, §4). `<sha8>` = 8 primeiros hex do SHA-256 já verificado (`59929e1d…` em `SHA256SUMS`). Cópia gerada+gitignored; o original sem sufixo segue tracked como fonte da verdade.

### 2.c Alternativa avaliada: manter URLs fixas e remover `immutable`

Rejeitada, mas honestamente não é desastrosa: o perigo real está no `max-age=31536000` (não no `immutable`, que é no-op no Chrome). Voltar ao default `public, max-age=0, must-revalidate` faz o navegador revalidar os 3 ativos por ETag a cada visita — os 304 são pequenos (~bytes de header), não "20 MB de 304s" — mas custam RTTs seriais na inicialização do CV (loader → import → wasm → modelo), já de segundos, e o custo se repete em toda visita, inclusive mobile de alta latência. Um `max-age` intermediário (ex.: 1 dia) apenas *limita* o skew sem eliminá-lo — um dia de CV quebrado continua sendo CV quebrado. web.dev resume o trade-off: para URLs não versionadas "you need to admit defeat" e revalidar. Como o versionamento é barato aqui (§2.a/2.b), ele resolve os dois lados do trade-off — cache longo E correção — e é o que a revisão pede. **Manter `immutable`.**

### 2.d Recomendação final — esboço por arquivo

**`scripts/copy-mediapipe-wasm.mjs`** — mantém as duas verificações atuais; muda destino e emite o módulo:

```js
const version = packageJson.version; // já validado === '1.2.3'
const wasmDir = `wasm-${version}`;
const destination = resolve(root, 'public/mediapipe', wasmDir);
// rm + mkdir + copyFile dos 2 arquivos (igual a hoje, linhas 11-14)

const sha8 = digest.slice(0, 8); // digest já calculado/verificado (linhas 17-20)
const modelVersioned = `pose_landmarker_lite.${sha8}.task`;
// opcional: remover cópias antigas `pose_landmarker_lite.*.task` antes de copiar
await copyFile(modelPath, resolve(root, 'public/mediapipe/models', modelVersioned));

await writeFile(resolve(root, 'src/cv/mediapipe-assets.ts'),
  `// GENERATED by scripts/copy-mediapipe-wasm.mjs — do not edit.\n` +
  `export const MEDIAPIPE_WASM_DIR = '${wasmDir}';\n` +
  `export const POSE_MODEL_FILE = 'models/${modelVersioned}';\n`);
```

**`src/cv/mediapipe-assets.ts`** (novo, gerado, gitignored):

```ts
export const MEDIAPIPE_WASM_DIR = 'wasm-1.2.3';
export const POSE_MODEL_FILE = 'models/pose_landmarker_lite.59929e1d.task';
```

**`src/cv/poseClient.ts:8-18`** — `mediapipeAssetUrls()`:

```ts
import { MEDIAPIPE_WASM_DIR, POSE_MODEL_FILE } from './mediapipe-assets';
function mediapipeAssetUrls() {
  const base = `${import.meta.env.BASE_URL}mediapipe/`;
  const wasmDir = `${base}${MEDIAPIPE_WASM_DIR}`;
  return {
    // SEM barra final: nh() já concatena `${base}/vision_...` — ver §4 (bug do `//`)
    wasmBaseUrl: new URL(wasmDir, location.origin).href,
    wasmModuleUrls: [
      new URL(`${wasmDir}/vision_wasm_module_internal.js`, location.origin).href,
      new URL(`${wasmDir}/vision_wasm_module_internal.wasm`, location.origin).href,
    ],
    modelUrl: new URL(`${base}${POSE_MODEL_FILE}`, location.origin).href,
  };
}
```

**`.gitignore`** — trocar `public/mediapipe/wasm/` por `public/mediapipe/wasm*/` (cobre `wasm/` e `wasm-*/`), adicionar `public/mediapipe/models/pose_landmarker_lite.*.task` e `src/cv/mediapipe-assets.ts`.
**`biome.json:5`** — trocar `!public/mediapipe/wasm` por `!public/mediapipe/wasm*` (+ `!src/cv/mediapipe-assets.ts` se quiser isentar o gerado do lint).
**`vercel.json`** — **inalterado**: `/mediapipe/(.*)` casa os novos caminhos (`wasm-1.2.3/x`, `models/*.sha8.task`) sem nenhuma edição, e `immutable` passa a ser correto.
**`protocol.ts`/`pose.worker.ts`** — inalterados: `INIT` continua levando `wasmBaseUrl`+`modelUrl` prontos (`protocol.ts:36-41`).

Efeito colateral de bônus: bump de `tasks-vision` ou troca de modelo passam a produzir **diretório/arquivo novos** → zero sobreposição de cache → rollback fica trivial e deploys antigos não sobrescrevem nada.

**Uma ressalva honesta do arquivo gerado:** `npx tsc -b`/`npx vite build` direto em clone limpo falha (`mediapipe-assets.ts` ainda não existe) — exige ter rodado `predev`/`prebuild` uma vez. Mesmo trade-off do `public/mediapipe/wasm/` de hoje (que falha em runtime 404 em vez de compile). Mitigável documentando no README/AGENTS; se incomodar, commitar um stub — mas gitignored+regenerado é a convenção já adotada pelo repo.

---

## 3. `/assets/*` tem o mesmo furo? Não.

O Vite emite nomes content-hashed por default — `dist/` confirma: `index-oZyQnFfm.js`, `pose.worker-CmI72EtI.js`, `index-BQHEvAr3.css`, `GameLoop-ERi9XfyV.js` etc. `index.html` é regenerado a cada build apontando os hashes correntes (`dist/index.html:11-12`), e não recebe header custom → fica com o default da Vercel `public, max-age=0, must-revalidate` (docs: "The default value is `cache-control: public, max-age=0, must-revalidate`") → o HTML é revalidado a cada visita → HTML velho não sobrevive a deploy em navegação normal. A documentação do próprio Vite prescreve exatamente isso: "make sure to set `Cache-Control: no-cache` on the HTML file, otherwise the old assets will be still referenced" (vite.dev/guide/build, *Load Error Handling*) — o default da Vercel já equivale.

Resíduo conhecido e ortogonal: usuário com a página aberta durante o deploy pode tomar 404 num `import()` dinâmico antigo (o chunk velho some com o deployment anterior) — é o cenário do `vite:preloadError` documentado pelo Vite; mitigação opcional seria um handler `location.reload()`, não relacionado ao header. Conclusão: `/assets/(.*)` + `immutable` está **correto como está**.

---

## 4. Outras observações sobre o bloco `headers` do `vercel.json`

- **`source: "/mediapipe/(.*)"` está correto para caminhos aninhados.** `(.*)` é a sintaxe wildcard documentada da própria Vercel (o exemplo oficial usa `"/(.*)"` para todas as rotas); `source` casa o *pathname* (exclui querystring), e `.*` atravessa `/` — cobre `wasm-*/x.wasm`, `models/*.task`, e qualquer aninhamento futuro. A alternativa `:path*` seria `/mediapipe/:path*`; equivalente, sem ganho.
- **Headers se aplicam a arquivos de `public/`** — confirmado: o exemplo da doc declara que configura "custom response headers for **static files**"; `public/` vira `dist/` byte a byte (vite.dev/guide/assets) e as regras casam por pathname na resposta final.
- **Compressão: o `.task` fica de fora, e não vale renomear.** A allowlist de MIME comprimidos da Vercel inclui `application/wasm` → o `.wasm` sai comprimido (medido: 14 665 738 B → ~4 165 889 B gzip, −72%) e o loader JS também (336 662 → ~81 289 B). `.task` resolve para `application/octet-stream`, ausente da lista → sem gzip/brotli — confirmando o achado do relatório anterior. Renomear para uma extensão comprimível não compensa: o `.task` é flatbuffer denso (medido: gzip economiza só ~14% — 5 777 746 → 4 970 219 B), e servir o modelo como `.wasm`/`.js` mentiria o content-type. Manter `.task` sem compressão.
- **Não-problemas:** o limite de 10 MB de resposta cacheável é para *Function responses*; arquivos estáticos são cacheados por deployment e não se aplica. `proxy-revalidate` não é suportado — irrelevante aqui.
- **Bug adjacente encontrado (mesma linha que o fix toca):** `wasmBaseUrl` termina com `/` (`poseClient.ts:11`) e `nh()` concatena `${base}/vision_...` → a URL real do loader é `…/mediapipe/wasm//vision_wasm_module_internal.js` (**barra dupla**; `new URL()` preserva `//` no path — verificado). Enquanto isso, `warmVisionAssets()` prefetcheia `…/wasm/vision_…` com barra simples (`poseClient.ts:13-14`) — **chave de cache HTTP distinta** → o warm provavelmente não esquenta a entrada que o `FilesetResolver` vai usar (e pode até duplicar o download de 15 MB na primeira visita). O esboço do §2.d elimina o `//` removendo a barra final — verificar com `curl -I` no deploy que `/mediapipe/wasm//vision_wasm_module_internal.js` realmente é servido hoje (Vercel deve normalizar; o app supostamente funciona em produção).

---

## 5. Checklist antes de shippar

1. Rodar `npm run build` (gera `wasm-1.2.3/`, o `.task` com sufixo e `mediapipe-assets.ts`) e conferir em `dist/` os três caminhos versionados.
2. `npm run dev` → ATIVAR CÂMERA → TRACKING (o AGENTS.md exige verificação manual do fluxo CV); conferir no DevTools que o loader sai de `…/wasm-1.2.3/` com **barra simples** e que o warm hita o mesmo URL (`x-vercel-cache`/from disk cache).
3. Em produção: `curl -sI https://<deploy>/mediapipe/wasm-1.2.3/vision_wasm_module_internal.wasm` → esperar `cache-control: public, max-age=31536000, immutable` + `content-encoding: br|gzip` (com `Accept-Encoding`); idem para o `.task` versionado → header immutable, **sem** content-encoding (octet-stream).
4. Simular o skew: buildar com um valor diferente em `wasmDir`/sha8 → confirmar que as URLs mudam e que o app busca os novos caminhos (nada em cache antigo é requisitado).
5. Confirmar `git status` limpo quanto aos gerados (`wasm-*/`, `pose_landmarker_lite.*.task`, `mediapipe-assets.ts` ignorados) e `npm run lint` verde com os novos globs do `biome.json`.

### Afirmações que não consegui verificar (declarado por honestidade)

- Que os bytes do `.wasm` realmente diferem entre versões de `tasks-vision` (quase certo — é um grafo MediaPipe compilado por release — mas só a 1.2.3 está instalada; verificável diffando `wasm/` entre dois pacotes).
- Que a Vercel normaliza `/mediapipe/wasm//…` hoje — item 2 do checklist cobre; se não normalizar, o app deveria estar quebrado em produção agora (o que indicaria o bug do `//` como causa primária, não só cache-key).
- A semântica exata de revalidação em reload para `fetch()`/`import()` *dentro de workers* (a mudança do Chrome 56 cobre sub-recursos de página; tratei o caminho de cache como idêntico).
- Comportamento de caches de terceiros (proxy corporativo, ISP, antivírus) — assumido RFC 9111 padrão (URI completa, incl. query, é a chave).

---

## Fontes

- **Código do repo:** `src/cv/poseClient.ts:8-18,34-37,99-128` · `src/cv/pose.worker.ts:12-15` · `scripts/copy-mediapipe-wasm.mjs:7-20` · `vercel.json:5-14` · `public/mediapipe/models/SHA256SUMS` · `.gitignore` · `biome.json:5` · `dist/index.html`, `dist/assets/` (hashes reais do build).
- **`@mediapipe/tasks-vision` 1.2.3 (node_modules):** `vision_bundle.mjs` — `nh()` monta `${base}/vision_wasm_module_internal.{js,wasm}` (qualquer diretório-base), `Mh()` carrega o loader via `importScripts`→`import()` ou `<script>`, `Wh()` consome `wasmLoaderPath`/`wasmBinaryPath` com `locateFile`; `vision.d.ts:819` (assinatura `forVisionTasks(basePath?, useModule?)`), `:731-733` ("the Wasm files [must be] published **without renaming**"), `:2941` (`WasmFileset`); `package.json` — `exports` **sem** `"./package.json"` → `ERR_PACKAGE_PATH_NOT_EXPORTED` (verificado em Node 24).
- **MDN Cache-Control** — `immutable` só se aplica "when you use a **cache-busting pattern**": https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#immutable · compatibilidade via **mdn/browser-compat-data** (`http/headers/Cache-Control.json` → `immutable`): Chrome não suporta (crbug.com/41253661), Firefox ≥49, Safari ≥11, Firefox Android não.
- **web.dev — Prevent unnecessary network requests with the HTTP Cache** (Grigorik/Posnick): skew por URL não versionada ("different users might end up using different versions of the file") e "admit defeat" + revalidação para unversioned URLs: https://web.dev/articles/http-cache
- **Chromium Blog — "Reload, reloaded" (jan/2017):** desde o Chrome 56 o reload normal valida **só o recurso principal**; sub-recursos dentro de `max-age` não revalidam: https://blog.chromium.org/2017/01/reload-reloaded-faster-and-leaner-page_26.html
- **Vercel — Cache-Control headers:** default `public, max-age=0, must-revalidate`; `max-age=31536000, immutable` recomendado só para "**Content-hashed assets**": https://vercel.com/docs/caching/cache-control-headers
- **Vercel — CDN Cache:** static files cacheados "for the lifetime of the deployment"; "Vercel doesn't allow bypassing the cache for static files by design": https://vercel.com/docs/caching/cdn-cache
- **Vercel — Purging CDN Cache:** chave de cache = método + URL "**(query strings are ignored for static files)**" + host + **deployment URL** + scheme: https://vercel.com/docs/caching/cdn-cache/purge
- **Vercel — vercel.json `headers`:** `source` casa pathname (exclui querystring); exemplo oficial `"/(.*)"`; "configures custom response headers for **static files**": https://vercel.com/docs/project-configuration/vercel-json#headers
- **Vercel — Compression:** allowlist de MIME comprimidos inclui `application/wasm`; `application/octet-stream` ausente: https://vercel.com/docs/how-vercel-cdn-works/compression
- **Vite — Building for Production / Static Asset Handling:** nomes content-hashed por default; `public/` copiado sem hash; "make sure to set `Cache-Control: no-cache` on the HTML file, otherwise the old assets will be still referenced" (Load Error Handling): https://vite.dev/guide/build · https://vite.dev/guide/assets
- **Medições locais:** gzip `.wasm` 14 665 738→~4 165 889 B (−72%) · loader JS 336 662→81 289 B · `.task` 5 777 746→4 970 219 B (−14%) · `new URL()` preserva `//` no pathname (Node 24).

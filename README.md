# ChadScore

Next.js, TypeScript e Tailwind CSS. Análise gratuita com **MediaPipe Face Landmarker, inteiramente no navegador**, sem chave, backend de análise ou API paga.

## Executar localmente

Requisitos: Node.js 20.9+ (LTS atual recomendado), npm e navegador atualizado com WebAssembly, Web Workers, `createImageBitmap` e `OffscreenCanvas`.

```bash
npm install
npm run dev
```

Abra http://localhost:3000. No PowerShell, use `npm.cmd` se a política de scripts bloquear `npm.ps1`.

`predev` e `prebuild` executam `npm run prepare:models`. Esse script copia o runtime/WASM do pacote fixado `@mediapipe/tasks-vision@0.10.21` e baixa uma única vez o modelo público Face Landmarker float16 **v1** para `public/mediapipe/`. Essa versão não realiza a chamada de telemetria observada na versão 1.2.0. O SHA-256 é verificado antes do uso:

```text
64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff
```

A preparação inicial requer internet para baixar o modelo do Google, mas **não envia imagens** e não exige conta/chave. Os arquivos gerados ficam ignorados no Git. Depois de preparados, dev/build não precisam baixar o modelo novamente; no navegador, todos os arquivos de inferência são servidos pela mesma origem do site, sem CDN ou chamada externa. Se um download falhar, execute novamente `npm run prepare:models`. Um arquivo local com hash incorreto deve ser removido especificamente antes de refazer o download.

## Comandos

- `npm run prepare:models`: prepara/verifica modelo e arquivos WASM locais.
- `npm run dev`: desenvolvimento (prepara os arquivos automaticamente).
- `npm run build`: build de produção (também prepara os arquivos).
- `npm start`: executa o build localmente.
- `npm run lint`: ESLint.
- `npm run typecheck`: TypeScript.
- `npm test`: testes de validação, geometria, pontuação e ciclo de vida do worker.
- `npm run test:e2e`: testes no navegador após build e `npx playwright install chromium`. Alternativamente, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` para um Chrome/Chromium instalado. Inicia servidor isolado em `127.0.0.1:3100`; não grava screenshots, vídeos ou traces.

Não é necessário criar `.env.local`. A antiga rota de upload e a integração com provedor pago foram removidas. Não há fallback de pontuações ou medições fictícias.

## Preparação para a Vercel

O `vercel.json` fixa o preset Next.js, instalação com `npm ci` e **Build Command `npm run build`**. Isso garante que o hook `prebuild` gere os arquivos em `public/mediapipe/` antes do Next.js compilar, inclusive em um checkout novo sem esses arquivos ignorados. Não substitua esse comando por `next build` diretamente: isso pularia a preparação do modelo.

Na importação do repositório, use a raiz do projeto, uma versão Node.js LTS suportada (recomendada: 24.x) e deixe o Output Directory no padrão do Next.js. Não são necessárias variáveis secretas, funções de análise ou APIs pagas. O ambiente de build precisa de acesso HTTPS ao Google Storage para baixar o modelo público; uma falha ou hash divergente interrompe o build, em vez de publicar arquivos incompletos.

O worker, o runtime, os dois loaders/WASM (SIMD e fallback) e o modelo `.task` são arquivos estáticos de `public/`, servidos pela origem HTTPS da implantação. Não precisam estar no Git nem ser escritos em disco durante uma requisição. Os headers de segurança do worker são definidos em `next.config.ts`. Os testes E2E verificam HTTP 200, conteúdo do modelo, MIME do WASM e CSP no servidor de produção local.

A inferência usa CPU/WASM em um worker normal, não threads compartilhadas: não depende de GPU, COOP/COEP ou de uma função serverless que receba a selfie. A compatibilidade final depende do navegador do visitante. A validação local não equivale a um deploy real na Vercel; nenhum comando de deploy é necessário para testar o projeto. Se a integração Git da Vercel já estiver conectada, um push pode disparar o deploy automático conforme as configurações dessa conta.

## Fluxo e privacidade

1. O usuário seleciona uma selfie JPG, PNG ou WebP de até 5 MB e 16 megapixels. Tipo, assinatura e leitura da imagem são verificados localmente.
2. A pré-visualização usa uma URL `blob:` temporária. O usuário confirma ser titular da selfie, ter 18 anos ou mais e entender as limitações da análise local. O aceite é limpo ao trocar/remover a foto.
3. Ao clicar, um **Web Worker** recebe o arquivo por structured clone, dentro do próprio navegador. Não há HTTP com a imagem. A foto é decodificada localmente, respeitando a orientação, e reduzida para até 1280×1280, sem distorção.
4. O MediaPipe usa CPU/WASM em modo IMAGE e procura até dois rostos para poder rejeitar fotos com múltiplos rostos detectados. Zero ou mais de um rosto, pontos inválidos, rosto pequeno/cortado, indícios geométricos de pose lateral ou olhos fechados geram erro, sem nota.
5. O relatório contém apenas indicadores agregados e textos determinísticos. Não inclui imagem nem coordenadas faciais completas. Fica na memória React da aba e é perdido ao atualizar/fechar a página ou ao descartar.

**Nenhuma foto ou ponto facial é enviado, gravado em disco/banco, cookies, URLs, localStorage ou sessionStorage pelo aplicativo.** Apenas código, WASM e modelo estáticos podem entrar no cache normal do navegador. Não há câmera automática, analytics, serviço de terceiros em runtime nem service worker. As URLs de imagem são revogadas, bitmap/canvas são liberados e o worker é encerrado ao concluir, falhar, cancelar, remover a foto ou sair da página. Não há garantia de apagamento criptográfico imediato da memória gerenciada.

O timeout local é de 60 segundos. Remover a foto encerra o worker, inclusive durante a inferência síncrona, sem bloquear a interface. Navegador incompatível, modelo ausente, erro de decodificação e falha do detector têm mensagens próprias.

O worker é servido com Content Security Policy que limita conexões e scripts à mesma origem (`connect-src 'self'`), como defesa adicional contra telemetria ou recursos externos. Mantenha esses headers caso adapte a hospedagem.

## Indicadores realmente calculados

As coordenadas normalizadas são convertidas para **pixels**, respeitando a razão largura/altura da foto. O eixo horizontal é alinhado pelos cantos externos dos olhos (33 e 263); a direção vertical aponta da testa ao queixo. Isso remove rotação no plano, **não** perspectiva 3D.

O contorno horizontal usa os pontos 234/454 e a altura usa 10/152. O eixo de reflexão é a média das posições horizontais de 10, 168 e 152. Os índices seguem a topologia Face Mesh do MediaPipe:

- **Erro de reflexão:** média das distâncias entre um ponto e a reflexão do par pelo eixo, dividida pela largura facial. Sete pares: 33/263, 133/362, 159/386, 145/374, 234/454, 172/397 e 61/291.
- **Diferença das larguras dos olhos:** diferença absoluta das distâncias 33–133 e 362–263, dividida pela maior.
- **Diferença dos lados do contorno mandibular:** diferença absoluta das distâncias 172–152 e 397–152, dividida pela maior.
- **Altura/largura:** altura alinhada 10–152 / largura alinhada 234–454. O ponto 10 não representa a linha do cabelo.
- **Largura mandibular/largura facial:** largura alinhada 172–397 / largura alinhada 234–454.
- **Espaço interno dos olhos/largura facial:** distância 133–362 / largura facial.
- **Largura da boca/largura facial:** distância 61–291 / largura facial.
- **Trecho base do nariz–queixo/altura facial:** altura alinhada 2–152 / altura alinhada 10–152.

As fórmulas e valores são apresentados em `/resultados`. Não há inferência de identidade, idade, gênero, etnia, saúde, personalidade, gordura, textura da pele, densidade de cabelo ou estrutura óssea. Não são calculados milímetros, profundidade, ângulos ósseos, razão áurea ou medidas clínicas.

## Nota subjetiva e critérios transparentes

A nota de 0 a 100 é um **índice subjetivo de equilíbrio bilateral 2D**, não uma medida científica de beleza. Pesos/tolerâncias são escolhas do produto, sem validação científica:

| Componente | Peso | Erro que zera o componente |
| --- | --- | --- |
| Reflexão dos 7 pares | 60% | 8% da largura facial |
| Equilíbrio da largura dos olhos | 25% | 30% de diferença relativa |
| Equilíbrio dos lados do contorno mandibular | 15% | 30% de diferença relativa |

```text
componente = 100 × máximo(0, 1 − erro/tolerância)
nota = arredondar(0,60 × reflexão + 0,25 × olhos + 0,15 × contorno)
```

As proporções descritivas não aumentam nem reduzem a nota. Uma face perfeitamente equilibrada nesses critérios recebe 100 **sem que isso signifique beleza ideal**. Uma nota baixa pode refletir captura, pose, expressão ou erro do detector, não uma característica permanente da pessoa.

Recomendações opcionais de looksmaxing usam somente indicadores calculáveis: altura/largura acima de 1,45, abaixo de 1,15 ou intermediária; largura mandibular abaixo/acima de 70% da largura facial; erro de reflexão acima de 2,5% ou diferença de largura ocular acima de 8%. Esses limiares são declarados nas recomendações e são heurísticos de estilo/captura, não padrões de normalidade. Sugestões se limitam a enquadramento, iluminação, penteados, armações e acabamento de barba **se o usuário usa barba**; não detectam esses atributos nem recomendam procedimentos, restrição alimentar ou técnicas arriscadas.

## Limitações e testes

Uma foto 2D não revela anatomia 3D. Rotação lateral, inclinação vertical, expressão, maquiagem e oclusão podem distorcer resultados. Os filtros geométricos são heurísticos, não certificam frontalidade nem garantem que todos os rostos sejam detectados. Modelo/limiares podem ter vieses e desempenho diferente entre pessoas. O relatório não é diagnóstico, ranking ou avaliação de valor pessoal.

Os testes verificam fórmulas, erros, pesos, limites, invariância a rotação/espelhamento e conversão de pixels, cancelamento e ausência de chamadas de rede pelo cliente. Testes E2E usam pontos sintéticos **apenas para o fluxo de sucesso**, sem substituir o detector na aplicação. Outro teste carrega o **MediaPipe real** com os arquivos locais, rejeita uma imagem sintética sem rosto e verifica que só há GETs da mesma origem, sem upload. Isso não representa uma validação de precisão facial populacional.

## Estrutura

- `public/face-landmarker.worker.js`: inferência MediaPipe isolada, somente local.
- `scripts/prepare-models.mjs`: preparação e verificação dos assets.
- `src/lib/face-analysis.ts`: gerenciamento/cancelamento do worker e validação da resposta.
- `src/lib/face-geometry.ts`: cálculo puro dos indicadores, nota e recomendações.
- `src/lib/analysis-schema.ts`: contratos e aviso fixo de subjetividade.
- `src/components/selfie-upload.tsx`: seleção, pré-visualização e aceite de processamento local.
- `src/components/analysis-results.tsx`: relatório preto e verde, valores e fórmulas.
- `src/components/analysis-session.tsx`: somente relatório em memória.

Documentação: [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js). O runtime `@mediapipe/tasks-vision` usa licença Apache-2.0; consulte os termos/fontes do modelo disponibilizado pelo Google antes de redistribuir os assets. Nenhum deploy ou push é feito por estes comandos.

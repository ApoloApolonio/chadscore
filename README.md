# ChadScore

Next.js, TypeScript, Tailwind CSS e **MediaPipe local e gratuito**. Interface azul/glass minimalista, com Manrope via `next/font`. Sem conta, chave, backend de upload ou API paga para analisar selfies.

## Executar e validar

Requisitos: Node.js LTS suportado pelo Next.js (recomendado 24.x), npm e navegador atualizado com WebAssembly, Web Worker, `createImageBitmap` e `OffscreenCanvas`.

```bash
npm ci
npm run dev
```

Abra http://localhost:3000. No PowerShell, use `npm.cmd` se `npm.ps1` estiver bloqueado.

```bash
npm test
npm run lint
npm run build
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

Os testes E2E iniciam um servidor de produção local isolado em `127.0.0.1:3100`. Para um Chrome/Chromium existente, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Screenshots, vídeos e traces estão desativados. Imagens de teste são procedurais e geradas em memória, sem fotografias humanas ou chamadas pagas.

`predev` e `prebuild` executam `npm run prepare:models`. O build inicial baixa os modelos públicos e a fonte Manrope; no navegador, todos são servidos pela mesma origem. Não é necessário `.env.local`.

## Modelos fixados e assets

Runtime `@mediapipe/tasks-vision@0.10.21`, sem a telemetria observada na versão 1.2.0. O script copia runtime e WASM para `public/mediapipe/` e verifica estes hashes antes de utilizar os modelos:

| Modelo público v1 | Arquivo | SHA-256 |
| --- | --- | --- |
| Face Landmarker float16 | `face_landmarker.task` | `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff` |
| Selfie Multiclass 256×256 float32 | `selfie_multiclass_256x256.tflite` | `c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0` |

Os URLs oficiais/versionados estão em `scripts/prepare-models.mjs`. Os assets gerados ficam fora do Git. Se houver erro de rede, execute novamente `npm run prepare:models`; hash inválido interrompe o build em vez de servir um modelo corrompido. O segmentador multiclasses (cerca de 16,4 MB) separa fundo, cabelo, pele corporal, pele facial, roupas e acessórios.

## Captura e privacidade

- Aceita JPG, PNG e WebP até 5 MB e 16 megapixels. Valida tipo, assinatura e decodificação local.
- O usuário declara ser titular da selfie, ter 18 anos ou mais e entender que as notas são subjetivas. O aceite é limpo ao trocar/remover a foto.
- Um worker recebe o arquivo por structured clone **dentro do navegador**, nunca por HTTP. A inferência usa CPU/WASM, não uma função serverless. Não há câmera automática, analytics ou service worker.
- O Face Landmarker procura até dois rostos; zero/múltiplos, pontos inválidos, rosto pequeno ou enquadramento inadequado geram erro sem resultado fabricado.
- Pele/Cabelo usam Image Segmenter e pixels locais. Máscaras, pixels e coordenadas completas não entram no relatório. Falha/insuficiência de uma região produz `—`, não uma nota de substituição.
- A sessão contém somente relatório e URL `blob:` da miniatura em memória. Nova análise, atualização/fechamento ou descarte libera a sessão. Não há escrita de fotos em banco/disco, cookies, URLs remotas, localStorage ou sessionStorage.
- O worker, bitmaps, máscaras, instâncias MediaPipe e canvases são liberados ao concluir/cancelar. O timeout local é de 60 s. Não há garantia de apagamento criptográfico imediato da memória gerenciada.
- A CSP do worker limita scripts e conexões à origem local; os testes verificam que só há GETs locais para recursos estáticos. Apenas código, fontes, WASM e modelos podem entrar no cache normal do navegador.

## Calibração técnica v2

**Critérios, investigação, fórmulas e limitações completos: [docs/CALIBRATION.md](docs/CALIBRATION.md).**

O caso de Pele 9,9 relatado sem imagem não pode ser diagnosticado/reproduzido individualmente. Foram corrigidos pontos cegos verificáveis do algoritmo: platôs, normalização pelo rosto inteiro, diluição de irregularidades e bônus por nitidez. Não foi aplicado desconto artificial, nota aleatória ou distribuição-alvo de beleza.

### Geometria e geral

Olhos, Sobrancelhas, Nariz, Lábios, Mandíbula, Queixo e Maçãs do rosto medem equilíbrio bilateral projetado, não tamanho/forma ideais. Usam coordenadas em pixels alinhadas e erros RMS normalizados pela própria região. Olhos consideram também largura e abertura relativas; mandíbula considera as distâncias laterais ao queixo.

```text
componente = 100 / (1 + (erro regional / 0,08)²)
nota regional = arredondar_1_casa(componente / 10)
geral = arredondar_1_casa(10 / (1 + média((erro regional / 0,08)²)))
harmonia facial = geral
```

A referência 0,08 é meia-resposta técnica, não norma biológica. Sem matriz de pose confiável, inclinação frontal até 15° e todas as sete regiões disponíveis, geral/Harmonia/PSL ficam `—`. Não se preenche região ausente com média ou zero. Pele e Cabelo não alteram a geral nem a classificação.

### Pele e Cabelo

As notas representam somente apresentação fotográfica, de 0,0 a 10,0, sempre com vírgula. Não avaliam cor natural, saúde dermatológica/capilar, densidade real, estrutura óssea ou valor pessoal.

Pele usa máscara facial, até cinco áreas anatômicas e escolha de áreas por confiança/luz/suficiência, nunca pela nota desejada. Exige dois grupos distintos, 400 pixels úteis, cobertura ≥40%, confiança média ≥0,72, referências de foco e exposição utilizável. Usa residual local médio, sua energia RMS, contraste de média escala em 13×13 e variação entre áreas. A nitidez é elegibilidade (`D≥1,25`), não um bônus de até três pontos. Resposta contínua: `10/(1+perda/0,10)`. A escala canônica de até 160 px de largura facial **não recupera detalhes perdidos por redução, filtros ou compressão**.

Cabelo exige máscara/confiança, área e sinal suficientes. Cobertura visível não rende pontos nem estima densidade. Mede consistência **relativa** de definição e gradiente nas células válidas; `10/(1+perda)`. Nitidez (`D≥0,5`) é elegibilidade, não um bônus de até sete pontos. Penteado, textura natural, reflexos e ruído podem afetar o índice, que não está validado para comparar tipos de cabelo ou grupos humanos.

### Classificação PSL

Função centralizada em `src/lib/score-classification.ts`; classifica a mesma nota arredondada que é exibida:

| Nota | Categoria |
| --- | --- |
| 0,0–1,1 | Sub 3 |
| 1,2–2,2 | Sub 5 |
| 2,3–3,3 | LTN |
| 3,4–4,4 | MTN |
| 4,5–5,5 | HTN |
| 5,6–6,6 | Chadlite |
| 6,7–7,7 | Chad |
| 7,8–8,8 | Adam |
| 8,9–10,0 | True Adam |

São rótulos subjetivos pedidos para o app, sem validação científica. As faixas não mudaram.

### Potencial

É o cenário superior de uma faixa **heurística de variação técnica da captura**, não uma previsão de beleza ou da próxima nota. Não altera a nota geral. Sem dados confiáveis, mostra `— / Não estimado`.

Com `rampa(x,a,b)=limitar((x−a)/(b−a),0,1)`, `S=geral`, `c=fração escura+clara`, `b=diferença relativa das médias laterais`, `t=inclinação frontal`, `r=roll` e `o=distância normalizada ao centro`:

```text
L = 0,5 × rampa(c,0,02,0,20) + 0,5 × rampa(b,0,08,0,50)
A = rampa(t,3,25)
R = 1 − 0,25 × rampa(r,2,20)
C = 1 − 0,25 × rampa(o,0,04,0,25)
U = (0,4L + 0,6A) × R × C
Δ = mínimo(1,5; 10−S) × U
faixa = [máximo(0; S−Δ), mínimo(10; S+Δ)], arredondada a uma casa
potencial = limite superior
```

As condições completas estão em `src/lib/capture-potential.ts` e nos testes. A geral já exige pose até 15° antes do cálculo. A próxima nota pode subir, cair, ficar igual ou sair dessa faixa. Não é intervalo de confiança estatístico nem garantia de melhoria.

## Testes, imagens e limites de confiança

`tests/fixtures/calibration-images.ts` gera imagens autorais procedurais em memória para condições conhecidas de luz, ganho, desfoque e textura. São testes numéricos adequados e sem dados pessoais, **não fotografias reais consentidas nem calibração populacional**. Testes com pontos controlados verificam respostas de cada região, invariância no plano e abstenção de pose. A suíte E2E verifica fontes locais, formatação, layout, ausência de uploads e modelos reais carregados com imagens sintéticas. Detectores/máscaras são substituídos somente em testes explicitamente marcados de integração.

**Não foi demonstrada precisão estética ou ausência de viés entre grupos.** Não há atributos demográficos na fórmula, mas o MediaPipe e os índices podem ter vieses. Validação em pessoas reais requer conjunto consentido, representativo e protocolo independente. Os resultados não devem orientar diagnósticos, procedimentos ou comparações populacionais.

## Vercel e publicação

`vercel.json` fixa preset Next.js, `npm ci` e **`npm run build`**, preservando o hook de preparação de modelos. Não use `next build` diretamente, pois pula `prebuild`. Use raiz do repositório, Output Directory padrão e Node.js LTS suportado (recomendado 24.x). O build precisa de rede para baixar modelos e Google Fonts; não há serviço de inferência remoto no navegador. Manrope é servida localmente por `next/font` depois do build.

Um push para a branch conectada pode disparar deploy automático. O HTML identifica `data-calibration="2"` e `data-build` com `VERCEL_GIT_COMMIT_SHA` (ou `local` fora da Vercel), permitindo conferir que o domínio serve o commit certo. Não são segredos ou dados de selfies.

Fontes: [Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js), [Image Segmenter](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter/index), [Manrope](https://github.com/google/fonts/tree/main/ofl/manrope). Respeite as licenças/termos dos modelos, do runtime Apache-2.0 e da fonte SIL Open Font License ao redistribuir os assets.

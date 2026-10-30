# ChadScore

Next.js, TypeScript, Tailwind CSS e **MediaPipe local e gratuito**. Interface minimalista #050505, cards grafite #111216, tipografia Manrope via `next/font`, bordas prateadas, reflexos branco frio e acentos azul-gelo #8CCBFF. Sem conta, chave, backend de upload ou API paga para analisar selfies.

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

A página inicial contém logo e seletor FaceScan/MogBattle. No FaceScan, permanecem a ilustração SVG autoral, **Tirar foto**, **Selecionar foto** e **Analisar rosto**. Os dois botões de captura ficam sempre visíveis, lado a lado. A prévia circular substitui a ilustração; os mesmos botões permitem trocar a imagem. Animações respeitam movimento reduzido. O FaceScan não tem checkbox nem validação de idade. **Analisar rosto** habilita com uma imagem válida e só inicia a inferência ao ser acionado. A prévia não exibe landmarks inventados antes da inferência. Apenas erros operacionais são mostrados quando necessário; os estados de validação/análise são anunciados de forma acessível.

Rosto/prévia e controles ficam em exatamente dois cards #111216 com glass discreto, separados por 18 px. Eles compartilham a largura máxima de 576 px e o raio de 28 px dos resultados. O logo fica próximo ao primeiro card; não há centralização vertical que crie um grande espaço vazio acima dele. O botão de análise válido usa gradiente branco frio/azul-gelo; desabilitado, permanece escuro.

A ilustração inicial é um wireframe masculino autoral, angular e simétrico, com mandíbula larga e quadrada, queixo forte, maçãs marcadas, sobrancelhas baixas, nariz reto e pescoço largo. Usa somente SVG transparente, linhas e pontos azul-gelo/brancos. É decorativa, não define um padrão de beleza e não é importada pelo detector ou pela calibração. Não altera os pontos da selfie nem as notas reais.

Os avisos essenciais estão na página separada **`/privacidade`**. O FaceScan não registra um aceite fictício nem envia um parâmetro de consentimento automático ao provider.

## FaceScan e MogBattle local

O seletor abaixo do logo alterna entre **FaceScan** (análise individual preservada) e **MogBattle** (duas pessoas), sem mudar fórmulas, escala, arredondamento ou faixas PSL. Trocar de modo desmonta o fluxo anterior, cancela workers ativos e descarta suas fotos. Atualizar a página também descarta a batalha.

No MogBattle, cada participante tem nome opcional, câmera com permissão nativa, galeria, prévia circular, troca e remoção. **Iniciar batalha** começa imediatamente as análises das duas fotos válidas, sem checkbox, modal, pop-up ou confirmação prévia. O botão permanece desabilitado enquanto faltar uma foto válida ou houver validação/análise em andamento. As orientações para usar somente imagens autorizadas pelos participantes ficam em **`/privacidade`**, sem interromper o fluxo; o app não verifica nem registra autorização. Nomes e selfies nunca são enviados ou persistidos. Sem nome, usa Participante 1/2.

**Selecionar foto** usa azul-gelo #8CCBFF, texto preto, glow discreto e resposta suave de hover/press nos dois modos (incluindo os dois participantes e a alternativa de galeria da câmera). **Tirar foto** permanece escuro com borda prateada. Movimento reduzido desativa as transições.

- `src/lib/battle-analysis.ts` é a orquestração local sobre o mesmo `faceAnalysisProvider`. As duas inferências são sequenciais para evitar dois runtimes WASM simultâneos no celular. Cache por identidade do `File`, restrito à batalha em memória, evita refazer um sucesso após a falha da outra foto. Cancelamento não coloca respostas atrasadas no cache. Arquivos removidos são excluídos do cache; encerrar reinicia o cache completo.
- `src/lib/mogbattle.ts` compara os **mesmos décimos arredondados** que o FaceScan exibe. A diferença é calculada em inteiros de décimos para evitar resíduos de ponto flutuante. Nota maior vence; igualdade dá empate. Erro ou nota geral indisponível nunca declara vencedor.
- `FaceLandmarkPortrait` compartilha o mesmo SVG/transformação de imagem e pontos nos dois modos. Os pontos são os já detectados, sem outra inferência. O perdedor recebe apenas `filter: grayscale(1)` na imagem renderizada e selo visual MOGGADO; o arquivo original não muda. O vencedor tem uma borda discreta, sem coroa. Empates mantêm ambos coloridos e sem selo.
- A comparação detalhada contém geral, as dez regiões e as medições numéricas já presentes no relatório. Notas disponíveis recebem destaque azul-gelo quando maiores; igualdade indica empate e ausência mostra `—`. Simetria é o **erro RMS já calculado**, identificado como tal, não uma nova nota inventada. Erros geométricos e razões são **descritivos, sem vencedor**, pois maior não significa melhor. Medições de métodos/unidades diferentes não são confundidas.
- **Batalhar novamente**, remover/trocar foto, sair do modo ou desmontar a página revoga URLs temporárias e descarta o estado correspondente. Câmeras e workers são encerrados. Não há garantia de apagamento criptográfico imediato da memória gerenciada.
- Os resultados são pontuações estéticas subjetivas desta captura, sem validade científica como medição de beleza ou valor pessoal. Pose, luz e erros de detecção podem alterar comparações.

O fundo global usa gradientes quase pretos, grid estático de baixa opacidade, vinheta e uma pequena textura SVG repetida (`public/grain.svg`). Sem filtros de ruído animados, imagens externas, verde ou computação por quadro. Os cards preservam grafite, prata e azul-gelo; `prefers-reduced-motion` desativa as animações de interface.

### Planejado: MogBattle Live (não implementado)

Ideia futura: contas, amigos, convites, batalhas online em tempo real, câmera própria de cada participante, escaneamento simultâneo e resultado quando ambas as análises terminarem. A comparação pura, o provider e a orquestração foram separados da interface para permitir reutilização futura. **Esta versão não cria contas, servidores, transporte de imagens, streaming, WebRTC, serviços pagos ou conexões de batalha remotas.** Uma versão Live exigiria outro projeto de consentimento, segurança, autenticação e privacidade, sem presumir autorização para compartilhar imagens.

A câmera usa `getUserMedia` somente após uma ação explícita, com permissão do navegador e sem áudio. A captura é convertida em JPEG local, sem espelhamento e com lado máximo de 1280 px, e exige confirmação. Fechar (inclusive Escape), capturar ou sair do componente para todos os tracks; permissões resolvidas após fechar também são descartadas. Refazer solicita a câmera novamente. Sem câmera, sem suporte ou sem permissão, a seleção de arquivo/galeria permanece disponível. A câmera requer HTTPS ou localhost. Os testes de câmera usam streams sintéticos em memória; não acessam uma câmera física.

- Aceita JPG, PNG e WebP até 5 MB e 16 megapixels. Valida tipo, assinatura e decodificação local.
- A escolha/captura e o início da análise são ações explícitas e distintas; nenhuma inferência começa só por escolher a foto. Não há confirmação ou checagem de idade.
- Um worker recebe o arquivo por structured clone **dentro do navegador**, nunca por HTTP. A inferência usa CPU/WASM, não uma função serverless. Não há câmera automática, analytics ou service worker.
- O Face Landmarker procura até dois rostos; zero/múltiplos, pontos inválidos, rosto pequeno ou enquadramento inadequado geram erro sem resultado fabricado.
- Pele/Cabelo usam Image Segmenter e pixels locais. Máscaras, pixels e coordenadas completas não entram no relatório. Falha/insuficiência de uma região produz `—`, não uma nota de substituição.
- A sessão contém relatório, URL `blob:` da selfie original e os landmarks normalizados com dimensões da imagem analisada, somente em memória. Os pontos ficam separados do relatório e são reutilizados por **Visualizar análise facial**, sem nova inferência. Nova análise, atualização/fechamento ou descarte libera a sessão e revoga a URL. Não há escrita de fotos em banco/disco, cookies, URLs remotas, localStorage ou sessionStorage.
- O worker, bitmaps, máscaras, instâncias MediaPipe e canvases são liberados ao concluir/cancelar. O timeout local é de 60 s. Não há garantia de apagamento criptográfico imediato da memória gerenciada.
- A CSP do worker limita scripts e conexões à origem local; os testes verificam que só há GETs locais para recursos estáticos. Apenas código, fontes, WASM e modelos podem entrar no cache normal do navegador.

## Calibração estética subjetiva v3

### Visualização facial local

Nos resultados, a selfie circular central já exibe os landmarks reais, com pontos azul-gelo/branco frio e contornos oficiais do MediaPipe para olhos, sobrancelhas, nariz, lábios, mandíbula e contorno facial. **Visualizar análise facial** expande os controles de região; o controle de visibilidade permanece sempre disponível. Imagem e pontos compartilham um único `viewBox` SVG e o mesmo recorte circular (`xMidYMid slice`), sem espelhamento, respeitando a orientação EXIF e a escala proporcional usada no worker. Pontos fora da imagem não são deslocados nem conectados.

Os círculos ATUAL/POTENCIAL representam exclusivamente os valores existentes, com arcos proporcionais de 0 a 10 e texto com vírgula. As dez regiões ficam sempre em duas colunas, com barras graduais e marcador proporcional. Valores indisponíveis exibem `—`, sem arco, marcador ou valor acessível fabricado. Círculos e barras têm preenchimento suave e sem animação em `prefers-reduced-motion`. As fórmulas não mudam.

Os resultados agrupam foto, indicadores, PSL, regiões e a ação de nova análise em superfícies escuras arredondadas, com contorno, glass e glow discretos. Não há observações explicativas visíveis entre esses blocos; os avisos gerais permanecem em `/privacidade`. A descrição técnica de Potencial é associada ao indicador para leitores de tela, sem ocupar espaço visual.

A topologia estática em `src/lib/face-overlay.ts` deriva do MediaPipe (Apache-2.0); não carrega outro detector. A visualização não modifica notas, PSL, Potencial ou calibração. Capturas sem confiança agora pedem outra foto antes dos resultados. Os pontos representam geometria da foto, não beleza objetiva.

**Critérios, investigação, fórmulas e limitações completos: [docs/CALIBRATION.md](docs/CALIBRATION.md).**

O caso de Pele 9,9 relatado sem imagem não pode ser diagnosticado/reproduzido individualmente. Foram corrigidos pontos cegos verificáveis do algoritmo: platôs, normalização pelo rosto inteiro, diluição de irregularidades e bônus por nitidez. Não foi aplicado desconto artificial, nota aleatória ou distribuição-alvo de beleza.

### Geometria e geral

Fonte única dos pesos/alvos: `src/lib/calibration.ts`. A v3 usa **70% estrutura aparente e 30% harmonia/simetria**, com média harmônica ponderada, não soma linear. Estrutura considera largura/angularidade mandibular, proporções do queixo, contorno malar, abertura/inclinação dos olhos e relações com sobrancelhas. Os alvos são preferências subjetivas do app, não padrões científicos. Tom Welling, Ian Somerhalder e Marlon Lundgren Garcia são somente inspiração estética verbal; nenhuma foto ou medida dessas pessoas entrou na calibração.

```text
critério estrutural = 10 / (1 + (|medida − alvo| / meia_resposta)²)
H(valores,pesos) = soma(pesos) / soma(peso/valor)
forma regional = H(critérios da região, pesos configurados)
região estrutural = H([forma, equilíbrio bilateral], [0,75, 0,25])
estrutura = H([mandíbula, queixo, maçãs, olhos, sobrancelhas], [0,30, 0,20, 0,20, 0,20, 0,10])
harmonia = 10 / (1 + média((erro bilateral regional / 0,08)²))
geral = arredondar_1_casa(H([estrutura, harmonia], [0,70, 0,30]))
```

A referência 0,08 é meia-resposta técnica, não norma biológica. A agregação usa valores não arredondados. Nariz/lábios continuam bilaterais; Harmonia inclui as sete regiões bilaterais. Simetria perfeita sozinha não garante 10. Não há desconto fixo, bônus de captura ou favoritismo por ordem de foto. Todos os alvos, pesos e medições estão documentados em [CALIBRATION.md](docs/CALIBRATION.md).

A proposta 60/25/15 foi avaliada: apresentação poderia deslocar a geral em 1,5 ponto sem mudar nenhum ponto facial, além de depender de foco, textura e cabelo visível. Por isso pele/cabelo continuam independentes (0% na geral); 70/30 é uma escolha de produto testada, não uma distribuição estética cientificamente ótima.

Exige matriz de pose até 12°, rosto com ≥160 px, detalhe canônico ≥0,015, clipping ≤20%, desequilíbrio lateral ≤35% e expressão neutra verificada por blendshapes e abertura labial. Falta de confiança solicita outra captura, sem nota ou vencedor. Escala, translação e rotação no plano são normalizadas quando possível; perspectiva/lente não são reconstruídas. Esses gates são heurísticos e não garantem equivalência entre fotos aceitas. Prefira distância/lente semelhantes e luz difusa. Contornos e sombras não são estrutura óssea real.

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

As condições completas estão em `src/lib/capture-potential.ts` e nos testes. A geral v3 já exige pose até 12° antes do cálculo. A próxima nota pode subir, cair, ficar igual ou sair dessa faixa. Não é intervalo de confiança estatístico nem garantia de melhoria.

## Testes, imagens e limites de confiança

`tests/fixtures/calibration-images.ts` gera imagens autorais procedurais em memória para condições conhecidas de luz, ganho, desfoque e textura. São testes numéricos adequados e sem dados pessoais, **não fotografias reais consentidas nem calibração populacional**. Testes com pontos controlados verificam respostas de cada região, invariância no plano e abstenção de pose. A suíte E2E verifica fontes locais, formatação, layout, ausência de uploads e modelos reais carregados com imagens sintéticas. Detectores/máscaras são substituídos somente em testes explicitamente marcados de integração.

**Não foi demonstrada precisão estética ou ausência de viés entre grupos.** Não há atributos demográficos na fórmula, mas o MediaPipe e os índices podem ter vieses. Validação em pessoas reais requer conjunto consentido, representativo e protocolo independente. Os resultados não devem orientar diagnósticos, procedimentos ou comparações populacionais.

## Vercel e publicação

`vercel.json` fixa preset Next.js, `npm ci` e **`npm run build`**, preservando o hook de preparação de modelos. Não use `next build` diretamente, pois pula `prebuild`. Use raiz do repositório, Output Directory padrão e Node.js LTS suportado (recomendado 24.x). O build precisa de rede para baixar modelos e Google Fonts; não há serviço de inferência remoto no navegador. Manrope é servida localmente por `next/font` depois do build.

Um push para a branch conectada pode disparar deploy automático. O HTML identifica `data-calibration="3"` e `data-build` com `VERCEL_GIT_COMMIT_SHA` (ou `local` fora da Vercel), permitindo conferir que o domínio serve o commit certo. Não são segredos ou dados de selfies.

Fontes: [Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js), [Image Segmenter](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter/index), [Manrope](https://github.com/google/fonts/tree/main/ofl/manrope). Respeite as licenças/termos dos modelos, do runtime Apache-2.0 e da fonte SIL Open Font License ao redistribuir os assets.

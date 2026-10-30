# Calibração estética subjetiva v3 — limites e critérios

## O que esta revisão pode e não pode afirmar

Não existe uma verdade objetiva de beleza para ajustar esta escala. As notas são índices estéticos subjetivos da foto, **não avaliação validada, percentil, diagnóstico ou valor pessoal**. Não há classificação de etnia, cor natural, idade ou outros atributos demográficos. Os alvos de proporções abaixo são preferências explícitas do produto, não normas anatômicas/populacionais. Tom Welling, Ian Somerhalder e Marlon Lundgren Garcia foram considerados somente como inspiração verbal de traços marcantes: nenhuma fotografia, identidade ou medida dessas pessoas foi usada para ajustar parâmetros ou validar resultados.

O relato de Pele 9,9 não pôde ser reproduzido sem a foto correspondente; não se presumiu acne, doença ou condição dermatológica. A revisão encontrou limitações concretas no código anterior: platô de textura abaixo de 0,025, diluição de irregularidades na média de poucas áreas, perda de contraste de média escala e até 30% de bônus por nitidez. Elas foram substituídas por medições e testes, **não por um desconto fixo, um teto arbitrário ou uma distribuição-alvo de notas**.

Os testes de calibração usam imagens procedurais de pixels geradas pelo próprio projeto em memória, com máscaras sintéticas conhecidas. Não há retratos reais, imagens de terceiros sem consentimento, downloads de fotografias ou persistência das imagens. São adequadas para regressão numérica controlada de exposição, gradiente de luz, textura, desfoque e geometria — **não substituem um conjunto de fotografias humanas consentidas**. Não provam ausência de viés do MediaPipe ou equivalência de desempenho entre grupos. Essa validação populacional continua pendente e exigiria consentimento, protocolo e revisão independentes.

## Geometria: Olhos, Sobrancelhas, Nariz, Lábios, Mandíbula, Queixo e Maçãs do rosto

1. Converte os pontos em pixels, respeitando a razão de aspecto. Corrige rotação no plano pelos cantos dos olhos e mantém o eixo mediano da testa/ponte nasal/queixo.
2. Exige matriz MediaPipe válida e inclinação frontal estimada **até 12°**, além dos requisitos de captura abaixo. Falha faz o provider solicitar outra foto, sem navegar aos resultados ou declarar vencedor. O relatório interno admite notas nulas para diagnóstico/testes, sem converter perspectiva em punição à pessoa. O limiar é heurístico, não certificado clínico de pose.
3. Em cada região, calcula a reflexão bilateral com **RMS**, não média simples. A largura de referência passa a ser a maior separação horizontal dos pares da própria região. Assim, um desvio de 5% da largura do nariz não é diluído pela largura do rosto inteiro. Isso não impõe um nariz, olho ou mandíbula de tamanho ideal.
4. Olhos combinam por RMS reflexão de quatro pares, diferença relativa de largura e diferença relativa da relação abertura/largura. Larguras iguais, por si só, já não geram uma nota perfeita.
5. O componente bilateral da mandíbula combina por RMS reflexão do par 172/397 e diferença relativa de distância de cada lado ao queixo. A v3 acrescenta ângulos do contorno 2D, nunca ângulos ósseos reais.
6. Sobrancelhas, nariz, lábios, queixo e contorno das maçãs usam os pares documentados no README, com normalização regional. Pares ausentes, fora da imagem, colapsados ou com largura regional menor que 8 px deixam a região sem nota.

Para cada erro regional `e`, a resposta é contínua:

```text
componente = 100 / (1 + (e / 0,08)²)
equilíbrio regional = componente / 10
```

`0,08` é a referência técnica de **meia-resposta**, não um limite de normalidade ou parâmetro calibrado em beleza humana. Zero erro mensurado pode produzir 10,0; a revisão não proíbe notas altas quando os critérios realmente as produzem. Fora de zero, não há zona morta com nota máxima nem corte brusco para zero.

## Estrutura aparente: critérios, alvos e pesos

Fonte única: `src/lib/calibration.ts`; medições em `src/lib/structural-geometry.ts`. Cada critério usa `10 / (1 + (|medida − alvo| / meia_resposta)²)`. Não há bônus, desconto fixo, percentil ou normalização pelo melhor rosto do lote. Valores nos dois lados do alvo caem continuamente; uma mandíbula cada vez mais larga não é automaticamente melhor.

| Região | Critério 2D | Alvo | Meia-resposta | Peso na forma regional |
| --- | --- | ---: | ---: | ---: |
| Mandíbula | largura 172–397 / 234–454 | 0,78 | 0,16 | 55% |
| Mandíbula | média dos ângulos 132–172–176 e 361–397–400 | 125° | 25° | 45% |
| Queixo | largura 148–377 / mandíbula | 0,38 | 0,15 | 35% |
| Queixo | altura boca–152 / 2–152 alinhada | 0,60 | 0,18 | 35% |
| Queixo | ângulo 148–152–377 | 135° | 25° | 30% |
| Maçãs | largura malar 234–454 / mandíbula | 1,25 | 0,25 | 50% |
| Maçãs | contorno 93–323 / 234–454 | 0,94 | 0,12 | 50% |
| Olhos | média abertura / largura de cada olho | 0,26 | 0,16 | 30% |
| Olhos | média inclinação canto interno–externo (positiva: externo acima) | 4° | 8° | 30% |
| Olhos | distância vertical média sobrancelha–olho / largura ocular | 0,55 | 0,35 | 40% |
| Sobrancelhas | inclinação absoluta média dos extremos 70–105 e 300–334 | 0° | 12° | 35% |
| Sobrancelhas | distância de 63/293 à linha dos extremos / largura | 0,06 | 0,12 | 35% |
| Sobrancelhas | largura / largura ocular | 1,10 | 0,35 | 30% |

Forma regional = média harmônica ponderada dos critérios da região. Nota estrutural regional = média harmônica de **75% forma e 25% equilíbrio bilateral**. Estrutura total = média harmônica das regiões: **mandíbula 30%, queixo 20%, maçãs 20%, olhos 20%, sobrancelhas 10%**. Nariz e lábios permanecem índices bilaterais e participam de Harmonia. Contornos ausentes/colapsados não recebem fallback.

Não se mede definição sob sombras, projeção óssea, gordura, profundidade de maçãs, espessura de sobrancelha ou qualidade intrínseca. Alguns indicadores são correlacionados (largura mandíbula/malar e sua inversa); seus pesos são preferências, não sinais independentes ou uma validação científica. A medida de harmonia abaixo é de equilíbrio bilateral, não uma medição completa de harmonia estética.

## Geral unificada e Harmonia facial

Com `H(valores,pesos) = soma(pesos) / soma(peso/valor)`:

```text
harmonia = 10 / (1 + média((erro_região / 0,08)²))
geral = arredondar_1_casa(H([estrutura, harmonia], [0,70, 0,30]))
```

As agregações usam valores não arredondados; apenas as notas exibidas são arredondadas. `scoring` conserva os dois valores internos para auditoria da fórmula. Zero em um componente resulta em zero; componente ausente invalida a agregação. Evita que excelente simetria esconda estrutura fraca nos critérios definidos. Simetria perfeita sozinha já não garante 10. Uma geral ≥9,5 exige estrutura acima de 9,3 mesmo com harmonia perfeita, sem proibir notas altas quando todos os critérios são atendidos. **Todas as sete regiões bilaterais e todos os critérios estruturais precisam estar disponíveis**.

### Por que não 60/25/15?

Foi avaliada a proposta linear: com os mesmos pontos, variar apresentação de 0 a 10 alteraria a geral em **1,5 ponto**, sem qualquer diferença estrutural. Os testes de pixels mostram que foco, textura e cabelo não visível podem alterar ou invalidar os índices de pele/cabelo. Renormalizar quando cabelo falta mudaria o significado da nota entre pessoas. Escolheu-se **70/30/0**, aproximando os pesos relativos 60/25 dos dois blocos geométricos e preservando pele/cabelo como índices independentes. A comparação controlada e a ausência de influência estão testadas, mas **não demonstram que 70/30 é uma distribuição estética ótima**. Os valores são escolhas subjetivas revisáveis, sem calibração em fotos humanas consentidas.

PSL usa exatamente as mesmas faixas anteriores e apenas a nota geral arredondada. A grafia é Sub 3, Sub 5, LTN, MTN, HTN, Chadlite, Chad, Adam e True Adam. Sem geral confiável, PSL também é `—`.

## Pele: textura aparente, não saúde nem cor natural

A segmentação multiclasses, as cinco áreas adaptativas e os critérios de cobertura/confiança continuam necessários. A seleção de áreas usa confiança, luz e suficiência — nunca escolhe a textura que daria a maior nota.

Dentro dos pixels confiáveis, seja `Y` a luma sRGB, `μ5` a média 5×5 e `μ13` a média 13×13 apenas de pixels classificados como pele, opacos, não saturados e com confiança ≥0,60. Exige ao menos 70% de vizinhos utilizáveis para essa segunda média. A normalização local reduz efeitos de ganho de brilho e luz suave, sem comparar tons a uma cor ideal:

```text
r = |Y − μ5| / máximo(μ5,0,001)
R = média de r por área, depois média das áreas
E = raiz(média de r² em todas as amostras)
M = média(|μ5 − μ13| / máximo(μ13,0,001))
V = desvio absoluto médio entre os resíduos médios das áreas
perda = 0,35R + 0,35E + 0,20M + 0,10V
pele = arredondar_1_casa(10 / (1 + perda / 0,10))
```

`E` torna irregularidades localizadas menos fáceis de diluir. `M` observa contraste de média escala que a janela 5×5 sozinha podia remover. Não há soma de pontos por foco, exposição ou câmera. A referência 0,10 é uma escolha de sensibilidade a contraste relativo (meia-resposta), não um diagnóstico ou percentil de textura. Os pesos não são aprendidos a partir de pessoas ou categorias demográficas.

**Nitidez vira condição de elegibilidade**, com a definição de referência `D≥1,25`, além dos mínimos de gradiente/amostras já existentes. O limite separa a borda sintética definida da imagem suavizada nos testes; não detecta todo desfoque, filtro ou oclusão do mundo real. Falta de foco não faz a pele ganhar nota por parecer lisa: produz `—`. Nitidez acima desse mínimo não aumenta a nota.

A resolução canônica de aparência continua limitada à largura facial de até 160 px. Pequenos detalhes apagados por redução, filtros ou compressão podem ser irrecuperáveis. O resultado **não avalia integralmente a pele real**, não distingue com segurança maquiagem, sardas, relevo, reflexos, manchas de imagem ou condições dermatológicas. Mesmo a normalização local pode ter vieses não medidos; não há promessa de igualdade populacional baseada apenas nestes testes.

## Cabelo: sinais relativos mensuráveis

Quantidade/cobertura permanece somente um critério de suficiência; não rende pontos. Não há inferência de densidade real, saúde, qualidade intrínseca, tipo de cabelo ideal ou direção desejável de fios.

A definição absoluta também deixa de ser um bônus de até 70%. Em vez disso, mede-se a consistência relativa de definição e gradiente nas células válidas da grade 4×4:

```text
CVd = MAD(definição das células) / máximo(média da definição,0,001)
CVg = MAD(gradiente médio das células) / máximo(média dos gradientes,0,001)
perda = 0,5CVd + 0,5CVg
cabelo = arredondar_1_casa(10 / (1 + perda))
```

Exige `D≥0,5` e os mínimos anteriores de máscara, confiança, área e sinal. Nitidez menor ou área não confiável gera `—`, não uma nota baixa de cabelo. Uma textura medida uniforme pode produzir nota alta, inclusive 10,0: não se aplica desconto para forçar notas menores. A métrica não consegue julgar estilo, identidade, preferências ou distinguir todos os reflexos/ruídos de detalhes reais. Texturas naturais distintas podem afetá-la; **não está validada para comparar tipos de cabelo ou grupos**.

## Potencial e captura

A fórmula de Potencial permanece documentada no README, agora aplicada à geral v3: cenário superior de uma faixa heurística de variação técnica da captura, sem prever beleza futura ou garantir melhoria. Só é calculado quando a geral existe e há dados opcionais de luz válidos. Cor, textura e nitidez não são usadas para aumentar a geometria. Uma nova captura pode mudar os pontos do detector; invariância de pontos controlados não garante invariância do MediaPipe em fotografias reais.

`src/lib/capture-confidence.ts` exige: pose até 12°, rosto com ≥160 px na imagem analisada, amostragem canônica de 120–193 px de largura facial, ≥256 amostras, RMS do laplaciano relativo ≥0,015, clipping ≤20% e desequilíbrio lateral ≤35%. O sampler reduz a largura a até 192 px e limita o canvas a 1024 px no maior lado; não aumenta imagens pequenas. A largura é conservadora: o worker já pode ter reduzido imagens grandes.

Exige blendshapes válidos de boca aberta, sorrisos, piscadas e elevação das sobrancelhas, todos ≤0,45; abertura entre lábios 13–14 / largura boca ≤0,10. Metadata ausente, inválida ou expressão forte solicita outra foto. Esses limites são heurísticos: ruído pode passar como detalhe, oclusões/filtros/expressões podem não ser detectados, e não se pode recuperar distância focal ou corrigir perspectiva de uma única foto. **Use distância e lente semelhantes, câmera centralizada, expressão neutra e luz difusa**. O gate reduz erros conhecidos, não garante comparabilidade de toda foto aceita. Qualidade acima do mínimo nunca rende pontos.

## Testes e proveniência

- `tests/fixtures/calibration-images.ts`: geração determinística em memória; não contém imagens de pessoas.
- `tests/calibration.test.ts`: monotonicidade de contraste irregular, exposição não saturada, iluminação suave, abstenção em desfoque, pose, resposta de cada região, consistência de nota geral/PSL/Potencial e ausência de bônus de nitidez.
- `tests/structural-calibration.test.ts`: pesos, resposta ao alvo de cada critério, variantes de mandíbula/queixo/contorno, escala/translação, falta de dados, expressão, pose, detalhe/exposição, sensibilidade da proposta 60/25/15 e empates.
- Testes existentes: segmentação/presença reais de MediaPipe em imagens sintéticas, lifecycle do worker, segurança de assets, confidência, ausência de uploads e persistência, layout mobile/desktop e formatação brasileira.
- A fonte Manrope é baixada por `next/font` no build e servida localmente. Não é uma API paga nem uma conexão runtime com Google Fonts.
- `data-calibration="3"` e `data-build` no HTML permitem verificar a versão publicada e o SHA fornecido pela Vercel, sem expor segredo ou dados de selfies.

**Não alegar:** precisão estética validada, ausência comprovada de viés, calibração em fotos humanas reais, reconstrução da aparência sem efeitos da captura ou detecção de saúde por imagem. Esses resultados não são demonstrados por esta suíte.

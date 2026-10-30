# Calibração técnica v2 — limites e critérios

## O que esta revisão pode e não pode afirmar

Não existe uma verdade objetiva de beleza para ajustar esta escala. As notas continuam sendo índices técnicos subjetivos da foto, **não avaliação estética validada, percentil, diagnóstico ou valor pessoal**. Não há classificação de etnia, cor natural, idade ou outros atributos demográficos. Nenhuma proporção anatômica ideal ou média populacional é usada.

O relato de Pele 9,9 não pôde ser reproduzido sem a foto correspondente; não se presumiu acne, doença ou condição dermatológica. A revisão encontrou limitações concretas no código anterior: platô de textura abaixo de 0,025, diluição de irregularidades na média de poucas áreas, perda de contraste de média escala e até 30% de bônus por nitidez. Elas foram substituídas por medições e testes, **não por um desconto fixo, um teto arbitrário ou uma distribuição-alvo de notas**.

Os testes de calibração usam imagens procedurais de pixels geradas pelo próprio projeto em memória, com máscaras sintéticas conhecidas. Não há retratos reais, imagens de terceiros sem consentimento, downloads de fotografias ou persistência das imagens. São adequadas para regressão numérica controlada de exposição, gradiente de luz, textura, desfoque e geometria — **não substituem um conjunto de fotografias humanas consentidas**. Não provam ausência de viés do MediaPipe ou equivalência de desempenho entre grupos. Essa validação populacional continua pendente e exigiria consentimento, protocolo e revisão independentes.

## Geometria: Olhos, Sobrancelhas, Nariz, Lábios, Mandíbula, Queixo e Maçãs do rosto

1. Converte os pontos em pixels, respeitando a razão de aspecto. Corrige rotação no plano pelos cantos dos olhos e mantém o eixo mediano da testa/ponte nasal/queixo.
2. Exige matriz MediaPipe válida e inclinação frontal estimada **até 15°**. Com matriz ausente/inválida ou pose fora da faixa, as notas geométricas, Harmonia, geral e PSL ficam `—`, sem converter perspectiva em punição à pessoa. O limiar é conservador e heurístico, não certificado clínico de pose.
3. Em cada região, calcula a reflexão bilateral com **RMS**, não média simples. A largura de referência passa a ser a maior separação horizontal dos pares da própria região. Assim, um desvio de 5% da largura do nariz não é diluído pela largura do rosto inteiro. Isso não impõe um nariz, olho ou mandíbula de tamanho ideal.
4. Olhos combinam por RMS reflexão de quatro pares, diferença relativa de largura e diferença relativa da relação abertura/largura. Larguras iguais, por si só, já não geram uma nota perfeita.
5. Mandíbula combina por RMS reflexão do par 172/397 e diferença relativa de distância de cada lado ao queixo. Não estima ângulo ou estrutura óssea.
6. Sobrancelhas, nariz, lábios, queixo e contorno das maçãs usam os pares documentados no README, com normalização regional. Pares ausentes, fora da imagem, colapsados ou com largura regional menor que 8 px deixam a região sem nota.

Para cada erro regional `e`, a resposta é contínua:

```text
componente = 100 / (1 + (e / 0,08)²)
nota regional = arredondar_1_casa(componente / 10)
```

`0,08` é a referência técnica de **meia-resposta**, não um limite de normalidade ou parâmetro calibrado em beleza humana. Zero erro mensurado pode produzir 10,0; a revisão não proíbe notas altas quando os critérios realmente as produzem. Fora de zero, não há zona morta com nota máxima nem corte brusco para zero.

## Geral unificada e Harmonia facial

Usam as sete regiões geométricas com pesos iguais, sem Pele/Cabelo ou qualidade da câmera:

```text
geral = arredondar_1_casa(10 / (1 + média((erro_região / 0,08)²)))
harmonia = geral
```

Equivale à média harmônica dos componentes não arredondados. Evita que regiões perfeitas escondam uma região menos equilibrada. **Todas as sete precisam estar disponíveis**; não se preenche a ausente com média, nota fixa ou zero. Pele e Cabelo podem continuar disponíveis como apresentação fotográfica independente.

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

A fórmula de Potencial permanece documentada no README: cenário superior de uma faixa heurística de variação técnica da captura, sem prever beleza futura ou garantir melhoria. Só é calculado quando a nota geral existe; uma matriz de pose acima de 15° já invalida a nota geral antes desse cálculo. Cor, textura e nitidez não são usadas para aumentar a geometria. Uma nova captura pode mudar os pontos do detector; invariância de pontos controlados em testes não garante invariância do MediaPipe em fotografias reais.

## Testes e proveniência

- `tests/fixtures/calibration-images.ts`: geração determinística em memória; não contém imagens de pessoas.
- `tests/calibration.test.ts`: monotonicidade de contraste irregular, exposição não saturada, iluminação suave, abstenção em desfoque, pose, resposta de cada região, consistência de nota geral/PSL/Potencial e ausência de bônus de nitidez.
- Testes existentes: segmentação/presença reais de MediaPipe em imagens sintéticas, lifecycle do worker, segurança de assets, confidência, ausência de uploads e persistência, layout mobile/desktop e formatação brasileira.
- A fonte Manrope é baixada por `next/font` no build e servida localmente. Não é uma API paga nem uma conexão runtime com Google Fonts.
- `data-calibration="2"` e `data-build` no HTML permitem verificar a versão publicada e o SHA fornecido pela Vercel, sem expor segredo ou dados de selfies.

**Não alegar:** precisão estética validada, ausência comprovada de viés, calibração em fotos humanas reais, reconstrução da aparência sem efeitos da captura ou detecção de saúde por imagem. Esses resultados não são demonstrados por esta suíte.

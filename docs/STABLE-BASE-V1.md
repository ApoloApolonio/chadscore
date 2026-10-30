# ChadScore Stable Base v1.0 (candidata)

Status: **candidata à base oficial, pendente de aprovação**. Nenhuma tag de release foi criada e esta revisão não foi publicada.

Data da auditoria: 30/10/2026.

## Escopo preservado

- Design, layout, tipografia, cores, animações, textos e fluxos existentes.
- Calibração v3: 70% estrutura aparente / 30% harmonia, pesos regionais, alvos, meias-respostas, faixas PSL, Potencial e índices independentes de pele/cabelo.
- Processamento local por MediaPipe, sem conta, backend de upload, API paga ou persistência de fotos.
- FaceScan e MogBattle usando o mesmo motor de relatório e a mesma nota arredondada.

## Evidências executadas

| Verificação | Resultado |
| --- | --- |
| Testes unitários (`npm test`) | 117 aprovados, 0 reprovados |
| Testes E2E (`npm run test:e2e`, Chromium) | 55 aprovados, 0 reprovados |
| ESLint (`npm run lint`) | sem erros |
| TypeScript (`npm run typecheck`) | sem erros |
| Build de produção (`npm run build`) | concluído, 4 rotas estáticas |
| `npm audit` | 0 vulnerabilidades conhecidas |
| Histórico Git | 8 revisões verificadas; 0 padrões de credencial; 0 imagens ou arquivos sensíveis versionados |
| Soak de 27 ciclos | 86 workers criados e 86 encerrados; 0 URLs temporárias restantes; 0 nós DOM e 0 listeners acumulados; localStorage/sessionStorage/IndexedDB/caches/service workers vazios |
| Rede durante análise | somente GETs da mesma origem para assets estáticos; nenhuma foto em requisição |

O soak usa uma regressão limitada de heap, DOM e listeners. Ele não prova ausência absoluta de vazamentos no navegador, WASM ou memória gerenciada.

## Correções comprovadas nesta auditoria

### 1. Falha de desserialização do worker

`messageerror` não tinha tratamento e podia deixar a promessa pendente até o timeout de 60 s. O encerramento do worker agora é idempotente: limpa timer, listener de cancelamento e todos os handlers, e termina o worker uma única vez. Coberto por `tests/worker-lifecycle.test.ts` para erro, `messageerror`, falha de `postMessage`, resposta atrasada, sucesso, timeout e cancelamento.

### 2. Sinal da inclinação cantal

O olho esquerdo usava a ordem externo→interno, enquanto o direito usava interno→externo. Em rostos simétricos os dois sinais se cancelavam, a medida ficava próxima de 0° e o critério era penalizado mesmo quando o canto externo estava acima, contrariando a convenção documentada em `docs/CALIBRATION.md`.

A correção iguala a convenção nos dois olhos (interno menos externo; positivo quando o externo está acima). Nenhum peso, alvo, meia-resposta, faixa PSL ou fórmula de agregação foi alterado. Um teste controlado verifica sinal, magnitude, resposta regional e estrutural.

### 3. Artefato de medição no teste de soak (somente teste)

O crescimento inicial de nós DOM era causado por `setInputFiles` do Playwright: o CDP mantém o `<input>` no grupo do DevTools e, com ele, a subárvore React já desanexada. O teste de soak passou a disparar o mesmo evento `change` com `DataTransfer` dentro da página. Com isso, workers, URLs, DOM e listeners permanecem estáveis. Nenhuma alteração foi necessária na aplicação.

## Calibração v3

- A agregação continua sendo média harmônica ponderada, sem arredondamento intermediário.
- Estrutura = 75% forma + 25% equilíbrio bilateral por região; regiões = 30/20/20/20/10.
- Harmonia usa as sete regiões bilaterais, meia-resposta de 0,08.
- Geral = 70% estrutura + 30% harmonia; apresentação = 0% na geral.
- Pele e cabelo continuam índices independentes, sem bônus por nitidez.
- PSL, Potencial e formatação com vírgula não mudaram.
- Fotos sem confiança continuam sem nota ou vencedor; expressões naturais não são rejeitadas por um único blendshape.

A correção do sinal cantal altera a medida de pontos que já eram aceitos, pois corrige a implementação para a convenção publicada. Não foi uma recalibração estética nem uma alteração de alvo.

## Limitações restantes

| Gravidade | Limitação |
| --- | --- |
| Média | Não havia fotografias humanas reais autorizadas. Os testes usam landmarks e imagens sintéticas; o MediaPipe real foi exercitado com imagem sem rosto e com detector substituído em testes explícitos. Precisão em selfies reais não foi validada. |
| Média | Limiares de qualidade e expressão são heurísticos, calibrados em fixtures controladas, e podem gerar falsos positivos/negativos em pele, iluminação, maquiagem, oclusão, lentes e expressões naturais atípicas. |
| Média | Não foi demonstrada ausência de viés entre grupos, tons de pele, tipos de cabelo ou formatos faciais. |
| Baixa | A verificação E2E foi executada apenas em Chromium; Firefox e Safari não foram executados nesta auditoria. |
| Baixa | A câmera física não foi acessada; os testes usam streams sintéticos. |
| Baixa | O soak cobre 27 ciclos e limites de heap/DOM/listeners. Não é um teste prolongado de horas nem prova de ausência de vazamento no WASM. |
| Baixa | `@mediapipe/tasks-vision` permanece fixado em 0.10.21; versões principais mais novas não foram adotadas para preservar a base estável. |
| Baixa | Não houve push, deploy ou leitura do estado `READY` da Vercel nesta etapa, conforme solicitado. |

## Conclusão

Não foram encontrados problemas críticos ou altos após as correções. A base está apta a receber novas funcionalidades **após aprovação explícita**, com a ressalva de que a precisão em fotografias humanas reais e a ausência de viés não estão demonstradas.

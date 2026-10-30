# ChadScore

Estrutura inicial com Next.js (App Router), TypeScript e Tailwind CSS v4.

## Requisitos

- Node.js 20.9 ou superior (recomendado: versão LTS)
- npm

## Executar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

No PowerShell, caso a política de execução bloqueie `npm.ps1`, use `npm.cmd install` e `npm.cmd run dev`. Não é necessário alterar a política do sistema.

## Comandos

- `npm run dev`: servidor de desenvolvimento.
- `npm run build`: build de produção.
- `npm start`: inicia o build de produção.
- `npm run lint`: verifica o código com ESLint.
- `npm run typecheck`: verifica os tipos com TypeScript.
- `npm test`: testa validação de arquivos e o adaptador de análise indisponível.

## Estrutura

- `src/app/page.tsx`: página inicial.
- `src/app/layout.tsx`: layout e metadados.
- `src/app/globals.css`: estilos globais e importação do Tailwind.

## Seleção de selfie

A interface mantém o tema escuro e permite escolher, visualizar, substituir e remover uma selfie. Aceita JPG, PNG e WebP de até 5 MB; verifica tipo, assinatura do arquivo e decodificação da imagem. Isso valida o arquivo, não a presença de um rosto.

O botão “Analisar meu rosto” fica habilitado somente após a validação. Ao clicar, a interface informa que a IA ainda não está conectada, sem produzir notas ou resultados fictícios.

A imagem fica somente na memória do navegador via URL temporária (`blob:`). As URLs são liberadas ao trocar/remover a foto ou desmontar o componente. Não há upload para servidor, persistência, armazenamento local ou serviço externo. Nenhuma variável de ambiente é necessária nesta etapa.

### Integração futura

- `src/components/selfie-upload.tsx`: estados de seleção, validação, pré-visualização e solicitação de análise.
- `src/lib/selfie.ts`: regras de validação local.
- `src/lib/face-analysis.ts`: contrato `FaceAnalysisProvider` e adaptador indisponível, sem chamadas de rede. Substitua sua implementação e amplie `FaceAnalysisResponse` ao integrar um serviço real; a interface já trata processamento e falhas.

Uma integração real deverá passar por um backend com validação própria, política explícita de privacidade e consentimento antes do envio. Mantenha credenciais exclusivamente no servidor; não use variáveis `NEXT_PUBLIC_*` para segredos. A validação no navegador não substitui a validação no backend.

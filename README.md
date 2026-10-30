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

## Estrutura

- `src/app/page.tsx`: página inicial.
- `src/app/layout.tsx`: layout e metadados.
- `src/app/globals.css`: estilos globais e importação do Tailwind.

A página usa tema escuro e inclui o botão “Analisar meu rosto”, desabilitado enquanto a funcionalidade não está disponível. Não há captura de imagem, upload ou análise facial implementados. Nenhuma variável de ambiente é necessária nesta etapa.

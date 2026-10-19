# ProMEC — ERP Multi-Segmento com Motor de Precificação por Custos Reais

ERP para oficinas mecânicas, usinagem e caldeiraria, com o preço de cada orçamento formado a partir do custo-hora real de cada centro de trabalho.

## Estrutura

| Pasta | O que é |
| --- | --- |
| `packages/motor` | Motor de custos e precificação (`@promec/motor`): funções puras em TypeScript com `decimal.js`, sem banco nem framework, usadas pelo backend e pelo frontend. Reproduz a planilha de referência ao centavo |
| `apps/api` | Backend NestJS 11 + Prisma 6 + PostgreSQL 16 (`@promec/api`), contrato em `docs/API.md` |
| `apps/web` | Frontend React 18 + Vite + Tailwind (`@promec/web`) na identidade Aço & Fagulha; recalcula o orçamento ao vivo com o mesmo motor |
| `docs/` | Especificação, prompt de design, tokens visuais e diagramas |

## Rodando localmente

```bash
npm install
npm run db:up                                   # PostgreSQL em localhost:5442
cp apps/api/.env.example apps/api/.env
npx -w @promec/api prisma migrate deploy        # aplica as migrações
npm run seed -w @promec/api                     # Usinagem Joinville (idempotente)
npm run dev:api                                 # compila o motor; API em http://localhost:3333/api/v1 · Swagger em /api/docs
npm run dev:web                                 # em outro terminal: http://localhost:5273
```

Login de desenvolvimento: `marina@usinagemjoinville.com.br` (gestora) ou `paulo@usinagemjoinville.com.br` (orçamentista), senha `SEED_SENHA` do `.env`.

## Testes

```bash
npm test                                        # motor, API (unitários) e web
npm run test:e2e -w @promec/api                 # API contra o banco local
```

## Documentação

| Arquivo | O que é |
| --- | --- |
| `docs/SPEC-ERP-Promec.md` | Especificação completa: visão, análise da planilha de referência, 12 módulos (objetivo, submódulos, regras, automações), arquitetura técnica e roadmap |
| `docs/PROMPT-CLAUDE-DESIGN.md` | Prompt autossuficiente para gerar o front-end no Claude Design, alinhado à SPEC |
| `docs/diagramas/` | Mapa de módulos, estados da OS e roadmap (PNG) |
| `docs/API.md` | Contrato da API da fase 1 |
| `docs/design/` | Tokens da identidade Aço & Fagulha (`promec-tokens.css`), preset do Tailwind (`tailwind.promec.js`) e telas do protótipo aprovado (`prototipo/`) |
| `docs/referencia/` | Planilha de precificação original (fica fora do Git) |

Decisões fixas: sem emissão fiscal (Financeiro = contas a pagar, contas a receber e fluxo de caixa; impostos só como % na precificação); custo-hora versionado por competência; Centro de Trabalho como abstração única.

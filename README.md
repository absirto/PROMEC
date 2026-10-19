# ProMEC — ERP Multi-Segmento com Motor de Precificação por Custos Reais

ERP para oficinas mecânicas, usinagem e caldeiraria, com o preço de cada orçamento formado a partir do custo-hora real de cada centro de trabalho.

## Estrutura

| Pasta | O que é |
| --- | --- |
| `packages/motor` | Motor de custos e precificação (`@promec/motor`): funções puras em TypeScript com `decimal.js`, sem banco nem framework, usadas pelo backend e pelo frontend. Reproduz a planilha de referência ao centavo |
| `docs/` | Especificação, prompt de design, tokens visuais e diagramas |

## Rodando os testes

```bash
npm install
npm test
```

## Documentação

| Arquivo | O que é |
| --- | --- |
| `docs/SPEC-ERP-Promec.md` | Especificação completa: visão, análise da planilha de referência, 12 módulos (objetivo, submódulos, regras, automações), arquitetura técnica e roadmap |
| `docs/PROMPT-CLAUDE-DESIGN.md` | Prompt autossuficiente para gerar o front-end no Claude Design, alinhado à SPEC |
| `docs/diagramas/` | Mapa de módulos, estados da OS e roadmap (PNG) |
| `docs/design/` | Tokens da identidade Aço & Fagulha (`promec-tokens.css`) e preset do Tailwind (`tailwind.promec.js`) |
| `docs/referencia/` | Planilha de precificação original (fica fora do Git) |

Decisões fixas: sem emissão fiscal (Financeiro = contas a pagar, contas a receber e fluxo de caixa; impostos só como % na precificação); custo-hora versionado por competência; Centro de Trabalho como abstração única.

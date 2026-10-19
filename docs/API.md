# API do ProMEC — fase 1

Contrato entre `apps/api` (NestJS) e `apps/web` (React). Base: `/api/v1`. JSON em pt-BR, `camelCase`.

## Convenções

- **Dinheiro, horas e percentuais trafegam como texto decimal** (`"117.7777777778"`, `"0.75"`) para não perder centavos. Percentuais são frações de 0 a 1. Datas em ISO 8601; competência em `AAAA-MM`.
- Toda rota exige `Authorization: Bearer <token>`, exceto `POST /auth/login`. O `tenantId` vem do token; nunca do corpo.
- Erros: `{ "mensagem": "texto para a pessoa", "codigo": "CODIGO_TECNICO", "detalhes"?: any }`. A mensagem segue a voz do produto: explica o porquê e diz o próximo passo. Validação → 400, não encontrado → 404, regra de negócio → 409 ou 422.
- Listas: `{ "itens": [...], "total": n }`, com `?q=` (busca) e `?status=` quando fizer sentido.
- Cálculos sempre com `@promec/motor` (`calcularTabelaCustos`, `calcularOrcamento`, `precoDaHora`). A API não reimplementa fórmula.

## Auth

| Método | Rota | Corpo | Resposta |
| --- | --- | --- | --- |
| POST | `/auth/login` | `{ email, senha }` | `{ token, usuario: { id, nome, email, papel } }`; 401 `CREDENCIAIS` |
| GET | `/auth/me` | | `{ id, nome, email, papel, empresa: { id, nome } }` |

`papel`: `ADMIN` · `GESTOR` · `ORCAMENTISTA` · `OPERADOR`.

## Parâmetros do tenant

`GET /parametros` · `PATCH /parametros`

```json
{ "nomeEmpresa": "Usinagem Joinville", "criterioRateio": "horas", "metodoPreco": "divisor",
  "impostosPadrao": "0.14", "comissaoPadrao": "0", "margemAlvo": "0.2", "margemMinima": "0.15",
  "validadeOrcamentoDias": 15 }
```

## Colaboradores

`GET /colaboradores` · `POST /colaboradores` · `GET|PATCH /colaboradores/:id` · `DELETE /colaboradores/:id` (inativa)

```json
{ "id": "…", "nome": "Paulo Henrique Souza", "funcao": "Operador de torno CNC", "vinculo": "CLT",
  "salario": "5000", "encargos": "3200", "beneficios": "0", "jornadaHoras": "220", "ativo": true,
  "custoMensal": "8200", "custoHora": "37.2727272727",
  "alocacoes": [{ "centroId": "…", "centroNome": "Torno CNC de entrada", "alocacao": "1" }] }
```

`vinculo`: `CLT` · `PJ` · `HORISTA` · `SOCIO`. `custoMensal` e `custoHora` são calculados (somente leitura).

## Centros de trabalho

`GET /centros-trabalho` · `POST /centros-trabalho` · `GET|PATCH /centros-trabalho/:id` · `DELETE /centros-trabalho/:id` (desativa)

```json
{ "id": "…", "codigo": "TCNC-01", "nome": "Torno CNC de entrada", "tipo": "maquina", "status": "ativo",
  "horasExpediente": "220", "eficiencia": "0.75", "manutencao": "700", "insumos": "700", "outros": "0",
  "valorAquisicao": "150000", "valorResidual": "0", "vidaUtilMeses": 60,
  "potenciaKw": "0", "fatorCarga": "0", "tarifaKwh": "0", "pesoManual": null, "areaM2": null,
  "operadores": [{ "colaboradorId": "…", "nome": "Paulo Henrique Souza", "alocacao": "1" }],
  "custoHoraVigente": "117.7777777778" }
```

`tipo` e `status` seguem `TipoCentro` e `StatusCentro` do motor. `custoHoraVigente` vem da Tabela de Custos vigente (ou `null`).

`GET /centros-trabalho/previa?competencia=2026-10` → `ResultadoTabela` do motor com os cadastros atuais e o custo fixo da competência, sem gravar nada (alimenta a prévia ao vivo do formulário e o what-if).

## Custo fixo

| Método | Rota | Observação |
| --- | --- | --- |
| GET | `/custo-fixo/competencias` | `[{ competencia, total, lancamentos }]`, mais recente primeiro |
| GET | `/custo-fixo?competencia=2026-10` | `{ competencia, total, lancamentos: [{ id, categoria, descricao, valor }] }` |
| POST | `/custo-fixo` | `{ competencia, categoria, descricao, valor }` |
| PATCH / DELETE | `/custo-fixo/:id` | |
| POST | `/custo-fixo/copiar` | `{ de: "2026-09", para: "2026-10" }` copia os lançamentos |

`categoria`: `agua` · `alarme` · `aluguel` · `contabilidade` · `luz` · `pessoalAdm` · `pessoalComercial` · `proLabore` · `seguros` · `sistemas` · `tarifas` · `taxasBancarias` · `telefone` · `treinamentos` · `outros`.

## Tabelas de custos

| Método | Rota | Observação |
| --- | --- | --- |
| GET | `/tabelas-custos` | `[{ id, competencia, versao, status, desatualizada, publicadaEm, criadaEm, resumo: { custoFixo, centros, cheioMedio, bloqueios } }]` |
| GET | `/tabelas-custos/vigente` | igual ao detalhe; 404 `SEM_VIGENTE` se não houver |
| GET | `/tabelas-custos/:id` | `{ …lista, entrada: EntradaTabela, resultado: ResultadoTabela, comparativo?: [{ centroId, nome, anterior, atual, variacao }] }` |
| POST | `/tabelas-custos` | `{ competencia }` → cria versão `RASCUNHO` a partir dos cadastros atuais |
| POST | `/tabelas-custos/:id/recalcular` | só rascunho; refaz a foto dos cadastros |
| POST | `/tabelas-custos/:id/publicar` | 409 `BLOQUEIOS` com `detalhes: Ocorrencia[]`; encerra a vigente anterior |
| DELETE | `/tabelas-custos/:id` | só rascunho |

`status`: `RASCUNHO` · `VIGENTE` · `ENCERRADA`. A versão vigente é imutável. Alterar colaborador, centro, custo fixo da competência vigente ou o critério de rateio marca a vigente como `desatualizada: true`. `comparativo` compara com a vigente anterior (variação em fração).

## Clientes

`GET /clientes?q=` · `POST /clientes` · `GET|PATCH /clientes/:id` · `DELETE /clientes/:id` (inativa)

```json
{ "id": "…", "tipo": "PJ", "documento": "12345678000190", "nome": "Metalúrgica Vale do Itajaí Ltda.",
  "fantasia": "Metalúrgica Vale", "email": "compras@metalvale.com.br", "telefone": "4733330000",
  "cidade": "Blumenau", "uf": "SC", "status": "ATIVO", "observacoes": "",
  "resumo": { "orcamentos": 4, "aprovados": 2, "valorAprovado": "12450.00" } }
```

CPF/CNPJ validado (dígitos) e único por tenant → 409 `DOCUMENTO_DUPLICADO`. `status`: `ATIVO` · `BLOQUEADO` · `INATIVO`.

## Orçamentos

Linha de entrada (o cliente manda; a API completa o custo-hora):

```json
{ "tipo": "operacao", "descricao": "Torneamento", "centroId": "…", "cicloHorasPorPeca": "0.1", "setupHorasPorLote": "3" }
```

Os demais tipos são iguais a `LinhaOrcamento` do motor (`material`, `materialCorte`, `ferramental`, `maoDeObra` com `centroId` no lugar de `custoHora`, `terceiro`, `frete`). Para `operacao` e `maoDeObra`, a API busca `cheioHora` e `rateioHora` do centro na Tabela de Custos referenciada pelo orçamento.

| Método | Rota | Observação |
| --- | --- | --- |
| GET | `/orcamentos?status=&q=` | `{ itens: [{ id, numero, titulo, cliente: { id, nome }, lote, status, versao, precoFinalLote, margemEfetiva, situacaoMargem, validade, atualizadoEm }], total, contagem: { RASCUNHO: n, … } }` |
| POST | `/orcamentos/simular` | corpo do orçamento → `ResultadoOrcamento` sem gravar (usa a tabela vigente ou `tabelaCustosId`) |
| POST | `/orcamentos` | `{ clienteId, titulo, segmento, lote, validade, impostos, comissao, margemAlvo, margemMinima, desconto, metodo, observacoes, linhas }` |
| GET | `/orcamentos/:id` | `{ …cabeçalho, linhas, tabelaCustos: { id, competencia, versao }, tabelaMaisNova: bool, resultado: ResultadoOrcamento, historico: [{ versao, status, precoFinalLote, data }] }` |
| PUT | `/orcamentos/:id` | substitui cabeçalho e linhas; só `RASCUNHO` ou `EM_NEGOCIACAO`. Se já foi enviado, gera nova versão |
| POST | `/orcamentos/:id/enviar` | 409 `MARGEM_ABAIXO_MINIMO` se `exigeAprovacao` e não liberado |
| POST | `/orcamentos/:id/liberar-margem` | `GESTOR`/`ADMIN`; `{ justificativa }` |
| POST | `/orcamentos/:id/negociar` · `/aprovar` · `/recusar` | `/recusar` recebe `{ motivo }` |
| POST | `/orcamentos/:id/atualizar-custos` | troca para a tabela vigente e gera nova versão |

`numero`: `ORC-AAAA-NNNNN` sequencial por tenant. `status`: `RASCUNHO` · `ENVIADO` · `EM_NEGOCIACAO` · `APROVADO` · `RECUSADO` · `EXPIRADO` · `CONVERTIDO`. `segmento`: `OFICINA` · `USINAGEM` · `CALDEIRARIA`. Orçamento aprovado é imutável.

## Painel

`GET /painel`

```json
{ "saudacao": "Bom dia", "usuario": "Marina",
  "tabelaVigente": { "id": "…", "competencia": "2026-10", "versao": 1, "desatualizada": false, "cheioMedio": "117.78" },
  "orcamentos": { "abertos": 5, "valorAberto": "18320.40", "aprovadosMes": 3, "valorAprovadoMes": "9120.00", "taxaConversao": "0.42", "abaixoDoMinimo": 1 },
  "centros": [{ "id": "…", "nome": "Torno CNC de entrada", "tipo": "maquina", "cheioHora": "117.78", "precoHora": "178.45" }],
  "alertas": [{ "tipo": "atencao", "mensagem": "…", "link": "/tabelas-custos/…" }] }
```

## Dados de exemplo (seed)

Empresa **Usinagem Joinville**; login `marina@usinagemjoinville.com.br` (GESTOR) com a senha de desenvolvimento definida em `apps/api/.env.example`. Três centros iguais aos da planilha (Torno CNC de entrada, Fresa CNC 01, Centro de usinagem 02), três operadores (salário 5.000 + encargos 3.200), custo fixo de outubro/2026 de R$ 22.000 em categorias, Tabela de Custos 2026-10 v1 vigente (117,78/h), clientes plausíveis e o orçamento ORC-2026-00128 da bucha de latão H7 (lote 10, desconto 5%, R$ 793,27).

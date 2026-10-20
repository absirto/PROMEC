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

## Ordens de serviço (fase 1b)

Toda conta de custo real × orçado usa `calcularCustoReal` do `@promec/motor`, com o custo-hora da **versão da Tabela de Custos do orçamento de origem** (ou da vigente, para OS sem orçamento). A OS nunca altera o orçamento.

### Estados

`ABERTA` → `EM_FILA` → `EM_EXECUCAO` ⇄ `PAUSADA` → `CONTROLE_QUALIDADE` → `CONCLUIDA` → `ENTREGUE`; `CANCELADA` a partir de qualquer estado antes de `ENTREGUE`. Reprovar no controle de qualidade volta para `EM_EXECUCAO` criando uma operação de retrabalho (`retrabalho: true`, custo da não-qualidade).

| Ação | De → para | Regras |
| --- | --- | --- |
| `POST /orcamentos/:id/converter` | orçamento `APROVADO` → `CONVERTIDO`; cria OS `EM_FILA` | copia linhas: operações viram o roteiro (sequência na ordem das linhas; `maoDeObra` também vira operação, com tempo padrão × fator no setup orçado e ciclo 0), material/ferramental/terceiro/frete viram custos orçados. Corpo opcional `{ prazo }`. Responde a OS criada |
| `POST /ordens-servico` | cria `ABERTA` (serviço rápido, sem orçamento) | `{ clienteId, titulo, segmento, lote, prazo, objeto?, operacoes, custos }`; preço informado em `precoFinalLote`; acima de `parametros.limiteServicoRapido` (padrão R$ 1.500) → 422 `EXIGE_ORCAMENTO` |
| `POST /ordens-servico/:id/liberar` | `ABERTA` → `EM_FILA` | |
| `POST /ordens-servico/:id/operacoes/:opId/iniciar` | `{ colaboradorId, tipo: 'SETUP' \| 'PRODUCAO' }` abre apontamento; OS vai para `EM_EXECUCAO` | 409 `APONTAMENTO_ABERTO` se o colaborador já tem apontamento aberto em outra operação; colaborador precisa estar alocado no centro da operação (422 `NAO_HABILITADO`) |
| `POST /ordens-servico/:id/operacoes/:opId/parar` | fecha o apontamento aberto | `{ quantidadeBoa?, refugo?, observacao? }`; `encerrarSetup?: boolean`; `encerrarOperacao?: boolean`. Quando todas as operações estão encerradas a OS vai para `CONTROLE_QUALIDADE` |
| `POST /ordens-servico/:id/pausar` | `EM_EXECUCAO` → `PAUSADA` | `{ motivo: 'FALTA_PECA' \| 'AGUARDANDO_CLIENTE' \| 'QUEBRA' \| 'FALTA_OPERADOR' \| 'OUTRO', observacao? }` fecha apontamentos abertos e registra ocorrência |
| `POST /ordens-servico/:id/retomar` | `PAUSADA` → `EM_EXECUCAO` | fecha a ocorrência de pausa (duração) |
| `POST /ordens-servico/:id/inspecao` | `CONTROLE_QUALIDADE` → `CONCLUIDA` ou → `EM_EXECUCAO` | `{ aprovada, itens: [{ descricao, esperado?, medido?, conforme }], observacao? }`; reprovada exige `observacao` e cria a operação de retrabalho no centro informado em `centroRetrabalhoId` |
| `POST /ordens-servico/:id/entregar` | `CONCLUIDA` → `ENTREGUE` | `{ recebidoPor, documento?, observacao? }`; grava o custo real final e o desvio |
| `POST /ordens-servico/:id/cancelar` | qualquer (exceto `ENTREGUE`) → `CANCELADA` | `GESTOR`/`ADMIN`; `{ motivo }`; custo já apontado fica como perda |

### Leitura e edição

| Método | Rota | Resposta |
| --- | --- | --- |
| GET | `/ordens-servico?status=&q=&atrasadas=true` | `{ itens: [{ id, numero, titulo, segmento, cliente: { id, nome }, status, prazo, atrasada, progresso, centroAtual, operadorAtual, custoOrcado, custoProjetado, margemOrcada, margemProjetada, situacao, orcamento: { id, numero } \| null }], total, contagem: { ABERTA: n, …, ATRASADAS: n } }` |
| GET | `/ordens-servico/:id` | cabeçalho + `objeto` + `operacoes` + `custos` + `apontamentos` + `ocorrencias` + `inspecoes` + `historico` + `tabelaCustos: { id, competencia, versao }` + `resultado: ResultadoCustoReal` + `alertas` |
| PATCH | `/ordens-servico/:id` | `{ titulo?, prazo?, prioridade?, objeto?, observacoes? }` (não em `ENTREGUE`/`CANCELADA`) |
| POST / PATCH / DELETE | `/ordens-servico/:id/operacoes[/:opId]` | `{ descricao, centroId, colaboradorId?, setupOrcadoHoras, cicloOrcadoHorasPorPeca, sequencia }`; só antes de iniciar a operação; incluir operação não orçada depois da execução exige `justificativa` |
| POST / PATCH / DELETE | `/ordens-servico/:id/custos[/:custoId]` | lançamento real `{ real }` em custo existente ou custo novo `{ descricao, categoria, orcado: "0", real, justificativa }`; real acima do orçado × (1 + 20%) exige `justificativa` (422 `JUSTIFICATIVA_OBRIGATORIA`) |
| GET | `/apontamentos/abertos?colaboradorId=` | apontamentos em aberto (para o Modo Operador) |
| GET | `/operador/fila?colaboradorId=` | operações de OS `EM_FILA`/`EM_EXECUCAO`/`PAUSADA` dos centros em que o colaborador está alocado, ordenadas por prioridade e prazo, com `apontamentoAberto` |

Formatos:

```json
{ "objeto": { "desenho": "BUC-H7-020", "revisao": "C", "material": "Latão C360 Ø25", "placa": null, "veiculo": null, "kmEntrada": null, "projeto": null },
  "operacao": { "id": "…", "sequencia": 10, "descricao": "Torneamento", "centroId": "…", "centroNome": "Torno CNC de entrada", "colaboradorId": "…", "colaboradorNome": "Ricardo Lima",
    "custoHora": "117.7777777778", "setupOrcadoHoras": "3", "cicloOrcadoHorasPorPeca": "0.1", "setupRealHoras": "3.4", "producaoRealHoras": "0.38",
    "quantidadeBoa": 4, "refugo": 0, "setupConcluido": true, "status": "EM_ANDAMENTO", "retrabalho": false },
  "apontamento": { "id": "…", "operacaoId": "…", "colaboradorId": "…", "colaboradorNome": "…", "tipo": "PRODUCAO", "inicio": "…", "fim": null, "horas": null, "quantidadeBoa": 0, "refugo": 0, "observacao": null },
  "ocorrencia": { "id": "…", "tipo": "PAUSA", "motivo": "FALTA_PECA", "inicio": "…", "fim": null, "horas": null, "observacao": "Chapa 3/16 em falta" } }
```

`status` da operação: `PENDENTE` · `EM_ANDAMENTO` · `PAUSADA` · `CONCLUIDA`. `segmento` e `objeto` seguem o perfil: oficina usa `placa`, `veiculo`, `kmEntrada`, `kmSaida`; usinagem usa `desenho`, `revisao`, `material`; caldeiraria usa `projeto`. Horas de apontamento = `fim − inicio` em horas decimais; o real da operação soma os apontamentos por tipo.

`alertas`: estouro de horas por operação (real > orçado × 1,2), OS pausada há mais de 4 h, prazo vencido, margem projetada abaixo da mínima.

`numero`: `OS-AAAA-NNNNN`, sequencial por tenant. `prioridade`: `BAIXA` · `NORMAL` · `ALTA` · `URGENTE`.

### Painel

`GET /painel` ganha `ordens: { emExecucao, pausadas, atrasadas, emQualidade, margemProjetadaMedia }`.

### Seed

A partir do ORC-2026-00124 (aprovado) e de um novo orçamento aprovado da bucha, criar:
- **OS-2026-00041**, da bucha: em execução, setup encerrado em 3,40 h, produção com 0,38 h e 4 peças boas. O resultado deve dar 4,35 h projetadas e margem projetada ≈ 11,3%.
- Uma OS pausada por `FALTA_PECA`.
- Uma OS em fila e atrasada.
- Uma OS em controle de qualidade.
- Uma OS entregue.

Os operadores ficam alocados nos centros.

## Planejamento, agenda e capacidade (fase 1c)

Toda programação usa `planejar` e `prometerPrazo` do `@promec/motor`, que trabalham em capacidade finita, dia a dia. A capacidade de cada centro vem da **mesma base da Tabela de Custos vigente**: `horasExpediente` × `eficiencia` do centro, dividida pelos dias úteis do mês. Divergir essa base é proibido.

### O que entra na fila

- **OS** em `ABERTA`, `EM_FILA`, `EM_EXECUCAO` ou `PAUSADA`: entram as operações não concluídas.
  - Horas restantes = `max(0, horasProjetadas − horasReais)` da operação, vindo de `calcularCustoReal`.
- **Orçamentos `APROVADO`** ainda não convertidos entram como `provisoria: true`, reservando capacidade.
  - O roteiro sai das linhas `operacao` (setup + ciclo × lote) e `maoDeObra` (tempo × fator, × lote quando `base: 'peca'`).
- **Agendamentos** de oficina `MARCADO` ou `CONFIRMADO` entram como `ocupacaoFixa` no box (centro) e no dia.

### Rotas

| Método | Rota | Observação |
| --- | --- | --- |
| GET | `/planejamento?horizonte=60` | `{ hoje, ordens: [{ …OrdemPlanejada, ref: { tipo: 'OS' \| 'ORCAMENTO', id, numero, titulo, cliente, status, prioridade, segmento }, operacoes: [{ …OperacaoPlanejada, descricao, centroNome }] }], centros: [{ …CentroPlanejado, tipo }], semDestino, alertas, filaManual: bool }` |
| PUT | `/planejamento/fila` | `{ ordem: [osId, …] }` grava a posição manual das OS (arrastar e soltar); `GESTOR`/`ADMIN`/`ORCAMENTISTA` |
| DELETE | `/planejamento/fila` | apaga as posições manuais; a fila volta ao automático (prazo, prioridade, atraso) |
| POST | `/planejamento/promessa` | `{ orcamentoId }` ou `{ operacoes: [{ centroId, horas }] }` → `{ fim, ocupacaoMaxima, sobrecarga, alertas }`; não grava nada |
| GET / POST | `/feriados` | `[{ id, data, descricao }]` / `{ data, descricao }` |
| DELETE | `/feriados/:id` | |
| GET / POST | `/centros-trabalho/:id/paradas` | `[{ id, inicio, fim, motivo }]` / `{ inicio, fim, motivo }`; parada nova sugere centros equivalentes (mesmo `tipo`) |
| DELETE | `/centros-trabalho/:id/paradas/:paradaId` | |

O centro de trabalho ganha `diasSemana` (padrão `[1,2,3,4,5]`), editável no `PATCH`.

### Prazo prometido

- O orçamento ganha `prazoPrometido` (opcional no `POST`/`PUT`).
- `GET /orcamentos/:id` passa a trazer `promessa: { fim, ocupacaoMaxima, sobrecarga }`, calculada ao vivo.
- Na conversão, o `prazo` da OS vem, em ordem, do corpo, do `prazoPrometido` ou do `fim` da promessa.
- `PATCH /ordens-servico/:id` que atrase o `prazo` exige `motivoReprogramacao` → 422 `MOTIVO_OBRIGATORIO`. O motivo é registrado no histórico (evento `reprogramada`).

### Agenda da oficina

| Método | Rota | Observação |
| --- | --- | --- |
| GET | `/agendamentos?de=2026-10-20&ate=2026-10-26&centroId=` | `{ itens: [{ id, cliente: { id, nome }, telefone, placa, veiculo, servico, centroId, centroNome, colaboradorId, colaboradorNome, inicio, duracaoHoras, status, osId, observacao }], total }` |
| POST | `/agendamentos` | `{ clienteId?, nomeCliente?, telefone?, placa?, veiculo?, servico, centroId, colaboradorId?, inicio, duracaoHoras, observacao? }`. Conflito de horário no mesmo box ou com o mesmo mecânico → 409 `HORARIO_OCUPADO`. Mecânico não alocado no box → 422 `NAO_HABILITADO`. Fora do expediente do centro → 422 `FORA_DO_EXPEDIENTE` |
| PATCH | `/agendamentos/:id` | reagendar ou editar, com as mesmas validações |
| POST | `/agendamentos/:id/confirmar` · `/chegou` · `/nao-veio` · `/cancelar` | `chegou` com `{ abrirOs: true }` cria OS de oficina `ABERTA` com placa, veículo e serviço, e grava `osId` |

- `status`: `MARCADO` · `CONFIRMADO` · `CHEGOU` · `NAO_VEIO` · `CANCELADO`.
- Expediente da agenda: 08:00 às 18:00 nos `diasSemana` do centro, fora de feriados e paradas.

### Painel

`GET /painel` ganha `ocupacao: [{ centroId, nome, semanaAtual, proximaSemana }]` (frações) e os alertas de sobrecarga e de atraso do planejamento.

### Seed

- Cadastrar os feriados nacionais de 2026 restantes:
  - 02/11
  - 15/11
  - 20/11
  - 25/12
- Cadastrar uma parada preventiva da Fresa CNC 01 na próxima semana.
- Criar um centro de oficina **Box 3 (elevador)**, tipo `box`, com o mecânico **Jonas Ferreira** alocado em 100%.
  - O Box 3 fica **fora** da Tabela de Custos 2026-10 v1, para não mudar o rateio dos números canônicos (117,78/h).
  - Por isso ele aparece com `custoHoraVigente: null` e um aviso "entra na próxima versão da tabela". A agenda e o planejamento usam só a capacidade dele.
- Criar 4 agendamentos na semana corrente:
  - Honda CG 160 2022 · ABC1D23
  - Fiat Toro 2021 · BRA2E19
  - mais dois plausíveis
- Algumas OS e orçamentos com prazos que gerem uma semana de sobrecarga no Torno CNC e um atraso.

## Itens, fornecedores, estoque, compras e qualidade (fase 1d)

Contas de suprimentos e qualidade usam o `@promec/motor`:

- `custoMedioAposEntrada`
- `converterUnidade`
- `sugestaoDeCompra`
- `compararCotacoes`
- `curvaABC`
- `variacaoDePreco`
- `avaliarFornecedor`
- `avaliarMedicao`

Quantidades e valores trafegam como texto decimal. O Financeiro ainda não existe: o recebimento grava `contaPagar: { valor, vencimento, categoria }` no próprio recebimento, para o módulo Financeiro consumir depois.

### Cadastros

**Itens** — `GET /itens?q=&tipo=&abaixoDoMinimo=true` · `POST /itens` · `GET|PATCH /itens/:id` · `DELETE /itens/:id` (inativa)

```json
{ "id": "…", "codigo": "MP-LAT-C360-25", "descricao": "Barra de latão C360 Ø25", "tipo": "MATERIA_PRIMA",
  "unidadeCompra": "kg", "unidadeConsumo": "kg", "fatorConversao": "1", "pesoPorMetroKg": "4.17",
  "custoMedio": "42.00", "ultimoCusto": "42.00", "precoVenda": null, "margemPeca": null,
  "estoqueMinimo": "20", "estoqueMaximo": "80", "fornecedorPreferidoId": "…", "rastreavel": true,
  "categoriaDespesa": "materiaPrima", "ativo": true,
  "saldo": { "fisico": "35", "reservado": "0.9", "disponivel": "34.1" }, "classeABC": "A" }
```

- `tipo`: `MATERIA_PRIMA` · `PECA_REPOSICAO` · `INSUMO` · `FERRAMENTA_GERAL` · `FERRAMENTA_ESPECIFICA` · `PRODUTO_ACABADO` · `SERVICO_EXTERNO`.
- `codigo` é único por tenant (409 `CODIGO_DUPLICADO`).
- O fator de conversão é obrigatório quando as unidades diferem.

**Fornecedores** — `GET /fornecedores?q=` · `POST /fornecedores` · `GET|PATCH /fornecedores/:id` · `DELETE` (inativa)

```json
{ "id": "…", "tipo": "PJ", "documento": "…", "nome": "Metais Joinville Ltda.", "fantasia": "Metais Joinville",
  "email": "…", "telefone": "…", "cidade": "Joinville", "uf": "SC",
  "categorias": ["MATERIA_PRIMA"], "prazoMedioDias": 5, "condicaoPagamento": "28 dias",
  "avaliacao": "4.6", "entregas": 12, "status": "ATIVO",
  "itens": [{ "itemId": "…", "descricao": "…", "ultimoPreco": "42.00", "data": "…" }] }
```

- O documento é validado e único, como em clientes.
- A avaliação vai de 0 a 5 e é recalculada a cada recebimento com `avaliarFornecedor`.

O orçamento passa a aceitar `itemId` nas linhas `material`, `materialCorte` e `ferramental`. A tela sugere `custoUnitario` = custo médio (ou `precoKg` para corte por `pesoPorMetroKg`).

### Estoque

| Método | Rota | Observação |
| --- | --- | --- |
| GET | `/estoque/locais` · POST · PATCH `/:id` | `{ id, nome, tipo: 'ALMOXARIFADO' \| 'PECAS' \| 'MATERIA_PRIMA' \| 'FERRAMENTARIA' }` |
| GET | `/estoque/saldos?localId=&q=&abaixoDoMinimo=true` | por item e local: `{ item: { id, codigo, descricao, unidade, tipo }, localId, localNome, fisico, reservado, disponivel, custoMedio, valor, minimo, situacao: 'ok' \| 'baixo' \| 'zerado' }`, mais `totais: { valor, itensAbaixoMinimo }` |
| GET | `/estoque/movimentos?itemId=&osId=&tipo=&de=&ate=` | `{ itens: [{ id, data, tipo, item, local, quantidade, custoUnitario, valor, lote, origem: { tipo: 'OS' \| 'CENTRO' \| 'RECEBIMENTO' \| 'AJUSTE' \| 'INVENTARIO', id, numero }, usuario, observacao }], total }` |
| POST | `/estoque/movimentos` | `ENTRADA_AVULSA` (exige `justificativa`) · `SAIDA_CENTRO` (insumo ou ferramenta geral contra `centroId`) · `AJUSTE` (`justificativa`) · `TRANSFERENCIA` (`localDestinoId`) · `PERDA` (`motivo`) · `DEVOLUCAO` (sobra de OS, `osId`). Saída acima do disponível → 422 `SALDO_INSUFICIENTE`. Item rastreável sem `loteId` → 422 `LOTE_OBRIGATORIO` |
| GET | `/estoque/lotes?itemId=` | `{ id, codigo, itemId, fornecedor, recebimentoId, data, quantidadeInicial, saldo, certificado: { numero, corrida, norma, observacao } }` |
| GET | `/estoque/consumo-centros?competencia=2026-10` | `[{ centroId, nome, consumido, insumosCadastro, diferenca }]`: proposta de nova média de insumos para o Motor de Custos |
| GET | `/estoque/curva-abc?meses=3` | resultado de `curvaABC` com a descrição do item |
| POST | `/estoque/inventarios` | `{ localId, itens: [{ itemId, loteId?, contado }] }` → gera os `AJUSTE` das diferenças, com auditoria |

- Saída por OS: `POST /ordens-servico/:id/consumos` `{ itemId, quantidade, loteId?, custoId? }`.
  - Baixa ao custo médio do momento e soma `quantidade × custoMedio` ao `real` do custo da OS: o informado em `custoId`, ou o custo de material ligado ao mesmo `itemId`, ou um custo novo com as regras de justificativa existentes.
  - Responde a OS completa.
  - `DELETE /ordens-servico/:id/consumos/:movimentoId` estorna o consumo.
- Reserva:
  - Na conversão de orçamento em OS, as linhas com `itemId` reservam a quantidade (`lote × quantidade`, ou kg de corte).
  - O consumo baixa a reserva.
  - Cancelar ou entregar a OS libera o que sobrou.

### Compras

**Requisições** — `GET /compras/requisicoes?status=` · `POST` (`{ itens: [{ itemId, quantidade }], osId?, observacao }`) · `POST /compras/requisicoes/gerar-ponto-pedido` (cria requisições para todos os itens abaixo do mínimo com `sugestaoDeCompra`, sem duplicar uma aberta).
- `status`: `ABERTA` · `EM_COTACAO` · `ATENDIDA` · `CANCELADA`.
- `origem`: `OS` · `PONTO_PEDIDO` · `MANUAL`.
- Pausar uma OS com `FALTA_PECA` e `itemId`/`quantidade` no corpo cria a requisição ligada à OS.

**Cotações**

| Método | Rota | Observação |
| --- | --- | --- |
| POST | `/compras/cotacoes` | `{ requisicaoIds, fornecedorIds }` |
| GET | `/compras/cotacoes/:id` | traz `respostas` e `comparativo` (saída de `compararCotacoes` por item) |
| POST | `/compras/cotacoes/:id/respostas` | `{ fornecedorId, itens: [{ itemId, precoUnitario }], frete, prazoDias }` |
| POST | `/compras/cotacoes/:id/escolher` | `{ fornecedorId, justificativa? }`. Escolher quem não está na posição 1 exige `justificativa` (422 `JUSTIFICATIVA_OBRIGATORIA`). Gera o pedido |

**Pedidos**

| Método | Rota | Observação |
| --- | --- | --- |
| GET | `/compras/pedidos?status=` | lista |
| POST | `/compras/pedidos` | pedido direto, sem cotação |
| GET | `/compras/pedidos/:id` | detalhe |
| POST | `/compras/pedidos/:id/aprovar` | `GESTOR`/`ADMIN` |
| POST | `/compras/pedidos/:id/cancelar` | |

- `status`: `AGUARDANDO_APROVACAO` · `APROVADO` · `PARCIAL` · `RECEBIDO` · `CANCELADO`.
- Pedido acima de `parametros.limiteAprovacaoCompra` (padrão R$ 5.000) nasce aguardando aprovação; abaixo, nasce aprovado.

**Recebimento** — `POST /compras/pedidos/:id/recebimentos` `{ localId, notaFiscal?, itens: [{ itemId, quantidade, precoUnitario, lote?: { codigo, certificado: { numero, corrida, norma } } }], observacao? }`.
- Entrada no estoque com `custoMedioAposEntrada`; atualiza o último custo e o último preço do fornecedor.
- Item rastreável sem certificado → 422 `CERTIFICADO_OBRIGATORIO`.
- Divergências: quantidade diferente do pendente, ou preço com variação acima de 2%. Ficam registradas no recebimento e alteram a avaliação do fornecedor (`avaliarFornecedor`, com `noPrazo` pela data prevista).
- Variação de preço acima de 5% marca `custoDesatualizado: true` nos orçamentos `RASCUNHO` que usam o item e gera alerta.
- Recebimento parcial deixa o pedido `PARCIAL`.
- Grava `contaPagar` (valor total, vencimento pela condição de pagamento, categoria de despesa do item).
- Sem pedido aprovado → 409 `PEDIDO_NAO_APROVADO`.

### Qualidade

**Planos de inspeção** — `GET /qualidade/planos` · `POST` · `GET|PATCH /qualidade/planos/:id`. O plano é versionado: um `PATCH` cria uma nova versão, e a OS guarda a versão usada.

```json
{ "id": "…", "nome": "Dimensional — bucha H7", "segmento": "USINAGEM", "versao": 2, "ativo": true, "exigeInspecao": true,
  "itens": [{ "id": "…", "descricao": "Furo Ø20 H7", "tipo": "DIMENSIONAL", "nominal": "20", "tolInferior": "0", "tolSuperior": "0.021", "unidade": "mm", "instrumento": "Súbito 18–35 mm" },
            { "id": "…", "descricao": "Acabamento sem rebarba", "tipo": "VISUAL" }] }
```

- `tipo` do item: `DIMENSIONAL` · `VISUAL` · `SOLDA` · `CHECK`.
- A OS ganha `planoInspecaoId` e `planoVersao`. Na conversão ou criação, vem do plano ativo do segmento; pode ser trocado por `PATCH`.

**Inspeção** — o `POST /ordens-servico/:id/inspecao` passa a receber `{ itens: [{ planoItemId?, descricao, medido?, conforme? }], inspetor, observacao, centroRetrabalhoId? }`.
- Para itens `DIMENSIONAL`, `conforme` é calculado com `avaliarMedicao` (`medido` é obrigatório).
- `aprovada` = todos conformes.
- Reprovação abre automaticamente uma não-conformidade de origem `PROCESSO`, ligada à OS, ao centro e ao lote consumido, além do retrabalho que já existe.
- Plano com `exigeInspecao` impede concluir sem inspeção (já vale).

**Não-conformidades**

| Método | Rota | Observação |
| --- | --- | --- |
| GET | `/qualidade/ncs?status=&origem=` | lista |
| POST | `/qualidade/ncs` | `{ origem: 'MATERIAL' \| 'PROCESSO' \| 'OPERADOR' \| 'PROJETO' \| 'FORNECEDOR', descricao, osId?, centroId?, loteId?, fornecedorId?, colaboradorId? }` |
| PATCH | `/qualidade/ncs/:id` | `{ causa, acaoCorretiva, responsavelId, prazo }` |
| POST | `/qualidade/ncs/:id/encerrar` | `{ eficaz }` |

- `status`: `ABERTA` · `EM_TRATAMENTO` (quando tem ação registrada) · `ENCERRADA`.
- Uma NC `ABERTA` (sem ação) ligada à OS bloqueia `entregar` → 409 `NC_ABERTA`.
- NC de origem `FORNECEDOR` ou `MATERIAL` com lote reduz a avaliação do fornecedor (`naoConforme`).
- Alerta de recorrência: 3 ou mais NCs em 90 dias no mesmo centro, operador ou fornecedor.

**Rastreabilidade** — `GET /qualidade/rastreabilidade?loteId=` → lote, certificado, fornecedor, recebimento e as OS que o consumiram (com cliente e entrega). `?osId=` faz o caminho inverso: os lotes consumidos pela OS.

**Garantia**

| Método | Rota | Observação |
| --- | --- | --- |
| POST | `/qualidade/garantias` | `{ osId, relato }`. Só para OS `ENTREGUE` dentro de `parametros.garantiaDias` (padrão 90) → senão 422 `FORA_DA_GARANTIA` |
| GET | `/qualidade/garantias` | lista |
| POST | `/qualidade/garantias/:id/decidir` | `{ procedente, analise }`. Procedente abre uma OS de garantia `EM_FILA` sem cobrança (`precoFinalLote` 0, `garantiaDeId`), com o roteiro copiado e o custo marcado como não-qualidade |

**Laudo** — `GET /ordens-servico/:id/laudo` → JSON com a OS, o cliente, a inspeção com as medições, os lotes, os certificados e o termo de garantia. A web imprime em HTML (`@media print`); PDF fica para depois.

**Painel** — ganha `suprimentos: { abaixoDoMinimo, valorEstoque, pedidosAguardando, recebimentosAtrasados }` e `qualidade: { ncsAbertas, custoNaoQualidadeMes, garantiasAbertas }`.

### Seed

- **Locais**: Almoxarifado, Matéria-prima, Peças, Ferramentaria.
- **Itens** (cerca de 12, com saldo e custo médio coerentes):
  - Barra de latão C360 Ø25 (kg, rastreável, R$ 42,00/kg, 4,17 kg/m);
  - aço SAE 1045 Ø45 (kg, rastreável);
  - chapa 3/16 (kg, abaixo do mínimo);
  - óleo de corte e pastilha CNMG (insumo / ferramenta geral);
  - kit relação CG 160 e filtro de óleo (peças de reposição, com margem);
  - alargador Ø20 H7 (ferramenta específica).
- **Fornecedores** (3, com avaliações diferentes):
  - Metais Joinville;
  - Aços Itajaí;
  - Moto Peças Sul.
- **Lotes**: um lote de latão com certificado (corrida 24-8812).
- **Bucha**: as linhas de material do ORC-121 e do OS-41 ligadas ao item de latão; o consumo de 80,00 já baixado do lote.
- **Compras**:
  - 1 requisição por ponto de pedido (chapa);
  - 1 cotação com 3 respostas;
  - 1 pedido aguardando aprovação (acima de R$ 5.000);
  - 1 pedido parcialmente recebido.
- **Qualidade**:
  - planos para usinagem (bucha H7) e oficina (checklist de saída);
  - 1 NC aberta;
  - 1 garantia em análise.
- **Números que não podem mudar**: 117,78/h, bucha R$ 793,27, OS-41 com 4,35 h e 11,3%.

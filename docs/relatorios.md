# Relatórios Operacionais e Administrativos

Os relatórios estão disponíveis via endpoints REST em `/v1/reports`.

## Relatórios Operacionais

- **Ordens de Serviço por status e período**
  - `GET /v1/reports/operational/service-orders?start=YYYY-MM-DD&end=YYYY-MM-DD`
  - Retorna quantidade de ordens de serviço agrupadas por status no período.

- **Movimentação de Estoque**
  - `GET /v1/reports/operational/stock-movements?start=YYYY-MM-DD&end=YYYY-MM-DD`
  - Lista movimentações de estoque no período, com material vinculado.

- **Produção por Funcionário/Área**
  - `GET /v1/reports/operational/production?start=YYYY-MM-DD&end=YYYY-MM-DD`
  - Lista serviços realizados, agrupados por funcionário e área.

## Relatórios Administrativos

- **Fluxo Financeiro (Entradas/Saídas)**
  - `GET /v1/reports/admin/financial-flow?start=YYYY-MM-DD&end=YYYY-MM-DD`
  - Retorna totais de receitas, despesas e saldo no período.

- **Contas a Receber/Pagar**
  - `GET /v1/reports/admin/accounts?status=RECEIVABLE|PAYABLE`
  - Lista contas a receber ou pagar, ordenadas por data.

- **Desempenho de Equipes**
  - `GET /v1/reports/admin/team-performance`
  - Quantidade de serviços realizados por funcionário.

- **Resumo de Usuários Ativos**
  - `GET /v1/reports/admin/users-summary`
  - Total de usuários, admins e usuários comuns.

## Observações
- Todos os endpoints retornam dados em formato JSON.
- Parâmetros de data são opcionais, mas recomendados para relatórios por período.
- Para dúvidas ou sugestões de novos relatórios, entre em contato com a equipe de desenvolvimento.

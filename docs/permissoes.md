# Matriz de Permissoes da API

Base da API: /v1

## Regras gerais

- Endpoints de autenticacao e integracao externa podem ser publicos.
- Endpoints protegidos usam authenticateToken.
- A autorizacao usa requirePermission(permissionKey).
- Usuario com role admin possui bypass de permissao no middleware.
- Compatibilidade legada ativa para chaves: admin, cadastro, operacao, auxiliares.
- Politica de exposicao publica controlada por ambiente:
	- ALLOW_PUBLIC_REGISTER=true libera POST /v1/auth/register sem token.
	- ALLOW_PUBLIC_EXTERNAL_LOOKUP=true libera GET /v1/external/cnpj/:cnpj sem token.
	- Com valor false, ambas as rotas exigem autenticacao e permissao.

## Chaves de permissao usadas

- dashboard:visualizar
- pessoas:visualizar
- pessoas:gerenciar
- funcionarios:visualizar
- funcionarios:gerenciar
- materiais:visualizar
- materiais:gerenciar
- os:visualizar
- os:gerenciar
- qualidade:visualizar
- qualidade:gerenciar
- estoque:visualizar
- estoque:gerenciar
- financeiro:visualizar
- financeiro:gerenciar
- relatorios:visualizar
- configuracoes:gerenciar
- usuarios:gerenciar
- auxiliares

## Matriz por perfil (seed padrao)

| Perfil | Permissoes atribuídas no seed | Cobertura funcional esperada |
|---|---|---|
| Admin (grupo Admin) | Todas as permissoes cadastradas | Acesso total a todos os endpoints protegidos |
| Usuario (grupo Usuário) | operacao, os:visualizar, qualidade:visualizar, dashboard:visualizar | Consulta de dashboard, OS e qualidade. Sem acesso de gestao administrativa |

Observacoes:

- O middleware concede bypass para role admin.
- Existe compatibilidade para permissoes legadas: admin, cadastro, operacao e auxiliares.
- O seed atual usa upsert com update vazio para grupos. Em ambiente ja existente, alteracoes de permissoes do grupo podem exigir script de sincronizacao para refletir a matriz acima.

## Endpoints publicos

| Metodo | Endpoint | Regra |
|---|---|---|
| POST | /v1/auth/login | Publico com rate limit |
| POST | /v1/auth/register | Publico com rate limit |
| GET | /v1/external/cnpj/:cnpj | Publico |

## Endpoints autenticados sem permission key

| Metodo | Endpoint | Regra |
|---|---|---|
| GET | /v1/auth/me | Apenas token valido |

## Dashboard

| Metodo | Endpoint | Permission key |
|---|---|---|
| GET | /v1/dashboard/stats | dashboard:visualizar |

## Usuarios e grupos

| Metodo | Endpoint | Permission key |
|---|---|---|
| GET | /v1/users | usuarios:gerenciar |
| GET | /v1/users/:id | usuarios:gerenciar |
| POST | /v1/users | usuarios:gerenciar |
| PUT | /v1/users/:id | usuarios:gerenciar |
| DELETE | /v1/users/:id | usuarios:gerenciar |
| GET | /v1/groups | usuarios:gerenciar |
| GET | /v1/groups/permissions | usuarios:gerenciar |
| GET | /v1/groups/:id | usuarios:gerenciar |
| POST | /v1/groups | usuarios:gerenciar |
| PUT | /v1/groups/:id | usuarios:gerenciar |
| DELETE | /v1/groups/:id | usuarios:gerenciar |

## Pessoas e funcionarios

| Metodo | Endpoint | Permission key |
|---|---|---|
| GET | /v1/people | pessoas:visualizar |
| GET | /v1/people/:id | pessoas:visualizar |
| POST | /v1/people | pessoas:gerenciar |
| PUT | /v1/people/:id | pessoas:gerenciar |
| DELETE | /v1/people/:id | pessoas:gerenciar |
| GET | /v1/employees | funcionarios:visualizar |
| GET | /v1/employees/:id | funcionarios:visualizar |
| POST | /v1/employees | funcionarios:gerenciar |
| PUT | /v1/employees/:id | funcionarios:gerenciar |
| DELETE | /v1/employees/:id | funcionarios:gerenciar |

## Catalogos auxiliares

| Metodo | Endpoint | Permission key |
|---|---|---|
| GET | /v1/materials | materiais:visualizar |
| GET | /v1/materials/:id | materiais:visualizar |
| POST | /v1/materials | materiais:gerenciar |
| PUT | /v1/materials/:id | materiais:gerenciar |
| DELETE | /v1/materials/:id | materiais:gerenciar |
| GET | /v1/services | auxiliares |
| GET | /v1/services/:id | auxiliares |
| POST | /v1/services | auxiliares |
| PUT | /v1/services/:id | auxiliares |
| DELETE | /v1/services/:id | auxiliares |
| GET | /v1/job-roles | auxiliares |
| GET | /v1/job-roles/:id | auxiliares |
| POST | /v1/job-roles | auxiliares |
| PUT | /v1/job-roles/:id | auxiliares |
| DELETE | /v1/job-roles/:id | auxiliares |
| GET | /v1/work-areas | auxiliares |
| GET | /v1/work-areas/:id | auxiliares |
| POST | /v1/work-areas | auxiliares |
| PUT | /v1/work-areas/:id | auxiliares |
| DELETE | /v1/work-areas/:id | auxiliares |

## Ordens de servico e qualidade

| Metodo | Endpoint | Permission key |
|---|---|---|
| GET | /v1/service-orders | os:visualizar |
| GET | /v1/service-orders/:id | os:visualizar |
| POST | /v1/service-orders | os:gerenciar |
| PUT | /v1/service-orders/:id | os:gerenciar |
| DELETE | /v1/service-orders/:id | os:gerenciar |
| GET | /v1/quality-controls | qualidade:visualizar |
| GET | /v1/quality-controls/:id | qualidade:visualizar |
| POST | /v1/quality-controls | qualidade:gerenciar |
| PUT | /v1/quality-controls/:id | qualidade:gerenciar |
| DELETE | /v1/quality-controls/:id | qualidade:gerenciar |
| POST | /v1/quality-controls/:qualityControlId/photos | qualidade:gerenciar |
| GET | /v1/quality-controls/photos/:photoId/file | qualidade:visualizar |
| DELETE | /v1/quality-controls/photos/:photoId | qualidade:gerenciar |

## Estoque e financeiro

| Metodo | Endpoint | Permission key |
|---|---|---|
| GET | /v1/stock | estoque:visualizar |
| POST | /v1/stock | estoque:gerenciar |
| GET | /v1/finance | financeiro:visualizar |
| GET | /v1/finance/summary | financeiro:visualizar |
| POST | /v1/finance | financeiro:gerenciar |

## Relatorios

| Metodo | Endpoint | Permission key |
|---|---|---|
| GET | /v1/reports/operational/service-orders | relatorios:visualizar |
| GET | /v1/reports/operational/service-orders/pdf | relatorios:visualizar |
| GET | /v1/reports/operational/stock-movements | relatorios:visualizar |
| GET | /v1/reports/operational/stock-movements/pdf | relatorios:visualizar |
| GET | /v1/reports/operational/production | relatorios:visualizar |
| GET | /v1/reports/admin/financial-flow | relatorios:visualizar |
| GET | /v1/reports/admin/financial-flow/pdf | relatorios:visualizar |
| GET | /v1/reports/admin/accounts | relatorios:visualizar |
| GET | /v1/reports/admin/accounts/pdf | relatorios:visualizar |
| GET | /v1/reports/admin/team-performance | relatorios:visualizar |
| GET | /v1/reports/admin/team-performance/pdf | relatorios:visualizar |
| GET | /v1/reports/admin/users-summary | relatorios:visualizar |
| GET | /v1/reports/admin/users-summary/pdf | relatorios:visualizar |
| GET | /v1/reports/admin/profitability | relatorios:visualizar |

## Configuracoes

| Metodo | Endpoint | Permission key |
|---|---|---|
| GET | /v1/settings | configuracoes:gerenciar |
| POST | /v1/settings | configuracoes:gerenciar |
| PUT | /v1/settings | configuracoes:gerenciar |

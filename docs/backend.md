## Rodando com Docker (compose na raiz do monorepo)

Na raiz do repositório:

```bash
docker-compose up --build
```

- API: `http://localhost:3001` (rotas versionadas em `/v1/...`)
- Swagger: `http://localhost:3001/api-docs` (se exposto pelo mesmo processo)
- Frontend (Nginx): `http://localhost:80`
- Health: `GET /health` · Readiness (BD): `GET /ready`

Com `npm run dev` apenas no diretório `backend`, a porta padrão continua sendo `3000` (variável `PORT`).
Para o Swagger, a URL base segue `SWAGGER_SERVER_URL`; na ausência, usa `http://localhost:${PORT}`.

# Documentação Backend ProMEC

## Requisitos
- Node.js 20+
- npm
- Docker e Docker Compose

## Instalação Automática
Execute o script abaixo para instalar tudo e rodar o backend:

```bash
chmod +x install_backend.sh
./install_backend.sh
```

O script irá:
- Subir o banco de dados PostgreSQL e o Redis via Docker Compose
- Instalar todas as dependências do backend
- Gerar o Prisma Client e rodar as migrações
- Buildar e iniciar o backend

Acesse a API em: http://localhost:${PORT:-3000}
Acesse a documentação Swagger em: http://localhost:${PORT:-3000}/api-docs

## Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env` e ajuste conforme necessário:

```bash
cp .env.example .env
```

Principais variáveis:
- `DATABASE_URL`: string de conexão do banco
- `JWT_SECRET`: segredo JWT
- `REDIS_URL`: URL do Redis
- `SENTRY_DSN`: DSN do Sentry (opcional)
- `ALLOW_PUBLIC_REGISTER`: permite `POST /v1/auth/register` sem autenticação (`true` ou `false`)
- `ALLOW_PUBLIC_EXTERNAL_LOOKUP`: permite `GET /v1/external/cnpj/:cnpj` sem autenticação (`true` ou `false`)
- Outras variáveis estão documentadas no `.env.example`

## Scripts Úteis
- `install_backend.sh`: atalho na raiz para instalação automática
- `scripts/ops/install_backend.sh`: script principal de instalação e bootstrap
- `scripts/ops/backup.sh`: faz backup do banco
- `scripts/ops/restore.sh`: restaura backup do banco
- `scripts/ops/db-init.sh`: aplica migrations e executa seed
- `scripts/maintenance/permissions/*`: scripts de manutenção de permissões e utilitários administrativos
- `scripts/maintenance/dev-tools/*`: utilitários manuais de diagnóstico (não usados em produção)
- `npm run permissions:sync`: sincroniza permissões dos grupos padrão com a matriz atual
- `npm run permissions:check`: lista permissões cadastradas

## Permissões e Acesso
- Matriz de permissões por endpoint: `docs/permissoes.md`

## Testes
Para rodar os testes:
```bash
npm test
```

## Dúvidas
Consulte a documentação Swagger ou abra uma issue.

## Release
- Checklist de release: `docs/release-checklist.md`
- Guia de deploy em VPS: `docs/deploy-vps.md`

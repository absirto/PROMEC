# ProMEC Backend

API backend em Node.js + Express + Prisma.

## Estrutura do Projeto

- `src/`: código da aplicação
- `prisma/`: schema, migrations e seed
- `tests/`: testes automatizados
- `docs/`: documentação funcional e operacional
- `scripts/ops/`: scripts operacionais (bootstrap, backup, restore, db-init)
- `scripts/maintenance/`: scripts de manutenção e sincronização
- `scripts/maintenance/permissions/`: scripts de manutenção de permissões e utilitários administrativos
- `scripts/maintenance/dev-tools/`: utilitários manuais de diagnóstico local
- `scripts/tools/`: scripts utilitários de geração (ex.: OpenAPI)

## Comandos Principais

```bash
npm run dev
npm run build
npm start
npm test
npm run permissions:sync
npm run permissions:check
npm run openapi:export
```

## Deploy em VPS

- Compose de produção: `docker-compose.prod.yml`
- Variáveis de produção: `.env.production` ou `.env.production.example`
- Nginx: `deploy/nginx/promec.conf`
- Bootstrap inicial do servidor: `scripts/ops/setup-vps.sh`

## Bootstrap Rápido

```bash
chmod +x install_backend.sh
./install_backend.sh
```

## Documentação

- Guia geral: `docs/backend.md`
- Deploy em VPS: `docs/deploy-vps.md`
- Permissões: `docs/permissoes.md`
- Relatórios: `docs/relatorios.md`
- Exemplos: `docs/exemplos.md`
- Release: `docs/release-checklist.md`

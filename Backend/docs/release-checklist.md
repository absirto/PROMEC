# Checklist de Release (Produção)

## 1. Pré-release

- Confirmar branch/tag de release e changelog.
- Garantir que `npm test` está verde.
- Revisar variáveis de ambiente no servidor:
  - `NODE_ENV=production`
  - `JWT_SECRET` forte (≥32 chars; gere com `openssl rand -base64 48`)
  - `DATABASE_URL`
  - `REDIS_URL`
  - `ALLOW_PUBLIC_REGISTER`
  - `ALLOW_PUBLIC_EXTERNAL_LOOKUP`
  - `ALLOWED_ORIGINS` com as origens do frontend (ex: `https://app.empresa.com`)
- Validar backups recentes do banco.

## 2. Build e migração

- Instalar dependências:
  - `npm ci`
- Buildar aplicação:
  - `npm run build`
- Aplicar migrações:
  - `npx prisma migrate deploy`
- Sincronizar permissões padrão:
  - `npm run permissions:sync`

## 3. Deploy

- Reiniciar serviço da API/worker.
- Verificar logs iniciais sem erro crítico.
- Verificar conectividade com banco e Redis.

## 4. Smoke tests

- Healthcheck:
  - `GET /health`
- Readiness:
  - `GET /ready`
- Login e rota protegida básica (`/v1/auth/me`).
- Uma rota com permissão (ex.: `/v1/users` para admin).

## 5. Pós-release

- Confirmar status de filas e jobs.
- Monitorar erro 5xx e latência nos primeiros minutos.
- Registrar horário de deploy e versão liberada.

## 6. Rollback (se necessário)

- Reverter artefato/contêiner para versão anterior.
- Validar saúde da API após rollback.
- Restaurar backup do banco somente se for indispensável.

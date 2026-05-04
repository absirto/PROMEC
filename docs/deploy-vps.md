# Deploy em VPS

Este guia centraliza o processo de publicação do backend em um VPS com Ubuntu, domínio no Registro.br e DNS opcional no Cloudflare.

## Arquivos já preparados no projeto

- `docker-compose.prod.yml`: stack de produção com app, PostgreSQL e Redis
- `.env.production`: base local para configuração do ambiente de produção
- `.env.production.example`: modelo de referência para preencher o ambiente
- `deploy/nginx/promec.conf`: proxy reverso do Nginx para a API
- `scripts/ops/setup-vps.sh`: bootstrap inicial do servidor

## Arquitetura recomendada

- Frontend: `https://seudominio.com.br` ou `https://www.seudominio.com.br`
- API: `https://api.seudominio.com.br`
- Backend exposto apenas localmente no VPS em `127.0.0.1:3001`
- Nginx como proxy reverso público
- PostgreSQL e Redis acessíveis apenas pela rede interna do Docker Compose

## Pré-requisitos

- VPS com Ubuntu 22.04 LTS ou superior
- 2 vCPU, 2 GB RAM e 20 GB de disco como ponto inicial
- IP público fixo
- Acesso SSH com usuário sudo
- Repositório do projeto disponível no servidor

## Etapa 1: domínio e DNS

### Registro.br sem Cloudflare

No painel do Registro.br, crie um registro `A` apontando o subdomínio da API para o IP do VPS.

Exemplo:

- Tipo: `A`
- Nome: `api`
- Valor: IP público do VPS

### Registro.br com Cloudflare

Fluxo recomendado:

1. Registre o domínio no Registro.br.
2. Adicione o domínio no Cloudflare.
3. No Registro.br, troque os nameservers pelos nameservers informados pelo Cloudflare.
4. No Cloudflare, crie o registro `A` de `api` apontando para o IP do VPS.
5. Depois que o SSL do servidor estiver emitido, configure SSL/TLS do Cloudflare para `Full (strict)`.

## Etapa 2: enviar o projeto para o servidor

Exemplo com Git:

```bash
git clone <url-do-repositorio>
cd backend
```

## Etapa 3: configurar o ambiente de produção

Edite o arquivo `.env.production` antes de subir a stack.

Campos que precisam ser ajustados:

- `JWT_SECRET`: gere com `openssl rand -base64 48`
- `POSTGRES_PASSWORD`: senha forte do banco
- `DATABASE_URL`: deve usar a mesma senha configurada em `POSTGRES_PASSWORD`
- `ALLOWED_ORIGINS`: domínio real do frontend
- `SWAGGER_SERVER_URL`: URL pública da API
- `SENTRY_DSN`: opcional

Exemplo:

```env
PORT=3001
NODE_ENV=production
JWT_SECRET=GERAR_UM_SECRET_FORTE_AQUI
POSTGRES_PASSWORD=UMA_SENHA_FORTE_AQUI
DATABASE_URL=postgresql://postgres:UMA_SENHA_FORTE_AQUI@db:5432/promec_db?schema=public
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379
ALLOWED_ORIGINS=https://seudominio.com.br,https://www.seudominio.com.br
ALLOW_PUBLIC_REGISTER=false
ALLOW_PUBLIC_EXTERNAL_LOOKUP=false
SENTRY_DSN=
SWAGGER_SERVER_URL=https://api.seudominio.com.br
QC_UPLOAD_DIR=/app/uploads/quality
```

## Etapa 4: ajustar o Nginx

No arquivo `deploy/nginx/promec.conf`, troque `api.seudominio.com.br` pelo domínio real da API.

Trecho esperado:

```nginx
server {
    listen 80;
    server_name api.seudominio.com.br;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection '';
        proxy_read_timeout 120s;
    }
}
```

## Etapa 5: bootstrap do servidor

O script abaixo instala Docker, Nginx e Certbot e publica a configuração base do Nginx:

```bash
sudo bash scripts/ops/setup-vps.sh
```

## Etapa 6: subir a stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Esse processo faz:

- build da imagem da aplicação
- subida do PostgreSQL e Redis
- execução de `prisma migrate deploy`
- execução de `prisma db seed`
- inicialização do backend na porta `3001`

## Etapa 7: emitir SSL

Depois que o DNS estiver propagado e o Nginx estiver respondendo em HTTP:

```bash
sudo certbot --nginx -d api.seudominio.com.br
```

Se estiver usando Cloudflare, mantenha primeiro o proxy desligado no registro DNS até a emissão do certificado finalizar, ou garanta que o desafio HTTP esteja alcançando o servidor corretamente.

## Etapa 8: smoke test

Valide pelo menos estes pontos:

```bash
curl http://127.0.0.1:3001/health
curl https://api.seudominio.com.br/health
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs app --tail=100
```

Resultados esperados:

- `/health` respondendo com `ok: true`
- container `app` em execução
- banco migrado e seed aplicado
- Nginx servindo a API com HTTPS

## Segurança operacional

- Não exponha a porta `3001` publicamente além do bind local `127.0.0.1:3001`
- Mantenha `ALLOW_PUBLIC_REGISTER=false`
- Mantenha `ALLOW_PUBLIC_EXTERNAL_LOOKUP=false` em produção, salvo necessidade explícita
- Configure `ALLOWED_ORIGINS` apenas com os domínios reais do frontend
- Use `JWT_SECRET` com no mínimo 32 caracteres
- Prefira Cloudflare com SSL/TLS em `Full (strict)` após o certificado local estar ativo

## Fluxo resumido de deploy

1. Criar VPS.
2. Registrar domínio.
3. Apontar DNS para o VPS.
4. Clonar o projeto.
5. Ajustar `.env.production`.
6. Ajustar `deploy/nginx/promec.conf`.
7. Rodar `sudo bash scripts/ops/setup-vps.sh`.
8. Rodar `docker compose -f docker-compose.prod.yml up -d --build`.
9. Rodar `sudo certbot --nginx -d api.seudominio.com.br`.
10. Validar `/health` e logs.

## Integração Frontend + Backend

Para frontend e backend em domínios separados:

- Frontend: `https://seudominio.com.br`
- API: `https://api.seudominio.com.br`

Configurações obrigatórias:

1. No backend (`.env.production`):
    - `ALLOWED_ORIGINS=https://seudominio.com.br,https://www.seudominio.com.br`
2. No frontend (`.env` de build):
    - `REACT_APP_API_URL=https://api.seudominio.com.br/v1`

Checklist rápido de validação cruzada:

1. Login no frontend retorna token e navega para área autenticada.
2. Endpoints protegidos funcionam sem erro de CORS.
3. Página de relatórios carrega dados com usuário autenticado.
4. `curl https://api.seudominio.com.br/health` responde com `ok: true`.
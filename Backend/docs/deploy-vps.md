# Deploy em VPS Hostinger via GitHub

Este guia prepara o monorepo PROMEC para produção na Hostinger usando importação do repositório do GitHub.

## Arquitetura de produção

- Frontend público em https://ucalcom.com e https://www.ucalcom.com
- API pública em https://api.ucalcom.com
- Frontend dentro do container em 127.0.0.1:3000
- Backend dentro do container em 127.0.0.1:3001
- PostgreSQL e Redis apenas na rede interna do Docker
- Nginx do servidor como proxy reverso de domínio e SSL

## DNS

Crie os registros A apontando para 149.62.37.71:

- A @ -> 149.62.37.71
- A www -> 149.62.37.71
- A api -> 149.62.37.71

## Importação do repositório na Hostinger

1. No painel da Hostinger, importe o repositório GitHub https://github.com/absirto/PROMEC.git
2. No servidor, acesse a pasta do projeto importado
3. Confirme que existem as pastas Backend e Frontend

## Arquivos de produção usados

- Backend/.env.production.example
- Backend/deploy/nginx/promec.conf
- Backend/scripts/ops/setup-vps.sh
- docker-compose.prod.yml (na raiz do monorepo)

## Configurar variáveis de ambiente

Na raiz do projeto no servidor:

```bash
cp Backend/.env.production.example Backend/.env.production
```

Edite Backend/.env.production:

- JWT_SECRET com 32+ caracteres
- POSTGRES_PASSWORD forte
- DATABASE_URL com a mesma senha do POSTGRES_PASSWORD
- ALLOWED_ORIGINS=https://ucalcom.com,https://www.ucalcom.com
- SWAGGER_SERVER_URL=https://api.ucalcom.com

## Bootstrap do VPS

No diretório Backend:

```bash
sudo bash scripts/ops/setup-vps.sh
```

O script instala Docker, Nginx e Certbot e publica o arquivo Backend/deploy/nginx/promec.conf.

## Subir a stack em produção

Na raiz do monorepo:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## Emitir SSL

```bash
sudo certbot --nginx -d ucalcom.com -d www.ucalcom.com -d api.ucalcom.com
```

## Smoke test

```bash
curl -I http://127.0.0.1:3000
curl http://127.0.0.1:3001/health
curl https://api.ucalcom.com/health
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs backend --tail=100
docker compose -f docker-compose.prod.yml logs frontend --tail=100
```

## Regras de segurança

- Não exponha portas 3000 e 3001 publicamente, mantenha bind em 127.0.0.1
- Mantenha ALLOW_PUBLIC_REGISTER=false
- Mantenha ALLOW_PUBLIC_EXTERNAL_LOOKUP=false
- Use segredos fortes em Backend/.env.production

## Atualização de versão

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```
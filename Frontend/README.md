# Frontend ProMEC

Aplicação React (Create React App) para interface do sistema ProMEC.

## Estrutura do projeto

- `src/`: código-fonte da aplicação
- `public/`: arquivos públicos do CRA
- `cypress/`: testes E2E
- `deploy/nginx/`: configuração de Nginx para imagem Docker
- `scripts/ops/`: scripts operacionais (build/run em container)

## Requisitos

- Node.js 20+
- npm

## Execução local

1. Configure ambiente:

```bash
cp .env.example .env
```

2. Instale dependências e rode em modo desenvolvimento:

```bash
npm install
npm start
```

3. Acesse:

- Frontend: http://localhost:3000
- Backend esperado: http://localhost:3001

## Variáveis de ambiente

- `REACT_APP_API_URL`: base URL da API (incluindo `/v1`)

Exemplos:

- Desenvolvimento: `http://localhost:3001/v1`
- Produção: `https://api.seudominio.com.br/v1`

Arquivos recomendados:

- `.env` para desenvolvimento local
- `.env.production` para build de produção (pode partir de `.env.production.example`)

## Scripts

- `npm start`: desenvolvimento
- `npm run build`: build de produção
- `npm test`: testes
- `npm run generate:api-types`: gera tipos OpenAPI
- `npm run docker:build`: build da imagem Docker
- `npm run docker:run`: executa container localmente
- `npm run docker:build:prod-api`: build com API de produção (exemplo)
- `npm run ops:install`: fluxo operacional de build+run via script

## Build Docker

Exemplo de build passando URL da API de produção:

```bash
docker build \
	--build-arg REACT_APP_API_URL=https://api.seudominio.com.br/v1 \
	-t promec-frontend .
```

Execução local do container:

```bash
docker run --rm -p 3000:80 promec-frontend
```

Atalho operacional com estrutura reorganizada:

```bash
bash scripts/ops/install_frontend.sh
```

Opcionalmente, para build sem `--build-arg`, crie `.env.production` antes de rodar `npm run build`:

```bash
cp .env.production.example .env.production
```

## Integração com o backend

- O cliente HTTP central está em `src/services/api.ts`.
- Em rotas protegidas, o token é enviado automaticamente no header `Authorization`.
- Para produção em domínio separado, configure:
	- frontend: `REACT_APP_API_URL=https://api.seudominio.com.br/v1`
	- backend: `ALLOWED_ORIGINS=https://seudominio.com.br,https://www.seudominio.com.br`

Checklist rápido de consistência:

1. `REACT_APP_API_URL` termina com `/v1`.
2. Domínio do frontend está listado em `ALLOWED_ORIGINS` no backend.
3. Domínio da API usado no frontend é o mesmo do `SWAGGER_SERVER_URL` no backend.

## Referências

- Guia de backend e deploy: `../Backend Promec/backend/docs/deploy-vps.md`

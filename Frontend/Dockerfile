# Estágio de Build
FROM node:20-alpine AS build

WORKDIR /app

# Argumento para a URL da API (deve ser passado no build do compose)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Estágio de Produção
FROM nginx:alpine

# Copia build do estágio anterior
COPY --from=build /app/build /usr/share/nginx/html

# Copia nossa config customizada do Nginx
COPY deploy/nginx/frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

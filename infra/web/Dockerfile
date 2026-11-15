# syntax=docker/dockerfile:1
# Visor web de Planet X: compila con pnpm y sirve web/dist con nginx.
# El contexto de build es la raíz del repositorio (ver compose.yaml); solo se envía lo que permite
# infra/web/Dockerfile.dockerignore (nada de node_modules, .venv ni data/).

FROM node:24-alpine AS build
WORKDIR /src
# pnpm se activa con corepack y usa la versión fijada en el campo packageManager de package.json.
RUN corepack enable
COPY web/package.json web/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY web/ ./
RUN pnpm run build

FROM nginx:stable-alpine
COPY infra/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1/"]

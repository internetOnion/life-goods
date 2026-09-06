# syntax=docker/dockerfile:1.7
# LifeGoods frontend — builds the SPA and packages it with nginx (serves static
# files AND reverse-proxies /api to the backend). This is the public HTTPS face.
#
# The repo uses a pnpm workspace rooted at the project root (workspace member: frontend).
# Build from the REPO ROOT:
#   docker build -t lifegoods/frontend:prod \
#     --build-arg VITE_MVP_DEMO_MODE=false \
#     -f infra/deploy/frontend.Dockerfile .
FROM node:22-alpine AS build
WORKDIR /src

RUN corepack enable

# Workspace manifests + lockfile first (cache-friendly).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/package.json
RUN pnpm install --frozen-lockfile

# Application source (frontend only; backend not needed for the SPA build).
COPY frontend/ ./frontend/

ARG VITE_MVP_DEMO_MODE=false
ENV VITE_MVP_DEMO_MODE=${VITE_MVP_DEMO_MODE}

RUN pnpm --dir frontend build

# --- Nginx runtime: static SPA + reverse proxy + TLS ----------------------
FROM nginx:1.27-alpine AS runtime

COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /src/frontend/dist /usr/share/nginx/html

EXPOSE 80 443
STOPSIGNAL SIGTERM

# LifeGoods

LifeGoods is a Khmer-first packaged-food guidance application. This repository currently contains the manual identifier walking skeleton: an anonymous shopper can validate a GTIN, EAN, or UPC identifier locally and distinguish invalid input, a valid identifier with no Package Match, and a temporary lookup failure.

The identifier is a lookup key for a `Package Variant`; it is not a `Product` identity or a safety, health, Halal, legal, authenticity, or purchase conclusion.

## Requirements

- Node.js 24 LTS and pnpm
- Python 3.13 and uv
- Docker with Compose for local PostgreSQL

## Install

```bash
pnpm install
pnpm backend:sync
```

## Run locally

Start PostgreSQL and apply the migration:

```bash
docker compose -f infra/compose.yaml up -d postgres
pnpm db:migrate
```

Start the API and Web Client in separate terminals:

```bash
pnpm backend:dev
pnpm dev
```

Open `http://localhost:5173`. The Web Client proxies `/api` requests to `http://localhost:8000` during development.

## Verify

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm api:check
docker compose -f infra/compose.yaml config
```

The end-to-end command starts isolated local Web Client and API processes backed by a disposable SQLite database. Normal development and deployment use PostgreSQL through the same SQLAlchemy persistence interface.

## OpenAPI client

FastAPI is the source of truth. Regenerate the committed Web Client contract after changing an API route or response:

```bash
pnpm api:generate
```

`pnpm api:check` regenerates the OpenAPI document and client, then fails if either differs from the committed files.

## Layout

- `frontend/`: React, Vite, TypeScript, generated API client, localization, focused tests, and Playwright journeys
- `backend/`: FastAPI, application service, Package Match domain behavior, SQLAlchemy adapter, Alembic migration, and pytest coverage
- `infra/`: local PostgreSQL Compose configuration

See [`docs/REPOSITORY.md`](docs/REPOSITORY.md) for the planned monorepo structure and branch workflow.

Khmer interface copy in this first slice is an implementation draft and requires the language review called for by issue #4 before production release.

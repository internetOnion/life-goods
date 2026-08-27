# LifeGoods

LifeGoods is a Khmer-first packaged-food guidance application. This repository currently contains the manual identifier walking skeleton: an anonymous shopper can validate a GTIN, EAN, or UPC identifier locally and distinguish invalid input, a valid identifier with no Package Match, and a temporary lookup failure.

The identifier is a lookup key for a `Package Variant`; it is not a `Product` identity or a safety, health, Halal, legal, authenticity, or purchase conclusion.

## Requirements

- Node.js 24 LTS and pnpm
- Python 3.13 and uv
- Docker with Compose for local PostgreSQL and MongoDB

## Install

```bash
pnpm install
pnpm backend:sync
```

## Run locally

### 1. Start databases and apply PostgreSQL migrations

Start both PostgreSQL and MongoDB containers:

```bash
docker compose -f infra/compose.yaml up -d
pnpm db:migrate
```

PostgreSQL is exposed on port `5433` and MongoDB on port `27018`. Data is stored in named Docker volumes (`lifegoods-postgres` and `lifegoods-mongodb`) and persists across `docker compose down`.

### 2. Populate the Open Food Facts dataset (Initial setup)

The FastAPI backend uses MongoDB as a local read-only mirror for Open Food Facts data. Import and activate the dataset:

```bash
pnpm off:dataset -- import-url
```

The command streams, verifies, and indexes the export into a versioned MongoDB collection, then outputs a JSON manifest containing the new version `_id`. Activate that version:

```bash
pnpm off:dataset -- activate <version_id>
```

> Additional dataset management commands:
> - `pnpm off:dataset -- list`: List all imported dataset versions and their statuses.
> - `pnpm off:dataset -- revalidate <version_id>`: Re-validate an existing dataset version against current checks without re-downloading.
> - `pnpm off:dataset -- delete <version_id>`: Delete an inactive dataset version and drop its collection.
> - `pnpm off:dataset -- rollback`: Roll back to the immediately preceding active version.
> - `pnpm off:dataset -- prune`: Remove old inactive versions (retaining active and previous versions).

### 3. Start development servers

Start the API and Web Client in separate terminals. Use HTTP for ordinary local development:

```bash
pnpm backend:dev
pnpm dev
```

Open `http://localhost:5173`. The Web Client proxies `/api` requests to `http://localhost:8000` during development.

To run the Web Client over HTTPS instead, use the explicit HTTPS command:

```bash
pnpm dev:https
```

Open `https://localhost:5173` and accept the local self-signed certificate warning. The HTTPS command requires `openssl`; it generates an ignored certificate under `frontend/certs/` and still proxies `/api` to the HTTP API at `http://localhost:8000`.

## Verify

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm api:check
docker compose -f infra/compose.yaml config
```

`pnpm test` runs the frontend Vitest suite and backend pytest unit and API/database integration coverage. Pilot readiness also requires the documented manual device, accessibility, localization, privacy, performance, and staging smoke checks.

## OpenAPI client

FastAPI is the source of truth. Regenerate the committed Web Client contract after changing an API route or response:

```bash
pnpm api:generate
```

`pnpm api:check` regenerates the OpenAPI document and client, then fails if either differs from the committed files.

## Layout

- `frontend/`: React, Vite, TypeScript, generated API client, localization, and focused Vitest tests
- `backend/`: FastAPI, application service, Package Match domain behavior, SQLAlchemy adapter, Open Food Facts dataset/image adapters, Alembic migrations, dataset CLI, and pytest coverage
- `infra/`: local PostgreSQL and MongoDB Compose configuration and MongoDB initialization script

See [`docs/REPOSITORY.md`](docs/REPOSITORY.md) for the planned monorepo structure and branch workflow.

Khmer interface copy in this first slice is an implementation draft and requires the language review called for by issue #4 before production release.


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

Start the API and Web Client in separate terminals. The normal Web Client command uses HTTPS so camera access works when testing from a phone:

```bash
pnpm backend:dev
pnpm dev
```

Open the `https://localhost:5173` URL. The Web Client proxies `/api` requests to `http://localhost:8000` during development.

For development without camera access, use the explicit HTTP command:

```bash
pnpm dev:http
```

For a phone, connect the phone and computer to the same Wi-Fi, then open the `Network: https://<computer-LAN-IP>:<port>/` URL printed by Vite. Do not use `localhost` on the phone; it refers to the phone itself. Accept the local self-signed certificate warning on the phone before selecting “Start camera”. If the browser does not allow the exception, install a trusted local development certificate or use a secure HTTPS tunnel. The HTTPS dev command requires `openssl`; it regenerates an ignored certificate under `frontend/certs/` on each start so the current LAN IP is included, and still proxies `/api` to the HTTP API at `http://localhost:8000`.

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
- `backend/`: FastAPI, application service, Package Match domain behavior, SQLAlchemy adapter, Alembic migration, and pytest coverage
- `infra/`: local PostgreSQL Compose configuration

See [`docs/REPOSITORY.md`](docs/REPOSITORY.md) for the planned monorepo structure and branch workflow.

Khmer interface copy in this first slice is an implementation draft and requires the language review called for by issue #4 before production release.

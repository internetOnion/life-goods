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
pnpm backend:install
```

## Run locally

Start PostgreSQL and MongoDB, then apply the relational migration:

```bash
docker compose -f infra/compose.yaml up -d postgres mongodb
pnpm db:migrate
```

### Reference Datasets (Allergen Rules & Lexical Mappings)

Allergen assessment requires an active `FOOD_ALLERGEN` Reference Dataset Version in PostgreSQL. Import and activate the minimal bundle:

```bash
pnpm reference:dataset import backend/src/lifegoods/reference_datasets/bundles/codex_2026_food_allergen_minimal.json
pnpm reference:dataset list
pnpm reference:dataset activate codex-food-allergen-2026-minimal --review-kind FOOD_DOMAIN_REVIEW
pnpm reference:dataset status
```

### Open Food Facts (OFF) Dataset

Package Match requires an Active OFF Dataset Version. Importing the full global export is
an explicit operator action; see [`docs/OFF_DATASET.md`](docs/OFF_DATASET.md) for the
sample workflow, production-sized import, validation, activation, rollback, and backup gate.

The FastAPI backend uses MongoDB with a read-only application credential. Dataset commands
use the separate operator credential:

```bash
pnpm off:dataset -- import-url
pnpm off:dataset -- list
pnpm off:dataset -- activate <version_id>
```

Additional lifecycle commands are documented in `docs/OFF_DATASET.md`.

### Start the Application

Start the API and Web Client in separate terminals. Set `LIFEGOODS_ALLERGEN_ASSESSMENTS_ENABLED=true` to enable allergen evaluations:

```bash
LIFEGOODS_ALLERGEN_ASSESSMENTS_ENABLED=true pnpm backend:dev
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
- `backend/`: FastAPI, application service, Package Match domain behavior, SQLAlchemy adapter, Open Food Facts dataset/image adapters, Alembic migrations, dataset CLI, and pytest coverage
- `infra/`: local PostgreSQL and MongoDB Compose configuration and MongoDB initialization script

See [`docs/REPOSITORY.md`](docs/REPOSITORY.md) for the planned monorepo structure and branch workflow.

Khmer interface copy in this first slice is an implementation draft and requires the language review called for by issue #4 before production release.

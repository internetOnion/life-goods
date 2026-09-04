# Life Goods

Life Goods is becoming a Khmer-first mobile product-information experience for people shopping in Cambodia. It presents locally hosted Open Food Facts data with visible attribution, Original Text, and eventually on-demand Khmer Translation. It is not a separate food catalog or verification system.

Read [PRODUCT.md](PRODUCT.md) for the product boundary, [CONTEXT.md](CONTEXT.md) for canonical language, and [docs/SPEC.md](docs/SPEC.md) for the backend-first contract.

## Requirements

The current checkout requires:

- Node.js 24 and pnpm
- Python 3.13 and uv
- Docker with Compose

## Install

```bash
pnpm install
pnpm backend:install
```

The backend provides local defaults. Copy `backend/.env.example` to `backend/.env` only when you need to override them.

## Start the local infrastructure

Start MongoDB and Redis:

```bash
docker compose -f infra/compose.yaml up -d
```

Host ports are MongoDB `27018` and Redis `6380`.

## Use the local Open Food Facts snapshot

List imported snapshots and activate the static version used for development:

```bash
pnpm off:dataset -- list
pnpm off:dataset -- activate <version_id>
```

Importing or updating snapshots is not part of the new MVP workflow. The existing import command remains available for current repository operation when a local snapshot has not yet been created:

```bash
pnpm off:dataset -- import-url
```

## Initialize generated translation storage

Initialize the dedicated generated-data MongoDB collections and indexes:

```bash
pnpm generated-data:init
pnpm generated-data:verify
```

Generated translation artifacts, leases, cooldowns, and quarantines persist in `lifegoods_generated` with isolated credentials separate from the read-only Open Food Facts dataset. See [docs/generated-data-persistence.md](docs/generated-data-persistence.md) for architecture, backup, and operational details.

## Start development servers

Run the backend and frontend in separate terminals:

```bash
pnpm backend:dev
```

```bash
pnpm dev
```

The frontend is available at `http://localhost:5173`. Use `pnpm dev:https` when testing camera access at `https://localhost:5173`; `/api` still proxies to the HTTP backend.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm api:check
```

After changing a FastAPI route or response, run `pnpm api:generate`. Do not edit `frontend/openapi.json` or `frontend/src/api/generated/` by hand.

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

## Host only the Open Food Facts dataset

The dataset-only deployment runs MongoDB without the frontend, backend,
PostgreSQL, or Redis. It is intended for a small team using a private Tailscale
network; MongoDB must never be exposed on the VPS public address.

Create the deployment secrets and set `LIFEGOODS_MONGO_BIND_IP` to the VPS
Tailscale address:

```bash
cp infra/secrets/dataset/.env.example infra/secrets/dataset/.env
docker compose --env-file infra/secrets/dataset/.env \
  -f infra/compose/docker-compose.dataset.yml up -d
```

Import a local full Open Food Facts JSONL gzip export with Barcode lookup only.
This retains the complete Source Records and the required unique Barcode index,
but skips the optional full-text and country search indexes:

```bash
uv run --project backend python -m lifegoods.open_food_facts.cli \
  --mongo-uri "mongodb://lifegoods_writer:REPLACE@vps.tailnet.ts.net:27017/lifegoods_off?authSource=lifegoods_off" \
  import-file /path/to/openfoodfacts-products.jsonl.gz --lookup-only
uv run --project backend python -m lifegoods.open_food_facts.cli \
  --mongo-uri "mongodb://lifegoods_writer:REPLACE@vps.tailnet.ts.net:27017/lifegoods_off?authSource=lifegoods_off" \
  list
uv run --project backend python -m lifegoods.open_food_facts.cli \
  --mongo-uri "mongodb://lifegoods_writer:REPLACE@vps.tailnet.ts.net:27017/lifegoods_off?authSource=lifegoods_off" \
  activate <version_id>
```

The importer stores the export checksum and Dataset Snapshot metadata in
MongoDB. Keep the original compressed export and checksum outside the VPS as
the recovery copy. `import-file` streams decompression and does not create a
second uncompressed file.

### Recover a completed import with source-data issues

Imports remain strict by default. After reviewing a completed failed Dataset
Snapshot, run `revalidate <version_id> --accept-source-issues` through the same
CLI and MongoDB connection to explicitly accept its malformed-record, duplicate
code, and missing-schema counts as warnings. This reuses the stored collection;
it does not download again, restore skipped records, or resolve duplicate records.
The counts and timestamped acceptance remain in the manifest and validation history.
Incomplete imports are rejected. Record-count reconciliation, database counts,
schema-version presence, unique Barcode indexing, and probe checks still apply.
The stored export checksum is retained, not recomputed from MongoDB.
Activate separately only after successful revalidation. Local integrity checks
do not verify Open Food Facts Source Records.


## Start development servers

The frontend currently uses its checked-in Dataset Snapshot for offline Product Lookup. The stable backend API remains available independently; connecting the Shopper interface and translation controls is deferred to #90.

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

## Translation storage in production and staging

The full Compose stacks use MongoDB for the read-only Dataset Snapshot and a
separate generated-data database, plus Redis. PostgreSQL and Alembic are no
longer required. Set the generated-data database, user, and password in the
matching secrets file. The Mongo initialization script creates the separate
identity only when generated storage is configured; dataset-only hosting stays
independent. Initialization scripts run only on a fresh Mongo volume. For an
existing installation, provision that database identity explicitly before
initializing the schema (see `docs/generated-data-persistence.md`).

After building the backend image and starting MongoDB/Redis, initialize and
verify generated storage explicitly (use the staging paths for staging):

```bash
docker compose --env-file infra/secrets/prod/.env -f infra/compose/docker-compose.prod.yml run --rm backend uv run --no-sync python -m lifegoods.generated_data.cli init
docker compose --env-file infra/secrets/prod/.env -f infra/compose/docker-compose.prod.yml run --rm backend uv run --no-sync python -m lifegoods.generated_data.cli verify
```

An empty `LIFEGOODS_GEMINI_API_KEY` disables generation; Product Lookup still
returns available Original Text. These commands do not activate generation or
change the Dataset Snapshot. CORS origins are a JSON array in the secrets file.

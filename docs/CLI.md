# LifeGoods CLI Reference Manual

This document provides a comprehensive reference for all command-line interfaces (CLIs), package scripts, operational commands, and flags available in the LifeGoods repository.

---

## Quick Reference Table

| Task                            | Command                                                                 | Description                                                                      |
| :------------------------------ | :---------------------------------------------------------------------- | :------------------------------------------------------------------------------- |
| **Start Infrastructure**        | `docker compose -f infra/compose.yaml up -d`                            | Launches PostgreSQL (port `5433`), MongoDB (port `27018`), & Redis (port `6380`).|
| **Apply Migrations**            | `pnpm db:migrate`                                                       | Runs Alembic schema migrations against PostgreSQL.                               |
| **Validate Reference Dataset**  | `pnpm reference:dataset -- validate <bundle_path>`                      | Validates a local JSON reference dataset bundle without writing to DB.           |
| **Import Reference Dataset**    | `pnpm reference:dataset -- import <bundle_path>`                        | Inserts an immutable Reference Dataset Version into PostgreSQL.                  |
| **Activate Reference Dataset**  | `pnpm reference:dataset -- activate <version_id>`                       | Atomically sets the active reference dataset pointer.                            |
| **Status of Reference Dataset** | `pnpm reference:dataset -- status [--dataset-kind FOOD_ALLERGEN\|HALAL_INGREDIENT]` | Displays currently active reference dataset version & metadata.                  |
| **List Reference Datasets**     | `pnpm reference:dataset -- list`                                        | Lists all imported reference dataset versions.                                   |
| **Inspect Reference Dataset**   | `pnpm reference:dataset -- inspect <version_id>`                        | Shows full concept hierarchy, mappings, exclusions, and rules.                   |
| **Rollback Reference Dataset**  | `pnpm reference:dataset -- rollback [--dataset-kind FOOD_ALLERGEN\|HALAL_INGREDIENT] [--approver <name>]` | Reverts pointer to the immediately previous valid version.                       |
| **Import OFF Dataset**          | `pnpm off:dataset -- import-url [--url <url>]`                          | Streams and imports compressed Open Food Facts JSONL export into MongoDB.        |
| **List OFF Datasets**           | `pnpm off:dataset -- list`                                              | Lists all imported OFF dataset versions and statuses.                            |
| **Activate OFF Dataset**        | `pnpm off:dataset -- activate <version_id>`                             | Sets active OFF dataset version in MongoDB control collection.                   |
| **Revalidate OFF Dataset**      | `pnpm off:dataset -- revalidate <version_id>`                           | Re-verifies barcodes and collection integrity for a dataset version.             |
| **Rollback OFF Dataset**        | `pnpm off:dataset -- rollback`                                          | Reverts active OFF pointer to the previous version.                              |
| **Prune OFF Datasets**          | `pnpm off:dataset -- prune`                                             | Deletes inactive, non-previous dataset collections.                              |
| **Delete OFF Dataset**          | `pnpm off:dataset -- delete <version_id>`                               | Drops specific inactive dataset collection.                                      |
| **Start Backend Dev Server**    | `pnpm backend:dev`                                                      | Runs FastAPI server with hot-reload at `http://localhost:8000`.                  |
| **Start Frontend (HTTPS)**      | `pnpm dev` or `pnpm dev:https`                                          | Starts Vite dev server with self-signed certificate at `https://localhost:5173`. |
| **Start Frontend (HTTP)**       | `pnpm dev:http`                                                         | Starts Vite dev server over HTTP at `http://localhost:5173`.                     |
| **Build Frontend**              | `pnpm build`                                                            | Compiles TypeScript and runs Vite production build.                              |
| **Run All Tests**               | `pnpm test`                                                             | Runs frontend Vitest and backend pytest suites.                                  |
| **Run Lint Checks**             | `pnpm lint`                                                             | Runs Prettier, ESLint, and Ruff checks.                                          |
| **Format Frontend**             | `pnpm frontend:lint:format`                                             | Auto-formats frontend code using Prettier with Tailwind plugin.                  |
| **Run Typechecks**              | `pnpm typecheck`                                                        | Runs TypeScript (`tsc`) and Pyright checks across projects.                      |
| **Generate API Client**         | `pnpm api:generate`                                                     | Exports OpenAPI JSON from FastAPI and regenerates TypeScript client.             |
| **Verify API Contract Drift**   | `pnpm api:check`                                                        | Regenerates OpenAPI spec and fails if committed artifacts differ.                |

---

## Fresh Setup Data Initialization Sequence

For fresh local setups, staging environments, or testing cutovers, follow this complete workflow to initialize and activate all data layers:

```bash
# 1. Start Infrastructure and Apply Database Migrations
docker compose -f infra/compose.yaml up -d
pnpm db:migrate

# 2. Populate and Activate Open Food Facts MongoDB Product Mirror
pnpm off:dataset -- import-url
pnpm off:dataset -- list
pnpm off:dataset -- activate <off_version_id>

# 3. Populate and Activate Food Allergen Reference Dataset (PostgreSQL)
pnpm reference:dataset -- validate backend/src/lifegoods/reference_datasets/bundles/codex_2026_food_allergen_reviewed_english_v1.json
pnpm reference:dataset -- import backend/src/lifegoods/reference_datasets/bundles/codex_2026_food_allergen_reviewed_english_v1.json
pnpm reference:dataset -- activate codex-food-allergen-2026-reviewed-english-v1 --approver lifegoods --review-kind FOOD_DOMAIN_REVIEW
pnpm reference:dataset -- status --dataset-kind FOOD_ALLERGEN

# 4. Populate and Activate Halal Ingredient Reference Dataset (PostgreSQL)
pnpm reference:dataset -- validate backend/src/lifegoods/reference_datasets/bundles/halal_ingredient_2026_reviewed_english_v1.json
pnpm reference:dataset -- import backend/src/lifegoods/reference_datasets/bundles/halal_ingredient_2026_reviewed_english_v1.json
pnpm reference:dataset -- activate halal-ingredient-2026-reviewed-english-v1 --approver lifegoods --review-kind HALAL_DOMAIN_REVIEW
pnpm reference:dataset -- status --dataset-kind HALAL_INGREDIENT
```

---

## 1. Reference Datasets CLI

The Reference Datasets CLI manages reviewed, immutable, typed domain records stored in
PostgreSQL. Each bundle manifest selects the dataset-specific record schema, validation rules,
canonical hash, persistence adapter, and inspection output. The `FOOD_ALLERGEN` kind exposes
concepts, lexical mappings, exclusions, and allergen rules; the `HALAL_INGREDIENT` kind exposes
concepts, lexical mappings, and cited Halal ingredient mappings.

**Wrapper Command:** `pnpm reference:dataset -- <subcommand> [options]`

**Direct Invocation:** `uv run --project backend python -m lifegoods.reference_datasets.cli <subcommand> [options]`

### Global Options

- `--database-url <URL>`: PostgreSQL connection string. Defaults to `LIFEGOODS_DATABASE_URL` from the environment or `.env` file (default: `postgresql+psycopg://lifegoods:lifegoods@localhost:5433/lifegoods`).

### Subcommands

#### `validate`

Validates the common bundle manifest, sources, and SHA-256 hash plus the structural invariants
for the manifest's dataset kind, without inserting into PostgreSQL. For `FOOD_ALLERGEN`, this
includes concept hierarchies, mapping links, exclusions, and allergen rule references. For
`HALAL_INGREDIENT`, this includes concept hierarchies, leaf-scoped classifications, and complete
source citations (with edition, jurisdiction, and article or section locator).

```bash
pnpm reference:dataset -- validate backend/src/lifegoods/reference_datasets/bundles/codex_2026_food_allergen_reviewed_english_v1.json
pnpm reference:dataset -- validate backend/src/lifegoods/reference_datasets/bundles/halal_ingredient_2026_reviewed_english_v1.json
```

**Output Schema (FOOD_ALLERGEN example):**

```json
{
    "status": "VALID",
    "id": "codex-food-allergen-2026-reviewed-english-v1",
    "dataset_kind": "FOOD_ALLERGEN",
    "edition": "2026-reviewed-english-v1",
    "jurisdiction": "CODEX",
    "sha256": "...",
    "source_count": 2,
    "concept_count": 29,
    "mapping_count": 28,
    "exclusion_count": 1,
    "rule_count": 29
}
```

**Output Schema (HALAL_INGREDIENT example):**

```json
{
    "status": "VALID",
    "id": "halal-ingredient-2026-reviewed-english-v1",
    "dataset_kind": "HALAL_INGREDIENT",
    "edition": "2026-reviewed-english-v1",
    "jurisdiction": "CAMBODIA_AND_INTERNATIONAL",
    "sha256": "...",
    "source_count": 4,
    "concept_count": 24,
    "mapping_count": 68,
    "halal_ingredient_mapping_count": 24
}
```

#### `import`

Validates and inserts an immutable reference dataset bundle into PostgreSQL. This operation is idempotent for identical version IDs and payloads; conflicting payloads under an existing ID are rejected.

```bash
# Food Allergens
pnpm reference:dataset -- import backend/src/lifegoods/reference_datasets/bundles/codex_2026_food_allergen_reviewed_english_v1.json

# Halal Ingredients
pnpm reference:dataset -- import backend/src/lifegoods/reference_datasets/bundles/halal_ingredient_2026_reviewed_english_v1.json
```

#### `activate`

Atomically updates the active reference dataset pointer to the specified version ID for its dataset kind.

```bash
# Food Allergens
pnpm reference:dataset -- activate codex-food-allergen-2026-reviewed-english-v1 \
  --approver lifegoods \
  --review-kind FOOD_DOMAIN_REVIEW

# Halal Ingredients
pnpm reference:dataset -- activate halal-ingredient-2026-reviewed-english-v1 \
  --approver lifegoods \
  --review-kind HALAL_DOMAIN_REVIEW
```

- `--approver <string>`: Name or identifier of the project maintainer approving activation (use `lifegoods` in development).
- `--review-kind <string>`: Classification of review (e.g., `FOOD_DOMAIN_REVIEW`, `HALAL_DOMAIN_REVIEW`, `PROJECT_MAINTAINER_APPROVAL`).

#### `status`

Displays the currently active pointer and version record for a dataset kind.

```bash
# Check Food Allergen status
pnpm reference:dataset -- status --dataset-kind FOOD_ALLERGEN

# Check Halal Ingredient status
pnpm reference:dataset -- status --dataset-kind HALAL_INGREDIENT
```

- `--dataset-kind <string>`: Dataset category (default: `FOOD_ALLERGEN`, or `HALAL_INGREDIENT`).

#### `list`

Lists all imported reference dataset versions in PostgreSQL ordered by retrieval date.

```bash
pnpm reference:dataset -- list
```

#### `inspect`

Dumps the common version metadata and the complete typed records for that dataset kind. A
`FOOD_ALLERGEN` version includes all concept nodes, mapped lexical tokens, exclusions, and rules. A
`HALAL_INGREDIENT` version includes all concept nodes, mapped lexical tokens, and cited Halal ingredient mappings.

```bash
# Inspect Food Allergen version
pnpm reference:dataset -- inspect codex-food-allergen-2026-reviewed-english-v1

# Inspect Halal Ingredient version
pnpm reference:dataset -- inspect halal-ingredient-2026-reviewed-english-v1
```

#### `rollback`

Atomically reverts the active pointer for a dataset kind to the immediately previous valid version.

```bash
# Rollback Food Allergen dataset
pnpm reference:dataset -- rollback --dataset-kind FOOD_ALLERGEN --approver lifegoods

# Rollback Halal Ingredient dataset
pnpm reference:dataset -- rollback --dataset-kind HALAL_INGREDIENT --approver lifegoods
```

---

## 2. Open Food Facts (OFF) Dataset CLI

The Open Food Facts CLI handles importing, indexing, validating, and activating snapshot versions of the Open Food Facts product database in MongoDB.

**Wrapper Command:** `pnpm off:dataset -- <subcommand> [options]`

**Direct Invocation:** `uv run --project backend python -m lifegoods.open_food_facts.cli --mongo-uri <URI> <subcommand> [options]`

### Global Options

- `--mongo-uri <URI>`: MongoDB connection string with write privileges (e.g., `mongodb://lifegoods_writer:lifegoods_writer@localhost:27018/lifegoods_off`).
- `--database <NAME>`: Target MongoDB database name (default: `lifegoods_off`).

### Subcommands

#### `import-url`

Streams a gzipped JSONL product export directly into a new versioned MongoDB collection, calculates the SHA-256 hash, builds a unique index on `code`, and validates probe barcodes.

```bash
pnpm off:dataset -- import-url [--url <url>] [--probe <barcode>] [--progress-seconds <seconds>]
```

- `--url <URL>`: Source gzipped JSONL URL (defaults to official daily Open Food Facts export: `https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz`).
- `--probe <code_string>`: Known barcode expected in the dataset (can be specified multiple times; default: `4006381333931`).
- `--progress-seconds <float>`: Progress reporting interval in seconds (default: `5.0`).

#### `activate`

Atomically points the active OFF dataset pointer to the specified version ID and ensures the unique `code` index exists.

```bash
pnpm off:dataset -- activate <version_id>
```

#### `revalidate`

Re-runs validation checks against an existing dataset collection, recording probe verification results in the version history.

```bash
pnpm off:dataset -- revalidate <version_id> [--probe <barcode>]
```

#### `list`

Lists all OFF dataset versions stored in MongoDB along with status (`IMPORTING`, `READY`, `ACTIVE`, `FAILED`) and document counts.

```bash
pnpm off:dataset -- list
```

#### `rollback`

Reverts the active OFF pointer to the immediately preceding active version.

```bash
pnpm off:dataset -- rollback
```

#### `prune`

Drops all MongoDB collections and manifest records for versions that are not active and not designated as the rollback target.

```bash
pnpm off:dataset -- prune
```

#### `delete`

Drops the collection and removes the manifest for a specific inactive version.

```bash
pnpm off:dataset -- delete <version_id>
```

---

## 3. Database Migrations (PostgreSQL)

Relational migrations are managed via Alembic.

### Apply All Pending Migrations

```bash
pnpm db:migrate
```

### Direct Alembic Commands

When creating or inspecting migrations directly:

```bash
# Check current migration revision
uv run --project backend alembic -c backend/alembic.ini current

# View migration history
uv run --project backend alembic -c backend/alembic.ini history

# Generate a new migration revision
uv run --project backend alembic -c backend/alembic.ini revision -m "description_of_change"
```

---

## 4. Application Runtime & Development Servers

### Backend Development Server

Starts FastAPI with Uvicorn and hot reloading on `http://localhost:8000`.

```bash
pnpm backend:dev
```

### Frontend Development Server (HTTPS - Default)

Generates a local self-signed certificate supporting local IP addresses and launches Vite over HTTPS at `https://localhost:5173` (proxies `/api` to `http://localhost:8000`).

```bash
pnpm dev
# Or explicitly:
pnpm dev:https
```

### Frontend Development Server (HTTP)

Launches Vite without SSL certificates at `http://localhost:5173`. Useful for environments where camera access is not required.

```bash
pnpm dev:http
```

### Frontend Production Build

Typechecks TypeScript and builds optimized production bundles under `frontend/dist/`.

```bash
pnpm build
```

---

## 5. API Contract & Client Generation

FastAPI is the single source of truth for the API contract. The frontend client in `frontend/src/api/generated/` is generated automatically from `frontend/openapi.json`.

### Regenerate OpenAPI Spec & TypeScript Client

```bash
pnpm api:generate
```

### Verify Contract Synchronization (CI Check)

Regenerates the specification and verifies that no uncommitted changes exist in `frontend/openapi.json` or `frontend/src/api/generated/`.

```bash
pnpm api:check
```

---

## 6. Testing, Linting & Verification

### Unified Test Command

Runs frontend Vitest tests followed by backend pytest tests:

```bash
pnpm test
```

### Focused Backend Tests

```bash
# Run all backend tests
pnpm backend:test

# Run a specific backend test module
uv run --project backend pytest backend/tests/test_identifier.py

# Run a specific test with pytest verbosity
uv run --project backend pytest backend/tests/test_reference_datasets_cli.py -v
```

### Focused Frontend Tests

```bash
# Run all frontend tests
pnpm --dir frontend test

# Run a specific frontend test file
pnpm --dir frontend exec vitest run tests/identifier.test.ts
```

### Linting & Formatting

```bash
# Run all lint checks (Prettier check, ESLint, Ruff)
pnpm lint

# Format frontend code (Prettier with Tailwind plugin)
pnpm frontend:lint:format

# Run backend Ruff linter
pnpm backend:lint
```

### Type Checking

```bash
# Run full project typecheck (tsc + pyright)
pnpm typecheck

# Run backend Pyright typecheck only
pnpm backend:typecheck
```

---

## 7. Infrastructure Management (Docker Compose)

The repository provides local PostgreSQL, MongoDB, and Redis instances via `infra/compose.yaml`.
- **PostgreSQL**: host port `5433` (durable volume `lifegoods-postgres`)
- **MongoDB**: host port `27018` (durable volume `lifegoods-mongodb`)
- **Redis**: host port `6380` (non-durable assessment evaluation cache, no persistent volume)

```bash
# Start all databases and caches in background
docker compose -f infra/compose.yaml up -d

# Start only a specific service
docker compose -f infra/compose.yaml up -d postgres mongodb
docker compose -f infra/compose.yaml up -d redis

# View container status and health
docker compose -f infra/compose.yaml ps

# View container logs
docker compose -f infra/compose.yaml logs -f
docker compose -f infra/compose.yaml logs -f redis

# Inspect cached assessment evaluation keys in Redis
docker compose -f infra/compose.yaml exec redis redis-cli keys "assessment:eval:*"

# Flush Redis assessment evaluation cache
docker compose -f infra/compose.yaml exec redis redis-cli flushdb

# Stop containers
docker compose -f infra/compose.yaml stop

# Stop containers and remove volumes (Destructive: resets all local DB data)
docker compose -f infra/compose.yaml down -v
```

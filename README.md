# LifeGoods

LifeGoods is a Khmer-first packaged-food guidance application. It helps shoppers understand evidence from sealed packaged-food labels before purchase.

The identifier is a lookup key for a `Package Variant`; it is not a `Product` identity or a safety, health, Halal, legal, authenticity, or purchase conclusion.

## Requirements

- Node.js 24 LTS and pnpm
- Python 3.13 and uv
- Docker with Compose (for local PostgreSQL, MongoDB, and Redis)

## Getting Started

### 1. Install Dependencies & Configure Environment

```bash
pnpm install
pnpm backend:install
cp backend/.env.example backend/.env
```

> **Note**: To enable stateless assessments in development, set `LIFEGOODS_ALLERGEN_ASSESSMENTS_ENABLED=true` and `LIFEGOODS_HALAL_INGREDIENT_ASSESSMENTS_ENABLED=true` in `backend/.env` after activating the corresponding reference datasets in Step 4. Halal engine releases are selected with `LIFEGOODS_HALAL_INGREDIENT_ASSESSMENT_ENGINE_VERSION`.

### 2. Start Databases & Apply Migrations

Start local PostgreSQL (port `5433`), MongoDB (port `27018`), and Redis (port `6380`), then apply PostgreSQL schema migrations:

```bash
docker compose -f infra/compose.yaml up -d
pnpm db:migrate
```

### 3. Ingest & Activate Open Food Facts Product Mirror (MongoDB)

Stream, index, and activate the Open Food Facts external catalog snapshot:

```bash
pnpm off:dataset -- import-url
pnpm off:dataset -- list
pnpm off:dataset -- activate <off_version_id>
```

### 4. Ingest & Activate Reference Datasets (PostgreSQL)

Validate, import, and activate the reviewed English Food Allergen and Halal Ingredient reference datasets:

```bash
# Food Allergens (Codex 2026)
pnpm reference:dataset -- validate backend/src/lifegoods/reference_datasets/bundles/codex_2026_food_allergen_reviewed_english_v1.json
pnpm reference:dataset -- import backend/src/lifegoods/reference_datasets/bundles/codex_2026_food_allergen_reviewed_english_v1.json
pnpm reference:dataset -- activate codex-food-allergen-2026-reviewed-english-v1 --approver lifegoods --review-kind PROJECT_MAINTAINER_APPROVAL
pnpm reference:dataset -- status --dataset-kind FOOD_ALLERGEN

# Halal Ingredients (Cambodia Prakas No. 090 & OIC/SMIIC)
pnpm reference:dataset -- validate backend/src/lifegoods/reference_datasets/bundles/halal_ingredient_2026_reviewed_english_v1.json
pnpm reference:dataset -- import backend/src/lifegoods/reference_datasets/bundles/halal_ingredient_2026_reviewed_english_v1.json
pnpm reference:dataset -- activate halal-ingredient-2026-reviewed-english-v1 --approver lifegoods --review-kind PROJECT_MAINTAINER_APPROVAL
pnpm reference:dataset -- status --dataset-kind HALAL_INGREDIENT
```

### 5. Start Development Servers

Run the API backend and Web Client in separate terminals:

```bash
# Terminal 1: Backend API (http://localhost:8000)
pnpm backend:dev

# Terminal 2: Web Client (http://localhost:5173)
pnpm dev
```

Open `http://localhost:5173` in your browser. For HTTPS with camera access, run `pnpm dev:https` instead.

## Verification

```bash
# Run full verification suite (TypeScript, Ruff, ESLint, Vitest, pytest, Vite build, OpenAPI check)
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm api:check
```

## Documentation

- [CLI Reference Manual](docs/CLI.md) — Complete guide to all CLI commands, arguments, dataset management, and lifecycle tools
- [Reference Dataset Operations](docs/REFERENCE_DATASETS.md) — Reference dataset bundle specifications, review scope, and rollbacks
- [Open Food Facts Dataset Operations](docs/OFF_DATASET.md) — External dataset import, validation gates, and MongoDB management
- [Project Documentation Index](DOCS.md) — Architecture, domain glossary, and specifications

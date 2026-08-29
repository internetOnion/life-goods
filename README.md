# LifeGoods

LifeGoods is a Khmer-first packaged-food guidance application. It helps shoppers understand evidence from sealed packaged-food labels before purchase.

The identifier is a lookup key for a `Package Variant`; it is not a `Product` identity or a safety, health, Halal, legal, authenticity, or purchase conclusion.

## Requirements

- Node.js 24 LTS and pnpm
- Python 3.13 and uv
- Docker with Compose (for local PostgreSQL and MongoDB)

## Quick Start

### 1. Install Dependencies & Configure

```bash
pnpm install
pnpm backend:install
cp backend/.env.example backend/.env
```

To enable allergen assessments, set `LIFEGOODS_ALLERGEN_ASSESSMENTS_ENABLED=true` in `backend/.env`.

### 2. Start Databases & Apply Migrations

```bash
docker compose -f infra/compose.yaml up -d postgres mongodb
pnpm db:migrate
```

### 3. Initialize Reference Data

Import and activate the reviewed English Codex-2026 food allergen dataset:

```bash
pnpm reference:dataset -- import backend/src/lifegoods/reference_datasets/bundles/codex_2026_food_allergen_reviewed_english_v1.json
pnpm reference:dataset -- activate codex-food-allergen-2026-reviewed-english-v1
```

### 4. Start Development Servers

Run the API backend and Web Client in separate terminals:

```bash
# Terminal 1: Backend API (http://localhost:8000)
pnpm backend:dev

# Terminal 2: Web Client (https://localhost:5173)
pnpm dev
```

Open `https://localhost:5173` in your browser. For plain HTTP without camera access, run `pnpm dev:http` instead.

## Verify

```bash
pnpm test
```

## Documentation

- [CLI Reference Manual](docs/CLI.md) — Complete guide to all CLI commands, arguments, dataset management, and lifecycle tools
- [Reference Dataset Operations](docs/REFERENCE_DATASETS.md) — Reference dataset bundle specifications, review scope, and rollbacks
- [Open Food Facts Dataset Operations](docs/OFF_DATASET.md) — External dataset import, validation gates, and MongoDB management
- [Project Documentation Index](DOCS.md) — Architecture, domain glossary, and specifications

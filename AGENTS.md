# Agent Guide

## Before Changing

- For domain, schema, provenance, or privacy work, read `CONTEXT.md`, `docs/SPEC.md`, `docs/DATA_MODEL.md`, `docs/CLI.md`, and the applicable accepted ADRs.
- For shopper-facing UI, read `PRODUCT.md` and then `DESIGN.md`.
- Use the exact glossary terms and capitalization: `Product`, `Package Variant`, `Package Revision`, `Claim`, `Evidence`, `Package Match`, and `Shopper Guidance`.

## Structure

- `frontend/` is the only pnpm workspace package; `backend/` is a separate Python 3.13 uv project.
- `frontend/src/main.tsx` is the React entrypoint; `frontend/src/app/App.tsx` composes routes and feature behavior lives under `frontend/src/features/`.
- `backend/src/lifegoods/main.py` is the FastAPI app factory. Backend code is structured into domain modules: `core/` for shared infrastructure and base errors, `identifiers/` for identifier validation and algorithms, `catalog/` for durable catalog persistence, `open_food_facts/` for external OFF dataset querying, image caching, and CLI, `reference_datasets/` for reference dataset bundle validation, immutable import, and operator CLI, and `package_matches/` for package matching use cases and API routing.
- The frontend calls the backend through the generated client; FastAPI owns the contract. `frontend/openapi.json` and `frontend/src/api/generated/` are generated files.

## Commands

- Requirements are Node.js 24, pnpm, Python 3.13, uv, and Docker Compose.
- Install with `pnpm install` and `pnpm backend:install`.
- Start PostgreSQL and MongoDB with `docker compose -f infra/compose.yaml up -d`, then apply migrations with `pnpm db:migrate`; PostgreSQL is exposed on host port `5433` and MongoDB on port `27018`.
- Populate Reference Datasets with `pnpm reference:dataset -- import <bundle_path>` and activate with `pnpm reference:dataset -- activate <version_id>`. Populate Open Food Facts data with `pnpm off:dataset -- import-url` and activate it with `pnpm off:dataset -- activate <version_id>`. See [`docs/CLI.md`](docs/CLI.md) for full CLI manual.
- Run `pnpm backend:dev` and `pnpm dev` in separate terminals for HTTP at `http://localhost:5173`.
- Use `pnpm dev:https` for frontend HTTPS at `https://localhost:5173`; it requires `openssl`, generates an ignored self-signed certificate under `frontend/certs/`, and still proxies `/api` to the HTTP API.
- The normal verification set is `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm api:check`.
- `pnpm test` runs frontend Vitest followed by backend pytest; focused tests are `pnpm --dir frontend exec vitest run tests/identifier.test.ts` and `uv run --project backend pytest backend/tests/test_identifier.py`.
- `pnpm lint` runs frontend Prettier before ESLint and backend Ruff; if existing `frontend/index.html` or `.impeccable/live` formatting blocks it, run the ESLint and Ruff commands separately rather than reformatting unrelated live files.
- After changing an API route or response, run `pnpm api:generate`; use `pnpm api:check` to regenerate and fail on committed OpenAPI/client drift. Never edit generated files by hand.

## Boundaries

- An identifier is a lookup key for a `Package Variant`; a `Package Match` is a candidate, not proof of physical-package identity. Preserve field-level provenance, competing Claims, and explicit missing or uncertain evidence.
- Keep Open Food Facts data attributed and distinct from reviewed catalog data; an absent external field is unknown, not a negative Claim.
- Keep private `Package Capture` media and results isolated from durable catalog data, training, analytics, and manual review; MVP retention is at most 24 hours.
- Do not introduce safety, health, allergen-free, Halal, legal/compliance, authenticity, or purchase verdicts.

## Project Conventions

- TypeScript is strict; unused locals and parameters fail typecheck. Frontend formatting uses the root Prettier config and Tailwind plugin; use `pnpm frontend:lint:format` or `pnpm --dir frontend lint:format`.
- Add schema changes as Alembic revisions under `backend/migrations/`; normal development uses the PostgreSQL migration path and tests use disposable database fixtures where appropriate.
- If documentation changes, put research in `docs/research/` and Mermaid source plus rendered output in `docs/diagrams/`.
- Use lowercase Conventional-style commit prefixes (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) only when a commit is explicitly requested.

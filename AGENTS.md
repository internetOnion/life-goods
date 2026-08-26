# Agent Guide

## Read Before Changing

- For domain, schema, provenance, or privacy work, read `CONTEXT.md`, `docs/SPEC.md`, `docs/DATA_MODEL.md`, and the applicable accepted ADRs. For shopper-facing UI, read `PRODUCT.md` and then `DESIGN.md`.
- Use the glossary's exact terms and capitalization: `Product`, `Package Variant`, `Package Revision`, `Claim`, `Evidence`, `Package Match`, and `Shopper Guidance`.

## Repository Shape

- `frontend/` is the pnpm workspace package on Node.js 24; `backend/` is a separate Python 3.13 uv project. `frontend/src/main.tsx` wires React Router and TanStack Query; routes are composed in `frontend/src/app/App.tsx` and feature behavior lives under `frontend/src/features/`.
- `backend/src/lifegoods/main.py` is the FastAPI app factory. Keep route handlers in `api/` thin, coordinate use cases in `application/`, keep matching rules in `matching/`, and put database/external integrations in `adapters/`.
- FastAPI owns the API contract. `frontend/openapi.json` and `frontend/src/api/generated/` are generated; after changing a route or response, run `pnpm api:generate` and review the generated diff rather than editing generated files by hand.
- Add schema changes as Alembic revisions under `backend/migrations/`. The E2E harness uses disposable SQLite and `create_all`; normal local development uses the PostgreSQL migration path.

## Commands

- Install dependencies with `pnpm install` and `pnpm backend:sync`.
- Normal local setup: `docker compose -f infra/compose.yaml up -d postgres`, then `pnpm db:migrate`. The database is exposed on host port `5433`.
- Run `pnpm backend:dev` and `pnpm dev` in separate terminals. The frontend predev script requires `openssl` and creates ignored, self-signed certificates, so use `https://localhost:5173` and accept the local certificate warning.
- Root checks are `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, and `pnpm api:check`. `typecheck` and `build` cover the frontend; `lint` also runs backend Ruff; `test` runs frontend Vitest then backend pytest.
- Focused checks: `pnpm --dir frontend exec vitest run tests/identifier.test.ts`, `uv run --project backend pytest backend/tests/test_identifier.py`, and `pnpm --dir frontend exec playwright test e2e/manual-identifier.spec.ts`.

## Domain Boundaries

- An identifier is a lookup key for a `Package Variant`; a `Package Match` is a candidate, not proof of physical-package identity. Preserve field-level provenance, competing Claims, and explicit missing or uncertain evidence.
- Keep Open Food Facts data attributed and distinguishable from reviewed catalog data; an absent external field is unknown, not a negative Claim.
- Keep private `Package Capture` media and results isolated from durable catalog data, training, analytics, and manual review; MVP retention is at most 24 hours.
- Do not introduce safety, health, allergen-free, Halal, legal/compliance, authenticity, or purchase verdicts. If documentation changes, keep research in `docs/research/` and Mermaid source plus rendered output in `docs/diagrams/`.

## Style and Workflow

- Frontend formatting is enforced by the root Prettier config and Tailwind plugin; use `pnpm frontend:lint:format` or `pnpm --dir frontend lint:format` for formatting. TypeScript is strict and unused locals/parameters fail typecheck.
- Use lowercase Conventional-style commit prefixes (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) when a commit is explicitly requested.

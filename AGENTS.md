# Agent Guide

## Before changing

- For product, domain, API, source-data, translation, privacy, or persistence work, read `PRODUCT.md`, `CONTEXT.md`, `docs/SPEC.md`, and applicable accepted ADRs.
- For shopper-facing UI, read `PRODUCT.md` and the relevant specification. Create `DESIGN.md` only when a new visual direction has actually been designed and accepted.
- Use the exact glossary terms and capitalization: `Shopper`, `Product`, `Barcode`, `Product Lookup`, `Source Record`, `Dataset Snapshot`, `Source Attribution`, `Source Assessment`, `Source Data Unavailable`, `Original Text`, and `Khmer Translation`.
- `CONTEXT.md` is a glossary only. Keep behavior, API shapes, storage choices, and implementation plans out of it.

## Transition warning

The current code still contains catalog, package-match, reference-dataset, allergen, Halal, assessment, package-capture, PostgreSQL, and Alembic behavior from the previous product direction. It is transitional implementation, not product authority.

Do not extend those concepts unless the new specification explicitly requires them. The backend refactor will remove obsolete modules and relational persistence only after their dependencies are mapped, and will update models, migrations, tests, configuration, infrastructure, README, OpenAPI, and the generated client atomically.

## Structure

- `frontend/` is the only pnpm workspace package; `backend/` is a separate Python 3.13 uv project.
- `frontend/src/main.tsx` is the React entrypoint. `frontend/src/app/App.tsx` composes routes, and feature behavior lives under `frontend/src/features/`.
- `backend/src/lifegoods/main.py` is the FastAPI app factory.
- `backend/src/lifegoods/open_food_facts/` contains the local Open Food Facts dataset import and read foundation that the new backend retains.
- `backend/src/lifegoods/identifiers/` contains Barcode validation and algorithms that should be evaluated for reuse.
- `backend/src/lifegoods/catalog/`, `reference_datasets/`, and `package_matches/` are legacy-domain modules pending the backend refactor.
- FastAPI owns the frontend contract. `frontend/openapi.json` and `frontend/src/api/generated/` are generated files.

## Current commands

- Requirements are Node.js 24, pnpm, Python 3.13, uv, and Docker Compose.
- Install with `pnpm install` and `pnpm backend:install`.
- The current checkout still starts PostgreSQL, MongoDB, and Redis with `docker compose -f infra/compose.yaml up -d` and applies existing migrations with `pnpm db:migrate`.
- Inspect and activate the local Open Food Facts snapshot with `pnpm off:dataset -- list` and `pnpm off:dataset -- activate <version_id>`.
- Run `pnpm backend:dev` and `pnpm dev` in separate terminals for HTTP development at `http://localhost:5173`.
- Use `pnpm dev:https` for camera testing at `https://localhost:5173`.
- The normal verification set is `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm api:check`.
- After changing an API route or response, run `pnpm api:generate`; use `pnpm api:check` to detect committed OpenAPI/client drift. Never edit generated files by hand.

## Product boundaries

- Life Goods is a read-only presentation layer over a static local Open Food Facts Dataset Snapshot.
- Open Food Facts remains visibly attributed external source data. Local hosting, integrity checks, and caching do not verify it or make it a Life Goods catalog.
- Source Data Unavailable is unknown, not a negative assertion.
- Source Assessments remain attributed Open Food Facts calculations; do not present them as Life Goods judgments.
- Do not introduce Product contributions, verification, package capture, camera uploads, accounts, server-side scan history, or personalization into the MVP.
- Do not introduce safety, health, allergen-free, Halal, legal/compliance, authenticity, or purchase verdicts.
- Decode camera frames on-device. Send only the Barcode to the backend.
- Keep Barcode-level and Shopper-level data out of analytics.

## Project conventions

- TypeScript is strict; unused locals and parameters fail typecheck.
- Frontend formatting uses the root Prettier configuration and Tailwind plugin. Use `pnpm frontend:lint:format` or `pnpm --dir frontend lint:format`.
- All scripts, package commands, tools, and path operations must work across Windows, macOS, and Linux. Do not use POSIX-only inline environment assignments or hardcoded shell-specific path separators.
- Preserve existing migration history until the atomic backend refactor removes PostgreSQL/Alembic with obsolete models and tests. Do not create an empty replacement baseline first.
- Create documentation lazily. `PRODUCT.md` defines product intent, `CONTEXT.md` defines language, `docs/SPEC.md` defines current behavior, and `docs/adr/` records only decisions that are hard to reverse, surprising without context, and the result of a real tradeoff.
- Put new research in `docs/research/` and Mermaid source plus rendered output in `docs/diagrams/` only when the work actually requires them.
- Icons and illustrations are not restricted to Phosphor. Use any icon library or custom SVG as long as it has high semantic fidelity (truthfully represents the underlying concept without mismatched compromises) and is vibe-coded to match the Life Goods visual identity (non-generic, tactile, cohesive stroke weights and tones).
- Use lowercase Conventional-style commit prefixes (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) only when a commit is explicitly requested.

## Issue tracking

Issues and implementation tickets use GitHub Issues for `internetOnion/life-goods`.
- **Triage & Status**: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `in-progress`, `blocked`, and `wontfix`.
- **Hierarchy & Scope**: `epic` (parent tracking issues), `backend`, `frontend`, and `documentation`.
The previous Wave taxonomy has been retired and removed.


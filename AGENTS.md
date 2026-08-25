# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm/uv monorepo with a React/Vite Web Client, FastAPI backend, generated OpenAPI client, SQLAlchemy/Alembic persistence, and focused frontend/backend/e2e tests. Read `CONTEXT.md` for the domain glossary, `docs/SPEC.md` for MVP behavior, `docs/DATA_MODEL.md` for entities and provenance, and relevant `docs/adr/` decisions before changing the model. Research belongs in `docs/research/`; Mermaid source and rendered diagrams belong in `docs/diagrams/`.

The implementation layout is `frontend/` (React/Vite/TypeScript Web Client), `backend/` (FastAPI/Python application, matching domain, persistence, migrations, and scripts), `evaluation/` (datasets and model evaluation), and `infra/` (local services). Keep Package Capture media isolated from catalog data and training data.

## Build, Test, and Development Commands

Use the root scripts for the normal verification loop: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, and `pnpm api:check`. Start local PostgreSQL with `docker compose -f infra/compose.yaml up -d postgres`, apply migrations with `pnpm db:migrate`, and run the API and Web Client with `pnpm backend:dev` and `pnpm dev`. Use `pnpm backend:sync` to provision Python dependencies. For documentation-only changes, use `git diff --check`.

## Coding Style & Naming Conventions

Use strict TypeScript and typed Python. Keep HTTP handlers thin and put domain behavior in application services. Use the glossary’s exact terms and capitalization: `Product`, `Package Variant`, `Package Revision`, `Claim`, `Evidence`, `Package Match`, and `Shopper Guidance`. Preserve field-level provenance; never collapse external data into a product-wide verification flag.

## Testing Guidelines

Test observable behavior at the highest useful seam. Backend behavior uses pytest; focused Web Client behavior uses Vitest and Testing Library; browser journeys use Playwright. The current vertical slice covers identifier validation, Package Match lookup outcomes, accessibility, localization, and failure recovery. Use deterministic catalog fixtures rather than mutable live responses. Cover uncertainty, missing-data semantics, privacy, retention, and source attribution—not only successful matches.

## Commit & Pull Request Guidelines

Existing commits use short, imperative, lowercase Conventional-style prefixes such as `docs: update technology stack`. Use `feat:`, `fix:`, `docs:`, `test:`, or `chore:` with a focused subject. Pull requests should explain user-visible behavior, link the relevant GitHub issue, describe tests run, call out migrations or privacy implications, and include screenshots for UI changes.

## Agent Workflow & Safety Boundaries

Before implementation, inspect applicable ADRs, especially claim-level provenance and private Package Capture isolation. Prefer small vertical slices, preserve uncertainty explicitly, and keep unsupported safety, Halal, legal, and authenticity conclusions out of the product. Use `apply_patch` for edits, avoid destructive Git commands, and update documentation when a domain or architecture decision changes.

## Design Context

When changing shopper-facing UI or making product/design decisions, read `PRODUCT.md` for product identity, audience, principles, and accessibility, then read `DESIGN.md` for the current visual direction and interface guardrails. Treat the linked Figma concept as an evolving structural reference; implementation remains governed by the repository specification, user stories, glossary, and ADRs.

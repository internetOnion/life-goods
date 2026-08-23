# Repository Guidelines

## Project Structure & Module Organization

This is currently a documentation-first repository. Read `CONTEXT.md` for the domain glossary, `docs/SPEC.md` for MVP behavior, `docs/DATA_MODEL.md` for entities and provenance, and relevant `docs/adr/` decisions before changing the model. Research belongs in `docs/research/`; Mermaid source and rendered diagrams belong in `docs/diagrams/`.

The planned implementation layout is `frontend/` (React/Vite/TypeScript), `backend/` (FastAPI/Python), `evaluation/` (datasets and model evaluation), and `infra/` (deployment and local services). Keep Package Capture media isolated from catalog data and training data.

## Build, Test, and Development Commands

No executable application or package manifests exist yet, so there is no working build or test command today. For documentation-only changes, use `git diff --check`. When implementation directories land, follow their committed scripts and the technology plan: `pnpm` for the Web Client, `uv run` for Python tooling, Docker Compose for local PostgreSQL/Redis/object storage, and generated OpenAPI client checks in CI.

## Coding Style & Naming Conventions

Use strict TypeScript and typed Python. Keep HTTP handlers thin and put domain behavior in application services. Use the glossary’s exact terms and capitalization: `Product`, `Package Variant`, `Package Revision`, `Claim`, `Evidence`, `Package Match`, and `Shopper Guidance`. Preserve field-level provenance; never collapse external data into a product-wide verification flag.

## Testing Guidelines

Test observable behavior at the highest useful seam. The planned tools are pytest for backend behavior, Vitest and Testing Library for focused Web Client behavior, and Playwright for end-to-end journeys. Use deterministic Open Food Facts fixtures rather than mutable live responses. Cover uncertainty, missing-data semantics, privacy, retention, and source attribution—not only successful matches.

## Commit & Pull Request Guidelines

Existing commits use short, imperative, lowercase Conventional-style prefixes such as `docs: update technology stack`. Use `feat:`, `fix:`, `docs:`, `test:`, or `chore:` with a focused subject. Pull requests should explain user-visible behavior, link the relevant GitHub issue, describe tests run, call out migrations or privacy implications, and include screenshots for UI changes.

## Agent Workflow & Safety Boundaries

Before implementation, inspect applicable ADRs, especially claim-level provenance and private Package Capture isolation. Prefer small vertical slices, preserve uncertainty explicitly, and keep unsupported safety, Halal, legal, and authenticity conclusions out of the product. Use `apply_patch` for edits, avoid destructive Git commands, and update documentation when a domain or architecture decision changes.

## Design Context

When changing shopper-facing UI or making product/design decisions, read `PRODUCT.md` for product identity, audience, principles, and accessibility, then read `DESIGN.md` for the current visual direction and interface guardrails. Treat the linked Figma concept as an evolving structural reference; implementation remains governed by the repository specification, user stories, glossary, and ADRs.

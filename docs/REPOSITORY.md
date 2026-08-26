# Repository Structure and Branching

This document records the intended repository layout and Git workflow for LifeGoods. It should evolve with the implementation, while the domain vocabulary in [`CONTEXT.md`](../CONTEXT.md), product behavior in [`SPEC.md`](SPEC.md), data invariants in [`DATA_MODEL.md`](DATA_MODEL.md), and accepted ADRs remain authoritative for their respective decisions.

## Repository strategy

LifeGoods uses a monorepo so a vertical slice can change backend behavior, the generated Web Client contract, shopper-facing behavior, infrastructure, tests, and documentation together. The four main implementation areas are:

- `frontend/`: the React, Vite, and TypeScript Web Client shared by standalone browsers and the Telegram Mini App;
- `backend/`: the FastAPI application, Celery worker, domain behavior, persistence, and external adapters;
- `evaluation/`: versioned datasets, model benchmarks, fixtures, and evaluation reports;
- `infra/`: local services, deployment configuration, monitoring, and operational scripts.

Create directories when the first working slice needs them. Do not add an empty skeleton for speculative features.

## Planned layout

```text
life-goods/
├── README.md
├── AGENTS.md
├── CONTEXT.md
├── PRODUCT.md
├── DESIGN.md
├── docs/
│   ├── SPEC.md
│   ├── USER_STORIES.md
│   ├── DATA_MODEL.md
│   ├── TECH_STACK.md
│   ├── REPOSITORY.md
│   ├── adr/
│   ├── research/
│   └── diagrams/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── features/
│   │   ├── platform/
│   │   ├── api/generated/
│   │   ├── i18n/
│   │   └── ui/
│   ├── tests/
├── backend/
│   ├── src/lifegoods/
│   │   ├── api/
│   │   ├── catalog/
│   │   ├── claims/
│   │   ├── matching/
│   │   ├── assessment/
│   │   ├── knowledge/
│   │   ├── capture/
│   │   ├── application/
│   │   ├── adapters/
│   │   └── worker/
│   ├── migrations/
│   └── tests/
├── evaluation/
│   ├── datasets/
│   ├── benchmarks/
│   ├── reports/
│   └── tests/
└── infra/
    ├── docker/
    ├── cloudflare/
    ├── fly/
    ├── monitoring/
    └── scripts/
```

## Module placement

### Web Client

Organize shopper behavior primarily by feature, such as scanning, Package Match, evidence inspection, Knowledge Entries, and local preferences. Keep application bootstrap, routing, and providers under `app/`. Put browser and Telegram differences behind small adapters under `platform/`.

The FastAPI OpenAPI document is the source of truth for the generated client in `frontend/src/api/generated/`. Do not maintain a second handwritten set of HTTP contract types.

Shared `ui/` code should contain presentation primitives with real reuse. Feature-specific views, hooks, and state stay with their feature instead of accumulating in global `components/`, `hooks/`, or `utils/` directories.

### Backend

Keep HTTP handlers thin and put use-case coordination in `application/`. Domain behavior and invariants belong to focused modules such as `catalog/`, `claims/`, `matching/`, and `assessment/`. Concrete PostgreSQL, Open Food Facts, object-storage, and queue integrations are adapters at those modules' seams.

FastAPI and Celery share the backend package initially but use separate runtime entry points. Split them into separately maintained applications only if deployment or ownership needs eventually justify the additional interface.

The `capture/` module is an explicit privacy seam. It uses isolated ephemeral storage and cannot attach shopper media, private Claims, or private assessments to the durable catalog. Catalog ingestion uses project-owned or separately licensed evidence through a distinct internal workflow, as required by [ADR 0007](adr/0007-isolate-private-package-capture.md).

### Evaluation and infrastructure

Evaluation datasets must not contain private Package Capture media. Keep expected outputs, benchmark manifests, provider comparisons, and versioned reports within `evaluation/`, following [ADR 0006](adr/0006-benchmark-ai-models-and-version-results.md).

Keep local service definitions and deployment configuration in `infra/`. Database migrations remain in `backend/migrations/` because they are versioned with the application and its data invariants.

## Branching model

Use trunk-based development centered on a protected, deployable `main` branch. Do not create permanent `develop`, `frontend`, `backend`, `staging`, or `production` branches. Environments deploy the same commit with separate configuration and resources.

During the pre-main MVP phase, [`plan/TEAM_EXECUTION_PLAN.md`](plan/TEAM_EXECUTION_PLAN.md) defines `mvp/foundation` as a temporary protected integration branch. Feature branches target `mvp/foundation` until its pilot gates pass, after which one reviewed pull request merges it to `main` and the temporary branch is removed. This is a time-bounded delivery exception, not a permanent `develop` branch.

Create short-lived branches from an up-to-date `main` using these prefixes:

```text
feat/<short-description>
fix/<short-description>
docs/<short-description>
test/<short-description>
chore/<short-description>
spike/<question>
```

Include the issue number when it improves traceability, for example `feat/42-package-match-api`. A `spike/` branch answers a bounded question; production work discovered by the spike moves to a normal branch rather than merging experimental code by default.

## Pull requests and releases

- Keep branches open for hours or a few days rather than weeks.
- Prefer small vertical slices that include the schema, backend behavior, generated client, Web Client state, and tests needed for one observable behavior.
- Require linting, formatting, type checks, tests, OpenAPI drift detection, build checks, and migration validation as applicable.
- Use the repository's lowercase Conventional-style prefixes for commits and pull-request titles.
- Squash-merge pull requests and delete their branches after merge.
- Deploy previews, staging, and production from commits on `main`; configuration does not live in environment branches.
- Tag releases from `main`, such as `v0.1.0`.
- Use a temporary release branch only when stabilization must proceed concurrently with new work.
- Handle urgent production corrections on a short-lived `fix/` branch created from `main`, then merge it through the same reviewed workflow.

Schema changes should be backward-compatible when a rollout spans multiple processes. Prefer expand-and-contract migrations and keep each migration in the same pull request as the behavior that requires it.

## Initial implementation sequence

1. `feat/repo-foundation`: scaffold React and FastAPI, local services, CI, and OpenAPI client generation.
2. `feat/identifier-domain`: implement GTIN, EAN, and UPC validation and normalization with tests.
3. `feat/package-match-api`: add the initial catalog, Claims, Evidence, Open Food Facts adapter, provenance, and Package Match endpoint.
4. `feat/package-match-ui`: add manual identifier entry, candidate presentation, uncertainty, and source attribution.
5. `feat/barcode-scanner`: add camera scanning as an input adapter to the working identifier journey.

This order establishes Product identity and claim-level provenance before AI extraction or moderation, matching the implementation plan in [`TECH_STACK.md`](TECH_STACK.md).

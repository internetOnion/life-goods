# Technology Stack and Current Implementation Plan

## Summary

The project uses or plans to use:

- React, Vite, and TypeScript for the shopper application.
- FastAPI and Python for the REST API.
- Celery and Python for planned durable background work.
- Python for AI benchmarking and image-processing experiments.
- MongoDB for the read-only Open Food Facts Dataset Version and its derived search index.
- PostgreSQL for reference datasets and the future reviewed catalog.
- Redis for shared Package Match/search rate limiting and the optional non-durable assessment cache.
- shadcn/ui components with Tailwind CSS utilities for frontend styling.

The frontend component and utility conventions are fixed by this document; broader visual direction remains governed by PRODUCT.md and DESIGN.md.

The current implemented slice covers camera/manual barcode lookup, OFF-backed Package Match candidates, versioned OFF dataset operations, a paginated OFF-backed search API, reference-dataset-backed stateless allergen evaluation, constrained reference-image delivery, and generated API artifacts. The shopper-facing search page, Package Capture processing, AI extraction, reviewed local catalog, and durable background work remain incomplete or planned.

## Application foundation

- Structure the repository as `frontend`, `backend`, `evaluation`, and `infra`.
- Pin Node.js 24 LTS and Python 3.13.
- Use pnpm for frontend dependencies and uv for Python dependencies.
- Use Docker Compose locally for PostgreSQL, MongoDB, and Redis. Add an S3-compatible object-storage emulator when Package Capture storage is implemented.
- Use a CI pipeline for linting, type checking, tests, OpenAPI drift detection, builds, and migration validation.
- Maintain preview, staging, and production configurations with separate databases, buckets when needed, Redis instances, secrets, and allowed origins.
- Ensure all CLI scripts, package scripts, build configurations, and path operations maintain cross-platform compatibility across Windows, macOS, and Linux without relying on POSIX-only shell assumptions.

## Frontend

- Scaffold a React application with Vite and strict TypeScript.
- Use React Router for navigation.
- Use TanStack Query for server state.
- Use react-i18next for Khmer-first localization with optional English.
- Use shadcn/ui source components styled with Tailwind CSS utilities. Keep the
  Phosphor icon set, and allow only semantic theme tokens and essential global
  browser/accessibility rules in the application stylesheet. Component styles
  belong in utility class names and reusable shadcn primitives.
- Use `@zxing/browser` for camera and image-based barcode scanning.
- Support standalone browsers and Telegram through a thin adapter for theme, viewport, safe-area, haptic, and validated launch-data behavior.
- Prioritize low- and mid-range Android Chrome and Telegram WebView while maintaining iOS Safari support.
- Generate and commit the API client using `@hey-api/openapi-ts`. CI must regenerate it and fail when committed output has drifted from the FastAPI OpenAPI document.

## Backend and data

- Build a modular FastAPI application using Pydantic contracts, SQLAlchemy 2, Alembic, psycopg, and httpx2.
- Use PostgreSQL; select its hosting provider, topology, and deployment region before the pilot deployment.
- Keep all catalog, reference dataset, and durable data access behind FastAPI; the browser must never connect directly to PostgreSQL.
- Keep repositories and application services separate from HTTP route handlers.
- The reviewed Product, Package Variant, External Identifier, Claim, and Evidence model remains a post-MVP target. The current API reads external Product evidence from an immutable, manually activated OFF Dataset Version and keeps it separate from reviewed reference data.
- Host immutable Reference Dataset Versions (concepts, lexical mappings, exclusions, and rules) in PostgreSQL with atomic activation and rollback.
- Serve a manually activated OFF Dataset Version from a separate read-only MongoDB database. Preserve full external documents and an immutable manifest with source URL, retrieval and activation times, integrity hash, counts, schema versions, attribution, and license metadata.
- Enforce domain invariants through PostgreSQL constraints and reviewed Alembic SQL migrations.

## Public API

The current public endpoints are:

```http
GET /api/v1/package-matches?identifier={value}
GET /api/v1/package-matches/search?q={value}&page={number}&page_size={number}
GET /api/v1/open-food-facts-images?url={encoded_url}
```

`package-matches` validates and normalizes GTIN, EAN, and UPC identifiers and returns zero or more external Package Match candidates. `package-matches/search` searches the active OFF Dataset Version by an identifier, product name, brand, or explicit manufacturing country. Search requires at least two normalized characters, accepts pages 1–100 and page sizes 1–50, and returns `has_more` for pagination. Search results are backed by a derived, version-pinned MongoDB index; `pnpm off:dataset -- reindex-search <version_id>` rebuilds it.

The shopper-facing search route currently renders a placeholder while the backend contract is available for integration.

Candidate responses will include:

- External source identity and attribution metadata.
- Field-level identity and label evidence with source, language, retrieval, revision, and dataset-version metadata.
- Package quantity and reference package image information when supported by OFF evidence.
- A stateless allergen Assessment Evaluation with explicit availability/reason fields, concept outcomes, and source-linked findings when the feature is enabled and a valid reference version is active.

Missing upstream fields must be omitted or marked unknown. Missing ingredient, allergen, trace, or nutrition data must never become a negative Claim such as “none detected.”

API failures will use a consistent error envelope with stable machine-readable codes and appropriate HTTP status codes. FastAPI's OpenAPI document is the source of truth for the generated React client.

Package Match rate limiting will use a shared Redis sliding window across API processes. A
short, cardinality-bounded local fallback preserves availability during Redis outages, with
degradation and recovery transition logs. Client identity comes from the ASGI connection;
deployments behind a reverse proxy must configure the ASGI server with an explicit trusted-
proxy allowlist rather than trusting forwarding headers in application code.

## Planned jobs, private media, and AI

- FastAPI is implemented; Celery workers, a Redis-compatible broker, and durable Package Capture job state are planned but are not part of the current runtime.
- Store durable Package Capture job state in PostgreSQL rather than relying on Redis result retention when that workflow is implemented.
- Deploy the SPA through a static frontend hosting service with CDN and preview-deployment support before pilot deployment.
- Store private Package Capture media in private S3-compatible object storage with configurable regional placement and lifecycle controls when Package Capture processing is implemented.
- Upload media through short-lived presigned URLs into a private, capture-only bucket or prefix when the capture workflow is implemented.
- Delete media through retryable Celery cleanup tasks no later than 24 hours after upload. Storage lifecycle rules are a backup, not the primary deletion mechanism.
- Alert on cleanup failures and media that remains after its expiry deadline.
- Define a provider-neutral extraction interface and benchmark hosted-API and self-hosted multimodal model options before selecting an AI deployment model or provider.
- Keep private Package Capture media and output isolated from catalog ingestion, model training, analytics, and moderator review.

## Testing

### Backend

Current pytest coverage includes:

- Identifier check digits and normalization.
- Open Food Facts mapping and missing-field semantics.
- OFF Dataset Version import, validation, activation, rollback, and field-level provenance.
- OFF search-index construction, identifier/name/brand/country search, pagination, and search failures.
- PostgreSQL constraints and transactions.
- API validation and error responses.

Job retries, idempotency, extraction results, and private-media expiry/deletion remain planned test areas for the Package Capture workflow.

### Frontend

Use Vitest and Testing Library for MVP frontend unit and component coverage of:

- Scanner and manual-entry states.
- Uncertainty language and source attribution.
- Network and camera-permission recovery.
- Telegram and standalone-browser adapters.
- Khmer and English presentation behavior.

Browser end-to-end automation is outside the MVP scope. Manual identifier, scanner, recovery, responsive-layout, Telegram WebView, and representative physical-device checks remain part of pilot validation and are not automated release gates.

### Privacy and acceptance

- Verify analytics, error tracing, and performance monitoring never receive photos, raw label text, dietary preferences, precise location, or persistent shopper identity.
- Test representative low- and mid-range Android devices, Telegram WebView, and supported iOS Safari devices.
- Verify known barcodes produce usable candidates within the documented three-second pilot target under pilot conditions.
- Verify empty, stale, incomplete, or conflicting evidence remains visibly uncertain.

## Deployment and monitoring

- The selected static frontend hosting and CI capabilities must provide preview deployments for pull requests.
- Staging must use isolated databases, caches, object storage, secrets, and application configuration.
- Production deployment requires successful MVP unit/component and API/database tests, generated-client drift checks, migration validation, and a staging smoke test.
- Run Alembic migrations as a separate release step before deploying application processes that require the new schema.
- Use scrubbed error and performance tracing for the React application, FastAPI, and Celery.
- Emit structured Package Match and search logs for latency, candidate count, OFF outcome and Dataset
  Version, assessment availability, rate-limit state, and sanitized dependency failure
  categories. Logs must exclude identifiers, client addresses and digests, label text,
  preferences, credentials, and private Package Capture data.
- Store only allowlisted anonymous journey and failure events internally with short retention.
- Alert on API error rate now; add queue backlog, extraction failures, cleanup failures, and expired private media when those workflows are deployed.

## Explicit decisions and deferrals

- TypeScript is the browser language; Python is the production backend, worker, assessment, and evaluation language.
- The AI deployment model remains undecided; hosted APIs and self-hosted options remain candidates until benchmark and operational results exist.
- The AI model and provider remain undecided until benchmark results exist.
- Finalize latency, privacy, retention, regional placement, and data-residency requirements before selecting deployment and storage providers.
- Shopper access remains anonymous.
- Moderator authentication and moderation UI begin after the identity slice.
- The frontend uses shadcn/ui source components, Tailwind CSS v4, and Phosphor
  icons. Visual direction remains governed by PRODUCT.md and DESIGN.md.
- Next.js, Firebase, GraphQL, Kubernetes, native mobile applications, and direct browser access to PostgreSQL are excluded from the initial architecture.

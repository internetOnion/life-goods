# Technology Stack and Initial Implementation Plan

## Summary

The project will use:

- React, Vite, and TypeScript for the shopper application.
- FastAPI and Python for the REST API.
- Celery and Python for durable background work.
- Python for AI benchmarking and image-processing experiments.
- shadcn/ui components with Tailwind CSS utilities for frontend styling.

The frontend component and utility conventions are fixed by this document; broader visual direction remains governed by PRODUCT.md and DESIGN.md.

The first implementation milestone is a known-barcode-to-evidence-backed-package-candidates vertical slice. AI extraction and moderation will follow after the identity and provenance foundation is working.

## Application foundation

- Structure the repository as `frontend`, `backend`, `evaluation`, and `infra`.
- Pin Node.js 24 LTS and Python 3.13.
- Use pnpm for frontend dependencies and uv for Python dependencies.
- Use Docker Compose locally for PostgreSQL, Redis, and an S3-compatible MinIO service.
- Use GitHub Actions for linting, type checking, tests, OpenAPI drift detection, builds, and migration validation.
- Maintain preview, staging, and production configurations with separate databases, buckets, Redis instances, secrets, and allowed origins.

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

- Build a modular FastAPI application using Pydantic contracts, SQLAlchemy 2, Alembic, and psycopg.
- Use Neon-managed PostgreSQL in Singapore.
- Keep all catalog and durable data access behind FastAPI; the browser must never connect directly to PostgreSQL.
- Keep repositories and application services separate from HTTP route handlers.
- Begin with Product, Package Variant, External Identifier, External Snapshot, Claim, Evidence, and field-level provenance.
- Preserve raw Open Food Facts snapshots in JSONB with their source URL, retrieval time, source revision, response hash, attribution, and license metadata.
- Enforce domain invariants through PostgreSQL constraints and reviewed Alembic SQL migrations.

## Public API

The first public endpoint will be:

```http
GET /api/v1/package-matches?identifier={value}
```

It will validate and normalize GTIN, EAN, and UPC identifiers and return zero or more Package Variant candidates.

Candidate responses will include:

- Immutable internal identifiers.
- Names with language, role, and source.
- Package quantity when supported by evidence.
- Reference package image information.
- Field-level source and attribution metadata.
- Evidence observation or retrieval times.
- Claim review state and relevant uncertainty.

Missing upstream fields must be omitted or marked unknown. Missing ingredient, allergen, trace, or nutrition data must never become a negative Claim such as “none detected.”

API failures will use a consistent error envelope with stable machine-readable codes and appropriate HTTP status codes. FastAPI's OpenAPI document is the source of truth for the generated React client.

## Jobs, private media, and AI

- Run FastAPI and Celery as separate Fly.io containers in Singapore.
- Use managed Upstash Redis in Singapore as the Celery broker.
- Store durable Package Capture job state in PostgreSQL rather than relying on Redis result retention.
- Host the SPA on Cloudflare Pages.
- Store private Package Capture media in Cloudflare R2 using its Asia-Pacific placement hint.
- Upload media through short-lived presigned URLs into a private, capture-only bucket or prefix.
- Delete media through retryable Celery cleanup tasks no later than 24 hours after upload. Storage lifecycle rules are a backup, not the primary deletion mechanism.
- Alert on cleanup failures and media that remains after its expiry deadline.
- Define a provider-neutral extraction interface and benchmark two or three hosted multimodal models before selecting a production provider.
- Keep private Package Capture media and output isolated from catalog ingestion, model training, analytics, and moderator review.

## Testing

### Backend

Use pytest for unit and integration coverage of:

- Identifier check digits and normalization.
- Open Food Facts mapping and missing-field semantics.
- External snapshots and field-level provenance.
- PostgreSQL constraints and transactions.
- API validation and error responses.
- Job retries, idempotency, timeouts, and partial extraction results.
- Private-media expiry and deletion behavior.

### Frontend

Use Vitest and Testing Library for:

- Scanner and manual-entry states.
- Uncertainty language and source attribution.
- Network and camera-permission recovery.
- Telegram and standalone-browser adapters.
- Khmer and English presentation behavior.

Use Playwright for end-to-end coverage of:

- Manual identifier entry.
- Known, unknown, invalid, and conflicting results.
- Generated-client compatibility.
- Responsive layouts and supported recovery actions.

Camera behavior must also be tested on representative physical devices because browser automation cannot reproduce every camera and WebView condition.

### Privacy and acceptance

- Verify analytics and Sentry never receive photos, raw label text, dietary preferences, precise location, or persistent shopper identity.
- Test representative low- and mid-range Android devices, Telegram WebView, and supported iOS Safari devices.
- Verify known barcodes produce usable candidates within the documented three-second pilot target under pilot conditions.
- Verify empty, stale, incomplete, or conflicting evidence remains visibly uncertain.

## Deployment and monitoring

- Cloudflare Pages will provide frontend preview deployments for pull requests.
- Staging will use isolated Neon, Upstash, and R2 resources.
- Production deployment requires successful automated tests, generated-client drift checks, migration validation, and a staging smoke test.
- Run Alembic migrations as a separate release step before deploying application processes that require the new schema.
- Use scrubbed Sentry tracing for the React application, FastAPI, and Celery.
- Store only allowlisted anonymous journey and failure events internally with short retention.
- Alert on API error rate, queue backlog, extraction failures, cleanup failures, and expired private media.

## Explicit decisions and deferrals

- TypeScript is the browser language; Python is the production backend, worker, assessment, and evaluation language.
- The MVP uses hosted AI models and has no local-model or GPU infrastructure.
- The model provider remains undecided until benchmark results exist.
- Cloudflare R2's Asia-Pacific placement hint is accepted; strict Singapore data residency is not currently required.
- Shopper access remains anonymous.
- Moderator authentication and moderation UI begin after the identity slice.
- The frontend uses shadcn/ui source components, Tailwind CSS v4, and Phosphor
  icons. Visual direction remains governed by PRODUCT.md and DESIGN.md.
- Next.js, Firebase, GraphQL, Kubernetes, native mobile applications, and direct browser access to PostgreSQL are excluded from the initial architecture.

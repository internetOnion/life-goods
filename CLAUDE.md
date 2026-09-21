# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read before changing anything

- `PRODUCT.md` (product intent/boundary), `CONTEXT.md` (canonical glossary — behavior/API/storage do **not** belong here), `docs/SPEC.md` (current backend-first behavioral contract), and applicable accepted ADRs under `docs/adr/` for product, domain, API, source-data, translation, privacy, or persistence work.
- For Shopper-facing UI work, read `PRODUCT.md` and the relevant spec section. Only create/update `DESIGN.md` once a new visual direction has actually been designed and accepted.
- Use exact glossary terms and capitalization everywhere (code comments, PRs, UI copy): `Shopper`, `Product`, `Barcode`, `Product Lookup`, `Source Record`, `Dataset Snapshot`, `Source Attribution`, `Source Assessment`, `Source Data Unavailable`, `Original Text`, `Khmer Translation`.

## Product boundary (do not casually reintroduce these)

Life Goods is a **read-only presentation layer** over a static, locally hosted Open Food Facts Dataset Snapshot — not a food catalog or verification system.

- Open Food Facts data stays visibly attributed external source data; local hosting/integrity checks/caching never verify it or make it a Life Goods catalog.
- Source Data Unavailable means *unknown*, never a negative assertion (e.g. never "does not contain X").
- Source Assessments (Nutri-Score, NOVA, Green-Score, etc.) are attributed Open Food Facts calculations, presented as such — never recalculated or adopted as Life Goods judgments.
- No Product contributions, verification, package capture, camera uploads, accounts, server-side scan history, or personalization.
- No safety, health, allergen-free, Halal, legal/compliance, authenticity, or purchase verdicts anywhere, including in `/learn` content.
- Decode Barcode camera frames on-device; send only the normalized Barcode to the backend. Never upload/retain camera frames.
- Compare Products (photo-based nutrition comparison) is the **one** bounded exception that sends user photos off-device — to the configured AI provider only, with no photos/extracted text/comparison history retained. It never declares an overall winner or verdict.
- Keep Barcode-level and Shopper-level data out of analytics and logs.

## Architecture

Two independently-run projects, not a monorepo build:

- `frontend/` — the only pnpm workspace package. React 19 + TypeScript (strict; unused locals/params fail typecheck) + Vite + Tailwind v4 + TanStack Query + react-router. Entry: `frontend/src/main.tsx` → `frontend/src/app/App.tsx` (routes). Feature behavior lives under `frontend/src/features/*` (e.g. `product`, `scan`, `search`, `photo-comparison`, `concerns`, `learn`, `data-and-licenses`). `frontend/src/i18n` holds English/Khmer localization; shared UI in `frontend/src/components` and `frontend/src/ui`.
- `backend/` — separate Python 3.13 `uv` project (not part of the pnpm workspace). FastAPI app factory at `backend/src/lifegoods/main.py`. Key modules under `backend/src/lifegoods/`: `product_lookup/` (stable lookup, projection, caching, rate limiting), `open_food_facts/` (dataset import/read foundation and CLI), `identifiers/` (Barcode validation/normalization), `translation/` (Khmer Translation module, Gemini adapter, benchmark harness), `generated_data/` (isolated MongoDB storage for translation artifacts/leases/cooldowns/quarantines + its own CLI), `product_search/`, `photo_comparison/`, `ingredient_matching/`.
- **FastAPI owns the frontend contract.** `frontend/openapi.json` and `frontend/src/api/generated/` are generated — never hand-edit. After changing a route or response shape, run `pnpm api:generate`; `pnpm api:check` detects committed drift (regenerates and diffs).
- Storage: MongoDB for the read-only Open Food Facts Dataset Snapshot (`lifegoods_off`, read-only credentials) **and** a separately-credentialed, isolated MongoDB database for generated translation data (`lifegoods_generated` — artifacts, leases, cooldowns, quarantines). Redis is disposable cache + rate-limit state only, never a source of truth. There is no PostgreSQL/Alembic runtime — do not reintroduce relational persistence without a new spec decision and an accepted ADR.
- Generated-data collections/indexes are never created implicitly at web startup — they're initialized/verified explicitly via `pnpm generated-data:init` / `pnpm generated-data:verify` (see `docs/generated-data-persistence.md`).
- The Khmer Translation pipeline is on-demand, not a batch job: translation runs per-request, is content-addressed (`content_hash + translation_config_fingerprint`), coordinated across instances via expiring MongoDB leases (single-flight), budgeted via fail-closed Redis sliding-window quota, and always falls back to Original Text on any failure/timeout/budget exhaustion rather than failing Product Lookup. The whole stage runs under one shared deadline (`LIFEGOODS_TRANSLATION_DEADLINE_SECONDS`, default 12s). Model/provider is currently pinned to Gemini `gemini-3.8-flash` under translation config `v3` — changing provider/model requires an explicit product decision + ADR.
- The standalone `photo_comparison` dev app (`pnpm photo-comparison:dev`) is a thin consumer of the same services/contracts as the ordinary backend's `/api/v1/photo-comparison/`; it is not a separate implementation.

## Commands

Requires Node.js 24 + pnpm, Python 3.13 + uv, Docker Compose.

```bash
pnpm install && pnpm backend:install          # install both projects
docker compose -f infra/compose.yaml up -d    # start local MongoDB (27018) and Redis (6380)
pnpm backend:dev                              # FastAPI with reload
pnpm dev                                      # Vite dev server at :5173
pnpm dev:https                                # for camera testing at https://localhost:5173 (proxies /api to HTTP backend)
```

Verification (run before considering work done):

```bash
pnpm typecheck   # frontend tsc -b + backend pyright
pnpm lint        # frontend prettier+eslint + backend ruff
pnpm test        # frontend vitest run + backend pytest
pnpm build
pnpm api:check   # regenerates OpenAPI/client and fails on drift
```

Single-test invocation:

```bash
pnpm --dir frontend test -- path/to/file.test.tsx   # vitest run, single file
uv run --project backend pytest backend/tests/path/to/test_file.py::test_name
uv run --project backend pytest backend/tests --run-integration   # or LIFEGOODS_TEST_INTEGRATION=1; needs real services
```

Other useful commands:

```bash
pnpm redis:reset                                          # FLUSHDB on local Redis (cache + rate-limit state only)
pnpm off:dataset -- list                                   # list imported Open Food Facts snapshots
pnpm off:dataset -- activate <version_id>                  # activate one for local dev
pnpm generated-data:init / :verify / :status / :quarantine # isolated translation storage lifecycle
pnpm benchmark:run     # deterministic offline translation benchmark
pnpm benchmark:live    # live-provider benchmark, explicit operator action, real credentials
```

## Conventions

- All scripts/commands/tools must work cross-platform (Windows/macOS/Linux) — no POSIX-only inline env assignment or hardcoded path separators.
- Frontend formatting: root Prettier config + Tailwind plugin via `pnpm frontend:lint:format` (or `pnpm --dir frontend lint:format`).
- Icons/illustrations aren't restricted to one vendor (Phosphor is common) — any library or custom SVG is fine as long as it's semantically accurate and visually cohesive with the brand (warm amber + cool slate palette, "Life Goods" spaced wordmark, Khmer-ready rather than Khmer-as-fallback).
- Create documentation lazily and in the right place: `PRODUCT.md` = product intent, `CONTEXT.md` = glossary only, `docs/SPEC.md` = current behavioral contract, `docs/adr/` = only decisions that are hard to reverse or surprising, `docs/research/` = research artifacts, `docs/diagrams/` = Mermaid source + rendered output — only when the work actually needs them.
- Commit messages use lowercase Conventional prefixes (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) only when a commit is explicitly requested.
- GitHub Issues (`internetOnion/life-goods`) use lowercase colon-namespaced labels: `area:frontend|backend|documentation`, `status:needs-triage|needs-info|ready-for-agent|ready-for-human|in-progress|blocked|wontfix|duplicate|invalid|post-mvp`, `type:bug|enhancement|question|epic`, `community:good-first-issue|help-wanted`. The old "Wave" taxonomy is obsolete.

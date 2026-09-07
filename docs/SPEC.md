# Life Goods specification

## Status

This specification defines the new backend-first product direction. The current repository still contains catalog, package-match, reference-dataset, allergen, Halal, assessment, and package-capture code from the previous direction. Those modules are transitional and do not define the target product.

The documentation reset does not remove implementation code or databases. Backend simplification will be a separate, atomic change.

## 1. Product boundary

Life Goods is a read-only Khmer-first presentation layer over Open Food Facts data. It initially serves people shopping in Cambodia through a mobile-first progressive web application.

The MVP:

- decodes Barcodes on the shopper's device;
- finds Source Records in one static local Dataset Snapshot;
- presents consumer-facing Open Food Facts information with visible Source Attribution;
- develops the information architecture in English before adding Khmer localization;
- later generates Khmer Translation on demand while preserving Original Text; and
- remains anonymous and read-only.

The MVP does not own a Product catalog, accept contributions, upload package photos, or verify source data. It does not produce health, safety, allergen-free, Halal, authenticity, legal, compliance, or purchase verdicts.

## 2. Current milestone

The first backend milestone is one cached, read-only Product Lookup endpoint over the configured Dataset Snapshot. It establishes Barcode validation, source provenance, missing-state behavior, and a raw exploratory payload before the product-page contract is refined.

Search is an optional parallel follow-on. It is not required for the first endpoint, but it is not blocked by a formal phase gate once it can reuse stable lookup foundations.

## 3. Experimental Product Lookup API

### Request

`GET /api/experimental/products/{barcode}`

The route belongs to Life Goods rather than the source provider. The response identifies Open Food Facts through explicit metadata.

Before lookup, the backend:

1. accepts only explicitly supported retail Barcode formats;
2. normalizes the value;
3. validates length, format, and check digit; and
4. rejects invalid input without accessing the cache or Dataset Snapshot.

### Successful response

A successful response returns `200 OK` with an envelope shaped like:

```json
{
    "data": {
        "source_record": {}
    },
    "meta": {
        "lookup": {
            "barcode": "3017620422003"
        },
        "source": {
            "name": "Open Food Facts",
            "product_url": "https://world.openfoodfacts.org/product/3017620422003"
        },
        "dataset": {
            "version": "configured-version-id",
            "retrieved_at": "source-retrieval-timestamp"
        }
    }
}
```

`source_record` contains the raw imported Open Food Facts document. The backend removes MongoDB `_id`, local import bookkeeping, and other storage-only metadata. It does not normalize or selectively project Open Food Facts fields in this experimental contract.

This endpoint is intentionally unstable. After the English Product page reveals its actual needs, a stable Life Goods projection will graduate under `/api/v1/products/{barcode}`.

### Errors

Errors use a consistent envelope:

```json
{
    "error": {
        "code": "product_not_found",
        "message": "Product not found"
    }
}
```

Required behavior:

| Condition                                           | HTTP status | Error code            |
| --------------------------------------------------- | ----------: | --------------------- |
| Unsupported, malformed, or checksum-invalid Barcode |       `422` | `invalid_barcode`     |
| Valid Barcode absent from the Dataset Snapshot      |       `404` | `product_not_found`   |
| Dataset Snapshot missing, inactive, or unreachable  |       `503` | `dataset_unavailable` |
| Anonymous rate limit exceeded                       |       `429` | `rate_limit_exceeded` |
| Unexpected internal failure                         |       `500` | `internal_error`      |

The service never falls back silently to the live Open Food Facts API.

## 4. Dataset Snapshot

The MVP uses one static, explicitly selected Open Food Facts Dataset Snapshot already hosted in MongoDB. Dataset updating, automatic synchronization, and periodic activation are deferred. The design keeps a version identifier so a different snapshot can be selected later without changing source semantics.

The Dataset Snapshot remains external source data. Local hosting, integrity checks, indexing, and selection do not make it a Life Goods catalog or verify any Source Record.

## 5. Cache and rate limiting

Redis remains disposable infrastructure for Product Lookup caching and anonymous rate limiting.

- Cache found and not-found results.
- Include Dataset Snapshot version and normalized Barcode in lookup cache keys.
- Keep invalid Barcodes out of the cache.
- Namespace cache and rate-limit keys by purpose.
- Treat cache contents as reproducible and disposable.
- Use an in-memory substitute where appropriate for isolated tests or single-process development.

The Product Lookup endpoint is public and requires no authentication. Apply a practical per-IP rate limit that allows ordinary shopping sessions while discouraging automated extraction.

## 6. Product-page exploration

The English prototype uses the exploratory Source Record to reproduce Open Food Facts' consumer-facing data coverage in a new mobile information architecture. It does not copy the Open Food Facts visual design.

The prototype should account for:

- identity, images, Barcode, brand, categories, labels, packaging, and countries;
- nutrition facts and ingredients;
- Source Assessments such as Nutri-Score, NOVA, Green-Score, and nutrient levels;
- additives and ingredient analysis;
- environmental, transport, and packaging information;
- other available consumer-facing product information;
- source and contribution metadata that helps a Shopper understand provenance; and
- explicit Source Data Unavailable states.

Do not expose local database metadata, import bookkeeping, moderation controls, contribution controls, account controls, or Open Food Facts editing workflows in the shopper interface.

The English prototype is ready for Khmer localization only when representative complete, sparse, multilingual, irregular, and data-rich Source Records render intentionally on mobile without broken layouts or accidental raw-field dumps.

### Learn section

The `/learn` section is a standalone, static educational surface. It may explain label concepts, ingredients, allergens, Halal-related evidence, dates, package marks, source attribution, and the limits of available evidence. Its bilingual editorial content and five guide categories are not Product data, Product Lookup output, or Life Goods verification.

Learn entries remain frontend-only and retain their source references, review metadata, and explicit “does not prove” boundaries. They must not calculate or display Product safety, health, allergen-free, Halal, legal, compliance, authenticity, or purchase verdicts, and they are separate from Khmer Translation generated for Product fields.

## 7. Attribution and licensing

Every Product page displays a visible “Data from Open Food Facts” link. Link to the corresponding Open Food Facts Product page when possible.

The product also provides a global notice covering the Open Food Facts [conditions for reuse](https://world.openfoodfacts.org/data):

- database under the Open Database License;
- individual database contents under the Database Contents License; and
- product images under Creative Commons Attribution-ShareAlike, subject to other rights that may apply.

Source Assessments remain visibly attributed Open Food Facts calculations. Life Goods may translate their explanations but does not verify, recalculate, or present them as Life Goods judgments.

## 8. Khmer localization

Khmer localization begins after the English information architecture is refined.

- Khmer becomes the primary display language.
- Original Text remains available per translated field through a clear control.
- Khmer Translation is generated on demand rather than for the whole Dataset Snapshot.
- Translation output is cached against Dataset Snapshot version, source content, and translation configuration.
- Machine-generated text is visibly identified.
- Translation failure falls back to Original Text and does not fail Product Lookup.
- Fluent human review is required for interface vocabulary, navigation, explanations, disclaimers, and accessibility copy.
- Individual Product translations are not presented as human-reviewed or verified.

Translation provider and model selection are deferred until this phase.

## 9. Privacy and measurement

- Decode camera frames on the device and send only the normalized Barcode for lookup.
- Do not upload or retain camera frames or package photos.
- Do not create accounts, server-side scan history, saved Products, or personalization in the MVP.
- Do not retain Barcode-level analytics, persistent IP identifiers, or per-Shopper histories.
- Permit aggregate counts for lookup volume, found/not-found rate, latency, cache performance, and error rate.
- Minimize or redact Barcodes in application logs unless a short-lived operational diagnostic explicitly requires them.

## 10. Backend transition

The new read-only MVP has no durable relational data requirement. The backend refactor will therefore:

1. preserve the MongoDB Dataset Snapshot and Open Food Facts import/read foundation;
2. preserve Redis as disposable cache and rate-limit infrastructure;
3. remove the PostgreSQL and Alembic runtime dependency;
4. remove obsolete catalog, package-match, reference-dataset, allergen, Halal, assessment, and package-capture implementation only after their dependencies are mapped;
5. replace obsolete models, migrations, tests, configuration, and infrastructure together; and
6. update README and development commands atomically with that implementation change.

No shared, staging, or production PostgreSQL history must be preserved. Do not delete the existing migration chain in isolation: the clean-slate removal belongs to the atomic backend refactor.

## 11. First milestone acceptance criteria

The first backend milestone is complete when:

- supported Barcodes are normalized and validated before lookup;
- a known Barcode returns the raw Source Record in the documented envelope;
- storage-only fields do not leave the backend;
- source name, source Product URL, Dataset Snapshot version, and retrieval time are present;
- invalid, unknown, unavailable-source, rate-limit, and internal-error paths use the documented statuses and codes;
- found and not-found cache behavior is covered by tests;
- the service never calls the live Open Food Facts API as a fallback;
- the endpoint is represented in FastAPI's OpenAPI contract and generated frontend client; and
- aggregate metrics contain no retained Barcode or Shopper history.

## 12. Deliberate compatibility surface (Issue #83)

To allow safe incremental migration of the frontend without breaking existing prototype behavior:

1. **Deprecated Experimental Route**: `GET /api/experimental/products/{barcode}` is retained with `deprecated=True` in OpenAPI. It returns `ProductLookupResponse` containing the unprojected Open Food Facts `source_record`.
2. **Dual-Contract Frontend Adapter**: `adaptProductLookup` in `frontend/src/features/product/adapter.ts` accepts either `ProductProjectionResponse` (from the stable `/api/v1/products/{barcode}` endpoint) or `ProductLookupResponse` (from the deprecated experimental route).
3. **Subsequent Removal Issue**: Once frontend presentation components consume `ProductProjection` directly and no consumers rely on `adaptProductLookup`'s legacy candidate structure, the experimental endpoint and dual-mode adapter will be removed in a dedicated follow-up issue.

## 13. Isolated generated-data persistence (Issue #84)

Durable Khmer Translation artifacts are stored in an isolated MongoDB database (`lifegoods_generated`) separate from the strictly read-only Open Food Facts Dataset Snapshot (`lifegoods_off`):

1. **Storage Isolation**: The application runtime connects to generated storage using dedicated credentials (`lifegoods_generated`) with least-privilege access restricted exclusively to `lifegoods_generated`. The Dataset Snapshot connection (`lifegoods_reader`) remains strictly read-only.
2. **Collection and Index Requirements**:
   - `translation_artifacts`: content-addressed immutable bundles (`content_hash + translation_config_fingerprint`), unique `artifact_id`, no automatic TTL.
   - `translation_leases`: expiring cross-instance single-flight leases with TTL index on `expires_at` (`expireAfterSeconds=0`).
   - `translation_cooldowns`: expiring temporary complete failure records with TTL index on `expires_at` (`expireAfterSeconds=0`).
   - `translation_quarantines`: durable withdrawal records for invalid artifacts, no TTL.
3. **Explicit Operator Initialization**: Web application startup never creates collections or indexes implicitly. Schema is initialized and verified idempotently via `pnpm generated-data:init` and `pnpm generated-data:verify`. Incompatible indexes fail explicitly.
4. **Operational Specification**: Detailed procedures for credential rotation, backup and restore, and failure diagnosis are documented in [docs/generated-data-persistence.md](generated-data-persistence.md).

## 14. Packaged-food Khmer Translation benchmark and evaluation harness (Issue #85)

To establish empirical evidence for production model selection and quantitative quality, latency, reliability, and cost gates:

1. **Versioned Benchmark Inputs**: Versioned packaged-food test cases (`v1`) cover representative multilingual Source Record texts (English, French, Thai, Vietnamese, unknown language `und`, and mixed script), core eligible fields (`product_name`, `generic_name`, `ingredients_text`, `categories`), critical edge cases (brand preservation, E-numbers, INS codes, numerical values, percentages, quantities, units, long ingredients, adversarial prompt injection), and bypass conditions (source-provided Khmer `source_khmer_available`, and missing fields `source_data_unavailable`). All benchmark items are strictly sanitized with synthetic identifiers; no Barcodes, IP addresses, or Shopper data are present or emitted.
2. **Deterministic Token & Placeholder Protection**: Brand names, numerical tokens, percentages, units, E-numbers, and INS codes are masked with opaque placeholders (`__LG_TOK_n__`), restored post-translation, and validated for zero-loss, corruption, or lingering placeholders.
3. **Candidate Model Runner & Stable Configuration**: Candidates use pinned stable models (e.g., `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-2.5-flash`), lowest supported temperature (0.0), bounded output tokens, and structured JSON output. Moving aliases (e.g. `gemini-latest`) and deprecated models (`gemini-2.0-flash`) are explicitly rejected.
4. **Zero-Network CI Verification**: Normal CI exercises the harness through deterministic offline fixtures via `pnpm benchmark:run`. Live execution against candidate APIs is an explicit operator action requiring credentials via `pnpm benchmark:live` (or `--mode live --api-key`).
5. **Machine Scoring & Exported Review Packets**: Outputs are automatically evaluated for schema compliance, token preservation, placeholder integrity, Khmer script validity, 4-second budget adherence, and estimated costs. Results export to machine-readable `summary.json` and a sanitized Markdown `review_packet.md` structured for the fluent Khmer human reviewer checklist in Issue #86, carrying the prominent boundary disclaimer that benchmark candidate approval does not claim or imply individual Product translations are human-reviewed.

## 15. Khmer Translation Module and Gemini Adapter (Issue #87)

The translation domain is encapsulated behind the deep `KhmerTranslationModule` and provider adapters:

1. **Eligible Fields & Selection**:
   - Translations are generated strictly for `product_name`, `generic_name`, `ingredients_text`, and human-readable `categories`.
   - Localized Original Text values are preserved with source field and language.
   - Deterministic preference order: Source-provided Khmer (`kh`, `km`, and recognized variants, retaining source metadata), declared record language, English (`en`), and deterministic localized fallback.
   - Conservative Khmer Unicode script recognition preserves `und` when language metadata is absent without claiming authoritative language tags.
   - Source-provided Khmer yields `source_khmer_available` and missing fields yield `source_data_unavailable` without invoking the provider.

2. **Deterministic Token & Placeholder Protection**:
   - Brand names, numerical tokens, decimal separators, percentages, quantities, units, E-numbers, and INS codes are masked with opaque `__LG_TOK_n__` placeholders before provider requests and verified upon restoration.

3. **Safe Ingredient Chunking**:
   - Oversized ingredient lists are deterministically chunked at safe top-level punctuation delimiters (`[,;]`) without splitting nested parentheses `(...)` or brackets `[...]`. Chunks are translated and safely rejoined with no silent truncation.

4. **Independent Field Validation & Partial Outcomes**:
   - Returned fields are validated independently for schema correctness, expected identifiers, placeholder integrity, output bounds, and valid Khmer script.
   - If one field fails validation, valid fields survive as `generated` while the failed field transitions to `translation_unavailable`, yielding a `partial` overall status.

5. **Gemini HTTP Adapter**:
   - The provider transport timeout cap defaults to 12 seconds; retries at most once for transient network errors, HTTP 408, 429, and all 5xx responses using backoff. Both attempts and backoff share the remaining translation-stage budget (section 19).
   - Strictly enforces that Barcodes, IP addresses, Dataset Snapshot identifiers, and Shopper data are never included in provider payloads.
   - Standardizes on approved stable model `gemini-3.8-flash`; explicitly rejects moving aliases (e.g. `gemini-latest`) and deprecated models (`gemini-2.0-flash`).

## 16. Translation artifact persistence and cross-instance coordination (Issue #88)

Durable translation storage and multi-instance concurrency are coordinated through content-addressed artifacts, single-flight leases, and fail-closed budgeting:

1. **Content Addressing & Storage Identity**:
   - Durable artifacts are keyed strictly by `content_hash + translation_config_fingerprint`.
   - Stored documents and Redis entries retain no Barcodes, Snapshot versions, or Shopper identifiers. Identical canonical Product text across snapshots reuses existing artifacts automatically.
   - Complete artifacts are durable. Valid partial results use a short-lived hot cache (the configured cooldown duration), after which generation may retry.

2. **Cross-Instance Single Flight & Recovery**:
   - Instances coordinate on-demand generation using expiring MongoDB leases (`translation_leases`) containing unique owner tokens.
   - A single worker wins the lease and generates the artifact. Competing concurrent requests poll for the completed artifact within the shared translation-stage deadline (initially 12 seconds) and fall back gracefully to Original Text upon timeout.
   - If an instance crashes mid-generation, expired leases (`expires_at <= now`) are safely taken over by subsequent requests or automatically pruned by MongoDB TTL background threads.

3. **Failure Cooldown & Graceful Degradation**:
   - Complete provider or validation failures (`overall_status=unavailable`) write temporary expiring cooldown records to `translation_cooldowns` (default 60s), suppressing duplicate failing provider calls.
   - If the generated-data store becomes unavailable, new provider calls are held. If a write fails after successful generation, the result is returned to the current request and subsequent generation is held until store recovery.

4. **Project-Wide Generation Budgeting**:
   - Shared Redis sliding-window budgeting enforces an authoritative generation quota across all backend instances.
   - Unlike Product Lookup rate limiting which fails open to local limiting for Shopper availability, the translation generation budget fails closed on Redis outage to prevent unbounded external model costs.

5. **Administrative Quarantine**:
   - Corrupted or compromised artifacts are withdrawn administratively by recording an entry in `translation_quarantines` via the operator CLI (`pnpm generated-data:quarantine`).
   - Quarantined artifacts are immediately excluded from serving without mutating original immutable bundles.

6. **Operator CLI Observability**:
   - The operator CLI (`pnpm generated-data:status`) inspects aggregate counts (artifacts, active leases, cooldowns, quarantines) and database health without printing Product text or Shopper data.

## 17. Stable Product Lookup with integrated Khmer Translation (Issue #89)

The stable Product Lookup endpoint integrates optional on-demand Khmer Translation co-located with semantic fields:

1. **Request & Contract**:
   - `GET /api/v1/products/{barcode}?language=kh`
   - Requests without `language=kh` return the stable Product projection and Original Text without generating translation (`meta.translation.status="not_requested"`).
   - The application request and locale value is `kh`. External Source Record language tags, including `km`, retain their original metadata. Any other unsupported language parameter value returns HTTP 422 with stable error code `unsupported_language`.
   - The experimental endpoint `/api/experimental/products/{barcode}` remains functional but is formally deprecated in OpenAPI documentation.

2. **Field-Level Co-Location**:
   - Semantic fields eligible for translation (`identity.name`, `identity.generic_name`, `ingredients_text`, `categories_text`) carry individual translation states: `not_requested`, `source_khmer_available`, `original_text_preserved`, `generated`, `source_data_unavailable`, or `translation_unavailable`.
   - When translation is generated, `khmer_translation` holds the translated string alongside `original_texts` and `selected_original_text`.
   - Source-provided Khmer is treated as `OriginalText` (`source_khmer_available`) and never receives machine-generated metadata. Empty fields yield `source_data_unavailable` without invoking generation.

3. **Top-Level Translation Provenance**:
   - The top-level response envelope includes `meta.translation` with statuses: `not_requested`, `not_needed`, `complete`, `partial`, and `unavailable`.
   - Machine-generated metadata (`provider`, `model`, `configuration_version`, `generated_at`) is populated only when translation is generated.
   - Source Attribution (`meta.source` and `meta.dataset`) remains unchanged between translated and untranslated requests.

4. **Graceful Degradation & Availability**:
   - Translation failures, validation errors, database degradation, cooldown periods, lease timeouts, and generation-budget exhaustion return HTTP 200 with complete Original Text whenever the Product exists in the Dataset Snapshot.
   - Core Product Lookup errors remain distinct: invalid Barcode (422), missing Product (404), unavailable Dataset Snapshot (503), Shopper-facing rate limit (429), and internal server error (500).

5. **Operational Privacy & Independent Limiting**:
   - Per-IP Shopper Product Lookup rate limiting (fail-open) and project-wide translation generation budgeting (fail-closed) operate completely independently.
   - Access logs and metrics strictly exclude Barcode, IP address, Original Text, Khmer Translation, translation prompts, and raw provider payloads.



## 18. Trustworthy existing Khmer Translation fields (Issue #94)

The frontend Product Lookup request sends `language=kh`. Application locale state uses `kh`; standards-based document language tags and external identifiers remain unchanged. `language=km` is unsupported. Omitting the language returns `not_requested` without generation.

The four existing field envelopes share selection and classification across generation, cache reuse, provider failure, coordination failure, and emergency fallback. Selection prefers source-provided Khmer (including recognized language variants or conservative script detection), then the Source Record language, English, and deterministic fallback. Script detection does not manufacture language metadata. Human-readable category Original Text retains its source wording and language; taxonomy identifiers are not translation prose.

| Field status | Text available for display |
| --- | --- |
| `generated` | `khmer_translation` |
| `source_khmer_available` | Khmer `selected_original_text` |
| `original_text_preserved` | Intentionally unchanged `selected_original_text`, such as a brand-only Product name |
| `translation_unavailable` | Available `selected_original_text` |
| `not_requested` | Available `selected_original_text` |
| `source_data_unavailable` | No source text; the frontend supplies missing-state copy |

With a translation request, the overall status is `not_needed` when no field requires generation, `complete` when all required fields succeed, `partial` when some succeed, and `unavailable` when none succeed. Source-provided Khmer, preserved names, and missing fields do not count as failed generation. Provenance is present only with generated output and records the actual provider, exact model, configuration version, and generation time. Source Attribution and Dataset Snapshot metadata remain separate.

Without Gemini credentials, startup disables generation and writes no new generated artifacts. Compatible existing Google/Gemini artifacts may still be read. Fake providers require explicit injection and canned translations; their `test-fake` / `canned-translations` identity cannot collide with production configuration.

Configuration `v3` advances selection and validation semantics and includes the ingredient chunk limit in its fingerprint. Earlier and test-provider artifacts remain stored but cannot satisfy production requests. First use is therefore cold and can regenerate all eligible fields on demand; no automatic deletion or backfill runs.

Validation rejects wrong types, missing outputs, malformed envelopes, incomplete provider responses, broken placeholders, altered protected values, excessive output, and unchanged source prose with a Khmer prefix. Independently valid fields survive. Deterministic tests establish structural behavior, not semantic accuracy or human review. Barcode and Shopper information never enter provider input or artifact identity.

Additional structured fields belong to subsequent slices of #93. Section 19 defines the shared translation-stage deadline.


## 19. Configurable translation-stage deadline (Issue #95)

`LIFEGOODS_TRANSLATION_DEADLINE_SECONDS` sets the total translation-stage budget in seconds, initially **12**. Deployment values must be finite and greater than zero; invalid values fail settings validation. This is an initial default, not a measured completion guarantee or a total Product Lookup/network SLA. Barcode validation, Dataset Snapshot lookup, projection, HTTP transport to the Shopper, and response serialization are outside this stage.

One monotonic deadline starts on entry to translation coordination, before identity calculation, cache reads, or generated-data store access. Hot-cache reads, quarantine checks, durable reads/writes, lease acquisition and polling, generation-budget access, provider attempts, validation, retry backoff, cooldown writes, and lease release share its remaining time. `LIFEGOODS_GEMINI_TRANSLATION_TIMEOUT_SECONDS` remains a positive, finite per-transport cap; it cannot extend the stage. Cached artifacts call no provider. No work starts after expiry, and late provider output is discarded before it can be presented or persisted. Partial output remains short-lived cache data, never a complete durable artifact.

Synchronous dependency I/O uses a bounded pool of 16 workers with no waiting backlog. Caller waiting is limited by the remaining deadline even if a driver's connect/read timeouts are independent. MongoDB additionally receives the remaining client-side operation timeout. An already-started I/O operation may finish in its driver after the caller stops waiting; its result cannot continue the translation workflow. A write of an already validated artifact that was submitted before expiry can have an uncertain acknowledgement. This does not permit late provider output to be stored. There are no scheduled jobs, deferred generation, or follow-up writes. Pool saturation falls back to Original Text.

A held lease lasts at least the remaining stage budget plus the configured cooldown, even when the configured lease minimum is shorter. Normal completion and failure release the owner-token lease within the same deadline; complete failures record the existing cooldown when time remains. If expiry prevents cleanup, the expiring lease suppresses immediate duplicate generation through the cooldown and is then the recovery mechanism. No fresh cleanup timeout extends the stage. Store failures continue to hold new provider calls, and generation budgeting remains fail-closed.

Expiry returns HTTP 200 with available Original Text and field-level translation outcomes when Product Lookup otherwise succeeds. Source-provided Khmer, intentionally preserved names, and missing fields retain their classification. Invalid Barcode, not-found, Dataset Snapshot, and Product Lookup rate-limit errors remain unchanged. Deadline, capacity, transport, HTTP, and structural failure details remain internal; provider error bodies, credentials, prompts, and token maps are absent from the public response. No endpoint, polling contract, or public retry field is added.

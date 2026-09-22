# Life Goods specification

## Status

This specification defines the product and API behavior implemented by the current repository. The read-only backend uses MongoDB for the Open Food Facts Dataset Snapshot and generated translation data, Redis for disposable caching and rate limiting, and FastAPI as the frontend contract owner. The bounded ingredient-matching prototype remains source-based evidence only; it is not a safety, allergen-free, or verification verdict.

The backend simplification and removal of obsolete relational/application wiring are represented in the current checkout. Historical issue references below remain useful for provenance, but the current code and contract sections are authoritative.

## 1. Product boundary

Life Goods is a read-only Khmer-first presentation layer over Open Food Facts data. It initially serves people shopping in Cambodia through a mobile-first progressive web application.

The MVP:

- decodes Barcodes on the shopper's device;
- finds Source Records in one static local Dataset Snapshot;
- presents consumer-facing Open Food Facts information with visible Source Attribution;
- develops the information architecture in English while the implemented Shopper experience is localized incrementally;
- supports optional on-demand Khmer Translation while preserving Original Text; and
- remains anonymous and read-only.

The MVP does not own a Product catalog, accept contributions, or verify source data. Barcode camera frames stay on the device. Compare Products is the one bounded exception that sends package photos for provider processing, retaining no photos or comparison history. The MVP does not produce health, safety, allergen-free, Halal, authenticity, legal, compliance, or purchase verdicts.

## 2. Current repository capability

The current checkout includes the stable cached Product Lookup endpoint, paginated Product Search, source-based allergen analysis, optional on-demand Khmer Translation with isolated generated-data persistence, and the bounded Compare Products API. The main frontend uses the stable Product Lookup and Product Search routes by default; its checked-in Dataset Snapshot remains an explicit offline/demo adapter. The shared shell and Scan/Home experience support Khmer and English, with Khmer as the first-time default; remaining main-app pages are localized incrementally. Compare Products retains its independent English and Khmer UI scope.

The foundational Product Lookup acceptance criteria in section 11 and the issue-specific sections that follow remain as implementation history and contract detail. They are not a statement that the repository is still at the first backend milestone.

## 3. Stable Product Lookup API

### Request

`GET /api/v1/products/{barcode}`

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
        "product": {},
        "allergen_analysis": {
            "off": {},
            "ingredient_matching": {},
            "comparison": {}
        }
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

For a found Product, `data.allergen_analysis` keeps Open Food Facts `off` tags separate from
`ingredient_matching` tags and includes a `comparison` with exact-tag intersections and
differences. Ingredient matching runs when usable English ingredient text is present regardless
of whether `allergens_tags` is empty.
Missing, unsupported, ambiguous, or insufficient ingredient evidence is returned explicitly and
does not mean that the Product has no allergens. The analysis is source comparison, not a Life
Goods safety, allergen-free, or verification verdict.

The frontend may store a Shopper's selected allergen groups on the device. Product pages show
selected positive ingredient matches and exact Open Food Facts declarations below the Product
name in a compact notice labeled “Selected allergens found”, followed by the matched names. Precautionary statements, Open Food Facts traces, and
unavailable evidence remain separate in the detailed source sections. No match means only that
available evidence did not identify a selected group.

The browser-only choices are exactly these 13 Open Food Facts tags: `en:celery`,
`en:crustaceans`, `en:eggs`, `en:fish`, `en:gluten`, `en:lupin`, `en:milk`, `en:molluscs`,
`en:mustard`, `en:nuts`, `en:peanuts`, `en:sesame-seeds`, and `en:soybeans`. The frontend saves
those exact tags, keeps no account or server-side choice state, and never sends selected choices
to the backend. Browser migration renames only dairy → Milk, tree nuts → Nuts, shellfish →
Crustaceans, soybean → Soybeans, mollusks → Molluscs, and sesame → Sesame seeds. Wheat,
Lactose, Sulphur Dioxide, Sulphites, duplicates, and unknown values are removed; Wheat is not
converted to Gluten and Lactose is not converted to Milk. A dismissible notice explains any
rename or removal. Invalid or blocked storage must not crash the page; a failed write keeps the
current choices in memory for the current tab and explains that they will last only for the visit.

When a selected group has a completed, unambiguous `positive_mention` backend ingredient match
or an exact Open Food Facts declaration, a compact selected-match notice appears once immediately
after the Product name and before other Product details. It contains the label “Selected allergens found” and the distinct matched
allergen names, such as “Milk, Nuts”. Frontend ingredient keyword matching and the legacy
assessment fallback are not used. The notice is hidden when no selected group has either of
those matches. “May contain” statements, Open Food Facts traces, negated wording, unclear
wording, and missing or incomplete checks do not create this compact notice; the full source
evidence remains available in the allergen and trace sections below.

`ingredient_matching.evidence` retains the matched Original Text span, taxonomy relationship,
and one of these bounded qualification values:

- `positive_mention`: reliable ingredient evidence eligible for derived tags;
- `precautionary_statement`: a supported cross-contact statement such as `may contain`;
- `negated_mention`: a supported negated form such as `milk-free`; or
- `unresolved_context`: recognized wording whose allergen relationship or context is not
  supported.

Only unambiguous `positive_mention` evidence with a supported allergen relationship contributes
to `ingredient_matching.tags` or the comparison sets. `qualifications` exposes non-positive
qualified evidence separately, while `unmatched_spans` reports each unmatched Original Text
token with its exact `text`, `start`, and `end` offsets. `unmatched_texts` remains the text-only
projection for compatibility. These fields describe source evidence and coverage limitations;
they never assert that a Product is allergen-free or safe.

The matcher supports bounded English qualification forms only. It does not claim general
natural-language or multilingual interpretation. A missing ingredient field, unsupported or
unknown language, oversized text, disabled matcher, or unavailable matcher is represented as
Source Data Unavailable with a reason, while the stable Product projection remains available
when possible.

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

The experimental `POST /api/experimental/ingredient-matches` route accepts JSON from configured
frontend origins. Its browser preflight permits `POST` only for those configured origins. Invalid,
missing, blank, whitespace-only, or oversized requests use the same `422` envelope:

```json
{
    "error": {
        "code": "invalid_ingredient_text",
        "message": "Enter ingredient text from 1 to 2000 characters."
    }
}
```

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

The shared shell and Scan/Home experience support English and Khmer, with Khmer as the first-time default and a persisted English or Khmer preference. Remaining main-app pages are localized incrementally. Compare Products retains its independent English and Khmer UI scope; the stable Product Lookup API supports opt-in Khmer Translation for clients that request `language=km`.

- Khmer is the intended primary display language for the public product experience.
- Original Text remains retained in the Source Record; the Khmer Product page does not render per-field Show Original Text controls.
- Khmer Translation is generated on demand rather than for the whole Dataset Snapshot.
- Translation output is cached against Dataset Snapshot version, source content, and translation configuration.
- The selected locale supplies the display-language context; standalone Khmer Translation and Original Text field markers are omitted.
- Generated output is not presented as human-reviewed or verified.
- Translation failure falls back to Original Text and does not fail Product Lookup.
- Fluent human review is required for interface vocabulary, navigation, explanations, disclaimers, and accessibility copy.
- Individual Product translations are not presented as human-reviewed or verified.

The current provider and model are fixed to Gemini `gemini-3.8-flash` under translation configuration `v3`; provider or model changes require an explicit product and specification decision.

## 9. Privacy and measurement

- Decode Barcode camera frames on the device and send only the normalized Barcode for lookup.
- Do not upload or retain Barcode camera frames.
- For Compare Products, send only the submitted label photos to the configured provider for processing, and retain no photos, extracted label text, comparison history, or persistent Shopper identifiers.
- Do not create accounts, server-side scan history, saved Products, or personalization in the MVP.
- Do not retain Barcode-level analytics, persistent IP identifiers, or per-Shopper histories.
- Permit aggregate counts for lookup volume, found/not-found rate, latency, cache performance, and error rate.
- Minimize or redact Barcodes in application logs unless a short-lived operational diagnostic explicitly requires them.

## 10. Backend persistence and module boundary

The current read-only MVP has no durable relational data requirement. The backend
refactor is complete for the current architecture:

1. the MongoDB Dataset Snapshot and Open Food Facts import/read foundation remain;
2. Redis remains disposable cache and rate-limit infrastructure;
3. PostgreSQL, Alembic, and their migration chain are not runtime dependencies;
4. obsolete catalog, package-match, reference-dataset, Halal, assessment, and
   package-capture application wiring is absent; and
5. the bounded ingredient-matching prototype uses the Open Food Facts taxonomy
   only. Independent reference-source integration and mapping expansion remain
   out of scope until a future specification adopts them.

Generated translation storage is isolated in MongoDB and initialized explicitly
with `pnpm generated-data:init`; web startup does not create its collections or
indexes. A future relational store would require a new product requirement and
an accepted ADR rather than restoring the removed migration history.

## 11. Foundational milestone acceptance criteria

These criteria document the completed first backend milestone; they are retained for provenance and do not describe the full current repository scope.

The first backend milestone is complete when:

- supported Barcodes are normalized and validated before lookup;
- a known Barcode returns the stable Product projection and allergen analysis in the documented envelope;
- storage-only fields do not leave the backend;
- source name, source Product URL, Dataset Snapshot version, and retrieval time are present;
- invalid, unknown, unavailable-source, rate-limit, and internal-error paths use the documented statuses and codes;
- found and not-found cache behavior is covered by tests;
- the service never calls the live Open Food Facts API as a fallback;
- the endpoint is represented in FastAPI's OpenAPI contract and generated frontend client; and
- aggregate metrics contain no retained Barcode or Shopper history.

## 12. Frontend compatibility surface (Issue #83)

The default frontend Product Lookup requests the stable `/api/v1/products/{barcode}` backend
route without a language parameter while the information-architecture prototype remains English.
The checked-in Dataset Snapshot remains available through an explicit
offline/demo adapter and retains a frontend-owned raw Source Record compatibility type, including
an unavailable allergen-analysis fallback, independent of the generated FastAPI types. The
generated client represents the stable response, including its `data.allergen_analysis` sibling.
The presentation adapter preserves Source Attribution for both the retained static response and
the stable API response.

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

1. **Versioned Benchmark Inputs**: Versioned packaged-food test cases (`v1`) cover representative multilingual Source Record texts (English, French, Thai, Vietnamese, Chinese, Khmer, unknown language `und`, and mixed script), the expanded eligible fields, taxonomy references, critical edge cases (brand preservation, E-numbers, INS codes, numerical values, percentages, quantities, units, long ingredients, adversarial prompt injection), and bypass conditions. All benchmark items use synthetic fixture identifiers; no Barcodes, IP addresses, or Shopper data are emitted.
2. **Deterministic Token & Placeholder Protection**: Brand names, numerical tokens, percentages, units, E-numbers, and INS codes are masked with opaque placeholders (`__LG_TOK_n__`), restored post-translation, and validated for zero-loss, corruption, or lingering placeholders.
3. **Production-Path Runner & Stable Configuration**: The harness projects each Source Record and runs the production `KhmerTranslationModule`, coordinator, 12-second deadline, cache, and exact `gemini-3.8-flash` adapter. It does not maintain a benchmark-only prompt or transport. Moving aliases and deprecated models remain rejected.
4. **Separated Evidence Modes**: `pnpm benchmark:run` performs deterministic zero-network structural verification. `pnpm benchmark:live` is an explicit operator action using configured environment credentials. Offline runs record token usage, provider latency, and cost as unavailable rather than estimating them from characters or simulated delays.
5. **Automated Evidence Artifacts**: Runs export `summary.json`, sanitized per-fixture `measurements.json`, and `evaluation_report.md`. Artifacts include completion states, cold and cached latency, timeout and provider-attempt counts, reported prompt/visible-output/thinking/billed-output tokens, and cost only when provider metadata is sufficient. No prompt, raw provider payload, credential, Barcode, or Shopper data is exported. Percentiles require at least 20 samples; smaller runs identify the limitation instead of claiming a production percentile. No manual review packet, human review checklist, approval gate, or model judge is produced.

## 15. Khmer Translation Module and Gemini Adapter (Issue #87)

The translation domain is encapsulated behind the deep `KhmerTranslationModule` and provider adapters:

1. **Eligible Fields & Selection**:
    - Translations are generated strictly for `generic_name`, `ingredients_text`, and human-readable `categories`; Product names and brand names always retain their selected Original Text and are never sent to the translation provider.
    - Localized Original Text values are preserved with source field and language.
    - Deterministic preference order: Source-provided Khmer (`km` and recognized variants, retaining source metadata), declared record language, English (`en`), and deterministic localized fallback.
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
    - `GET /api/v1/products/{barcode}?language=km`
    - Requests without `language=km` return the stable Product projection and Original Text without generating translation (`meta.translation.status="not_requested"`).
    - The application request and locale value is `km`. External Source Record language tags, including `km`, retain their original metadata. Any other unsupported language parameter value returns HTTP 422 with stable error code `unsupported_language`.
    - The stable response also includes `data.allergen_analysis`, preserving the distinction between Open Food Facts tags, matcher-derived tags, qualifications, unmatched spans, and comparison sets.

2. **Field-Level Co-Location**:
    - Semantic fields (`identity.name`, `identity.generic_name`, `ingredients_text`, `categories_text`, individual category items, storage instructions, packaging descriptions, and recycling instructions) carry individual translation states: `not_requested`, `source_khmer_available`, `original_text_preserved`, `generated`, `source_data_unavailable`, or `translation_unavailable`. `identity.name` and brand names always retain Original Text; the remaining listed fields are eligible for translation.
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

## 18. Complete Khmer Translation fields (Issue #94)

The frontend Product Lookup request sends `language=km` whenever Khmer is selected; English requests omit the parameter. `language=kh` is unsupported. Application locale state and standards-based document language tags use `km` when Khmer is enabled.

All eligible field envelopes share selection and classification across generation, cache reuse, provider failure, coordination failure, and emergency fallback. Selection prefers source-provided Khmer (including recognized language variants or conservative script detection), then the Source Record language, English, and deterministic fallback. Script detection does not manufacture language metadata. Human-readable category, packaging, storage, and recycling Original Text retains its source wording and language; taxonomy identifiers are not translation prose.

| Field status              | Text available for display                                                          |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `generated`               | `khmer_translation`                                                                 |
| `source_khmer_available`  | Khmer `selected_original_text`                                                      |
| `original_text_preserved` | Intentionally unchanged `selected_original_text`, including every Product name |
| `translation_unavailable` | Available `selected_original_text`                                                  |
| `not_requested`           | Available `selected_original_text`                                                  |
| `source_data_unavailable` | No source text; the frontend supplies missing-state copy                            |

With a translation request, the overall status is `not_needed` when no field requires generation, `complete` when all required fields succeed, `partial` when some succeed, and `unavailable` when none succeed. Source-provided Khmer, preserved names, and missing fields do not count as failed generation. Provenance is present only with generated output and records the actual provider, exact model, configuration version, and generation time. Source Attribution and Dataset Snapshot metadata remain separate.

Without Gemini credentials, startup disables generation and writes no new generated artifacts. Compatible existing Google/Gemini artifacts may still be read. Fake providers require explicit injection and canned translations; their `test-fake` / `canned-translations` identity cannot collide with production configuration.

The production translation configuration is `v3`, which preserves Product and brand names as Original Text and includes the expanded field selection, validation, token protection, deterministic taxonomy handling, and the ingredient chunk limit in its fingerprint. Incompatible and test-provider artifacts cannot satisfy production requests. Existing compatible artifacts remain durable and can be reused; no automatic deletion or backfill runs.

Validation rejects wrong types, missing outputs, malformed envelopes, incomplete provider responses, broken placeholders, altered protected values, excessive output, and unchanged source prose with a Khmer prefix. Independently valid fields survive. Deterministic tests establish structural behavior, not semantic accuracy or human review. Barcode and Shopper information never enter provider input or artifact identity.

Additional structured fields belong to subsequent slices of #93. Section 19 defines the shared translation-stage deadline.

## 19. Configurable translation-stage deadline (Issue #95)

`LIFEGOODS_TRANSLATION_DEADLINE_SECONDS` sets the total translation-stage budget in seconds, initially **12**. Deployment values must be finite and greater than zero; invalid values fail settings validation. This is an initial default, not a measured completion guarantee or a total Product Lookup/network SLA. Barcode validation, Dataset Snapshot lookup, projection, HTTP transport to the Shopper, and response serialization are outside this stage.

One monotonic deadline starts on entry to translation coordination, before identity calculation, cache reads, or generated-data store access. Hot-cache reads, quarantine checks, durable reads/writes, lease acquisition and polling, generation-budget access, provider attempts, validation, retry backoff, cooldown writes, and lease release share its remaining time. `LIFEGOODS_GEMINI_TRANSLATION_TIMEOUT_SECONDS` remains a positive, finite per-transport cap; it cannot extend the stage. Cached artifacts call no provider. No work starts after expiry, and late provider output is discarded before it can be presented or persisted. Partial output remains short-lived cache data, never a complete durable artifact.

Synchronous dependency I/O uses a bounded pool of 16 workers with no waiting backlog. Caller waiting is limited by the remaining deadline even if a driver's connect/read timeouts are independent. MongoDB additionally receives the remaining client-side operation timeout. An already-started I/O operation may finish in its driver after the caller stops waiting; its result cannot continue the translation workflow. A write of an already validated artifact that was submitted before expiry can have an uncertain acknowledgement. This does not permit late provider output to be stored. There are no scheduled jobs, deferred generation, or follow-up writes. Pool saturation falls back to Original Text.

A held lease lasts at least the remaining stage budget plus the configured cooldown, even when the configured lease minimum is shorter. Normal completion and failure release the owner-token lease within the same deadline; complete failures record the existing cooldown when time remains. If expiry prevents cleanup, the expiring lease suppresses immediate duplicate generation through the cooldown and is then the recovery mechanism. No fresh cleanup timeout extends the stage. Store failures continue to hold new provider calls, and generation budgeting remains fail-closed.

Expiry returns HTTP 200 with available Original Text and field-level translation outcomes when Product Lookup otherwise succeeds. Source-provided Khmer, intentionally preserved names, and missing fields retain their classification. Invalid Barcode, not-found, Dataset Snapshot, and Product Lookup rate-limit errors remain unchanged. Deadline, capacity, transport, HTTP, and structural failure details remain internal; provider error bodies, credentials, prompts, and token maps are absent from the public response. No endpoint, polling contract, or public retry field is added.

## 20. Structured storage instructions (Issue #96)

`ProductProjection` provides structured storage instructions in `storage_instruction_items`. Each item exposes a deterministic item key (`storage_instruction_0`, `storage_instruction_1`, etc.) and the shared `TranslatableField` envelope (`original_texts`, `selected_original_text`, `translation_status`, and `khmer_translation`). The legacy `storage_instructions: list[OriginalText]` array remains preserved for backward compatibility.

1. **Source Grouping and Deduplication**:
    - `conservation_conditions` and `storage_conditions` source field families (including language-specific variants like `_en`, `_fr`, `_km`) are projected into statement items.
    - Localized variants of the same statement are grouped together in `original_texts`.
    - Distinct source-field statements remain separate items preserving source order.
    - Exact duplicate statements across source fields collapse into a single statement item while retaining their `OriginalText` provenance from both fields in `original_texts`. Equivalence is never inferred from merely similar wording.

2. **Source Selection & Field States**:
    - Shared source selection applies per item: source-provided Khmer (explicit `km` tags or script detection) bypasses Khmer Translation generation and receives `source_khmer_available`.
    - Missing storage instructions yield an empty list (`[]`) without inventing text or ghost entries.
    - Without `language=km`, each item receives `not_requested`.

3. **Protection & Validation**:
    - Token protection covers temperatures (e.g. `4°C`, `-18°C`) and durations (e.g. `3 days`) in addition to brands, INS codes, E-numbers, percentages, and units.
    - Each statement item undergoes independent validation. If one item fails, valid sibling items survive as `generated`, setting the overall translation status to `partial`.

4. **Cache & Fingerprint**:
    - Storage instruction items participate in the `v1` configuration fingerprint with item selection, schema, and token protection. Incompatible earlier bundles cannot be reused.

5. **API Response Examples**:

    - **Complete (all storage items translated)**:

        ```json
        {
            "data": {
                "product": {
                    "storage_instruction_items": [
                        {
                            "key": "storage_instruction_0",
                            "original_texts": [
                                {
                                    "value": "Keep frozen at -18°C",
                                    "language": "en",
                                    "source_field": "conservation_conditions"
                                }
                            ],
                            "selected_original_text": {
                                "value": "Keep frozen at -18°C",
                                "language": "en",
                                "source_field": "conservation_conditions"
                            },
                            "translation_status": "generated",
                            "khmer_translation": "រក្សាទុកឱ្យកកនៅ -18°C"
                        }
                    ]
                }
            },
            "meta": {
                "translation": {
                    "status": "complete"
                }
            }
        }
        ```

    - **Partial (one item valid, one failed validation)**:

        ```json
        {
            "data": {
                "product": {
                    "storage_instruction_items": [
                        {
                            "key": "storage_instruction_0",
                            "original_texts": [
                                {
                                    "value": "Keep at 4°C",
                                    "language": "en",
                                    "source_field": "conservation_conditions"
                                }
                            ],
                            "selected_original_text": {
                                "value": "Keep at 4°C",
                                "language": "en",
                                "source_field": "conservation_conditions"
                            },
                            "translation_status": "generated",
                            "khmer_translation": "រក្សាទុកនៅ 4°C"
                        },
                        {
                            "key": "storage_instruction_1",
                            "original_texts": [
                                {
                                    "value": "Consume quickly after opening",
                                    "language": "en",
                                    "source_field": "storage_conditions"
                                }
                            ],
                            "selected_original_text": {
                                "value": "Consume quickly after opening",
                                "language": "en",
                                "source_field": "storage_conditions"
                            },
                            "translation_status": "translation_unavailable",
                            "khmer_translation": null
                        }
                    ]
                }
            },
            "meta": {
                "translation": {
                    "status": "partial"
                }
            }
        }
        ```

    - **Missing (no storage conditions in source record)**:
        ```json
        {
            "data": {
                "product": {
                    "storage_instructions": [],
                    "storage_instruction_items": []
                }
            }
        }
        ```

## 21. Packaging descriptions and recycling instructions (Issue #97)

`product.packaging.description_items` and `product.packaging.recycling_instruction_items`
use the shared `TranslatableTextItem` envelope. Keys are `packaging_description_0`,
`packaging_description_1`, etc., and `recycling_instruction_0`,
`recycling_instruction_1`, etc. They are deterministic within each projected Source
Record, not persistent identifiers across changed source content.

Descriptions use the existing `packaging` and `packaging_text` source field families,
in that order. Recycling instructions use `recycling_instructions_to_discard` and
`recycling_instructions`, in that order. Language alternatives within each family
belong to one statement. The longer recycling field family is never interpreted as
a language suffix of the shorter family. Exact duplicate statements collapse when
one family's text values equal or are a subset of the other's; similar wording does
not establish equivalence. Every contributing Original Text retains its language
and source-field provenance, including identical base and localized values.

Legacy `packaging.texts`, `packaging.recycling_instructions`, components, materials,
shapes, and recycling values remain unchanged. Taxonomy fields and component
identifiers do not supply generated prose. Missing prose yields empty item arrays.
Without `language=km`, populated items retain `not_requested` and selected Original
Text. With `language=km`, the storage pipeline's selection, source-provided Khmer
preference, independent validation, and response mapping also apply to packaging.

Brands, quantities, percentages, units, and codes remain protected. Protection now
also covers material codes paired with numbers, such as `PAP 21`, `PET 1`, and
`C/PAP 81`, and standalone uppercase material codes such as `PET` and `HDPE`. Provider instructions require the source wording and all conditions to
be retained without adding Cambodian disposal facilities, infrastructure,
regulations, local recommendations, Product properties, or verification claims.
Structural checks do not establish translation accuracy or human review.

One structured provider request contains the admitted fields from the existing
fields, storage items, description items, and recycling items, in that order.
The combined masked fields JSON has a **16,000 UTF-8 byte** limit, including field
keys and JSON syntax; transport/schema overhead is separate. A field that cannot
fit is omitted in full and remains `translation_unavailable`, while later fields
that fit may still translate. Ingredient chunks are admitted or omitted together.
Long packaging prose is sent whole; no instruction is sliced, summarized, or
silently truncated by the application. If every eligible field exceeds the limit,
no provider call occurs and the result is `unavailable`, with all Original Text
preserved. Gemini's output allowance is **8,192 tokens**; the existing per-field
validation bounds (at most 4,000 characters and the source-relative bound) remain.
An incomplete provider response is rejected; missing or malformed items in an
otherwise valid response do not discard independently valid siblings. These limits
can cause Original Text fallback for long instructions, not shortened translations.

Packaging items participate in the **v1** configuration fingerprint, including item selection, schema, token protection, and payload/output limits. Complete artifacts remain durable, partial results remain short-lived hot-cache data, and compatible selected text can be reused across Dataset Snapshots while current Original Text provenance is rebuilt.
The shared translation deadline, generation budget, failure behavior, Source
Attribution, and Barcode/Shopper privacy boundaries remain in force. No backfill,
automatic artifact deletion is introduced. When Khmer is selected, the frontend
renders translated packaging description, recycling, and storage items without
per-field Original Text controls. Packaging component table cells also omit
standalone translation or source markers to preserve compact, consistent rows.

Example packaging fragment for a partial response (`meta.translation.status` is
`partial`; machine-generated provenance remains in `meta.translation.metadata`):

```json
{
    "description_items": [
        {
            "key": "packaging_description_0",
            "original_texts": [
                {
                    "value": "Glass bottle",
                    "language": "en",
                    "source_field": "packaging_text_en"
                }
            ],
            "selected_original_text": {
                "value": "Glass bottle",
                "language": "en",
                "source_field": "packaging_text_en"
            },
            "translation_status": "generated",
            "khmer_translation": "ដបកែវ"
        }
    ],
    "recycling_instruction_items": [
        {
            "key": "recycling_instruction_0",
            "original_texts": [
                {
                    "value": "Remove the lid",
                    "language": "en",
                    "source_field": "recycling_instructions_en"
                }
            ],
            "selected_original_text": {
                "value": "Remove the lid",
                "language": "en",
                "source_field": "recycling_instructions_en"
            },
            "translation_status": "translation_unavailable",
            "khmer_translation": null
        }
    ]
}
```

For a complete response, the recycling item can instead carry
`"translation_status": "generated"` and `"khmer_translation": "ដោះគម្របចេញ"`;
`meta.translation.status` is `complete` when all required fields succeed. Missing
packaging prose returns `"description_items": []` and
`"recycling_instruction_items": []`, even when packaging taxonomy data is present.

## 22. Individually translated category items (Issue #98)

`product.category_items` uses the shared `TranslatableTextItem` envelope. Keys are deterministic within each projected Source Record: `category_0`, `category_1`, etc. They represent ordered, human-readable category segments extracted from the Source Record (`categories`, `categories_<lang>`), preserving source order, boundaries, exact duplicate provenance collapse, and punctuation. Similar wording or fuzzy correspondence across languages does not infer equivalence.

Taxonomy slugs and normalized taxonomy tags (`categories_tags`, `categories_hierarchy`) never manufacture human-readable Original Text. When a Source Record contains taxonomy tags but no human-readable category strings, `product.category_items` is empty (`[]`), while the legacy `product.categories` array preserves the taxonomy tag strings for display. In this scenario, `product.categories_text.translation_status` is `"source_data_unavailable"`.

The monolithic `"categories"` field is removed from translation provider payloads. Instead, individual translatable category items (`category_0`, `category_1`, ...) are submitted within the single structured provider request, undergoing independent validation, token protection, and caching. Provider outputs are never split by commas or delimiters.

Legacy translation compatibility:

- `product.categories` (`list[str]`) and `product.categories_text` (`TranslatableField`) remain present in the response envelope.
- `product.categories_text` is assembled post-provider from `category_items`:
    - When every required category item possesses usable Khmer text (generated, source Khmer, or Original Text preserved), `product.categories_text.khmer_translation` is assembled by joining the items in order with `", "`, and `product.categories_text.translation_status` reflects the outcome (`"generated"` if any item was generated).
    - When one or more required category items have `translation_unavailable`, `product.categories_text.translation_status` becomes `"translation_unavailable"` with `khmer_translation: null`, while successful individual `category_items` retain their translations.
    - Reconstructed cache hits deterministically re-assemble `product.categories_text` using the same semantics.

Category items participate in the unified initial release baseline at configuration **v1**, with all internal sub-component versions normalized to **v1**.

Example category items fragment for a partial response (`meta.translation.status` is `partial`):

```json
{
    "categories": ["Snacks", "Chocolates"],
    "categories_text": {
        "translation_status": "translation_unavailable",
        "khmer_translation": null,
        "original_texts": [
            {
                "value": "Snacks, Chocolates",
                "language": "en",
                "source_field": "categories"
            }
        ],
        "selected_original_text": {
            "value": "Snacks, Chocolates",
            "language": "en",
            "source_field": "categories"
        }
    },
    "category_items": [
        {
            "key": "category_0",
            "original_texts": [
                {
                    "value": "Snacks",
                    "language": "en",
                    "source_field": "categories"
                }
            ],
            "selected_original_text": {
                "value": "Snacks",
                "language": "en",
                "source_field": "categories"
            },
            "translation_status": "generated",
            "khmer_translation": "អាហារសម្រន់"
        },
        {
            "key": "category_1",
            "original_texts": [
                {
                    "value": "Chocolates",
                    "language": "en",
                    "source_field": "categories"
                }
            ],
            "selected_original_text": {
                "value": "Chocolates",
                "language": "en",
                "source_field": "categories"
            },
            "translation_status": "translation_unavailable",
            "khmer_translation": null
        }
    ]
}
```

## 23. Exact taxonomy references (Issue #99)

Stable Product Lookup exposes exact Open Food Facts taxonomy references under `product.taxonomy_references` so frontend terminology dictionaries can map terms without guessing identifiers from displayed English text. This capability performs no new Khmer Translation.

1. **Groups and Schema**:
    - `taxonomy_references` groups identifiers into seven categories:
        - `categories`: `list[TaxonomyReference]` (from `categories_tags`, `categories_hierarchy`)
        - `additives`: `list[TaxonomyReference]` (from `additives_tags`, `additives_hierarchy`, `additives_original_tags`)
        - `labels`: `list[TaxonomyReference]` (from `labels_tags`, `labels_hierarchy`)
        - `countries`: `list[TaxonomyReference]` (from `countries_tags`, `countries_hierarchy`)
        - `packaging_materials`: `list[TaxonomyReference]` (from `packaging_materials_tags`, `packagings_materials`, `packagings[].material`)
        - `packaging_shapes`: `list[TaxonomyReference]` (from `packaging_shapes_tags`, `packagings[].shape`)
        - `packaging_recycling_terms`: `list[TaxonomyReference]` (from `packaging_recycling_tags`, `packagings[].recycling`; aliased as `packaging_recycling`)
    - Each `TaxonomyReference` consists of:
        - `id`: exact source identifier including namespace (e.g. `en:plant-based-beverages`, `fr:boissons-vegetales`, `en:e330`, `en:organic`, `en:cambodia`, `en:paperboard`, `en:carton`, `en:recycle`).
        - `source_field`: provenance indicating which source field provided the tag (e.g. `categories_tags`, `categories_hierarchy`, `packagings_materials`, `packagings.material`).

2. **Source Reading and Provenance**:
    - Source identifiers are read directly as declared in the Source Record. Identifiers are never synthesized by slugifying display labels or human-readable names.
    - Multiple source fields within a group are processed in canonical order; duplicates are collapsed to retain the first encountered provenance.
    - Missing groups remain empty arrays (`[]`), rather than being populated with guessed or defaulted taxonomy references.

3. **Taxonomy and Translation Independence**:
    - Human-readable categories (`categories`, `category_items`, `categories_text`) and taxonomy references (`taxonomy_references.categories`) remain distinct. No correspondence is claimed between a human-readable category item and a taxonomy identifier without explicit source association.
    - Records containing only taxonomy tags (and no human-readable category prose) expose their taxonomy identifiers in `taxonomy_references.categories`, while `category_items` remains `[]` and `categories_text.translation_status` evaluates to `source_data_unavailable`. No Khmer Translation provider call or generated-data persistence is invoked for taxonomy identifiers.
    - The Open Food Facts Dataset Snapshot remains read-only. No new provider calls, external taxonomy fetches, generated-data writes, or Barcode-level analytics are introduced.

4. **Example API Fragment**:

```json
{
    "taxonomy_references": {
        "categories": [
            {
                "id": "en:plant-based-beverages",
                "source_field": "categories_tags"
            },
            {
                "id": "en:oat-drinks",
                "source_field": "categories_tags"
            },
            {
                "id": "en:beverages",
                "source_field": "categories_hierarchy"
            }
        ],
        "additives": [
            {
                "id": "en:e330",
                "source_field": "additives_tags"
            }
        ],
        "labels": [
            {
                "id": "en:organic",
                "source_field": "labels_tags"
            },
            {
                "id": "fr:agriculture-biologique",
                "source_field": "labels_tags"
            }
        ],
        "countries": [
            {
                "id": "en:cambodia",
                "source_field": "countries_tags"
            }
        ],
        "packaging_materials": [
            {
                "id": "en:paperboard",
                "source_field": "packaging_materials_tags"
            },
            {
                "id": "en:plastic",
                "source_field": "packagings_materials"
            }
        ],
        "packaging_shapes": [
            {
                "id": "en:carton",
                "source_field": "packaging_shapes_tags"
            }
        ],
        "packaging_recycling_terms": [
            {
                "id": "en:recycle",
                "source_field": "packaging_recycling_tags"
            }
        ]
    }
}
```

## 24. Expanded contract verification and performance evidence (Issue #100)

The stable Product Lookup HTTP suite is the acceptance boundary for `language=km`, rejection of application request `kh`, recognized source-provided `km` metadata, Original Text, generated provenance, field and overall states, structured storage/packaging/category items, taxonomy references, and legacy fields. Deterministic fixtures cover complete, sparse, multilingual, mixed, unknown-language, source-Khmer, brand-only, long-input, missing-source, partial, and unavailable behavior.

The benchmark described in section 14 measures the production translation path and records cold and cached results separately under `docs/research/translation-benchmark/issue-100/`. Real MongoDB/Redis integration checks remain separate from the zero-network suite and require dedicated disposable test connections. On 2026-09-08, the project owner waived live-provider execution as an issue-completion requirement because production retains the already-approved exact Gemini model. Consequently, no claims are made about measured live provider latency, completion, timeout, usage, or cost, and simulated measurements are not substituted. The live command remains available as an optional operator diagnostic. This scope decision does not alter the 12-second default.

## 25. Product Search API, text matching, and paginated summaries (Issues #104, #105)

The Product Search endpoint `GET /api/v1/products/search` provides Barcode search and complete-word text search across source Product names and brands over a single static Dataset Snapshot:

1. **Request & Contract**:
    - `GET /api/v1/products/search?q={query}&cursor={cursor}`
    - Registered before the parameterized Product Lookup route (`GET /api/v1/products/{barcode}`).
    - `q` is required and must contain between 2 and 200 characters and at most 10 normalized terms. Empty or punctuation-only input returns HTTP 422 with error code `invalid_query`. Term extraction normalizes text using NFKC casefolding while preserving Unicode combining marks (such as Khmer vowels and diacritics) attached to letters and numbers.
    - `cursor` is an optional continuation token for paginated text searches. Cursors are opaque, URL-safe base64 tokens containing the sort position (`rank`, bounded `name_sort`, `code`) and an unsigned SHA-256 fingerprint of the normalized query terms. Tokens are canonical unpadded URL-safe base64, bounded to 4,096 characters, with strictly validated primitive fields and a 16-character lowercase hexadecimal query fingerprint.
    - Malformed cursors, noncanonical base64, cursors issued for different query terms, or cursors supplied with Barcode searches return HTTP 422 with error code `invalid_cursor`.

2. **Numeric Input & Barcode Classification**:
    - Numeric inputs at supported Barcode lengths (8, 12, 13, 14) are validated using standard Barcode check-digit and normalization logic (stripping outer whitespace and internal spaces or hyphens, preserving leading zeros).
    - Invalid Barcode-length numeric candidates return HTTP 422 with error code `invalid_barcode`.
    - Shorter numeric inputs (e.g. "1664") or numeric inputs not matching supported Barcode lengths are classified as text rather than invalid Barcodes.

3. **Barcode Retrieval & Product Summaries**:
    - Valid Barcodes look up zero or one Product summary from the Dataset Snapshot independently of text index readiness.
    - If the Product is absent from the Dataset Snapshot, HTTP 200 is returned with an empty products list (`data.products: []`).
    - If the Product is found, HTTP 200 is returned with a single `ProductSummary` item.
    - `ProductSummary` includes `barcode`, selected `name` (`OriginalText` provenance), selected `generic_name` (`OriginalText` provenance), `brands`, `manufacturing_places` (the Open Food Facts manufacturing-place field presented as “Made in”), `quantity`, `packaging`, `labels`, `thumbnail` (`SourceImage` provenance), and individual `Source Attribution` (`https://world.openfoodfacts.org/product/{barcode}`). It does not calculate full Product details or invoke `Khmer Translation`.
    - Top-level `meta` provides `Source Attribution` for Open Food Facts (`https://world.openfoodfacts.org`), `Dataset Snapshot` metadata, and nullable `pagination.next_cursor` (`null` for Barcode queries).

4. **Text Search Indexing & Readiness**:
    - Search index lifecycle creates a schema version 4 compound index collection per active Dataset Snapshot. The indexed summaries carry the source-derived generic name, packaging, labels, and a bounded information score for useful Product details.
    - Shopper-facing Product search results use a comparison-first list with an available Source Record thumbnail: Product name first, then Product type, Company plus quantity, or Barcode; compact Size, Pack, labels, Made in, and Barcode metadata remain visible without opening each Product. Products without a usable image show an image-unavailable placeholder, and a single result-level `Source Data Unavailable` notice summarizes missing Product names.
    - Indexes include `ix_search_name_tokens` (`name_tokens: 1`), `ix_search_brand_tokens` (`brand_tokens: 1`), and `ix_search_sort` (`information_score: -1, name_sort: 1, code: 1`).
    - Only records with valid Barcodes (`normalize_identifier`) are indexed; invalid `Source Records` increment `excluded_count`.
    - Ordered retrieval additionally requires compound indexes on each of `brand_values`, `name_values`, `name_tokens`, `brand_tokens`, and `country_tokens`, followed by `information_score: -1, name_sort: 1, code: 1`, named `ix_search_<field>_sort`. Readiness verifies their key definitions. `ensure-search-indexes <version_id>` adds these indexes in place without changing summaries, Source Records, or manifest metadata.
    - Manifest metadata (`search_index`) tracks `status: "READY"`, `schema_version: 4`, `document_count`, and `excluded_count`.
    - If the search index is missing, incompatible, or not ready, text searches return HTTP 503 with error code `search_unavailable`, while Barcode searches continue to operate without degradation.

5. **Text Ranking & Localized Name Selection**:
    - Earlier terms strictly require complete tokens; the final term supports an escaped, anchored prefix. Typo tolerance, substring-anywhere matching, fuzzy retrieval, and cross-language retrieval are not supported.
    - Results are ranked across four strict tiers:
        - Exact brand match (`rank: 0`): the normalized query matches an entry in `brand_values`.
        - Exact name match (`rank: 1`): the normalized query matches an entry in `name_values`.
        - Complete-word token match (`rank: 2`): all query terms are present as complete tokens across `name_tokens` and/or `brand_tokens`.
        - Remaining prefix match (`rank: 3`): earlier query terms match complete tokens, and the final query term matches as an anchored prefix (`^term`) on a token in `name_tokens` or `brand_tokens`.
    - Within each relevance tier, Products are ordered by information score descending, then `name_sort` and Barcode ascending. The score has one point each for usable ingredient text, nutrition data, front image, brand, and quantity. Relevance tier remains the primary ordering.
    - Localized name display selection (`select_matching_name`) prioritizes the source name candidate matching the highest count of query terms. When query-term match counts tie, complete-token matches are preferred over prefix matches. Subsequent ties are broken by `record_language` -> `"en"` -> first listed name. If zero name terms match (e.g. pure brand match), standard Product Lookup name preference applies.

6. **Keyset Pagination & Timeout**:
    - Page continuation uses keyset evaluation against the compound sort key across all ranking tiers (`rank: 0, 1, 2, 3`) without offset skipping. The cursor contains `rank`, `information_score`, bounded `name_sort`, Barcode, and a query fingerprint.
    - Each page retrieves up to 5 Products. Keyset queries fetch 6 records to generate `next_cursor` without secondary count queries.
    - When no subsequent results remain, `pagination.next_cursor` is `null`.
    - Text retrieval shares a two-second execution budget across ordered complete-match and remaining-prefix queries; each MongoDB command receives the remaining `maxTimeMS`. Exact brand and exact name matches use separate, disjoint equality queries with index-provided information-score/name/Barcode ordering. Remaining complete matches merge bounded, ordered equality streams for name, brand, and country tokens, deduplicating by Barcode; at most 6 candidates per stream are fetched. Cursor filters apply before retrieval. The disjoint remaining-prefix query runs only when needed. Queries stop once 6 results have been found. One- or two-character final prefixes use a bounded 129-candidate probe: at most 128 candidates can be sorted as a complete set in memory; larger sets use the existing information-score/name/Barcode sort index with early termination. Longer prefixes retain indexed candidate retrieval. Budget exhaustion returns HTTP 503 `search_timeout`, never partial success.

7. **Rate Limiting & Privacy**:
    - Anonymous per-IP rate limiting operates independently under `LIFEGOODS_PRODUCT_SEARCH_REQUESTS_PER_MINUTE` (default 60), returning HTTP 429 `rate_limit_exceeded`.
    - Search queries, Barcodes, and client IP addresses are redacted from access logs and omitted from operational metrics.

8. **Search page Barcode interaction**:
    - On `/search`, a valid typed or pasted Barcode is submitted to Product Search and remains on the Search page while the matching Product summary loads. The Shopper selects the result to open Product information; a missing match or failed request remains visible inline for correction or retry.
    - Barcode result rows show the available Product identity, image or image-unavailable placeholder, and Barcode. They do not calculate full Product details or invoke `Khmer Translation`.
    - Successful camera scans and recent Product links retain their direct Product navigation. Returning to Search with browser Back restores the submitted query and completed Search results for the current navigation entry without a second request.

## 26. Full-dataset Product Search validation (Issue #107)

The activation and acceptance-evidence work in #107 is complete. This does not
establish acceptance of parent #103. The full findings, frozen corpus, reproduction
commands and raw measurements are retained under
[search-validation/issue-107](research/search-validation/issue-107/FINDINGS.md).

On 2026-09-09 (Asia/Phnom_Penh), the existing manual lifecycle command built the
production schema-1 search index for Dataset Snapshot
`9f6d5359fa944e458804c1b63e7365a7`, with status `READY`: 4,522,390 records indexed and
188,319 excluded from 4,710,709 measured Source Records. Source Records and activation
state were preserved.

The separately frozen 100-case corpus was exercised through real HTTP and MongoDB,
with a separate first pass and 1,000 requests each at concurrency one and five.
Warmed concurrency-five p95 was 149.13 ms, below the unchanged 300 ms target, but
43 server timeouts occurred across the 2,100 measured requests. Specific-Product
hit-at-five was 89.29% against a 90% target; discovery displayed-summary matching
was 92% against a 100% target. These failures remain recorded without revised
labels or targets and do not establish Cambodian market coverage.

At the issue #107 measurement, parent #103 remained open pending reliable
short-prefix retrieval, resolution of the recorded relevance limitations, strict
malformed-cursor rejection, and explicit Scalar response examples. Appending
non-base64 `!!!!` to a valid cursor then returned 200 instead of the required 422.
Section 27 records the subsequent fixes and remaining acceptance failures. The
benchmark-only rate-limit settings did not change normal runtime limits. No
frontend UI, Dataset Snapshot rotation, or Khmer Translation generation was added.

## 27. Product Search review fixes (PR #108)

PR #108 now rejects malformed/noncanonical cursors with HTTP 422, documents success,
pagination, no-match and failure response examples in Scalar, and isolates real
Product Search integration tests in `lifegoods_off_test`. Explicit reader/writer
URIs are required; tests skip without them and reject application database targets.
The schema-1 production index and ranking/display rules remain unchanged.

The unchanged issue #107 corpus was rerun with separate evidence in
[PR #108 findings](research/search-validation/pr-108/FINDINGS.md). All 2,100 requests
succeeded without timeouts at commit `eeab921`; warmed concurrency-five p95 was 88.15 ms (target below
300 ms). Specific-Product hit-at-five remains 89.29% (target 90%) and discovery
matching is 99.5% (target 100%). These remain acceptance failures. Parent #103 stays
open and PR #108 stays unmerged; issue #107 remains completed evidence work. The
original issue #107 artifacts and the historical failure record above are retained.

Earlier fix iterations recorded timeouts, including a run overlapping a full Source Record count. Those failed runs remain in the PR evidence; the final run used grouped complete-tier retrieval with no concurrent database workload. This is not a guarantee of cold-cache or contended-load performance.

## 28. Compare Products from nutrition-label photos (Issues #110, #117)

Compare Products, presented as “Compare nutrition labels using photos,” is an
intended Life Goods capability with a direct entry point alongside Barcode
scanning. A Shopper photographs Product A and Product B, taps Compare, and
receives readable nutrition differences with a clearly stated comparison basis.
It works without a Barcode or Source Record, so missing or incomplete source data
does not prevent comparison. Compare Products helps a Shopper interpret label
differences without declaring an overall winner or producing health, safety, or
purchase verdicts.

Photo comparison is the one bounded exception to the read-only, no-upload MVP
boundary. Photos are sent to the configured AI provider for processing and are
never retained by Life Goods as Product data, Source Records, comparison history,
or Khmer Translation input. Extracted values remain submitted Photo Evidence,
kept separate from Open Food Facts data. The exception does not alter Product
Lookup, Product Search, Dataset Snapshot, Source Record, Source Attribution, or
Khmer Translation semantics.

Photo-derived text is evidence submitted for comparison. It is not an Open Food
Facts Source Record and is not the glossary-defined Original Text. The contract
retains literal text, original script, language (or `und`), printed units,
qualifiers, image and region references, and optional normalized Decimal values
separately. A missing number remains null; an explicit zero remains zero. Model
claims, provider metadata, and image regions are evidence pointers and do not
certify label authenticity or accuracy.

Image identifiers are opaque ASCII identifiers containing only letters, digits,
hyphens, and underscores; they never contain image bytes, local paths, or
fetchable URLs. Image regions use normalized coordinates in the inclusive
`[0, 1]` coordinate space of the referenced image. An extraction retains the
image registry, optional Product identity observations, package quantity,
nutrition columns, and each field's evidence pointers. Nutrition columns have
unique IDs, a printed basis (including explicit `unknown`), preparation state,
basis/preparation evidence, and fields with unique IDs. Readable package and
serving quantities require evidence; unreadable or not-visible quantities retain
null literal values and a field state.

The contract has separate states for readable, unreadable, ambiguous,
conflicting, and not-visible fields. Conflicting observations remain available
to callers rather than being silently selected. Nutrition columns retain their
per-package, per-serving, per-100-g, per-100-ml, or other printed basis and an
explicit preparation state (`as_sold`, `as_prepared`, or `unknown`). Percentage
and combined rows remain distinct from amount rows. Package and serving
quantities require explicit positive normalized values and units when they are
normalized.

A single Compare action orchestrates extraction for Products whose photo sets
have changed and then deterministic comparison; the Shopper does not run
extraction and calculation as separate operations. Extraction is sequenced within
provider concurrency limits, an unchanged Product's in-memory extraction is
reused, and duplicate submissions are prevented. Photos are not uploaded
automatically on every edit, and paid provider calls are not retried invisibly.
Before submission, the interface explains that photos are sent to the configured
AI provider for processing.

The visible states are ready for photos, reading labels, needs clarification or
retake, comparing, results, and recoverable failure. Successful extraction and
current photos survive a failure, and retrying processes only failed or changed
work. Replacing or removing photos, changing selected columns, resetting, and
leaving the feature prevent earlier responses from restoring stale results;
requests are cancelled where possible, and responses belonging to superseded
state are independently rejected. Restart clears the session and opens empty Product A capture without earlier photos
or results. Back to start clears the session and returns to the comparison intro,
restoring primary navigation. Product A’s Back always returns to that intro,
including when editing after results. Product B’s Back returns to Product A while
preserving the session.

Extraction and comparison are registered by the ordinary Life Goods FastAPI
application. FastAPI remains the frontend contract authority, and the OpenAPI
document and generated frontend client/types are the frontend wire contract. The
standalone development entry point started with `pnpm photo-comparison:dev`
remains available as a thin consumer of the same shared behavior rather than a
second implementation. The stable endpoints are:

- `POST /api/v1/photo-comparison/extractions`, accepting a bounded multipart
  request with one or more repeated `photos` fields for one Product and
  returning a validated extraction;
- `POST /api/v1/photo-comparison/comparisons`, accepting two validated
  extraction objects in a JSON `{ "left": ..., "right": ... }` request and
  returning comparison rows. Optional `left_column_id` and `right_column_id`
  values select the nutrition column for each Product; a selection is required
  when that Product has multiple columns, and a sole column is selected
  automatically. Client-submitted extraction objects are revalidated at this
  boundary because they cannot be certified as provider-produced.

Compare Products is reachable at `/compare` as a destination in the primary
navigation; previously published photo-comparison URLs redirect to `/compare`. The
page accepts one to three JPEG, PNG or HEIC/HEIF photos per Product through camera capture or
file selection, shows previews that can be enlarged, supports add/remove/replace,
and presents distinct editable Product A and Product B identities. Capture uses a
two-step Product A → Product B control, and comparison results render on their
own page with a clear return to edit either Product. A wrapped
label or separate package-weight panel can be included across multiple photos.
HEIC/HEIF (the iPhone camera-roll default) is transcoded to JPEG on the backend
before any provider call; browsers that cannot render HEIC show a neutral
"preview not available" tile while keeping the photo usable. Other unsupported
formats receive a clear unsupported-format message instead of promised
conversion. Every picked photo is read in full in the browser before it is sent:
one whose bytes are missing or incomplete (an iCloud-optimized photo that is not
downloaded, for example) is marked unusable before any upload, with a message
distinct from the unsupported-format one so the Shopper is told to make the
photo available rather than to change its format, and every other photo is
uploaded from the verified in-memory copy rather than re-read from device
storage while the request streams. When an extraction fails, the capture view switches to the Product
whose photos failed so its error is visible, and the other Product's panel shows
a pointer back to it. When a label contains a sole nutrition column it is
selected automatically; when several columns exist, the Shopper chooses one with
its plainly labeled basis and preparation state before continuing, and an
ambiguous column is never selected silently. The nutrition-column chooser opens
as a full page on mobile and desktop at `/compare?column=left` or
`/compare?column=right`, with Back returning to the preceding comparison screen.
Browser Back preserves the in-memory photos, extraction, and selections; advancing
to the other Product replaces the chooser history entry. Direct entry without
the required in-memory extraction returns to `/compare`.

Results lead with Product identities, the comparison basis, and the nutrition
comparison. Factual differences use deterministic localized templates rather than
a second generative interpretation call. Equal values are shown clearly. Missing,
unreadable, conflicting, qualified, or incompatible values are explained rather
than shown as zero or as an absence, and usable partial results remain available
when only some fields are readable. Results show the comparison values, visible
label percentages, and deterministic state explanations without repeating
per-row source-photo evidence or derivation disclosures. Source-photo evidence
remains available in the editable Product Photo Panel, and comparison responses
retain the underlying evidence and derivation data. Results contain no overall
score, winner, or good/bad health color. The page keeps the session in memory
and provides Restart and Back to start; it retains no saved history and no manual transcription
editor.

Image input is bounded at 10 MiB per photo and 32 MiB per multipart request;
photos above 25 megapixels are downscaled to fit rather than rejected. Pillow
(with `pillow-heif`) validates actual JPEG/PNG/HEIF content, applies EXIF
orientation, and re-encodes without metadata (HEIF output becomes JPEG). Anonymous admission limits are
enforced through shared, deployment-aware infrastructure rather than a single
process-local counter, with initial defaults of one active Gemini request, ten
extraction requests per minute, a 60-second provider deadline, and a 1 MiB JSON
response. Temporary image buffers are closed on success, rejection, exception,
cancellation, reset, and unmount. Application-side photos, photo-derived text,
prompts, provider bodies, and provider responses do not enter ordinary logs,
databases, or translation caches. Gemini-side retention remains governed by the
configured provider.

When the application is behind a reverse proxy, the deployment must configure
`LIFEGOODS_TRUSTED_PROXY_CIDRS` with the proxy network as a JSON-encoded array of
IP/CIDR values. Only requests whose direct peer is in one of those networks may
use `X-Forwarded-For` for anonymous per-IP limiting; untrusted or malformed
forwarded headers fall back to the direct peer address. The default is empty for
direct/local development.

Gemini extraction uses the existing API-key setting and the exact
`gemini-3.8-flash` model with a dedicated visible-evidence prompt. It requests
structured JSON, rejects malformed output or unknown image references, and
normalizes only explicit numerals and units locally. Missing credentials,
unsupported provider behavior, timeout, and provider failure return typed errors;
the app never substitutes fake results or another model. The Product Photo Panel
shows reported-value evidence and image links; the results view shows bases,
partial or retake information, assumptions, visible values, percentages, and
conditional/unavailable comparison rows.

Extraction configuration `photo-extraction-v3` requests compact visible evidence
with low thinking and a 16,384-token output budget. The provider schema omits
application field/column IDs, redundant serving-quantity state, and outcome;
Python supplies these after validation. Missing quantities may be omitted or null.
Identity names retain literal text while Python supplies their display labels.
The 60-second deadline and 1 MiB response limit still apply. Truncated output is
rejected with a specific error and requires an explicit retry.

Comparison inputs retain the complete field observation, column ID, printed
basis, preparation state, package/serving quantities, and evidence for the
reported basis and known preparation state. Derived values retain their output
unit, target basis, and derivation inputs pointing to the reported field and
any quantity used. Percentage and combined rows remain represented but cannot
enter the individual amount comparison.

Compatible units and preparation states are required for definitive numeric
differences. Comparison rows retain both reported inputs, optional normalized
values, calculation basis, assumptions, evidence, and a state of comparable,
conditional, or not-comparable. Unknown preparation states can support a reported
side-by-side view and an explicitly conditional derivation, but cannot produce a
definitive difference or winner. Missing, unreadable, conflicting, qualified,
incompatible, or zero-versus-missing values cannot produce a numeric difference,
and mass remains distinct from volume without supported conversion evidence.
Serving weights and package quantities are never invented. No comparison
contract contains a health, safety, or purchase judgment.

Photo comparison errors use the same JSON envelope for every failure:

```json
{
    "error": {
        "code": "provider_timeout",
        "message": "The extraction provider timed out."
    }
}
```

The typed error codes map to request validation (`422`), size limits (`413`),
unsupported image format (`415`), rate or capacity limits (`429`), invalid
provider output (`502`), provider unavailable (`503`), provider timeout (`504`),
and unexpected internal failure (`500`).

The capability enforces bounded upload and response sizes, JPEG/PNG/HEIC-only input,
finite request/image/pixel/concurrency limits, temporary resource cleanup, and
sanitized failure responses before making provider calls. Photos, package
text, prompts, provider payloads, and response bodies stay out of ordinary logs,
metrics, MongoDB, and translation artifacts. Provider-side retention is
documented separately from application cleanup. The contract-only issue provides
executable examples for a normal pair, missing weight, multiple columns,
conflicting photos, and unknown preparation states; it does not claim that
owner-checked seed transcriptions are reproducible image evidence.

Compare Products preserves the existing deterministic comparison engine and
semantics rather than introducing a second comparison engine. The reviewed
multilingual corpus and transcription tool from #111 were closed as not planned
and are not treated as requirements for the current implementation.

The integration defaults are one to three JPEG, PNG or HEIC photos per Product,
10 MiB per photo, 32 MiB per request, 25 megapixels per decoded image (larger
photos are downscaled), 1 MiB per
extraction or comparison response, and 1 MiB for the comparison request JSON,
at most eight nutrition columns, 100 fields per column, and 4,096 characters
per literal text field. Admission checks must run before unbounded buffering or
provider calls. The typed failure mapping is documented above. Partial and
retake-required extractions remain successful domain responses with explicit
outcomes and reasons.

Photos are processed transiently: application resources are released on success,
rejection, exception, cancellation, reset, and unmount, and no photos, extracted
label text, or comparison history are retained. Application cleanup does not make
a zero-retention promise for the provider; provider-side retention is documented
separately.

## Deployment health probes

`GET /api/health/live` returns `{ "status": "alive" }` without dependency checks.
`GET /api/health/ready` returns `{ "status": "ready" }` with HTTP 200 only when
MongoDB is reachable, the selected Dataset Snapshot and unique Barcode index are
available, the current Product Search collection/indexes are ready, the isolated
generated-data schema is compatible, and Redis responds. Otherwise it returns
HTTP 503 `{ "status": "not_ready" }`, without dependency errors or credentials.
These read-only probes never call the AI provider or modify storage and remain
blocked through the public staging Worker. Responses are not cached.

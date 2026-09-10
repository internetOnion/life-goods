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

For a found Product, `data` also contains `allergen_analysis` beside the unchanged
`source_record`. The analysis keeps `off` tags separate from `ingredient_matching` tags and
includes a `comparison` with exact-tag intersections and differences. Ingredient matching runs
when usable English ingredient text is present regardless of whether `allergens_tags` is empty.
Missing, unsupported, ambiguous, or insufficient ingredient evidence is returned explicitly and
does not mean that the Product has no allergens. The analysis is source comparison, not a Life
Goods safety, allergen-free, or verification verdict.

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

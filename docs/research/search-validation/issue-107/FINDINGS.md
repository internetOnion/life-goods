# Product Search is indexed; parent acceptance is withheld

Measured 2026-09-09 Asia/Phnom_Penh (2026-09-08 UTC), against starting commit
`062d01177c7254ac10056931b74674f7103631c1`.

**Recommendation: do not accept or close #103.** The production index and real HTTP
operation now work, and warmed concurrency-five p95 passes. However, short prefixes
time out, two frozen relevance targets fail, and malformed continuation tokens can
be accepted. These are recorded failures, not waived targets. Issue #103 and its
specification remain unchanged. No production implementation remedy is hidden in
this evidence-only change.

## Production activation and preservation

The existing `reindex-search` lifecycle command built schema **1**, status **READY**,
for the already-active snapshot `9f6d5359fa944e458804c1b63e7365a7`.

| Measurement | Result |
| --- | ---: |
| Source Records, measured before and after | 4,710,709 |
| Indexed records | 4,522,390 |
| Excluded unusable stored Barcodes | 188,319 |
| Lifecycle command elapsed | 1,067.34 s |
| Derived collection logical size | 2,486,141,730 bytes |
| Derived compressed storage | 863,973,376 bytes |
| Derived indexes | 485,806,080 bytes |
| Source compressed storage, before | 35,052,933,120 bytes |

The measured count, rather than the manifest's advertised 4,710,770, is the
coverage denominator. Indexed plus excluded equals the measured source count.
The activation pointer is exactly unchanged. The manifest is unchanged except for
`search_index` and `search_enabled`; Source Records were not modified. The runtime
uses its existing read-only source identity. The three required indexes are present:
`ix_search_name_tokens`, `ix_search_brand_tokens`, and `ix_search_sort`.

MongoDB **8.2.12** runs locally in Docker with **11 available CPU cores and 7,933 MiB
memory**; the HTTP runner is on ARM64 macOS. Raw metadata, sizes, indexes, activation
state and lifecycle output are retained in [index-build.json](index-build.json).
This is local-host evidence, not deployment capacity or a cold disk-cache study.

## Frozen relevance and HTTP measurements

[corpus-v1.json](corpus-v1.json) contains 100 cases frozen before successful ranked
retrieval: 40 discovery, 28 specific-Product, 18 complete Barcode, nine brand, and
five artificial negative cases. Four original cases have separately recorded
unusable-Barcode exclusions. The original corpus, measurements and findings are
unchanged. The exact corpus SHA-256 is in [http-measurements.json](http-measurements.json).
[README.md](README.md) defines scoring, targets and the portable reproduction commands.

| Frozen relevance measure | Result | Target | Outcome |
| --- | ---: | ---: | --- |
| Specific-Product hit-at-five | 25/28 = 89.29% | ≥90% | Fail |
| Source-brand precision-at-five, macro average | 100% | ≥80% | Pass |
| Discovery displayed-summary matching, macro average | 92% | 100% | Fail |
| Barcode top-one | 18/18 | 100% | Pass |
| Artificial negative empty responses | 5/5 | 100% | Pass |

Specific-Product misses were `Bovetti Véritable pâte`, `Oreo Oreo Birthday`, and
`Lutti Lutti Bubblizz`: the labeled Barcodes appeared at positions **6, 14, and 10**.
The returned alternatives have related source wording; these are not claims of
unrelated retrieval or source absence. Repeated brand wording and same-name
variants expose limits of deterministic ranking and strict Barcode labels. The
frozen metric remains failed; no post-measurement equivalence rule was added.

Discovery failures comprise three short-prefix timeouts and one displayed-name
mismatch for `Mini Frutas`. For the latter, matching terms occur across two
localized names; the selected Finnish name exposes only `Mini`. The other term is
in Spanish-looking text tagged `fr`. Retrieval is grounded in the indexed source
names, but that summary does not expose the full query match. See
[display-diagnostic.json](display-diagnostic.json). This distinguishes presentation
and source-language limitations from a missing Source Record.

Four cases contain actual Khmer script, across two source Products, including
mixed Latin/Khmer queries. They succeed, but text appears in an unlabeled field and
a `zu` field; language suffixes are not verified language assertions. Missing
summary fields remain nullable/empty. Neither this convenience corpus nor its
artificial negatives establish Cambodian market coverage or Khmer segmentation.

| HTTP run | Requests | p50 | p95 | p99 | Errors / server timeouts |
| --- | ---: | ---: | ---: | ---: | ---: |
| Separate first pass | 100 | 18.99 ms | 667.57 ms | 2,028.35 ms | 3 / 3 |
| Warmed, concurrency 1 | 1,000 | 9.00 ms | 93.52 ms | 2,008.19 ms | 11 / 11 |
| Warmed, concurrency 5 | 1,000 | 11.62 ms | **149.13 ms** | 2,014.80 ms | 29 / 29 |

There are **43 server timeouts and zero client timeouts** across these 2,100 requests.
All errors are `503 search_timeout` for the supported two-character prefixes
`co`, `ch`, or `ca`. The warmed concurrency-five **p95 <300 ms target passes**;
the frozen **zero-error target fails**. Nearest-rank percentiles include failed
requests. These HTTP numbers are not directly comparable with the original
runner-only timings or its different corpus.

The dedicated loopback Uvicorn server used a benchmark-only **100,000 requests/minute**
limit and Redis database **14**, with no search application cache. Existing runtime
settings and Redis database 0 were unchanged. A separate server using the normal
**60/minute** limit and Redis database **15** returned 422 for 60 invalid-query
requests, then 429 `rate_limit_exceeded` with `Retry-After: 60` on request 61:
[rate-limit.json](rate-limit.json). Access logging was disabled. Only curated source
inputs are retained, with no Shopper histories or provider generation.

## Execution plans, pagination and contract checks

[plans.json](plans.json) retains real production aggregate commands and separate
`executionStats` explains, all with `maxTimeMS=2000`.

| Diagnostic | Keys examined | Documents examined | Explain execution |
| --- | ---: | ---: | ---: |
| Common: `Kroger` | 8,396 | 7,399 | 22 ms |
| Rare: `កូកា-កូឡា` | 1 | 1 | 0 ms |
| No match | 2 | 0 | 0 ms |
| Short prefix: `co` | 558,846 | 498,632 | 1,877 ms |

All four explains use token indexes followed by computed-rank sorting. No inspected
sort spilled or used disk. The short-prefix retrieval immediately preceding its
explain timed out; the subsequent explain completed near the deadline. Successful
explain timing does not negate the HTTP timeouts. Returning only 21 candidates does
not bound the hundreds of thousands of documents examined before sorting.

All **13 real HTTP smoke checks pass**, including formatted and leading-zero
Barcodes, a source-confirmed absent valid Barcode, text absence, numeric brand text,
query bounds, obvious invalid cursors, typed summaries and Source Attribution.
Before readiness, Barcode retrieval returned 200 while text returned explicit 503:
[before-index-http.json](before-index-http.json). The all-zero Barcode exists in
this snapshot and was not used as an absence claim.

All **23 sampled continuation pages** returned 200 and were disjoint from their
first pages. Exhaustive traversals of nine Darigold results, 14 Oreo results, and
**39 Lutti results over two pages** terminated with unique Barcodes in exactly the
order returned by a separately bounded production aggregation, with no omissions.
The Lutti cursor used with another query returns 422 `invalid_cursor`. See
[http-pagination-lutti.json](http-pagination-lutti.json); earlier shorter traversals
are also retained.

**Malformed-cursor rejection fails:** appending `!!!!` to a valid continuation token
returns **200**, instead of 422. Python's permissive base64 decoding ignores the
extra characters. This is a strict-input-contract defect, not an authorization
bypass. [malformed-cursor.json](malformed-cursor.json) preserves the observed response.
The final reusable runner repeats this result in [http-final-smoke.json](http-final-smoke.json).

Scalar and OpenAPI both return 200, Scalar references `/openapi.json`, and
`searchProducts` is discoverable with Barcode, combined-term and prefix query
examples. **The parent additionally requires success, pagination, no-match and
failure response examples; explicit response examples are absent from the current
operation.** Schemas and status descriptions are present, but do not fulfill that
example requirement.

## Parent completion and remaining work

| Parent completion area | Evidence / status |
| --- | --- |
| Current production index, readiness, source preservation | Met; full measured lifecycle build |
| Registered HTTP operation, summary contract, attribution, Barcode fallback | Met in real HTTP smoke and existing acceptance suite |
| Matching, Unicode, source-name selection and ranking mechanics | Existing HTTP suite passes; frozen relevance targets remain failed as described above |
| Pagination and query binding | Observed continuation/exhaustion checks pass; malformed-token rejection remains unmet |
| Bounded execution and full-scale performance | Two-second timeout is enforced; p95 passes, zero errors remains unmet |
| Scalar discoverability and complete examples | Discoverability met; explicit response examples remain unmet |
| Privacy and read-only product boundary | Preserved; no frontend UI, source rotation, translation calls or new search engine |
| Original benchmark and frozen independent corpus | Preserved and measured without changing targets |
| Maintainer verification | Tests, lint, typecheck, build and API drift pass; existing repository-wide formatting failure remains |

Visible follow-up work is to make short-prefix retrieval reliable within the
existing deadline, strictly reject malformed cursor encodings, address the failed
ranking/display targets with explicit implementation or separately versioned
future evaluation work, and supply the missing Scalar response examples. Re-run
the unchanged v1 workload after remedies. Do not remove short queries, relax the
deadline, discard errors, or rewrite this run to claim acceptance.

Verification: **95 frontend tests and 409 backend tests pass**, with 18 existing
service-integration tests skipped. Real production HTTP/MongoDB evidence above is
separate from mocks; fixture suites that replace activation metadata were not run
against the current active snapshot. `pnpm typecheck`, `pnpm lint`, `pnpm build`,
and `pnpm api:check` pass; generated API/client files have no drift. Repository-wide
Ruff formatting reports **44 pre-existing files**; the new runner passes its format
check. Existing dotenv parsing, mongomock deprecation and Vite chunk-size warnings
are recorded in [verification.json](verification.json).

Code review found and resolved UTF-8 portability, duplicated benchmark settings,
client-timeout accounting and insufficient smoke assertions. Standards review has
no remaining code findings. Spec review has no remaining runner findings; the
measured parent failures above remain explicit acceptance blockers.

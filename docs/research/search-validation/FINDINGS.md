# Product search baseline: latency passes; relevance needs refinement

Measured on 2026-09-08. Keep MongoDB as the starting point, but refine relevance
judgments, brand matching, and Unicode handling before exposing a search API.
The experiment does not justify adding another search engine.

## Evidence

The pinned Dataset Snapshot is `9f6d5359fa944e458804c1b63e7365a7`.
The source collection contains **4,710,709 Source Records**; **4,710,708** produced
search documents. One record lacked a usable string Barcode. The manifest's
advertised `document_count` was 4,710,770; the benchmark uses the measured collection
count, not that manifest counter. Source collections and activation metadata were
not modified.

The isolated database is `lifegoods_search_eval_baseline_v1`. MongoDB is **8.2.12**,
running locally in Docker with **11 available CPU cores and 7,933 MiB memory**;
the runner is on an ARM64 macOS host. Evaluation indexes occupy **497,770,496 bytes**
(about 498 MB); compressed collection storage occupies **761,835,520 bytes**.
Preparation took about **654 seconds**, including index creation and inspection.
The source collection had only `_id_` and the unique Barcode index, so its existing
indexes alone would not establish search readiness.

The 60 source-derived cases were frozen before ranked retrieval. Expectations use
an inspected Barcode or equivalent primary Original Text name and brand; brand
queries require matching source brand evidence. Original Text label comparisons
preserve combining marks rather than reusing candidate tokenization. The exact
query-set digest is retained in `measurements.json`.

| Relevance measure | Result | Fixed target | Outcome |
| --- | ---: | ---: | --- |
| Exact-name top-one success | 50% (10/20) | ≥90% | Fail |
| Intended-Product hit within five results | 77.8% (35/45) | ≥90% | Fail |
| Brand precision within five results, macro-average | 78% | ≥80% | Fail |
| Artificial no-match cases | 5/5 | Diagnostic | Pass |

Within-five success was 85% for exact names, 60% for fragments, 90% for combined
brand/name queries, and 60% for normalization variants. Per-source-language-field
and per-query-type results are retained in the measurements. Language groups are
small and field suffixes are not independently verified language labels.

| Run | Requests | p50 | p95 | p99 | Errors / timeouts |
| --- | ---: | ---: | ---: | ---: | ---: |
| First pass | 60 | 3.71 ms | 120.44 ms | 610.70 ms | 0 / 0 |
| Warmed, concurrency 1 | 1,000 | 1.57 ms | 35.40 ms | 90.39 ms | 0 / 0 |
| Warmed, concurrency 5 | 1,000 | 2.44 ms | **62.19 ms** | 181.23 ms | 0 / 0 |

The warmed concurrency-five p95 passes the predeclared **300 ms** target. There was
no application cache and no translation provider. These are local runner timings,
including MongoDB round trips and result construction, not HTTP/deployment latency.
The first pass is not a cold disk-cache measurement; preparation had just populated
the evaluation database.

## What the relevance failures mean

**Some failures reflect ambiguous intent, not unrelated results.** `Chamomile Herbal
Tea` (q02) returns that name from several brands, but the label targets Lagg's.
`Tomato Sauce` (q11) matches 4,488 records and its label targets All Gold even though
the query does not specify that brand. A deterministic name/Barcode tie-breaker
cannot infer an omitted brand. The 50% measure is intended-Product retrieval under
these labels; it does not mean half the returned names are unrelated. Retain these
results and targets, but distinguish broad discovery from specific-Product intent
in the next, separately versioned query set.

**Brand ranking has a concrete weakness.** For `Danone` (q31) and `Kroger` (q40), the
first five results include exact name matches with different or unavailable source
brand text. The baseline ranks exact names before exact brands for every query.
Evaluate an explicit brand filter or brand-aware matching next. Missing brand text
is Source Data Unavailable, not evidence that the Product lacks that brand.

**Khmer normalization is lossy even when examples pass.** The baseline transforms
`ទឹកដោះគោ` into `ទ កដ គ`, dropping combining marks. Three actual Khmer-script query
variants passed, but they cover only two Products and do not establish correct
Khmer segmentation or collision handling. The snapshot contains 240 nonempty
`product_name_km` fields, some containing Latin-script text. One inspected Khmer
name (`ស្រាបៀរ អង្គរ`) is stored in `product_name_zu`; another is in the base name
field. Test script-preserving normalization and Khmer distinctions before treating
source language tags or these three successes as language support.

**Coverage remains separate.** 281,410 indexed Source Records have no nonempty name
field. Known-present examples test retrieval; artificial negative queries do not
measure real Products absent from the snapshot. The source-derived convenience
sample, token/brand eligibility restrictions, and occasional mislabeled languages
prevent claims about Cambodian market coverage or typical Shopper behavior.

## Query plans and next step

Real MongoDB execution statistics show indexed token retrieval and a subsequent
bounded-result sort; the inspected sorts did not spill to disk.

| Diagnostic | Matching documents | Keys examined | Documents examined |
| --- | ---: | ---: | ---: |
| Common case: Kroger (q40) | 7,589 | 8,590 | 7,589 |
| Rare case: Khmer Coca-Cola name (q01) | 1 | 1 | 1 |
| No match (q56) | 0 | 0 | 0 |

The common query uses both `name_tokens_1` and `brand_tokens_1`, then computes rank
and sorts the candidates down to 20 results. The compound name-sort index does not
eliminate sorting by the computed rank. Full execution plans and all 60 match
counts are retained, including zero matches.

Recommended next work:

1. Separate broad-name discovery judgments from known-Product judgments, making
   any intended brand/variant explicit in the latter queries. Preserve this run
   unchanged; define the next corpus before inspecting its ranked results.
2. Compare brand-aware matching with the current exact-name-first policy on the
   same baseline cases. Keep the experiment backend-only until the contract is chosen.
3. Evaluate Khmer combining-mark preservation and distinguishable-word fixtures;
   inspect language metadata independently from actual script.
4. Re-run relevance and latency after those changes. Keep MongoDB unless new
   evidence shows its query behavior or capacity is insufficient.

No public endpoint, frontend changes, provider calls, or source-data mutations
were introduced. The evaluation database is disposable and was retained so the
recorded queries can be rerun without rebuilding the index.

## Artifacts and verification

- `queries.json`: fixed cases, source provenance, and inspected Khmer examples.
- `preparation.json`: measured size, field coverage, indexes, and host resources.
- `measurements.json`: request timings, scores, source-field groups, and query plans.
- `synthetic-normalization.json`: explicitly synthetic Unicode diagnostics.
- `README.md`: portable commands, isolation requirements, and scoring definitions.

The backend suite passed **355 tests**, with **15 existing integration tests skipped**.
The new evaluation tests cover query bounds, ranking, cross-field matching, ties,
limits, missing indexes, preparation isolation, timeout scoring, and Original Text
equivalence without Khmer-mark loss. Ruff lint and formatting checks passed.
Real performance evidence comes from the 2,060 MongoDB requests above, not mocks.

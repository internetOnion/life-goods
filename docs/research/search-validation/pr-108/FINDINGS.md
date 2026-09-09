# PR #108 review fixes and acceptance evidence

The review fixes are implemented. **Parent #103 is not accepted and PR #108 remains
unmerged**, because the unchanged specific-Product and displayed-summary relevance
targets still fail. Issue #107 remains completed evidence work.

## Final implementation

Tested implementation: `eeab921` on `feat/product-search`, following `5710f48`.
The full hashes and check results are in [verification.json](verification.json).

- Integration tests require explicit reader/writer connections to
  `lifegoods_off_test`, reject the application database before writes, and clean
  unique fixtures through `finally`. Application credentials/pointer backup and
  replacement are removed. The test identities have database-scoped read/readWrite
  roles and are temporary.
- Complete-token candidates are retrieved once and ranked through the unchanged
  exact-brand, exact-name and complete-token tiers. Only an unfilled page queries
  remaining prefixes. Keyset ordering and the 21-result lookahead are unchanged.
  All commands share a two-second execution budget; exhaustion returns an error,
  not partial success.
- One- or two-character final prefixes use a 129-candidate probe. At most 128
  candidates constitute an exhausted set that can be sorted exactly in memory;
  larger sets use the existing name/Barcode sort index with early termination.
  Longer prefixes retain indexed candidate retrieval. No schema change or index
  rebuild was made.
- Cursors are bounded to 4,096 characters, canonical unpadded URL-safe base64,
  and strictly validated JSON primitives. Fingerprints must be 16 lowercase hex
  characters, Barcodes ASCII digits, and sort names valid UTF-8. Appended garbage,
  non-ASCII fingerprints and escaped lone surrogates return 422 `invalid_cursor`.
  Tokens remain unsigned pagination input.
- Scalar includes success, continuation, no-match and error examples. Generated
  OpenAPI artifacts are refreshed; schema and API checks pass. The inaccurate
  HMAC wording in the specification is corrected.

## Final frozen-corpus run

[grouped-tier-http-measurements.json](grouped-tier-http-measurements.json) uses the
unchanged issue #107 100-case corpus and target definitions. No other database or
test workload ran concurrently. Timings include real HTTP, the registered route,
MongoDB and Redis. No application search cache or provider calls were added.

| Phase | Requests | p50 ms | p95 ms | p99 ms | Errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| First pass | 100 | 10.12 | 91.95 | 190.34 | 0 |
| Warmed concurrency 1 | 1,000 | 7.73 | 56.89 | 117.30 | 0 |
| Warmed concurrency 5 | 1,000 | 11.84 | 88.15 | 187.84 | 0 |

Both the zero-error and warmed concurrency-five p95 below 300 ms targets pass.
The first pass is not a cold disk-cache measurement. Results do not establish
reliability under every query, cold-cache state, or competing workload.

| Relevance metric | Result | Unchanged target | Outcome |
| --- | ---: | ---: | --- |
| Specific-Product hit-at-five | 25/28 = 89.29% | 90% | Fail |
| Discovery displayed-summary matching | 99.5% | 100% | Fail |
| Exact source-brand precision | 100% | 80% | Pass |
| Barcode top-one | 100% | 100% | Pass |
| Negative empty response | 100% | 100% | Pass |

The specific misses remain `q43`, `specific-q08` and `specific-q12` (Bovetti,
Oreo and Lutti cases in the frozen corpus). Discovery `q22` scores 0.8: matching
terms span different source names, while the selected summary displays only one.
These observations remain limitations under the agreed targets; they do not alone
prove a violation of the specified ranking/display rules. No labels, thresholds,
rank rules or Source Records were changed to improve the score. The corpus does
not establish Cambodian market coverage or verify source language labels.

## Retained failures and the implementation adjustment

All attempted full protocol runs are retained; filenames containing `final` refer
to earlier iterations and are not the final acceptance result.

| Evidence file | Implementation/workload | Errors | Warmed c5 p95 ms |
| --- | --- | ---: | ---: |
| `http-measurements.json` | Initial fix working tree | 0 | 210.12 |
| `final-http-measurements.json` | `5710f48`, concurrent full Source Record count | 23 | 810.80 |
| `isolated-http-measurements.json` | `5710f48`, no concurrent database work | 1 first-pass timeout | 260.09 |
| `grouped-tier-http-measurements.json` | `eeab921`, grouped complete tiers | 0 | 88.15 |

Contention is a plausible contributor to the 23-timeout run, but the next isolated
first pass also timed out on `Sauce À`; the failure was not dismissed as contention.
[sauce-plans.json](sauce-plans.json) showed three complete-tier queries each
examining 51,074 documents, taking 257/244/268 ms in the subsequent diagnostic.
The final implementation groups those complete tiers into one query, removing the
repeated scans while preserving ranking. This is an execution-strategy adjustment
to the original plan, not a change to matching or acceptance requirements.

## Functional checks and preservation

The final [HTTP smoke](grouped-tier-http-smoke.json) passes all 13 checks. Lutti
pagination returns all 39 Products over two pages, without duplicates or omissions,
in the same order as the original exhaustive ranking aggregate. Malformed and
query-mismatched cursors return 422. All 26 continuation checks from the final
corpus run succeed and are disjoint from their preceding pages.

[grouped-tier-plans.json](grouped-tier-plans.json) retains every actual command,
remaining timeout budget and execution plan for common, rare, absent, short-prefix
and sparse short-prefix queries. Earlier plans remain available for comparison.
The seven real-MongoDB tests exercise all ranking tiers, ties, one-/two-character
and longer prefixes, multilingual text, sparse and broad candidate paths, and
exhaustive pagination. Literal expected ordering is independent of query code.

[preservation.json](preservation.json) confirms the active pointer, source count
(4,710,709) and search-index metadata match issue #107. Pointer timestamps were
normalized to JSON before comparison; an initial comparison mixed datetime objects
with stored JSON strings and produced a false mismatch. No Source Record writes,
activation changes or index rebuilds occurred. Historical issue #107 files are
unchanged. Runtime settings and Redis database 0 remain unchanged.

Validation: 95 frontend tests, 433 backend tests, and seven explicitly isolated
Product Search integration tests pass. The default suite skips 22 real-service
cases. Typechecking, lint, build, API drift and formatting of changed Python files
pass. Existing dotenv, mongomock deprecation and Vite chunk-size warnings remain.
Scalar was inspected in the browser: the operation, success example choices,
continuation token and temporary-failure example are discoverable.

## Standards review

Zero remaining actionable findings. Disposable database isolation and cleanup
resolve the previous standards violation. No additional actionable code smells
were identified.

## Spec review

Zero remaining code findings after correcting the escaped-surrogate cursor case
and reviewing grouped complete-tier retrieval. The unchanged relevance targets
remain parent acceptance blockers. PR #108 must remain unmerged and #103 open.

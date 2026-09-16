# Full-dataset Product Search acceptance, corpus v1

This evidence belongs to issues #103 and #107. The original files in the parent
folder are unchanged. This convenience corpus does not establish Cambodian market
coverage, Shopper behavior, language correctness, or Product verification.

## Frozen protocol

The corpus was frozen from original source-derived cases and current Source Record
reads before ranked HTTP retrieval. Invalid stored Barcodes are recorded as source
eligibility exclusions, not retrieval misses. Missing fields and unexpected language
labels remain source limitations. Actual Khmer script is flagged independently of
source language metadata. Source-brand plus Khmer-name cases supply mixed-script
queries. The eight extra common/short queries are exploratory discovery probes;
they are not asserted to identify a particular Product. All queries are curated
benchmark inputs, never retained Shopper activity.

Targets were fixed before measurement: specific-Product hit-at-five >=90%, exact
source-brand macro precision-at-five >=80%, discovery matching precision-at-five
100%, Barcode top-one 100%, negative empty response 100%, no request errors, and
warmed concurrency-five HTTP p95 strictly below 300 ms. Failed HTTP requests score
zero and remain separately counted. Targets will not be revised after measurement.

Specific-Product success means the original labeled Barcode occurs in the first
five results. No equivalent-Product substitution is made in this version; variants
with the same name/brand can therefore expose a limitation of this metric. Broad
name, fragment, normalization, and prefix cases are discovery: score the fraction
of returned top-five summaries whose displayed name and brands jointly contain all
earlier complete terms and the final prefix. Exact source-brand precision uses
normalized exact brand membership. Barcode queries require their labeled Barcode
first. Negatives require an empty successful response. Each score is macro averaged
within its intent group. Unicode label normalization independently preserves letters,
numbers, and attached marks; it does not implement Khmer word segmentation.

HTTP timings use a persistent HTTP client against a separate local Uvicorn process
running the actual application factory and registered route with real MongoDB and
Redis. Timings include transport and server work, exclude executor queue waiting,
and use nearest-rank p50/p95/p99. Validation runs after the timed HTTP call. The
first pass is separate and is **not** a cold disk-cache measurement. Each warmed
run contains at least 1,000 requests, shuffled with seed 20260908, at concurrency
one and five. No application search cache or provider call is introduced.

The benchmark server alone sets `LIFEGOODS_PRODUCT_SEARCH_REQUESTS_PER_MINUTE=100000`
and uses Redis database 14. A separate normal-limit server uses 60 and Redis
database 15. Existing runtime configuration and Redis database 0 remain unchanged.
Both bind loopback only and disable access logging. Redis limiter keys expire;
artifacts contain no client IPs. MongoDB keeps its 2,000 ms execution deadline.

## Reproduce

Run from the repository root with installed backend dependencies and the current
local MongoDB/Redis services. Environment variables can be set with the shell's
native syntax; commands themselves contain no shell-specific assignments.

```text
pnpm off:dataset reindex-search 9f6d5359fa944e458804c1b63e7365a7
uv run --project backend python backend/scripts/search_acceptance.py serve
uv run --project backend python backend/scripts/search_acceptance.py run --output /path/to/new-measurements.json
uv run --project backend python backend/scripts/search_acceptance.py plans --output /path/to/new-plans.json
uv run --project backend python backend/scripts/search_acceptance.py serve --port 8108 --normal-limit
```

`freeze --corpus /path/to/new-corpus.json` creates a new corpus from source reads;
use the committed v1 corpus to reproduce this run. Freeze/run refuse to overwrite
existing corpus/measurements. Execution plans capture the actual aggregate command
through PyMongo monitoring, then execute `explain` with `executionStats` separately;
these diagnostics are not HTTP timings. Full plan output records index use,
examined keys/documents, sorting, spills and explicit timeouts.

Additional contract/pagination reproduction (use a new output path to retain past
runs):

```text
uv run --project backend python backend/scripts/search_acceptance.py smoke --pagination-query "Lutti Lutti Bubblizz" --output /path/to/new-smoke.json
```

The smoke action records expected-status, Barcode identity and Source Attribution
checks, exhaustive pagination with a 2,000-result comparison bound, query mismatch,
and a non-base64 cursor mutation. Its default narrow query terminates within one
page; the recorded Lutti query exercises two pages. Diagnostic query selection
occurred after the frozen load run and does not change relevance targets or scores.
The standalone malformed-cursor artifact was captured before that probe was added
to the reusable smoke action.

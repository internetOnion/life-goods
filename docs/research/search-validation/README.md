# Backend Product search evaluation

This experiment evaluates Original Text name/brand search over a pinned Open Food
Facts Dataset Snapshot. It is not a public HTTP endpoint, Product verification,
or evidence of Cambodian market coverage.

## Reproduce

Use Python 3.13 and the backend's existing dependencies. Configure these environment
variables using your shell or process runner's native environment settings:

- `LIFEGOODS_SEARCH_SOURCE_URI`: MongoDB connection with read-only access to the
  source database (needed only for preparation).
- `LIFEGOODS_SEARCH_EVAL_URI`: MongoDB connection with read/write access to a
  separate database named `lifegoods_search_eval_<experiment>`.

The evaluation database must be empty for preparation. The tool never drops or
replaces an existing database. Interrupted preparation leaves a `building` marker;
use a new experiment database to retry. Do not use the serving source database or
translation storage. For measurement, read access to the prepared evaluation
collections is sufficient. Index/storage inspection and `hostInfo` require the
corresponding MongoDB diagnostic privileges during preparation.

Run the following commands from the repository root, replacing `VERSION` and
`EXPERIMENT` with your explicit choices (commands are single-line and portable):

```text
uv run --project backend python -m lifegoods.search_validation.cli prepare --dataset-version VERSION --evaluation-database lifegoods_search_eval_EXPERIMENT --query-set docs/research/search-validation/candidate-queries.json --output docs/research/search-validation/preparation.json
uv run --project backend python -m lifegoods.search_validation.cli run --dataset-version VERSION --evaluation-database lifegoods_search_eval_EXPERIMENT --query-set docs/research/search-validation/queries.json --output docs/research/search-validation/measurements.json --requests 1000
```

Preparation streams only name, brand, quantity, and Barcode fields into derived
search documents. It counts name fields by language, records source/evaluation
indexes and resources, and creates labels from source examples **before** retrieval.
Localized examples are selected round-robin across available language fields,
prioritizing actual Khmer script, then Khmer-labeled fields and English, with one
example per Barcode. The recorded run additionally inspected Original Text for
Khmer examples before freezing labels; `actual_khmer_examples` records them. Preparation emits candidate cases. Review and freeze them before ranked retrieval;
use the committed `queries.json` unchanged to reproduce this experiment. The fixed
query file is the reproducibility boundary; retain it with the Dataset Snapshot.
Selection requires a brand of 1–3 tokens and a name of 2–7 tokens (at most 150
characters), so single-word, very long, and brandless names are underrepresented.
Language labels are source field suffixes, not independently verified languages.
The baseline intentionally retains existing normalization, including its known
loss of Khmer combining marks. Synthetic tests document that limitation rather
than pretending it is supported correctly.

## Measurements and interpretation

The 60 cases comprise 20 exact names, 10 name fragments, 10 brands, 10 combined
brand/name queries, five normalization variations, and five artificial no-match
queries. Original source fields and expected Barcodes remain inspectable in the
query file. Brand judgments use exact source brand membership. These are
source-derived labels, not a human study of Shopper intent. Another Barcode is accepted when its primary Original Text name and a source
brand equal the labeled name and brand after NFKC, case, and whitespace
normalization. This comparison preserves combining marks and does not reuse
candidate tokenization. Localized-only equivalent alternatives can still be
under-counted; inspect these failures before drawing ranking conclusions. Missing-name counts describe source coverage;
known-present cases test retrieval. The artificial negatives do not measure the
coverage of real Products missing from Open Food Facts.

Exact-name top-one success and intended-Product hit-at-five use labeled Barcodes
or the explicit Original Text equivalence rule above.
Brand precision is the fraction of returned top-five results with the expected
source brand (zero for no results). Metrics are also grouped by language and query
type; small groups are diagnostic, not population estimates. Failed requests count
as relevance failures and are separately counted as errors/timeouts.

First-pass timings are separate from warmed runs and are **not cold disk-cache
measurements**. Each warmed run executes at least 1,000 requests, at concurrency
one and five, with seed `20260908`, no application cache, and a two-second MongoDB
execution deadline per search. Timings include retrieval of at most 20 summaries,
network round trips, and Python result construction; they exclude HTTP transport
and client-side queue waiting. Server execution deadlines do not impose an exact
wall-clock deadline on network failures.

Query plans capture MongoDB execution statistics, including index/collection scans,
examined documents, and sort stages. Common and rare cases are selected by measured
match counts among the curated cases; count timeouts remain explicit. This is not
a measurement of the most common query across all possible Shopper requests.

Provisional targets were fixed before measurement: exact-name top-one >=90%,
intended-Product hit-at-five >=90%, brand precision >=80%, and warmed concurrency-five
p95 <300 ms. All request errors also prevent a proceed recommendation. Report
failed targets without changing them after seeing results. Local results establish
local feasibility, not production capacity or deployment latency.

Only curated evaluation inputs and external Source Records appear in these
artifacts. There are no Shopper histories, analytics events, provider calls,
translations, or source database writes.

## Tests

```text
uv run --project backend python -m pytest backend/tests/test_search_validation.py
```

Unit tests cover query bounds, normalization (including synthetic Khmer and mixed
script), ranking, cross-field matching, stable ties, result limits, missing indexes,
preparation isolation, query distribution, and metric calculation. Mocks are used
only for deterministic behavior; the full benchmark uses real MongoDB.
